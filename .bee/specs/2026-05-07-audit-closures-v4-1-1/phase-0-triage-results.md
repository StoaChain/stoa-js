# Phase 0 Triage Results — audit-closures-v4-1-1

**Generated:** 2026-05-07
**HEAD:** 69b2e50
**Total REQs:** 33

## Executive Summary

| Tier | REQ count | CLOSED-VERIFIED | STILL-OPEN | NEEDS-VERIFICATION |
|------|-----------|-----------------|------------|---------------------|
| Tier 1 — HIGH bugs | 4 | 0 | 4 | 0 |
| Tier 2 — Phase 7 LITE highest-ROI | 2 | 0 | 2 | 0 |
| Tier 3a — SEC + BUG | 6 | 1 | 5 | 0 |
| Tier 3b — API + ARCH polish | 6 | 1 | 5 | 0 |
| Tier 3c — PERF + TEST | 6 | 6 | 0 | 0 |
| Tier 3d/3e — Phase 7 LITE catch-up | 9 | 0 | 9 | 0 |
| **Total** | **33** | **8** | **25** | **0** |

## Tier 1 — HIGH bug fixes (REQ-01..REQ-04)

| REQ | Audit code | Classification | Evidence (file:line or grep output) | Notes |
|-----|------------|----------------|--------------------------------------|-------|
| REQ-01 | F-ERR-022 | STILL-OPEN | `kadenaFunctions.ts:16: : String(raw ?? "0");` and `kadenaFunctions.ts:27: balance: result?.data?.balance \|\| "0",` | Both coercion patterns present. Line 16 uses `?? "0"` (null-coalescing string coercion); line 27 uses `\|\| "0"` (falsy OR fallback). Both stringify numeric 0 to "0" instead of preserving numeric type. |
| REQ-02 | F-API-005 | STILL-OPEN | `src/interactions/infoOneFunctions.ts:179` + `src/interactions/ouroFunctions.ts:2148` | Two separate `export async function getSublimateInfo` declarations with divergent signatures: `infoOneFunctions.ts` takes `(client, target, amount: number)`, `ouroFunctions.ts` takes `(patron, resident, amount: string)`. Duplicate symbol with incompatible parameter types. |
| REQ-03 | F-API-006 | STILL-OPEN | `src/interactions/guardFunctions.ts:62` + `src/interactions/urStoaFunctions.ts:89` | Two `describeKeyset` declarations. `guardFunctions.ts:62` is exported (`export async function describeKeyset(keysetName: string)`); `urStoaFunctions.ts:89` is unexported (`async function describeKeyset(ksRef: string)`) with a different return shape (`{ keys, pred } \| null` vs `IDescribedKeyset`). |
| REQ-04 | F-API-007 | STILL-OPEN | `packages/stoa-core/src/crypto/v1.ts:18` + `packages/stoa-core/src/crypto/v2.ts:52` | `v1.ts` declares `export interface EncryptedData { ciphertext: string; iv: string; salt: string; }` (lines 18-22). `v2.ts` declares `export interface EncryptedDataV1 { ciphertext: string; iv: string; salt: string; }` (lines 52-56). Bodies are byte-identical; two separate interface declarations describe the same V1 envelope shape. |

## Tier 2 — Highest-ROI Phase 7 LITE catch-up (REQ-05..REQ-06)

| REQ | Audit code | Classification | Evidence (file:line or grep output) | Notes |
|-----|------------|----------------|--------------------------------------|-------|
| REQ-05 | T7.10 (REQ-43+44) | STILL-OPEN | Glob `packages/*/tests/v4-1-1-package-metadata.test.ts` → 0 matches. Glob `packages/*/tests/v4-1-1-peer-dep-coverage.test.ts` → 0 matches. Expected 6 files across 3 packages (kadena-stoic-legacy, stoa-core, ouronet-core); none exist. | Existing `packages/stoa-core/tests/package-version.test.ts` and `packages/ouronet-core/tests/package-version.test.ts` cover version-string parity only — they do NOT assert `repository.url`, `publishConfig.access`, `engines.node`, `sideEffects`, or `license`, and do not walk `src/` for peer-dep cross-checks. The `@scure/bip39` 1.6.0-vs-1.2.1 mismatch class (hotfix commit `49d69a3`) would NOT have been caught by any existing test. All 6 net-new test files required. |
| REQ-06 | T7.11 (REQ-45) | STILL-OPEN | Glob `packages/ouronet-core/tests/v4-1-1-publish-workflow-simulation.test.ts` → 0 matches. Parse target `.github/workflows/publish.yml` EXISTS at `Z:\OuronetCore\.github\workflows\publish.yml`. | None of the 5 publish-workflow simulation cases are covered by any existing test. The build-before-test ordering regression (hotfix commit `0c64fb9`) would NOT have been caught. `publish.yml` is present and parseable; the simulation test can be implemented via either bash extraction or YAML-parser inspection of step run-blocks. Net-new test file required. |

