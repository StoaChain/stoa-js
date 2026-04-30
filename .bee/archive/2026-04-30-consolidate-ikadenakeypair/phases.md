# Phases: Consolidate IKadenaKeypair

## Overview

This spec is a tightly-scoped TypeScript type-graph refactor with no runtime code changes. The work splits cleanly into two logical phases: a consolidation phase that performs all source-file edits (deletions, re-imports, deprecation marker, import reordering), and a verification phase that adds a dedicated type-level test to lock the consolidation in place. The two-phase split keeps the source edits and the regression-lock test reviewable as separate, independently-verifiable units. Each phase is independently buildable and produces a green typecheck and test run on its own.

## Phase 1: Type Consolidation

**Description:** Delete every undocumented duplicate of `IKadenaKeypair`, route every consumer to the canonical declaration through type-only imports, mark the Phase-2b backwards-compat copy as deprecated, and clean up the `coilFunctions.ts` import block. After this phase the type graph has a single canonical home and the `IKadenaKeypair` half of the F-INT-001 cycle is broken.

**Outcome:** The four undocumented duplicate declarations are gone. The Phase-2b copy in `ouroFunctions.ts` is preserved with an `@deprecated` JSDoc tag. Every previously-duplicating or value-position-importing site resolves `IKadenaKeypair` from `../signing` via a type-only import. The `coilFunctions.ts` import block is contiguous at the top of the file. `npm run typecheck`, `npm test` (existing 320 tests), and `npm run build` all pass.

**Scope (in):**
- Removal of the four undocumented `interface IKadenaKeypair` declarations from `activateFunctions.ts`, `dexFunctions.ts`, `kpayFunctions.ts`, and `coilFunctions.ts`.
- Removal of the non-exported `interface IOuroAccountKeypair` declaration from `coilFunctions.ts:9-13`.
- Addition of type-only `IKadenaKeypair` imports from `../signing` to each of the four affected files.
- Addition of a type-only `IOuroAccountKeypair` import from `./ouroFunctions` to `coilFunctions.ts`.
- Reordering of imports in `coilFunctions.ts` so all import statements form a single contiguous block at the top of the file.
- Conversion of three value-position imports to type-only imports routed through `../signing`: `addLiquidityFunctions.ts:10` (with the import line split so `IOuroAccountKeypair` keeps its `./dexFunctions` source), `guardFunctions.ts:13`, and `wrapFunctions.ts:18`.
- Addition of an `@deprecated` JSDoc tag above the Phase-2b declaration at `ouroFunctions.ts:812-818`, referencing the canonical at `src/signing/types.ts` and the public subpath `@stoachain/ouronet-core/signing`.

**Deliverables:**
- Updated `src/interactions/activateFunctions.ts` — duplicate removed, type-only canonical import added.
- Updated `src/interactions/dexFunctions.ts` — duplicate removed, type-only canonical import added.
- Updated `src/interactions/kpayFunctions.ts` — duplicate removed, type-only canonical import added.
- Updated `src/interactions/coilFunctions.ts` — both local interface declarations removed, two type-only imports added, full import block reordered to be contiguous at the top of the file.
- Updated `src/interactions/addLiquidityFunctions.ts` — value-position import split into a `./dexFunctions` source for `IOuroAccountKeypair` and a type-only `../signing` source for `IKadenaKeypair`.
- Updated `src/interactions/guardFunctions.ts` — type-only `IKadenaKeypair` import from `../signing`.
- Updated `src/interactions/wrapFunctions.ts` — type-only `IKadenaKeypair` import from `../signing`.
- Updated `src/interactions/ouroFunctions.ts` — `@deprecated` JSDoc on the Phase-2b `IKadenaKeypair` declaration; the declaration itself unchanged.
- Green `npm run typecheck`, `npm test`, and `npm run build` runs on the modified tree.

**Out of scope (deferred):**
- The new `tests/types.test.ts` regression-lock file — Phase 2.
- Any consolidation of the triple-source `IOuroAccountKeypair` problem in `dexFunctions.ts:25-29` and `kpayFunctions.ts:22-26` — deferred to a future spec per Non-Goals.
- The `IOuroAccountKeypair` half of the F-INT-001 circular dependency — deferred with the broader `IOuroAccountKeypair` consolidation.
- Any `package.json` version bump or `CHANGELOG.md` edit — handled at release time, not as a deliverable inside the spec.

**Dependencies:** None (first phase).

## Phase 2: Type-Level Regression Lock

**Description:** Add a dedicated type-level test file that asserts cross-subpath assignability of the consolidated `IKadenaKeypair`. The test is the regression lock that prevents future drift from reintroducing local duplicates that omit `seedType: "foreign"` or weaken `encryptedSecretKey` back to `any`.

**Outcome:** A new test file exists and passes. The file asserts that an object literal carrying `seedType: "foreign"` is assignable to a function parameter typed as `IKadenaKeypair` resolved from each of the previously-duplicating subpaths and the canonical subpath. If any future change reintroduces a drifted local declaration on any of those subpaths, the test fails to type-check and the build breaks.

**Scope (in):**
- Creation of a single new test file dedicated to type-level / public-API assertions.
- Type-level assignability assertions for `IKadenaKeypair` resolved from each of: `src/interactions/activateFunctions`, `src/interactions/dexFunctions`, `src/interactions/kpayFunctions`, `src/interactions/coilFunctions`, and the canonical `src/signing` subpath.
- The assertion specifically exercises the `seedType: "foreign"` literal and (where applicable) the `encryptedSecretKey: unknown` typing — the two attributes that distinguished the canonical from the deleted duplicates.

**Deliverables:**
- New file `tests/types.test.ts` containing the type-level assignability assertions described above.
- Green `npm test` run including the new test cases on top of the pre-existing 320 tests.
- Green `npm run typecheck` and `npm run build` runs confirming the new file integrates cleanly.

**Out of scope (deferred):**
- Modifications to `tests/strategy.test.ts` — that file is read-only reference for conventions, per Requirements.
- Any behavioural / runtime tests of signing flows — `tests/types.test.ts` is type-level only.
- Future cross-subpath type tests for other types (e.g. `IOuroAccountKeypair`) — the file is the home for them when those specs land, but adding them is not part of this spec.

**Dependencies:** Phase 1 (the consolidated type graph must be in place before the regression-lock test is meaningful — otherwise the test would assert against the drifted shapes and pass spuriously, or against the canonical shape and fail to compile).
