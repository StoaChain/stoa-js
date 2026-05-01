# Specification: reliability-failover

## Goal

Close four HIGH-severity audit findings (F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-008) so that `@stoachain/ouronet-core`'s advertised automatic node failover and timeout behaviour actually fires on every chain call across reads and submits, and so that module-global failover state is hygienic for Node and test consumers. Ships as v2.1.0 — a non-breaking MINOR widening of the public surface.

## User Stories

- As an OuronetUI user submitting a swap, I want my transaction to automatically retry on the fallback node when the primary node is unreachable, so that a single transient outage does not cost me a request and I do not see a manual error.
- As an AncientHolder HUB operator running long-lived Node processes, I want failover to keep my submits and reads online during a primary-node outage, so that scheduled jobs survive without operator intervention.
- As a consumer of any chain call (read, submit, listen, poll), I want every call to time out within a bounded window instead of hanging forever, so that a stalled request never blocks a UI interaction or a server worker.
- As a consumer who hits a timeout, I want a clearly classified `TIMEOUT` error with actionable suggestions, so that I can branch on it programmatically and present a useful message to the user.
- As a consumer running tests against the library, I want to reset failover state between tests so that one test's host switch does not contaminate the next.
- As a Node consumer (HUB), I want the internal failover health-check timer to not pin the event loop open, so that my CLI processes exit cleanly after their work is done.
- As a CFM modal author calling `CodexSigningStrategy.execute`, I want simulate and submit calls to time out and surface a `TIMEOUT` classification, so that a hung dirty-read or submit does not freeze the signing flow.
- As a maintainer of the library, I want failover and timeout logic centralised in a single helper so that future fixes touch one place rather than 80+ call sites.

## Specific Requirements

### F-CORE-002 — Wire automatic failover into every submit and read

- **REQ-01:** A new failover-aware client factory is introduced. Given a chain id (and an optional configuration bag), it returns the four standard chain operations (dirty-read, submit, listen, poll-one), each of which internally consults the active failover host on every invocation, retries once on the fallback host when the primary errors with a network-class failure, and applies the per-operation timeout described in REQ-09. The submit operation guarantees that a retry replays the exact same signed transaction reference passed in (request-key dedup contract); it never rebuilds the payload between attempts. This contract is documented in the operation's behavioural notes.
- **REQ-02:** The new factory is exported from the existing network barrel so that all consumers reach it via the existing `./network` subpath. No new subpath is introduced.
- **REQ-03:** Every chain call site inside the interaction modules is migrated from the static, URL-pinned client construction to the new failover-aware factory. The migration covers 81 sites across 11 interaction files (45 submit/listen/poll-one destructures plus 36 dirty-read-as-simulation destructures — the broader 46+37=83 chain-call inventory across the project includes 2 additional sites inside the codex signing strategy that are handled separately in Phase 4 via the timeout-only helper). The 16 already-migrated read-only sites that flow through the pluggable reader remain untouched and inherit failover and timeout via the single-place edit in REQ-06.
- **REQ-04:** The two chain calls inside the codex signing strategy (the simulate dirty-read and the final submit) are wrapped with a thin timeout helper that provides timeout enforcement and `TIMEOUT` classification only. Failover is intentionally NOT applied at this seam, because failover would require adding a base-URL accessor to the public `PactClient` interface — a breaking public-API change. The trade-off is documented at the call sites: the consumer's `PactClient` implementation is responsible for its own failover, while the timeout layer is provided by the library. The request-key dedup contract from REQ-01 is not applicable here because the timeout helper does NOT retry — it only times out and rejects; dedup is only a concern at the failover-retry seam in REQ-01's submit method.

### F-CORE-003 — Default reader uses the failover-aware URL

- **REQ-05:** The uncached calibrated dirty-read reader's default URL is changed from the static, primary-pinned constant evaluated at module load to the failover-aware URL resolved per call from the active host. Consumers that pass an explicit URL are unaffected. The static URL constant is kept exported for semver compatibility but is marked deprecated in its documentation, with a pointer to the failover-aware URL helper.
- **REQ-06:** The dirty-read invocation inside the uncached reader is wrapped with the existing failover helper plus the read-tier timeout (15 seconds). Because every read in the interactions layer routes through the pluggable reader and that reader delegates to this uncached reader by default, this single edit propagates failover and timeout coverage to all 16 already-migrated read sites without touching them individually.

### F-CORE-008 — Timeouts on every chain call

