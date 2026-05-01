# Requirements: withfailover-concurrency-race

## Initial Description

Fix the `withFailover` retry guard concurrency race documented as F-BUG-001 in `.bee/audit-specs/high-withfailover-concurrency-race.md`. The bug surfaced during the v2.1.0 reliability-failover spec's final implementation review by the audit-bug-detector agent. It is a pre-existing bug in `src/network/nodeFailover.ts:120` whose blast radius widened with v2.1.0's introduction of `getFailoverClient`, which now routes every chain call through `withFailover` (~81 sites in `src/interactions/*` plus 16 pactRead-routed reads plus the codex strategy seam). Concurrent chain calls are now common, exposing the race.

The fix is a single-function rewrite: replace `withFailover`'s global-host guard (`currentHost === PRIMARY_HOST`) with per-invocation `attemptedBaseUrl` tracking. Module-private helper `getPrimaryBaseUrl()` to be added. Plus one regression test in `tests/network.test.ts` covering concurrent `withFailover` calls during a primary-down event.

## Requirements Discussion

This spec was created via `--from-discussion .bee/audit-specs/high-withfailover-concurrency-race.md`. The discussion file is a comprehensive bug report + fix proposal authored as a follow-up to the v2.1.0 reliability-failover ship. The standard Q&A discovery was skipped because the discussion notes already captured every locked decision. The Q&A below records those decisions for traceability:

### Questions & Answers

**Q1:** Is this a bug fix (patch-eligible) or a feature/breaking change?
**A1:** Bug fix. The current `withFailover` behavior is incorrect under concurrent calls — the documented contract is "retry once on the fallback if the primary attempt errors with a network-class failure", but the implementation interprets "primary attempt" as `currentHost === PRIMARY_HOST` at catch-block evaluation time, which is a global mutable variable that sibling concurrent calls may have already flipped. The fix is a behavior CORRECTION (toward the documented contract), not a feature addition. Patch-version-eligible per strict semver.

**Q2:** Should the fix introduce a new public export?
**A2:** No. The new `getPrimaryBaseUrl()` helper required by the fix is module-private (un-exported) so the public surface stays unchanged. This keeps v2.1.2 a clean patch (no new symbols in the network barrel). Future specs MAY decide to export it for diagnostics/telemetry; this spec does not.

**Q3:** Should `switchToFallback()` be made idempotent as part of this fix?
**A3:** Already idempotent — verified at `src/network/nodeFailover.ts:49-54` (`if (currentHost === FALLBACK_HOST) return;`). The fix relies on this property but does NOT modify `switchToFallback`. Researcher confirmed.

**Q4:** Should the fix bundle into `bundles/high-additive/_bundle.md` (v2.2.0 minor) or ship standalone?
**A4:** Standalone v2.1.2 patch. The fix is a one-file change with a single regression test — minimal blast radius. Shipping it as a patch gets the correctness improvement to consumers (OuronetUI, AncientHolder HUB) faster than waiting for the v2.2.0 minor release. The discussion file's "Note on bundling" section explicitly leaves bundling open as an option, but the recommendation is standalone, and the user has chosen the standalone path.

**Q5:** What is the test-coverage expectation?
**A5:** At minimum one new it-block in `tests/network.test.ts` exercising the two-concurrent-call scenario (`Promise.all([withFailover(fn1), withFailover(fn2)])` where fn1 and fn2 each `mockRejectedValueOnce(new Error("Failed to fetch"))` then `mockResolvedValueOnce(...)`). Asserts BOTH calls resolve on the fallback. The acceptance criterion is `total test count grows by ≥ 1`. The new it-block should land in a new `describe("withFailover under concurrent failover", ...)` block placed between line 218 (end of existing `withFailover` describe) and line 220 (start of `resetNodeFailover` describe) per researcher findings.

**Q6:** Are there existing concurrent-call test patterns in the suite to mirror?
**A6:** No. Researcher confirmed: existing `Promise.all` usage in tests (`tests/encryption-upgrade.test.ts:92,201,211`, `tests/interactions-read-seam.test.ts:33,122,263`) does NOT exercise shared-module-state mutations under concurrency. This will be the first concurrent state-mutation test in the suite. No prior pattern to mirror; the test follows from the canonical `withFailover` mocking pattern at `tests/network.test.ts:156-166`, scaled to two parallel callbacks.

