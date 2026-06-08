# @stoachain/stoa-core

Chain-generic StoaChain TypeScript foundation — signing, wallet, crypto envelope, network failover, gas calibration, guard analysis, DALOS key-gen, observability seam, error taxonomy, on-chain read primitives, Pact-code format helpers. The shared infrastructure consumed by **`@stoachain/ouronet-core`** (Ouronet protocol business logic) and any other StoaChain consumer (CLI tools, validators, third-party integrations).

This package was born from the v4.0.0 split of `@stoachain/ouronet-core` v3.3.8 — the chain-generic surfaces moved out into this package, leaving Ouronet-specific code (codex, interactions, the `ouronet-ns` namespace) in [`@stoachain/ouronet-core`](https://www.npmjs.com/package/@stoachain/ouronet-core). The two packages live in the [`StoaChain/stoa-js`](https://github.com/StoaChain/stoa-js) monorepo and release atomically at the same version.

## Status

**`4.3.4` on public npmjs** — **PATCH (atomic-triplet alignment with `@stoachain/kadena-stoic-legacy@4.3.4` + `@stoachain/ouronet-core@4.3.4`).** Released 2026-06-08. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant. The v4.3.4 release surface (the UrStoa Collect-button hover fix) lives entirely in `@stoachain/ouronet-core`. Functionally identical to `4.3.3`. **653 specs pass.**

**`4.3.3` on public npmjs** — **PATCH (atomic-triplet alignment with `@stoachain/kadena-stoic-legacy@4.3.3` + `@stoachain/ouronet-core@4.3.3`).** Released 2026-05-30. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`); peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.3.1 → 4.3.3 in lockstep. The v4.3.3 surface lives entirely in `@stoachain/ouronet-core` (additive StoicTag + governor-rotation builders/readers). Functionally identical to `4.3.1`. **653 specs pass.**

**`4.3.1` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/kadena-stoic-legacy@4.3.1` + `@stoachain/ouronet-core@4.3.1`).** Released 2026-05-27. **ESM extensionless-relative-import fix** in emitted `dist/**/*.js` — same bug pattern as `@stoachain/ouronet-codex@0.2.1`, discovered while smoke-testing the workspace. 29 source files updated, 57 imports rewritten. Strict ESM dynamic-imports (`await import('@stoachain/stoa-core/crypto')` and other subpaths) now succeed under Node 22+. No API changes. **653/653 specs pass.** Peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.3.0 → 4.3.1 in lockstep. See CHANGELOG for full diagnosis.

