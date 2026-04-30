# Bee Project State

## Current Spec
- Name: consolidate-ikadenakeypair
- Path: .bee/specs/2026-04-30-consolidate-ikadenakeypair/
- Status: IN_PROGRESS

<!-- Valid Status values:
  NO_SPEC       — No active spec; project is idle or between features.
  SPEC_CREATED  — Spec document exists but no phases have been executed yet.
  IN_PROGRESS   — At least one phase has moved past the planned stage.
  COMPLETED     — All phases committed and review-implementation is done.
  ARCHIVED      — Developer ran archive-spec; spec is stored in history.
-->

## Phases
| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|-------------|----------|----------|--------|-----------|
| 1 | Type Consolidation | REVIEWED | Yes | Yes (3) | Yes | Yes (2) | | |
| 2 | Type-Level Regression Lock | REVIEWED | Yes | Yes (3) | Yes | Yes (2) | | |

<!-- Valid Phase Status values:
  PENDING       — Phase exists but planning has not started.
  PLANNED       — Phase has been planned; TASKS.md created with task breakdown and waves.
  PLAN_REVIEWED — Phase plan has been reviewed and approved; ready for execution.
  EXECUTING     — Phase is currently being executed; wave-based task implementation in progress.
  EXECUTED      — All tasks in the phase completed; implementation is done.
  REVIEWING     — Code review is in progress for this phase.
  REVIEWED      — Code review complete; all findings resolved or accepted.
  TESTING       — Manual test scenarios are being verified for this phase.
  TESTED        — All test scenarios passed; phase is ready to commit.
  COMMITTED     — Phase changes have been committed to version control.
-->

## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|

## Audit History

| Date | Risk Level | Critical | High | Medium | Low | Specs Generated |
|------|-----------|----------|------|--------|-----|----------------|
| 2026-04-30 | HIGH | 1 | 11 | 14 | 6 | 10 |

## Decisions Log

<!-- Structured decision entry format:
  Each entry records an autonomous decision made during ship or plan-all execution.

  Format:
  - **[WHAT]:** Brief description of the decision made.
  - **Why:** Reasoning behind the choice.
  - **Alternative rejected:** What option was considered but not chosen, and why.
-->

- **[Plan review auto-fix]:** Auto-fixed 7 issues in Phase 1 plan (iteration 1) — bug-detector flagged missing positive-preservation greps in T1.4 and T1.8; stack-reviewer flagged a coilFunctions line-number error (V-001), a missing negative grep in T1.5 against value→type-position drift on IOuroAccountKeypair (V-002), an incomplete risk-anticipation list in T1.9 missing the seedType-widening surface (V-003), an ambiguous `.d.ts` spot-check assertion in T1.11 contradicting its own context paragraph (V-004), and over-escaped backticks in T1.8 research notes inviting a copy-paste regression (V-005). Pattern-reviewer and plan-compliance-reviewer were clean.
- **Why:** Plan review found issues that could be resolved automatically without user input — all fixes were tightening acceptance criteria with concrete verification commands or correcting documentation inconsistencies.
- **Alternative rejected:** Stopping for manual fix — plan-all is autonomous; auto-fix is faster and consistent.

- **[Plan review auto-fix]:** Auto-fixed 1 residual issue in Phase 1 plan (iteration 2) — stack-reviewer found V-001's iter-1 fix only partially landed: the comment was relabeled to "Line 8 (trailing)" but the actual coilFunctions.ts has `../constants` on lines 1-6 (not 1-7), `../pact` on line 7 (not 8), and the comment standalone on line 8. Off-by-one persisted in both the context and research sub-blocks of T1.4. Bug-detector, pattern-reviewer, plan-compliance-reviewer all clean in iter 2.
- **Why:** Documentation accuracy in the planning artifact reduces implementer ambiguity; grep-based acceptance criteria already catch end-state, but the line-number map is the implementer's reading guide and must reflect reality.
- **Alternative rejected:** Stopping for manual fix — single mechanical correction; auto-fix preserves autonomous loop guarantee.

- **[Plan review auto-fix]:** Auto-fixed 1 final residual at iteration 3 (max iterations) — stack-reviewer found a missed `../pact` reference at TASKS.md:142 in the context-block target-shape (still said "currently line 8" while the research-block copy at line 174 was correctly fixed to line 7). Same V-001 off-by-one class. Iteration 3 was the cap (`ship.max_review_iterations: 3`). Auto-fixed; "Delete targets" reworded to clean line-range form for consistency.
- **Why:** A trailing one-line documentation residual; mechanical fix; declining it would have left the plan with an internal contradiction (research-block correct, context-block wrong).
- **Alternative rejected:** Logging unresolved and proceeding — would have left a trivially-fixable inconsistency in the plan that the implementer would reasonably read as authoritative.

