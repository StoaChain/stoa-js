# Specification: Consolidate IKadenaKeypair

## Overview

The `IKadenaKeypair` type — the signing-ready keypair contract consumed by every signing call site in `@stoachain/ouronet-core` — is currently declared in six places. Only `src/signing/types.ts:22-30` is canonical. `src/interactions/ouroFunctions.ts:812-818` is a documented Phase-2b backwards-compat copy. The remaining four declarations (in `activateFunctions`, `dexFunctions`, `kpayFunctions`, and `coilFunctions`) are undocumented, drifted duplicates — three exported, one (in `coilFunctions`) not exported and therefore invisible to find-references tooling.

The duplicates are not byte-identical with the canonical: they omit the `seedType: "foreign"` literal and type `encryptedSecretKey` as `any` rather than `unknown`. Today TypeScript treats them as structurally compatible, but any future field addition or any consumer that narrows on `seedType === "foreign"` turns the drift into a silent compile or runtime error on partial migrations.

This spec consolidates the type to a single canonical declaration. All four undocumented duplicates are deleted and replaced with type-only re-imports through the existing `src/signing` barrel. The Phase-2b copy in `ouroFunctions.ts` stays in place but gains an `@deprecated` JSDoc tag pointing to the canonical. Three sibling files that currently import the type in value-position from a peer `interactions` file are flipped to type-position imports routed through `../signing`. A new test file asserts that `seedType: "foreign"` is assignable across each previously-duplicating subpath, locking the consolidation in place.

Audit reference: **F-CORE-001 (CRITICAL)** in `.bee/AUDIT-REPORT.md` — merged from F-ARCH-001, F-INT-007, F-INT-011.

## Goals

- One canonical declaration of `IKadenaKeypair` lives at `src/signing/types.ts:22-30`. All other call sites resolve their `IKadenaKeypair` reference back to that single declaration via type-only imports.
- The four undocumented duplicate `interface IKadenaKeypair` declarations in the `interactions` layer are removed.
- Each previously-duplicating interactions subpath (`activateFunctions`, `dexFunctions`, `kpayFunctions`, `coilFunctions`) gains the `seedType: "foreign"` literal and the stricter `encryptedSecretKey: unknown` typing through the consolidation, with no behavioural regression.
- The documented Phase-2b copy in `ouroFunctions.ts` is preserved (root-barrel re-export consumers depend on its import path) but is clearly marked deprecated, pointing readers to the canonical.
- Three value-position imports of `IKadenaKeypair` from peer `interactions` files are converted to `import type` imports routed through `../signing`. As a side effect, the `IKadenaKeypair` half of the F-INT-001 circular dependency between `dexFunctions` and `addLiquidityFunctions` is broken.
- The `coilFunctions.ts` file's import block is contiguous at the top of the file (resolves the F-INT-011 interspersed-imports concern).
- A dedicated type-level test file asserts cross-subpath assignability of the consolidated type, preventing regression to drifted duplicates.

## Non-Goals

- Consolidating the triple-source `IOuroAccountKeypair` problem in `dexFunctions.ts:25-29` and `kpayFunctions.ts:22-26`. That type lacks a canonical home in `signing/types.ts` (it is interactions-domain, not signing-domain) and requires a separate decision about whether to add it to `signing/types.ts` or pin `ouroFunctions.ts` as canonical with documented Phase-2b status. The local `coilFunctions.ts:9-13` non-exported `IOuroAccountKeypair` duplicate IS removed in this spec (collateral cleanup, same file, same edit), but the broader triple-source problem is deferred.
- Resolving the full F-INT-001 circular-dep between `dexFunctions` and `addLiquidityFunctions`. Only the `IKadenaKeypair` half is broken by this spec; the `IOuroAccountKeypair` half remains until the deferred follow-up lands.
- Any other audit findings — failover wiring, error taxonomy, security hardening, codec hardening, `safeCreationTime` cleanup, etc. Those are tracked as separate specs in `.bee/audit-specs/`. This spec has **no blocking dependencies on, and no blockers for, the other 9 audit-spec siblings** — it can land in any order.
- A `package.json` version bump or `CHANGELOG.md` entry. The version bump (minor — widening is non-breaking) and changelog write-up are handled when the spec lands as part of the standard release flow, not as a deliverable inside the spec.
- Regenerating or committing `dist/`. The directory is gitignored and is rebuilt on `npm run build`.