- **REQ-07:** A new error factory is added next to the existing signing and simulation error factories. It produces a structured signing-error instance carrying the code `TIMEOUT`, a message identifying the operation and the elapsed timeout in milliseconds, and a list of actionable suggestions (check connectivity, retry shortly because failover may have engaged, raise the timeout via options if persistent).
- **REQ-08:** The new timeout-error factory is reachable via the existing errors barrel; consumers that already import from the errors subpath get the new helper automatically.
- **REQ-09:** Default timeouts are applied per operation kind: 15 seconds for dirty-reads, 60 seconds for submits, **180 seconds for listens (~6 Kadena blocks; the listen call is long-polling for transaction inclusion and the default must outlast the ~30-second block time by a comfortable margin)**, and 30 seconds for poll-one. The override surface is two-tiered: factory-time options (passed at the failover-client construction site, applying to every operation produced by that factory call) and per-call options (passed alongside each operation's normal arguments, mirroring the underlying chain-client's request-init pattern). Per-call override wins over factory-time override which wins over the locked default.
- **REQ-10:** The timeout mechanism uses a defence-in-depth combination of two techniques. A race between the chain call and a scheduled timeout-rejection guarantees the call fails on the wall-clock schedule regardless of underlying transport behaviour. In parallel, an abort signal is passed through to the underlying chain operation so that, on runtimes that honour cancellation, the in-flight fetch is cancelled cleanly when the timer fires. When the timer wins the race, the failure is converted into the `TIMEOUT` classified error from REQ-07. Because the existing failover wrapper already classifies abort-shaped failures as network errors, a timed-out primary call automatically triggers the fallback retry as a beneficial side-effect.
- **REQ-11:** The pluggable reader's options bag is extended to accept a read-timeout override and forward it through to the wrapped invocation in REQ-06. The default uncached reader's own options bag is also extended with the same field so the forwarded value has somewhere to land (default 15 seconds when omitted). Existing read sites continue to omit the option and inherit the 15-second default.

### F-CORE-004 — State isolation and Node consumer hygiene

- **REQ-12:** A reset function is exported from the failover module that returns all five module-level state slots (primary host, fallback host, custom gas limit, current host, retry timer) to their initial values, after first stopping any running retry loop. The function's documentation explicitly scopes its intended use to test isolation and warns against use in production code.
- **REQ-13:** The failover health-check retry interval is unref'd immediately after creation, using an optional-call form so that browser consumers (where the interval handle is a numeric primitive without `.unref()`) are unaffected. An inline note explains that this prevents Node consumers from keeping the event loop alive solely for the failover health-check timer.

### Tests