- **[Plan review auto-fix]:** Auto-fixed 3 issues in Phase 2 plan (iteration 1) — bug-detector found one CRITICAL plan-correctness gap and two smaller defense-in-depth issues. (1) F-001 CRITICAL: T2.0's vitest config edit was incomplete — vitest v4's `test.typecheck.include` defaults to `*-d.{ts}` glob NOT `test.include`, so setting only `enabled: true` would typecheck zero files and silently false-pass T2.2's regression-lock gate. Fixed by explicitly mandating `typecheck.include: ["tests/**/*.test.ts"]` in T2.0's acceptance + research. (2) F-002 HIGH: T2.4's manual sanity-check experiment lacked explicit safety guidance — added "Safety guidance" preamble forbidding `git reset --hard` and `git commit` of the transient drift; tightened the research-note revert command. (3) F-003 MEDIUM: T2.2 verification was negative-only (no `error TS` lines) — added positive-visitation grep proof that vitest's typecheck section actually visited `tests/types.test.ts`. Pattern-reviewer, plan-compliance-reviewer (2 advisories, no realignment needed), stack-reviewer (skipped — no built-in stack skill) all clean.
- **Why:** F-001 was a load-bearing correctness gap that would have shipped a no-op regression lock. F-002 + F-003 are defense-in-depth fixes that prevent silent regressions in future config refactors.
- **Alternative rejected:** Stopping for manual fix — plan-all is autonomous; auto-fix is faster and consistent. Accepting F-001 as-is would have made Phase 2 ship a regression lock that locks nothing.

- **[Plan review auto-fix]:** Auto-fixed 1 issue in Phase 2 plan (iteration 2) — bug-detector found that the iter-1 F-003 fix introduced a NEW HIGH bug. The positive-visitation grep regex `\[typecheck\].*tests/types\.test\.ts|tests/types\.test\.ts.*\(typecheck\)` uses label patterns vitest v4 NEVER emits. Per `node_modules/vitest/dist/chunks/index.UpGiHP7g.js:2349,3009`, vitest v4's default reporter prefixes typechecked files with a literal ` TS ` label (`c.bgBlue(c.bold(" TS "))`), and the word `typecheck` only appears in the unrelated Duration summary line. The grep would return zero hits on a fully correct run, blocking T2.2 completion. Fixed by replacing with `grep -E '\bTS\b.*tests/types\.test\.ts'` plus a tolerant two-grep fallback (file-path + standalone "typecheck" word in stdout). Pattern-reviewer, plan-compliance-reviewer, stack-reviewer all clean in iter 2.
- **Why:** Iter-1's F-003 fix was based on plausible-but-wrong assumptions about vitest output format. Iter-2 corrected to the actual format verified against vitest 4 reporter source. Without this fix, T2.2's positive-visitation guard would itself produce false negatives.
- **Alternative rejected:** Reverting F-003 entirely — would have left T2.2 vulnerable to the silent zero-files-collected false-pass that F-003 was meant to catch.

- **[Cross-plan auto-fix]:** Auto-fixed 4 inter-phase issues across 2 phase(s) (iteration 1) — cross-plan compliance + bug-detector reviewers both flagged real planning ambiguities at the Phase 1 ↔ Phase 2 boundary. (1) CI-001 / F-XPHASE-002 MEDIUM: T2.1's `Parameters<typeof fn>[N]` assertion idiom incorrectly assumed each interactions subpath exports a function with a DIRECT `IKadenaKeypair` parameter. In reality, `kpayFunctions` and `coilFunctions` do (direct positional), but `dexFunctions` and `activateFunctions` have `IKadenaKeypair` NESTED inside parameter-struct interfaces (`SwapExecutionParams`/`SmartSwapExecutionParams` and `DeployStandardAccountParams`). The literal suggested fixture would fail to compile. Fixed by rewriting T2.1's candidate-functions block to distinguish direct-positional vs struct-nested cases, naming real exported functions (`executeDeployStandardAccount`, `executeSmartSwapWithSlippage`, `kpayBuy`, `coilTokensGeneric`), and updating the suggested skeleton to use `Parameters<typeof fn>[0]["fieldName"]` for the struct-wrapped variants. Verification grep updated to `Parameters<typeof \w+>\[\d+\](\["[^"]+"\])?` to accept both shapes. (2) CI-002 MEDIUM: ROADMAP.md Phase 2 Success Criterion #2 literally said "imports IKadenaKeypair from each of the 5 subpaths" — contradicts post-Phase-1 reality (TS2305). Fixed ROADMAP.md to match TASKS.md's `Parameters<typeof fn>` idiom. (3) CI-003 MEDIUM: T2.1 suggested skeleton used placeholder function names (`activateAccount`, `addLiquidity`, `kpaySomething`, `coilSomething`) that don't exist in the source. Fixed alongside CI-001 by replacing with real names. (4) F-XPHASE-001 MEDIUM: T2.0's `typecheck.include` glob `["tests/**/*.test.ts"]` would retroactively typecheck the 12 pre-existing test files which have NEVER been typechecked under `tsc --noEmit` (root tsconfig.json excludes tests/). Latent type errors in any of them would surface as Phase 2 commit blockers appearing unrelated to IKadenaKeypair. Fixed by narrowing `typecheck.include` to ONLY `["tests/types.test.ts"]`; broadening is deferred to a future spec when the 12 existing files are confirmed type-clean.
- **Why:** All 4 are structural problems that would surface as bugs during Phase 2 execution. CI-001/CI-003 would cause T2.1 to ship a non-compiling test file. CI-002 was a documentation contradiction. F-XPHASE-001 would block Phase 2 commit on unrelated latent bugs in pre-existing test files.
- **Alternative rejected:** Letting the implementer figure out the function-name + assertion-shape choices at execute time — would cost 1-2 debug cycles per subpath and risk the regression lock landing with a non-compiling assertion.

