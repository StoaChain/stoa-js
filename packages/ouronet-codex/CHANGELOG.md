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

### Upcoming phases (per spec)

- Phase 3 — Adapters: port `LocalStorageCodexAdapter` from OuronetUI, add `MemoryCodexAdapter`, define the `CodexAdapter` interface, write tests.
- Phase 4 — State store: build Zustand store + actions covering the §6 state model.
- Phase 5 — Hooks: extract logic from OuronetUI's `wallet-context.tsx` into modular hooks.
- Phase 6 — Components: extract headless modals + panels (password, backup/restore, rotate guard, etc.).
- Phase 7 — Provider: `<CodexProvider>` wiring everything together.
- Phase 8 — Publish v0.1.0 to npm with `alpha` dist-tag.

See the spec doc for the full phase breakdown and acceptance criteria.
