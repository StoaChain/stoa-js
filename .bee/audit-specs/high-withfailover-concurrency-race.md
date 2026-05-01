[BUG-FIX] withFailover retry guard fails for concurrent calls during host-flip

## Problem
`src/network/nodeFailover.ts`'s `withFailover` (lines 106-127) decides whether to retry on the fallback host by reading the **global** `currentHost` variable in its catch block (line 120). This works for sequential calls, but breaks under concurrency — and v2.1.0's `getFailoverClient` factory makes concurrent chain calls the norm.

### Reproduction (real-world, observable from v2.1.0 onward)

A typical interaction flow looks like:

```ts
// src/interactions/addLiquidityFunctions.ts (representative)
const { submit }   = getFailoverClient(KADENA_CHAIN_ID);  // returns withFailover-wrapped methods
const { listen }   = getFailoverClient(KADENA_CHAIN_ID);
const txDescriptor = await submit(signedTx);                    // tx1
const result       = await listen(txDescriptor);                // tx2 — issued microseconds later
```

When the primary node is failing, the two calls race:

1. **Time T₀:** primary node times out / refuses connection.
2. **Time T₁:** `tx1` (the `submit`) catches the network error. Its `withFailover` catch block reads `currentHost === PRIMARY_HOST` → guard true → `switchToFallback()` flips `currentHost = FALLBACK_HOST`. `tx1` retries on fallback successfully.
3. **Time T₂ (a few microseconds later):** `tx2` (the `listen`) catches its own network error from primary. Its `withFailover` catch block reads `currentHost === FALLBACK_HOST` (because tx1 already flipped it). Guard FAILS. `tx2` propagates `AbortError`/network error straight up without ever attempting the fallback.
4. **Result:** `tx2`'s caller sees `getFailoverClient`'s outer-boundary catch convert the rejection to `SigningError { code: "TIMEOUT" }`, even though the fallback host is healthy and would have served the call.

The user-visible failure mode is a spurious TIMEOUT on `listen`/`pollOne` immediately after a successful failover-switching `submit`. From the user's perspective, "the submit worked but the listen timed out" — which looks like a chain-side issue but is purely a client-side race.

### Why this is HIGH-priority now

Pre-v2.1.0, `withFailover` was only used by reads through `pactRead` and a few isolated sites; sequential read patterns rarely raced. **v2.1.0** routes every chain operation across all 11 interaction files (44 chain-call sites + 16 pactRead-routed read sites + the codex strategy seam) through `withFailover`. Concurrent chain calls are now the dominant pattern, not the exception. The race is reachable on any failover event in any flow that issues two or more chain calls back-to-back.

### Why this wasn't fixed in v2.1.0

The `withFailover` retry guard is pre-existing code (predates the reliability-failover spec). The v2.1.0 final implementation review (audit-bug-detector) surfaced this race as **F-BUG-001** but it was deferred out of scope — fixing it changes `withFailover`'s retry semantics for ALL callers (including pre-existing reads through `pactRead` and any other consumer), and the change deserves its own ship cycle with dedicated regression tests rather than being bundled into a feature spec.

The deferral is documented in `.bee/archive/2026-05-01-reliability-failover/DECISIONS.md` under the "Final implementation review iter 1" decision entry.

## Findings (1)

| ID | Severity | Title |
|---|---|---|
| F-BUG-001 | HIGH | `withFailover` retry guard reads global `currentHost`, fails under concurrent failover-induced calls |

## Locations

| File | Lines | Concern |
|---|---|---|
| `src/network/nodeFailover.ts` | 104-127 | `withFailover` retry guard |
| `src/network/nodeFailover.ts` | 120 (specifically) | `if (isNetworkError && currentHost === PRIMARY_HOST)` — this is the bug |
| `src/network/nodeFailover.ts` | 121-122 | `switchToFallback()` + retry call (correctly uses post-switch baseUrl) |
| `src/network/failoverClient.ts` | 264-326 | All four factory methods (dirtyRead/submit/listen/pollOne) compose `withFailover` and inherit the bug |
| `src/reads/rawCalibratedRead.ts` | 87-103 | Failover branch of `rawCalibratedDirtyRead` also inherits the bug |

