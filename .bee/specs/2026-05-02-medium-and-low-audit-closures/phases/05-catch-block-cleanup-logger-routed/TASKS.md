# Phase 5: Catch-block cleanup (logger-routed) -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = REQ-IDs from ROADMAP.md addressed by the task
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (researcher notes, prevents pattern hallucination)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

Normalize the seven mixed catch-block sites in `src/interactions/ouroFunctions.ts` to ONE convention — route via `getLogger().error(...)` from `../observability` (LOCKED iter 2 per spec-review I-001 + iter 1 per spec-review I-004). Drop the dead outer try/catch on `getLPTypeInfo` in `src/interactions/addLiquidityFunctions.ts:255-257` (Option A LOCKED — "comment as belt-and-braces" alternative explicitly REJECTED per spec-review iter 1 I-001). Closes F-CORE-019 and F-CORE-021.

## Cross-Phase Dependencies (HARD)

- **Phase 6 source files MUST exist on disk before Phase 5 runs.** Phase 5's edits to `ouroFunctions.ts` add `import { getLogger } from "../observability";`. This requires `src/observability/index.ts` (barrel) and `src/observability/logger.ts` (implementation) — both created by Phase 6 (REQ-13). The atomic-ship contract (NFR-06) puts both phases in the same v2.3.0 commit; the conductor is responsible for intra-commit wave ordering so Phase 6 lands first on disk.
- **Phase 1 file overlap on `addLiquidityFunctions.ts`.** Phase 1's T1.3 removes the inline `function safeCreationTime` at lines 17-19 and adds `safeCreationTime` to the `../pact` import block. T5.2 explicitly forbids touching the `safeCreationTime` import (Phase 1 territory) and only edits lines 255-257 (the outer try/catch). Disjoint line regions; both edits coexist in the same atomic commit.
- **Phase 1 file overlap on `ouroFunctions.ts`.** Phase 1's T1.9 removes the inline `function safeCreationTime` at lines 118-120 (`ouroFunctions.ts`) and adds the import. T5.1 explicitly forbids touching the `safeCreationTime` import and only edits the seven catch-block sites at lines 1842, 1860, 1877, 1894, 1916, 2069, 2088. Disjoint line regions.

## Wave 1 (parallel — different files, no overlap)