- **[Cross-plan auto-fix]:** Auto-fixed 2 inter-phase issues across 1 phase (iteration 2) — cross-plan reviewers found that the iter-1 fixes only partially landed. (1) F-XPHASE-003 HIGH: T2.0's iter-1 narrowing landed in the acceptance criterion (line 42) but the research-note code-block sample at line 60 still showed the broad `["tests/**/*.test.ts"]` glob. Implementer copying the research-block sample verbatim would re-introduce the original F-XPHASE-001 retroactive-typecheck bug AND fail the acceptance grep `grep -c '"tests/types.test.ts"'`. Fixed by updating the code-block sample to match the narrow single-file scope and adding inline rationale. (2) CI-002 MEDIUM (iter-2 numbering): T2.4 step 4 + research note + expected-error preview still used the placeholder `Parameters<typeof activateXXX>[N]` even though T2.1 was concretised in iter 1 to `Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]`. A reviewer following T2.4's procedure would expect a TS2322 error pointing at the placeholder shape and not match the actual error. Fixed all three sites (acceptance step 4, research-note "Why this procedure works", expected-typecheck-error preview).
- **Why:** Both are residuals of the iter-1 fixes — auto-fix didn't propagate consistently across all touch points within the same task. Iter-2 closes the gaps.
- **Alternative rejected:** Logging unresolved and proceeding — would have left two known-broken touch points (research-note sample + T2.4 placeholder) that a reviewer/implementer would reasonably read as authoritative.

- **[Auto-fix]:** Phase 1 review iter 1 — 2 distinct fixes applied (4 reviewer findings consolidated). (1) Deleted off-spec `tests/wrap-functions-import.test.ts` that T1.7 implementer created outside its acceptance scope. The file used `node:fs.readFileSync` + regex matching against source-text — a pattern not found in any of the 12 baseline test files. F-001 (HIGH bug-detector), D-001/D-002 (MEDIUM pattern-reviewer same-class incompleteness), OS-001 (MEDIUM plan-compliance over-scope) all converged on this single fix. Test count restored from 322 to baseline 320. (2) D-003 (MEDIUM pattern-reviewer): moved `import type { IKadenaKeypair } from "../signing";` to the END of the contiguous import block in 4 files (activate, dex, addLiquidity, wrap; guard was already compliant), matching the pensionFunctions:12 / urStoaFunctions:20 precedent. F-002 (MEDIUM bug-detector dexFunctions export-after-imports) was explicitly out of REQ-06 scope — no fix. typecheck + 320/320 tests pass post-fix.
- **Why:** F-001/D-001/D-002/OS-001 were a single root cause (off-spec test file). Deleting it eliminated test count drift, brittle source-grep style, and same-class asymmetric coverage in one stroke. D-003 was structural-only with concrete fix and matching codebase precedent.
- **Alternative rejected:** Keeping the off-spec test — would have invalidated Phase 2's count baseline (T2.2 expects 320+1=321 post-Phase-2; with the rogue file we'd hit 323 and the regression-lock interpretation gets ambiguous).

- **[Optimistic-continuation]:** T2.2 positive-visitation grep returned no matches in vitest 4.1.5's piped output — the `\bTS\b.*tests/types\.test\.ts` regex and `tests/types.test.ts` literal substring don't appear in `tee`-captured stdout. Initially accepted T2.2 as PASS based on `Type Errors: no errors` and measurable `typecheck X.XXs` duration; subsequent T2.4 manual experiment falsified that acceptance — see [Auto-fix] below.
- **Why:** Initial pass was based on indirect evidence; the canonical proof had to wait for T2.4's manual experiment.