## Tier 3a — SEC + BUG closures (REQ-07..REQ-12)

| REQ | Finding | Description | Evidence | Status |
|-----|---------|-------------|----------|--------|
| REQ-07 | F-SEC-006 | KadenaWallet secret redaction (`toJSON` / `inspect.custom`) | Neither `toJSON` nor `util.inspect.custom` present in `packages/stoa-core/src/wallet/KadenaWallet.ts`; `secret` field is a plain public property with no serialization guard | STILL-OPEN |
| REQ-08 | F-SEC-007 | `deserializeCodex` strict unknown-field rejection (`CodexUnknownFieldError`) | `packages/ouronet-core/src/codex/codec.ts:81-115` performs structural shape checks (version, array/object types) but has no unknown-field enumeration and no `CodexUnknownFieldError` class anywhere in the codex directory | STILL-OPEN |
| REQ-09 | F-SEC-009 | `MnemonicMismatchError` typed error class | `packages/stoa-core/src/wallet/errors.ts` does not exist; grep for `class MnemonicMismatchError` across `packages/stoa-core/src/` returns no matches | STILL-OPEN |
| REQ-10 | F-BUG-005 | DALOS error re-exports (`InvalidBitStringError`, `InvalidBitmapError`, `InvalidPrivateKeyError`, `CoordAffine`) | All four symbols present in `packages/stoa-core/src/dalos/index.ts` lines 127-138 (closed in v3.1.1 commit `bacaf79`) | CLOSED-VERIFIED |
| REQ-11 | F-BUG-008 | Σ-prefix guard check at `execute()` entry in `CodexSigningStrategy` | `packages/stoa-core/src/signing/codexStrategy.ts:68-86` — `execute()` opens directly into argument destructuring with no Σ-prefix address check and no `SmartAccountAuthError` throw; grep for `Σ`, `SmartAccountAuthError`, `sigma`, `smart.account` all return no matches | STILL-OPEN |
| REQ-12 | F-BUG-010 | `migrateSeedType` strict rejection of unknown seed types (`UnknownSeedTypeError`) | `packages/ouronet-core/src/codex/seedTypeMigration.ts:41` reads `return SEED_TYPE_MIGRATION[rawType] \|\| "koala"` — silently falls back to `"koala"` instead of throwing; the comment on line 35-39 explicitly documents this as the intentional behaviour | STILL-OPEN |

## Tier 3b — API + ARCH polish (REQ-13..REQ-18)

| REQ | Finding ID | Title | Status | Evidence |
|-----|-----------|-------|--------|----------|
| REQ-13 | F-API-008 | SeedType dedup | STILL-OPEN | Both `packages/stoa-core/src/wallet/types.ts:22` and `packages/ouronet-core/src/codex/seedTypeMigration.ts:21` independently declare `export type SeedType = "koala" \| "chainweaver" \| "eckowallet"`. No re-export relationship exists between the two files. |
| REQ-14 | F-API-012 | SigningError Error.cause | STILL-OPEN | `packages/stoa-core/src/errors/transactionErrors.ts:28` calls `super(message)` only — no `{ cause }` object passed. The `originalError` is stored as a custom instance field (`this.originalError`) rather than forwarded through the native `Error.cause` mechanism. |
| REQ-15 | F-API-013 | firstSignableButUnsatisfied required | STILL-OPEN | `packages/stoa-core/src/guard/smartAccountAuth.ts:274` declares `readonly firstSignableButUnsatisfied?: number` — the `?` optional marker is present and the JSDoc comment explicitly frames it as intentionally optional for v1.6.0 backwards compatibility. |
| REQ-16 | F-API-014 | getSparksBalance type narrow | STILL-OPEN | `packages/ouronet-core/src/interactions/ouroFunctions.ts:1464` declares `Promise<any>` — the return type is unnarrowed `any`, not `Promise<any \| null>` or a concrete numeric/null type. |
| REQ-17 | F-ARCH-012 | dalos quote/extension imports | CLOSED-VERIFIED [LOCK-TEST-DEFERRED] | Grepped `packages/stoa-core/src/dalos/` for single-quote imports (`from '`) and `.js` extension imports — 0 matches in both searches. Confirmed clean via v3.3.8 (`8f92ad8`). No regression-lock test exists yet; Phase 3 will author one. |
| REQ-18 | F-ARCH-013 | GAS_LIMIT_COLORS dead export | STILL-OPEN | `packages/stoa-core/src/gas/gasUtils.ts:76` exports `GAS_LIMIT_COLORS`. Grepping all `packages/*/src/**/*.ts` for `GAS_LIMIT_COLORS` returns exactly one match — the definition itself. No internal `*/src/` consumer exists; the symbol is exported with no intra-library usage. |

