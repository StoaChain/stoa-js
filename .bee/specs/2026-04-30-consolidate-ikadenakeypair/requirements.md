# Requirements — Consolidate IKadenaKeypair

## Initial Description

The `IKadenaKeypair` type — the signing-ready keypair shape consumed by every signing call site — has SIX independent declarations across the codebase. Only `src/signing/types.ts` is canonical and `src/interactions/ouroFunctions.ts` is documented Phase-2b backwards-compat. The remaining four are undocumented duplicates, including one that is *not exported* and invisible to find-references tooling.

The duplicates are not byte-identical: the canonical includes `seedType: "foreign"` and types `encryptedSecretKey: unknown`; every duplicate omits `"foreign"` and uses `encryptedSecretKey: any`. TypeScript treats them as structurally compatible today, but the moment any one copy adds a required field — or any consumer narrows on `seedType === "foreign"` — the drift becomes a runtime/compile error landing silently on partial migrations.

This spec consolidates the type to a single canonical declaration, delegating all duplicates to the canonical via type-only re-imports through the existing `src/signing` barrel.

Audit reference: **F-CORE-001 (CRITICAL)** in `.bee/AUDIT-REPORT.md` — merged from F-ARCH-001, F-INT-007, F-INT-011.

## Requirements Discussion

### Source: audit-spec discussion notes
This spec was created via `/bee:new-spec --from-discussion .bee/audit-specs/critical-ikadenakeypair-consolidation.md`. The audit-spec discussion locked the following decisions; the discovery conversation reviewed and adjusted them.

### Q1 (locked from discussion): What needs to happen with the four undocumented duplicates?
**A1:** Delete `interface IKadenaKeypair` from each of:
- `src/interactions/activateFunctions.ts:27-33` (exported duplicate)
- `src/interactions/dexFunctions.ts:31-37` (exported duplicate)
- `src/interactions/kpayFunctions.ts:28-34` (exported duplicate)
- `src/interactions/coilFunctions.ts:15-21` (non-exported duplicate, invisible to find-references)

Replace each with `import type { IKadenaKeypair } from "../signing";`. The `signing` barrel at `src/signing/index.ts:16` already does `export * from "./types"`, so this import path resolves today — no barrel change needed.

### Q2 (locked from discussion): What about the documented Phase-2b copy?
**A2:** Keep `src/interactions/ouroFunctions.ts:812-818` declaration in place. Add `@deprecated` JSDoc tagging the canonical at `src/signing/types.ts` (and the consumer-facing subpath `@stoachain/ouronet-core/signing`). The Phase-2b rationale (per `CLAUDE.md:48-50` and `CHANGELOG.md:540`) is that the `interactions/index.ts` barrel re-exports `ouroFunctions`, and root-barrel consumers import the type from there. Deleting it would break those consumers' import paths.

### Q3 (locked from discussion): What about value-position imports that need to flip to type-position?
**A3:** Three files import `IKadenaKeypair` from a sibling interactions file in value-position (no `import type` qualifier):
- `addLiquidityFunctions.ts:10` — imports `{IOuroAccountKeypair, IKadenaKeypair} from "./dexFunctions"`
- `guardFunctions.ts:13` — imports `{IKadenaKeypair} from "./ouroFunctions"`
- `wrapFunctions.ts:18` — imports `{IKadenaKeypair} from "./ouroFunctions"`

These must switch to `import type` and route to `../signing`. For `addLiquidityFunctions.ts:10` specifically, the import line must be split — `IOuroAccountKeypair` stays from `./dexFunctions` (different scope; covered by a separate audit follow-up), `IKadenaKeypair` moves to `../signing`. This change incidentally breaks the `IKadenaKeypair` half of the F-INT-001 circular dependency between `dexFunctions` and `addLiquidityFunctions`.

