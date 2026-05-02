# Phase 1: `safeCreationTime` DRY refactor -- Tasks

<!-- Pass 2 output: waves assigned, file-disjointness verified, research notes finalized for mechanical refactor. -->

## Goal

Pure mechanical deduplication of 11 inline `function safeCreationTime` declarations across `src/interactions/*Functions.ts`. The canonical body at `src/pact/format.ts:138-140` is the single source of truth and remains unchanged. Each affected interaction file removes its private 3-line declaration and gains `safeCreationTime` on its import from the pact subpath (added to an existing `from "../pact"` import line where one is already present, or as a new import line where it is not). Behavior is byte-identical because the imported body is the same as the removed inline copies. The phase produces zero behavior change observable to consumers and zero test count change (per NFR-04).

Verification: post-phase `grep -rE "function safeCreationTime" src/` returns exactly one hit (the canonical at `src/pact/format.ts:138`). Existing tests continue to pass with no count change.

## Wave Dependency Chain

```
W1 (1 task)        W2 (11 tasks, all parallel, file-disjoint)         W3 (1 task)
+-----------+      +--------------------------------------------+      +-------------+
|  T1.1     |      | T1.2  activateFunctions.ts                 |      |  T1.13      |
|  pre-state| ---> | T1.3  addLiquidityFunctions.ts             | ---> |  verify     |
|  audit    |      | T1.4  coilFunctions.ts                     |      |  gate       |
+-----------+      | T1.5  crossChainFunctions.ts               |      +-------------+
                   | T1.6  dexFunctions.ts                      |
                   | T1.7  guardFunctions.ts                    |
                   | T1.8  kpayFunctions.ts                     |
                   | T1.9  ouroFunctions.ts                     |
                   | T1.10 pensionFunctions.ts                  |
                   | T1.11 urStoaFunctions.ts                   |
                   | T1.12 wrapFunctions.ts                     |
                   +--------------------------------------------+
```

- **W1 -> W2 dependency:** T1.1 produces the absorb-vs-new-import mapping in its notes; the 11 W2 tasks consume that mapping to choose between extending an existing `from "../pact"` import line (5 files) or adding a new one (6 files). T1.1 also confirms byte-identity of the 11 inline bodies versus the canonical -- a precondition gate that, if violated, HALTS the phase before any source file is touched.
- **W2 internal parallelism:** all 11 tasks modify disjoint files (one per task, see file-ownership matrix below). Zero file conflicts. All 11 can run in parallel within a single wave.
- **W2 -> W3 dependency:** T1.13 runs the integrated verification (typecheck + full test suite + build + post-phase grep asserting exactly one `function safeCreationTime` remains). It MUST observe the post-state of all 11 edits combined; running it before any W2 task finishes would produce a misleading red, and running it after only some W2 tasks finish would still leave duplicate declarations in the grep output. It is a true end-of-phase gate.

## File-Ownership Matrix (Wave 2)

| Task  | Modifies (single file, exclusive)                              | Import-line strategy (from T1.1 mapping) |
|-------|---------------------------------------------------------------|------------------------------------------|
| T1.2  | `src/interactions/activateFunctions.ts`                       | new import line (no prior `from "../pact"`) |
| T1.3  | `src/interactions/addLiquidityFunctions.ts`                   | absorb into existing `from "../pact"` line |
| T1.4  | `src/interactions/coilFunctions.ts`                           | absorb into existing `from "../pact"` line |
| T1.5  | `src/interactions/crossChainFunctions.ts`                     | new import line |
| T1.6  | `src/interactions/dexFunctions.ts`                            | new import line |
| T1.7  | `src/interactions/guardFunctions.ts`                          | new import line |
| T1.8  | `src/interactions/kpayFunctions.ts`                           | new import line |
| T1.9  | `src/interactions/ouroFunctions.ts`                           | absorb into existing `from "../pact"` line (extend line 8) |
| T1.10 | `src/interactions/pensionFunctions.ts`                        | absorb into existing `from "../pact"` line |
| T1.11 | `src/interactions/urStoaFunctions.ts`                         | new import line |
| T1.12 | `src/interactions/wrapFunctions.ts`                           | absorb into existing `from "../pact"` line |

**Conflict scan:** zero overlap. Each row's "Modifies" entry is unique. No shared barrel/index files are modified by W2 (the `src/pact/index.ts` barrel is read-only context for W2; no edits). The canonical `src/pact/format.ts` is read-only context throughout.

