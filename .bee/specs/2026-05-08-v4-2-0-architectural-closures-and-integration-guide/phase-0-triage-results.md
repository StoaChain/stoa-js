# Phase 0 Triage Results — v4-2-0-architectural-closures-and-integration-guide

**Date:** 2026-05-08
**HEAD commit SHA:** 5b8d7d5d7050330527d54fa8a7d6ac6bf66b8313
**Total Tier 4 candidates:** 11 (4 CLOSED-VERIFIED + 2 PARTIAL + 4 STILL-OPEN + 1 BREADTH-GAP)
**Mode:** READ-ONLY (no source / configuration / package modifications)

The matrix below is the input contract for Phases 1-9. Per-phase planners read it to skip CLOSED-VERIFIED items and focus on STILL-OPEN / PARTIAL / BREADTH-GAP work. The starting-state baseline records exact integers (versions, peer-deps, typecheck exits, vitest pass counts) so Phase 9's NFR-02 delta computation has a precise reference.

## Starting-state baseline (REQ-02 verification gate)

### Package versions (verbatim `version` lines)

- `packages/kadena-stoic-legacy/package.json:3` → `"version": "4.1.1",`
- `packages/stoa-core/package.json:3` → `"version": "4.1.1",`
- `packages/ouronet-core/package.json:3` → `"version": "4.1.1",`

All three packages declare `"version": "4.1.1"`. No drift.

### Peer-dependency declarations (verbatim, internal alignment)

- `packages/stoa-core/package.json:82` → `"@stoachain/kadena-stoic-legacy": "4.1.1",`
- `packages/ouronet-core/package.json:51` → `"@stoachain/kadena-stoic-legacy": "4.1.1",`
- `packages/ouronet-core/package.json:52` → `"@stoachain/stoa-core": "4.1.1"`

All cross-package peer-dep pins resolve to `"4.1.1"`. Internal alignment confirmed; no STILL-OPEN baseline-misalignment finding.

### Per-package typecheck exit codes (`npx tsc --noEmit`)

| Package | Command | Exit code |
|---|---|---:|
| kadena-stoic-legacy | `npx tsc --noEmit` (in `packages/kadena-stoic-legacy/`) | **0** |
| stoa-core | `npx tsc --noEmit` (in `packages/stoa-core/`) | **0** |
| ouronet-core | `npx tsc --noEmit` (in `packages/ouronet-core/`) | **0** |

All three typechecks exit 0 cleanly. No type errors in v4.1.1 source surface.

### Per-package vitest pass-count baseline (REQ-02, NFR-02 input)

EXACT integer pass counts captured from vitest summary lines (`Tests N passed (N)`). NOT "roughly 1000" — Phase 9's NFR-02 delta computation requires the exact integer.

| Package | Test files (count) | Vitest summary line | Pass count |
|---|---:|---|---:|
| kadena-stoic-legacy | 13 | `Test Files  13 passed (13) / Tests  55 passed (55)` | **55** |
| stoa-core | 42 | `Test Files  42 passed (42) / Tests  630 passed (630)` | **630** |
| ouronet-core | 35 | `Test Files  36 passed (36) / Tests  363 passed (363)` (the 36th counted file is the typecheck-companion entry for `tests/types.test.ts`; on-disk `*.test.ts` glob = 35) | **363** |
| **Aggregate** | **90** | sum of three packages | **1048** |

Snapshot expectation per `requirements.md:78` is "~1000 specs"; actual aggregate is **1048 passes** across **90 unique on-disk test files** (vitest summary file count = 91 because the typecheck-companion entry for `ouronet-core/tests/types.test.ts` is counted once as a regular file and once as a `TS` typecheck file by vitest 4.1.5).

### Idempotent re-run check (Phase 0 contract)

`git status --porcelain | awk '$2 !~ /^\.bee\/specs\/2026-05-08-v4-2-0-architectural-closures-and-integration-guide\// {print}'` returns empty after Phase 0. Phase 0 produced ZERO modifications outside the spec directory; idempotent re-run confirmed.

