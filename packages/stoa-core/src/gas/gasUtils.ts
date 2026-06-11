/**
 * Gas utility functions for ANU/STOA conversion, gas limit status,
 * and max fee calculation.
 *
 * ANU is the smallest unit of the STOA token (like wei to ETH).
 * 1 STOA = 10^12 ANU
 */

import { getActiveGasLimit } from "../network/nodeFailover.js";

// --- Constants ---

/** 1 STOA = 10^12 ANU */
export const ANU_PER_STOA = 1_000_000_000_000;

/** Maximum gas limit allowed for execution (above this, simulation only) */
export const GAS_LIMIT_MAX = 2_000_000;

/** Minimum gas price in ANU */
export const GAS_PRICE_MIN_ANU = 10_000;

/** Default TTL in seconds (8 hours) */
export const TTL_DEFAULT = 28_800;

/** Minimum TTL in seconds (1 minute) */
export const TTL_MIN = 60;

/** Maximum TTL in seconds (24 hours) */
export const TTL_MAX = 86_400;

// --- Conversion Functions ---

/** Convert ANU to STOA */
export function anuToStoa(anu: number): number {
  return anu / ANU_PER_STOA;
}

/** Convert STOA to ANU */
export function stoaToAnu(stoa: number): number {
  return stoa * ANU_PER_STOA;
}

/**
 * Format an ANU value as a STOA string with appropriate decimal places.
 * Strips trailing zeros but ensures at least one decimal digit.
 */
export function formatAnuAsStoa(anu: number): string {
  const stoa = anu / ANU_PER_STOA;
  const fixed = stoa.toFixed(12);

  // Strip trailing zeros but keep at least one decimal digit
  const stripped = fixed.replace(/0+$/, "");
  if (stripped.endsWith(".")) {
    return stripped + "0";
  }
  return stripped;
}

// --- Gas Limit Status ---

export type GasLimitStatus = "safe" | "warning" | "danger";

/**
 * Determine the gas limit status based on the value.
 * - safe: 0 to 1,600,000
 * - warning: 1,600,001 to 2,000,000
 * - danger: above 2,000,000
 */
export function getGasLimitStatus(limit: number): GasLimitStatus {
  if (limit > 2_000_000) return "danger";
  if (limit > 1_600_000) return "warning";
  return "safe";
}

/**
 * Public consumer-facing UI hex colors for gas-limit visualization.
 *
 * Marked `@public` per Phase 3 D-001/P-001 override (audit-closures-v4-1-1):
 * REQ-18 originally proposed removing this export, but the export is plausibly
 * consumed by OuronetUI (and possibly AncientHolder HUB) as a presentation-layer
 * constant. Removal is a breaking change unsuitable for v4.1.1 patch semver.
 * Removal deferred to v4.2.0 architectural spec pending consumer confirmation.
 *
 * @public
 */
export const GAS_LIMIT_COLORS: Record<
  GasLimitStatus,
  { bg: string; text: string; border: string }
> = {
  safe: { bg: "#052e16", text: "#4ade80", border: "#166534" },
  warning: { bg: "#431407", text: "#fb923c", border: "#9a3412" },
  danger: { bg: "#450a0a", text: "#f87171", border: "#991b1b" },
};

// --- Max Fee ---

/**
 * Calculate the max transaction fee given gas price (ANU) and gas limit.
 * Returns both ANU and STOA formatted representations.
 */
export function formatMaxFee(
  gasPrice: number,
  gasLimit: number
): { anu: string; stoa: string } {
  const totalAnu = gasPrice * gasLimit;
  return {
    // Locale pinned to en-US so consumer rendering and test assertions
    // are deterministic across host locales (a default toLocaleString()
    // would emit "10.000.000" on a German host but "10,000,000" on a
    // US host — the test suite was already pinning the en-US shape).
    anu: totalAnu.toLocaleString('en-US'),
    stoa: formatAnuAsStoa(totalAnu),
  };
}

// --- Auto Gas Limit ---

/**
 * Absolute floor for a calibrated gas limit. A dirty-read SIGNIFICANTLY
 * under-reports the real on-chain cost of a signed tx (capabilities, gas-payer
 * coin.TRANSFER, keyset reads, etc. are not all charged in a local read). A
 * trivial contract call can dirty-read at ~8 gas yet need 100+ on-chain — so a
 * pure multiplier on the tiny estimate (8 → 16, or even 8 → 80) still starves
 * the tx ("Gas limit exceeded"). The floor guarantees every auto-calibrated tx
 * gets a workable limit. Since gas LIMIT is a ceiling (the fee is charged on gas
 * USED, not the limit), a generous floor costs nothing.
 */
export const MIN_AUTO_GAS_LIMIT = 1_000;

/**
 * Calculate a calibrated gas limit from a simulated gas value.
 *
 * Graduated proportional buffer + flat buffer to cover the gap between a
 * dirty-read estimate and real on-chain consumption, then clamped to
 * [MIN_AUTO_GAS_LIMIT, node gas limit]. The low end uses LARGE multipliers
 * (tiny txs are the least predictable) but the multiplier alone is not enough
 * when the estimate is near-zero — the MIN_AUTO_GAS_LIMIT floor is the real
 * safety net there. `simulatedGas <= 0` returns 0 (the "no sim data" sentinel —
 * callers decide what to do without a measurement).
 *
 * Single source of truth — used by the console executor and all transaction
 * functions (OuronetUI + the AncientHoldings HUB).
 */
export function calculateAutoGasLimit(simulatedGas: number): number {
  if (!Number.isFinite(simulatedGas) || simulatedGas <= 0) return 0;
  let multiplier: number;
  let flat: number;
  if (simulatedGas < 100)          { multiplier = 10.0; flat = 0; }
  else if (simulatedGas < 200)     { multiplier = 5.0;  flat = 0; }
  else if (simulatedGas < 400)     { multiplier = 2.5;  flat = 0; }
  else if (simulatedGas < 500)     { multiplier = 2.0;  flat = 0; }
  else if (simulatedGas < 1_000)   { multiplier = 1.5;  flat = 0; }
  else if (simulatedGas < 20_000)  { multiplier = 1.15; flat = 0; }
  else if (simulatedGas < 100_000) { multiplier = 1.10; flat = 5_000; }
  else if (simulatedGas < 500_000) { multiplier = 1.10; flat = 10_000; }
  else                              { multiplier = 1.05; flat = 20_000; }
  const nodeLimit = getActiveGasLimit();
  const buffered = Math.max(
    Math.ceil(simulatedGas * multiplier) + flat,
    MIN_AUTO_GAS_LIMIT,
  );
  return Math.min(buffered, nodeLimit);
}