### Q4 (gap from research, asked in discovery): Should the `coilFunctions.ts` cleanup also delete the sibling non-exported `IOuroAccountKeypair` duplicate?
**A4:** Yes. `coilFunctions.ts:9-13` declares a non-exported `IOuroAccountKeypair` duplicate (same shape problem, same file, same edit). Delete it and route to `import type { IOuroAccountKeypair } from "./ouroFunctions";` — `ouroFunctions.ts:806-810` is the de-facto canonical for this type (it's the file the `interactions/index.ts` barrel re-exports, and `pensionFunctions.ts:12` already follows this precedent). Also reorder the file's imports: lines 22-24 (`@kadena/client`, `pactRead`, `universalSignTransaction`) currently appear AFTER the local interface declarations (F-INT-011); pull them into the contiguous import block at the top of the file.

The triple-source problem for `IOuroAccountKeypair` itself (`dexFunctions.ts:25-29` and `kpayFunctions.ts:22-26` also declare it) is **out of scope** for this spec — it lacks a canonical home in `signing/types.ts` (it's an interactions-domain type) and would require a separate decision about whether to add it to `signing/types.ts` or pin `ouroFunctions.ts` as the canonical home with documented Phase-2b status. Defer to a future spec.

### Q5 (gap from research, asked in discovery): Where does the new "`seedType: 'foreign'` is assignable from each subpath" test live?
**A5:** New file `tests/types.test.ts`. Net-new file dedicated to type-level / public-API assertions. Future cross-subpath type tests have a home there. Existing `tests/strategy.test.ts` stays focused on signing behaviour.

### Q6 (gap from research, asked in discovery): Implementation mode for this spec?
**A6:** `premium` — opus throughout. The cycle-break in F-INT-001 has subtle TypeScript type-position semantics where opus reasoning is safer than sonnet. Cost-acceptable for a small refactor.

### Existing Code to Reference

| File | Purpose |
|---|---|
| `src/signing/types.ts:22-30` | Canonical `IKadenaKeypair` declaration — the import target |
| `src/signing/index.ts:16` | `export * from "./types"` — barrel that re-exports the type |
| `src/interactions/pensionFunctions.ts:12` | Existing `import type { IOuroAccountKeypair, IKadenaKeypair } from "./ouroFunctions"` — precedent for type-only imports across interactions files |
| `src/interactions/urStoaFunctions.ts:20` | Existing `import type { IKadenaKeypair } from "./ouroFunctions"` — same precedent, different consumer |
| `src/signing/codexStrategy.ts:26,56,70,94,165,166,171` | Production consumer of canonical type — already imports correctly from `./types`. No edit needed; serves as the "right shape" reference |
| `tests/strategy.test.ts:26,46-48,88,509` | Only existing test exercising the type. Read for any conventions; do NOT modify (unrelated to consolidation) |
| `CLAUDE.md:48-50` | Documented Phase-2b backwards-compat policy — the rationale text the `@deprecated` JSDoc should reference |
| `CHANGELOG.md:540` | Phase-2b root-barrel-re-export rationale — context for why ouroFunctions copy persists |
| `package.json:8-69` | Subpath exports declaration — confirms `./signing` is publicly importable |
| `tsconfig.json` | `noUnusedLocals: true` — deleted `interface` declarations leave no orphan symbols (good); confirms the refactor won't trip TS warnings |

## Visual Assets

No visual assets provided. This is a type-system refactor; no UI / mockup component.

## Implementation Mode

`premium` — opus throughout the planning + implementation + review pipeline.

## Requirements Summary

### Functional Requirements

- [x] Delete `interface IKadenaKeypair` declaration from `src/interactions/activateFunctions.ts:27-33`.
- [x] Delete `interface IKadenaKeypair` declaration from `src/interactions/dexFunctions.ts:31-37`.
- [x] Delete `interface IKadenaKeypair` declaration from `src/interactions/kpayFunctions.ts:28-34`.
- [x] Delete `interface IKadenaKeypair` declaration from `src/interactions/coilFunctions.ts:15-21`.
- [x] Delete `interface IOuroAccountKeypair` declaration from `src/interactions/coilFunctions.ts:9-13` (sibling cleanup; in-scope per discovery Q4).
- [x] Reorder `src/interactions/coilFunctions.ts` imports so all `import` statements appear in a contiguous block at the top of the file (resolves F-INT-011 interspersed-imports concern).
- [x] Add `import type { IKadenaKeypair } from "../signing";` to each of the four files where the duplicate was deleted.
- [x] Add `import type { IOuroAccountKeypair } from "./ouroFunctions";` to `src/interactions/coilFunctions.ts`.
- [x] Switch `src/interactions/addLiquidityFunctions.ts:10` to `import type`. Split the import line: `IOuroAccountKeypair` keeps its source as `./dexFunctions` (until a follow-up spec consolidates it); `IKadenaKeypair` moves to `import type { IKadenaKeypair } from "../signing";`.
- [x] Switch `src/interactions/guardFunctions.ts:13` to `import type { IKadenaKeypair } from "../signing";`.
- [x] Switch `src/interactions/wrapFunctions.ts:18` to `import type { IKadenaKeypair } from "../signing";`.
- [x] Add `@deprecated` JSDoc to `src/interactions/ouroFunctions.ts:812-818` pointing to the canonical at `src/signing/types.ts` and the public subpath `@stoachain/ouronet-core/signing`.
- [x] Create new test file `tests/types.test.ts` asserting `seedType: "foreign"` is assignable to a function parameter typed `IKadenaKeypair` from each previously-duplicating subpath (`./activateFunctions`, `./dexFunctions`, `./kpayFunctions`, `./coilFunctions`, plus the canonical `./signing`).

### Non-Functional Requirements

- [x] **Type-correctness:** `npm run typecheck` (i.e. `tsc --noEmit`) passes with zero new errors after the refactor.
- [x] **Test stability:** `npm test` passes with all 320 existing tests + the new `tests/types.test.ts` tests, zero regressions.
- [x] **Public-API stability:** Consumers importing `IKadenaKeypair` from any of the affected subpaths (`@stoachain/ouronet-core/interactions/dexFunctions`, etc.) still get a resolvable symbol — the type widens (gains `"foreign"`) but does not break existing usage.
- [x] **Build artifact:** `npm run build` produces `dist/` with no new TypeScript errors. The shipped `.d.ts` files reflect the consolidated type.

### Reusability Opportunities

- `src/signing/types.ts:22-30` — canonical declaration; already correctly shaped, no edit needed.
- `src/signing/index.ts:16` — already does `export * from "./types"`; re-exports `IKadenaKeypair` through the barrel. No edit needed.
- `pensionFunctions.ts:12` and `urStoaFunctions.ts:20` are existing precedent for the `import type` pattern across interactions files; mirror their style.

### Scope Boundaries

**In scope:**
- 4 duplicate `IKadenaKeypair` deletions (activate, dex, kpay, coil)
- 1 sibling `IOuroAccountKeypair` deletion in coilFunctions (collateral cleanup)
- 1 import-reordering in coilFunctions
- 3 value-position-to-type-position import switches (addLiquidity, guard, wrap)
- `@deprecated` JSDoc on the Phase-2b ouroFunctions copy
- New test file `tests/types.test.ts`

**Out of scope (to be picked up in separate specs / quick tasks):**
- The triple-source `IOuroAccountKeypair` problem in `dexFunctions.ts:25-29` and `kpayFunctions.ts:22-26` — needs a separate decision on canonical home. Tracked as a follow-up.
- The full F-INT-001 circular-dep cleanup (the `IOuroAccountKeypair` half remains; only the `IKadenaKeypair` half is fixed by this spec).
- Any other audit findings (failover wiring, error taxonomy, etc.) — see `.bee/audit-specs/` for the full set.

### Technical Considerations

- **Cycle break:** Routing `IKadenaKeypair` through `../signing` removes the `addLiquidityFunctions → dexFunctions` value-position import for that type. The `IOuroAccountKeypair` half of the cycle remains; not a regression.
- **Type widening:** Each affected interactions subpath gains `seedType: "foreign"` in its public type. This is non-breaking (existing consumers don't use `"foreign"`; new consumers gain access to it).
- **`encryptedSecretKey` widening:** `unknown` is stricter than `any` — but the canonical type uses `unknown`. Downstream code that reads `encryptedSecretKey` may need a narrowing cast. Verify by typecheck; if any consumer breaks, that's a real bug to surface (the existing `any` was hiding it).
- **No dist/ regeneration commit needed:** `dist/` is generated on `npm run build` and not committed (per `.gitignore`).
- **No `package.json` version bump in this spec:** This is an internal refactor with widening (non-breaking) public-API impact. Bump as a minor (e.g. v1.6.1 → v1.7.0) when the spec lands; document in CHANGELOG.

## Cross-Spec Coordination Notes

This spec is one of 10 generated from the audit. Sequence considerations relative to siblings:

- **No blockers from / to other specs.** The IKadenaKeypair consolidation is independent of failover wiring (#2), arch layering (#3), security (#4), error fallbacks (#5), test coverage (#6), guard hardening (#7), codec hardening (#8), safeCreationTime (#9), or LOW improvements (#10).
- **Follow-up spec candidate:** The `IOuroAccountKeypair` triple-declaration (out of scope here) can be a separate `[TECH-DEBT]` quick task when convenient.
