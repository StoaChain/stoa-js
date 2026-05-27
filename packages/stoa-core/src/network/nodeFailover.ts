/**
 * Node Failover — automatic failover between Stoa Chain nodes.
 *
 * Primary: node2.stoachain.com (ASIC miner, 2M gas limit)
 * Fallback: node1.stoachain.com (seed node, 1.6M gas limit)
 *
 * Health check: GET /info with 3s timeout.
 * Retry primary every 30s when on fallback.
 */

import { getLogger } from "../observability/index.js";

const KADENA_NETWORK = "stoa";

const NODE2_HOST = "https://node2.stoachain.com";
const NODE1_HOST = "https://node1.stoachain.com";

/** Known gas limits per node */
const NODE_GAS_LIMITS: Record<string, number> = {
  [NODE2_HOST]: 2_000_000,
  [NODE1_HOST]: 2_000_000,
};

/** Default gas limit for unknown/custom nodes (chainweb default) */
const DEFAULT_GAS_LIMIT = 1_600_000;

let PRIMARY_HOST = NODE2_HOST;
let FALLBACK_HOST = NODE1_HOST;
let customGasLimit = DEFAULT_GAS_LIMIT;

const HEALTH_TIMEOUT_MS = 3000;
const RETRY_INTERVAL_MS = 30_000;

let currentHost = PRIMARY_HOST;
let retryTimer: ReturnType<typeof setInterval> | null = null;

