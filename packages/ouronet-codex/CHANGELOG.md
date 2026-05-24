# Changelog

All notable changes to `@stoachain/ouronet-codex`.

## 0.1.0 — unreleased (in development)

**INITIAL RELEASE** — modular React Codex extracted from OuronetUI as a portable package any React consumer can drop in. Replaces the failed Caduceus-era custom integration attempt with a single canonical Codex any consumer (OuronetUI, AncientHoldings hub, future apps) shares.

Tracking under [`stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md`](../../.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md). Per-phase deliverables get logged here as they land.

### Phase 2 — Scaffold (2026-05-24)

- New monorepo sibling at `packages/ouronet-codex/` matching the structural conventions of `packages/ouronet-core/` (subpath-export model, `tsconfig.json` + `tsconfig.build.json` split, vitest with monorepo source-resolution aliases, near-empty `src/index.ts` root entry).
- `package.json` declares 8 subpath exports (`/provider`, `/hooks`, `/components`, `/adapters`, `/resolver`, `/errors`, `/types`, `/google-drive`).
- Peer-deps: `react@^18 || ^19`, `@stoachain/{kadena-stoic-legacy, stoa-core, ouronet-core}@>=4.2.2`. Single regular-dep: `zustand@^5` (internal state container; invisible to consumers).
- TypeScript config adds `jsx: "react-jsx"` (vs the existing 3 packages' no-JSX configs).
- Vitest environment switched to `jsdom` (vs `node` in the existing 3 packages) since components and hooks will need a DOM at test time.
- Empty barrel stubs for each subpath with doc-comments pointing to the relevant spec section, so the import graph is well-formed from day one even before implementation lands.

### Phase 3 — Adapters (2026-05-24)

- `CodexAdapter` interface in `src/adapters/types.ts` — pluggable storage contract (loadAll/saveAll + per-entity convenience writes + touch + UI-settings sidecar + clearAll). Async throughout to accommodate network/file backends.
- `MemoryCodexAdapter` — in-memory implementation for SSR / Next.js server / tests. Uses `structuredClone` for defensive copies so callers cannot mutate persisted snapshots.
- `LocalStorageCodexAdapter` — browser default ported from OuronetUI's `src/kadena/wallet/LocalStorageCodexAdapter.ts`, including the v1.0.9 fix that emits `pureKeypairs` in the export and the per-entry seed-type migration with try/catch fallback to "koala".
- Address-book legacy fallback path preserved (some early codices stored addressBook at the persist-root rather than under the codex key).
- 36 contract tests parameterized to run against both Memory + LocalStorage adapters, asserting identical observable semantics.

### Phase 4 — State store (2026-05-24)

- Zustand store factory at `src/state/store.ts` (~320 LOC) covering the full §6 state model: hydration (ready / initError), auth (locked / passwordCache), codex content (kadenaSeeds / pureKeypairs / ouroAccounts / addressBook / watchList / uiSettings), runtime (active wallet/account, dirty bit, schema version, last-updated metadata), and a namespaced `actions` object with the full CRUD per entity.
- CodexPrime auto-flag on the first added ouro account (spec §B1); `deleteOuroAccount` throws `CodexPrimeProtectedError` on `isPrime: true` (spec §B2).
- Auto-active first wallet/account on `init()` for sensible defaults; clears active when the active entity is deleted.
- `persistAndTouch` helper centralises adapter write + dirty-bit + lastUpdatedAt update so every mutator stays one-liner clean.
- Password cache uses `cache.expiresAt <= Date.now()` (inclusive) so TTL=0 means immediate expiry.
- `_internal_requireUnlocked` exported for Phase 5 hooks that need to gate on unlock state from outside the store.
- 27 action tests covering every CRUD operation, CodexPrime protection, auth flows, active-selection management, meta operations, and reset.

### Phase 5 — Hooks + resolver + provider stub (2026-05-25)

- `InternalCodexResolver` (in `src/resolver/`) — implements `KeyResolver` from `@stoachain/stoa-core/signing` against the internal Zustand store. Replaces OuronetUI's `ReduxCodexResolver`. Three methods: `listCodexPubs` (sync set built from kadenaSeeds + pureKeypairs), `getKeyPairByPublicKey` (auth-gated, decrypts pure keypairs via `smartDecrypt` or re-derives from seed via `KadenaWalletBuilder` + `kadenaDecrypt`, returns `IKadenaKeypair` ready for `universalSignTransaction`), `requestForeignKey` (default-throws `CodexKeyMissingError`; consumers wire a modal callback via constructor options). Emits the structured `CodexKeyMissingError` introduced in OuronetUI v1.0.9 with the same self-diagnostic wording — every consumer now gets the same message.
- `<CodexProvider>` stub (in `src/provider/`) — minimal per-mount store + React Context plumbing. Required `adapter` prop, optional `deviceVariant` prop, fire-and-forget init on mount. Phase 7 will add `passwordCacheMinutes`, `onCodexDirty`, `signingClient`, `initialUiSettings`, auto-rendered `<PasswordModal>`, and SSR-safe placeholder shell.
- `useCodexStore()` internal hook — exposed only to the package's own hooks subpath; consumers go through the typed hooks below.
- **Hooks (`src/hooks/`)** — 11 React hooks:
  - `useCodex()` — high-level read of all codex state (ready/locked/dirty + content + meta).
  - `useActiveWallet()` — active kadena seed + ouro account, IDs + resolved entities + setters.
  - `useGetKeypair()` — stable async `(pub) => Promise<IKadenaKeypair>`. Throws `CodexLockedError` / `CodexKeyMissingError` to match resolver contract.
  - `useSignTransaction()` — replaces OuronetUI's `useCFMStrategy`. Composes `InternalCodexResolver` + `createClient(getPactUrl(KADENA_CHAIN_ID))` into a memoised `CodexSigningStrategy`. Re-memoised on `selectedNode + customNodeUrl` change so node switching takes effect immediately on next `execute()` call (same invalidation rule OuronetUI uses today). Accepts optional `requestForeignKey` callback for foreign-key signing.
  - `useCodexAuth()` — `{ isLocked, authenticate, lock, getCurrentPassword, passwordCacheExpiresAt }`.
  - `useKadenaSeeds()` / `usePureKeypairs()` / `useOuroAccounts()` / `useAddressBook()` / `useWatchList()` — per-entity CRUD wrappers around the store actions. `useWatchList()` is a Phase 5 addition beyond spec §5.2 (store actions for watchlist already existed; skipping the hook would leave 1:1 parity broken).
  - `useCodexBackup()` — `downloadAsJson` (browser `<a>.click` save), `importFromFile(File)`, `exportForCloud()`, `importFromCloud(json)`, `isDirty`, `clearDirty`. On-disk format is the v1.2 codex file plus `pureKeypairs` (OuronetUI v1.0.9 extension). Imports tolerate the absence of `pureKeypairs` so pre-v1.0.9 backups still restore. The hook bypasses `ouronet-core/codex`'s frozen v1.2 codec to allow the augmented format; codec stays a strict v1.2 wire-format reader for purists.
- **Tests (63 new)** — `resolver-internal.test.ts` (14), `provider.test.tsx` (4), `hooks.test.tsx` (~25 across all hooks, with real-crypto roundtrips kept in the resolver suite to avoid duplication). Combined with the prior phases: **101 specs total in the ouronet-codex package, all passing.**

### Upcoming phases (per spec)

- Phase 6 — Components: extract headless modals + panels (password, backup/restore, rotate guard/payment/sovereign/governor, etc.).
- Phase 7 — Provider: flesh out `<CodexProvider>` with the full spec §5.1 surface (passwordCacheMinutes, onCodexDirty, signingClient override, auto-rendered PasswordModal, SSR-safe placeholder).
- Phase 8 — Publish v0.1.0 to npm with `alpha` dist-tag.
- Phases 9 + 10 — OuronetUI + AncientHoldings migration; API gaps surface as v0.x revisions before v1.0.0.

See the spec doc for the full phase breakdown and acceptance criteria.