## Executive Summary

| Finding | Audit code | Phase target | Classification | One-line note |
|---|---|---|---|---|
| F-ARCH-006 | F-ARCH-006 | -- | CLOSED-VERIFIED | cfmBuilders parallel implementation became canonical via `packages/ouronet-core/src/pact/index.ts:11` re-export + tests; no v4.2.0 action |
| F-ARCH-008 | F-ARCH-008 | -- | CLOSED-VERIFIED | CodexSigningStrategy full integration test landed at `packages/stoa-core/tests/strategy.test.ts`; v4.1.1 Phase 2 added Σ-prefix guard at execute() entry |
| F-ARCH-010 | F-ARCH-010 | -- | CLOSED-VERIFIED | pension/urStoa imports IKadenaKeypair canonically from `@stoachain/stoa-core/signing`; deprecated ouroFunctions copy no longer referenced |
| F-ARCH-011 | F-ARCH-011 | -- | CLOSED-VERIFIED | normalizeKeysetRef deep-import closed in v3.3.8 with regression-lock at `tests/v3-3-8-doc-cleanup.test.ts:T2` |
| F-API-002 | F-API-002 | Phase 4 | PARTIAL | 10 functions in dexFunctions.ts declare Promise of T or null but catches structurally rethrow; try/catch skeleton plus or-null declarations closed, structural rethrow open |
| F-TEST-002 | F-TEST-002 | Phase 6 | PARTIAL | 3 of 4 dispatcher branches covered (koala/chainweaver/eckowallet); seedType foreign literal fixture missing in tests/universal-sign.test.ts |
| F-ARCH-001 | F-ARCH-001 | Phase 1 | STILL-OPEN | dexFunctions.ts at 2663 LOC and 119 exports; 15 banner natural split boundaries confirmed; entity-oriented split required (7-entity Ouronet taxonomy) |
| F-ARCH-002 | F-ARCH-002 | Phase 2 | STILL-OPEN | ouroFunctions.ts at 2486 LOC and 60 exports; entity split plus chain/UI surgical separation of primordials cluster (~388 LOC at lines 325-712) |
| F-ARCH-003 | F-ARCH-003 | Phase 3 | STILL-OPEN | addLiquidityFunctions.ts at 693 LOC; 5 execute pipelines (lines 236/337/351/556/627) totaling ~366 LOC of 95% identical validate-simulate-sign-submit-handle pipeline |
| F-API-018 | F-API-018 | Phase 5 | STILL-OPEN | aggregate corrected gap of approximately 94-97 readonly modifiers missing across stoa-core plus ouronet-core public-type surface (audit said ~85; same magnitude) |
| F-TEST-006 | F-TEST-006 | Phase 7 | BREADTH-GAP | 38 untested exports across 6 modules (audit said 37; describeKeyset call-shape grep returns 0 — counts as untested-at-runtime); v3.x happy-path absence-of-tests half closed in v3-3-5-smoke.test.ts, remaining gap is breadth |

## Pre-classified CLOSED-VERIFIED rows (no v4.2.0 action required)

The four CLOSED-VERIFIED findings need no further work in this spec. Cited closure references:

| Finding | Closure version | Closure citation |
|---|---|---|
| F-ARCH-006 | v3.x (canonical adoption) | `packages/ouronet-core/src/pact/index.ts:11` re-export of cfmBuilders + `tests/cfm-builders.test.ts` (42 tests) |
| F-ARCH-008 | v4.1.1 Phase 2 | `packages/stoa-core/tests/strategy.test.ts` (CodexSigningStrategy integration test); Σ-prefix guard added to `execute()` entry per archived v4.1.1 REQ-11 (F-BUG-008) |
| F-ARCH-010 | v3.x (canonical migration) | `packages/ouronet-core/src/interactions/pensionFunctions.ts:12` and `coilFunctions.ts:13` import `IOuroAccountKeypair` via type-only relative paths; deprecated copies no longer canonical |
| F-ARCH-011 | v3.3.8 | regression-lock at `packages/ouronet-core/tests/v3-3-8-doc-cleanup.test.ts` |

