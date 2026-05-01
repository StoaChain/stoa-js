# Roadmap: reliability-failover

## Phase-Requirement Mapping

| Phase | Goal | Requirements | Success Criteria |
|-------|------|-------------|------------------|
| 1. State isolation + default URL | Land the smallest, lowest-risk edits first: export `resetNodeFailover()` for test cleanliness, add `retryTimer.unref?.()` for Node consumer hygiene, and switch the uncached reader's default URL from the static module-init constant to the failover-aware active URL. | REQ-05, REQ-12, REQ-13 | 1. `resetNodeFailover()` exported from `src/network/nodeFailover.ts` and re-exported via the network barrel. 2. `retryTimer.unref?.()` is called immediately after `retryTimer = setInterval(...)`. 3. `src/reads/rawCalibratedRead.ts:49` resolves `pactUrl` via `getActivePactUrl(chainId)` instead of the static `PACT_URL` constant. 4. `PACT_URL` constant in `src/constants/kadena.ts:23` carries `@deprecated` JSDoc but stays exported. 5. `npm run typecheck` and `npm test` pass; existing 346 tests stay green. |
| 2. TIMEOUT error code + read-side failover wrap | Introduce the `TIMEOUT` error classification, then wrap the uncached reader's `dirtyRead` invocation in `withFailover` plus a 15 s timeout using `Promise.race` + `AbortController` defense-in-depth. Because every read in the interactions layer routes through `pactRead` → `rawCalibratedDirtyRead`, this single edit propagates failover and timeout coverage to all 16 already-migrated read sites without touching them individually. | REQ-06, REQ-07, REQ-08, REQ-11 | 1. `createTimeoutError(operation, timeoutMs)` exported from `src/errors/transactionErrors.ts` and reachable via the errors barrel. Returns `SigningError` with `code: "TIMEOUT"`. 2. `rawCalibratedDirtyRead` wraps its `dirtyRead` call in `withFailover` plus the 15 s read timeout (inline `Promise.race` + `AbortController` block — refactored to consume `runWithTimeout` in Phase 3). 3. `pactRead`'s options bag accepts `readTimeoutMs` and forwards it through. `rawCalibratedDirtyRead`'s options bag also accepts `readTimeoutMs` (default 15000 ms). 4. All 16 already-`pactRead`-routed read sites in `src/interactions/*` automatically inherit failover + timeout via the single-place wrap; no behavioural change at the call sites. 5. `npm run typecheck` and `npm test` pass. |
| 3. getFailoverClient factory + 81-site migration | Add the `getFailoverClient(chainId, options?)` factory + `runWithTimeout(operation, fn, timeoutMs)` helper, refactor Phase 2's inline wrap to consume `runWithTimeout` (eliminate temp duplication), then migrate every chain-call site in the 11 interaction files from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`. Largest phase by edit count (81 one-line replacements) but mechanically the simplest. | REQ-01, REQ-02, REQ-03, REQ-09, REQ-10 | 1. `src/network/failoverClient.ts` exists and exports `getFailoverClient` + `runWithTimeout`. 2. `getFailoverClient(chainId, options?)` returns `{ dirtyRead, submit, listen, pollOne }` with `withFailover` + per-tier timeout baked in. Override surface is two-tier: factory-time options + per-call options (per-call wins over factory wins over default). 3. `getFailoverClient.submit` captures the same signed-transaction reference on retry (request-key dedup contract documented in JSDoc). 4. Phase 2's inline read-side wrap in `rawCalibratedDirtyRead` is refactored to consume `runWithTimeout`. 5. All 81 sites in `src/interactions/*` (45 submit/listen/pollOne + 36 dirty-read-as-sim) migrated to `getFailoverClient(chainId)`. The 16 already-`pactRead`-routed read sites are NOT touched. 6. `npm run typecheck` and `npm test` pass. |
| 4. codexStrategy wraps + tests + quality gates + ship | Apply the `runWithTimeout` wrap at the codex-strategy seam (timeout-only; failover stays consumer's PactClient responsibility per REQ-04 trade-off). Add the two new test files (`tests/timeouts.test.ts` with `vi.useFakeTimers` — first usage in project; `tests/failover-submit.test.ts` for primary-down → fallback retry). Extend `tests/network.test.ts` with `resetNodeFailover` + `unref` cases. Run all quality gates and prepare the v2.1.0 release. | REQ-04, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20 | 1. `src/signing/codexStrategy.ts:131,153` (the `this.client.dirtyRead` and `this.client.submit` call sites) wrapped with `runWithTimeout`. JSDoc documents the timeout-only trade-off and that request-key dedup is N/A here (helper does not retry). 2. `tests/timeouts.test.ts` exists with ≥11 it-blocks (4 timeout-firing × 4 tiers + 4 successful-under-default × 4 tiers + 3 precedence-level scenarios). Uses `vi.useFakeTimers()` + `vi.useRealTimers()` in `afterEach`. 3. `tests/failover-submit.test.ts` exists with ≥2 it-blocks (primary-down → fallback succeeds + same-signed-tx-on-retry reference-equality assertion). 4. `tests/network.test.ts` extended with exactly 2 it-blocks (resetNodeFailover all-five-globals + retryTimer.unref spy). 5. `npm run typecheck`, `npm test` (≥361 tests, ≥15 new it-blocks), `npm run build` all pass. v1.7.0 type-regression lock continues to fire. Vitest reports no "Open handles" warnings. 6. Spec ships as v2.1.0 (MINOR, non-breaking). |

## Coverage Validation

- Total requirements: 20
- Mapped: 20
- Unmapped: 0

All requirements mapped to exactly one phase. Phase ordering is ascending blast radius / quick-wins-first: Phase 1 = 4 single-line edits (lowest risk), Phase 2 = TIMEOUT error + read-side wrap proves the pattern in one place, Phase 3 = factory + 81-site bulk mechanical migration, Phase 4 = codex wraps + all 3 new test artefacts + quality gates + ship.

## Phase Details

### Phase 1: State isolation + default URL
**Goal:** Land the smallest precursor edits — `resetNodeFailover()` export, `retryTimer.unref?.()`, default-URL pivot. Three single-line edits + one new export. Lowest blast radius; instant value (failover-aware default + clean test isolation + no Node event-loop leaks from the health-check timer).
**Requirements:** REQ-05, REQ-12, REQ-13
**Success Criteria:**
1. `resetNodeFailover()` exported from `src/network/nodeFailover.ts` (resets all 5 module-globals: PRIMARY_HOST, FALLBACK_HOST, customGasLimit, currentHost, retryTimer; first calls `stopRetryLoop()`).
2. `retryTimer.unref?.()` called immediately after `retryTimer = setInterval(...)` at `src/network/nodeFailover.ts:67` (optional-call form handles browsers).
3. `src/reads/rawCalibratedRead.ts:49` resolves `pactUrl` via `options?.pactUrl ?? getActivePactUrl(chainId)` instead of the static `PACT_URL` constant. Line-17 `PACT_URL` import dropped; `getActivePactUrl` added to the existing `from "../network"` import.
4. `PACT_URL` constant in `src/constants/kadena.ts:23` marked `@deprecated Use getActivePactUrl(chainId) for failover-aware URLs` but stays exported (semver compat).
5. `npm run typecheck` and `npm test` pass with zero regressions; existing 346 tests stay green.

### Phase 2: TIMEOUT error code + read-side failover wrap
**Goal:** Add the `TIMEOUT` error classification helper next to existing `createSigningError` / `createSimulationError` factories, then wrap the uncached reader's `dirtyRead` invocation in `withFailover` + 15 s timeout via `Promise.race` + `AbortController`. Single-place edit covers all 16 read sites in `src/interactions/*` automatically (they delegate via `pactRead` → `rawCalibratedDirtyRead`).
**Requirements:** REQ-06, REQ-07, REQ-08, REQ-11
**Success Criteria:**
1. `createTimeoutError(operation: string, timeoutMs: number, additionalContext?: Record<string, unknown>): SigningError` exported from `src/errors/transactionErrors.ts`. Sets `code: "TIMEOUT"`, message identifies operation + elapsed, suggestions list actionable steps. Reachable via existing `errors/index.ts` barrel.
2. `src/reads/rawCalibratedRead.ts:58-59` `dirtyRead(transaction)` call wrapped with `withFailover` + 15 s timeout (inline `Promise.race` + `AbortController` block — to be refactored to consume `runWithTimeout` in Phase 3 once that helper exists).
3. `pactRead`'s options bag at `src/reads/pactReader.ts:33-42` accepts `readTimeoutMs?: number` and forwards it. `rawCalibratedDirtyRead`'s options bag also accepts `readTimeoutMs` (default 15000 ms when omitted).
4. All 16 read sites in `src/interactions/*` automatically inherit failover + timeout via the single-place wrap; no per-call-site changes.
5. `npm run typecheck` and `npm test` pass; existing tests stay green.

### Phase 3: getFailoverClient factory + 81-site migration
**Goal:** Add the `getFailoverClient(chainId, options?)` factory + `runWithTimeout` helper module, refactor Phase 2's inline wrap to use the helper (eliminate temp duplication), then migrate every chain-call site in the 11 interaction files. Largest phase by edit count (81 one-line replacements) but mechanically simple — each site changes from `const { submit } = createClient(getPactUrl(chainId))` to `const { submit } = getFailoverClient(chainId)`.
**Requirements:** REQ-01, REQ-02, REQ-03, REQ-09, REQ-10
**Success Criteria:**
1. New module `src/network/failoverClient.ts` exists with two exports: `getFailoverClient(chainId, options?)` returning `{ dirtyRead, submit, listen, pollOne }` (each method with `withFailover` + per-tier default timeout from REQ-09 baked in), and `runWithTimeout(operation, fn, timeoutMs)` helper for use by Phase 4's codex-strategy wraps.
2. `getFailoverClient` override surface: factory-time options bag + per-call options bag (per-call wins over factory wins over default). All 4 default timeouts (15 s read, 60 s submit, **180 s listen** (~6 Kadena blocks), 30 s pollOne) overridable per tier.
3. `getFailoverClient.submit` closure captures the SAME signed-transaction reference on retry — request-key dedup contract documented in JSDoc.
4. Phase 2's inline read-side wrap in `rawCalibratedDirtyRead` is refactored to consume `runWithTimeout` (eliminates temp duplication; functionally identical).
5. 81 sites migrated across 11 interaction files (`activateFunctions`, `addLiquidityFunctions`, `coilFunctions`, `crossChainFunctions`, `dexFunctions`, `guardFunctions`, `kpayFunctions`, `ouroFunctions`, `pensionFunctions`, `urStoaFunctions`, `wrapFunctions`) — 45 submit/listen/pollOne destructures + 36 dirty-read-as-sim destructures. Grand inventory: 81 interactions + 2 codex-strategy = 83 total; the 2 codex sites are migrated separately in Phase 4.
6. The 16 already-`pactRead`-routed read sites are NOT touched.
7. `npm run typecheck` and `npm test` pass.

### Phase 4: codexStrategy wraps + tests + quality gates + ship
**Goal:** Apply timeout-only wrap at codex-strategy seam (failover stays consumer's PactClient responsibility), add 2 new test files + extend network test, run all quality gates, prepare v2.1.0 release.
**Requirements:** REQ-04, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20
**Success Criteria:**
1. `src/signing/codexStrategy.ts:131,153` wraps `this.client.dirtyRead(...)` and `this.client.submit(...)` with `runWithTimeout` from Phase 3. JSDoc documents the timeout-only trade-off (failover is consumer's PactClient responsibility) and notes the request-key dedup contract is N/A here (helper does not retry).
2. `tests/timeouts.test.ts` created with ≥11 it-blocks: 4 timeout-firing × 4 tiers (read/submit/listen/pollOne) + 4 successful-under-default × 4 tiers + 3 precedence-level tests at one tier (per-call vs factory vs default). Uses `vi.useFakeTimers()` (first project usage) + `vi.useRealTimers()` in `afterEach`.
3. `tests/failover-submit.test.ts` created with ≥2 it-blocks: primary-down → fallback retry succeeds + reference-equality assertion that the SAME signed-transaction was passed to the retry.
4. `tests/network.test.ts` extended with exactly 2 it-blocks: `resetNodeFailover()` returns all 5 module-globals to initial values; `retryTimer.unref()` invoked on Node (verified by spy on `setInterval` return value).
5. All quality gates pass: `npm run typecheck` exit 0; `npm test` ≥361 tests with ≥15 new it-blocks (REQ-14 ≥11 + REQ-15 ≥2 + REQ-16 exactly 2); `npm run build` clean dist/. v1.7.0 type-regression lock continues to fire. Vitest reports no "Open handles" warnings.
6. Package version bumped to v2.1.0 (MINOR, non-breaking). CHANGELOG entry describes all 4 fixes + non-breaking nature. Ready for tag-and-publish flow (publish.yml + manual curl backfill for the GitHub Release using `.secrets/pat.txt`).
