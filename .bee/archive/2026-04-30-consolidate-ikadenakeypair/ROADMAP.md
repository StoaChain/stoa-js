# Roadmap: Consolidate IKadenaKeypair

## Phase-Requirement Mapping

| Phase | Goal | Requirements | Success Criteria |
|-------|------|-------------|------------------|
| 1. Type Consolidation | Single canonical `IKadenaKeypair` declaration with all duplicates routed through it; `coilFunctions.ts` import block contiguous; Phase-2b copy marked deprecated; F-INT-001 IKadenaKeypair half resolved | REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12 | 1. Only `signing/types.ts` and `ouroFunctions.ts` declare `interface IKadenaKeypair` (verified by grep). 2. Each previously-duplicating subpath imports the canonical via `import type { IKadenaKeypair } from "../signing";`. 3. `seedType: "foreign"` literal is assignable to objects passed through each affected `interactions/*` function. 4. `npm run typecheck` and `npm test` pass with zero new errors / regressions. |
| 2. Type-Level Regression Lock | Cross-subpath type assignability is verified by a dedicated test file that breaks the build if drifted duplicates reappear | REQ-13 | 1. `tests/types.test.ts` exists with assignability assertions across the five subpaths (activate, dex, kpay, coil, signing). 2. The test asserts both `seedType: "foreign"` literal compatibility and `encryptedSecretKey: unknown` typing. 3. `npm test` passes with the new test cases on top of the pre-existing 320. 4. Re-introducing a local `IKadenaKeypair` duplicate on any of the five subpaths would cause the test to fail-compile (verifiable by a manual experiment during review). |

## Coverage Validation

- Total requirements: 13
- Mapped: 13
- Unmapped: 0

All 13 functional requirements from `requirements.md` are mapped across the 2 phases. Non-functional requirements (typecheck pass, test stability, public-API stability, build artifact) are not assigned IDs but inform the success criteria of both phases.

## Phase Details

### Phase 1: Type Consolidation
**Goal:** All `IKadenaKeypair` references resolve to a single canonical declaration in `src/signing/types.ts`. The Phase-2b copy in `ouroFunctions.ts` stays in place but gains an `@deprecated` JSDoc. The `coilFunctions.ts` non-exported `IOuroAccountKeypair` duplicate is removed (collateral cleanup), and that file's import block is restructured to be contiguous at the top.

**Requirements:** REQ-01 through REQ-12 (all source-code edits)

**Success Criteria** (what must be TRUE when this phase completes):
1. `grep -rn "interface IKadenaKeypair" src/` returns exactly two hits: `signing/types.ts:22-30` (canonical) and `ouroFunctions.ts:812-818` (Phase-2b copy with new `@deprecated` JSDoc).
2. Each of `activateFunctions.ts`, `dexFunctions.ts`, `kpayFunctions.ts`, `coilFunctions.ts` carries `import type { IKadenaKeypair } from "../signing";` and references that import-bound type rather than a local declaration.
3. `addLiquidityFunctions.ts:10`, `guardFunctions.ts:13`, and `wrapFunctions.ts:18` use `import type` and route `IKadenaKeypair` through `../signing` (the value-position-to-type-position switch).
4. `coilFunctions.ts` import block is contiguous: lines 1–N are all `import` statements, no interface declarations interspersed.
5. `npm run typecheck` passes with zero new errors. `npm test` passes all 320 existing tests with zero regressions. `npm run build` produces a clean `dist/`.

### Phase 2: Type-Level Regression Lock
**Goal:** A dedicated test file asserts cross-subpath assignability of the consolidated `IKadenaKeypair`, locking the consolidation in place against future drift.

**Requirements:** REQ-13 (the new `tests/types.test.ts`)

**Success Criteria** (what must be TRUE when this phase completes):
1. A new file `tests/types.test.ts` exists.
2. The file asserts `IKadenaKeypair` assignability through each of 5 subpaths. The canonical `../src/signing` site uses a direct `import type { IKadenaKeypair }`. The four interactions subpaths use `Parameters<typeof fn>[N]` (or `Parameters<typeof fn>[0]["fieldName"]` for struct-wrapped variants) against an exported function whose call surface consumes `IKadenaKeypair` — because Phase 1's `import type` is consumption-only and does NOT re-export the type from those subpaths (a direct `import type { IKadenaKeypair } from "../src/interactions/<sub>"` would fail with `TS2305`).
3. For each of the 5 sites, an assignability assertion confirms that an object literal carrying `seedType: "foreign"` (and an `encryptedSecretKey` typed `unknown`) is assignable to the resolved `IKadenaKeypair` type. If a future change reintroduces a drifted local `IKadenaKeypair` on any of the 4 affected subpaths, the corresponding `Parameters<typeof fn>[...]` resolves to the drifted shape and the assertion fails to typecheck.
4. `npm test` passes (320 + new test count) with no regressions.
5. Manual sanity-check during review: temporarily reintroducing a local `interface IKadenaKeypair` (without `"foreign"`) on any of the 4 affected subpaths causes the test file to fail to typecheck. Revert before commit.