- [x] T5.1 | Route all seven catch sites in `src/interactions/ouroFunctions.ts` through `getLogger().error(...)` from `../observability` (REQ-10 / F-CORE-019). Add the `getLogger` import. Place a single code comment near the catch-block sweep documenting the convention. | bee-implementer
  - requirements: [REQ-10]
  - acceptance:
    1. New import line near the top of `src/interactions/ouroFunctions.ts`: `import { getLogger } from "../observability";` — added to the existing import group, NOT replacing or modifying any other import (specifically: do NOT touch the `safeCreationTime` import — Phase 1's T1.9 territory).
    2. All seven catch sites at lines 1842, 1860, 1877, 1894, 1916, 2069, 2088 (anchored on the function names, NOT the literal line numbers — Phase 1's T1.9 will shift line numbers via the `safeCreationTime` removal at lines 118-120) route via `getLogger().error(message, error)`. The seven affected functions (anchored by name): `getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro`, `getRotateKadenaInfo`, `getUnwrapStoaTarget`, `checkCoinAccountExists`.
    3. The four currently-silent catches (`getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro`) bind the error parameter (e.g., `} catch (error) {`) and call `getLogger().error("Error in {functionName}:", error)` before returning the existing fallback (`"0"`). Return values UNCHANGED.
    4. The three currently-`console.error` catches (`getRotateKadenaInfo`, `getUnwrapStoaTarget`, `checkCoinAccountExists`) replace `console.error(...)` with `getLogger().error(...)` using the SAME message string and SAME error argument. Return values UNCHANGED.
    5. A single code comment near the FIRST converted catch site documents the convention. Suggested wording: `// All catch blocks below route via getLogger().error(...) from ../observability (F-CORE-019, v2.3.0)`. The exact comment text is implementer's choice as long as it identifies the convention and the F-CORE-019 finding.
    6. `grep -nE "console\.error" src/interactions/ouroFunctions.ts` returns ZERO matches AFTER T5.1 (note: lines 66, 87, 106 also currently contain `console.error` — those are NOT catch-block sites and are out of T5.1 scope; they belong to Phase 6's broader sweep per F-CORE-022. T5.1's verification grep is scoped to ensure Phase 5's seven catch sites are clean. Phase 6's broader sweep will catch the remaining three sites).
    7. NO behavior change for callers — every function still returns the same fallback (`"0"`, `null`, etc.) on error. Only the side-effect (logger invocation) is normalized.
    8. NO touching of `src/interactions/addLiquidityFunctions.ts` (T5.2 territory). NO touching of any `safeCreationTime` declaration or import (Phase 1's T1.9 territory).
  - context:
    - File: `Z:/OuronetCore/src/interactions/ouroFunctions.ts` (catch sites; current line numbers 1842/1860/1877/1894/1916/2069/2088 will shift slightly after Phase 1's T1.9 removes lines 118-120 — anchor by function name, not line number).
    - Reference: `Z:/OuronetCore/src/observability/index.ts` (Phase 6 output — barrel re-exporting `getLogger`, `setLogger`, `Logger` type).
    - Reference: `Z:/OuronetCore/src/observability/logger.ts` (Phase 6 output — module-private state + default `console.warn`/`console.error` routing per REQ-13).
    - Spec: requirements.md REQ-10 + phases.md Phase 5 description.
    - Audit-bundle source: `.bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md` F-CORE-019 section (locks the convention to routed-via-logger).
  - research:
    - Pattern: [CITED] `src/interactions/ouroFunctions.ts:1919-1922` (`getRotateKadenaInfo` already shows the routed-with-message form: `console.error("Error getting RotateKadena info:", error); return null;`) — T5.1 keeps the message/error arg shape, replaces `console.error` with `getLogger().error`. Three of seven sites already follow this shape; four sites (currently `} catch { return "0"; }`) need the error parameter bound.
    - Pattern: [CITED] `src/interactions/ouroFunctions.ts:2069-2074` (`getUnwrapStoaTarget` — second example of the existing routed shape with a domain-prefixed message).
    - Pattern: [CITED] `src/interactions/ouroFunctions.ts:2087-2093` (`checkCoinAccountExists` — third example of the existing routed shape).
    - Reuse: [CITED] requirements.md REQ-10 (lines 124-126 — "implementer of Phase 5 imports `getLogger` from the new `./observability` subpath (or relative `../observability` if landing before Phase 6's barrel is wired)"). Use the relative form `../observability` since both phases land in the same atomic commit and the source layout is two-file (`index.ts` barrel + `logger.ts` impl) per REQ-13.
    - Reuse: [CITED] phases.md Phase 5 line 47 — convention documented in code comment near the affected handlers; F-CORE-019 closure.
    - Types: [CITED] requirements.md REQ-13 (line 132) — `Logger.error(msg: string, ...args: unknown[]): void`. The seven existing catches all match this signature: a string prefix followed by an `error` value.
    - Approach: [ASSUMED] The four currently-silent catches need their `catch` clause changed from `} catch {` to `} catch (error) {` so the error reaches the logger. The closure rationale (F-CORE-019 audit) is precisely that silent catches lose diagnostic info — naming the error parameter is the minimum work to fix that. Suggested message text: `"Error in getIgnisBalance:"`, `"Error in getAccountTokenSupply:"`, `"Error in getOuroDispoCapacity:"`, `"Error in getVirtualOuro:"` (matches the existing routed catches' "Error in/getting/resolving/checking X:" convention).
    - Anti-pattern: do NOT use `console.error(...)` directly anywhere in the seven catches; the F-CORE-022 sweep is Phase 6's job, but Phase 5's seven sites must already be clean by the time Phase 6 sweeps.
  - notes:

- [x] T5.2 | Drop the dead outer try/catch on `getLPTypeInfo` at `src/interactions/addLiquidityFunctions.ts:219-258` (REQ-11 / F-CORE-021 — Option A LOCKED). Inner try/catches inside the two `Promise.all` IIFEs MUST stay intact. | bee-implementer
  - requirements: [REQ-11]
  - acceptance:
    1. The outer `try {` at line 219 (immediately after `export async function getLPTypeInfo(swpair: string): Promise<LPTypeInfo> {`) is REMOVED.
    2. The outer `} catch (error) { return { hasFrozenLP: false, hasSleepingLP: false }; }` block at lines 255-257 is REMOVED.
    3. The function body shifts left by one indent level (or whatever the implementer's editor produces — formatting is a side-effect).
    4. The two inner try/catches at lines 223-232 and 237-246 (the `(async () => { try { ... } catch { return false; } })()` IIFEs inside `Promise.all`) MUST remain UNCHANGED. They are the load-bearing handlers; the audit-spec rationale is that future regressions to these inner catches must surface as real failures rather than silently masking under the dead outer handler.
    5. The success-path `return { hasFrozenLP: frozenCheck, hasSleepingLP: sleepingCheck };` at lines 250-253 (after dedent) is preserved verbatim.
    6. NO touching of `src/interactions/ouroFunctions.ts` (T5.1 territory). NO touching of the inline `function safeCreationTime` at lines 17-19 or the `safeCreationTime` import (Phase 1's T1.3 territory).
    7. NO addition of "belt-and-braces" comments documenting the dropped handler — Option A LOCKED explicitly rejects that alternative per spec-review iter 1 I-001. The git history is the documentation.
    8. Typecheck passes (the `Promise<LPTypeInfo>` return type is satisfied by the inner success path; `hasFrozenLP`/`hasSleepingLP` are both boolean as the inner IIFEs always resolve to a boolean).
  - context:
    - File: `Z:/OuronetCore/src/interactions/addLiquidityFunctions.ts` (lines 218-258 — entire `getLPTypeInfo` function body; only the outer try/catch is dropped).
    - Spec: requirements.md REQ-11 + phases.md Phase 5 line 48 + spec.md:42 (closure rationale: "future regressions in inner catches surface as real failures").
    - Audit-bundle source: `.bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md` F-CORE-021 section.
  - research:
    - Pattern: [CITED] `src/interactions/addLiquidityFunctions.ts:218-258` (function definition with outer try/catch at 219 + 255-257 surrounding two inner IIFEs at 222-233 and 236-247, each with its own try/catch at 223-232 and 237-246).
    - Reuse: [CITED] requirements.md line 80 — F-CORE-021 dead-code rationale: "Promise.all of two never-rejecting promises cannot itself reject." The inner IIFEs are typed `Promise<boolean>` (always resolve to `false` on failure via inner catch), so `Promise.all([Promise<boolean>, Promise<boolean>])` is `Promise<[boolean, boolean]>` which never rejects.
    - Reuse: [CITED] requirements.md line 126 — "the closure rationale documented in `spec.md:42` only holds under Option A" — confirms Option A (drop) is locked, NOT Option B (comment as belt-and-braces).
    - Types: [CITED] `LPTypeInfo` (defined elsewhere in same file or `../types`; structural shape `{ hasFrozenLP: boolean; hasSleepingLP: boolean }` per the success-path return). The function's return type is unchanged after the edit.
    - Approach: [ASSUMED] The implementer will use the Edit tool to remove the two specific lines (`try {` after the function brace and the three-line catch block at the end), letting the editor handle re-indentation. No new code is added. No tests pre-existed for this dead-code path (the audit-spec confirms there is no test coverage of the outer catch — that's how it survived as dead code).
  - notes:

## Wave 2 (depends on Wave 1)

- [x] T5.3 | Add ≥1 console-spy test (NFR-04 minimum 3 across the spec; Phase 5's contribution can be 1+ since Phase 2/3/6 each add ≥3 of their own, AND Phase 5's audit-bundle line 49 says "no new test cases required by this phase" — but per defensive practice we add a single console-spy assertion test pinning the routed convention). | bee-implementer | needs: T5.1
  - requirements: [REQ-10]
  - acceptance:
    1. New test file or new test case in an existing test file that:
       - Mocks `getLogger` via `vi.mock("../src/observability", ...)` OR uses `vi.spyOn(getLogger(), "error")` after importing the real module.
       - Calls one of the seven affected functions (suggest `getRotateKadenaInfo` since it's the easiest to drive through the catch path — invoke it with a stubbed `pactRead` that throws). Alternatively, mock `pactRead` via `setPactReader` to throw, then invoke a silent-form function (`getIgnisBalance`) — this exercises the previously-silent path that Phase 5 normalized to routed.
       - Asserts that `getLogger().error` was called exactly once (or `console.error` was NOT called directly — same assertion via `vi.spyOn(console, "error")` returning ZERO calls).
       - Asserts the function still returns its documented fallback (`"0"` for `getIgnisBalance` etc., `null` for `getRotateKadenaInfo`).
    2. Test passes locally via `npx vitest run <test-file>`.
    3. NO test against the dropped outer catch on `getLPTypeInfo` — that path was dead code with no prior coverage; adding a test for it would assert Promise.all-of-never-rejecting behavior which is structural and not what the F-CORE-021 closure asserts. The closure rationale is "future regressions surface as real failures" which is itself unfortunately not directly testable (it's a property of NOT having a handler that swallows things).
    4. NFR-05 — no new "Open handles" warnings from vitest.
  - context:
    - File: `Z:/OuronetCore/src/interactions/ouroFunctions.ts` (post-T5.1 state).
    - File: `Z:/OuronetCore/src/observability/index.ts` (Phase 6 barrel — for the mock target).
    - Reference: `Z:/OuronetCore/tests/encryption.test.ts` (existing console-spy test pattern at the only `vi.spyOn(console, "warn"|"error")` call site in the test tree).
    - Reference: `Z:/OuronetCore/src/reads/pactReader.ts:33-71` (`setPactReader` seam — used to inject a throwing reader for the test).
    - Spec: requirements.md REQ-10 + NFR-04 + Reusability "Existing `tests/encryption.test.ts` console-spy pattern" hint at line 165.
    - T5.1 notes (read at runtime).
  - research:
    - Pattern: [CITED] `tests/encryption.test.ts` (located via `vi.spyOn(console, ['"](warn|error)['"])` grep — only file with the pattern in `tests/`). Used by v2.2.0's T2.5 #4 per requirements.md line 165 hint. Mirror the spy-then-restore shape: `const spy = vi.spyOn(getLogger(), "error").mockImplementation(() => {});` … `expect(spy).toHaveBeenCalledTimes(1);` … `spy.mockRestore();`.
    - Reuse: [CITED] `src/reads/pactReader.ts` `setPactReader(fn)` seam (per CLAUDE.md line documenting the seam). Inject a reader that throws to drive the catch path.
    - Reuse: [CITED] requirements.md NFR-04 (Phase 5 adds tests defensively; the spec's per-phase minimum is "3 cases each" only for Phases 2/3/6 — Phase 5 is explicitly NOT in that list per requirements.md line 156, and phases.md Phase 5 line 49 says "no new test cases required by this phase"). T5.3 still adds one defensive case to pin the routed convention so a future regression to silent catches OR direct `console.error` would break the test.
    - Context7: [VERIFIED] vitest `vi.spyOn` API — standard practice for mocking method calls without modifying production code. (vitest stable API since v0.x; no version risk.)
    - Approach: [ASSUMED] The implementer chooses between two approaches: (a) `vi.mock("../../src/observability", ...)` to substitute the entire module (cleaner), or (b) `vi.spyOn(getLogger(), "error")` against the real default logger (less intrusive). Either is acceptable as long as the assertion verifies the routed call.
  - notes:

- [x] T5.4 | Verification gate for Phase 5: post-Wave-1 grep checks + typecheck + scoped-test pass. | bee-implementer | needs: T5.1, T5.2, T5.3
  - requirements: [REQ-10, REQ-11]
  - acceptance:
    1. `grep -nE "console\.error" src/interactions/ouroFunctions.ts` post-T5.1 returns the expected residual matches — these are NOT catch sites; Phase 5 owns ONLY the 7 catch sites at lines 1842/1860/1877/1894/1916/2069/2088. All other `console.error` and `console.warn` calls in this file (regardless of count — Phase 6 T6.5 enumerates ~8 total non-catch hits in this file at lines 66, 87, 106, 1165, 1194, 1310, 1462, 1478 etc; cross-plan auto-fix iter 1 per CI-003 reconciles this) are Phase 6's F-CORE-022 sweep responsibility. T5.4 documents the actual residual count in its `notes:` block as evidence — the count is informational, not a hard gate (final ZERO assertion happens at Phase 7's T7.4 + Phase 6's T6.5 + T6.7). The Phase 5 gate just confirms the 7 catch sites are routed and no other catch sites were touched.
    2. `grep -nE "console\.error" src/interactions/addLiquidityFunctions.ts` returns the expected count (none of T5.2's edits touched `console.error`; the residual count is whatever the file had before Phase 5 — likely zero or a small number; T5.4 documents the count).
    3. `grep -nE "^\s*\}\s*catch\s*\(error\)\s*\{[\s\S]*?return\s*\{\s*hasFrozenLP" src/interactions/addLiquidityFunctions.ts` (multiline) returns ZERO matches — confirms the dead outer catch on `getLPTypeInfo` is gone.
    4. `npx vitest run tests/<phase5-test-file>` passes (T5.3's test runs green).
    5. `npm run typecheck` exits 0 (no `--noEmit` regressions from the import addition or the dropped try/catch).
    6. T5.4 does NOT run `npm test` (full suite) — that's the conductor's post-wave validation per the core skill's "Scoped testing in parallel agents" rule. T5.4 is a Phase-5-internal gate.
    7. T5.4's `notes:` block records the actual greps' line counts and the test runner output as evidence (per Firm Rule R8 — "No completion claims without evidence").
  - context:
    - File: `Z:/OuronetCore/src/interactions/ouroFunctions.ts` (post-T5.1 state).
    - File: `Z:/OuronetCore/src/interactions/addLiquidityFunctions.ts` (post-T5.2 state).
    - Test file: `Z:/OuronetCore/tests/<phase5-test-file>` (post-T5.3 state).
    - Spec: requirements.md REQ-10 + REQ-11 + NFR-02 (`tests/types.test.ts` v1.7.0 type-regression lock continues to pass — verified implicitly by typecheck exit 0).
    - T5.1, T5.2, T5.3 notes (read at runtime).
  - research:
    - Pattern: [CITED] requirements.md REQ-17 line 148 — verification-gate pattern (typecheck, scoped tests, grep checks). T5.4 mirrors this at the phase level.
    - Pattern: [CITED] CLAUDE.md "Run a single test file: `npx vitest run tests/cfm-builders.test.ts`" — the scoped-test command shape.
    - Reuse: [CITED] core skill "Scoped testing in parallel agents" rule — agents run ONLY their task's test file(s); the conductor runs the full suite ONCE per wave after all agents complete. T5.4 honors this — it does NOT run `npm test`.
    - Reuse: [CITED] requirements.md NFR-02 (type-regression lock) — typecheck is the cheap gate; the full `tests/types.test.ts` assertion runs at conductor's post-wave validation.
    - Approach: [ASSUMED] T5.4 is structured as a verification task rather than a code-edit task — it produces no source-tree changes, only `notes:` evidence. The grep patterns at acceptance #1-#3 are the CITED audit-tier patterns that map directly to F-CORE-019 (zero `console.error` in catch sites of `ouroFunctions.ts`) and F-CORE-021 (zero outer try/catch in `getLPTypeInfo`).
  - notes:

## Wave Dependency Chain

```
Wave 1: T5.1 (ouroFunctions.ts)  ║ T5.2 (addLiquidityFunctions.ts)
                          \      ║      /
                           \     ║     /
                            ╲    ║    ╱
Wave 2:                      → T5.3 (test) → T5.4 (verification gate)
```

- Wave 1: T5.1 and T5.2 run in parallel — disjoint files, no shared imports beyond stdlib.
- Wave 2: T5.3 depends on T5.1 (test exercises the routed catches in `ouroFunctions.ts`). T5.4 depends on all of T5.1, T5.2, T5.3 — it is the verification gate that consumes Wave 1 + T5.3 outputs.

## Fragmentation Note

Phase 5 is intentionally small — REQ-10 and REQ-11 are both narrow, mechanical edits. The phase is structured as Wave 1 (2 parallel tasks) + Wave 2 (1 test task + 1 verification gate). A more aggressive consolidation would merge T5.4 into T5.3 (test + grep checks in the same task), but T5.4 is kept separate because:

1. T5.4 explicitly does NOT modify source — it produces `notes:` evidence per Firm Rule R8.
2. T5.4's grep checks must run AFTER both T5.1 and T5.2 (not just T5.1), so it has a fan-in dependency that doesn't fit T5.3's narrower T5.1-only fan-in.
3. Keeping the verification gate as a separate task makes its `notes:` block the single source of truth for Phase 5's closure evidence — useful for the Phase 7 changelog text generation.

`waves * 2.5 = 5` vs `tasks = 4` — formal threshold misses by one, but the genuine sequential dependency on T5.4 (fan-in from T5.1 + T5.2 + T5.3) justifies the extra wave. Acceptable per consolidation rule's escape hatch ("If a 1-task wave cannot be merged (genuine sequential dependency), keep it but note in the completion signal").

`fragmentation: warn` — single-task Wave 2 elements are documented genuine sequential dependencies, not fragmentation accidents.