/** Check if a node is healthy */
async function isHealthy(host: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${host}/info`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** Switch to fallback and start retry loop */
function switchToFallback() {
  if (currentHost === FALLBACK_HOST) return;
  getLogger().warn("[node-failover] Primary node down, switching to fallback:", FALLBACK_HOST);
  currentHost = FALLBACK_HOST;
  startRetryLoop();
}

/** Switch back to primary */
function switchToPrimary() {
  if (currentHost === PRIMARY_HOST) return;
  // v3.3.0 (closes part of consolidated F-LOGGER-SEAM-001): routed through
  // the `getLogger().info(...)` seam added in v3.3.0. Symmetric with
  // line 53's `getLogger().warn(...)` for the failover-detected case.
  // Pre-v3.3.0 this was a raw `console.info` — the only seam violation
  // in nodeFailover.ts.
  getLogger().info("[node-failover] Primary node recovered, switching back:", PRIMARY_HOST);
  currentHost = PRIMARY_HOST;
  stopRetryLoop();
}

function startRetryLoop() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    if (await isHealthy(PRIMARY_HOST)) {
      switchToPrimary();
    }
  }, RETRY_INTERVAL_MS);
  // prevent Node consumers from keeping the event loop alive solely for the failover health-check timer
  retryTimer.unref?.();
}

function stopRetryLoop() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

/** Get the canonical primary node base URL (chainweb API root). Module-private — reads PRIMARY_HOST regardless of currentHost. Used by withFailover for per-invocation primary-host comparison. */
function getPrimaryBaseUrl(): string {
  return `${PRIMARY_HOST}/chainweb/0.0/${KADENA_NETWORK}`;
}

/** Get the current active node base URL (chainweb API root) */
export function getActiveBaseUrl(): string {
  return `${currentHost}/chainweb/0.0/${KADENA_NETWORK}`;
}

/** Get the current active host (without chainweb path) */
export function getActiveHost(): string {
  return currentHost;
}

/** Get Pact URL for a specific chain, using the active node */
export function getActivePactUrl(chainId: string): string {
  return `${getActiveBaseUrl()}/chain/${chainId}/pact`;
}

/** Get SPV URL for a specific chain, using the active node */
export function getActiveSpvUrl(chainId: string): string {
  return `${getActiveBaseUrl()}/chain/${chainId}/pact/spv`;
}

/**
 * Wrap a fetch/submit call with automatic failover.
 * If the call fails with a network error on primary, switches to fallback and retries once.
 */
export async function withFailover<T>(
  fn: (baseUrl: string) => Promise<T>
): Promise<T> {
  // Capture BOTH URLs at entry. Re-reading PRIMARY_HOST at catch-time
  // would be wrong if setNodeConfig/resetNodeFailover ran mid-flight.
  const attemptedBaseUrl = getActiveBaseUrl();
  const attemptedPrimaryBaseUrl = getPrimaryBaseUrl();
  try {
    return await fn(attemptedBaseUrl);
  } catch (err: any) {
    const isNetworkError =
      err?.message?.includes("Failed to fetch") ||
      err?.message?.includes("NetworkError") ||
      err?.message?.includes("ECONNREFUSED") ||
      err?.name === "AbortError";

    if (isNetworkError && attemptedBaseUrl === attemptedPrimaryBaseUrl) {
      // Call switchToFallback unconditionally — its line-50 idempotency
      // (if currentHost === FALLBACK_HOST return;) handles the concurrent
      // flip case correctly. No redundant gate needed.
      switchToFallback();
      // Retry on the now-active fallback. await ensures sync throws
      // produce a rejected promise rather than escape the async wrapper.
      return await fn(getActiveBaseUrl());
    }
    throw err;
  }
}

/**
 * Configure the primary and fallback nodes based on user selection.
 *
 * v3.2.3 (closes audit finding F-SEC-002): the `selected: "custom"` path
 * now validates `customUrl` before assigning it to `PRIMARY_HOST`. Pre-v3.2.3
 * the function accepted ANY truthy string and assigned it directly — a
 * consumer wiring this to a "custom node" settings dialog without input
 * validation could route every signed transaction (including the user's
 * Σ-prefix Smart-account caps) through an attacker-controlled host. The
 * three guards introduced here are the minimum trust-boundary discipline
 * that should have always been present:
 *
 *   1. **URL parse**: `new URL(customUrl)` rejects malformed strings
 *      (`"foo"`, `"javascript:..."`, anything not WHATWG-URL-shaped).
 *   2. **Scheme allow-list**: only `https:` is accepted. `http:` is rejected
 *      because chain transactions sign sensitive payloads (capability args,
 *      derived public keys); transmitting them over plaintext defeats the
 *      cryptographic discipline the rest of the codebase enforces.
 *   3. **Origin-only assignment**: `parsed.origin` discards any pathname,
 *      query, or fragment. The chainweb base URL is constructed by
 *      appending `/chainweb/0.0/{network}` later (see `getActiveBaseUrl`),
 *      so a `customUrl` like `"https://node.example.com/some-path"` would
 *      have produced `https://node.example.com/some-path/chainweb/...`
 *      pre-v3.2.3 — a confusing trap. Now the host portion is the only
 *      part that survives.
 *
 * Failure modes throw `TypeError` synchronously at the function entry, so
 * a misconfigured boot path fails immediately with a legible diagnostic
 * rather than producing inscrutable downstream fetch errors.
 *
 * @throws {TypeError} If `selected === "custom"` and `customUrl` is missing,
 *   not a parseable URL, or uses a scheme other than `https:`.
 */
export function setNodeConfig(
  selected: "node2" | "node1" | "custom",
  customUrl?: string,
  customNodeGasLimit?: number
): void {
  stopRetryLoop();

  if (selected === "node1") {
    PRIMARY_HOST = NODE1_HOST;
    FALLBACK_HOST = NODE2_HOST;
  } else if (selected === "custom") {
    if (!customUrl) {
      throw new TypeError(
        "setNodeConfig: customUrl is required when selected === 'custom'",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(customUrl);
    } catch {
      throw new TypeError(
        `setNodeConfig: customUrl is not a valid URL: ${customUrl}`,
      );
    }
    if (parsed.protocol !== "https:") {
      throw new TypeError(
        `setNodeConfig: customUrl must use https://; got ${parsed.protocol}`,
      );
    }
    // origin-only — discards pathname/query/fragment so getActiveBaseUrl's
    // suffix concatenation doesn't produce a malformed URL.
    PRIMARY_HOST = parsed.origin;
    FALLBACK_HOST = NODE2_HOST;
  } else {
    // node2 (default)
    PRIMARY_HOST = NODE2_HOST;
    FALLBACK_HOST = NODE1_HOST;
  }

  customGasLimit = customNodeGasLimit ?? DEFAULT_GAS_LIMIT;

  // Reset to new primary
  currentHost = PRIMARY_HOST;
}

/**
 * Reset all module-level failover state to its initial values.
 *
 * Stops any in-flight retry loop and restores `PRIMARY_HOST`, `FALLBACK_HOST`,
 * `customGasLimit`, `currentHost`, and `retryTimer` to the same values they
 * held immediately after module load.
 *
 * Scope: intended for test isolation only — production code should not call this.
 */
export function resetNodeFailover(): void {
  stopRetryLoop();
  PRIMARY_HOST = NODE2_HOST;
  FALLBACK_HOST = NODE1_HOST;
  customGasLimit = DEFAULT_GAS_LIMIT;
  currentHost = PRIMARY_HOST;
  retryTimer = null;
}

/** Get the block gas limit for the currently active node */
export function getActiveGasLimit(): number {
  return NODE_GAS_LIMITS[currentHost] ?? customGasLimit;
}

/** Get gas limit info for a specific node preset */
export function getNodeGasLimit(node: "node2" | "node1" | "custom"): number {
  if (node === "node2") return NODE_GAS_LIMITS[NODE2_HOST];
  if (node === "node1") return NODE_GAS_LIMITS[NODE1_HOST];
  return customGasLimit;
}

/** Default gas limit for custom/unknown nodes */
export const CHAINWEB_DEFAULT_GAS_LIMIT = DEFAULT_GAS_LIMIT;

/** Get the current node configuration */
export function getNodeConfig(): { primary: string; fallback: string } {
  return { primary: PRIMARY_HOST, fallback: FALLBACK_HOST };
}

/** Get current node status */
export function getCurrentNodeStatus(): {
  primary: string;
  fallback: string;
  active: string;
  isOnPrimary: boolean;
} {
  return {
    primary: PRIMARY_HOST,
    fallback: FALLBACK_HOST,
    active: currentHost,
    isOnPrimary: currentHost === PRIMARY_HOST,
  };
}

/** Initialize: check primary health on startup */
export async function initNodeFailover(): Promise<void> {
  if (!(await isHealthy(PRIMARY_HOST))) {
    switchToFallback();
  }
}
