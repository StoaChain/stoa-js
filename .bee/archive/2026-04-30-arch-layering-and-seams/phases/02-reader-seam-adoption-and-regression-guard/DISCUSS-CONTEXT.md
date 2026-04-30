# Phase 2: Reader seam adoption and regression guard - Discussion Context

**Generated:** 2026-04-30T18:30:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. No user-facing behavior to discuss. All decisions are Claude's discretion.
</domain>

<decisions>
## Implementation Decisions
All decisions are Claude's discretion for this infrastructure phase.

Locked from spec/requirements/TASKS.md:
- 16 site migrations with locked tier mappings (T1/T2/T5/T7 per site)
- simulateTransaction signature refactor (transaction → pactCode), public-API break
- Sim-before-submit + submit/listen/poll sites NOT touched (~43 legitimate sites)
- import { pactRead } from "../reads" added to 3 files (kadenaFunctions, wrapFunctions, addLiquidityFunctions); already in crossChainFunctions
- BalanceItem export preserved verbatim in kadenaFunctions.ts
- vitest behavioral regression guard at tests/interactions-read-seam.test.ts (15 it-blocks)
- Test imports use barrel `from "../src/reads"` (NOT deep path)
- T2.6 edits T1.5 placeholder IN PLACE (no second top entry)
- T2.6 flips CLAUDE.md "Two→Three" count (deferred from Phase 1)
- T2.7 build-graph grep uses import-graph-only regex (NOT substring grep — JSDoc preserves "interactions" word)
</decisions>
