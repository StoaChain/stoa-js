// @stoachain/ouronet-core/observability
//
// Central logger seam. One surface:
//
//   - getLogger / setLogger / Logger — pluggable logger, used by core call
//     sites (network failover warnings, error catch blocks, debug helpers)
//     so consumers can wire their own structured logger at boot time.
//     Default routes to console.warn / console.error for parity with the
//     pre-seam behavior. See ./logger.ts for the rationale.

export * from "./logger.js";
