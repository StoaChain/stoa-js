// @stoachain/ouronet-codex/state — INTERNAL only, not in public exports.
//
// The Zustand store backing CodexProvider. Consumers MUST go through
// hooks (which subscribe to slices of this store via React-style
// reactive subscriptions), not import from here directly.
//
// Re-exporting here for internal consumption by sibling subpaths
// (hooks/, resolver/, provider/) only. The package.json `exports` map
// has no entry for "./state" — TypeScript paths-resolution from the
// monorepo doesn't expose this externally either.

export type {
  CodexStoreState,
  CodexStoreActions,
  PasswordCacheEntry,
  PendingPasswordRequest,
} from "./store";

export {
  createCodexStore,
  _internal_requireUnlocked,
  CodexPasswordError,
} from "./store";
