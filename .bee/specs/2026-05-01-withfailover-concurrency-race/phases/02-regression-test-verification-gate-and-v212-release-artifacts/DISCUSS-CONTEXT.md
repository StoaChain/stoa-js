# Phase 2: Regression Test, Verification Gate, and v2.1.2 Release Artifacts - Discussion Context

**Generated:** 2026-05-02T01:30:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Pure infrastructure phase: regression test in tests/network.test.ts, verification gate (typecheck + test + build), version bump, CHANGELOG entry, README update. No user-facing behavior to discuss.
</domain>

<decisions>
## Implementation Decisions
All decisions are spec-locked in TASKS.md acceptance criteria.

### Carried Forward (from Phase 1)
- Phase 1 implementation on disk: `getPrimaryBaseUrl()` at lines 82-85, rewritten `withFailover` at lines 111-138 in `src/network/nodeFailover.ts`.
- 25 existing tests continue passing.
- typecheck exit 0.

### Locked decisions for Phase 2
- New describe name: `withFailover — concurrent retry race` (em-dash U+2014, propagated across all 4 spec docs in plan-all iter 2).
- Test isolation: option 2 (try/finally per-test) preferred — no import change required (mirrors `tests/network.test.ts:247-259` precedent).
- Gate criterion: pass if EITHER (a) `npm test` exits 0 OR (b) exits non-zero with ONLY the documented Windows locale failure (`tests/gas.test.ts > formatMaxFee`).
- Test count semantics: record PASSING count from `Tests N passed | M failed (T)` line. CHANGELOG cites Linux CI passing count (386).
- README test-count refresh: update both absolute count (385→386) and derived counter (`+39 new` → `+40 new`).
- Version bump: 2.1.1 → 2.1.2.
- CHANGELOG format: mirror v2.1.1 single-concern patch precedent.
</decisions>