- **[Auto-fix]:** Phase 2 review iter 1 — CRITICAL fix applied. T2.4 manual experiment empirically demonstrated that vitest 4.1.5's typecheck mode does NOT actually fire the regression lock when configured with `typecheck.include = ["tests/types.test.ts"]` against the project tsconfig. Bug-detector traced root cause to vitest source (`node_modules/vitest/dist/chunks/index.UpGiHP7g.js:1547-1561`): vitest spawns tsc with NO test file CLI args, relies on the resolved tsconfig's `include`. Since `tsconfig.json:23` is `["src/**/*.ts"]`, the test file was invisible to tsc. The plan's "VERIFIED" claim that vitest "adds test files directly to the tsc program" was empirically wrong for vitest 4.1.5. Plan-compliance reviewer flagged this as SG-001 HIGH (REQ-13 unmet under spec-named gate). Fix: created `tsconfig.tests.json` extending root tsconfig with `include: ["src/**/*.ts", "tests/types.test.ts"]` (narrow — only the regression-lock file, not the broad `tests/**/*.ts` which would have pulled in 12 pre-existing test files with latent unused-locals violations in strategy.test.ts:275,391). Updated vitest.config.ts to set `typecheck.tsconfig: "tsconfig.tests.json"`. Re-ran T2.4 drift experiment with fix in place: lock fires correctly — exit 1 with `TS2322 "foreign" is not assignable to "koala" | "chainweaver" | "eckowallet" | undefined` at tests/types.test.ts:62. After git stash pop: exit 0 / clean. REQ-13 now properly enforced under npm test as the spec mandates.
- **Why:** Without this fix the entire Phase 2 deliverable (regression lock) was a no-op — F-CORE-001 (the CRITICAL audit finding the spec was designed to close) would have silently re-opened on any future PR that drifted IKadenaKeypair.
- **Alternative rejected:** (a) Broad `tests/**/*.ts` include — would surface latent unused-locals errors in pre-existing test files, breaking baseline test runs (out of scope for this spec). (b) Modifying root tsconfig — too invasive, breaks build pipeline assumptions. (c) Using expectTypeOf runtime path — would require rewriting tests/types.test.ts and changes the regression-lock failure mode.

- **[Auto-fix]:** Final implementation review — 2 findings fixed. (1) MEDIUM doc-fix: bug-detector noted regression lock catches `seedType: "foreign"` drift but NOT `unknown → any` weakening (TS accepts unknown→any assignment). Updated tests/types.test.ts JSDoc to accurately document coverage scope (seedType lock is load-bearing; encryptedSecretKey width intentionally not locked). (2) HIGH public-API-break fix: audit-bug-detector traced consumer flow — Phase 1 deleted `export interface IKadenaKeypair` from 4 interactions files but only added `import type` (consumption-only, does NOT re-export). Consumers using `import { IKadenaKeypair } from "@stoachain/ouronet-core/interactions/dexFunctions"` (etc.) would hit `TS2305: has no exported member`, violating the spec's stated "non-breaking widening" NFR (spec.md:74). Fixed by appending `export type { IKadenaKeypair } from "../signing";` to each of 4 files (activate, dex, kpay, coil). `export type` is erased from emitted JS — public API restored, F-INT-001 IKadenaKeypair half stays broken (no runtime edge). All 5 verification steps passed: typecheck/tests/build clean, drift test fires lock, consumer-pattern simulation compiles.
- **Why:** F-BUG-001 was a real public-API regression contradicting the spec's NFR — would have broken OuronetUI/HUB consumer code on upgrade. The fix is minimal (4 one-line additions) and uses `export type` to avoid re-introducing the runtime cycle edge that Phase 1 broke. plan-compliance ran final pass: 0 findings (F-CORE-001 closed: 6 → 2 declarations). The doc-fix on `unknown → any` was secondary — the JSDoc claim was wrong; the actual lock semantics are correct for the load-bearing `seedType` discriminator.
- **Alternative rejected:** (a) Skipping the export-type fix and shipping the public-API break — would have surfaced as compile errors at first consumer upgrade. Spec NFR explicitly promised non-breaking widening. (b) Adding `expectTypeOf<...>().not.toEqualTypeOf<any>()` for the encryptedSecretKey lock — would have required rewriting the test file's assertion shape and is unjustified given the seedType lock's primacy.

## Last Action
- Command: /bee:ship
- Timestamp: 2026-04-30T00:00:00Z
- Result: Ship complete — 2 phases shipped (16 tasks), final implementation review found 2 issues (1 HIGH public-API break + 1 MEDIUM doc), both auto-fixed. F-CORE-001 closed.