---

## Wave 1 (1 task)

- [x] T1.1 | Verify pre-state: confirm canonical declaration exists at `src/pact/format.ts:138-140` and the 11 duplicate sites match the locked file list (grep + read-only audit; no source edits) | bee-implementer
  - requirements: [REQ-01]
  - acceptance:
    - `grep -rE "function safeCreationTime" src/` is run and produces exactly 12 hits (1 canonical + 11 duplicates).
    - The 11 duplicate hits cover EXACTLY these files (one hit each, no extras, no missing): `src/interactions/activateFunctions.ts`, `addLiquidityFunctions.ts`, `coilFunctions.ts`, `crossChainFunctions.ts`, `dexFunctions.ts`, `guardFunctions.ts`, `kpayFunctions.ts`, `ouroFunctions.ts`, `pensionFunctions.ts`, `urStoaFunctions.ts`, `wrapFunctions.ts`.
    - The canonical body at `src/pact/format.ts:138-140` is read and confirmed to be a 3-line `export function safeCreationTime(): number { return Math.floor(Date.now() / 1000) - 30; }` (single statement returning seconds-minus-30).
    - For each of the 11 duplicates, the inline body is read and confirmed byte-identical to the canonical (same return expression, no surrounding logic). Any deviation HALTS the phase (would invalidate the "byte-identical" precondition for REQ-01).
    - For each of the 11 duplicate files, the existing import-from-pact-subpath state is recorded (which files already have a `from "../pact"` line that can absorb the symbol vs which need a new import line). Real-world finding from Pass 1 grep: 5 files already import from `"../pact"` (addLiquidity, coil, ouro, pension, wrap); 6 do not (activate, crossChain, dex, guard, kpay, urStoa). The recorded mapping is written into `notes:` for the per-file edit tasks to consume.
    - Notes section for this task records: the 12-hit grep output verbatim; the byte-identity confirmation per file; the existing-import-line mapping (file -> "absorb" or "new import").
    - NO source files are modified by this task.
  - context:
    - `src/pact/format.ts` (read lines 130-145 for canonical declaration + JSDoc)
    - All 11 `src/interactions/*Functions.ts` files listed above (read inline declaration + existing imports near top of file)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-01 + the 11-file canonical list under "M1 Phase 1 -- F-CORE-015")
  - research:
    - Pattern: [VERIFIED] Read-only pre-state audit before mechanical edits -- analogue of the v2.2.0 spec's pre-state audit step, reused as a precondition gate.
    - Reuse: [VERIFIED] `grep -rE` is portable across the dev environments used by this repo's CI (`.github/workflows/ci.yml` runs on ubuntu-latest); explicit path scoping to `src/` excludes `tests/` and `dist/`.
    - Approach: [VERIFIED] No file edits in this task; output is a structured recording in the task notes that the per-file edit tasks (T1.2-T1.12) consume to choose between "absorb into existing import" vs "add new import line". The Pass 1 grep already produced the absorb-vs-new-import split (5 absorb / 6 new); T1.1 re-runs the grep at execution time to confirm the snapshot is still current and writes it verbatim into notes.
  - notes:

## Wave 2 (11 tasks, parallel, file-disjoint)

