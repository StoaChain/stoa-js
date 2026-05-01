# Bee Project State

## Current Spec
- Name: withfailover-concurrency-race
- Path: .bee/specs/2026-05-01-withfailover-concurrency-race/
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
| 1 | Production Fix and Module-Private Helper | REVIEWED | Yes | Yes (2) | Yes | Yes (1) | | |
| 2 | Regression Test, Verification Gate, and v2.1.2 Release Artifacts | REVIEWED | Yes | Yes (3) | Yes | Yes (2) | | |

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

(Decisions for the arch-layering-and-seams spec moved to `.bee/archive/2026-04-30-arch-layering-and-seams/DECISIONS.md` at completion time.)
(Decisions for the consolidate-ikadenakeypair spec moved to `.bee/archive/2026-04-30-consolidate-ikadenakeypair/DECISIONS.md` at completion time.)
(Decisions for the reliability-failover spec moved to `.bee/archive/2026-05-01-reliability-failover/DECISIONS.md` at completion time. Shipped as v2.1.0 in commit b9fd463.)

- **[Plan review auto-fix]:** Phase 1 plan-review iter 1: 7 findings (3 HIGH from bug-detector + 2 MEDIUM from bug-detector + 2 MEDIUM from pattern-reviewer; plan-compliance + stack CLEAN). All 7 fixed in single pass. Most critical: F-001/F-002/F-003 (same-class, HIGH) — original spec said "compare attemptedBaseUrl === getPrimaryBaseUrl() at catch", which re-reads PRIMARY_HOST at catch-time and is wrong under mid-flight setNodeConfig/resetNodeFailover races. Fix: capture BOTH URLs at fn-entry into local consts, compare against each other (no global re-read at catch). Also dropped REQ-03's redundant retry-path gate per F-002 — switchToFallback's pre-existing idempotency at line 50 handles concurrent flip correctly without an additional guard. Other fixes: F-004 added grep-based automated check that helper has no `export` keyword; F-005 added `await` to retry call for symmetry; F-PAT-001 placed helper in non-exported-helpers cluster (between stopRetryLoop line 80 and getActiveBaseUrl line 82) instead of amid exported getters; F-PAT-002 added one-line JSDoc on the helper matching getActiveBaseUrl's style. Updated spec.md, requirements.md, and TASKS.md (research note + acceptance + verification commands).
- **Why:** F-001/F-002/F-003 was a real semantic gap — the original spec text said "based on host this invocation attempted at entry time" but the implementation guidance re-read PRIMARY_HOST at catch. Capturing both URLs at entry honors the spec's stated intent. Dropping the redundant gate per F-002 simplifies the implementation AND eliminates the setNodeConfig-race incorrectness in one move.
- **Alternative rejected:** Capturing a boolean `attemptedOnPrimary = (currentHost === PRIMARY_HOST)` at entry instead of two URLs — would work, but two URLs preserves the spec's existing "URL comparison" mental model and requires only one new helper (getPrimaryBaseUrl) which was already in the spec.

- **[Plan review auto-fix]:** Phase 2 plan-review iter 1: 4 findings (2 HIGH from bug-detector + 1 MEDIUM from bug-detector + 2 MEDIUM from pattern-reviewer; plan-compliance + stack CLEAN). All 4 fixed in single pass. F-001/F-PAT-001 (HIGH/MED, same root) — T2.1's acceptance contradicted itself: rule "imports NOT modified" + recommendation "afterEach hook" requires importing afterEach. Fix: explicitly allow extending the vitest import line with `afterEach` IF the implementer chooses option 1 (afterEach hook), OR use try/finally per-test (option 2 — no import change, mirrors `tests/network.test.ts:247-259` precedent). Both paths now deterministic. F-002 (HIGH) — T2.2's acceptance demanded `npm test` exits 0 BUT the documented Windows non-en-US locale failure in `tests/gas.test.ts > formatMaxFee` makes it exit 1. Relaxed to: pass if EITHER (a) exits 0 OR (b) exits non-zero with ONLY the documented locale failure. F-003 (MED) — T2.3's README test-count refresh missed the derived `+39 new` counter at README.md:85 (delta from v2.1.0 baseline of 346). Added explicit instruction to update both `385→newCount` and `+39→+(newCount-346)` plus a final grep verifying no stale counts remain. F-PAT-002 (MED) — describe-block name renamed from "withFailover under concurrent failover" (preposition form) to "withFailover — concurrent retry race" (em-dash subject-qualifier form) matching the sibling describes at network.test.ts:143 and :239.
- **Why:** F-001's import contradiction would have left the SubagentStop hook with non-deterministic acceptance signal. F-002's exit-code mismatch would block the gate on Windows dev. F-003's derived counter was easy to miss without explicit instruction (silent staleness is the Phase 2 README's main failure mode). F-PAT-002's em-dash convention is established in the same file the test lands in; sibling describes side-by-side make stylistic drift maximally visible.
- **Alternative rejected:** Removing the afterEach option entirely (forcing try/finally) — would resolve F-001 by simplification, but loses the cleaner default for future maintainers; resolution via explicit-allow is more flexible.

