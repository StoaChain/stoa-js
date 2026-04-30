# Phase 1: Wallet edge cut - Discussion Context

**Generated:** 2026-04-30T18:30:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. No user-facing behavior to discuss. All decisions are Claude's discretion.
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase.

Locked from spec/requirements/TASKS.md:
- Option B (resolver injection); resolver is publicly mutable instance property
- Default-throw with exact error string locked
- KadenaWallet.getBalance() propagates errors (no `?? "0"` fallback)
- BalanceResolver type alias (NOT interface) lives in src/wallet/types.ts
- KadenaWalletBuilder vacuously satisfied (grep evidence required)
- CLAUDE.md additive third bullet (no count flip in Phase 1; deferred to Phase 2 T2.6)
- CHANGELOG entry uses placeholder version (release coordinator decides)
</decisions>
