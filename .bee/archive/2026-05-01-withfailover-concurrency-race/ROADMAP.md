# Roadmap: withfailover-concurrency-race

## Phase-Requirement Mapping

| Phase | Goal | Requirements | Success Criteria |
|-------|------|-------------|------------------|
| 1. Production Fix and Module-Private Helper | Deliver the corrected `withFailover` retry semantics in isolation: per-invocation `attemptedBaseUrl` capture replaces the shared-host guard, supported by a new module-private primary-host accessor. No public surface change. | REQ-01, REQ-02, REQ-03 | 1. Sequential `withFailover` consumers (read-side, factory-side, codex-side) continue to behave identically. 2. The library's public network barrel surface is unchanged (no new exports added). 3. `npm run typecheck` exits 0. 4. The pre-existing v2.1.1 test suite passes unmodified (the 7 happy-path/network-error tests in the existing `withFailover` describe continue to pass). |
| 2. Regression Test, Verification Gate, and v2.1.2 Release Artifacts | Lock the corrected behavior under test, run the full verification gate, and produce every artifact the publish workflow needs to ship the v2.1.2 patch. | REQ-04, REQ-05, REQ-06, REQ-07 | 1. A new test scenario fires two concurrent `withFailover` invocations against a primary-down mock and asserts both resolve on the fallback (the previously broken case now passes). 2. The full vitest suite exits 0; total scenario count grew by at least one. 3. `npm run build` produces a clean `dist/` with no observable public-API change. 4. `package.json` version reads 2.1.2. 5. CHANGELOG.md leads with a `## 2.1.2 — 2026-05-01` entry citing F-BUG-001 closure. 6. README.md Status block leads with v2.1.2 and the version history is extended. 7. The atomic commit + `v2.1.2` tag are ready to push (the publish workflow handles npm publish + GitHub Release auto-create from there). |

## Coverage Validation

- Total functional requirements: 7 (REQ-01 through REQ-07)
- Mapped: 7
- Unmapped: 0

All 7 functional requirements are mapped across 2 phases. No gaps.

Non-functional requirements (NFR-01 through NFR-04) inform success criteria across both phases but are not individually tracked: NFR-01 (strict semver) governs Phase 1's "no public exports" guard; NFR-02 (no sequential regressions) governs Phase 1's success criterion #1; NFR-03 (test isolation) governs Phase 2's regression-test design; NFR-04 (documentation alignment) governs Phase 2's CHANGELOG + README deliverables.

## Phase Details

### Phase 1: Production Fix and Module-Private Helper

**Goal:** Rewrite `withFailover` in `src/network/nodeFailover.ts:106-127` so its retry decision uses a per-invocation captured base URL (`attemptedBaseUrl = getActiveBaseUrl()` at fn-entry) instead of reading the shared module-level `currentHost`. Add the supporting module-private `getPrimaryBaseUrl()` accessor that mirrors `getActiveBaseUrl`'s shape but reads `PRIMARY_HOST`. Touch nothing else in the file or its consumers.

**Requirements:** REQ-01, REQ-02, REQ-03

**Success Criteria** (what must be TRUE when this phase completes):

1. **Sequential-consumer compatibility preserved.** Existing call sites in `src/interactions/*` (44 chain-call sites via `getFailoverClient`), `src/reads/rawCalibratedRead.ts:87-96` (read-side failover branch), and `src/signing/codexStrategy.ts` (timeout-only seam — does not consume `withFailover` directly but relies on adjacent infrastructure) all observe identical behavior for non-concurrent failover events.
2. **Public API surface unchanged.** `src/network/index.ts` continues to read `export * from "./nodeFailover"; export * from "./failoverClient";` with no additions. The new helper is module-private (un-exported) — does not extend the `@stoachain/ouronet-core/network` subpath surface.
3. **Type-check clean.** `npm run typecheck` exits 0; no new TypeScript errors introduced.
4. **No regressions in pre-existing tests.** The 7 happy-path and network-error scenarios in the existing `withFailover` describe block (`tests/network.test.ts:142-218`) continue to pass without modification.

### Phase 2: Regression Test, Verification Gate, and v2.1.2 Release Artifacts

**Goal:** Add a new `describe("withFailover under concurrent failover", ...)` block to `tests/network.test.ts` (placed between the existing `withFailover` describe and the `resetNodeFailover` describe). The block contains at minimum one it-block that fires two concurrent `withFailover(fn)` invocations via `Promise.all`, where each `fn` is `vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")`. The test asserts both calls resolve on the fallback and each mock was invoked exactly twice. After the test, `resetNodeFailover()` restores module state. Then bump `package.json` to 2.1.2, prepend the CHANGELOG v2.1.2 entry, update the README Status + version history, and stage everything for the atomic v2.1.2 commit + tag.

**Requirements:** REQ-04, REQ-05, REQ-06, REQ-07

**Success Criteria** (what must be TRUE when this phase completes):

1. **Regression coverage in place.** The new concurrent-failover test scenario passes — pinning the corrected behavior under test for future refactors.
2. **Verification gates green.** `npm run typecheck`, `npm test`, and `npm run build` all exit 0. Test count grew by at least 1 (the new it-block).
3. **Build is clean.** `dist/` produces with no observable public-API change in the typed barrel output (consumers running `npm install @stoachain/ouronet-core@2.1.2` get the fix without any signature changes).
4. **Version field bumped.** `package.json` `"version"` field reads `"2.1.2"`. Local version-parity check passes (`grep -m1 "^## " CHANGELOG.md` matches the package.json version).
5. **CHANGELOG entry prepended.** `CHANGELOG.md` leads with `## 2.1.2 — 2026-05-01` followed by a single-concern patch entry (lead paragraph + `### Fixed` + `### Stats`) citing F-BUG-001 closure and the new test count.
6. **README updated per locked maintenance rule.** `README.md` `## Status` block leads with `2.1.2` and a one-line summary of the concurrency-race fix. Version history is extended with a v2.1.2 entry. Test-count references that cited the v2.1.1 baseline (`385`) are refreshed to the new total.
7. **Atomic-ship contract honored.** All four sub-deliverables (Phase 1's production code, Phase 2's regression test, package.json bump, CHANGELOG + README updates) stage cleanly for a single commit and a `v2.1.2` annotated tag. The `.github/workflows/publish.yml` triggers on tag push and handles npm publish + GitHub Release auto-create from there (with the known RELEASE_TOKEN org-policy limitation requiring manual GitHub Release creation post-workflow per the v2.1.0 / v2.1.1 pattern).
