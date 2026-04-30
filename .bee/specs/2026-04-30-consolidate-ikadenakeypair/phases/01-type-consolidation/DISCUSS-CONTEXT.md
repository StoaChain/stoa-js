# Phase 1: Type Consolidation - Discussion Context

**Generated:** 2026-04-30T00:00:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. Pure TypeScript type-graph refactor: delete duplicate `IKadenaKeypair` declarations from 4 interactions/* files (plus a sibling `IOuroAccountKeypair` non-exported duplicate in coilFunctions), route consumers through the canonical `../signing` barrel, add `@deprecated` JSDoc to the Phase-2b backward-compat copy in ouroFunctions, and reorder coilFunctions imports. No user-facing behavior. All decisions are locked by the spec, requirements.md, and 3 iterations of plan review.
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase, scoped strictly to the locked plan in TASKS.md. No grey areas remain after spec discovery + 3 plan-review iterations + cross-plan consistency review.
</decisions>
