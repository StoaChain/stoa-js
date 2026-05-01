# Phases: reliability-failover

## Overview

This spec closes four HIGH-severity audit findings (F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-008) across two boundaries: the failover module and the chain-call surface. The work is split into four phases ordered by ascending blast radius — quick wins and isolated edits first, the bulk site migration later. This ordering keeps each phase independently shippable in principle, lets the test suite catch regressions earlier in the pipeline, and means the largest mechanical edit (Phase 3, 81 sites) executes against a codebase that already has the failover wrapper, the timeout helper, the new error code, and the read-side coverage proven green.

The dependency chain is linear and tight: each later phase imports symbols introduced by an earlier one. Parallel execution across phases is not viable; parallelism within each phase (across the 11 interaction files in Phase 3, across the new test files in Phase 4) is. The new `getFailoverClient` factory and `runWithTimeout` helper both live in a single new module introduced in Phase 3, but Phase 2 introduces a precursor — an inline `withFailover` + timeout wrap inside the uncached reader — that proves the pattern in one place before the bulk migration generalises it.

Cross-phase coordination notes (locked decisions from discovery):

- The new factory module is `src/network/failoverClient.ts` and exports both `getFailoverClient(chainId)` and `runWithTimeout(operation, fn, timeoutMs)`. The factory wraps `withFailover` plus per-operation timeouts; the helper provides timeout-only enforcement for the codex strategy seam where failover is the consumer's responsibility.
- The new `createTimeoutError(operation, timeoutMs)` factory lives next to the existing `createSigningError` and `createSimulationError` in `src/errors/transactionErrors.ts` and returns a `SigningError` with `code: "TIMEOUT"`.
- Default timeouts: 15s read, 60s submit, **180s listen** (~6 Kadena blocks; long-poll for tx inclusion), 30s poll-one. Configurable per-call via the `read/submit/listen/poll`-`TimeoutMs` options.
- Timeout implementation pattern: `Promise.race` against a scheduled rejection plus an `AbortController` passed through to `@kadena/client`'s `ClientRequestInit.signal`. Defence-in-depth, because `cross-fetch` had patchy abort honouring in older Node versions.
- The static URL constant in `src/constants/kadena.ts` stays exported with a deprecation note (semver compatibility); only its use inside `src/reads/rawCalibratedRead.ts` is removed.
- Phase 3 is the bulk migration: 81 one-line replacements across 11 interaction files, plus 2 codex-strategy wraps (those move to Phase 4 since they use the timeout helper). The 16 already-migrated read sites are NOT touched.
- Test isolation: the new `resetNodeFailover()` export plus `retryTimer.unref?.()` together close the "Open handles" warning class.

This spec ships as v2.1.0 (MINOR — non-breaking widening). Version bump and `CHANGELOG.md` entry happen at the end of Phase 4.

## Phase 1: State isolation and default-URL pivot (low-risk seed)

**Description:** Lay the groundwork by handling three small, low-risk edits that unlock everything later. Add the test-isolation reset function on the failover module, attach `unref` to the health-check retry interval, and switch the uncached reader's default URL from the static primary-pinned constant to the failover-aware per-call resolver. None of these edits adds a new helper or wraps a chain call yet; they prepare the surface so Phases 2 and 3 can layer cleanly on top.

**Deliverables:**
- The failover module exports a reset function that returns its five module-level state slots to their initial values, with documentation scoping its intended use to test isolation.
- The retry interval handle is unref'd via an optional-call form so that Node consumers stop pinning their event loop on the health-check timer, with browsers (where the handle is a numeric primitive) unaffected.
- The uncached reader resolves its default URL from the active failover host on every call instead of capturing a static module-load constant. The static URL constant remains exported with a deprecation note in its documentation.
- The PACT_URL import is removed from the uncached reader.
- Quick verification that the existing test suite still passes (no new tests added in this phase yet — Phase 4 owns the new test files; this phase relies on existing coverage).

**Requirements addressed:** REQ-05, REQ-12, REQ-13.

**Dependencies:** None (first phase).

## Phase 2: Timeout error code and read-side failover wrap

**Description:** Introduce the `TIMEOUT` error classification and apply the first failover + timeout wrap inside the uncached reader. This phase proves the timeout pattern (`Promise.race` plus `AbortController`) inline at one site before Phase 3 generalises it via the failover-client factory. Because every read in the interactions layer routes through the pluggable reader, which delegates to the uncached reader by default, this single edit propagates failover and timeout coverage to all 16 already-migrated read sites without touching any of them.

**Deliverables:**
- A new `createTimeoutError(operation, timeoutMs, additionalContext?)` factory inside the existing transaction-errors file, modelled on the existing signing-error and simulation-error factories. It returns a `SigningError` with `code: "TIMEOUT"`, a message identifying the operation and elapsed timeout, and actionable suggestions.
- Automatic re-export of the new factory through the existing errors barrel (no barrel edit required if the barrel uses `export *`).
- The dirty-read invocation inside the uncached reader is wrapped with the existing `withFailover` helper plus a 15-second timeout using the `Promise.race` + `AbortController` pattern. On timeout, the wrapped call rejects with the new `TIMEOUT` classified error.
- The pluggable reader's options bag accepts a read-timeout override and forwards it through to the uncached reader so per-call overrides are possible.
- The existing test suite continues to pass; behavioural verification of the new wrap arrives in Phase 4's new test files.

