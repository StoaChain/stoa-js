# Phase 3: getFailoverClient factory + 81-site migration - Discussion Context

**Generated:** 2026-05-01T15:30:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. Pure technical edits: create failoverClient.ts module with runWithTimeout + getFailoverClient factory, refactor Phase 2's inline block to consume runWithTimeout, migrate 81 chain-call sites across 11 interaction files. No user-facing behavior to discuss.
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase. Acceptance criteria in TASKS.md are spec-locked.

### Carried forward (from Phase 1 + Phase 2)
- `getActivePactUrl(chainId)` is the failover-aware default URL resolver (Phase 1 T1.3)
- `withFailover(fn)` line-116 classifier matches `err?.name === "AbortError"` (existing nodeFailover.ts)
- `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)` factory (Phase 2 T2.1)
- `readTimeoutMs?: number` field convention in PactReader options (Phase 2 T2.3)
- Inline Promise.race + AbortController + outer-boundary catch pattern proven in rawCalibratedRead.ts (Phase 2 T2.2)
- Phase 2 F-001 fix: `new Promise<never>(...)` annotation pattern for timeout-reject promises preserves `Promise<T>` return type
- runWithTimeout uses controller-factory signature `fn: (controller: AbortController) => Promise<T>` (LOCKED per F-301)
- Default timeouts: read 15s, submit 60s, listen 180s (~6 Kadena blocks), pollOne 30s (LOCKED per REQ-09)
</decisions>