The bug is one-line in concept (line 120's guard reads global state), but it cuts across every consumer of `withFailover` — that's the entire chain-RPC surface added in v2.1.0 plus the pre-existing `pactRead` routed reads.

## Root cause

`withFailover`'s contract is "retry once on the fallback if the primary attempt errors with a network-class failure". The current implementation interprets "primary attempt" as `currentHost === PRIMARY_HOST` at catch-block evaluation time. But `currentHost` is a **shared module-level mutable variable** — any sibling concurrent call that catches first and calls `switchToFallback()` mutates it before our catch runs.

The correct interpretation of "primary attempt" is **the host this specific invocation just attempted**, captured at fn-entry time. The fix is to record `attemptedBaseUrl` as a per-invocation local variable inside `withFailover` and use it instead of reading the global `currentHost`.

## Required fix

### Replace global-host guard with per-attempt baseUrl tracking

```ts
// src/network/nodeFailover.ts:104-127 — proposed shape
export async function withFailover<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const attemptedBaseUrl = getActiveBaseUrl();
  try {
    return await fn(attemptedBaseUrl);
  } catch (err: any) {
    const isNetworkError =
      err?.message?.includes("Failed to fetch") ||
      err?.message?.includes("NetworkError") ||
      err?.message?.includes("ECONNREFUSED") ||
      err?.name === "AbortError";

    // Retry whenever THIS attempt was on the primary, regardless of whether
    // a sibling concurrent call has already flipped the global host. The
    // post-switch retry below uses the new active host, so even if a sibling
    // already flipped, our retry lands on the fallback as intended.
    if (isNetworkError && attemptedBaseUrl === getPrimaryBaseUrl()) {
      // Trigger the global flip if a sibling hasn't already (idempotent —
      // switchToFallback is a no-op when currentHost already === FALLBACK_HOST).
      if (getActiveBaseUrl() === attemptedBaseUrl) {
        switchToFallback();
      }
      // Retry on the now-active fallback. If a sibling already flipped, this
      // is the same fallback baseUrl the sibling used — correct behaviour.
      return fn(getActiveBaseUrl());
    }
    throw err;
  }
}
```

The structural change is one new local variable (`attemptedBaseUrl`) and one guard rewrite. `getPrimaryBaseUrl()` is an internal accessor that returns the same value `getActiveBaseUrl()` returned at module load (or after `setNodeConfig`/`resetNodeFailover`) — exposed module-private if not already.

### Idempotent `switchToFallback`

The fix relies on `switchToFallback` being idempotent. Verify it currently is — calling `switchToFallback()` when `currentHost === FALLBACK_HOST` should be a safe no-op. If it isn't (e.g., it always restarts the retry loop), make it idempotent.

### One regression test in `tests/network.test.ts`

Add a `describe("withFailover under concurrent failover", () => { ... })` block:

- Mock the network: primary host's first call rejects with `Error("Failed to fetch")`, fallback host's first call resolves with `"ok-on-fallback"`.
- Issue **two concurrent `withFailover` calls** simultaneously: `Promise.all([withFailover(fn1), withFailover(fn2)])`.
- Assert: BOTH calls resolve with the fallback's value. (Pre-fix, the second one would propagate AbortError.)
- Assert: the network mock was called exactly twice on primary (failures) and exactly twice on fallback (successes). Total 4 invocations across the two `withFailover` calls.
- Reset state with `resetNodeFailover()` after the test.

## Side effects

- All existing single-call `withFailover` consumers continue to work identically — the guard semantic now uses per-attempt baseUrl instead of global host, but the behavior for the sequential case is unchanged.
- All existing concurrent consumers (the 81 chain-call sites in `src/interactions/*` from v2.1.0, the 16 pactRead-routed reads, and the codexStrategy seam) get the documented failover behavior they expect — concurrent calls during a failover event now correctly retry instead of spuriously timing out.
- The fix is observable as "fewer spurious TIMEOUT errors during failover events". Conservative consumers might want to add a test fixture that pins the new behaviour, but most consumers will simply experience improved reliability with no code change.

## Versioning

Per strict semver:
- This is a **bug fix** — no new public exports, no signature change, no removed feature.
- It IS an observable behavior change (concurrent calls now succeed where they previously failed) — but it's a correction to documented behavior, not a divergence from it.
- Therefore: **PATCH-level fix** is appropriate. Ships as `v2.1.2` (after v2.1.1's README patch).

Alternative interpretation: bundle into v2.2.0's `bundles/high-additive/_bundle.md` as a fourth phase. Argument for: the fix is in the same `src/network/` directory as v2.2.0's other work and shares the test surface. Argument against: a behavior change deserves its own release notes entry, and shipping it as a patch (v2.1.2) gets the correctness improvement to consumers faster than waiting for the v2.2.0 minor.

**Recommendation:** ship as standalone v2.1.2 patch BEFORE the v2.2.0 high-additive bundle. Reasons:
1. The fix is a one-file change with a single regression test — minimal blast radius.
2. v2.1.0 introduced the heavy concurrent use of `withFailover`; getting the concurrency fix to consumers quickly closes the regression window.
3. v2.2.0's high-additive bundle is already 3 phases and ~4 sub-fixes; adding a 4th would dilute focus.

## Coordination

- Phase 1 of `bundles/high-additive/_bundle.md` (crypto error taxonomy) does NOT touch `src/network/`. No conflict.
- Phase 2 of `bundles/high-additive/_bundle.md` (Pact-code injection) touches `src/pact/`. No conflict.
- Phase 3 of `bundles/high-additive/_bundle.md` (test coverage) extends `tests/network.test.ts` BUT only with the resetNodeFailover and unref tests already covered. The new concurrent-withFailover test from this spec is independent of those extensions; merge cleanly.
- If shipped as v2.1.2, the v2.2.0 high-additive bundle's `## Status` block updates and CHANGELOG entry need to acknowledge v2.1.2 as the immediate predecessor.

## Acceptance Criteria

- [ ] `src/network/nodeFailover.ts` `withFailover` rewritten to use per-invocation `attemptedBaseUrl` local variable; the `currentHost === PRIMARY_HOST` guard replaced by `attemptedBaseUrl === getPrimaryBaseUrl()`.
- [ ] `switchToFallback` verified idempotent (or made so) — calling it when already on fallback is a no-op.
- [ ] `tests/network.test.ts` extended with a `describe("withFailover under concurrent failover", ...)` block containing at minimum 1 it-block that exercises the two-concurrent-call scenario and asserts both calls succeed on the fallback.
- [ ] Existing `tests/network.test.ts` `withFailover` happy-path tests continue to pass without modification (sequential semantics unchanged).
- [ ] `npm run typecheck` exit 0.
- [ ] `npm test` exit 0; total test count grows by ≥1.
- [ ] `dist/` build clean; no public-API change observable in the typed barrel.
- [ ] CHANGELOG.md notes the concurrency-race fix; consumers seeing fewer spurious TIMEOUT errors during failover events.
- [ ] README.md `## Status` block leads with `2.1.2`; version history extended (per the locked README maintenance rule).

## Note on bundling

This spec MAY be bundled into `bundles/high-additive/_bundle.md` as a Phase 4 if shipped together with that bundle's v2.2.0 minor. In that case, the spec ships as part of v2.2.0 instead of v2.1.2. The structural change (per-attempt baseUrl tracking) is independent of the other three high-additive phases — no file conflict, no dependency.

Recommended: keep standalone v2.1.2 patch. The user can override at bundling time if they prefer the consolidated minor release.
