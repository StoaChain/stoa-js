# Phases: withFailover Concurrency Race Fix

## Overview
This is a small bug-fix patch with a single-function rewrite, a single regression test, and a release documentation update. The work splits cleanly into two phases: a production fix phase that delivers the corrected retry semantics behind a new module-private helper, and a release phase that adds the regression test, runs the verification gates, and ships v2.1.2 with synchronized CHANGELOG and README updates. A one-phase consolidation is technically feasible given the minimal blast radius, but separating the production behavior change from the release ceremony keeps the diff easy to review and lets the regression test land against a finished implementation rather than an in-flight one.

## Phase 1: Production Fix and Module-Private Helper
**Description:** Rewrite the failover wrapper function so its retry decision uses a per-invocation captured base URL instead of the shared module-level active-host variable, and add the supporting module-private primary-host accessor. This phase delivers the corrected runtime behavior in isolation. No new public exports. No changes to any other function in the network failover module. No release artifacts touched yet.
**Deliverables:**
- The failover wrapper function in the network failover module is rewritten to capture the attempted base URL at entry time and to gate the retry on a comparison between that captured value and the canonical primary base URL.
- The retry path performs the global host flip only when the active host has not already been flipped by a sibling concurrent invocation, relying on the pre-existing idempotency guarantee of the flip helper.
- A new module-private accessor that returns the canonical primary-host base URL is added to the network failover module. The accessor is not exported through the network barrel, not added to any subpath export, and not visible to consumers.
- Strict TypeScript type checking passes with exit code 0.
- The full pre-existing test suite passes with exit code 0 (sequential consumers observe identical behavior; the existing failover wrapper test grouping passes unchanged).
**Dependencies:** None (first phase)

## Phase 2: Regression Test, Verification Gate, and v2.1.2 Release Artifacts
**Description:** Add the concurrent-failover regression scenario, run the full verification gate, bump the version, prepend the CHANGELOG entry, update the README Status block and version history, and prepare the atomic v2.1.2 release commit. This phase locks the corrected behavior under test and produces every artifact required for the publish workflow to ship the patch.
**Deliverables:**
- A new test grouping titled "withFailover — concurrent retry race" (em-dash U+2014 form, matching the sibling at `tests/network.test.ts:143`) is appended to the network test file, placed between the existing failover wrapper test grouping and the failover-reset test grouping.
- The new grouping includes at minimum one scenario that issues two simultaneous failover-wrapper invocations against a mocked environment where the primary rejects with a network-class error and the fallback resolves successfully, asserting that both concurrent calls succeed on the fallback and that each mock callback is invoked exactly twice.
- The new scenario resets the failover module state after running so it does not leak into subsequent tests.
- The full test suite passes with exit code 0 and the total scenario count grows by at least one.
- The build command emits a clean `dist/` with no observable public-API change in the typed barrel output.
- The version field in the package manifest is advanced from 2.1.1 to 2.1.2.
- The CHANGELOG receives a new v2.1.2 entry dated 2026-05-01, following the v2.1.1 single-concern patch format with a lead paragraph, a "Fixed" section citing the F-BUG-001 audit-spec closure, and a "Stats" block reporting the new test count.
- The README "Status" block leads with v2.1.2, the version history is extended with a v2.1.2 entry, and any test-count references that cited the v2.1.1 baseline are refreshed to reflect the new total.
- The four sub-deliverables (production code from Phase 1, regression test, package version bump, and the CHANGELOG and README updates) are staged for a single atomic commit followed by a `v2.1.2` annotated tag, in keeping with the established release flow.
**Dependencies:** Phase 1
