/**
 * Yin Engine — the live-rising minimum gas price floor.
 *
 * Post-fork, chainweb-node rejects any signed transaction priced below this
 * floor as of its own `creationTime`. The floor starts at GENESIS_MIN_GAS_ANU
 * at genesis and rises by 1 ANU every GAS_PRICE_INTERVAL_S seconds, capped at
 * MAX_GAS_ANU.
 *
 * This is the SINGLE canonical implementation of the formula. It has already
 * been independently re-implemented across the ecosystem (OuronetUI,
 * @ouronet/ouronet-core, khronoton-core, the AncientHoldings hub) — @stoachain/
 * stoa-core is a direct or transitive dependency of essentially every
 * StoaChain consumer, so this is the one place everyone should get it from
 * going forward.
 */

/** Unix seconds of the Yin Engine genesis: 2026-02-23T18:00:00Z. */
export const GENESIS_TIME_S = 1771869600;

/** Minimum gas price (ANU) at genesis. Equal to the legacy static GAS_PRICE_MIN_ANU. */
export const GENESIS_MIN_GAS_ANU = 10_000;

/** Absolute cap on the rising floor (ANU). */
export const MAX_GAS_ANU = 400_000;

/** Tick interval: the floor rises by 1 ANU every 3 hours. */
export const GAS_PRICE_INTERVAL_S = 10_800;

/**
 * Compute the minimum gas price (ANU) that chainweb-node will accept for a
 * transaction with the given `creationTime` (unix seconds).
 *
 * Pre-genesis creationTimes clamp to GENESIS_MIN_GAS_ANU (no negative ticks).
 * The result is monotonically non-decreasing as `creationTimeS` increases,
 * and never exceeds MAX_GAS_ANU.
 */
export function minGasPriceAnu(creationTimeS: number): number {
  const elapsed = creationTimeS - GENESIS_TIME_S;
  const ticks = elapsed <= 0 ? 0 : Math.floor(elapsed / GAS_PRICE_INTERVAL_S);
  return Math.min(GENESIS_MIN_GAS_ANU + ticks, MAX_GAS_ANU);
}

/**
 * ANU -> STOA as a `number`, precision-safe. Do NOT do `anu / ANU_PER_STOA`
 * (see `anuToStoa`'s doc comment) for this specific conversion — build the
 * exact decimal string by padding, then convert once. Verified exhaustively
 * over the full 10,000-400,000 ANU range: every value round-trips exactly
 * at <=12 decimal places this way.
 *
 * `anuToStoa`'s plain float division remains fine for UI display strings,
 * but NOT for a value going into a transaction's meta that chainweb will
 * hash and validate exactly — use this function for that.
 */
export function anuToStoaNumber(anu: number): number {
  return Number("0." + String(anu).padStart(12, "0"));
}

/**
 * The anti-race primitive: ONE clock read produces BOTH the creationTime
 * and the gasPrice derived from that exact creationTime. Callers must
 * spread this straight into `.setMeta({...})` rather than computing
 * creationTime and gasPrice from two separate calls/times — a tick
 * boundary crossing between two separate reads silently underprices the tx.
 *
 * `nowS` param exists only for testability; production callers omit it.
 */
export function stoaGasMeta(nowS: number = Math.floor(Date.now() / 1000)): {
  creationTime: number;
  gasPrice: number;
} {
  return {
    creationTime: nowS,
    gasPrice: anuToStoaNumber(minGasPriceAnu(nowS)),
  };
}