## Requirements

These requirements transcribe the Functional Requirements and Non-Functional Requirements sections of `.bee/specs/2026-04-30-consolidate-ikadenakeypair/requirements.md`. Every line item below maps to a checkbox in that file.

### Duplicate removals

- The `interface IKadenaKeypair` declaration at `src/interactions/activateFunctions.ts:27-33` is removed.
- The `interface IKadenaKeypair` declaration at `src/interactions/dexFunctions.ts:31-37` is removed.
- The `interface IKadenaKeypair` declaration at `src/interactions/kpayFunctions.ts:28-34` is removed.
- The `interface IKadenaKeypair` declaration at `src/interactions/coilFunctions.ts:15-21` is removed.
- The sibling `interface IOuroAccountKeypair` declaration at `src/interactions/coilFunctions.ts:9-13` is also removed (in-scope per discovery Q4 — same file, same edit, same shape problem).

### Canonical re-imports

- Each of the four files that lost an `IKadenaKeypair` declaration gains a type-only import of `IKadenaKeypair` from the `../signing` barrel. Style mirrors the existing precedent at `src/interactions/pensionFunctions.ts:12` and `src/interactions/urStoaFunctions.ts:20`.
- `src/interactions/coilFunctions.ts` additionally gains a type-only import of `IOuroAccountKeypair` from `./ouroFunctions` (the de-facto canonical for that interactions-domain type, per the `pensionFunctions.ts:12` precedent).
- The `src/signing/index.ts:16` barrel already re-exports `./types` — no edit to the barrel is required.

### Import reordering in coilFunctions

- All `import` statements in `src/interactions/coilFunctions.ts` appear in a single contiguous block at the top of the file. The three currently-misplaced imports at lines 22-24 (`@kadena/client`, `pactRead`, `universalSignTransaction`/`fromKeypair`) — which presently sit AFTER the local interface declarations — are pulled into that contiguous block. This resolves the F-INT-011 interspersed-imports concern.

### Value-position to type-position switches

- `src/interactions/addLiquidityFunctions.ts:10` is split: `IOuroAccountKeypair` keeps its source as `./dexFunctions` (the broader consolidation of that type is deferred, see Non-Goals); `IKadenaKeypair` moves to a type-only import from `../signing`.
- `src/interactions/guardFunctions.ts:13` switches to a type-only import of `IKadenaKeypair` from `../signing`.
- `src/interactions/wrapFunctions.ts:18` switches to a type-only import of `IKadenaKeypair` from `../signing`.

### Phase-2b copy deprecation

- The documented Phase-2b declaration at `src/interactions/ouroFunctions.ts:812-818` stays in place (deleting it would break root-barrel-re-export consumers per the Phase-2b policy in `CLAUDE.md:48-50` and `CHANGELOG.md:540`).
- A JSDoc block tagged `@deprecated` is added immediately above that declaration. The JSDoc message references the canonical at `src/signing/types.ts` and the public consumer-facing subpath `@stoachain/ouronet-core/signing`.

### Type-level assertion test

- A new file `tests/types.test.ts` is created. The file is dedicated to type-level / public-API assertions and is the home for future cross-subpath type tests.
- The test asserts that an object literal carrying `seedType: "foreign"` is assignable to a function parameter typed as `IKadenaKeypair` resolved from each of: `src/interactions/activateFunctions`, `src/interactions/dexFunctions`, `src/interactions/kpayFunctions`, `src/interactions/coilFunctions`, and the canonical `src/signing` subpath.
- The existing `tests/strategy.test.ts` is read-only reference for any conventions; it is not modified.

### Quality gates (non-functional)

