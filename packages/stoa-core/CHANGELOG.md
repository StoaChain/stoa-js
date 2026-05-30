# Changelog

All notable changes to `@stoachain/stoa-core`.

This package was born from the v4.0.0 split of `@stoachain/ouronet-core`. Pre-v4 history of the chain-generic surfaces (signing, wallet, crypto, network failover, gas, guard, errors, observability, dalos, reads, pact-format) lives in the [`@stoachain/ouronet-core` CHANGELOG](https://github.com/StoaChain/stoa-js/blob/main/packages/ouronet-core/CHANGELOG.md) v0.x–v3.3.8 entries — every release of `@stoachain/ouronet-core` shipped that infrastructure baked into the same package.

## 4.3.3 — 2026-05-30

**PATCH — atomic-triplet alignment**. No code changes in THIS package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the exact same version). The v4.3.3 release surface lives entirely in [`@stoachain/ouronet-core@4.3.3`](https://www.npmjs.com/package/@stoachain/ouronet-core) — additive StoicTag + governor-rotation builders/readers. The peer-dep pin on `@stoachain/kadena-stoic-legacy` was updated 4.3.2 → 4.3.3. Functionally identical to v4.3.2.

## 4.3.2 — 2026-05-30

**PATCH — atomic-triplet alignment**. No code changes in THIS package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the exact same version). The v4.3.2 release surface lives entirely in [`@stoachain/ouronet-core@4.3.2`](https://www.npmjs.com/package/@stoachain/ouronet-core) — a frozen-keyset mutation fix in `resolveGuard` / `getKadenaAccountGuard`. The peer-dep pin on `@stoachain/kadena-stoic-legacy` was updated 4.3.1 → 4.3.2. Functionally identical to v4.3.1.

## 4.3.1 — 2026-05-27

**PATCH — ESM extensionless-relative-import fix** (atomic-triplet bump). Same bug pattern as [`@stoachain/ouronet-codex@0.2.1`](https://www.npmjs.com/package/@stoachain/ouronet-codex), discovered while smoke-testing the workspace in the wake of the AH-hub-reported codex packaging bug.

### The bug

`dist/**/*.js` re-exported from relative paths WITHOUT the `.js` extension — e.g. `dist/crypto/index.js:1` had `export { encryptString } from "./v1";`. Under Node 22+ strict ESM, this throws `ERR_MODULE_NOT_FOUND` at import-resolution. TypeScript with `moduleResolution: "bundler"` happily compiled extensionless imports; the emitted JS broke in real Node environments.

The bug didn't surface in production because all current consumers (OuronetUI via Vite, AH hub via Next.js) use bundler-based static imports — bundlers auto-resolve missing extensions. Only `await import('@stoachain/stoa-core/...')` from a strict ESM context (server-side dynamic imports) exposed it. No user was bitten; this is a preventive fix.

### The fix

29 source files updated, 57 imports rewritten. Per TypeScript's recommended ESM pattern (`.js`-suffix-in-source). `tsconfig` unchanged.

### Verification

- typecheck clean
- 653/653 specs pass (no regressions)
- Smoke test: `await import('@stoachain/stoa-core/crypto')` (and `/signing`, `/guard`, `/wallet`) succeed under Node 22+ strict ESM

### No API changes

Every v4.3.0 export keeps its signature. Atomic-triplet invariant preserved (test `v4-1-1-cross-package-version-pin.test.ts` continues to pass at 4.3.1).

## 4.3.0 — 2026-05-25

**MINOR — atomic-triplet bump aligned with `@stoachain/ouronet-core@4.3.0` additive surface (2 new account-rotation Pact builders).** No code changes in this package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the same version) AND to keep peer-dep alignment (peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.2.2 → 4.3.0 in lockstep). Published from the same `v4.3.0` git tag.

### Compatibility

- Functionally identical to `4.2.2`. Consumers MAY pin to either version interchangeably.

## 4.2.2 — 2026-05-18

**PATCH — atomic-triplet bump aligned with `@stoachain/ouronet-core@4.2.2` additive surface.** No code changes in this package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the same version) AND to keep peer-dep alignment (peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.2.1 → 4.2.2 in lockstep). Published from the same `v4.2.2` git tag.

### Compatibility

- Functionally identical to `4.2.1` and `4.2.0`. Consumers MAY pin to any of these versions interchangeably.

## 4.2.1 — 2026-05-16

**PATCH — atomic-triplet bump aligned with `@stoachain/ouronet-core@4.2.1` additive surface.** No code changes in this package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the same version) AND to keep peer-dep alignment (peer-dep on `@stoachain/kadena-stoic-legacy` bumped 4.2.0 → 4.2.1 in lockstep). Published from the same `v4.2.1` git tag.

