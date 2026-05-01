# Phase 2: TIMEOUT error code + read-side failover wrap - Discussion Context

**Generated:** 2026-05-01T15:00:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. Pure technical edits: introduce createTimeoutError factory, extend pactReader/rawCalibratedRead options bags with readTimeoutMs, wrap dirtyRead with withFailover + Promise.race + AbortController. No user-facing behavior to discuss. All decisions are spec-locked in TASKS.md acceptance criteria.
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase. Acceptance criteria in TASKS.md are spec-locked.

### Carried forward (from Phase 1)
- `getActivePactUrl(chainId)` is the failover-aware default URL resolver (Phase 1 T1.3 wired this into rawCalibratedRead).
- `resetNodeFailover()` is exported for test isolation.
- `retryTimer.unref?.()` discipline is established in `startRetryLoop()`.
</decisions>
