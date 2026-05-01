# Requirements: reliability-failover

## Initial Description

Close audit findings F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-008 (4 × HIGH) in `@stoachain/ouronet-core`. The library advertises automatic node failover (primary node2 → fallback node1 on network error) and module-global state to track the active host, but the failover machinery is half-wired: `withFailover` is dead code, `rawCalibratedDirtyRead` defaults to a static URL pinned to node2 at module init, no chain call has any timeout, and module-global state leaks across multi-tenant consumers. Source: `.bee/audit-specs/high-reliability-failover.md`.

## Requirements Discussion

This spec was generated via `/bee:new-spec --from-discussion .bee/audit-specs/high-reliability-failover.md`. The audit-spec locks the 4 fixes; discovery filled in the design choices (helper pattern, timeout impl, codexStrategy wiring, scope of state-isolation work).

### Source File (authoritative)

- `.bee/audit-specs/high-reliability-failover.md` — finding-by-finding acceptance criteria for F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-008.

### Sequencing constraint (locked, satisfied)

The audit-spec coordination note locks: this spec MUST land AFTER `high-arch-layering-and-seams` (which closed F-CORE-005 + F-CORE-006). That spec migrated all 16 read sites onto `pactRead`, so wrapping `withFailover` once inside `rawCalibratedDirtyRead` (which `pactRead` delegates to) covers every read in `src/interactions/*` automatically — a one-place edit instead of touching 16 call sites.

**Status:** arch-layering-and-seams shipped as v2.0.0 (commit `3532a7b`, archived as `.bee/archive/2026-04-30-arch-layering-and-seams/`). Sequencing satisfied.

### Questions & Answers (discovery)

**Q1: Use the audit-spec as the starting point?**
A1: Yes — Fix 1 (withFailover wiring), Fix 2 (default-URL switch), Fix 3 (timeouts), Fix 4 (state isolation) are locked. Discovery filled in the design choices.

**Q2: Researcher found 83 chain call sites total (81 in `src/interactions/*` + 2 in `src/signing/codexStrategy.ts`) — not ~30 as audit-spec estimated. The proposed `getFailoverClient(chainId)` helper turns 81 in-line wraps into 81 one-line replacements (the 2 codex-strategy sites are handled separately via the timeout-only helper — see Q4). Adopt this pattern?**
A2: **Yes — adopt the `getFailoverClient(chainId)` helper.** New module `src/network/failoverClient.ts` exports a function returning `{ dirtyRead, submit, listen, pollOne }` with `withFailover` + timeout baked in. The 81 call sites in `src/interactions/*` become a one-line replacement: `const { submit } = createClient(getPactUrl(chainId))` → `const { submit } = getFailoverClient(chainId)`. Centralizes failover/timeout logic in one file; future bug fixes touch one place. Note: an early discovery estimate said "84 sites" — the final count is 83 (interactions 81 + codex 2).

**Q3: Fix 3 timeout impl — AbortSignal directly OR `Promise.race` wrapper?**
A3: **Promise.race + AbortController.** Defense-in-depth. `@kadena/client@1.18.3` accepts `AbortSignal` via `ClientRequestInit.signal`, but its transitive dep `cross-fetch@~3.1.5` had patchy `AbortController` support in older Node versions. `Promise.race` guarantees the timeout rejects on schedule regardless of whether the underlying fetch honors `controller.abort()`. The `controller.abort()` is still called as a side-effect to cancel the fetch when possible. Defaults: 15 s read, 60 s submit. Configurable per-call via the same options bag (`tier`, `pactUrl`, `chainId`, `readTimeoutMs`, `submitTimeoutMs`, `listenTimeoutMs`, `pollTimeoutMs`).

**Q4: codexStrategy.ts uses an injected `PactClient` interface (not direct `createClient`). How to wire failover there?**
A4: **Wrap inside core via a thin helper.** Add `runWithTimeout()` (or similar) helper that wraps `this.client.submit(...)` and `this.client.dirtyRead(...)` calls with timeout + error classification only — NOT URL switching, since the consumer's `PactClient` implementation holds its own URL and we don't want to escalate the `PactClient` contract to require a URL accessor (that would be a public-API break). The wrapper provides timeout + `TIMEOUT` error classification; the consumer's `PactClient` is responsible for failover within its own implementation. This is a deliberate trade-off: codexStrategy gets the timeout half of the story but not the failover half. Document in JSDoc.

