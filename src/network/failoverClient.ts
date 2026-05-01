/**
 * failoverClient — chain-RPC client whose `dirtyRead` / `submit` / `listen` /
 * `pollOne` are each wrapped with `withFailover` + a per-tier timeout.
 *
 * This module is the chain-call analogue of `src/reads/rawCalibratedRead.ts`:
 * the same Promise.race + AbortController + outer-boundary TIMEOUT-conversion
 * pattern, generalized into a reusable `runWithTimeout` helper and four
 * factory-returned methods that share the `withFailover` retry contract.
 *
 * Design contracts (load-bearing — see spec REQ-01, REQ-02, REQ-09, REQ-10):
 *
 *   - `runWithTimeout` is a CONTROLLER-FACTORY: callers receive a fresh
 *     `AbortController` per invocation and decide what to forward to the
 *     underlying call. This keeps each failover attempt's signal scope local
 *     so a primary-side timeout abort cannot poison the fallback retry's
 *     signal. Callers MUST construct per-attempt scope themselves — do NOT
 *     hoist the controller outside `withFailover`'s callback.
 *
 *   - `runWithTimeout` rejects with `AbortError`, NOT `SigningError(TIMEOUT)`.
 *     TIMEOUT classification is deferred to the OUTER boundary (after
 *     `withFailover` resolves or rejects) so that a primary-only timeout
 *     followed by a successful fallback resolves normally — the consumer
 *     never sees a TIMEOUT error in that case.
 *
 *   - `runWithTimeout` does NOT retry on its own. Failover-on-timeout is the
 *     caller's responsibility, composed via `withFailover(async (baseUrl) =>
 *     runWithTimeout(...))`. This module's `getFailoverClient` is the
 *     reference composition.
 *
 *   - `submit`'s wrapper closure captures the SAME `transaction` reference
 *     passed in by the caller. No rebuild, no clone, no re-create. This is
 *     the request-key dedup contract — see JSDoc on `submit` below.
 */

import { createClient } from "@kadena/client";
import type {
  IUnsignedCommand,
  ICommand,
  ICommandResult,
  ITransactionDescriptor,
} from "@kadena/client";
import { withFailover } from "./nodeFailover";
import { createTimeoutError } from "../errors";

/** Default per-tier timeouts (module-private, not exported). */
const DEFAULT_READ_TIMEOUT_MS = 15_000;
const DEFAULT_SUBMIT_TIMEOUT_MS = 60_000;
const DEFAULT_LISTEN_TIMEOUT_MS = 180_000; // ~6 Kadena blocks
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

/**
 * Per-tier timeout overrides for the factory.
 *
 * Each field is optional; omitted fields fall back to the per-tier default
 * (15 s read / 60 s submit / 180 s listen / 30 s pollOne). Per-call overrides
 * passed to a method (e.g., `dirtyRead(tx, { readTimeoutMs })`) take
 * precedence over factory-level options.
 *
 * Precedence: `callOpts.{tier}TimeoutMs ?? options?.{tier}TimeoutMs ?? DEFAULT_{TIER}_TIMEOUT_MS`.
 */
export type FailoverClientOptions = {
  readTimeoutMs?: number;
  submitTimeoutMs?: number;
  listenTimeoutMs?: number;
  pollTimeoutMs?: number;
};

/**
 * Run an async operation with a deadline, using a CONTROLLER-FACTORY signature.
 *
 * Constructs a fresh `AbortController` per invocation and passes it to `fn`,
 * then races `fn(controller)` against a `setTimeout`-scheduled rejection.
 * On timeout: calls `controller.abort()` and rejects with an `Error` whose
 * `.name === "AbortError"` (NOT `SigningError(TIMEOUT)` — TIMEOUT
 * classification is deferred to the OUTER boundary so failover-on-timeout
 * can recover transparently when primary times out and fallback succeeds).
 *
 * Cleanup: the timeout handle is always cleared on every exit path via
 * `try { ... } finally { clearTimeout(timer); }`.
 *
 * Type inference: the timeout-reject promise is `Promise<never>` so
 * `Promise.race`'s union resolves to `T`, not `T | never`'s incidentals.
 *
 * Failover composition: this helper does NOT retry on its own. Compose with
 * `withFailover` for primary-then-fallback retry on `AbortError`:
 *
 * ```ts
 * const result = await withFailover(async (baseUrl) => {
 *   const { dirtyRead } = createClient(`${baseUrl}/chain/0/pact`);
 *   return runWithTimeout(
 *     "dirtyRead",
 *     (controller) => dirtyRead(tx, { signal: controller.signal }),
 *     15_000,
 *   );
 * });
 * ```
 *
 * @param operation - Short name for diagnostic messages (e.g. "submit").
 * @param fn - Worker that receives the per-attempt `AbortController` and
 *   forwards `controller.signal` to whichever underlying call accepts it.
 * @param timeoutMs - Deadline in milliseconds. Must be a finite positive
 *   number; otherwise this function throws synchronously.
 *
 * @throws synchronous `Error` if `timeoutMs` is not a finite positive number.
 * @throws `Error` with `.name === "AbortError"` on timeout.
 */