### Compatibility

- Functionally identical to `4.2.0`. Consumers MAY pin to either version interchangeably.

## 4.2.0 — 2026-05-09

**MINOR — architectural closures + atomic-triplet bump (atomic with `@stoachain/kadena-stoic-legacy@4.2.0` + `@stoachain/ouronet-core@4.2.0`).** Released 2026-05-09. Closes audit findings F-API-018 (readonly sweep) and F-TEST-002 (foreign-key fixture in universal-sign).

### Changed — audit closures

- **REQ-21 / F-API-018 — Readonly sweep across stoa-core public types.** Aggressive `readonly` modifier sweep across ~30 public type fields: `signing/types.ts` (`IKadenaKeypair`, `KeyResolver`, `PactClient`), `wallet/types.ts` (`BalanceResolver`-adjacent shapes), `guard/guardUtils.ts` (`GuardAnalysis`), `errors/transactionErrors.ts`, `signing/universalSign.ts` (`UniversalKeypair`), `signing/partialSig.ts`. TypeScript-only signal — no runtime change. Carry-forward snippet (Phase 5 T5.11): _"v4.2.0 — Aggressive readonly sweep across ~85 public type fields (F-API-018). All public-type object-property fields in stoa-core and ouronet-core now carry readonly. Consumer impact: TypeScript-only signal; immutable spread/struct-copy required for previously-in-place mutations. Zero runtime change."_

- **REQ-25 / REQ-26 / F-TEST-002 — Universal-sign foreign-key fixture.** New foreign-key (`seedType: "foreign"`) fixture coverage in `tests/universal-sign.test.ts` — 3 new it-blocks asserting the universal-sign pipeline handles foreign-keypairs correctly without falling back to the dalos default-primitive path.

### Test surface

- 1 new regression-lock test file: `tests/v4-2-0-readonly-invariant.test.ts` (~12-15 type-level assertions verifying the readonly modifiers compile to TS2540 errors when consumer code attempts in-place mutation).
- 3 new it-blocks in `tests/universal-sign.test.ts` covering the foreign-key fixture (F-TEST-002).
- Test count: ~640 (v4.1.1) → ~668 (v4.2.0).

### Version

- Atomic-triplet bump 4.1.1 → 4.2.0 alongside `@stoachain/kadena-stoic-legacy` and `@stoachain/ouronet-core`.
- `@stoachain/kadena-stoic-legacy` peer-dep aligned to `4.2.0`.
- `@scure/bip39` peer-dep stays at exact-pin `1.2.1`; `@noble/curves` at `1.9.7` (independent upstream-version pins, unrelated to the StoaChain triplet bump).

### Migration

- Consumer impact: TypeScript-only. Code that mutated public-type fields in place (e.g., `kp.publicKey = '...'`, `analysis.threshold = 5`) now produces TS2540 at compile time. Switch to immutable spread copy: `const updatedKp = { ...kp, publicKey: newPub };`. Emitted JavaScript is byte-identical to v4.1.1.
- See [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) at the monorepo root for the full v4.1.x → v4.2.0 transition guide and [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) for cold-start consumer onboarding.

## 4.1.1 — 2026-05-08

### Added — typed error classes (v4.1.1 audit closures)
- `MnemonicMismatchError` (`src/wallet/errors.ts`, REQ-09 / F-SEC-009): typed wrapping of mnemonic-validation throws in `KadenaWalletBuilder.createWalletPairFromMnemonic`. Message strings unchanged.
- `SmartAccountAuthError` (`src/signing/errors.ts`, REQ-11 / F-BUG-008): thrown by `CodexSigningStrategy.execute()` when a Σ-prefix smart-account guard is detected on either `keysetRef` or `keys[]` AND no satisfiable codex path exists.

### Changed — audit closures
- **REQ-07 (F-SEC-006):** `KadenaWallet` adds `toJSON()` and `[Symbol.for("nodejs.util.inspect.custom")]()` methods that omit `secret` (and `balanceResolver`) from JSON.stringify and console.log output. Direct `wallet.secret` access preserved.
- **REQ-13 (F-API-008):** `SeedType` declaration now lives in `src/wallet/types.ts` only. `ouronet-core/codex/seedTypeMigration.ts` re-exports from `@stoachain/stoa-core/wallet`.
- **REQ-14 (F-API-012):** `SigningError` constructor now forwards original error via ES2022 `super(message, { cause: originalError })`. 5-arg constructor signature unchanged.
- **REQ-15 (F-API-013):** `GuardAnalysis.firstSignableButUnsatisfied` is now required (drop `?:`). Producer always populates the field with a -1 sentinel when no signable-but-unsatisfied branch exists.