**Q5: Fix 4 state isolation — quick path only OR full `NodeFailoverContext` class refactor?**
A5: **Quick path only.** Export `resetNodeFailover()` for tests + add `retryTimer.unref?.()` so Node consumers don't keep the event loop alive solely for the timer. ~10 lines total. The proper `NodeFailoverContext` class refactor is deferred to a future spec if/when a real multi-tenant SSR consumer requirement emerges. No current consumer is multi-tenant SSR; YAGNI.

**Q6: Implementation mode?**
A6: **Premium** — project default in `.bee/config.json:5`. Opus throughout planning + implementation + review.

### Existing Code to Reference

- `src/network/nodeFailover.ts:25-33` — module-global `let` bindings (PRIMARY_HOST, FALLBACK_HOST, customGasLimit, currentHost, retryTimer). `resetNodeFailover()` will reset all five.
- `src/network/nodeFailover.ts:38-41` — existing `AbortController` precedent (the `isHealthy` health check uses exactly this pattern). Only existing AbortController usage in `src/`.
- `src/network/nodeFailover.ts:64-71` — `startRetryLoop()` `setInterval` call. Add `retryTimer.unref?.()` immediately after the assignment.
- `src/network/nodeFailover.ts:91-93` — `getActivePactUrl(chainId)` returns failover-aware URL (reads `currentHost`).
- `src/network/nodeFailover.ts:104-125` — existing `withFailover<T>` wrapper. Already classifies `AbortError` as a network error (line 116) — so a timeout-aborted call will trigger fallback retry naturally under the new design.
- `src/network/nodeFailover.ts:128-151` — `setNodeConfig()` shape that `resetNodeFailover()` mirrors.
- `src/network/index.ts` — barrel re-export. New `getFailoverClient` export flows through automatically.
- `src/reads/rawCalibratedRead.ts:17` — `PACT_URL` import to drop.
- `src/reads/rawCalibratedRead.ts:49` — single-line edit: `options?.pactUrl ?? PACT_URL` → `options?.pactUrl ?? getActivePactUrl(chainId)`.
- `src/reads/rawCalibratedRead.ts:58-59` — wrap `dirtyRead` in `withFailover` + timeout.
- `src/reads/pactReader.ts:33-74` — `pactRead` delegates to `_reader` (default `rawCalibratedDirtyRead`). Inherits failover + timeout automatically once the wrap is added below.
- `src/constants/kadena.ts:23` — `PACT_URL` constant. Becomes call-site-orphaned after Fix 2 but stays exported (semver). Mark `@deprecated Use getActivePactUrl(chainId)` in JSDoc.
- `src/errors/transactionErrors.ts:6-11` — `TransactionError` interface. Where to add `TIMEOUT` code.
- `src/errors/transactionErrors.ts:38-114` + `:119-198` — `createSigningError` / `createSimulationError` factories. New `createTimeoutError(operation, timeoutMs, additionalContext?)` standalone helper added next to them.
- `src/errors/index.ts` — single re-export. New `TIMEOUT` error helper flows through automatically.
- `src/signing/codexStrategy.ts:131,153` — `this.client.submit(...)` and `this.client.dirtyRead(...)` call sites. Wrap with `runWithTimeout()` helper (timeout + TIMEOUT classification only; no failover — see Q4).
- `src/signing/types.ts:83-86` — `PactClient` interface. NOT modified (no `baseUrl` accessor added — see Q4).
- `node_modules/@kadena/client/dist/client.d.ts:510, 545, 978, 327` — type signatures confirm all chain methods accept `ClientRequestInit` with optional `signal: AbortSignal`.
- `tests/network.test.ts:27-29` — existing `beforeEach` calling `setNodeConfig("node2")` for state isolation. New tests will use `resetNodeFailover()` instead.
- `tests/interactions-read-seam.test.ts:163-170` — vi.fn() stub + beforeEach/afterEach reset pattern. Model for new failover-submit tests.
- `tests/types.test.ts` — v1.7.0 regression-lock pattern (must continue to fire).
- `vitest.config.ts` — picks up `tests/**/*.test.ts`. New `tests/timeouts.test.ts` and `tests/failover-submit.test.ts` auto-included.

### Call-site inventory (researcher-confirmed)