- `npm run typecheck` (i.e. `tsc --noEmit`) passes with zero new errors after the refactor.
- `npm test` passes with all 320 existing tests intact plus the new `tests/types.test.ts` cases. Zero regressions.
- Public-API stability: consumers importing `IKadenaKeypair` from any affected subpath (e.g. `@stoachain/ouronet-core/interactions/dexFunctions`) still resolve a valid symbol. The type widens (gains `"foreign"` and tightens `encryptedSecretKey` from `any` to `unknown`) but does not break existing usage.
- `npm run build` produces `dist/` with no new TypeScript errors. The shipped `.d.ts` files reflect the consolidated type.

## Architecture / Approach

The refactor is a pure type-graph reshape. No runtime code changes. The approach is straightforward:

**Single canonical home, type-only fan-in.** `src/signing/types.ts:22-30` already contains the correctly-shaped declaration. The `src/signing/index.ts:16` barrel already re-exports it via `export * from "./types"`. Every consumer that today maintains a local copy or value-position-imports from a peer simply switches to `import type { IKadenaKeypair } from "../signing"`. No barrel edits, no new files in `src/`.

**Type-only imports preserve module boundaries.** Switching from value-position to type-position imports means the imports erase at compile time — they impose no runtime dependency edge. This is what breaks the `IKadenaKeypair` half of the F-INT-001 cycle between `addLiquidityFunctions` and `dexFunctions`. The pattern is already established in the codebase at `pensionFunctions.ts:12` and `urStoaFunctions.ts:20`; the refactor extends that precedent uniformly.

**Phase-2b copy stays, gains a deprecation marker.** The `ouroFunctions.ts:812-818` declaration is load-bearing for the root-barrel re-export path (`interactions/index.ts` re-exports `ouroFunctions`, and root-barrel consumers import the type from there). Deleting it would break those consumers. The `@deprecated` JSDoc tag is the IDE-visible signal that the symbol is preserved for compatibility only and that new code should import from `@stoachain/ouronet-core/signing`.