## Tier 3c — PERF + TEST closures (REQ-19..REQ-24)

| REQ | Audit code | Classification | Evidence (file:line or glob output) | Notes |
|-----|------------|----------------|--------------------------------------|-------|
| REQ-19 | F-PERF-003 | CLOSED-VERIFIED | `packages/ouronet-core/src/interactions/coilFunctions.ts:48: const coilPatternCache = new Map<string, CoilPatternSet>();` | `coilPatternCache` Map and `CoilPatternSet` interface both present (lines 43-48). `getCoilPatterns` lazily populates and returns the cache (lines 50-74). Per-call 8-RegExp allocation dropped to zero after cache warm. v3.3.6 commit `f886541`. |
| REQ-20 | F-PERF-004 | CLOSED-VERIFIED | `packages/ouronet-core/src/interactions/ouroFunctions.ts:224: const [owner, guard] = await Promise.all([...]` + `packages/ouronet-core/tests/v3-3-6-perf-pass.test.ts` (file exists) | `Promise.all` parallelization confirmed at lines 224-227. Regression-lock test file `v3-3-6-perf-pass.test.ts` exists. v3.3.6 commit `f886541`. |
| REQ-21 | F-TEST-001 | CLOSED-VERIFIED | `packages/stoa-core/tests/gas.test.ts:117: expect(result.anu).toBe("10,000,000");` | Strict `toBe` equality at line 117 (was `toMatch` substring regex pre-v3.1.1). Locks both en-US thousands separator and absence of trailing/leading characters. v3.1.1 commit `bacaf79`. |
| REQ-22 | F-TEST-004 | CLOSED-VERIFIED | `packages/stoa-core/tests/dalos-integration.test.ts:138-184` | 4 schnorr `it`-blocks confirmed: `schnorrSign+schnorrVerify` round-trip (line 138), `schnorrSignAsync+schnorrVerifyAsync` round-trip (line 148), `SchnorrSignError` instanceof probe (line 157), `SchnorrSignature` type structural shape probe (line 169). v3.1.1 commit `bacaf79`. |
| REQ-23 | F-TEST-005 | CLOSED-VERIFIED | `packages/ouronet-core/tests/v3-3-4-success-paths.test.ts` header JSDoc lines 2-64 | File exists. JSDoc explicitly enumerates 13 `it`-blocks across 6 `describe` groups (Pricing-quartet, String-balance cluster, urStoa pair, validateLiquidity mixed-shape, getMaxBuyMovieBooster, Magic-string elimination). v3.3.4 commit `d93b305`. |
| REQ-24 | F-TEST-007 | CLOSED-VERIFIED | `packages/stoa-core/src/reads/pactReader.ts:42: export class InvalidPactReaderError extends TypeError` + `pactReader.ts:103: if (typeof reader !== "function") {` | `InvalidPactReaderError` class declared at lines 42-52. `typeof` guard in `setPactReader` at lines 102-107 throws the class on non-function input. v3.3.7 commit `a4c1bda`. |

## Tier 3d/3e — Phase 7 LITE catch-up (REQ-25..REQ-33)