**81 chain call sites in `src/interactions/*` + 2 in `src/signing/codexStrategy.ts` = 83 total.** Submit/listen/pollOne side across both: 46 (45 in interactions + 1 in codex). Dirty-read-as-sim side across both: 37 (36 in interactions + 1 in codex). The other 16 dirty-reads (the v2.0.0 migrated read-only ones) are already routed through `pactRead` → `rawCalibratedDirtyRead` and inherit failover + timeout from the single-place wrap.

| File | submit/listen/pollOne | dirtyRead (sim-before-submit) | Total to migrate to getFailoverClient |
|---|---|---|---|
| `activateFunctions.ts` | 1 | 1 | 2 |
| `addLiquidityFunctions.ts` | 9 | 5 | 14 |
| `coilFunctions.ts` | 1 | 1 | 2 |
| `crossChainFunctions.ts` | 4 | 0 | 4 |
| `dexFunctions.ts` | 6 | 6 | 12 |
| `guardFunctions.ts` | 1 | 1 | 2 |
| `kpayFunctions.ts` | 1 | 1 | 2 |
| `ouroFunctions.ts` | 14 | 13 | 27 |
| `pensionFunctions.ts` | 2 | 2 | 4 |
| `urStoaFunctions.ts` | 4 | 4 | 8 |
| `wrapFunctions.ts` | 2 | 2 | 4 |
| `signing/codexStrategy.ts` | 1 (`this.client.submit`) | 1 (`this.client.dirtyRead`) | 2 (special — see Q4) |
| **Total (interactions only, sum of rows above codex)** | **45** | **36** | **81** |
| **Grand total (including codex)** | **46** | **37** | **83** |

`infoOneFunctions.ts` and `kadenaFunctions.ts` have ZERO submit/listen/pollOne (pure-read modules, already routed via `pactRead` from the v2.0.0 migration).

## Visual Assets

No visual assets provided. This is a code-only refactor + hardening spec.

## Implementation Mode

`premium` — opus throughout planning + implementation + review. Project default in `.bee/config.json:5`.

## Requirements Summary

### Functional Requirements

#### F-CORE-002 — `withFailover` wiring across submits and reads
- [x] **REQ-01:** Add new module `src/network/failoverClient.ts` exporting `getFailoverClient(chainId: string, options?: FailoverClientOptions)` returning `{ dirtyRead, submit, listen, pollOne }` whose methods internally wrap `withFailover` + timeout. Each method preserves its `@kadena/client` return type. The wrapper closure for `submit` MUST capture the SAME signed transaction reference passed in (request-key dedup contract — never rebuild on retry; document in JSDoc).
- [x] **REQ-02:** Re-export `getFailoverClient` from `src/network/index.ts`.
- [x] **REQ-03:** Migrate all 81 chain call sites in `src/interactions/*` (45 submit/listen/pollOne + 36 dirty-read-as-sim destructures — the table totals row counts the 2 codexStrategy sites in its 46/37 columns; subtracting those yields 45+36=81 interactions-only sites) from `const { submit } = createClient(getPactUrl(chainId))` to `const { submit } = getFailoverClient(chainId)`. The 16 read-only `pactRead` sites migrated in v2.0.0 are NOT touched (they inherit failover via the wrap inside `rawCalibratedDirtyRead` per REQ-05).
- [x] **REQ-04:** Wrap `this.client.dirtyRead(...)` and `this.client.submit(...)` in `src/signing/codexStrategy.ts:131,153` with a thin `runWithTimeout(operation, fn, timeoutMs)` helper exported from `src/network/failoverClient.ts`. The helper provides timeout + `TIMEOUT` error classification only; failover stays the consumer's `PactClient` implementation responsibility. Document the trade-off in `codexStrategy.ts` JSDoc. **Note:** the request-key dedup contract from REQ-01 is N/A here because `runWithTimeout` does NOT retry — it only times out and rejects; dedup is only a concern for the failover-retry seam in `getFailoverClient.submit`.