**`4.3.0` on public npmjs** — **MINOR (atomic-triplet with `@stoachain/kadena-stoic-legacy@4.3.0` + `@stoachain/ouronet-core@4.3.0`).** Released 2026-05-25. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`); peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.2.2 → 4.3.0 in lockstep. The v4.3.0 surface lives entirely in `@stoachain/ouronet-core` (2 new account-rotation Pact builders supporting the new sibling package `@stoachain/ouronet-codex@0.1.0`). Functionally identical to `4.2.2`; consumers may pin to either interchangeably. **653 specs pass.**

**`4.2.2` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/kadena-stoic-legacy@4.2.2` + `@stoachain/ouronet-core@4.2.2`).** Released 2026-05-18. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`); peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.2.1 → 4.2.2 in lockstep. The v4.2.2 surface lives entirely in `@stoachain/ouronet-core` (SWP-pair management builders for the OuronetUI v1.0.8 Liquidity-Pools-Management wiring cycle). Functionally identical to `4.2.1` and `4.2.0`; consumers may pin to any of these interchangeably. **653 specs pass.**

**`4.2.1` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/kadena-stoic-legacy@4.2.1` + `@stoachain/ouronet-core@4.2.1`).** Released 2026-05-16. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`); peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.2.0 → 4.2.1 in lockstep. The v4.2.1 surface lives entirely in `@stoachain/ouronet-core`. Functionally identical to `4.2.0`; consumers may pin to either interchangeably. **653 specs pass.**

**`4.2.0` on public npmjs** — **MINOR (atomic with `@stoachain/kadena-stoic-legacy@4.2.0` + `@stoachain/ouronet-core@4.2.0`).** Released 2026-05-09. Closes audit findings F-API-018 (Phase 5 — readonly sweep across ~30 public-type fields in `signing/types.ts`, `wallet/types.ts`, `guard/guardUtils.ts`, `errors/transactionErrors.ts`, `signing/universalSign.ts`, `signing/partialSig.ts`) and F-TEST-002 (Phase 6 — universal-sign foreign-key fixture, +3 it-blocks). Adds 1 new regression-lock test file (`v4-2-0-readonly-invariant.test.ts`). NO new typed error classes; no new public functions. Test count: **653 specs pass** (was ~640 in v4.1.1). Cross-reference: see [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) and [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) at the monorepo root.

**v4.3.4** — atomic-triplet alignment bump (atomic with `@stoachain/kadena-stoic-legacy@4.3.4` + `@stoachain/ouronet-core@4.3.4`). Released 2026-06-08. NO code changes; the v4.3.4 surface (the UrStoa Collect-button hover fix) lives in `@stoachain/ouronet-core`. Functionally identical to v4.3.3. **653 specs pass.**

**v4.3.3** — atomic-triplet alignment bump (atomic with `@stoachain/kadena-stoic-legacy@4.3.3` + `@stoachain/ouronet-core@4.3.3`). Released 2026-05-30. NO code changes; peer-dep on ksl bumped 4.3.1 → 4.3.3 in lockstep. The v4.3.3 release surface lives in `@stoachain/ouronet-core` (additive StoicTag + governor-rotation builders/readers). Functionally identical to v4.3.1. **653 specs pass.**

**v4.3.1** — ESM packaging fix. **PATCH (atomic with `@stoachain/kadena-stoic-legacy@4.3.1` + `@stoachain/ouronet-core@4.3.1`).** Released 2026-05-27. Fixes extensionless relative imports in emitted `dist/**/*.js` that broke `await import('@stoachain/stoa-core/...')` under Node 22+ strict ESM (TypeScript with `moduleResolution: "bundler"` compiled them fine, the emitted JS broke at Node runtime). 29 source files updated, 57 imports rewritten. Per TypeScript's recommended `.js`-suffix-in-source ESM pattern. No API changes; **653/653 specs pass**; peer-dep on ksl bumped 4.3.0 → 4.3.1.

**v4.3.0** — atomic-triplet minor bump. **MINOR (atomic with `@stoachain/kadena-stoic-legacy@4.3.0` + `@stoachain/ouronet-core@4.3.0`).** Released 2026-05-25. NO code changes; peer-dep on ksl bumped to 4.3.0 in lockstep. The v4.3.0 release surface lives in `@stoachain/ouronet-core` (2 new account-rotation builders — `buildRotateGuardPactCode`, `buildRotateKadenaPactCode` — supporting the new sibling package `@stoachain/ouronet-codex@0.1.0`). Functionally identical to v4.2.2. **653 specs pass.**

**v4.2.2** — atomic-triplet patch bump. **PATCH (atomic with `@stoachain/kadena-stoic-legacy@4.2.2` + `@stoachain/ouronet-core@4.2.2`).** Released 2026-05-18. NO code changes; peer-dep on ksl bumped to 4.2.2 in lockstep. The v4.2.2 release surface lives in `@stoachain/ouronet-core` (SWP-pair management builders for the OuronetUI v1.0.8 cycle). Functionally identical to v4.2.1 and v4.2.0. **653 specs pass.**

**v4.2.1** — atomic-triplet patch bump. **PATCH (atomic with `@stoachain/kadena-stoic-legacy@4.2.1` + `@stoachain/ouronet-core@4.2.1`).** Released 2026-05-16. NO code changes; peer-dep on ksl bumped to 4.2.1 in lockstep. The v4.2.1 release surface lives in `@stoachain/ouronet-core`. Functionally identical to v4.2.0. **653 specs pass.**

**v4.2.0** — architectural-closures minor release. **MINOR (atomic with `@stoachain/kadena-stoic-legacy@4.2.0` + `@stoachain/ouronet-core@4.2.0`).** Released 2026-05-09. Closes 2 audit findings in `stoa-core`: **F-API-018** (Phase 5 readonly sweep — ~30 public-type fields gain `readonly` modifiers across `signing/types.ts` `IKadenaKeypair`/`KeyResolver`/`PactClient`, `wallet/types.ts` `BalanceResolver`-adjacent shapes, `guard/guardUtils.ts` `GuardAnalysis`, `errors/transactionErrors.ts`, `signing/universalSign.ts` `UniversalKeypair`, `signing/partialSig.ts`), **F-TEST-002** (Phase 6 universal-sign foreign-key fixture, +3 it-blocks in `tests/universal-sign.test.ts` covering the `seedType: "foreign"` path so the universal-sign pipeline is no longer untested for foreign-keypairs). Consumer impact: TypeScript-only. Code that mutated public-type fields in place (e.g., `kp.publicKey = '...'`, `analysis.threshold = 5`) now produces TS2540 at compile time — switch to immutable spread copy: `const updatedKp = { ...kp, publicKey: newPub };`. Emitted JavaScript is byte-identical to v4.1.1. Test count: 653 specs pass. Cross-reference: [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) for the full upgrade map, [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) for cold-start consumer onboarding.

**`4.1.1` on public npmjs** — **PATCH (atomic with `@stoachain/kadena-stoic-legacy@4.1.1` + `@stoachain/ouronet-core@4.1.1`).** Released 2026-05-08. Closes audit findings: F-SEC-006 (`KadenaWallet` secret redaction via `toJSON` + `inspect.custom`), F-SEC-009 (typed `MnemonicMismatchError`), F-BUG-008 (Σ-prefix smart-account guard with `SmartAccountAuthError`), F-API-008 (`SeedType` dedup re-export), F-API-012 (`SigningError` ES2022 `Error.cause`), F-API-013 (`firstSignableButUnsatisfied` required field). Adds 4 new typed error classes (`MnemonicMismatchError`, `SmartAccountAuthError`, and two cross-package errors from ouronet-core: `KadenaShapeError`, `CodexUnknownFieldError`). **~640 specs pass.**

**`4.1.0` on public npmjs** — **MIGRATION (atomic with `@stoachain/kadena-stoic-legacy@4.1.0` + `@stoachain/ouronet-core@4.1.0`).** Retargets all 25 internal `@kadena/*` imports (15 src + 10 test) to the new sibling subpaths under [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) — a sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship. Drops the four `@kadena/*` peer-dep declarations; replaces with a single `@stoachain/kadena-stoic-legacy: "4.1.0"` entry. The publicly-exported type surfaces (`IKadenaKeypair`, `ICommand`, `IUnsignedCommand`, `ChainId`, `KeyPair`, etc.) are unchanged — consumers who import via `@stoachain/stoa-core/{signing,wallet,reads,pact}` see no surface change. Test count: 551 (was 485; +66 from new `tests/v4-1-0-no-kadena-imports.test.ts` runtime regression-lock).

**`4.0.1` on public npmjs** — **PATCH, cosmetic (published-metadata cleanup).** Strips the redundant `devDependencies` block from `package.json`. Pre-v4.0.1 the published manifest carried a `devDependencies` block that duplicated the `peerDependencies` entries verbatim (workspace-tooling cruft visible on npmjs.com as "Dev Dependencies" alongside "Peer Dependencies"). v4.0.1 drops the dupes — the npmjs.com page now shows only `dependencies` (`@stoachain/dalos-crypto@4.0.3`) and `peerDependencies` (the @kadena/* + @noble/curves + @scure/bip39 set). NO source-code change. NO behaviour change. **485/485 tests pass.**

**`v4.0.0`** — **INITIAL RELEASE — born from the monorepo split.** `@stoachain/stoa-core` is the chain-generic StoaChain TypeScript foundation, extracted from `@stoachain/ouronet-core` v3.3.8 as part of the `stoa-js` monorepo restructure. Twelve subpath exports, one per chain-generic domain (constants / network / observability / signing / wallet / crypto / errors / gas / guard / reads / pact / dalos). The root entry (`@stoachain/stoa-core`) is intentionally near-empty — consumers MUST reach into a subpath for tree-shaking. Architecture preserved from `@stoachain/ouronet-core` v3.3.8: three pluggable seams (`setPactReader(fn)`, `KeyResolver` + `PactClient` interfaces, `BalanceResolver` function-shaped seam) so core stays environment-agnostic without a framework. Node failover is global state — anything making an HTTP call routes through `withFailover`. Codex backup format and the Ouronet-specific `interactions/*` are NOT in this package — those live in `@stoachain/ouronet-core`. **485 tests pass** in this package; **703/703 across both packages** (485 stoa-core + 218 ouronet-core). Pre-v4 history of the chain-generic surfaces lives in the `@stoachain/ouronet-core` CHANGELOG v0.x–v3.3.8 entries — every release of `@stoachain/ouronet-core` shipped this infrastructure baked into the same package.

## Install

`@stoachain/stoa-core` is a direct npm dependency:

```bash
npm install @stoachain/stoa-core
```

It declares the following peer dependencies (must be present in the consumer's tree):

  - `@stoachain/kadena-stoic-legacy` `4.1.0`
  - `@noble/curves` `1.9.7`
  - `@scure/bip39` `1.6.0`

Pinned to exact versions (no `^`). As of v4.1.0 the four `@kadena/*` peer-deps were dropped in favour of a single `@stoachain/kadena-stoic-legacy` entry — a sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship (supply-chain hardening after Kadena LLC's dissolution).

If you use `@stoachain/ouronet-core` (the Ouronet protocol layer) you'll get this package transitively, but a direct dependency is fine and doesn't double the install — npm dedupes both consumers down to a single `node_modules/@stoachain/stoa-core/`.

## Subpath exports

Twelve subpath exports — every directory under `src/` corresponds to a subpath declared in `package.json` (`./constants`, `./network`, etc.). Consumers are explicitly steered toward subpath imports for tree-shaking — `src/index.ts` is intentionally near-empty (`export {}`):

```ts
import { setLogger, getLogger, type Logger } from "@stoachain/stoa-core/observability";   // good
import { setLogger, getLogger, type Logger } from "@stoachain/stoa-core";                 // not supported
```

| Subpath | Surface |
|---|---|
| `@stoachain/stoa-core/constants` | `KADENA_NETWORK`, `KADENA_CHAIN_ID`, `STOA_CHAINS`, `STOA_CHAIN_COUNT`, `KADENA_CHAINS`, `getPactUrl(chainId)`, `getSpvUrl(chainId)` |
| `@stoachain/stoa-core/network` | `withFailover`, `setNodeConfig`, `resetNodeFailover`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl`, `getFailoverClient` factory, `getPrimaryBaseUrl` |
| `@stoachain/stoa-core/observability` | `getLogger()`, `setLogger(logger)` seam, `Logger` type, `InvalidLoggerError` |
| `@stoachain/stoa-core/signing` | `CodexSigningStrategy`, `KeyResolver`, `PactClient`, `IKadenaKeypair`, `IKeyset`, `fromKeypair`, `universalSignTransaction`, partial-sig primitives |
| `@stoachain/stoa-core/wallet` | `KadenaWallet`, `KadenaWalletBuilder`, `BalanceResolver` seam, `StorageAdapter` |
| `@stoachain/stoa-core/crypto` | V1/V2 envelope encryption (`decryptStringV2`, `smartDecrypt`, `decryptStringV2WithDetails`, `smartDecryptWithDetails`), V1 fallback security advisory, typed crypto-error taxonomy |
| `@stoachain/stoa-core/errors` | `createSigningError`, `createSimulationError`, `logDetailedError`, `UnknownPredicateError` |
| `@stoachain/stoa-core/gas` | `calculateAutoGasLimit`, gas-calibration helpers |
| `@stoachain/stoa-core/guard` | `analyzeGuard`, `normalizeKeysetRef`, Smart Ouronet Account `enforce-one` resolver, `IKeyset` |
| `@stoachain/stoa-core/reads` | `pactRead`, `setPactReader`, `getPactReader`, `rawCalibratedDirtyRead`, `InvalidPactReaderError` |
| `@stoachain/stoa-core/pact` | `formatDecimalForPact`, `formatIntegerForPact`, `mayComeWithDeimal`, `filterFreePositionData`, `formatEU`, `safeCreationTime` |
| `@stoachain/stoa-core/dalos` | DALOS account creation, primitive registry (`createDefaultRegistry`, `Leto`, `Artemis`, `Apollo`, `createGen1Primitive`) |

## Architectural patterns to preserve

**Pluggable seams, not DI.** Three narrow injection points let the package stay environment-agnostic without a framework:

1. **`setPactReader(fn)` in `reads/`** — consumers call once at boot. Browser plugs in its cache-aware reader; server leaves the default uncached `rawCalibratedDirtyRead`. Interaction code in `@stoachain/ouronet-core` calls `pactRead(...)`, never the raw reader directly.
2. **`KeyResolver` + `PactClient` interfaces in `signing/`** — consumed by `CodexSigningStrategy`. OuronetUI implements `ReduxCodexResolver`, HUB will implement `FileCodexResolver`. Never import a concrete resolver into core.
3. **`BalanceResolver` function-shaped seam in `wallet/`** — instance-level analogue of `setPactReader`'s function-shaped seam (function alias, NOT an interface), applied to `KadenaWallet.getBalance()`. Default throws clearly-worded error if not configured; `getBalance()` propagates resolver errors.

**Node failover is global state.** `network/nodeFailover.ts` switches the active StoaChain node on health-check failure. Anything making an HTTP call must route through `withFailover` — historically `interactions/*` had `createClient(PACT_URL)` calls pinned to node2; the v1.6.1 fix removed those and they should not come back.

**The codex backup format is frozen at `"1.2"`.** Lives in `@stoachain/ouronet-core/codex` (not this package). Read its JSDoc before touching the codec.

**`createDefaultRegistry()` registers DALOS Genesis only.** `Leto`/`Artemis`/`Apollo` and `createGen1Primitive` are re-exported from the `./dalos` subpath but deliberately NOT in the default registry. Ouronet itself is Genesis-only by design; consumers who want historical curves opt in via `registry.register(...)`.

**Smart Ouronet Account auth (Σ. prefix) uses three branches.** `guard/smartAccountAuth.ts` resolves the `enforce-one` over (account guard / sovereign guard / governor). The signing strategy itself still takes a single AND-of-keysets array — UI/consumer is responsible for picking the chosen branch before calling `execute`. Standard accounts (Ѻ. prefix) still use a single keyset.

## Versioning + publishing

Strict semver. `@stoachain/stoa-core` and `@stoachain/ouronet-core` always release at the same version out of the `stoa-js` monorepo — a single `vX.Y.Z` git tag publishes both. Per-package CHANGELOGs (this file + `packages/ouronet-core/CHANGELOG.md`) carry the granular history.

The `CHANGELOG.md` in this package is the source of truth for what changed in `@stoachain/stoa-core` per version. Pre-v4 changes to chain-generic surfaces (signing, wallet, crypto, network, etc.) are documented in `@stoachain/ouronet-core`'s pre-v4 CHANGELOG entries — those releases shipped this code baked into the single package.

## Version history

**v4.1.1** — audit-closure patch. **PATCH (atomic with `@stoachain/kadena-stoic-legacy@4.1.1` + `@stoachain/ouronet-core@4.1.1`).** Closes F-SEC-006 (`KadenaWallet` secret redaction via `toJSON` + `inspect.custom`), F-SEC-009 (typed `MnemonicMismatchError`), F-BUG-008 (Σ-prefix smart-account guard with `SmartAccountAuthError`), F-API-008 (`SeedType` dedup re-export), F-API-012 (`SigningError` ES2022 `Error.cause`), F-API-013 (`firstSignableButUnsatisfied` required field). Four new typed error classes. No breaking changes — deprecation shims maintain backward compatibility. **~640 tests pass.**

**v4.1.0** — sovereign supply-chain migration. **MINOR (atomic with `@stoachain/kadena-stoic-legacy@4.1.0` + `@stoachain/ouronet-core@4.1.0`).** Retargets all 25 internal `@kadena/*` imports (15 src + 10 test) to the new sibling subpaths under [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) — a sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship, born at v4.1.0 in response to Kadena LLC's dissolution and the resulting unmaintained-upstream supply-chain risk. The four `@kadena/*` peer-dep declarations are dropped from `package.json`; a single `@stoachain/kadena-stoic-legacy@4.1.0` peer-dep replaces them (+ the unchanged `@noble/curves@1.9.7` and `@scure/bip39@1.6.0` pins). The publicly-exported type surfaces (`IKadenaKeypair`, `ICommand`, `IUnsignedCommand`, `ChainId`, `KeyPair`, etc.) are unchanged — consumers who import via `@stoachain/stoa-core/{signing,wallet,reads,pact}` see ZERO surface change; every Pact-builder, hash, key-generation, and HD-wallet call site rewires under the hood to the vendored module. Test count: **551** (was 485; +66 from the new `tests/v4-1-0-no-kadena-imports.test.ts` runtime regression-lock that asserts no `@kadena/*` literal appears in any built or source file under `dist/` or `src/`). Release is atomic — `vX.Y.Z` git tag publishes all three packages simultaneously via `.github/workflows/publish.yml` in dependency order (kadena-stoic-legacy first, stoa-core second, ouronet-core third), each with its own `--provenance` SLSA attestation.

**v4.0.1** — cosmetic published-metadata cleanup. **PATCH.** Strips the redundant `devDependencies` block from `package.json` — the block duplicated the `peerDependencies` entries verbatim, which was workspace-tooling cruft visible on npmjs.com but not actually doing anything useful for consumers (npm 7+ auto-installs peer-deps in development; the duplicate dev-dep entries were leftover from pre-workspace publishing patterns). NO source-code change. NO behaviour change. **485/485 tests pass.** Regression-lock at `tests/package-version.test.ts` updated to assert `4.0.1`.

**v4.0.0** — initial release of `@stoachain/stoa-core`, born from the v4.0.0 split of `@stoachain/ouronet-core` v3.3.8. **MAJOR, breaking** (vs. consuming the chain-generic surfaces from `@stoachain/ouronet-core` directly). Twelve subpath exports cover the chain-generic foundation. Architecture invariants from `@stoachain/ouronet-core` v3.3.8 carried forward unchanged: three pluggable seams (`setPactReader`, `KeyResolver` + `PactClient`, `BalanceResolver`), `withFailover`-routed HTTP, frozen codex format owned by `@stoachain/ouronet-core`, DALOS registry stays Genesis-only by default. All `@kadena/*` peer/dev deps + `@noble/curves` + `@scure/bip39` + `@stoachain/dalos-crypto` pinned to exact versions (no `^`). **485 tests pass** in this package's `tests/`; **703/703 across both packages** (485 stoa-core + 218 ouronet-core). See `packages/ouronet-core/CHANGELOG.md` v0.x–v3.3.8 entries for the pre-split history of the chain-generic surfaces — every release of `@stoachain/ouronet-core` shipped this code, just bundled with the Ouronet protocol layer.

For the migration path from `@stoachain/ouronet-core@^3.3.8` consumers' perspective, see [`MIGRATION-v4.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.md) at the monorepo root.