## Per-finding sections

The following sections reproduce the verbatim per-finding tables from the 6 Wave-1 fragment files. These per-finding sub-tables also start rows with `| F-XXX-NNN |`; the integrity gate at the bottom of this document is scoped to the Executive Summary section ONLY (`/^## Executive Summary/,/^## /` awk range) to avoid counting fragment-table rows.

### F-ARCH-001 — dexFunctions.ts entity-oriented split (STILL-OPEN)

| Finding | Audit code | Classification | Evidence (file:line + line/export counts) | Notes |
|---|---|---|---|---|
| dexFunctions.ts god-file (entity-oriented split required, 7-entity Ouronet taxonomy: TF/OF/Semi/Non/ASP/SWP/AP) | F-ARCH-001 | STILL-OPEN | `packages/ouronet-core/src/interactions/dexFunctions.ts` — `wc -l` reports **2663 lines**; `grep -c '^export'` reports **119 export statements**. Both numbers match the audit-stated v4.1.1 snapshot at `requirements.md:34` verbatim. | No `export * from "./dex*"` thin-shim re-exports present. 15 section-banner natural split boundaries confirmed at lines 369/450/526/751/803/1092/1553/1743/2237/2294/2327/2377/2523/2564/2630. Sole internal sibling consumer: `addLiquidityFunctions.ts:10` (importing `IOuroAccountKeypair`). |

Banner enumeration confirmed via combined regex `^// (==|──)` — 6 ASCII-bordered blocks (lines 369-1094) + 9 em-dash single-line markers (lines 1553-2630) = 15 unique banner blocks. Zero drift from snapshot.

External-consumers list (source vs test split):
- Source consumers (1): `packages/ouronet-core/src/interactions/addLiquidityFunctions.ts:10`
- Test consumers (5 files, 7 import sites): `tests/interactions-balance-cluster.test.ts:52`, `tests/interactions-logger-parity.test.ts:19`, `tests/interactions-pricing.test.ts:31`, `tests/types.test.ts:45,51,73`, `tests/v3-3-4-success-paths.test.ts:109`

Phase 1 split has zero blast radius beyond the documented internal-import update (REQ-06) plus test-file path updates.

### F-ARCH-002 — ouroFunctions.ts split + chain/UI surgical separation (STILL-OPEN)

| Finding | Audit code | Classification | Evidence (file:line + line/export counts) | Notes |
|---|---|---|---|---|
| ouroFunctions.ts god-file (two closure dimensions: entity-oriented split + chain/UI surgical separation of primordials cluster) | F-ARCH-002 | STILL-OPEN | `packages/ouronet-core/src/interactions/ouroFunctions.ts` — `wc -l` reports **2486 lines**; `grep -c '^export'` reports **60 export statements**. Audit stated 61 at `requirements.md:35`; actual is 60 (the "~unchanged" delta is +/-1 export, reconciled). | TWO closure dimensions both STILL-OPEN: (a) entity split into `ouroAccountFunctions.ts` / `ouroPrimordialsFunctions.ts` / `ouroSubCompressFunctions.ts` / `ouroWrapFunctions.ts` etc. per `requirements.md:174-185`; (b) surgical chain/UI separation of `getPrimordials` (line 325) / `parseResponse` / `buildPlaceholderPrimordials` (line 671) cluster (~388 LOC at lines 325-712). |

Tail-block re-exports captured verbatim at lines 1724-1747 — 14 symbols across `./coilFunctions` (5), `./pensionFunctions` (2), `./infoOneFunctions` (7 incl. `type TransferPreviewData`):

