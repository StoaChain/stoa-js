# Phase 1: Production Fix and Module-Private Helper - Discussion Context

**Generated:** 2026-05-02T01:00:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Pure infrastructure phase: one-function rewrite + one new module-private helper, both in `src/network/nodeFailover.ts`. No user-facing behavior to discuss. All decisions are spec-locked in TASKS.md acceptance criteria (auto-fix iter 1 + iter 2 locks documented inline).
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase. Acceptance criteria in TASKS.md are spec-locked.

### Carried Forward (from spec/requirements review)
- BOTH `attemptedBaseUrl` AND `attemptedPrimaryBaseUrl` captured at fn-entry (auto-fix iter 1 lock per F-001/F-002/F-003).
- `switchToFallback()` called UNCONDITIONALLY in retry path; relies on its line-50 idempotency (auto-fix iter 1 lock per F-002).
- `await fn(getActiveBaseUrl())` on retry call (auto-fix iter 1 lock per F-005).
- `getPrimaryBaseUrl()` placed in non-exported helpers cluster between `stopRetryLoop` line 80 and `getActiveBaseUrl` line 82 (auto-fix iter 1 lock per F-PAT-001).
- One-line JSDoc on the helper (auto-fix iter 1 lock per F-PAT-002).
- Grep `^export[[:space:]].*getPrimaryBaseUrl` returns 0 matches (automated check, auto-fix iter 1 lock per F-004).
</decisions>
