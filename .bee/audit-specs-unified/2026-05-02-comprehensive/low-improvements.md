[IMPROVEMENT] Code quality + documentation cleanup from audit

## Problem
Six LOW-severity findings from the audit. None are bugs; all are paper-cuts that pile up over time and degrade contributor onboarding, observability, or doc trust.

## Findings (6)

| ID | Title | File | Lines |
|---|---|---|---|
| F-CORE-018a | README status table lags behind v1.6.x | `README.md` | header version table |
| F-CORE-018b | CONTEXT.md interactions section missing v1.4-v1.6 additions | `.bee/CONTEXT.md` | interactions section |
| F-CORE-019 | console.error inconsistency within ouroFunctions.ts | `src/interactions/ouroFunctions.ts` | 1842, 1860, 1877, 1894 (silent) vs 1916, 2069, 2088 (logging) |
| F-CORE-020 | `tier` argument is accepted-and-ignored by default reader | `src/reads/rawCalibratedRead.ts` | 40-46 |
| F-CORE-021 | `getLPTypeInfo` outer try/catch is dead code | `src/interactions/addLiquidityFunctions.ts` | 240-288 |
| F-CORE-022 | console.warn/error scattered with no central logger | `src/network/nodeFailover.ts`, `src/crypto/v1.ts`, `src/guard/guardUtils.ts`, `src/interactions/ouroFunctions.ts` (~25 hits across 8 files) |

## Notes
These are optional improvements. Prioritize based on impact and proximity to code you're already changing. Several have natural batching points:

- **F-CORE-018a + F-CORE-018b** — both are documentation drift; fix together when next bumping the version. Land alongside any future `v1.7.x` work.
- **F-CORE-019 + F-CORE-022** — both are about logging inconsistency; F-CORE-022 (central logger seam) is the structural fix that resolves F-CORE-019 automatically. If the logger seam ships, F-CORE-019 closes for free. Note that F-CORE-022 was rated LOW per severity rules but its leverage is high — landing the seam unblocks the `console.error` removals in F-CORE-009 (security) and F-CORE-007 (error handling). **Consider promoting F-CORE-022 to its own MEDIUM spec if you have time before tackling F-CORE-009 / F-CORE-007.**
- **F-CORE-020** — documentation-only fix; pin the tier semantics in `pactReader.ts` JSDoc and add a runtime warning in dev mode if `tier` is missing.
- **F-CORE-021** — 5-minute deletion (or comment-as-defensive). Drop into the next interaction-file edit.

## Required Fixes

### F-CORE-018a — README version table
Update the README header version table from 1.3.0/1.4.0 to v1.6.1. Add a v1.6.0 section describing the new Smart-account auth-path primitives (`classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths`) and the `buildRotateSovereignPactCode` builder. Cross-reference the CHANGELOG for the per-version detail.

### F-CORE-018b — CONTEXT.md interactions section
Refresh the `.bee/CONTEXT.md` interactions section to describe the v1.4-v1.6 additions:
- v1.4: `AccountSelectorData` gains `public-key`, `sovereign`, `governor` fields
- v1.5: re-export of `Leto`/`Artemis`/`Apollo` historical primitives + `createGen1Primitive` factory + `AddressPrefixPair` type
- v1.6: Smart Ouronet Account auth-path resolution primitives + `buildRotateSovereignPactCode`

This may be redone wholesale by `/bee:refresh-context` if that command is run after subsequent code changes — coordinate timing.

### F-CORE-019 — console.error consistency in ouroFunctions
Pick one convention (recommended: log nothing, let the future logger seam from F-CORE-022 handle observability) and apply to all catch blocks in `ouroFunctions.ts`. If the logger seam isn't shipping yet, default to silent catches and accept the temporary observability gap.

### F-CORE-020 — tier semantics documentation
Update the JSDoc on `pactReader.ts` and `rawCalibratedRead.ts` to:
1. List the canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static, etc. — match OuronetUI's reader).
2. Document that the default reader ignores `tier` and that consumers wanting cache must call `setPactReader`.
3. Optionally add a `process.env.NODE_ENV === "development"` warning when a `tier`-less call hits `pactRead`.

### F-CORE-021 — dead try/catch in getLPTypeInfo
Two valid moves:
- A. Drop the outer `try/catch (error) { return { hasFrozenLP: false, hasSleepingLP: false }; }` (lines 285-287). Promise.all of two never-rejecting promises cannot itself reject; the outer catch is unreachable.
- B. Keep it with a comment: `// belt-and-braces: if either inner IIFE's catch is removed in the future, this prevents a regression`.

Recommendation: **A**. If a future contributor removes one of the inner catches, the broken behaviour SHOULD surface as a real failure rather than silently masking.

### F-CORE-022 — central logger seam
Introduce `src/observability/logger.ts` mirroring the `setPactReader` pattern:

```ts
export type Logger = {
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
};

const defaultLogger: Logger = {
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

let _logger: Logger = defaultLogger;
export function setLogger(logger: Logger): void { _logger = logger; }
export function getLogger(): Logger { return _logger; }
```

Replace every `console.warn` and `console.error` in `src/` with `getLogger().warn(...)` / `.error(...)`. Consumers (HUB / OuronetUI) call `setLogger(...)` once at boot to route log events through their own facility (Sentry, structured stdout, etc.).

This change has more leverage than its LOW rating implies — it directly enables the `console.error` removals in F-CORE-007, F-CORE-009, and F-CORE-019.

## Acceptance Criteria
- [ ] README version table updated to v1.6.1.
- [ ] CONTEXT.md interactions section refreshed (or note the refresh deferred to next `/bee:refresh-context`).
- [ ] `ouroFunctions.ts` catch blocks consistently apply one convention.
- [ ] `pactReader.ts` JSDoc documents tier semantics; default reader's tier-ignored behaviour pinned.
- [ ] `addLiquidityFunctions.ts:285-287` outer try/catch dropped (or commented as belt-and-braces).
- [ ] `src/observability/logger.ts` exists with `setLogger`/`getLogger`/`Logger` type; all `console.warn`/`console.error` calls in `src/` route through `getLogger()`.
- [ ] `setLogger` exported via a new `./observability` subpath in `package.json`.
- [ ] Tests added for the logger seam (default routes to console; setLogger swaps; setLogger(null!) is rejected).
- [ ] `npm test` passes.