```ts
// Export new coiling functions for AURYN and WSTOA
export {
  getAurynCoilPreview,
  coilAurynToElite,
  getWkdaCoilPreview,
  coilWkdaToLkda,
  COIL_CONFIGS
} from "./coilFunctions";

// Export pension functions for WSTOA and SSTOA
export {
  brumateWkdaToPkda,
  constrictLkdaToPkda
} from "./pensionFunctions";

// Export INFO-ONE preview functions
export {
  getTransferPreview,
  getCoilPreviewInfo,
  getCurlPreviewInfo,
  getBrumatePreviewInfo,
  getConstrictPreviewInfo,
  parseTransferPreview,
  type TransferPreviewData
} from "./infoOneFunctions";
```

These 14 re-exports must round-trip identically through the Phase 2 thin-shim layer (REQ-11). Drift between this Phase 0 capture and Phase 2 implementation = regression risk.

Internal sibling consumers (type-only imports of `IOuroAccountKeypair`):
- `packages/ouronet-core/src/interactions/coilFunctions.ts:13`
- `packages/ouronet-core/src/interactions/pensionFunctions.ts:12`

Test consumers (8 files, 9 import sites) listed in `phases/00-pre-fix-audit-triage/tier-arch-002-fragment.md`.

### F-ARCH-003 — addLiquidityFunctions.ts parameterized executor (STILL-OPEN)

| Finding | Audit code | Classification | Evidence (file:line + line/export counts) | Notes |
|---|---|---|---|---|
| addLiquidityFunctions.ts 5 duplicated `execute*` pipelines (95% identical: validate → simulate → sign → submit → handle response) | F-ARCH-003 | STILL-OPEN | `packages/ouronet-core/src/interactions/addLiquidityFunctions.ts` — `wc -l` reports **693 lines** (post-shrink figure; audit-stated 1031 LOC was pre-shrink). 5 `execute*` exports confirmed at lines 236, 337, 351, 556, 627. The `executeAddLiquidity` wrapper precedent at line 337 still wraps `executeAddLiquiditySingle` — confirms parameterization is feasible. | Phase 3 collapses ~366 LOC across 5 pipelines into one `executeLiquidityOp(opts)` internal with parameter shape locked at `requirements.md:194-198` (`pactCode` / `signers` / `gasPolicy` / `errorPrefix`). The 5 public exports remain as thin wrappers (REQ-16). |

Per-function executor sub-table (Phase 3 planning input):

| # | Function | Line range | Approx LOC | Pact code template | Gas policy flavor | Catch shape |
|---|---|---:|---:|---|---|---|
| 1 | `executeAddLiquiditySingle` | 236-336 | 101 | `${KADENA_NAMESPACE}.TS01-C3.SWP\|C_AddLiquidity ...` | adaptive: `tokenCount * 100_000` default → simulate → `calculateAutoGasLimit` rebuild | rethrow |
| 2 | `executeAddLiquidity` | 337-350 | 14 | wrapper — delegates to `executeAddLiquiditySingle` | inherits | rethrow with `"Add liquidity execution failed"` |
| 3 | `executeSpecialAddLiquidity` | 351-463 | 113 | `${KADENA_NAMESPACE}.TS01-C3.SWP\|C_AddLiquidity*Special ...` (variants for iced/glacial/frozen/sleeping) | adaptive | rethrow |
| 4 | `executeFuel` | 556-626 | 71 | `${KADENA_NAMESPACE}.TS01-C3.SWP\|C_Fuel ...` | adaptive | rethrow |
| 5 | `executeRemoveLiquidity` | 627-693 | 67 | `${KADENA_NAMESPACE}.TS01-C3.SWP\|C_RemoveLiquidity ...` | adaptive (auto-gas-limit, fixed-5k buffer) | rethrow with `"Remove liquidity execution failed"` (line 691) |

Total executor LOC: 101 + 14 + 113 + 71 + 67 = **366 LOC**. Phase 3 target (REQ-16): collapse to ~200 LOC in `executeLiquidityOp` + 5 thin wrappers (~50 LOC total) → ~250 LOC, a ~115 LOC reduction (-31%).