**Q7:** Should the fix preserve the pre-existing happy-path semantics?
**A7:** Yes — non-negotiable. All existing single-call `withFailover` consumers (the 16 pactRead-routed reads, the 4 `getFailoverClient` factory methods, the codex strategy's pre-existing call paths) MUST continue to work identically. The fix changes only the guard semantic (per-attempt baseUrl instead of global host); for sequential calls, both interpretations yield the same outcome. Existing tests at `tests/network.test.ts:142-218` (the existing 7-test withFailover describe) MUST continue to pass without modification.

### Existing Code to Reference

From the researcher's verification pass:

- **`src/network/nodeFailover.ts:106-127`** — the function being rewritten. Pre-fix shape and exact line numbers documented above.
- **`src/network/nodeFailover.ts:25-33`** — the module-level mutable state (`PRIMARY_HOST`, `FALLBACK_HOST`, `customGasLimit`, `currentHost`, `retryTimer`).
- **`src/network/nodeFailover.ts:49-54`** — `switchToFallback()` idempotency (already correct).
- **`src/network/nodeFailover.ts:82-85`** — `getActiveBaseUrl()` shape: ``${currentHost}/chainweb/0.0/${KADENA_NETWORK}``. The new module-private `getPrimaryBaseUrl()` mirrors this but reads `PRIMARY_HOST`.
- **`src/network/nodeFailover.ts:130-153`** — `setNodeConfig()` writes to all four mutable slots and stops the retry loop. The fix does NOT modify this.
- **`src/network/nodeFailover.ts:164-171`** — `resetNodeFailover()` (Phase 1 of v2.1.0) resets all five state slots. The fix does NOT modify this; the new test consumes it for state isolation.
- **`src/network/failoverClient.ts:264-326`** — the four `getFailoverClient` factory methods (dirtyRead/submit/listen/pollOne). They consume `withFailover` via the standard pattern; they inherit the fix automatically without code changes.
- **`src/reads/rawCalibratedRead.ts:87-96`** — the read-side failover branch consumes `withFailover` via the standard pattern; inherits the fix automatically.
- **`tests/network.test.ts:142-218`** — the existing `withFailover` describe block (7 it-blocks). The new `describe("withFailover under concurrent failover", ...)` block lands right after this (line 218 closing brace) and before the `resetNodeFailover` describe at line 220. Module-level `beforeEach(() => { setNodeConfig("node2"); })` at line 28-30 covers state reset; the new describe additionally calls `resetNodeFailover()` in its own `afterEach` (or `try { ... } finally { resetNodeFailover(); }` per test) because concurrent flows leave the module in an unusual state.
- **`tests/network.test.ts:156-166`** — canonical mocking pattern: `vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")`. The new test uses TWO independent fn instances with this same pattern and dispatches them via `Promise.all`.

### Follow-up Questions

None. The discussion file already captured every decision, including:
- The recommended fix shape (per-attempt `attemptedBaseUrl` capture + new module-private `getPrimaryBaseUrl()`)
- The semver classification (patch — v2.1.2)
- The test approach (concurrent `Promise.all` of two `withFailover` invocations)
- The bundling option (deferred — explicitly chosen standalone)
- The cross-phase boundary (every existing `withFailover` consumer inherits the fix; no consumer-side changes needed)

## Visual Assets

No visual assets provided. This is a backend-only bug fix with no UI surface.

## Requirements Summary

### Functional Requirements

- [x] **REQ-01:** Replace `withFailover`'s catch-block guard at `src/network/nodeFailover.ts:120` from `if (isNetworkError && currentHost === PRIMARY_HOST)` to a per-invocation form that captures BOTH `attemptedBaseUrl = getActiveBaseUrl()` AND `attemptedPrimaryBaseUrl = getPrimaryBaseUrl()` at fn-entry, then tests `attemptedBaseUrl === attemptedPrimaryBaseUrl` in the catch-block. Both operands are LOCAL captures — neither is re-read from module-level state at catch-time. (Auto-fix iter 1 lock per F-001/F-002/F-003: re-reading `PRIMARY_HOST` at catch-time would be wrong under mid-flight `setNodeConfig` or `resetNodeFailover` because those mutators reassign `PRIMARY_HOST`. Capturing both URLs at entry guarantees the guard reflects "did we attempt what was, AT ENTRY, the primary?".)
- [x] **REQ-02:** Add a new module-private helper `getPrimaryBaseUrl()` to `src/network/nodeFailover.ts` that returns ``${PRIMARY_HOST}/chainweb/0.0/${KADENA_NETWORK}`` (mirroring `getActiveBaseUrl`'s shape but reading `PRIMARY_HOST` instead of `currentHost`). Helper is NOT exported — kept module-private to preserve the public network barrel surface. Helper is placed in the non-exported helpers cluster (between `stopRetryLoop` line 80 and the exported-getters block at line 82) per project pattern. Helper carries a single-line JSDoc matching `getActiveBaseUrl`'s style.
- [x] **REQ-03:** In `withFailover`'s retry path, call `switchToFallback()` UNCONDITIONALLY (no redundant gate). The helper's pre-existing idempotency at `src/network/nodeFailover.ts:50` (`if (currentHost === FALLBACK_HOST) return;`) correctly handles the concurrent-flip case. (Auto-fix iter 1 lock per F-002: the prior gate `if (getActiveBaseUrl() === attemptedBaseUrl) switchToFallback();` was BOTH redundant given idempotency AND incorrect under mid-flight `setNodeConfig` race. Dropping the gate eliminates both issues.) The retry call is `return await fn(getActiveBaseUrl())` (with `await` for symmetry with the initial call and to ensure sync-throw cases produce a rejected promise rather than a sync throw out of the async wrapper).
- [x] **REQ-04:** Add at least one new it-block to `tests/network.test.ts` in a new `describe("withFailover — concurrent retry race", ...)` block placed between the existing `withFailover` describe (ending line 218) and the `resetNodeFailover` describe (starting line 220). The describe name uses em-dash U+2014 subject-qualifier form matching the sibling describe at `tests/network.test.ts:143` (`withFailover — primary-fallback retry`). The new test issues two concurrent `withFailover` calls via `Promise.all([withFailover(fn1), withFailover(fn2)])`, where each fn `mockRejectedValueOnce(new Error("Failed to fetch"))` then `mockResolvedValueOnce("ok-on-fallback")`. Asserts: BOTH calls resolve to the fallback's value; each fn was called exactly twice (primary fail + fallback success); state is reset post-test via `resetNodeFailover()`.
- [x] **REQ-05:** All existing tests in `tests/network.test.ts` (currently 25 it-blocks per researcher) MUST continue to pass without modification. Total test count after the spec ships: ≥ 26.
- [ ] **REQ-06:** Bump `package.json` version from `2.1.1` → `2.1.2`. Add a CHANGELOG.md entry following the v2.1.1 single-concern patch format (heading `## 2.1.2 — 2026-05-01`, lead paragraph describing the race + fix, `### Fixed` bullet citing F-BUG-001 closure, `### Stats` block).
- [x] **REQ-07:** Update README.md `## Status` block to lead with `2.1.2`, extend the version history with a v2.1.2 entry (per the locked README maintenance rule from v2.1.1's lesson). Test-count references (currently `385`) updated if the new it-block changes them — likely `386` or higher depending on what the count was at v2.1.1's CHANGELOG closing.

### Non-Functional Requirements

- [x] **NFR-01: Strict semver compliance.** No new public exports. No signature changes. No removals. The fix is a behavior correction (toward documented contract), patch-eligible.
- [x] **NFR-02: No regressions for sequential consumers.** Existing happy-path tests (the 7 in the current `withFailover` describe) MUST pass without modification. Single-call semantics are unchanged.
- [x] **NFR-03: Test isolation.** The new concurrent test MUST NOT leak module state into subsequent tests. Use `resetNodeFailover()` in `afterEach` (or per-test `try/finally`).
- [ ] **NFR-04: Documentation alignment.** README + CHANGELOG MUST reflect the v2.1.2 release per the locked maintenance rule. The npm package page (https://www.npmjs.com/package/@stoachain/ouronet-core) must show v2.1.2 as latest with the README updated.

### Reusability Opportunities

- **Mock pattern at `tests/network.test.ts:156-166`** — `vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")`. The new test reuses this verbatim, just doubled (two independent fn instances) and wrapped in `Promise.all`.
- **State-reset pattern** at `tests/network.test.ts:28-30` (module-level `beforeEach(() => { setNodeConfig("node2"); })`) plus the `resetNodeFailover()` calls inside the `retryTimer.unref` describe (`tests/network.test.ts:255, 258`). The new describe uses both.
- **`switchToFallback` idempotency at `src/network/nodeFailover.ts:49-54`** — the fix relies on this; no modification needed.
- **`getActiveBaseUrl()` at `src/network/nodeFailover.ts:82-85`** — the new `getPrimaryBaseUrl()` is structurally identical; copy the URL-construction line.
- **`KADENA_NETWORK` const at `src/network/nodeFailover.ts:11`** — already in scope inside the file; the new helper consumes it.

### Scope Boundaries

**In Scope:**
- [ ] One-function rewrite of `withFailover` at `src/network/nodeFailover.ts:106-127`.
- [ ] One new module-private helper `getPrimaryBaseUrl()` in the same file.
- [ ] One new it-block in `tests/network.test.ts` (and the new `describe` block wrapping it).
- [ ] `package.json` version bump 2.1.1 → 2.1.2.
- [ ] `CHANGELOG.md` v2.1.2 entry prepended.
- [ ] `README.md` Status + version history extended for v2.1.2.

**Out of Scope:**
- Any other fix surfaced during the v2.1.0 final implementation review (F-BUG-002/003/004 were already fixed in the v2.1.0 commit; F-BUG-005 was a false positive).
- Any other audit-spec from the 2026-04-30 audit cycle (see `bundles/high-additive/_bundle.md` for v2.2.0, `bundles/medium/_bundle.md` for v2.3.0, `low-improvements.md` for v2.3.1, `high-error-fabricated-fallbacks.md` for v3.0.0 major).
- Exporting `getPrimaryBaseUrl()` as a public symbol (a future spec MAY add this for diagnostics/telemetry; out of scope here).
- Any change to `setNodeConfig`, `resetNodeFailover`, `isHealthy`, `startRetryLoop`, `getActiveBaseUrl`, or any other `nodeFailover.ts` function. Only `withFailover` is rewritten.
- Any change to `getFailoverClient`'s four factory methods. They inherit the fix automatically.
- Any change to `rawCalibratedRead.ts` failover branch. It inherits the fix automatically.

### Technical Considerations

- **Atomic-ship contract:** The fix ships as ONE patch release (v2.1.2). All four sub-deliverables (production code, regression test, package.json bump, CHANGELOG + README docs) land in a single commit and tag.
- **No public-API change:** Verified `src/network/index.ts` is currently `export * from "./nodeFailover"; export * from "./failoverClient";`. The new `getPrimaryBaseUrl()` is module-private — does NOT extend the barrel. Public surface preserved.
- **Idempotency invariants relied upon (verified by researcher):**
  - `switchToFallback()` short-circuits when already on fallback (`nodeFailover.ts:49-54`).
  - `startRetryLoop()` short-circuits when `retryTimer` is already set (`nodeFailover.ts:64-65`).
  - Both are exercised by the v2.1.0 `tests/network.test.ts` extensions and the new concurrent test continues to satisfy them.
- **Pre-existing locale failure in `tests/gas.test.ts > formatMaxFee`** (Windows non-en-US locale issue) continues to exist; unrelated to this spec.
- **Test count baseline shift:** v2.1.1 baseline is 385 it-blocks. v2.1.2 should report ≥ 386 (add the one new it-block; possibly more if the spec author chooses to add additional concurrency cases like 3-way concurrent or sibling-success-during-flip).
- **CI workflow:** The existing `.github/workflows/publish.yml` triggers on `v*` tag push. Tag v2.1.2 follows the same flow (typecheck + test + build + npm publish + GitHub Release auto-create). Note: GitHub Release auto-create has been failing (RELEASE_TOKEN org-policy issue, pre-existing) — manual Release creation via the .secrets/pat.txt PAT is the workaround per the v2.1.0 / v2.1.1 pattern.
- **Implementation mode:** premium (Opus everything) per user choice in `--from-discussion` discovery. Will be written to `.bee/config.json` at Step 9.7.