#### F-CORE-003 — Default reader uses active failover URL
- [x] **REQ-05:** Change `src/reads/rawCalibratedRead.ts:49` from `const pactUrl = options?.pactUrl ?? PACT_URL;` to `const pactUrl = options?.pactUrl ?? getActivePactUrl(chainId);`. Add `getActivePactUrl` to the existing `from "../network"` import (or update import block). Drop the `PACT_URL` import on line 17 since it is no longer referenced. Mark `PACT_URL` in `src/constants/kadena.ts:23` as `@deprecated Use getActivePactUrl(chainId) for failover-aware URLs` (do NOT remove the export — semver compat).
- [x] **REQ-06:** Wrap `dirtyRead(transaction)` at `src/reads/rawCalibratedRead.ts:58-59` with `withFailover` + 15s timeout. This is the one-place edit that covers all 16 `pactRead`-routed read sites in `src/interactions/*`. Use `Promise.race` against the wrapped fetch + a manual timeout-rejection (per REQ-10).

#### F-CORE-008 — Timeouts on all chain calls
- [x] **REQ-07:** Add `createTimeoutError(operation: string, timeoutMs: number, additionalContext?: Record<string, unknown>): SigningError` standalone helper to `src/errors/transactionErrors.ts`. Returns a `SigningError` with `code: "TIMEOUT"`, `originalError` set to a fresh `Error("Timeout after ${timeoutMs}ms during ${operation}")`, and `suggestions` listing actionable steps ("Check network connectivity", "Try again in a few seconds — node may have failed over", "If persistent, increase the timeout via options").
- [x] **REQ-08:** Re-export the new helper from `src/errors/index.ts` (auto via `export * from "./transactionErrors"`).
- [x] **REQ-09:** Default timeouts: 15 s for `dirtyRead`, 60 s for `submit`, **180 s** for `listen`, 30 s for `pollOne`. **Listen-default rationale (locked, addresses Phase 3 plan-review F-001):** Kadena mainnet block time is ~30 seconds and `listen` is documented as a long-polling call that waits for transaction inclusion (block-confirmation latency). A 30-second listen default would routinely fire BEFORE the first confirmation block, surfacing false `TIMEOUT` errors to consumers — particularly the 6 multi-step `listen` sites in `addLiquidityFunctions.ts` (2 sites) and `crossChainFunctions.ts` (1 site, plus a `pollOne` for cross-chain SPV). 180 s = ~6 blocks of headroom; covers normal block-time variance plus one re-org window. Consumers that need a tighter or looser ceiling override per-call. **Override surface (locked):** factory-time options bag is the primary surface — `getFailoverClient(chainId, { readTimeoutMs?, submitTimeoutMs?, listenTimeoutMs?, pollTimeoutMs? })`. Each returned method ALSO accepts an optional per-call options bag mirroring `@kadena/client`'s `ClientRequestInit` pattern: `submit(tx, { submitTimeoutMs?: number })` etc. Per-call override wins over factory-time override wins over the locked default. Tests assert all three precedence levels.
- [x] **REQ-10:** Timeout impl: `Promise.race([chainCall(), timeoutPromise])` where `timeoutPromise` is `new Promise((_, reject) => setTimeout(() => { controller.abort(); reject(createTimeoutError(...)); }, timeoutMs))`. The `controller.abort()` side-effect attempts to cancel the underlying fetch when the runtime supports it (modern Node 20+, browsers); the `Promise.race` guarantees the timeout rejection regardless. Pass `{ signal: controller.signal }` to the `@kadena/client` method's `ClientRequestInit` so the fetch can also be cancelled cleanly when supported.
- [x] **REQ-11:** Add `pactRead` options-bag pass-through for timeout: `pactRead(pactCode, { tier, chainId, pactUrl, readTimeoutMs })` accepts `readTimeoutMs` and forwards it to `rawCalibratedDirtyRead`'s `withFailover` wrap. Existing 16 call sites in `interactions/*` continue to omit it (use the 15 s default). **`rawCalibratedDirtyRead`'s options bag is also extended with the same `readTimeoutMs` field; default 15000 ms when omitted.** This is the receiving end of `pactRead`'s pass-through — without it the value would have nowhere to land.

#### F-CORE-004 — State isolation + Node consumer hygiene
- [x] **REQ-12:** Export `resetNodeFailover()` from `src/network/nodeFailover.ts`. Implementation: stop the retry loop (call existing `stopRetryLoop()`), then reassign `PRIMARY_HOST = NODE2_HOST`, `FALLBACK_HOST = NODE1_HOST`, `customGasLimit = DEFAULT_GAS_LIMIT`, `currentHost = PRIMARY_HOST`, `retryTimer = null`. Document in JSDoc as "primarily for test isolation; production code should not call this".
- [x] **REQ-13:** Add `retryTimer.unref?.()` immediately after `retryTimer = setInterval(...)` at `src/network/nodeFailover.ts:67`. The `?.` optional-call handles browsers where `setInterval` returns a number (no `.unref()` method). Documented in inline comment as "prevent Node consumers from keeping the event loop alive solely for the failover health-check timer".