### F-API-002 — 10 functions honor declared `Promise<T | null>` contract (PARTIAL)

| Finding | Audit code | Classification | Evidence | Notes |
|---|---|---|---|---|
| 10 dashboard/calculator functions in `dexFunctions.ts` declare `Promise<T \| null>` but catches STRUCTURALLY RETHROW instead of returning `null` — type contract is a lie | F-API-002 | PARTIAL | All 10 catches present (skeleton closed). All 10 declared returns include `\| null` (contract closed). All 10 catches rethrow (open half). Aggregate `grep -c 'throw error instanceof Error' packages/ouronet-core/src/interactions/dexFunctions.ts` returns **20** total hits — 10 of those 20 are on the F-API-002 functions; the other 10 are on non-nullable functions (correct rethrow, out of scope). | Zero internal callers across `packages/*/src/`. Consumer impact is purely external (HUB / OuronetUI). Phase 4 (REQ-18 → REQ-20) is a pure surface-level fix with no internal blast radius. |

Per-function inspection sub-table (Phase 4 planning input):

| # | Function | Line | Return type | Catch message | Internal callers? | Per-function classification |
|---|---|---:|---|---|---:|---|
| 1 | `getSWPairDashboardInfo` | 279 | `Promise<SwapPoolData \| null>` | `"Unknown error occurred"` (lines 304-306) | 0 | OPEN-rethrow |
| 2 | `getPoolPreviewData` | 313 | `Promise<PoolPreviewData \| null>` | `"Unknown error occurred"` (338-340) | 0 | OPEN-rethrow |
| 3 | `getSWPairMultiDashboardInfo` | 346 | `Promise<SwapPoolData[] \| null>` | `"Unknown error occurred"` (364-366) | 0 | OPEN-rethrow |
| 4 | `getSwpairInternalDashboard` | 534 | `Promise<SwpairInternalDashboard \| null>` | `"Unknown error occurred"` (553-555) | 0 | OPEN-rethrow |
| 5 | `calculateDirectSwap` | 561 | `Promise<SwapCalculationResult \| null>` | `"Unknown error occurred"` (597-599) | 0 | OPEN-rethrow |
| 6 | `calculateInverseSwap` | 605 | `Promise<InverseSwapResult \| null>` | `"Unknown error occurred"` (634-636) | 0 | OPEN-rethrow |
| 7 | `calculateDirectSwapB` | 642 | `Promise<{ decimal: string } \| number \| null>` | `"Unknown error"` (660-662, variant style — `e` alias) | 0 | OPEN-rethrow |
| 8 | `calculateInverseSwapB` | 668 | `Promise<{ decimal: string } \| number \| null>` | `"Unknown error"` (682-684, variant style — `e` alias) | 0 | OPEN-rethrow |
| 9 | `getCappedInverseAmount` | 690 | `Promise<CappedInverseResult \| null>` | `"Unknown error occurred"` (713-715) | 0 | OPEN-rethrow |
| 10 | `getUserAccountSupplies` | 721 | `Promise<UserAccountSupplies \| null>` | `"Unknown error occurred"` (746-748) | 0 | OPEN-rethrow |

All 10 match the audit-stated structural shape from `requirements.md:105`. 8 use `"Unknown error occurred"`; 2 (`calculateDirectSwapB` / `calculateInverseSwapB`) use the shorter `"Unknown error"` and bind catch param as `e` (URC_0006b/URC_0007b "B" variants — newer additions, structurally identical rethrow). Phase 4 changes 10 catch bodies to `return null;` and adds `tests/v4-2-0-nullable-contract-honored.test.ts` per REQ-19.

### F-API-018 — aggressive readonly sweep (STILL-OPEN)

