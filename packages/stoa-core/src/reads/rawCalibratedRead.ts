/**
 * rawCalibratedDirtyRead — uncached Pact dirty-read with a read-friendly gas limit.
 *
 * For on-chain READS (as opposed to submits), simulation gas is effectively
 * free — the 10 M ceiling just needs to be comfortably above anything a real
 * read might consume so we never get a gas-exhausted result for a non-malicious
 * query. Consumers that want caching / dedup / tier-tracking wrap this in their
 * own layer (OuronetUI does via `pact-query-cache`).
 *
 * This function is intentionally pure: no cache, no subscribers, no circular
 * dependencies. It's what the HUB will use directly (no React lifecycle to
 * bind a cache to) and what OuronetUI's cache wrapper delegates to on miss.
 */

import { Pact, createClient } from "@stoachain/kadena-stoic-legacy/client";
import type { ChainId } from "@stoachain/kadena-stoic-legacy/types";
import { KADENA_CHAIN_ID, KADENA_NETWORK } from "../constants/index.js";
import { getActivePactUrl, withFailover, runWithTimeout } from "../network/index.js";
import { createTimeoutError } from "../errors/index.js";

/** Read-friendly simulation gas ceiling — reads don't actually spend it. */
const READ_SIM_GAS_LIMIT = 10_000_000;

/**
 * Perform a Pact dirty-read. Bypasses any cache. Returns the raw
 * `@kadena/client` response (including `result.status`, `result.data`, etc.);
 * callers are expected to unwrap based on their read's shape.
 *
 * Options:
 *   pactUrl   — target endpoint. Defaults to the active failover host's
 *               Pact URL for the requested chain (`getActivePactUrl(chainId)`).
 *               Server consumers pass their own (direct node URL, no CORS proxy).
 *   chainId   — chain id. Defaults to KADENA_CHAIN_ID ("0").
 */
export async function rawCalibratedDirtyRead(
  pactCode: string,
  options?: {
    pactUrl?: string;
    chainId?: ChainId | string;
    /**
     * Accepted and ignored. Source-compatibility shim for consumers that
     * used to call OuronetUI's cache-aware `calibratedDirtyRead` (which
     * carried tier tracking). The raw read has no cache, so the tier is
     * meaningless here — the option exists so the migration doesn't touch
     * 20+ call sites needlessly.
     *
     * Canonical tier mapping (interpreted by cache-aware consumers wired via
     * `setPactReader`; ignored by this raw reader):
     *   T1 — balance reads (high churn, very short TTL).
     *   T2 — preview reads (short TTL).
     *   T3 — metadata reads (medium TTL).
     *   T7 — very-static reads (long TTL).
     */
    tier?: string;
    skipTempWatcher?: boolean;
    /** Per-call read timeout in ms. Defaults to 15000 (15 s). */
    readTimeoutMs?: number;
  },
) {
  const chainId = (options?.chainId ?? KADENA_CHAIN_ID) as ChainId;
  const pactUrl = options?.pactUrl ?? getActivePactUrl(chainId);
  const readTimeoutMs = options?.readTimeoutMs ?? 15_000;

  const transaction = Pact.builder
    .execution(pactCode)
    .setNetworkId(KADENA_NETWORK)
    .setMeta({ chainId, gasLimit: READ_SIM_GAS_LIMIT })
    .createTransaction();

  if (options?.pactUrl) {
    // Explicit-pactUrl path: consumer pinned a specific endpoint, so we skip
    // failover (their URL wins) but still apply the timeout + outer-boundary
    // TIMEOUT classification so a hung node doesn't deadlock the caller.
    try {
      const { dirtyRead } = createClient(pactUrl);
      return await runWithTimeout(
        "rawCalibratedDirtyRead",
        (controller) => dirtyRead(transaction, { signal: controller.signal }),
        readTimeoutMs,
      );
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw createTimeoutError("rawCalibratedDirtyRead", readTimeoutMs, err);
      }
      throw err;
    }
  } else {
    // Failover path: each attempt (primary, then fallback if needed) runs
    // inside its own runWithTimeout call (fresh AbortController per attempt
    // via the controller-factory shape), so a primary-side timeout abort
    // doesn't poison the fallback retry's signal. The outer try/catch
    // converts an AbortError that escapes withFailover (BOTH primary AND
    // fallback timed out) into a SigningError(code: "TIMEOUT").
    try {
      return await withFailover(async (baseUrl) => {
        const url = `${baseUrl}/chain/${chainId}/pact`;
        const { dirtyRead } = createClient(url);
        return runWithTimeout(
          "rawCalibratedDirtyRead",
          (controller) => dirtyRead(transaction, { signal: controller.signal }),
          readTimeoutMs,
        );
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw createTimeoutError("rawCalibratedDirtyRead", readTimeoutMs, err);
      }
      throw err;
    }
  }
}