**`coilFunctions.ts` collateral cleanup.** Two related issues in one file are resolved together because they share the edit window: (a) the non-exported `IKadenaKeypair` duplicate is deleted (the spec's main concern), and (b) the non-exported `IOuroAccountKeypair` sibling is also deleted and routed to `./ouroFunctions` (per the `pensionFunctions.ts:12` precedent). The interspersed imports at lines 22-24 are pulled into the contiguous top-of-file import block.

**Test as a regression lock.** The new `tests/types.test.ts` exercises type-level assignability — not behaviour — across each previously-duplicating subpath. If any future change reintroduces a drifted local declaration that omits `"foreign"`, the test fails to type-check and the build breaks. This makes the consolidation self-policing.

**Existing code referenced (no edits to these):**

| Reference | Role |
|---|---|
| `src/signing/types.ts:22-30` | Canonical declaration; the import target |
| `src/signing/index.ts:16` | Barrel re-export — `export * from "./types"` |
| `src/interactions/pensionFunctions.ts:12` | Precedent for type-only cross-interactions imports |
| `src/interactions/urStoaFunctions.ts:20` | Same precedent, different consumer |
| `src/signing/codexStrategy.ts:26,56,70,94,165,166,171` | Production consumer of the canonical type — "right shape" reference |
| `tests/strategy.test.ts:26,46-48,88,509` | Existing type-exercising test — read-only convention reference |
| `CLAUDE.md:48-50` | Phase-2b backwards-compat policy text — referenced by the new `@deprecated` JSDoc |
| `CHANGELOG.md:540` | Phase-2b root-barrel-re-export rationale — context |
| `package.json:8-69` | Subpath exports declaration — confirms `./signing` is publicly importable |
| `tsconfig.json` | `noUnusedLocals: true` — confirms deletions leave no orphan symbols |

## Risks & Mitigations

**Risk: Consumer code reading `encryptedSecretKey` breaks under the `any → unknown` tightening.**
The canonical declares `encryptedSecretKey?: unknown`; the duplicates declare `any`. Code that does `kp.encryptedSecretKey.toString()` typechecks under `any` but fails under `unknown` without a narrowing cast. *Mitigation:* the `npm run typecheck` quality gate catches every such site at compile time. Any failure that surfaces is a real latent bug that the looser `any` was hiding — surfacing it is the correct outcome, and the fix (a narrowing cast or guard) is local and safe. If a site outside this spec's scope breaks, it is logged and addressed in a follow-up rather than reverted.

**Risk: A consumer narrows on `seedType === "foreign"` against an old subpath that didn't expose the literal.**
After consolidation every subpath exposes `"foreign"`, so this risk transitions from "silent failure waiting to happen" to "works correctly". *Mitigation:* this is exactly the bug class the spec exists to eliminate. The new `tests/types.test.ts` locks the assignability so it cannot regress.

**Risk: Root-barrel consumers depending on `IKadenaKeypair` exported from `ouroFunctions.ts` break if the Phase-2b copy is removed.**
*Mitigation:* this spec explicitly preserves that declaration. Only the `@deprecated` JSDoc is added; the symbol and its export path are unchanged.

**Risk: Reordering imports in `coilFunctions.ts` accidentally drops a side-effect import or changes evaluation order.**
The three relocated imports (`@kadena/client`, `../reads`, `../signing`) are all named imports with no side-effect-only forms in this codebase. *Mitigation:* the existing test suite (320 tests) exercises the affected paths through `dexFunctions`, `kpayFunctions`, etc.; any evaluation-order regression surfaces there. The `npm run build` gate confirms the file still compiles.

**Risk: `noUnusedLocals: true` flags a dangling reference if a deletion misses a usage site.**
*Mitigation:* `tsconfig.json` already has `noUnusedLocals: true` enabled. The typecheck gate fails fast on any orphan symbol or missed reference, before tests run.

**Risk: The new `tests/types.test.ts` file accidentally tests behaviour rather than types.**
*Mitigation:* the test is scoped to type-level assignability assertions only — it confirms that an object with `seedType: "foreign"` is assignable to the parameter type from each subpath. It does not invoke runtime signing logic.

## Acceptance Summary

The spec is complete when all of the following are true:

- The four undocumented `interface IKadenaKeypair` declarations are deleted from `activateFunctions.ts`, `dexFunctions.ts`, `kpayFunctions.ts`, and `coilFunctions.ts`. Each file imports `IKadenaKeypair` as a type-only import from `../signing`.
- The non-exported `interface IOuroAccountKeypair` declaration at `coilFunctions.ts:9-13` is deleted. `coilFunctions.ts` imports `IOuroAccountKeypair` as a type-only import from `./ouroFunctions`.
- All `import` statements in `coilFunctions.ts` form a single contiguous block at the top of the file.
- `addLiquidityFunctions.ts`, `guardFunctions.ts`, and `wrapFunctions.ts` all use type-only imports for `IKadenaKeypair`, sourced from `../signing`. The `addLiquidityFunctions.ts` import line is split so `IOuroAccountKeypair` continues to resolve from `./dexFunctions`.
- The Phase-2b declaration at `ouroFunctions.ts:812-818` is preserved and now carries an `@deprecated` JSDoc tag referencing the canonical at `src/signing/types.ts` and the public subpath `@stoachain/ouronet-core/signing`.
- A new file `tests/types.test.ts` exists and asserts that `seedType: "foreign"` is assignable to an `IKadenaKeypair`-typed parameter resolved from each of `./activateFunctions`, `./dexFunctions`, `./kpayFunctions`, `./coilFunctions`, and the canonical `./signing` subpath.
- `npm run typecheck` passes with zero new errors.
- `npm test` passes with all pre-existing tests green and the new type-level tests passing.
- `npm run build` produces `dist/` with no new TypeScript errors and `.d.ts` files reflecting the consolidated type.

---
IMPORTANT: This spec contains descriptions and behavior only. NO code examples, NO pseudocode. Implementation details are determined during phase planning.