export async function runWithTimeout<T>(
  operation: string,
  fn: (controller: AbortController) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (!(Number.isFinite(timeoutMs) && timeoutMs > 0)) {
    throw new Error(
      `runWithTimeout(${operation}): timeoutMs must be a finite positive number, received ${String(timeoutMs)}`,
    );
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      fn(controller),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const abortErr = new Error(`Timeout after ${timeoutMs}ms during ${operation}`);
          abortErr.name = "AbortError";
          reject(abortErr);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert an `AbortError` that escapes `withFailover` (BOTH primary AND
 * fallback timed out) into a `SigningError(code: "TIMEOUT")`. Other errors
 * propagate unchanged. Internal helper to avoid repeating the try/catch in
 * each method of the factory return.
 */
async function outerBoundaryConvert<T>(
  operation: string,
  timeoutMs: number,
  worker: () => Promise<T>,
): Promise<T> {
  try {
    return await worker();
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw createTimeoutError(operation, timeoutMs, err);
    }
    throw err;
  }
}

/**
 * Build a chain-scoped client whose `dirtyRead` / `submit` / `listen` /
 * `pollOne` are each wrapped with `withFailover` + a per-tier timeout.
 *
 * Each method:
 *   1. Resolves its effective timeout via the precedence rule
 *      `callOpts.{tier}TimeoutMs ?? options?.{tier}TimeoutMs ?? DEFAULT_{TIER}_TIMEOUT_MS`.
 *   2. Calls `withFailover(async (baseUrl) => …)` so the primary node is
 *      tried first and the fallback is tried on network/abort errors.
 *   3. Inside the failover callback, calls `runWithTimeout` with a fresh
 *      `AbortController` so each attempt has its own signal scope.
 *   4. Wraps the whole thing in `outerBoundaryConvert` so an `AbortError`
 *      that escapes `withFailover` (BOTH attempts timed out) is reclassified
 *      as `SigningError(code: "TIMEOUT")`.
 *
 * Request-key dedup contract (LOCKED — REQ-01):
 *   The `submit` method's wrapper closure MUST capture the SAME `transaction`
 *   reference passed in by the caller. Never rebuild, never clone, never
 *   re-create. This guarantees primary and fallback see byte-identical
 *   payloads, so chainweb's mempool dedups them on the same request-key.
 *   Any future refactor that interposes object cloning between caller and
 *   wrapper would silently defeat dedup and is forbidden.
 *
 * @param chainId - Kadena chain ID (e.g. "0", "1", …).
 * @param options - Optional per-tier timeout overrides.
 */
export function getFailoverClient(
  chainId: string,
  options?: FailoverClientOptions,
): {
  /**
   * Pact dirty-read against the active failover host.
   *
   * Forwards `{ signal: controller.signal }` to the underlying
   * `client.dirtyRead`'s `ClientRequestInit` second parameter so an in-flight
   * request is actually cancelled on timeout (not just abandoned by the
   * caller).
   */
  dirtyRead: (
    transaction: IUnsignedCommand,
    callOpts?: { readTimeoutMs?: number },
  ) => Promise<ICommandResult>;
  /**
   * Submit a single signed transaction to the active failover host's
   * `/send` endpoint.
   *
   * Single-transaction overload narrowing (LOCKED — F-003):
   *   This factory's `submit` exposes only the SINGLE-transaction overload
   *   of `@kadena/client.ISubmit` — accepts `ICommand` and returns
   *   `Promise<ITransactionDescriptor>`. The batch overload
   *   (`ICommand[]` → `Promise<ITransactionDescriptor[]>`) is intentionally
   *   NOT exposed because failover-on-array-submit has unclear request-key
   *   dedup semantics (partial primary success + fallback retry would
   *   duplicate a subset of the batch). Consumers needing the batch form
   *   should call `createClient(getActivePactUrl(chainId)).submit([...])`
   *   directly and accept that failover does NOT apply.
   *
   * Request-key dedup contract (LOCKED — REQ-01):
   *   The wrapper closure captures the SAME `transaction` reference passed
   *   in. Never rebuild, never clone, never re-create. Primary and fallback
   *   send byte-identical payloads → chainweb dedups on the same
   *   request-key. A duplicate-key submission is a no-op on the chainweb
   *   mempool — exactly the intended behavior on transparent failover.
   *
   * Caller-side immutability warning (LOCKED — F-005):
   *   Caller MUST NOT mutate the `transaction` `ICommand` reference between
   *   calling `submit(transaction)` and the returned promise settling.
   *   Mutations during in-flight submit (e.g., reassigning `transaction.sigs`,
   *   mutating `transaction.cmd`, splicing `transaction.hash`) may break
   *   request-key dedup on the fallback retry — the primary attempt sends
   *   one payload, the fallback sees the mutated payload, and the chainweb
   *   mempool treats them as distinct request-keys, defeating the dedup
   *   contract this method is built around.
   */
  submit: (
    transaction: ICommand,
    callOpts?: { submitTimeoutMs?: number },
  ) => Promise<ITransactionDescriptor>;
  /**
   * Long-poll `/listen` for a previously-submitted transaction's result.
   *
   * Forwards `{ signal: controller.signal }` to the underlying
   * `client.listen`'s `ClientRequestInit` second parameter (verified at
   * `@kadena/client` v1.18.3 — `client.d.ts:327`).
   */
  listen: (
    descriptor: ITransactionDescriptor,
    callOpts?: { listenTimeoutMs?: number },
  ) => Promise<ICommandResult>;
  /**
   * Single-shot `/poll` for a previously-submitted transaction's result.
   *
   * Asymmetry note: `client.pollOne`'s second parameter is `IPollOptions`
   * (poll cadence + confirmation depth), NOT `ClientRequestInit`, so this
   * wrapper does NOT forward `{ signal }` to the underlying call. The
   * timeout still fires via `Promise.race` and the `AbortController` is
   * abort()'d for compositional consistency, but the in-flight `pollOne`
   * fetch is not cancelled — `@kadena/client` v1.18.3 does not expose that
   * surface. Consumers needing a hard cancel should prefer `listen` with a
   * tighter `listenTimeoutMs` instead.
   */
  pollOne: (
    descriptor: ITransactionDescriptor,
    callOpts?: { pollTimeoutMs?: number },
  ) => Promise<ICommandResult>;
} {
  return {
    dirtyRead: (transaction, callOpts) => {
      const timeoutMs =
        callOpts?.readTimeoutMs ?? options?.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
      return outerBoundaryConvert("dirtyRead", timeoutMs, () =>
        withFailover(async (baseUrl) => {
          const url = `${baseUrl}/chain/${chainId}/pact`;
          const { dirtyRead } = createClient(url);
          return runWithTimeout(
            "dirtyRead",
            (controller) => dirtyRead(transaction, { signal: controller.signal }),
            timeoutMs,
          );
        }),
      );
    },

    submit: (transaction, callOpts) => {
      const timeoutMs =
        callOpts?.submitTimeoutMs ?? options?.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
      return outerBoundaryConvert("submit", timeoutMs, () =>
        withFailover(async (baseUrl) => {
          const url = `${baseUrl}/chain/${chainId}/pact`;
          const { submit } = createClient(url);
          return runWithTimeout(
            "submit",
            (controller) => submit(transaction, { signal: controller.signal }),
            timeoutMs,
          );
        }),
      );
    },

    listen: (descriptor, callOpts) => {
      const timeoutMs =
        callOpts?.listenTimeoutMs ?? options?.listenTimeoutMs ?? DEFAULT_LISTEN_TIMEOUT_MS;
      return outerBoundaryConvert("listen", timeoutMs, () =>
        withFailover(async (baseUrl) => {
          const url = `${baseUrl}/chain/${chainId}/pact`;
          const { listen } = createClient(url);
          return runWithTimeout(
            "listen",
            (controller) => listen(descriptor, { signal: controller.signal }),
            timeoutMs,
          );
        }),
      );
    },

    pollOne: (descriptor, callOpts) => {
      const timeoutMs =
        callOpts?.pollTimeoutMs ?? options?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
      return outerBoundaryConvert("pollOne", timeoutMs, () =>
        withFailover(async (baseUrl) => {
          const url = `${baseUrl}/chain/${chainId}/pact`;
          const { pollOne } = createClient(url);
          // pollOne's second arg is IPollOptions, not ClientRequestInit, so
          // we cannot forward { signal }. Timeout still fires via Promise.race.
          return runWithTimeout("pollOne", () => pollOne(descriptor), timeoutMs);
        }),
      );
    },
  };
}
