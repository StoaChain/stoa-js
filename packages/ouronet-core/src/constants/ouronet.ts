/**
 * Ouronet-specific protocol constants — the `ouronet-ns` Pact namespace,
 * the protocol-level autonomic accounts, the canonical token list.
 *
 * Lives in `@stoachain/ouronet-core/constants`. Pulled in by every
 * `interactions/*` file that constructs `${KADENA_NAMESPACE}.<module>.*`
 * Pact code, plus by the cfmBuilders Pact-code string assembler.
 *
 * Chain-generic constants (`KADENA_NETWORK`, `KADENA_CHAIN_ID`,
 * `getPactUrl`, `getSpvUrl`, `STOA_CHAIN_COUNT`, `STOA_CHAINS`,
 * `KADENA_CHAINS`) live in `@stoachain/stoa-core/constants` — they're
 * re-exported here for backwards-compatibility with internal imports
 * from `../constants` and pre-v4 consumer imports from
 * `@stoachain/ouronet-core/constants`. Public-API consumers SHOULD
 * import them from `@stoachain/stoa-core/constants` directly to make
 * the chain-generic vs Ouronet-specific boundary explicit.
 */

// Chain-generic re-exports (canonical home: @stoachain/stoa-core/constants)
export {
  KADENA_NETWORK,
  KADENA_CHAIN_ID,
  STOA_CHAIN_COUNT,
  STOA_CHAINS,
  KADENA_CHAINS,
  getPactUrl,
  getSpvUrl,
} from "@stoachain/stoa-core/constants";

/**
 * The Pact module namespace prefix for every Ouronet smart contract.
 * Every interaction file builds Pact code as `${KADENA_NAMESPACE}.<module>.*`.
 */
export const KADENA_NAMESPACE = "ouronet-ns";

/**
 * Base URL for Chainweb API (static — primary node).
 *
 * @deprecated Pinned to `node2.stoachain.com` and bypasses the failover
 * layer added in v2.1.0. Direct consumers reading this constant lose
 * the node-recovery + node-degradation handling provided by
 * `getActivePactUrl(chainId)` / `getActiveSpvUrl(chainId)` exported from
 * `@stoachain/stoa-core/network`. v3.3.8 marked this `@deprecated`;
 * scheduled for **removal in v4.0.0** (Phase 3 of the v4.0.0 split work).
 */
export const KADENA_BASE_URL = `https://node2.stoachain.com/chainweb/0.0/stoa`;

/**
 * Pact API endpoint for chain 0. For failover-aware URLs, use
 * `getActivePactUrl(chainId)` from `@stoachain/stoa-core/network` (or its
 * thin wrapper `getPactUrl(chainId)` from
 * `@stoachain/stoa-core/constants`).
 *
 * @deprecated Same reasoning as `KADENA_BASE_URL`. Scheduled for removal
 * in v4.0.0.
 */
export const PACT_URL = `${KADENA_BASE_URL}/chain/0/pact`;

// ─── Stoa Autonomic Accounts ───────────────────────────────────────────────
// Canonical names for all protocol-level Stoa accounts.
// Always reference these — never hardcode the address strings directly.

/** Ouroboros protocol account (staking/rewards engine) */
export const STOA_AUTONOMIC_OUROBOROS = "c:XM-pkmuB5XUQlp87ZYSbfKt8qzmHY6O2EHAzMRVBt3k";

/** LiquidPot account (native STOA vault — source of unwrapped tokens) */
export const STOA_AUTONOMIC_LIQUIDPOT = "c:ZNfuj3iZI83n7MUSKGuoXoSxFg1cyMxCzB3szUHVvrI";

/** Ouronet Gas Station (pays Kadena gas fees for all transactions) */
export const STOA_AUTONOMIC_OURONETGASSTATION = "c:iQQFWj6gWtpGEzhM_O5ekW1QtnQQy55R8BRPGhj_0FU";

// Legacy aliases — point to canonical constants above.
// Scheduled for removal in v4.0.0 Phase 3 (after the 21 internal consumer
// sites have been migrated to STOA_AUTONOMIC_*).
/** @deprecated Use STOA_AUTONOMIC_OURONETGASSTATION */
export const GAS_STATION = STOA_AUTONOMIC_OURONETGASSTATION;
/** @deprecated Use STOA_AUTONOMIC_LIQUIDPOT */
export const NATIVE_TOKEN_VAULT = STOA_AUTONOMIC_LIQUIDPOT;

export const MAIN_TOKENS = [
  { id: "AURYN-8Nh-JO8JO4F5", name: "AURYN" },
  {
    id: "ELITEAURYN-8Nh-JO8JO4F5",
    name: "ELITEAURYN",
  },
  {
    id: "SSTOA-8Nh-JO8JO4F5",
    name: "SSTOA",
  },
  {
    id: "OURO-8Nh-JO8JO4F5",
    name: "OURO",
  },
  {
    id: "VST-8Nh-JO8JO4F5",
    name: "VST",
  },
];
