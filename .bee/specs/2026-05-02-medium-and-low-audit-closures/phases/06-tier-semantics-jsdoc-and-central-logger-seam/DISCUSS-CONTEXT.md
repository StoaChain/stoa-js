# Phase 6: Tier semantics JSDoc + central logger seam - Discussion Context

**Generated:** 2026-05-03T00:00:00Z
**Mode:** Locked decisions inherited — auto-skipped discuss

<decisions>
- F-CORE-020 (REQ-12): JSDoc on pactReader.ts + rawCalibratedRead.ts:40-46. Canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static). Default reader IGNORES tier; consumers wanting cache call setPactReader. NODE_ENV runtime warning DROPPED (LOCKED iter 1 advisory #2).
- F-CORE-022 (REQ-13): NEW two-file source layout `src/observability/{index.ts,logger.ts}`. Mirrors setPactReader pattern (module-private state + accessor pair). Logger type, setLogger, getLogger. Default routes to console.warn/console.error.
- Null-rejection LOCKED: `setLogger(null)` throws `TypeError` with message exactly `setLogger requires a non-null Logger`.
- package.json exports map gains `./observability` subpath.
- Sweep all `console.warn`/`console.error` in `src/` to route via `getLogger()`. Carve-outs: Phase 5 owns 7 ouroFunctions.ts catch sites; Phase 3 already removed guardUtils.ts:78.
- ≥4 new tests (default routing, setter swap, getter identity, null-rejection TypeError + exact message).
</decisions>

**Sequencing note:** Phase 6 executes BEFORE Phase 5 per cross-plan I-001 lock — Phase 5's catch-block routing imports `getLogger` from `../observability`; Phase 6's source files must exist on disk before Phase 5's tests can run. Atomic-ship intra-commit ordering — both still land in the single v2.3.0 commit.
