// @stoachain/ouronet-codex/state — INTERNAL, not in the public exports map.
//
// Zustand store managing the codex runtime state (hydrated codex content,
// active wallet, password cache, dirty bit). Consumers never import from
// here directly — they go through hooks (which subscribe to the right
// slice of this store).
//
// Internal-only so a future refactor (e.g. swap Zustand for something
// else, partition the store) doesn't break consumers.
//
// Implementation lands in Phase 4 of the modular-codex spec.
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md §6
export {};
