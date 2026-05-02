# Phase 1: safeCreationTime DRY refactor - Discussion Context

**Generated:** 2026-05-02T20:00:00Z
**Mode:** Infrastructure phase — auto-skipped discuss

<domain>
Pure mechanical refactor (REQ-01 / F-CORE-015). Byte-identical behavior. Zero new tests, zero behavior change. All 11 file targets locked in requirements.md M1 Phase 1 section. The canonical body at `src/pact/format.ts:138-140` is the single source of truth.
</domain>

<decisions>
## Implementation Decisions

All decisions LOCKED in TASKS.md (13 tasks across 3 waves). Per `audit-specs-bundling` skill: this phase is the lowest-risk in the spec, mechanical-only. Implementer discretion on import-line formatting:
- 5 files (addLiquidity, coil, ouro, pension, wrap) absorb `safeCreationTime` into existing `from "../pact"` import.
- 6 files (activate, crossChain, dex, guard, kpay, urStoa) gain a new `from "../pact"` import line.
- T1.1 produces the absorb-vs-new mapping; T1.2-T1.12 consume it.
- Out-of-scope guardrails: T1.3 must NOT touch `getLPTypeInfo` outer try/catch (Phase 5 territory); T1.9 must NOT touch ouroFunctions catch sites (Phase 5) NOR `resolveGuard` body (Phase 3 territory; cross-plan auto-fix iter 2 per CI-002+CI-006).
</decisions>
