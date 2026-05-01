# Specification: withFailover Concurrency Race Fix

## Goal
Correct the `withFailover` retry guard so that concurrent chain calls during a primary-node failover event all retry on the fallback host instead of one call winning the failover and siblings spuriously failing with TIMEOUT. The fix is a single-function behavior correction shipped as a v2.1.2 patch with no change to the public API surface.

## User Stories
- As an OuronetUI consumer, I want concurrent chain calls (e.g. a `submit` immediately followed by `listen`) to all succeed on the fallback when the primary node fails, so that I do not see spurious TIMEOUT errors immediately after a successful failover-switching call.
- As an AncientHolder HUB consumer, I want every `withFailover`-wrapped call to honor the documented "retry once on the fallback if the primary attempt errors with a network-class failure" contract, so that my server-side flows are resilient in the same way reads have always been.
- As a maintainer of `@stoachain/ouronet-core`, I want the failover retry decision to be based on the host this specific invocation just attempted, not on shared mutable global state, so that the function is correct under any concurrency pattern.
- As a downstream developer, I want the v2.1.2 release to be a strict patch with no new exports and no signature changes, so that I can upgrade without code changes and inherit the fix transparently.
- As a project reviewer, I want at least one regression test that exercises two simultaneous `withFailover` invocations during a primary-down event, so that this race cannot silently regress in future revisions.
- As a consumer reading the changelog, I want a clear v2.1.2 entry citing the F-BUG-001 closure with the same single-concern format the v2.1.1 entry established, so that the release history stays scannable.
- As a consumer browsing the npm package page, I want the README Status block and version history to lead with v2.1.2 immediately after publish, so that the published documentation matches the shipped version.

## Specific Requirements

