# Phase 3: Guard hardening + UnknownPredicateError - Discussion Context

**Generated:** 2026-05-02T21:00:00Z
**Mode:** Locked decisions inherited — auto-skipped discuss

<decisions>
- F-CORE-016a (REQ-04): tighten classifyGuardKind minimal shape per kind (cap/user/keyset/keyset-ref). Under-specified payloads classify as `unknown`.
- F-CORE-016b (REQ-05): normalizeKeysetRef helper at resolveGuard boundary (`src/interactions/ouroFunctions.ts:191-216`). Maps lowercase `keysetref` → camelCase `keysetRef`. Pure (non-mutating spread).
- F-CORE-016c (REQ-06): SmartAccountAuthPathsAnalysis JSDoc enumerates 4 reachable states + new optional `firstSignableButUnsatisfied?: number` field with `-1` sentinel.
- F-CORE-017 (REQ-07): NEW typed `UnknownPredicateError` class (Option B) — INLINE in `src/guard/guardUtils.ts` (NOT separate errors.ts file). Re-exported via existing `export * from "./guardUtils"` line at `src/guard/index.ts:3`. `computeThreshold` throws on unrecognized predicate; `analyzeGuard` catches and folds into `predicateRecognized: false` bit. `predicateLabel` UI helper wraps with try/catch returning `<short> (unknown predicate, of <keyCount>)`. Removes silent `console.warn` line.
- ≥3 new test cases (NFR-04 — actually plans 10+ given 4 sub-findings).
</decisions>
