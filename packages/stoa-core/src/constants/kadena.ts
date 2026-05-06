/**
 * StoaChain chain-generic constants — canonical source of truth for the
 * `@stoachain/stoa-core` package.
 *
 * **What lives here**: chain-level identifiers (network name, chain IDs,
 * the chain count) and the failover-aware URL accessors. Anything that
 * could be reused by a non-Ouronet StoaChain consumer (CLI tools,
 * validator helpers, third-party integrations) belongs here.
 *
 * **What does NOT live here** (lives in `@stoachain/ouronet-core/constants`):
 *   - `KADENA_NAMESPACE = "ouronet-ns"` — the Ouronet Pact namespace string.
 *   - `STOA_AUTONOMIC_*` — Ouronet protocol accounts.
 *   - `MAIN_TOKENS`, `TOKEN_ID_*` — Ouronet's specific DPTF tokens.
 *
 * v4.0.0 removed the deprecated `GAS_STATION`/`NATIVE_TOKEN_VAULT`/
 * `KADENA_BASE_URL`/`PACT_URL` aliases that previously lived in
 * `@stoachain/ouronet-core/constants`. Consumers should now use the
 * canonical `STOA_AUTONOMIC_*` names + the failover-aware
 * `getPactUrl(chainId)` / `getSpvUrl(chainId)` accessors below.
 */

import { getActivePactUrl, getActiveSpvUrl } from "../network/nodeFailover";

export const KADENA_NETWORK = "stoa";

export const KADENA_CHAIN_ID = "0";

/** Get Pact API URL for any chain — uses failover (node2 primary, node1 fallback) */
export const getPactUrl = (chainId: string): string =>
  getActivePactUrl(chainId);

/** Get SPV API URL for any chain — uses failover */
export const getSpvUrl = (chainId: string): string =>
  getActiveSpvUrl(chainId);

/** Number of chains on the Stoa network */
export const STOA_CHAIN_COUNT = 10;

/** Available Stoa chains (0-9) */
export const STOA_CHAINS = Array.from({ length: STOA_CHAIN_COUNT }, (_, i) =>
  String(i),
);

/** All available chains (0-9) */
export const KADENA_CHAINS = STOA_CHAINS;
