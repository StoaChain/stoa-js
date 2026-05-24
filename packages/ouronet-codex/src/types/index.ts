// @stoachain/ouronet-codex/types
//
// Public type re-exports for consumers.
//
// Includes:
//   - Codex entity types (IKadenaSeed, IOuroAccount, IPureKeypair,
//     AddressBookEntry, UiSettings) — these mirror what OuronetUI's
//     walletsSlice has today; will be normalized + canonicalized here
//     so OuronetUI consumes the canonical shape during migration.
//   - CodexAdapter interface (re-exported from /adapters for convenience)
//   - CodexStoreSnapshot — read-only view of the internal store
//   - CodexAuthState, CodexLockState — auth state machine types
//
// Note: ouronet-core's own types (PlaintextCodex, CodexExportV1_2) are
// NOT re-exported — consumers needing those import directly from
// @stoachain/ouronet-core/codex to preserve the single source of truth.
//
// Implementation lands incrementally across Phases 3-5.
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md
export {};