**Requirements addressed:** REQ-06, REQ-07, REQ-08, REQ-11.

**Dependencies:** Phase 1 (Phase 1's default-URL pivot is the precondition for the failover wrap to be meaningful — without it, the wrap would target the static primary URL).

## Phase 3: Failover-client factory and 81-site migration

**Description:** Add the new failover-client factory module and migrate every chain-call site in the interactions layer to use it. This is the largest phase by edit count (81 one-line replacements across 11 interaction files) but mechanically the simplest: each site changes from constructing a URL-pinned client to requesting one from the factory by chain id. The factory itself composes pieces already proven in Phase 2 (`withFailover`, the `Promise.race` + `AbortController` timeout pattern, the `TIMEOUT` error code) into one reusable surface.

**Deliverables:**
- A new module `src/network/failoverClient.ts` exports a `getFailoverClient(chainId, options?)` function that returns the four standard chain operations (dirty-read, submit, listen, poll-one) with `withFailover` plus the per-operation default timeout from REQ-09 baked into each. The submit operation captures the same signed-transaction reference on retry (request-key dedup contract documented in JSDoc).
- The new module also exports a `runWithTimeout(operation, fn, timeoutMs)` helper for use by Phase 4's codex-strategy wraps. It applies timeout enforcement and `TIMEOUT` classification only — no host switching.
- **Phase 2's inline read-side wrap is refactored to consume `runWithTimeout`.** The inline `Promise.race` + `AbortController` block introduced inside `src/reads/rawCalibratedRead.ts` in Phase 2 is replaced with a single `runWithTimeout(...)` call now that the helper exists. This eliminates the temporary code duplication and aligns with the spec's "future fixes touch one place" goal. Functionally identical — the inline block was deliberately implemented to match the helper's eventual contract for exactly this reason.
- The new factory and helper flow through the existing `src/network/index.ts` barrel.
- Every chain call in the 11 interaction files (`activateFunctions`, `addLiquidityFunctions`, `coilFunctions`, `crossChainFunctions`, `dexFunctions`, `guardFunctions`, `kpayFunctions`, `ouroFunctions`, `pensionFunctions`, `urStoaFunctions`, `wrapFunctions`) is migrated from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`. Total: 81 sites (45 submit/listen/poll-one + 36 dirty-read-as-simulation). The 16 already-migrated read-only sites are NOT touched. The grand chain-call inventory across the project is 83 (interactions 81 + codex-strategy 2); the 2 codex-strategy sites are migrated separately in Phase 4 via `runWithTimeout`.
- The existing test suite continues to pass after the migration. Behavioural failover verification arrives in Phase 4.

**Requirements addressed:** REQ-01, REQ-02, REQ-03, REQ-09, REQ-10.

**Dependencies:** Phase 2 (the factory consumes the `TIMEOUT` error code and reuses the same `Promise.race` + `AbortController` pattern proven in the read-side wrap).

## Phase 4: Codex strategy wraps, new tests, quality gates, ship

**Description:** Apply the timeout-only wraps at the codex-strategy seam where failover is intentionally the consumer's responsibility, then add the two new test files and extend the existing network test, then run all three quality gates and prepare the v2.1.0 release. This phase is also where the spec's behavioural assertions get proved: the timeouts test file is the project's first usage of vi.useFakeTimers, and the failover-submit test file pins the request-key dedup contract via reference-equality assertions.

**Deliverables:**
- The two chain-call lines inside the codex signing strategy (the simulate dirty-read and the final submit) are wrapped with the `runWithTimeout` helper from Phase 3, providing timeout enforcement and `TIMEOUT` classification only. JSDoc at the call sites documents the deliberate trade-off: failover stays the consumer's `PactClient` responsibility because adding a base-URL accessor would be a breaking interface change. The request-key dedup contract from REQ-01 is N/A here because `runWithTimeout` does not retry — it only times out and rejects.
- A new `tests/timeouts.test.ts` covering the four timeout scenarios from REQ-14 using vi.useFakeTimers, with vi.useRealTimers in the after-each hook to prevent timer-mock leakage.
- A new `tests/failover-submit.test.ts` covering the primary-down → fallback retry flow per REQ-15, with a reference-equality assertion that the same signed-transaction reference was passed to the retry attempt.
- The existing `tests/network.test.ts` is extended with two cases per REQ-16: the new reset function returns all five state slots to initial values, and the retry interval has unref invoked on it on Node.
- All three quality gates pass: typecheck (REQ-18), full test suite with the new files included (REQ-19, ≥361 tests with ≥15 new it-blocks), and clean build with the new factory observable through the network subpath barrel (REQ-20). The v1.7.0 type-regression lock continues to fire (REQ-17), and Vitest reports no "Open handles" warnings (REQ-17).
- The package version is bumped to v2.1.0, a CHANGELOG entry is added describing all four fixes and the non-breaking nature of the change, and the release is ready for the standard tag-and-publish flow.

**Requirements addressed:** REQ-04, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20.

**Dependencies:** Phase 3 (the codex-strategy wraps consume `runWithTimeout`; the failover-submit test exercises the factory introduced in Phase 3; the timeouts test exercises both the read-side wrap from Phase 2 and the factory from Phase 3).