### Test surface
- 8 new v4-1-1-*.test.ts files: kadena-wallet-redaction, mnemonic-mismatch, sigma-prefix-guard, signing-error-cause, guard-analysis-required-fields, dalos-import-style, gas-limit-colors-public, dist-structure, esm-roundtrip, type-preservation, package-metadata, peer-dep-coverage.
- Test count: ~575 → ~640 specs.

### Documentation
- `GAS_LIMIT_COLORS` marked `@public` JSDoc. Removal deferred to v4.2.0.

### Version
- Atomic-triplet bump 4.1.0 → 4.1.1 alongside `@stoachain/kadena-stoic-legacy` and `@stoachain/ouronet-core`.
- `@stoachain/kadena-stoic-legacy` peer-dep aligned to `4.1.1`.
- `@scure/bip39` peer-dep stays at exact-pin `1.2.1` (post-v4.1.0 hotfix `49d69a3` alignment with kadena-stoic-legacy's vendored copy).

## 4.1.0 — 2026-05-07

**MINOR — sovereign supply-chain migration (atomic with `@stoachain/kadena-stoic-legacy@4.1.0` + `@stoachain/ouronet-core@4.1.0`).** Retargets every internal `@kadena/*` import in this package to the new sibling subpaths under [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) — a sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship.

### Why

Post-Kadena-LLC, the StoaChain ecosystem cannot accept supply-chain risk on unmaintained upstream npm packages. v4.0.0 pinned the four `@kadena/*` peer-deps to exact versions (no `^`) as prep work — v4.1.0 is the follow-through: drop the upstream peer-deps entirely, depend on the StoaChain-stewarded vendored sibling, lock the migration with a runtime regression test that fails if any `@kadena/*` literal sneaks back into source or built output.

### What changed

  - **15 src + 10 test imports retargeted.** All 25 internal `@kadena/*` imports across `src/{signing,wallet,reads,pact}/` and `tests/` rewired to `@stoachain/kadena-stoic-legacy/{client,cryptography-utils,types,hd-wallet,hd-wallet/chainweaver}`. Each retarget preserves the imported symbol set byte-identically (`Pact`, `createClient`, `hash`, `binToHex`, `ICommand`, `IUnsignedCommand`, `ChainId`, `kadenaSign`, etc.) — the vendored module re-exports the upstream surface verbatim.
  - **Peer-deps trimmed.** Four `@kadena/*` peer-dep declarations removed from `package.json`. Single `@stoachain/kadena-stoic-legacy: "4.1.0"` exact-pin added. `@noble/curves: "1.9.7"` and `@scure/bip39: "1.6.0"` unchanged.
  - **Public type surface unchanged.** `IKadenaKeypair`, `ICommand`, `IUnsignedCommand`, `ChainId`, `KeyPair`, `IKeyset`, etc. — every type exported through `@stoachain/stoa-core/{signing,wallet,reads,pact}` retains the same shape. Consumers who import via subpath see no breaking change. The atomic-release invariant means `@stoachain/ouronet-core@4.1.0` simultaneously rewires its 12 interactions imports.
  - **Regression-lock added.** `tests/v4-1-0-no-kadena-imports.test.ts` (66 specs) walks `dist/**/*.{js,d.ts,cjs,d.cts}` + `src/**/*.ts` and asserts no `@kadena/*` literal occurs in any import statement, type reference, or string. Fails the CI build if a future regression silently reintroduces an upstream `@kadena/*` dependency.

### Tests

**551/551 pass** (was 485 in v4.0.1; +66 from the new regression-lock).

### Migration

For consumers importing through subpath, **no migration required** — every public surface keeps its byte-identical shape. Consumers who happen to import `@kadena/*` types directly in their own code can continue to do so (those upstream packages still exist on npmjs.com for the foreseeable future) — but the StoaChain-recommended path is to import the vendored types from `@stoachain/kadena-stoic-legacy/types`. See [`MIGRATION-v4.1.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.1.md) at the monorepo root for the full upgrade map.

## 4.0.1 — 2026-05-06

**PATCH, cosmetic (published-metadata cleanup).** Strips the redundant `devDependencies` block from `package.json`. Pre-v4.0.1 the published manifest carried a `devDependencies` block that duplicated the `peerDependencies` entries verbatim — workspace-tooling cruft (npm 7+ peer-dep auto-install in dev mode makes the duplicate unnecessary, but the line shipped to npmjs.com anyway, where it appeared as "Dev Dependencies" on the package page next to the canonical "Peer Dependencies" section). v4.0.1 drops the dupes — the npmjs.com page now shows only `dependencies` (`@stoachain/dalos-crypto@4.0.3`) and `peerDependencies` (the @kadena/* + @noble/curves + @scure/bip39 set). NO source-code change. NO behaviour change. NO breaking change. **485/485 tests pass** (regression-lock test `tests/package-version.test.ts` updated to assert `4.0.1`).

## 4.0.0 — 2026-05-06

**INITIAL RELEASE — born from the monorepo split.** `@stoachain/stoa-core` is the chain-generic StoaChain TypeScript foundation, extracted from `@stoachain/ouronet-core` v3.3.8 as part of the `stoa-js` monorepo restructure.

### What's in this package

Twelve subpath exports, one per chain-generic domain:

| Subpath | Purpose |
|---|---|
| `@stoachain/stoa-core/constants` | `KADENA_NETWORK`, `KADENA_CHAIN_ID`, `STOA_CHAINS`, `STOA_CHAIN_COUNT`, `KADENA_CHAINS`, failover-aware `getPactUrl(chainId)` / `getSpvUrl(chainId)` |
| `@stoachain/stoa-core/network` | `withFailover`, node failover state (`setNodeConfig`, `resetNodeFailover`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl`), `getFailoverClient` factory |
| `@stoachain/stoa-core/observability` | `getLogger()` / `setLogger(logger)` seam, `Logger` type, `InvalidLoggerError` |
| `@stoachain/stoa-core/signing` | `CodexSigningStrategy`, `KeyResolver`, `PactClient`, `IKadenaKeypair`, `IKeyset`, `fromKeypair`, `universalSignTransaction`, `sign`, partial-sig primitives |
| `@stoachain/stoa-core/wallet` | `KadenaWallet`, `KadenaWalletBuilder`, `BalanceResolver` seam, `StorageAdapter` |
| `@stoachain/stoa-core/crypto` | V1/V2 envelope encryption (`decryptStringV2`, `smartDecrypt`, `decryptStringV2WithDetails`, `smartDecryptWithDetails`), V1 fallback security advisory, typed crypto-error taxonomy |
| `@stoachain/stoa-core/errors` | Typed transaction errors (`createSigningError`, `createSimulationError`, `logDetailedError`, `UnknownPredicateError`) |
| `@stoachain/stoa-core/gas` | `calculateAutoGasLimit`, gas-calibration helpers |
| `@stoachain/stoa-core/guard` | Guard analysis (`analyzeGuard`), keyset normalisation (`normalizeKeysetRef`), Smart Ouronet Account `enforce-one` resolver |
| `@stoachain/stoa-core/reads` | `pactRead` + `setPactReader` / `getPactReader` seam, `rawCalibratedDirtyRead` (default uncached reader) |
| `@stoachain/stoa-core/pact` | Chain-generic format helpers: `formatDecimalForPact`, `formatIntegerForPact`, `mayComeWithDeimal`, `filterFreePositionData`, `formatEU`, `safeCreationTime` |
| `@stoachain/stoa-core/dalos` | DALOS account creation, primitive registry (`createDefaultRegistry`, `Leto`, `Artemis`, `Apollo`, `createGen1Primitive`) |

The root entry (`@stoachain/stoa-core`) is intentionally near-empty — consumers MUST reach into a subpath for tree-shaking. See the per-package `README.md` for the consumption pattern.

### What's NOT in this package

Anything Ouronet-specific lives in `@stoachain/ouronet-core`:

  - `KADENA_NAMESPACE = "ouronet-ns"`, `STOA_AUTONOMIC_*` accounts, `MAIN_TOKENS`, `TOKEN_ID_*`
  - The codex backup format (the `"1.2"` JSON envelope)
  - The 13 `interactions/*` Pact builders
  - cfm Pact-code string assembler

### Architecture preserved from `@stoachain/ouronet-core` v3.3.8

Three pluggable seams (DI without a framework):

  1. `setPactReader(fn)` — consumer wires a cache-aware reader at boot. `pactRead(...)` routes through it. Default is the uncached `rawCalibratedDirtyRead`.
  2. `KeyResolver` + `PactClient` interfaces — consumed by `CodexSigningStrategy`. Browser implements `ReduxCodexResolver`; server-side will implement `FileCodexResolver`.
  3. `BalanceResolver` (function-shaped, instance-level) — applied to `KadenaWallet.getBalance()`. Default throws if not configured.

Node failover is global state: `withFailover` switches active StoaChain node on health-check failure. Anything making an HTTP call routes through this — no `createClient(PACT_URL)` calls pinned to a single host.

### Tests

485 specs in `tests/`, covering the major surfaces: cfm-builders' format-helper subset, smart-account-auth, codex round-trip integration (lives in ouronet-core but exercises stoa-core's signing primitives), crypto v1+v2 + upgrade, gas, guard, network failover + nodeFailover state, pact-format, signing strategy + primitives, dalos integration, observability seam, error taxonomy.
