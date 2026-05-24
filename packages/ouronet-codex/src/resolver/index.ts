// @stoachain/ouronet-codex/resolver
//
// InternalCodexResolver — implements ouronet-core's KeyResolver interface
// (from @stoachain/ouronet-core/signing) by reading from the internal
// Zustand codex store. Replaces OuronetUI's ReduxCodexResolver.
//
// Consumers don't usually import this directly — <CodexProvider> wires it
// up internally. Exposed via this subpath for advanced cases (custom
// signing pipelines, multi-codex experiments, etc.).
//
// Implementation lands in Phase 5 of the modular-codex spec (depends on
// the state store from Phase 4).
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md §3
export {};