| Finding | Audit code | Classification | Evidence | Notes |
|---|---|---|---|---|
| ~85 public-type fields lack `readonly` modifiers across stoa-core + ouronet-core | F-API-018 | STILL-OPEN | Per-file two-grep readonly-coverage table below. Aggregate corrected gap = **~94-97 readonly modifiers missing** across the v4.1.1 source surface (snapshot at `requirements.md:42` says "~85 confirmed"; corrected aggregate is in the same magnitude — within audit tolerance). | New entity-oriented files born in Phases 1-2 are authored with `readonly` from inception per REQ-21 last-bullet, so the Phase 0 baseline measures the pre-split god-files; Phase 5's actual sweep surface depends on Phases 1-2 outputs. Pact format brand types `ValidatedDecimal` / `ValidatedInteger` confirmed already-readonly at `packages/stoa-core/src/pact/format.ts:59,69`. |

Per-file readonly-coverage table (corrected counts after manually subtracting nested-and-method false positives):

| File | Readonly count | Total typed-field count (raw grep) | Total typed-field count (corrected) | Gap |
|---|---:|---:|---:|---:|
| `packages/stoa-core/src/signing/types.ts` | 2 | 17 | 8 | 6 |
| `packages/stoa-core/src/wallet/types.ts` | 0 | 0 | 0 | 0 |
| `packages/stoa-core/src/guard/guardUtils.ts` | 0 | 36 | 18 | 18 |
| `packages/stoa-core/src/errors/transactionErrors.ts` | 0 | 23 | 8 | 8 |
| `packages/stoa-core/src/signing/universalSign.ts` | 0 | 21 | 5 | 5 |
| `packages/stoa-core/src/signing/partialSig.ts` | 2 | 30 | 6 | 4 |
| `packages/ouronet-core/src/codex/types.ts` | 0 | 14 | 15 | 15 |
| `packages/ouronet-core/src/interactions/addLiquidityFunctions.ts` (`*Params`) | 0 | 73 | 10 | 10 |
| `packages/ouronet-core/src/interactions/ouroFunctions.ts` (`UnwrapStoaParams`, `UnwrapUrStoaParams`) | n/a | n/a | 17 | 17 |
| `packages/stoa-core/src/wallet/KadenaWallet.ts` (class fields) | 0 | n/a | 8 | 8 |
| `packages/ouronet-core/src/interactions/dexFunctions.ts` (`IOuroAccountKeypair`) | 0 | n/a | 3 | 3 |

Aggregate readonly gap (corrected): 6 + 0 + 18 + 8 + 5 + 4 + 15 + 10 + 17 + 8 + 3 = **94 readonly modifiers missing**. Adding the duplicate `IOuroAccountKeypair` definitions in `ouroFunctions.ts:813` and `kpayFunctions.ts:18` (consolidation candidates) brings the practical post-consolidation gap to **~97**. Audit-stated "~85" at `requirements.md:42` is in the same magnitude (within tolerance).

### F-TEST-002 — universalSignTransaction foreign-key fixture gap (PARTIAL)

| # | seedType branch | Test fixture present? | Test file location | Routes through | Per-branch classification |
|---|---|---|---|---|---|
| 1 | `"koala"` | YES — block at lines 130-159 | `packages/stoa-core/tests/universal-sign.test.ts:131-159` | `universalSign.ts:94` falls through `isChainweaver` check → `naclPairs.push(...)` line 102 — nacl Ed25519 path | CLOSED |
| 2 | `"chainweaver"` | YES — block at lines 162-188 | `packages/stoa-core/tests/universal-sign.test.ts:162-188` | `isChainweaver` matches → `chainweaverPairs.push(kp)` line 100 — WASM kadenaSign path | CLOSED |
| 3 | `"eckowallet"` | YES — block at lines 190-211 | `packages/stoa-core/tests/universal-sign.test.ts:190-211` | Same as `"chainweaver"` (label-only difference) | CLOSED |
| 4 | `"foreign"` | NO `seedType: "foreign"` literal fixture exists. The file contains a "foreign branch" describe at lines 253-290 testing the `onMissingKey` callback path, NOT a keypair literally tagged `seedType: "foreign"` going through the nacl dispatcher. `grep -nE 'seedType:\s*"foreign"' packages/stoa-core/tests/universal-sign.test.ts` returns 0 matches. | (file lacks fixture) | Dispatcher routes correctly: `seedType: "foreign"` fails the `isChainweaver` predicate and falls through to `naclPairs.push(...)` (same path as koala). Shape is supported but not exercised. | OPEN — fixture missing |