| REQ | Task | Description | Status | Evidence |
|-----|------|-------------|--------|----------|
| REQ-25 | T7.5 | 7 vendor-fidelity test files in `packages/kadena-stoic-legacy/tests/` | STILL-OPEN | All 7 target files absent (only `copy-vendor-rewrite.test.ts` present). Baseline-snapshot files present: `pact-builder/` = 10, `cryptography-utils/` = 4, `hd-wallet/` = 4, `signing/` = 2 → total 20 of 20 expected exist. |
| REQ-26 | T7.6 | Self-exclusion regression-lock `it`-block in both no-kadena-imports tests | STILL-OPEN | Both files exist (`stoa-core` line 38/62, `ouronet-core` line 44/62: `SELF` constant + `if (basename(full) === SELF) continue`). Self-exclusion logic is inline skip code only — no dedicated `it("self-exclusion regression-lock ...")` block in either file. |
| REQ-27 | T7.7 | 2 cross-package tests in `packages/ouronet-core/tests/` | STILL-OPEN | `v4-1-1-full-chain-integration.test.ts` ABSENT. `v4-1-1-cross-package-version-pin.test.ts` ABSENT. |
| REQ-28 | T7.8 | 7 build-artifact validity test files (3 dist-structure + 3 esm-roundtrip + 1 no-side-effects) | STILL-OPEN | All 7 absent: `{stoa-core,ouronet-core,kadena-stoic-legacy}/tests/v4-1-1-dist-structure.test.ts` (3 ABSENT), `{stoa-core,ouronet-core,kadena-stoic-legacy}/tests/v4-1-1-esm-roundtrip.test.ts` (3 ABSENT), `kadena-stoic-legacy/tests/v4-1-1-no-side-effects.test.ts` (1 ABSENT). |
| REQ-29 | T7.9 | 2 type-preservation test files | STILL-OPEN | `packages/stoa-core/tests/v4-1-1-type-preservation.test.ts` ABSENT. `packages/ouronet-core/tests/v4-1-1-type-preservation.test.ts` ABSENT. |
| REQ-30 | T7.12 | migration-doc-validity + doc-gates tests (`[BLOCKS-ON-PHASE-8]`) | STILL-OPEN | `packages/ouronet-core/tests/v4-1-1-migration-doc-validity.test.ts` ABSENT. `packages/ouronet-core/tests/v4-1-1-doc-gates.test.ts` ABSENT. Blocked on Phase 8 MIGRATION-v4.1.md v4.1.1 appendix. |
| REQ-31 | T7.13 | `scripts/` directory + 2 sh+ps1 publish-guard scripts | STILL-OPEN | `Z:\OuronetCore\scripts\` directory ABSENT → all 6 expected script files missing. |
| REQ-32 | T7.14 | 2 sh+ps1 validation scripts in `scripts/` | STILL-OPEN | `scripts/` directory ABSENT → both script files missing. |
| REQ-33 | T7.15 | 2 sh+ps1 snapshot-update scripts in `scripts/` | STILL-OPEN | `scripts/` directory ABSENT → both script files missing. |

## Phase Consumption Guide

For per-phase planners — which phase closes which REQ:
- **Phase 1** ↔ REQs 01-04 (Tier 1 HIGH bugs)
- **Phase 2** ↔ REQs 07-12 (Tier 3a SEC+BUG; REQ-10 verification only)
- **Phase 3** ↔ REQs 13-18 (Tier 3b API+ARCH; REQ-17 lock-test only)
- **Phase 4** ↔ REQs 19-24 (Tier 3c — all CLOSED-VERIFIED; verification only + REQ-19 new lock-test)
- **Phase 5** ↔ REQs 05-06 (Tier 2 high-ROI tests)
- **Phase 6** ↔ REQs 25-27 (Tier 3d vendor-fidelity + cross-package integration)
- **Phase 7** ↔ REQs 28-33 (Tier 3e build/type/doc/scripts)
- **Phase 8** ↔ version bump + MIGRATION-v4.1.md v4.1.1 appendix (no direct REQ closure but produces content REQ-30 depends on)

## Skip These REQs (CLOSED-VERIFIED)

- REQ-10 (F-BUG-005, dalos error re-exports — closed v3.1.1 `bacaf79`)
- REQ-17 (F-ARCH-012, dalos quote/extension drift — closed v3.3.8 `8f92ad8`) `[LOCK-TEST-DEFERRED]`
- REQ-19 (F-PERF-003, coilFunctions memoization — closed v3.3.6 `f886541`)
- REQ-20 (F-PERF-004, Promise.all parallelization — closed v3.3.6 `f886541`)
- REQ-21 (F-TEST-001, gas test strict — closed v3.1.1 `bacaf79`)
- REQ-22 (F-TEST-004, schnorr coverage — closed v3.1.1 `bacaf79`)
- REQ-23 (F-TEST-005, success-paths — closed v3.3.4 `d93b305`)
- REQ-24 (F-TEST-007, InvalidPactReaderError — closed v3.3.7 `a4c1bda`)

## Investigate at Plan-Time (NEEDS-VERIFICATION)

(none — all REQs classified as CLOSED-VERIFIED or STILL-OPEN)

## Lock-Test Deferred

- REQ-17 — Source-side closed (v3.3.8 `8f92ad8`) but no regression-lock test exists. Phase 3 authors `packages/stoa-core/tests/v4-1-1-dalos-import-style.test.ts`.

## Blocks on Later Phases

- REQ-30 → `[BLOCKS-ON-PHASE-8]` — Phase 7's `v4-1-1-migration-doc-validity.test.ts` depends on Phase 8 producing the MIGRATION-v4.1.md v4.1.1 appendix. Phase 8 T8.11 produces the appendix; Phase 8 also flips the `it.todo` in the test file (per cross-plan F-002 fix).