- **REQ-14:** A new timeouts test file is added that uses fake timers (the project's first such usage). It covers ALL four operation tiers (read / submit / listen / poll-one) with: one hanging-past-default test per tier asserting the `TIMEOUT` classification (4 scenarios via simulated time); one successful-under-default test per tier asserting normal return (4 scenarios); a three-level precedence test at one tier asserting per-call override beats factory-time override beats the locked default (3 scenarios); and a real-timers-restored after-each hook so the timer mock cannot leak into other tests. Approximately 11 it-blocks.
- **REQ-15:** A new failover-submit test file is added that covers a primary-down scenario: the first submit attempt throws a network-class failure, the failover wrapper switches to the fallback host, and the same signed transaction reference is replayed on the retry. The test asserts both that the retry succeeds and that the transaction reference passed to the retry is identical to the one passed to the original attempt (request-key dedup contract).
- **REQ-16:** The existing network test file is extended with two cases: the new reset function returns all five state slots to initial values; and the retry loop's interval handle has `.unref()` invoked on it on Node, verified by a spy on the value returned by the interval-scheduling primitive.
- **REQ-17:** All previously-passing tests continue to pass, including the v1.7.0 type-regression lock. The Vitest run produces no "Open handles" warnings, which the unref and reset additions together should make clean.

### Quality gates

- **REQ-18:** The library's typecheck script passes with no errors.
- **REQ-19:** The full test suite passes. Test count grows from the 346 baseline to at least 361 (REQ-14 contributes ≥11 it-blocks; REQ-15 contributes ≥2 it-blocks; REQ-16 contributes exactly 2 it-blocks — minimum 15 new it-blocks total).
- **REQ-20:** The build produces a clean `dist/` and the new failover client factory is exported through the existing network subpath barrel as observable from a downstream consumer's import.

## Visual Design

No visual assets provided. This is a library-internal reliability and hardening change with no user-facing surface to mock; downstream UIs (OuronetUI) consume the new behaviour transparently through existing imports.

## Existing Code to Leverage

- `src/network/nodeFailover.ts` — already houses the active-host state machine, the `withFailover` wrapper (which already classifies abort-shaped errors as network failures), the `getActivePactUrl(chainId)` helper, the health-check `AbortController` precedent, and the retry-loop interval scheduler. The new failover-client factory composes existing pieces here rather than duplicating them.
- `src/network/index.ts` — single-line re-export barrel; the new factory and the new reset function flow through automatically once added.
- `src/reads/rawCalibratedRead.ts` — the only place a one-line URL-source swap and a single `withFailover` + timeout wrap propagates failover and timeout coverage to all 16 already-migrated read sites.
- `src/reads/pactReader.ts` — the pluggable reader that delegates to the uncached reader by default. Its options bag is the entry point for the read-timeout override pass-through.
- `src/errors/transactionErrors.ts` — existing factory pattern (`createSigningError`, `createSimulationError`) is the model for the new timeout-error factory; the existing `SigningError` class is reused as the carrier so consumers branch on the new code via the same shape.
- `src/errors/index.ts` — single re-export barrel; the new factory flows through automatically.
- `src/constants/kadena.ts` — the static URL constant lives here and stays exported under a deprecation note rather than being removed.
- `src/signing/codexStrategy.ts` — the two chain-call lines (simulate dirty-read and final submit) are wrapped with the timeout-only helper.
- `src/signing/types.ts` — the `PactClient` interface is intentionally left unchanged (no base-URL accessor added), preserving the public-API contract for OuronetUI and HUB.
- `tests/network.test.ts` — existing per-test state-reset pattern (currently using `setNodeConfig("node2")`) is the model the new reset function replaces; this test file is extended in place.
- `tests/interactions-read-seam.test.ts` — existing vi.fn() stub plus before-each / after-each reset pattern is the model for the new failover-submit test file.
- `tests/types.test.ts` — the v1.7.0 regression-lock that must continue to fire after this spec lands.

## Component Boundaries

- **Failover module (`src/network/`)** — owns active-host state, health checks, the `withFailover` retry wrapper, and now the failover-client factory plus the timeout helper. This is the only module aware of host switching and timeout scheduling.
- **Reads module (`src/reads/`)** — owns the uncached reader and the pluggable reader seam. After this spec, it consumes the failover wrapper and the read-tier timeout but does not implement timing or host-switching logic itself.
- **Errors module (`src/errors/`)** — owns the `SigningError` type and the family of error factories. After this spec, it adds one new factory but does not introduce a new error class or change the existing one.
- **Interactions modules (`src/interactions/*`)** — own only the per-protocol Pact-call logic. After this spec, they no longer construct chain clients themselves; they request one from the failover-client factory by chain id.
- **Codex signing strategy (`src/signing/codexStrategy.ts`)** — owns the simulate-and-submit pipeline through an injected client. After this spec, it gains timeout enforcement around the two client calls but remains failover-agnostic by design.

## Integration Points

- **Pluggable reader (`pactRead`) → uncached reader (`rawCalibratedDirtyRead`)** — existing delegation. The single-place edit inside the uncached reader propagates failover and timeout to all 16 read sites that route through `pactRead`.
- **Interactions → failover-client factory** — new delegation, replacing the prior direct construction of a URL-pinned client. The chain id is the only routing input the factory needs.
- **Codex signing strategy → injected `PactClient` → consumer** — unchanged interface boundary. The new timeout helper sits inside the strategy, between the strategy and the injected client; it does not cross the public interface.
- **Errors barrel → consumers** — new factory reachable via the existing subpath; consumers may branch on the new `TIMEOUT` code without any import changes.
- **Failover module → consumers' tests** — new reset function reachable via the existing network barrel; consumers' test suites can isolate failover state without poking module internals.
- **Failover module → Node event loop** — new unref'd interval handle so that long-lived processes can exit when their work is done without waiting on the failover health-check timer.

## Out of Scope

- F-CORE-005 and F-CORE-006 (already closed in v2.0.0).
- F-CORE-007 (the BREAKING removal of fabricated fallback values) — separate spec, will ship as v3.0.0.
- F-CORE-009 and F-CORE-010 (security and Pact-string injection findings) — separate spec.
- F-CORE-011 and F-CORE-012 (test-coverage uplift on critical surfaces) — separate spec.
- F-CORE-013 onward (codex, guard, medium and low severity findings) — separate specs.
- A multi-tenant `NodeFailoverContext` class refactor that would replace the current module-global state with an instance-per-tenant model. Deferred until a real multi-tenant SSR consumer requirement emerges; the quick-path reset function is sufficient for current consumers.
- Adding a base-URL accessor to the public `PactClient` interface. Rejected — would be a breaking public-API change for OuronetUI and HUB. The codex strategy gets timeout enforcement only, while failover stays the consumer's responsibility at that seam.
- Touching the 16 already-`pactRead`-routed read sites in the interactions modules. They inherit failover and timeout through the single-place edit inside the uncached reader.
- Removing the static URL constant from the constants module. Kept exported with a deprecation note for semver compatibility.

---

IMPORTANT: This spec contains descriptions and behaviour only. Implementation details (file contents, signatures, code shapes) are determined during phase planning.