Branch-fixture grep counts (from `seedType:\s*"<branch>"` regex):
- `seedType: "koala"`: 6 sites
- `seedType: "chainweaver"`: 2 sites
- `seedType: "eckowallet"`: 1 site
- `seedType: "foreign"`: **0 sites** — the F-TEST-002 gap

Phase 6 (REQ-25 + REQ-26) adds a single ~30-LOC fixture asserting equivalence with `"koala"` output for the same private-key value.

### F-TEST-006 — 6-module breadth coverage gap (BREADTH-GAP)

| Module | File path | Total exports | Tested | Untested | Names of untested |
|---|---|---:|---:|---:|---|
| `infoOneFunctions` | `packages/ouronet-core/src/interactions/infoOneFunctions.ts` | 23 | 1 | **22** | `getCurlPreviewInfo`, `getBrumatePreviewInfo`, `getConstrictPreviewInfo`, `getSublimateInfo`, `getCompressInfo`, `getFirestarterInfo`, `getTransferInfo`, `getRecoveryPrimordial`, `getColdRecoveryInfo`, `getDirectRecoveryInfo`, `getMaxRecoveryAmount`, `getCullInfo`, `getHibernatedNoncesDisplay`, `getAwakeInfo`, `getSlumberInfo`, `getClearDispoInfo`, `getInfoAddLiquidity`, `getInfoFuel`, `getInfoSinglePoolSwap`, `getInfoMultiPoolSwap`, `getInfoRemoveLiquidity`, `parseTransferPreview`, `getTransferPreview` |
| `coilFunctions` | `packages/ouronet-core/src/interactions/coilFunctions.ts` | 9 | 2 | **7** | `coilTokensGeneric`, `getCoilPreview`, `coilOuroToAuryn`, `getAurynCoilPreview`, `coilAurynToElite`, `getWkdaCoilPreview`, `coilWkdaToLkda` |
| `kpayFunctions` | `packages/ouronet-core/src/interactions/kpayFunctions.ts` | 4 | 1 | **3** | `getKpayAmountCosts`, `getKpayAcquireCapabilities`, `kpayBuy` |
| `pensionFunctions` | `packages/ouronet-core/src/interactions/pensionFunctions.ts` | 3 | 1 | **2** | `brumateWkdaToPkda`, `constrictLkdaToPkda` |
| `activateFunctions` | `packages/ouronet-core/src/interactions/activateFunctions.ts` | 3 | 1 | **2** | `getDeployStandardAccountInfo`, `executeDeployStandardAccount` |
| `guardFunctions` | `packages/ouronet-core/src/interactions/guardFunctions.ts` | 3 | 1-2 | **1-2** | `rotateGuard` is the explicit untested function per audit count of 1; `describeKeyset` has 0 call-shape grep hits and is also untested-at-runtime. Reconciled count = 2 untested. |

Aggregate untested exports across 6 modules — two views:
- **Audit-counted total: 22 + 7 + 3 + 2 + 2 + 1 = 37** (matches `requirements.md:44, 121` exactly when guardFunctions is treated as 1 untested with `describeKeyset` covered via type-checks).
- **Call-shape-grep-strict total: 22 + 7 + 3 + 2 + 2 + 2 = 38** (treating `describeKeyset` as untested-at-runtime because it has 0 call-shape grep hits in `packages/ouronet-core/tests/*.test.ts`).

