# Decisions Log: arch-layering-and-seams

Extracted from `.bee/STATE.md` at completion time. All autonomous decisions made during the spec lifecycle.

## Final implementation review (4 findings auto-fixed)

- **[Final-review auto-fix]:** Final implementation review (full spec mode, 5 agents) found 4 findings: 1 HIGH (CHANGELOG migration guidance was type-incompatible — said "OuronetUI plugs in `interactions/kadenaFunctions.getBalance`" but that returns `BalanceItem` not `string`), 2 MEDIUM (test no-mutate-on-error invariant not actually pinned; unused `beforeEach` import), 1 LOW (regression-guard test JSDoc overclaimed coverage of unwrap branches). All auto-fixed: CHANGELOG now spells out the wrap adapter `(addr) => getBalance(addr).then(r => r.balance ?? "0")`; new test added for stale-balance-on-rejection-after-success; unused import removed; JSDoc downgraded to honest scope statement. Tests 345 → 346 (one new no-mutate-on-error test). All passing.
- **Why:** Cross-phase contract drift between CHANGELOG narrative and actual type signatures. Catching this now prevents downstream consumer pain.
- **Alternative rejected:** Re-running final review after fixes — autonomous final review is single-pass per spec; remaining drift would surface in spec-completion audit.

## Cross-plan auto-fix (7 cross-phase issues, iter 1)

- **[Cross-plan auto-fix]:** Auto-fixed 7 cross-phase issues (iteration 1):
  1. F-XP-001 CRITICAL — T2.7 + T2.6 grep `"interactions" dist/wallet/*.js` would catch JSDoc text from T1.1 because tsconfig.build.json doesn't strip comments; switched both to import-graph-only regex `(from|require\()\s*['\"][^'\"]*interactions`.
  2. F-XP-002 / CI-003 HIGH — orphaned CLAUDE.md "Two→Three" count flip; assigned to T2.6 deliverable.
  3. CI-002 / F-XP-003 MED — CHANGELOG insertion ambiguity; T2.6 acceptance now mandates "edit T1.5's placeholder IN PLACE, do NOT insert second top entry".
  4. CI-001 MED — simulateTransaction stub envelope shallow; added `data` field to stub catalog.
  5. CI-004 MED — tier source-of-truth ambiguity; locked Goal block (lines 18-27) as authoritative, NOT Wave-1 notes.
  6. CI-005 MED — getLPTypeInfo IIFE-aware assertion gap; switched from `>= 2` to exact `toHaveBeenCalledTimes(2)`.
  7. CI-006 LOW (error-string drift) — accepted as-is, drift surface acknowledged but no fix applied (low blast radius).
- **Why:** Cross-plan review surfaced 1 CRITICAL + 2 HIGH + 4 MED inter-phase issues after both phases were individually plan-reviewed clean. The CRITICAL (T2.7 grep failing on JSDoc) is a real defect that would block phase exit. All resolvable autonomously.
- **Alternative rejected:** Stopping for manual fix — autonomous mode; cross-phase contract drift is exactly what cross-plan review is designed to catch and auto-fix.

## Phase 2 plan-review (3 iterations, 6 findings)

- **[Plan review auto-fix]:** Phase 2 plan-review converged in 3 iterations after fixing 6 total findings: iter 1 = 4 (1 HIGH non-existent test file + 3 MED pattern deviations), iter 2 = 1 MED arithmetic mismatch (14 vs 15 it-blocks across 4 sites), iter 3 = 1 MED stale leftover at TASKS.md:450 (5th instance of the arithmetic). All findings auto-resolved. Bug-detector + plan-compliance were CLEAN throughout; stack-reviewer skipped (no typescript-library skill).
- **Why:** Plan review surfaced 1 HIGH + 3 MED pattern deviations. All resolvable autonomously without scope expansion.
- **Alternative rejected:** Stopping for manual fix — autonomous mode; all findings were locked-decision propagation gaps.

## Phase 1 plan-review (3 iterations, 11 findings)

- **[Plan review auto-fix]:** Phase 1 plan-review converged in 3 iterations after fixing 11 total findings: iter 1 = 8 (1 HIGH + 7 MED), iter 2 = 2 (1 HIGH grep pattern propagation gap + 1 MED context/acceptance contradiction), iter 3 = 1 (HIGH same-class issue: narrow grep pattern still in upstream requirements.md + ROADMAP.md). All findings auto-resolved. Spec docs updated to use broadened grep pattern uniformly across TASKS.md (5 sites), requirements.md (REQ-01 line 79), and ROADMAP.md (table line 7, criterion line 24).
- **Why:** Plan review surfaced cascade of related issues. Iteration-by-iteration narrowing converged on a clean spec.
- **Alternative rejected:** Stopping for manual fix — autonomous mode; all findings were mechanical propagations of one earlier locked decision.

## Pre-spec context (mega-spec abandonment)

- **[Spec abandoned]:** The bundled v2.0.0 mega-spec `remaining-audit-fixes` was abandoned mid-plan-all (Phase 1 plan-review iteration 2 in progress). User decision: process the 9 remaining audit-spec files one-by-one as individual specs instead of bundling them. The arch-layering-and-seams spec is the first of these one-by-one specs.
- **Why:** One-spec-at-a-time gives finer review-loop control and avoids cross-phase coordination tension that surfaced during the mega-spec's iteration loops.
- **Alternative rejected:** Continuing the mega-spec — the per-phase reviewer auto-fix loops were converging but slowly, and the user preferred the proven spec-by-spec workflow that shipped v1.7.0 successfully.
