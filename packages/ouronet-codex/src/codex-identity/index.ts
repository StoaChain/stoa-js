// @stoachain/ouronet-codex/codex-identity — pure identity-derivation helpers.
//
// Groups stateless Codex-identity logic that is NOT part of the Zustand store
// (which lives in src/state/). Phase 4 ships `deriveDoubleApollo`; Phase 7's
// kickstart logic will be added here alongside it.

export {
  deriveDoubleApollo,
} from "./derivation.js";
export type {
  ApolloHalfDerivation,
  DoubleApolloDerivation,
  DeriveSeedMode,
} from "./derivation.js";
