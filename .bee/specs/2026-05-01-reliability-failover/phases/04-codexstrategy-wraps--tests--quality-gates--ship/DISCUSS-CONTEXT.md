# Phase 4: codexStrategy wraps + tests + quality gates + ship - Discussion Context

**Generated:** 2026-05-01T16:00:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. Pure technical edits: wrap codexStrategy.ts chain calls with runWithTimeout, write 3 test deliverables (timeouts/failover-submit/network extension), run 3 quality gates, bump version + CHANGELOG. No user-facing behavior to discuss.
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase. Acceptance criteria in TASKS.md are spec-locked.

### Carried forward (from Phases 1-3)
- runWithTimeout(operation, fn, timeoutMs) controller-factory signature (Phase 3 T3.1)
- runWithTimeout rejects with raw AbortError; outer-boundary converts to SigningError(TIMEOUT) (Phase 3 T3.1)
- At codexStrategy seam, NO withFailover (consumer's PactClient is failover-responsible) — must add own outer-boundary catch in codexStrategy.execute() (Phase 4 T4.1)
- vi.useFakeTimers() same-scope pairing rule (Phase 4 T4.2)
- vi.hoisted() for submitMock in vi.mock factory (Phase 4 T4.3)
- vi.mock("@kadena/client") not vi.spyOn for native ESM (Phase 4 T4.3)
- Test count baseline shifted upward: Phase 3's failover-client.test.ts contributes 18 tests already covering some REQ-14/REQ-15 invariants. Phase 4 implementers should design timeouts.test.ts and failover-submit.test.ts to AVOID duplicating runWithTimeout-direct invariants — focus on getFailoverClient-method-level coverage and codexStrategy seam coverage.
- Phase 4 minimum count: ≥363 (= 346 baseline + ≥15 new it-blocks). Current state already at 363 from T3.1, so additional Phase 4 tests push higher.
- pre-existing tests/gas.test.ts > formatMaxFee Windows locale failure (1 failing test, not Phase-related)
</decisions>
