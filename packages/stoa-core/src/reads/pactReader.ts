/**
 * Pluggable Pact reader — pactRead + setPactReader.
 *
 * Problem it solves: `@stoachain/ouronet-core/interactions/*` contains many
 * read functions (getPoolTotalFee, getSwpairs, getSWPairGeneralInfo, etc.)
 * that originally went through OuronetUI's cache-aware `calibratedDirtyRead`.
 * When those interactions moved to core in Phase 2b they switched to the
 * un-cached `rawCalibratedDirtyRead`, which silently removed dedup from
 * per-keystroke reads — visible as Smart Swap flickering.
 *
 * Contract: consumers call `setPactReader(fn)` once at boot to plug in their
 * preferred reader. Core's interaction code calls `pactRead(...)`, which
 * routes to whatever the consumer configured (or falls back to the raw
 * reader if nothing was configured).
 *
 *   OuronetUI (browser): `setPactReader(calibratedDirtyRead)` at boot →
 *                        dedup / tier-aware cache on every read
 *   HUB (server):         no call needed → default raw read (no cache, no
 *                         React lifecycle coupling)
 *
 * This is a narrow, deliberate injection seam — NOT a full DI framework.
 * Phase 3's SigningStrategy / KeyResolver refactor will generalise the pattern
 * for signing; this one-function variant is enough for reads.
 */

import { rawCalibratedDirtyRead } from "./rawCalibratedRead";

/**
 * Thrown by `setPactReader(...)` when the supplied value is not a function.
 *
 * Closes audit finding F-SEC-003 (v3.3.7). Pre-v3.3.7, `setPactReader(undefined)`
 * (or any non-function value) silently installed the bad reader; the error
 * surfaced later as a confusing `_reader is not a function` at the first
 * `pactRead(...)` call site, far from the misconfiguration. The typed error
 * with a clear message names the actual type passed so consumers can fix
 * the boot wiring at the source.
 *
 * Subclasses `TypeError` so existing `catch (e) { if (e instanceof TypeError) ... }`
 * code in consumers continues to catch it; the `name` property identifies
 * the specific invariant that was violated.
 */
export class InvalidPactReaderError extends TypeError {
  constructor(actual: unknown) {
    const observedType = actual === null ? "null" : typeof actual;
    super(
      `setPactReader requires a function, received ${observedType}. ` +
        `Pass a PactReader function such as rawCalibratedDirtyRead, or your ` +
        `cache-aware reader.`,
    );
    this.name = "InvalidPactReaderError";
  }
}

/**
 * Read function shape. Mirrors rawCalibratedDirtyRead's signature — options
 * extend that raw baseline so consumers can add their own fields (like
 * OuronetUI's `tier`, `skipTempWatcher`) without a core change.
 */
export type PactReader = (
  pactCode: string,
  options?: {
    pactUrl?: string;
    chainId?: string;
    /**
     * Cache-tier hint. Canonical mapping (matches OuronetUI's
     * `pact-query-cache` reader semantics):
     *
     *   T1 — balance reads. High churn, very short TTL.
     *   T2 — preview reads (e.g. `INFO_*` simulations). Short TTL.
     *   T3 — metadata reads (e.g. token metadata, pair info). Medium TTL.
     *   T7 — very-static reads (e.g. policy registry). Long TTL.
     *
     * The default reader (`rawCalibratedDirtyRead`) IGNORES `tier` — it has
     * no cache and treats every call as a fresh dirty-read. Only consumers
     * that wire a cache-aware reader via `setPactReader` (OuronetUI's
     * cache layer) act on the tier value. Server consumers (HUB) typically
     * leave the default reader installed and ignore this field entirely.
     */
    tier?: string;
    skipTempWatcher?: boolean;
    /** Per-call read timeout in ms. Forwarded to the underlying reader (rawCalibratedDirtyRead default: 15000 ms). */
    readTimeoutMs?: number;
    [key: string]: unknown;
  },
) => Promise<any>;

let _reader: PactReader = rawCalibratedDirtyRead;

/**
 * Configure the reader that all interaction-module reads route through.
 * Call once at boot; later calls replace the previous reader. Passing
 * nothing — or a call to this function — is how OuronetUI wires its
 * cache-aware reader back in after Phase 2b.
 *
 * v3.3.7 (F-SEC-003): throws `InvalidPactReaderError` when the supplied
 * value is not a function. Catches the entire class of misconfiguration
 * bugs where a consumer accidentally passes `undefined` (e.g. a stale
 * import) or a non-function (e.g. a Promise of a function) — surfaces
 * the failure at the boot site rather than at the first `pactRead(...)`
 * call site downstream.
 */
export function setPactReader(reader: PactReader): void {
  if (typeof reader !== "function") {
    throw new InvalidPactReaderError(reader);
  }
  _reader = reader;
}

/**
 * Get the currently-configured reader. Interaction code calls this instead
 * of binding `rawCalibratedDirtyRead` directly, so the consumer's choice
 * takes effect without per-function plumbing.
 */
export function getPactReader(): PactReader {
  return _reader;
}

/**
 * One-shot read through the configured reader. Syntactic-sugar equivalent to
 * `getPactReader()(pactCode, options)` — nicer at call sites.
 */
export function pactRead(
  pactCode: string,
  options?: Parameters<PactReader>[1],
): Promise<any> {
  return _reader(pactCode, options);
}