### Failover Retry Behavior
- The retry decision inside `withFailover` is based on the host that this specific invocation attempted at entry time AND the primary base URL that was in effect at entry time. Both values are captured into local invocation-scoped constants before the first call to the wrapped function. The catch-block decision compares those two captured values against each other; neither operand is re-read from module-level state at catch-time. This makes the decision robust to ANY concurrent mutation of module state between fn-entry and catch — sibling concurrent invocations, mid-flight `setNodeConfig` calls, and mid-flight `resetNodeFailover` calls all leave the in-flight invocation's decision intact.
- When a network-class failure occurs and the failed attempt was on the primary host (per the captured-at-entry comparison above), the call retries on the fallback host. This holds even if a sibling concurrent invocation has already triggered the global host flip in the time between this invocation's entry and its catch handler running.
- The global host flip is performed by calling the existing `switchToFallback` helper unconditionally inside the retry path. The helper's pre-existing idempotency property (cited in requirements) ensures that calling it when a sibling invocation has already flipped the active host is a safe no-op. No additional gate is added at the call site — adding a gate would be both redundant given the helper's idempotency and incorrect under mid-flight `setNodeConfig` (which mutates the active host to a value that does not match the in-flight invocation's captured attempted URL).
- Network-class failures continue to be classified by the same signals already in use: messages containing "Failed to fetch", "NetworkError", or "ECONNREFUSED", or an error name of "AbortError". No new error classifications are added.
- Non-network errors continue to propagate without a retry attempt, identical to pre-fix behavior.
- When the failed attempt was already on the fallback host (per the captured-at-entry comparison), the error propagates without a second retry, identical to pre-fix behavior.

### Sequential Consumer Compatibility
- All existing single-call consumers of `withFailover` (chain reads routed through `pactRead`, the four `getFailoverClient` factory methods for dirtyRead/submit/listen/pollOne, and the codex signing strategy seam) observe identical behavior to pre-fix for non-concurrent call patterns.
- The fix introduces no behavioral change for happy-path calls where the primary host succeeds on the first attempt.
- The fix introduces no behavioral change for the standard sequential failover case where a single call hits the primary, fails, flips the host, and retries on the fallback.

### Internal Helper Surface
- An internal accessor that returns the canonical primary-host base URL is added to the network failover module to support the per-attempt comparison.
- This accessor is module-private. It is not added to the network barrel export, not added to any subpath export, and not surfaced to consumers in any form.
- The accessor's value is derived from the same configuration inputs that already drive the active-host base URL, so its value tracks `setNodeConfig` and `resetNodeFailover` calls correctly.

### Public API Stability
- The public surface exported from the network subpath is unchanged. No symbol is added, removed, renamed, or altered in signature.
- The codex signing seam, the failover client factory, and the calibrated read path inherit the corrected behavior automatically. None of these consumers require code changes.
- The `setNodeConfig`, `resetNodeFailover`, `isHealthy`, `startRetryLoop`, `getActiveBaseUrl`, and `switchToFallback` functions are not modified by this spec. The fix relies on `switchToFallback`'s pre-existing idempotency property (already verified at the source location cited in requirements).

### Regression Test Coverage
- A new test grouping titled "withFailover — concurrent retry race" is added to the existing network test suite, placed between the existing `withFailover` test grouping and the `resetNodeFailover` test grouping. (Em-dash form U+2014 with single space on each side, matching the sibling describe at `tests/network.test.ts:143` `withFailover — primary-fallback retry`.)
- The new grouping includes at minimum one scenario that issues two simultaneous `withFailover` invocations against a mocked environment where the primary host rejects with a network-class error and the fallback host resolves successfully.
- The scenario asserts that both concurrent invocations resolve to the fallback's success value.
- The scenario asserts that each mocked callback was invoked exactly twice (once on the primary that failed, once on the fallback that succeeded), for a total of four mock invocations across the two parallel calls.
- The scenario resets the failover module state after running so that subsequent tests are isolated from any module-level mutations the concurrent flow produced.
- The pre-existing `withFailover` test grouping (the 7 scenarios documented at the source range cited in requirements) continues to pass without modification.
- The total scenario count in the network test file grows by at least one. The total project test count grows by at least one.

### Build, Type, and Test Gates
- Strict TypeScript type checking passes with exit code 0.
- The full test suite passes with exit code 0.
- The build emits a clean `dist/` with no public-API observable change in the typed barrel output.

### Release Documentation
- The package version field advances from 2.1.1 to 2.1.2.
- A new CHANGELOG entry is prepended for v2.1.2 dated 2026-05-01. The entry follows the same single-concern patch format established by the v2.1.1 entry: a heading, a lead paragraph describing the concurrency race and its correction, a "Fixed" section citing the F-BUG-001 audit-spec closure, and a "Stats" block reporting the post-fix test count and any other relevant counters.
- The README "Status" block leads with version 2.1.2.
- The README version history is extended with a v2.1.2 entry summarizing the concurrency-race fix.
- Any test-count references in the README that previously cited the v2.1.1 baseline are updated to reflect the new total after the regression test lands.

### Release Coordination
- All four sub-deliverables (production code, regression test, version + CHANGELOG + README updates, and the verification gate) ship in a single atomic commit and a single `v2.1.2` tag.
- The publish workflow that triggers on `v*` tag push runs the standard typecheck + test + build + version-parity + npm-publish pipeline. The GitHub Release auto-create step continues to operate per the existing token configuration; if the pre-existing org-policy issue blocks auto-create, the release entry is created manually following the v2.1.1 pattern.

## Visual Design
No visual assets provided. This is a backend library bug fix with no UI surface and no consumer-facing visual artifacts.

## Existing Code to Leverage
- The active-host base URL accessor already in the network failover module (cited at `src/network/nodeFailover.ts:82-85` in requirements). The new module-private primary-host accessor mirrors its URL-construction shape and reads from the primary-host configuration slot instead of the active-host slot.
- The module-level configuration state for primary host, fallback host, and active host (cited at `src/network/nodeFailover.ts:25-33` in requirements). The fix consumes these values through accessors, not directly.
- The fallback-flip helper's existing idempotency property (cited at `src/network/nodeFailover.ts:49-54` in requirements). The fix relies on this guarantee and does not modify it.
- The canonical mocking pattern in the existing network test file (cited at `tests/network.test.ts:156-166` in requirements): a mock callback that rejects once with a network-class error and then resolves with a fallback success value. The new regression test reuses this pattern as two independent mock instances dispatched through `Promise.all`.
- The test-suite state-reset conventions: a module-level setup hook that calls `setNodeConfig` for each test, and the explicit `resetNodeFailover` calls used in the retry-timer test grouping. The new test grouping uses both.
- The v2.1.1 CHANGELOG entry (cited at `CHANGELOG.md:1-43` in requirements) as the precedent for the v2.1.2 entry's structure, tone, and section ordering.
- The version field in the package manifest (cited at `package.json:3` in requirements) as the single source of truth that the publish workflow's parity check validates against the git tag.

## Out of Scope
- Exporting the new primary-host base URL accessor as a public symbol. A future spec may add this for diagnostics or telemetry; this spec keeps it module-private.
- Any change to `setNodeConfig`, `resetNodeFailover`, `isHealthy`, `startRetryLoop`, `getActiveBaseUrl`, or `switchToFallback`. Only the failover wrapper function is rewritten.
- Any change to the four `getFailoverClient` factory methods. They inherit the fix automatically through their composition of the failover wrapper.
- Any change to the calibrated read path's failover branch. It inherits the fix automatically.
- Other findings from the v2.1.0 final implementation review (the audit-spec catalog includes additional findings that were either fixed in v2.1.0 or scoped to other release vehicles).
- Any other audit-spec from the 2026-04-30 audit cycle, including the high-additive bundle scoped to v2.2.0, the medium bundle scoped to v2.3.0, the low-improvements list scoped to v2.3.1, and the fabricated-fallbacks finding scoped to v3.0.0.
- Bundling this fix into the v2.2.0 high-additive minor release. The discussion explicitly chose the standalone patch path.
- Adding more than one regression scenario. The spec sets a floor of one new test scenario; the implementer may add additional concurrency cases (three-way concurrent, sibling-success-during-flip) at their discretion, but additional cases are not required.
- Resolving the pre-existing locale-related failure in the gas test file. That failure is unrelated to this spec.
- Any consumer-side change in OuronetUI or AncientHolder HUB. Both consumers inherit the fix transparently on upgrade.