Phase 7 plans against the **37-export audit count** as the canonical scoping number; the 38th (`describeKeyset`) gets covered as an opportunistic addition because its happy-path coverage cost is trivial (~3 LOC of `it`-block).

Smoke-test template confirmation (Phase 7 input): `packages/ouronet-core/tests/v3-3-5-smoke.test.ts` is well-formed and reusable. Pattern: `setPactReader(stub)` + `setLogger(spy)` + `afterEach(reset)`. `afterEach` reset present at line 116; `setLogger(spyLogger)` invocations at lines 155 and 254.

## Phase consumption guide

Per-phase REQ ranges and the finding each phase closes:

- **Phase 0** ↔ REQ-01, REQ-02 (this triage; READ-ONLY verification)
- **Phase 1** ↔ REQ-03..REQ-07 — F-ARCH-001 dexFunctions.ts entity-oriented split (7-entity Ouronet taxonomy)
- **Phase 2** ↔ REQ-08..REQ-13 — F-ARCH-002 ouroFunctions.ts split + chain/UI surgical separation of primordials cluster
- **Phase 3** ↔ REQ-14..REQ-17 — F-ARCH-003 addLiquidityFunctions.ts parameterized executor (5 pipelines → 1 internal + 5 thin wrappers)
- **Phase 4** ↔ REQ-18..REQ-20 — F-API-002 nullable contract: 10 catches change from rethrow to `return null`
- **Phase 5** ↔ REQ-21..REQ-24 — F-API-018 aggressive readonly sweep across ~85-97 public-type fields
- **Phase 6** ↔ REQ-25..REQ-26 — F-TEST-002 foreign-key fixture (`seedType: "foreign"` branch)
- **Phase 7** ↔ REQ-27..REQ-30 — F-TEST-006 coverage expansion (~110 new specs across 6 modules)
- **Phase 8** ↔ REQ-31..REQ-34 — INTEGRATION-GUIDE.md (cold-start consumer onboarding doc covering the v4.0/v4.1/v4.2 architectural arc)
- **Phase 9** ↔ REQ-35..REQ-41 — atomic version bump 4.1.1 → 4.2.0 + docs + final NFR gate (uses the 1048-pass aggregate baseline from this document for NFR-02 delta computation)

## Cross-phase content dependencies

Per-phase planners must respect these ordering constraints:

- **Phase 4 depends on Phase 1.** The 10 F-API-002 functions live in `dexFunctions.ts`; after the Phase 1 entity-oriented split they will live in the new `dexSwapPair*` / `dexCalculator*` files. Phase 4 patches catches in the post-split files, not the original god-file.
- **Phase 7 has soft dependency on Phase 2.** Some `infoOneFunctions` test imports may be touched during the ouro split (the tail-block re-exports at `ouroFunctions.ts:1739-1747` forward 7 `infoOneFunctions` symbols). Phase 7 test authors must coordinate import-path decisions with Phase 2's thin-shim re-export strategy (REQ-11).
- **Phase 8 depends on Phases 1, 2, 4, 5.** INTEGRATION-GUIDE.md cites the post-split file structure and the post-readonly type surface; it cannot be authored against an incomplete state.
- **Phase 9 depends on Phases 1-8.** Atomic version bump fires after ALL closures land. NFR-02 delta computation uses the 1048-pass baseline from this document.

## Skip these findings (CLOSED-VERIFIED — no v4.2.0 action)

- **F-ARCH-006** (cfmBuilders parallel impl became canonical) — no v4.2.0 work
- **F-ARCH-008** (CodexSigningStrategy integration test landed in v4.1.1 Phase 2) — no v4.2.0 work
- **F-ARCH-010** (pension/urStoa canonical import from `@stoachain/stoa-core/signing`) — no v4.2.0 work
- **F-ARCH-011** (normalizeKeysetRef closed in v3.3.8 with regression-lock) — no v4.2.0 work