#### Tests
- [x] **REQ-14:** Add `tests/timeouts.test.ts` with `vi.useFakeTimers()` covering ALL FOUR operation tiers (read / submit / listen / pollOne): (a) a hanging operation past its default timeout rejects with `TIMEOUT` error code (not the actual wait — fake timers advance instantaneously) — one test per tier × 4 tiers = 4 base scenarios; (b) per-call options override the factory-time override which overrides the default — 3 precedence-level tests at one tier (e.g., read with default 15 s vs factory `readTimeoutMs: 10000` vs per-call `readTimeoutMs: 5000`); (c) successful calls under timeout return normally — one test per tier × 4 tiers = 4 scenarios; (d) `vi.useRealTimers()` in `afterEach` so the timer mock doesn't leak. Total: ~11 it-blocks.
- [x] **REQ-15:** Add `tests/failover-submit.test.ts` covering: primary-down scenario (mock the first `submit` to throw `Failed to fetch`) → `withFailover` retries on fallback → succeeds. Asserts the SAME signed-transaction reference was passed to the retry call (request-key dedup contract). Uses `setPactReader`-style stubbing for `getFailoverClient` if needed; otherwise stubs `@kadena/client.createClient` via vi.mock.
- [x] **REQ-16:** Extend `tests/network.test.ts` with: (a) test that `resetNodeFailover()` returns all 5 module globals to initial values; (b) test that `vi.useFakeTimers()` + `startRetryLoop()` schedules the timer with `.unref()` called on Node (use a spy on `setInterval` return value's `unref` method).
- [x] **REQ-17:** All existing tests continue to pass. The v1.7.0 `tests/types.test.ts` regression-lock continues to fire. No "Open handles" warnings from Vitest (the `unref()` + `resetNodeFailover()` should make this clean).

#### Quality gates
- [x] **REQ-18:** `npm run typecheck` passes.
- [x] **REQ-19:** `npm test` passes the full suite. Test count grows from 346 baseline to ≥361 (REQ-14 contributes ≥11 it-blocks; REQ-15 contributes ≥2 it-blocks for primary-down-then-fallback-succeeds + same-signed-tx-on-retry; REQ-16 contributes exactly 2 it-blocks for resetNodeFailover + retryTimer.unref). Minimum 15 new it-blocks total = 361 tests minimum.
- [x] **REQ-20:** `npm run build` emits clean `dist/`. New `src/network/failoverClient.ts` exported under the `./network` subpath via the existing barrel.

### Non-Functional Requirements

- **Backward-compat delta documented.** All 4 fixes are non-breaking widening:
  - REQ-01–04: new exports + internal call-site migration. No public API change.
  - REQ-05–06: behavioural improvement (default URL becomes failover-aware). Consumers passing explicit `pactUrl` are unaffected.
  - REQ-07–11: new error code + new optional config fields. Existing call sites without `*TimeoutMs` get the new defaults.
  - REQ-12–13: new export + internal hygiene. No breaking change.
  - **Net: this spec ships as a MINOR bump (v2.1.0).** No breaking changes; consumers can upgrade safely.
- **Sequencing constraint (locked, satisfied).** This spec lands AFTER arch-layering-and-seams (v2.0.0). Confirmed in STATE.md.
- **Request-key dedup contract.** Submit retries MUST replay the SAME `ICommand` — never rebuild. The wrapper closure captures the variable reference, so this is naturally enforced; documented explicitly in `withFailover` and `getFailoverClient.submit` JSDoc.
- **Defense-in-depth timeout.** `Promise.race` + `controller.abort()` together. The race guarantees rejection on schedule; `abort()` cancels the underlying fetch on best-effort.
- **Quick-path state isolation.** `NodeFailoverContext` class refactor deferred to a future spec if/when a real multi-tenant SSR consumer requirement emerges.
- **codexStrategy timeout-only.** The `runWithTimeout` helper applied at `codexStrategy.ts:131,153` provides timeout + `TIMEOUT` classification but NOT failover. The consumer's `PactClient` implementation is responsible for failover within its own surface. Documented in `codexStrategy.ts` JSDoc.
- **Test count delta.** ~360+ tests after this spec (346 baseline + ~14 new). No regression on existing tests; v1.7.0 regression-lock continues to fire.

### Reusability Opportunities

- Existing `withFailover<T>` at `src/network/nodeFailover.ts:104-125` — already classifies `AbortError` as network error, so timeouts naturally trigger fallback retry. Used as-is by `getFailoverClient`.
- Existing `AbortController` precedent at `src/network/nodeFailover.ts:38-41` (the `isHealthy` health check) — reused for the timeout pattern.
- Existing `setPactReader` injection-seam pattern from arch-layering — model for `getFailoverClient` if it ever needs to be made injectable for tests (not in this spec; YAGNI).
- Existing `errors/transactionErrors.ts` factory pattern (`createSigningError`, `createSimulationError`) — model for `createTimeoutError`.
- Existing `tests/interactions-read-seam.test.ts` vi.fn() stub + beforeEach/afterEach reset pattern — model for `tests/failover-submit.test.ts`.

### Scope Boundaries

**In scope:**
- F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-008 closure.
- New `src/network/failoverClient.ts` module with `getFailoverClient` + `runWithTimeout` exports.
- New `createTimeoutError` helper in `src/errors/transactionErrors.ts` with `code: "TIMEOUT"`.
- 81 site migrations in `src/interactions/*` from `createClient` to `getFailoverClient`.
- 2 wrapped call sites in `src/signing/codexStrategy.ts` (timeout-only via `runWithTimeout`).
- `resetNodeFailover()` export + `retryTimer.unref?.()` call.
- 2 new test files (`tests/timeouts.test.ts`, `tests/failover-submit.test.ts`) + extensions to `tests/network.test.ts`.

**Out of scope:**
- F-CORE-005, F-CORE-006 (already closed in v2.0.0).
- F-CORE-007 (BREAKING fabricated-fallbacks — separate spec, will be v3.0.0).
- F-CORE-009, F-CORE-010 (security/Pact-string injection — separate spec).
- F-CORE-011, F-CORE-012 (test-coverage critical surfaces — separate spec).
- F-CORE-013 onward (codex/guard/medium/low — separate specs).
- `NodeFailoverContext` class refactor (deferred — no current multi-tenant consumer requires it).
- `PactClient` interface contract change to add `baseUrl` accessor (rejected — would be public-API break for OuronetUI/HUB).
- Touching the 16 already-`pactRead`-routed read sites in `src/interactions/*` (they inherit failover + timeout via the single-place wrap inside `rawCalibratedDirtyRead`).
- Removing the `PACT_URL` constant export (kept as `@deprecated` for semver compat).

### Technical Considerations

- **Constraint #1 (locked, satisfied):** Sequencing — lands AFTER arch-layering-and-seams (done; v2.0.0 commit `3532a7b`).
- **Constraint #2 (locked):** `getFailoverClient(chainId)` helper centralizes failover + timeout. Single source of truth; the 81 interactions sites become one-line replacements.
- **Constraint #3 (locked):** Timeout impl uses `Promise.race` + `AbortController` (defense-in-depth). Defaults: 15 s read, 60 s submit, **180 s** listen (~6 blocks; matches Kadena ~30 s block time), 30 s pollOne. Configurable per-call.
- **Constraint #4 (locked):** codexStrategy gets timeout-only via `runWithTimeout` helper — NO failover (would require `PactClient` contract change). Consumer is responsible for failover in their `PactClient` implementation.
- **Constraint #5 (locked):** Quick-path state isolation only (`resetNodeFailover()` + `unref?.()`). Defer `NodeFailoverContext` class refactor.
- **Public-API impact:** New exports (`getFailoverClient`, `runWithTimeout`, `createTimeoutError`, `resetNodeFailover`) — non-breaking widening. The `code: "TIMEOUT"` error code is a new value consumers can branch on. `PACT_URL` constant deprecated but still exported.
- **Version bump:** v2.0.4 → **v2.1.0** (MINOR). No breaking changes.
- **No new dependencies.** `AbortController` is global Web standard (browsers + Node 16+); `Promise.race` is ES2017+. `vi.useFakeTimers()` is vitest 4.x stable.
- **First `vi.useFakeTimers()` usage in the project.** Tests must remember `vi.useRealTimers()` in `afterEach` to avoid leaking the timer mock.