- [x] T1.2 | Refactor `src/interactions/activateFunctions.ts`: remove inline `function safeCreationTime` declaration; add `safeCreationTime` to a new `import { safeCreationTime } from "../pact"` import line (file does NOT currently import from "../pact" per Pass 1 grep) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 23) is removed entirely.
    - A new import line `import { safeCreationTime } from "../pact";` is added in the existing import block at the top of the file, placed alphabetically/contextually consistent with surrounding imports (no new blank lines beyond what the import block already uses).
    - All call sites of `safeCreationTime` within the file continue to resolve correctly (post-edit `grep -n "safeCreationTime" src/interactions/activateFunctions.ts` shows the import + the call sites, NO function declaration).
    - `npm run typecheck` (or `npx tsc --noEmit`) exits 0 (no broken type resolution).
    - `grep -nE "^function safeCreationTime" src/interactions/activateFunctions.ts` returns zero matches.
    - File-scoped behavior change: ZERO. Imported body is byte-identical to the removed inline body.
    - No other changes to the file (no reformatting, no unrelated edits, no JSDoc additions).
  - context:
    - `src/interactions/activateFunctions.ts` (full file -- top of file imports + the inline declaration + all call sites of `safeCreationTime`)
    - `src/pact/format.ts:138-140` (canonical declaration confirmation, no edit)
    - `src/pact/index.ts` (verify barrel re-exports `safeCreationTime` so the `from "../pact"` import resolves)
    - T1.1 notes (existing-import-line mapping; this file is in the "new import" group)
  - research:
    - Pattern: [VERIFIED] Existing `from "../pact"` import shape in sibling files (e.g. `src/interactions/coilFunctions.ts:9`, `pensionFunctions.ts:7`) -- single-line `import { ... } from "../pact";` style. Copy that shape exactly.
    - Reuse: [VERIFIED] `src/pact/index.ts` barrel re-exports `safeCreationTime` (precondition for the `from "../pact"` import to resolve). T1.1 confirms this at runtime; if the barrel does not export, T1.1 HALTS before W2 begins.
    - Types: [VERIFIED] `safeCreationTime(): number` per `src/pact/format.ts:138`.
    - Approach: [VERIFIED] Mechanical edit only; locate the inline declaration, locate the import block, remove and add. No semantic reasoning needed.
  - notes:

- [x] T1.3 | Refactor `src/interactions/addLiquidityFunctions.ts`: remove inline `function safeCreationTime` declaration; absorb `safeCreationTime` into existing `import { mayComeWithDeimal } from "../pact"` line (already imports from "../pact" per Pass 1 grep at line 11) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 19) is removed entirely.
    - The existing `import { mayComeWithDeimal } from "../pact";` line at top of file is updated to `import { mayComeWithDeimal, safeCreationTime } from "../pact";` (or alphabetized order if file convention dictates -- preserve existing style).
    - All call sites of `safeCreationTime` within the file continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/addLiquidityFunctions.ts` returns zero matches.
    - The outer try/catch wrapping `getLPTypeInfo`'s `Promise.all` body in `src/interactions/addLiquidityFunctions.ts` is NOT touched in this task (cross-plan auto-fix iter 2 per CI-006 — structural anchor; actual current range 219-257, lines shift through the spec; that work belongs to Phase 5 / REQ-11, out of scope here).
    - No other changes to the file.
  - context:
    - `src/interactions/addLiquidityFunctions.ts` (full file -- top imports + inline declaration + call sites)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts` (verify barrel re-export)
    - T1.1 notes (this file is in the "absorb into existing import" group)
  - research:
    - Pattern: [VERIFIED] Existing import shape `import { mayComeWithDeimal } from "../pact";` -- extend in place; do not split into two import-from-pact lines.
    - Approach: [VERIFIED] Single-line edit on the existing import; mechanical removal of the inline declaration. Out-of-scope guardrail (cross-plan auto-fix iter 2 per CI-006): outer try/catch on `getLPTypeInfo` (structural anchor — actual current range 219-257) is Phase 5 territory.
  - notes:

- [x] T1.4 | Refactor `src/interactions/coilFunctions.ts`: remove inline `function safeCreationTime` declaration; absorb `safeCreationTime` into existing `import { formatDecimalForPact } from "../pact"` line (already imports from "../pact" per Pass 1 grep at line 9) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 19) is removed entirely.
    - The existing `import { formatDecimalForPact } from "../pact";` line is updated to `import { formatDecimalForPact, safeCreationTime } from "../pact";` (preserve existing style).
    - All call sites of `safeCreationTime` within the file continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/coilFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/coilFunctions.ts` (full file -- top imports + inline declaration + call sites)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "absorb" group)
  - research:
    - Pattern: [VERIFIED] Existing `import { formatDecimalForPact } from "../pact";` at line 9 -- extend in place.
    - Approach: [VERIFIED] Mechanical, single-line import edit + 3-line declaration removal.
  - notes:

- [x] T1.5 | Refactor `src/interactions/crossChainFunctions.ts`: remove inline `function safeCreationTime` declaration; add new `import { safeCreationTime } from "../pact"` line (file does NOT currently import from "../pact" per Pass 1 grep) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 12) is removed entirely.
    - A new import line `import { safeCreationTime } from "../pact";` is added in the existing import block at the top of the file, placed in a position consistent with the file's existing import ordering convention.
    - All call sites of `safeCreationTime` within the file continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/crossChainFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/crossChainFunctions.ts` (full file -- top imports + inline declaration + call sites)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "new import" group)
  - research:
    - Pattern: [VERIFIED] Sibling interaction file's `from "../pact"` import (e.g. `src/interactions/coilFunctions.ts:9`) for the exact import-line style.
    - Approach: [VERIFIED] New import line + 3-line declaration removal.
  - notes:

- [x] T1.6 | Refactor `src/interactions/dexFunctions.ts`: remove inline `function safeCreationTime` declaration; add new `import { safeCreationTime } from "../pact"` line (file does NOT currently import from "../pact" per Pass 1 grep) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 18) is removed entirely.
    - A new import line `import { safeCreationTime } from "../pact";` is added in the existing import block at the top of the file.
    - All call sites of `safeCreationTime` within the file continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/dexFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/dexFunctions.ts` (full file)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "new import" group)
  - research:
    - Pattern: [VERIFIED] Sibling `from "../pact"` import-line style (`src/interactions/coilFunctions.ts:9`).
    - Approach: [VERIFIED] New import line + 3-line declaration removal.
  - notes:

- [x] T1.7 | Refactor `src/interactions/guardFunctions.ts`: remove inline `function safeCreationTime` declaration; add new `import { safeCreationTime } from "../pact"` line (file does NOT currently import from "../pact" per Pass 1 grep) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 19) is removed entirely.
    - A new import line `import { safeCreationTime } from "../pact";` is added in the existing import block.
    - All call sites of `safeCreationTime` within the file continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/guardFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/guardFunctions.ts` (full file)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "new import" group)
  - research:
    - Pattern: [VERIFIED] Sibling import-line style.
    - Approach: [VERIFIED] New import line + 3-line declaration removal.
  - notes:

- [x] T1.8 | Refactor `src/interactions/kpayFunctions.ts`: remove inline `function safeCreationTime` declaration; add new `import { safeCreationTime } from "../pact"` line (file does NOT currently import from "../pact" per Pass 1 grep) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 18) is removed entirely.
    - A new import line `import { safeCreationTime } from "../pact";` is added.
    - All call sites continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/kpayFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/kpayFunctions.ts` (full file)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "new import" group)
  - research:
    - Pattern: [VERIFIED] Sibling import-line style.
    - Approach: [VERIFIED] New import line + 3-line declaration removal.
  - notes:

- [x] T1.9 | Refactor `src/interactions/ouroFunctions.ts`: remove inline `function safeCreationTime` declaration at lines 118-120; absorb `safeCreationTime` into one of the existing imports from "../pact" (file currently has `import { formatEU } from "../pact";` at line 7 AND `import { mayComeWithDeimal, formatDecimalForPact } from "../pact";` at line 8 per Pass 1 grep -- consolidate or extend per existing style) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration at lines 118-120 is removed entirely.
    - `safeCreationTime` is added to ONE of the two existing `from "../pact"` import lines (either `formatEU` or `mayComeWithDeimal, formatDecimalForPact`). The implementer chooses based on existing style -- preferred: extend the line that already has multiple symbols (line 8: `mayComeWithDeimal, formatDecimalForPact, safeCreationTime`). Do NOT introduce a third `from "../pact"` import line.
    - All call sites of `safeCreationTime` within the file continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/ouroFunctions.ts` returns zero matches.
    - The catch-block sites at lines 1842/1860/1877/1894/1916/2069/2088 are NOT touched in this task (that work belongs to Phase 5 / REQ-10, out of scope here).
    - The `resolveGuard` body at lines 191-216 is NOT touched in this task (cross-plan auto-fix iter 1 per CI-002 — that work belongs to Phase 3 / REQ-05's `normalizeKeysetRef` boundary application, out of scope here).
    - No other changes to the file.
  - context:
    - `src/interactions/ouroFunctions.ts` (read top imports lines 1-30 + inline declaration around lines 118-120 + call sites of `safeCreationTime`)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "absorb" group, with TWO existing `from "../pact"` lines -- consolidate decision documented in research)
  - research:
    - Pattern: [VERIFIED] Both existing `from "../pact"` lines confirmed (line 7 and line 8). The minimum-diff approach is to add `safeCreationTime` to line 8 only (already multi-symbol), leaving line 7 as-is. Do NOT consolidate the two lines in this task -- consolidation is a separate concern outside REQ-01 scope.
    - Approach: [VERIFIED] Single-line import edit on line 8; mechanical removal of inline declaration at lines 118-120. Out-of-scope guardrail: catch-block sites at lines 1842/1860/1877/1894/1916/2069/2088 are Phase 5 territory.
  - notes:

- [x] T1.10 | Refactor `src/interactions/pensionFunctions.ts`: remove inline `function safeCreationTime` declaration; absorb `safeCreationTime` into existing `import { formatDecimalForPact } from "../pact"` line (already imports from "../pact" per Pass 1 grep at line 7) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 18) is removed entirely.
    - The existing `import { formatDecimalForPact } from "../pact";` line is updated to `import { formatDecimalForPact, safeCreationTime } from "../pact";`.
    - All call sites continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/pensionFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/pensionFunctions.ts` (full file)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "absorb" group)
  - research:
    - Pattern: [VERIFIED] Existing `import { formatDecimalForPact } from "../pact";` at line 7 -- extend in place.
    - Approach: [VERIFIED] Mechanical, single-line import edit + 3-line declaration removal.
  - notes:

- [x] T1.11 | Refactor `src/interactions/urStoaFunctions.ts`: remove inline `function safeCreationTime` declaration; add new `import { safeCreationTime } from "../pact"` line (file does NOT currently import from "../pact" per Pass 1 grep) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 28) is removed entirely.
    - A new import line `import { safeCreationTime } from "../pact";` is added.
    - All call sites continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/urStoaFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/urStoaFunctions.ts` (full file)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "new import" group)
  - research:
    - Pattern: [VERIFIED] Sibling import-line style.
    - Approach: [VERIFIED] New import line + 3-line declaration removal.
  - notes:

- [x] T1.12 | Refactor `src/interactions/wrapFunctions.ts`: remove inline `function safeCreationTime` declaration; absorb `safeCreationTime` into existing `import { formatDecimalForPact } from "../pact"` line (already imports from "../pact" per Pass 1 grep at line 16) | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.1]
  - acceptance:
    - Inline `function safeCreationTime` declaration (3 lines, near top of file around line 26) is removed entirely.
    - The existing `import { formatDecimalForPact } from "../pact";` line is updated to `import { formatDecimalForPact, safeCreationTime } from "../pact";`.
    - All call sites continue to resolve correctly.
    - `npm run typecheck` exits 0.
    - `grep -nE "^function safeCreationTime" src/interactions/wrapFunctions.ts` returns zero matches.
    - No other changes to the file.
  - context:
    - `src/interactions/wrapFunctions.ts` (full file)
    - `src/pact/format.ts:138-140`
    - `src/pact/index.ts`
    - T1.1 notes (this file is in the "absorb" group)
  - research:
    - Pattern: [VERIFIED] Existing `import { formatDecimalForPact } from "../pact";` at line 16 -- extend in place.
    - Approach: [VERIFIED] Mechanical, single-line import edit + 3-line declaration removal.
  - notes:

## Wave 3 (1 task)

- [x] T1.13 | Verification gate: run typecheck, full test suite, build, and the post-phase grep assertion that exactly one `function safeCreationTime` declaration remains in `src/` | bee-implementer
  - requirements: [REQ-01]
  - depends_on: [T1.2, T1.3, T1.4, T1.5, T1.6, T1.7, T1.8, T1.9, T1.10, T1.11, T1.12]
  - acceptance:
    - `npm run typecheck` exits 0; the run output is captured in the task notes (paste the actual command output as evidence per R8).
    - `npm test` exits 0 (or sole allowed non-zero exit per the locked Windows-locale `tests/gas.test.ts > formatMaxFee` exception per REQ-17). The test count BEFORE Phase 1 is recorded by reading the most-recent test-run output cited in CLAUDE.md ("~310 tests"); the test count AFTER Phase 1 must be IDENTICAL to that baseline (NFR-04 requires zero test count change). Both numbers and the diff (must be 0) are recorded in task notes.
    - `npm run build` exits 0; the run output is captured in the task notes.
    - `grep -rE "function safeCreationTime" src/` returns EXACTLY ONE hit, and that hit is `src/pact/format.ts:138:export function safeCreationTime(): number {`. Any other count or any deviation in the canonical line FAILS the task. The grep output is captured verbatim in task notes.
    - No new "Open handles" warnings appear in the vitest output (NFR-05).
    - The `tests/types.test.ts` v1.7.0 type-regression lock continues to pass (NFR-02 -- verifiable as part of `npm run typecheck` + `npm test`).
    - Task notes summarize all four checks (typecheck, test, build, grep) with PASS/FAIL and the captured outputs.
  - context:
    - `Z:/OuronetCore/package.json` (npm scripts: typecheck, test, build)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-01 + NFR-02 + NFR-04 + NFR-05 + REQ-17 verification anchor for Phase 1)
    - `Z:/OuronetCore/CLAUDE.md` (CI test count reference: "~310 tests"; locked Windows-locale test exception cite)
    - T1.1 through T1.12 notes (per-file edit confirmations)
  - research:
    - Pattern: [VERIFIED] CI workflow at `.github/workflows/ci.yml` runs typecheck -> test -> build sequence; this verification task mirrors that order locally.
    - Reuse: [VERIFIED] Existing `npm run typecheck`, `npm test`, `npm run build` scripts in `package.json`.
    - Approach: [VERIFIED] Run all four checks (three npm scripts + one grep) sequentially; capture each output verbatim; compute test-count delta vs the baseline; HALT if any check fails.
  - notes:

---

## Phase 1 Notes

- 13 tasks total in 3 waves: 1 pre-state audit (T1.1, W1), 11 mechanical per-file edits (T1.2-T1.12, W2, all parallel and file-disjoint), and 1 verification gate (T1.13, W3).
- File-disjointness invariant: each of T1.2-T1.12 modifies exactly ONE file from the locked 11-file list, and no two of them modify the same file. Zero file-ownership conflicts in W2. The W2 tasks DO read shared context (`src/pact/format.ts`, `src/pact/index.ts`) but never modify it.
- Wave 1 -> Wave 2 information flow: T1.1's notes record the absorb-vs-new-import mapping (5 absorb / 6 new) plus byte-identity confirmation. W2 tasks consume this mapping via their `depends_on: [T1.1]` link and the "T1.1 notes" context entry.
- Wave 2 -> Wave 3 information flow: T1.13 depends on all 11 W2 tasks landing. It runs the integrated verification (typecheck + test + build + post-phase grep). Running it before W2 completion would produce false reds.
- Zero new tests added by this phase per NFR-04 (the existing ~310 test suite -- exercising every call site of `safeCreationTime` indirectly through the interaction functions -- IS the regression coverage; the imported body is byte-identical to the removed inline copies).
- Risk profile: LOWEST in the spec. The refactor is mechanical, the canonical body is byte-identical to the duplicates (verified by T1.1 before any W2 task touches a file), and the verification gate (T1.13) catches any deviation immediately via typecheck + grep + full-test-suite.
- Out-of-scope guardrails called out in acceptance: T1.3 must not touch the `getLPTypeInfo` outer try/catch (Phase 5 / REQ-11 territory); T1.9 must not touch the catch-block sites in `ouroFunctions.ts` (Phase 5 / REQ-10 territory). Each per-file task description names only the inline `safeCreationTime` declaration + its single import-line edit.

## Fragmentation Note

W1 and W3 each contain a single task. Both are unavoidable structural gates rather than fragments that could be merged earlier or later:

- **W1 (T1.1) cannot merge into W2:** W1 establishes the precondition (canonical body byte-identical to all 11 duplicates; absorb-vs-new-import mapping per file) that the W2 tasks consume. If T1.1 ran in parallel with the per-file edits, the edits would proceed on assumptions that have not yet been verified -- if a duplicate body diverged from the canonical, the imported behavior would not be byte-identical and the phase precondition for REQ-01 would silently break. T1.1 must be the gate.
- **W3 (T1.13) cannot merge into W2:** T1.13 runs `grep -rE "function safeCreationTime" src/` and asserts exactly ONE hit remains. That assertion is only meaningful AFTER all 11 W2 tasks have landed -- running it earlier would always show duplicates remaining. Similarly, the "test count unchanged" check (NFR-04) and the integrated typecheck/build only make sense over the post-phase tree. T1.13 must observe the integrated post-state.

These are genuine sequential dependencies, not orchestration overhead. The mechanical core (W2, 11 parallel tasks, file-disjoint) IS the high-parallelism wave, and it captures the bulk of the phase work. Average per wave is 13/3 = 4.33 tasks, which is healthy; the 1-task gates surround a single dense parallel wave.
