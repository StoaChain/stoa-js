# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

`@stoachain/ouronet-core` is a published TypeScript library on the public npm registry (scope `@stoachain`). It is the **shared core** for the OuroNet ecosystem — Pact builders, Codex signing, guard analysis, encryption, gas calibration, DALOS key-gen — consumed by two downstream apps:

- **OuronetUI** — browser SPA
- **AncientHolder HUB** — Node.js server

This repo holds *only* the shared logic. Treat it as a library, not an app: there is no UI, no server, no runtime entry point. Every change ripples to consumers via npm publish (see "Publishing").

## Common commands

```bash
npm install
npm run build      # tsc -p tsconfig.build.json → dist/   (only thing publish ships)
npm run typecheck  # tsc --noEmit                         (uses tsconfig.json)
npm test           # vitest run --passWithNoTests         (~310 tests)
npm run test:watch # vitest in watch mode
npm run clean      # rimraf dist
```

Run a single test file: `npx vitest run tests/cfm-builders.test.ts`
Run a single test by name: `npx vitest run -t "name fragment"`

CI (`.github/workflows/ci.yml`) runs typecheck → test → build on every PR/push. Publish (`.github/workflows/publish.yml`) runs the same plus `npm publish` on any `v*` tag.

## Module layout — subpath exports

Every directory under `src/` corresponds to a subpath export declared in `package.json` (`./guard`, `./signing`, etc.). Consumers are explicitly steered toward subpath imports for tree-shaking — `src/index.ts` is intentionally near-empty (`export {}`):

```ts
import { analyzeGuard } from "@stoachain/ouronet-core/guard";        // good
import { analyzeGuard } from "@stoachain/ouronet-core";              // not supported
```

`./interactions` is special: the directory contains 13 files with overlapping symbol names, so the barrel re-exports only `ouroFunctions` (the canonical type source). Consumers reach the others via `./interactions/*` glob exports — e.g. `@stoachain/ouronet-core/interactions/wrapFunctions`.

## Architectural patterns to preserve

**Pluggable seams, not DI.** Two narrow injection points let core stay environment-agnostic without a framework:

1. `setPactReader(fn)` in `src/reads/pactReader.ts` — consumers call once at boot. Browser plugs in its cache-aware reader; server leaves the default uncached `rawCalibratedDirtyRead`. Interaction code calls `pactRead(...)`, never the raw reader directly.
2. `KeyResolver` + `PactClient` interfaces in `src/signing/types.ts` — consumed by `CodexSigningStrategy`. OuronetUI implements `ReduxCodexResolver`, HUB will implement `FileCodexResolver`. Never import a concrete resolver into core.

**Node failover is global state.** `src/network/nodeFailover.ts` switches the active Stoa node on health-check failure. Anything making an HTTP call must route through this — historically `interactions/*` had `createClient(PACT_URL)` calls pinned to node2; the v1.6.1 fix (most recent commit) removed those and they should not come back.

**Backwards-compat type duplication is intentional in places.** `IKadenaKeypair` is canonically defined in `src/signing/types.ts` but a structurally identical type still exists in `interactions/ouroFunctions` for Phase 2b imports. Don't "consolidate" without checking the comment trail.

**The codex backup format is frozen at `"1.2"`.** `src/codex/codec.ts` — do not bump the version string. Read its JSDoc before touching the codec.

**`createDefaultRegistry()` registers DALOS Genesis only.** `Leto`/`Artemis`/`Apollo` and `createGen1Primitive` are re-exported from the `./dalos` subpath but deliberately NOT in the default registry. Ouronet itself is Genesis-only by design; consumers who want historical curves opt in via `registry.register(...)`.

**Smart Ouronet Account auth (Σ. prefix) uses three branches.** `src/guard/smartAccountAuth.ts` resolves the `enforce-one` over (account guard / sovereign guard / governor). The signing strategy itself still takes a single AND-of-keysets array — UI/consumer is responsible for picking the chosen branch before calling `execute`. Standard accounts (Ѻ. prefix) still use a single keyset.

## Test layout

Tests live in `tests/` (top-level), not co-located. Vitest config (`vitest.config.ts`) picks up both `tests/**/*.test.ts` and `src/**/*.test.ts`. The `tsconfig.build.json` excludes test files from the published `dist/`. Test files cover the major surfaces: cfm-builders, smart-account-auth, codex-codec, crypto (encryption + upgrade), gas, guard, network, pact-format, signing, strategy, dalos-integration.

## Publishing flow

1. Bump `package.json` version + add `CHANGELOG.md` entry.
2. Commit, then `git tag vX.Y.Z -m "..."` and `git push origin vX.Y.Z`.
3. `publish.yml` runs typecheck + build + test + version-parity check (tag vs `package.json`) + `npm publish --access public`. Within ~2 minutes consumers can `npm install`.

The version-parity check is load-bearing — never push a tag whose number disagrees with `package.json`.

## Versioning discipline

Strict semver. Breaking changes → major bump → consumers upgrade deliberately. Never silently change the shape of a public type or barrel export — this library exists to keep OuronetUI and HUB from forking logic, and a stable surface is the whole point. The `CHANGELOG.md` is the source of truth for what changed across versions.

# BeeDev
Stack: typescript-library
Use /bee:new-spec to start a new feature.
Use /bee:progress to see current state.
Always use Context7 MCP for framework documentation lookups.
