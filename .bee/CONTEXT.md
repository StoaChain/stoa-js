# Project Context

> Combined summary. See individual files for details: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md.
>
> **Snapshot note:** the sections below (especially the v1.4-v1.6 interactions deltas) are a manual snapshot captured during the M2 audit-closure refresh. If `/bee:refresh-context` is invoked after subsequent code changes, it may redo this content wholesale — treat the manual content as authoritative until that point.

## Stack
- TypeScript ^5.7.2 strict, ES module, Node `>=20`; `tsc -p tsconfig.build.json` -> `dist/` is the only thing shipped (`package.json:71`, `tsconfig.json`)
- Pure published library `@stoachain/ouronet-core` on npmjs.org with 14 subpath exports declared in `package.json#exports` -- no UI, no server, `src/index.ts` is intentionally `export {}`
- Runtime dep `@stoachain/dalos-crypto`; peer deps `@kadena/client`, `@kadena/cryptography-utils`, `@kadena/hd-wallet`, `@kadena/types`, `@noble/curves`, `@scure/bip39` (`package.json:84-94`)
- Vitest 4 (~435 `it`/`describe` calls across 12 top-level `tests/*.test.ts` files); CI on Node 22 runs typecheck -> test -> build (`.github/workflows/ci.yml`)
- Publish workflow on `v*` tags enforces tag-vs-`package.json` parity, then `npm publish --access public` (`.github/workflows/publish.yml`)

## Architecture
- **Subpath-export model** is mandatory: consumers import from `@stoachain/ouronet-core/<subpath>`; the `interactions/*` glob export bypasses the symbol-overlap problem in the 13 `*Functions.ts` files (`package.json:61-64`, `src/interactions/index.ts`)
- **Pluggable seams instead of DI**: `setPactReader(fn)` / `pactRead(...)` (`src/reads/pactReader.ts`) and `KeyResolver` + `PactClient` interfaces consumed by `CodexSigningStrategy` (`src/signing/types.ts`, `src/signing/codexStrategy.ts`)
- **Node failover is module-level mutable global state** -- `currentHost`, `PRIMARY_HOST`, `FALLBACK_HOST` in `src/network/nodeFailover.ts`; everything HTTP routes through `getActivePactUrl(chainId)` after the v1.6.1 cleanup
- **Three-branch Smart Account auth (Σ. prefix)** -- `analyzeSmartAccountAuthPaths` returns a 3-tuple over (account guard / sovereign / governor) but `CodexSigningStrategy` itself stays AND-of-keysets; consumer picks the branch (`src/guard/smartAccountAuth.ts`). v1.6 introduced the full primitive set: `classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths` (`src/guard/smartAccountAuth.ts`) and the first auth-path-aware CFM builder `buildRotateSovereignPactCode` (`src/pact/cfmBuilders.ts`).
- **Codex format frozen at `"1.2"`** -- `src/codex/codec.ts:8-13`; future formats add `CodexExportV2`, never bump the V1 string
- **`createDefaultRegistry()` registers DALOS Genesis only** -- v1.5 added `Leto`/`Artemis`/`Apollo` historical-curve re-exports, the `createGen1Primitive` factory, and the `AddressPrefixPair` type through the `./dalos` subpath; all four require explicit `registry.register(...)` opt-in (Ouronet itself stays Genesis-only)
- **`AccountSelectorData` shape (v1.4)** -- the type used by Smart Ouronet Account display gained `public-key`, `sovereign`, and `governor` fields so consumers can render the three-branch auth UI for Σ. prefix accounts (`src/interactions/ouroFunctions.ts`); standard Ѻ. accounts still use the original subset

## Conventions
- File naming: camelCase modules, PascalCase only for class-as-module (`KadenaWallet.ts`); every file under `src/interactions/` ends with `Functions.ts`
- `I` prefix reserved for Pact/Kadena-domain shapes (`IKeyset`, `IKadenaKeypair`); plain interfaces for everything else (`KeyResolver`, `PactClient`, `PlaintextCodex`, `AccountSelectorData`)
- Constants in SCREAMING_SNAKE_CASE; CFM Pact-code builders follow strict `build<Op>PactCode(p)` shape returning `string` (`src/pact/cfmBuilders.ts`, `tests/cfm-builders.test.ts`)
- All imports in `src/` are relative; the `@` alias in `vitest.config.ts:11` is for tests only; type-only imports use `import type`
- Domain vocabulary: OURO/Ouronet/StoaChain, Codex, CFM modal, Patron/Resident, Standard (Ѻ.) vs Smart (Σ.) accounts, Sovereign/Governor, Stoa Autonomic Accounts, ANU/STOA, Stoic predicates, seed types Koala/Chainweaver/Ecko/Foreign

## Concerns
- **Intentional type duplication of `IKadenaKeypair`** between `src/signing/types.ts` (canonical) and `src/interactions/ouroFunctions.ts` (Phase 2b backward-compat) -- do not consolidate (`CLAUDE.md:48-50`)
- **`: any` is widespread (~169 occurrences)** in interaction files for un-typed Pact responses; `console.*` (~103) and empty `} catch {}` (13+) blocks are present mostly as recovery paths but mask real errors in `src/interactions/dexFunctions.ts` and `addLiquidityFunctions.ts`
- **Default `rawCalibratedDirtyRead` is uncached**; OuronetUI plugs in cache-aware reader at boot via `setPactReader` -- consumers that skip this will see per-keystroke read flicker
- **Hardcoded primary/fallback hosts** at `node2.stoachain.com` / `node1.stoachain.com` (`src/network/nodeFailover.ts:13-14`); custom node configuration exists but bypasses the health-check signature/integrity verification
- **Phase-1 temporary copies** of `universalSign.ts` and `primitives.ts` flagged in JSDoc -- kept byte-identical with OuronetUI originals until Phase 3 consolidation
- **License `UNLICENSED`** despite `--access public` publish -- legal grant on the source is unclear (`package.json:113-115`)