- **[Plan review auto-fix]:** Phase 2 plan-review iter 2: 3 NEW findings (2 HIGH + 1 MEDIUM, all introduced by iter 1 fixes; pattern-reviewer + plan-compliance CLEAN). All 3 fixed in single pass. F-NEW-001 (HIGH) — describe-name change in TASKS.md ("withFailover — concurrent retry race") created contradiction with spec.md:41 / requirements.md:71 / phases.md:19 (all said "withFailover under concurrent failover"). Fix: Path B — updated all THREE governing documents to the em-dash form; now all 4 docs agree AND the form aligns with the sibling describe at network.test.ts:143. F-NEW-002 (HIGH) — relaxed exit-code criterion enabled Windows execution, but test-count expectations (386) assumed Linux execution; passing-count vs total-count semantics ambiguous. Fix: explicit "record PASSING count from `Tests N passed | M failed (T)` line, not total" instruction with environment-specific Linux CI / Windows dev numbers documented; CHANGELOG cites Linux CI number as canonical. F-NEW-003 (MED) — grep pattern `"385\|+39"` was shell-dialect-fragile; could substring-match `3850` etc. Fix: changed to `grep -nE '\b385\b|\+39\b'` with word boundaries.
- **Why:** Both HIGH findings were introduced by my iter 1 auto-fix attempts — F-NEW-001 by the describe-rename without propagating to spec/requirements/phases; F-NEW-002 by the exit-code relaxation without propagating to test-count semantics. Iter 2's job was catching and resolving the cascade.
- **Alternative rejected:** Path A for F-NEW-001 (revert TASKS to "withFailover under concurrent failover" preposition form) — would resolve the contradiction in 1 edit but lose the em-dash sibling-alignment; chose Path B (4 edits, all aligned) for higher long-term value.

- **[Plan review auto-fix — iter 3, max iterations reached]:** Phase 2 plan-review iter 3: 1 MEDIUM finding (F-ITER3-001, bug-detector); pattern-reviewer + plan-compliance CLEAN. Single MED is doc-precision (the leading `\b` in `\+39\b` regex is effectively a no-op against a `+` non-word character — pattern still matches correctly in the actual README; explanatory text just overstates protection). Bug detector itself confirmed "Plan-all may proceed as iter 3 is the bounded-iteration ceiling and the remaining issue is non-blocking." NOT auto-fixed — accepting as known minor doc imprecision.
- **Why:** Iter 3 confirms iter 2's three fixes (em-dash propagation, passing-count semantics, word-boundary grep) are correctly applied and have NO functional bugs. The single residual MED is a comment-precision issue with zero functional impact on the actual README content (no `+390`/`385X` adjacencies exist). Carrying the imprecision is preferable to a fourth iter (max already reached).
- **Alternative rejected:** Iterating to iter 4 to fix the doc precision — exceeds the 3-iter ceiling defined by `ship.max_review_iterations`. The finding is below the threshold for forcing additional cycles.

- **[Cross-plan auto-fix]:** Cross-plan consistency review iter 1: 0 bug-detector findings + 2 MEDIUM plan-compliance findings (CI-001 + CI-002). CI-001 (MED) — T2.1's `[ASSUMED]` research note had incorrect framing about pre-fix failure mode ("fn2 called only once on the fallback"); actual trace is fn2 called once on primary then rejects without retry. Auto-fixed: replaced `[ASSUMED]` paragraph with `[VERIFIED]` accurate trace tagged to cross-plan CI-001 lock. CI-002 (MED) — Phase 2 test only exercises sibling-flip race; doesn't test mid-flight `setNodeConfig`/`resetNodeFailover` races (which Phase 1's dual-capture also defends against). Per spec.md:84-85 "Adding more than one regression scenario ... is not required" — the floor of one scenario is satisfied; defense-in-depth scenarios are explicitly optional. NOT auto-fixed — accepting per spec's deliberate trade-off.
- **Why:** CI-001 was load-bearing for implementer correctness understanding; the prose error could mislead someone who tries to verify "fail before fix" against a non-existent failure mode. CI-002 was acknowledged by the spec authors as a known coverage gap with a "good enough" floor; spec.md explicitly leaves additional concurrency scenarios optional.
- **Alternative rejected:** Adding mid-flight setNodeConfig/resetNodeFailover test scenarios for CI-002 — exceeds spec scope. If desired, file as a follow-up audit-spec for v2.1.3+.

- **[Auto-fix]:** Phase 2 code-review iter 1: 1 HIGH (F-001/SG-001) + 1 MEDIUM (F-002); pattern-reviewer CLEAN. F-001/SG-001 (HIGH) — CHANGELOG entry dated `2026-05-02` instead of spec-mandated `2026-05-01`. Fix: changed to `## 2.1.2 — 2026-05-01` matching spec.md:56, requirements.md REQ-06, TASKS.md:95, and aligning with the v2.1.0/v2.1.1/v2.0.x pattern (all dated 2026-05-01). Version-parity self-check `grep -m1 "^## " CHANGELOG.md` now outputs the correct heading. F-002 (MED) — CHANGELOG cited audit-spec at `.bee/audit-specs-done/2026-05-02-high-withfailover-concurrency-race.md` which doesn't exist. Fix: changed citation to `.bee/audit-specs/high-withfailover-concurrency-race.md` (the actual current location) with a note about the post-archive move target.
- **Why:** The CHANGELOG date drift would have failed T2.3's locked self-check `grep -m1 "^## " CHANGELOG.md` and broken canonical-record alignment with the spec slug `2026-05-01-withfailover-concurrency-race`. The audit-spec citation pointed to a non-existent file, breaking documentation provenance.
- **Alternative rejected:** Updating the spec/requirements/TASKS to use `2026-05-02` — would propagate drift across 4 docs and conflict with sibling CHANGELOG entries; cleaner to align CHANGELOG with the spec's canonical date.

## Last Action
- Command: /bee:ship
- Timestamp: 2026-05-02T02:00:00Z
- Result: Ship COMPLETE. Phase 1 executed + reviewed (1 iter clean — 0 findings). Phase 2 executed + reviewed (2 iters — 2 findings fixed iter 1, iter 2 clean). 26 tests pass (was 25), typecheck exit 0, build clean. v2.1.2 ready: package.json + CHANGELOG (## 2.1.2 — 2026-05-01) + README updated (Status leads with 2.1.2, version history extended, test count 386 / +40 derived). Final implementation review skipped — single-task production fix + single-test regression has zero cross-phase flow surface beyond what per-phase reviews already covered.

## Previous Last Action
- Command: /bee:plan-all
- Timestamp: 2026-05-02T00:30:00Z
- Result: Both phases planned and reviewed. Phase 1 plan-reviewed iter 2 clean (7 fixes in iter 1). Phase 2 plan-reviewed iter 3 max reached (4 fixes iter 1 + 3 fixes iter 2 + 1 unresolved MED doc-precision). Cross-plan: CI-001 fixed, CI-002 accepted per spec design. plan-all COMPLETE.

## Previous Last Action
- Command: /bee:new-spec --from-discussion .bee/audit-specs/high-withfailover-concurrency-race.md
- Timestamp: 2026-05-01T19:30:00Z
- Result: Spec created: withfailover-concurrency-race (2 phases, 7 functional requirements, target v2.1.2 patch). Spec review APPROVED iteration 1 (advisory recommendations only, no blocking issues). Discovery used --from-discussion fast path; all decisions already locked in audit-spec discussion file.

## Previous Last Action
- Command: /bee:archive-spec
- Timestamp: 2026-05-01T17:30:00Z
- Result: Spec archived: reliability-failover → .bee/archive/2026-05-01-reliability-failover/. Audit-spec source filed → .bee/audit-specs-done/2026-05-01-high-reliability-failover.md. Published as v2.1.0 to npm + GitHub Release.

## Previous Last Action
- Command: /bee:ship
- Timestamp: 2026-05-01T16:30:00Z
- Result: Ship COMPLETE. 4 phases shipped, all 20 requirements covered, final review found 5 issues (3 fixed, 1 false positive, 1 out-of-scope). 385 tests pass, typecheck/build clean, v2.1.0 in package.json + CHANGELOG.

## Previous Last Action
- Command: /bee:ship
- Timestamp: 2026-05-01T16:00:00Z
- Result: Phase 3 reviewed (1 iteration, 0 fixes needed; over-scope test file accepted) -- shipping clean. Starting Phase 4 execution.

## Previous Last Action
- Command: /bee:plan-all
- Timestamp: 2026-05-01T14:00:00Z
- Result: All 4 phases planned and reviewed. Cross-plan consistency review completed (1 iteration, 4 issues fixed). plan-all COMPLETE.
