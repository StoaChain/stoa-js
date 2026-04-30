[RELIABILITY-FIX] Wire node failover and timeouts across reads and submits

## Problem
The library advertises automatic node failover (primary node2 → fallback node1 on network errors) and uses module-global state to track the active host. In practice the failover machinery is half-wired:

1. **`withFailover` is dead code.** The wrapper at `nodeFailover.ts:104-125` is exported but never called by anything in `src/`. Every `submit(...)` and many `dirtyRead(...)` paths invoke `createClient(getPactUrl(...))` directly, capturing the URL once at call time and giving up on network failure.
2. **Default reader bypasses failover.** `rawCalibratedDirtyRead` defaults to the static `PACT_URL` constant from `constants/kadena.ts` (pinned to node2 at module init), not `getActivePactUrl(chainId)`. After a failover flips the active host, every default read still hits the dead node.
3. **No timeouts anywhere.** Neither `dirtyRead` nor `submit` has any `Promise.race`/`AbortController` budget. A primary-node hang pins a UI tab indefinitely (or a HUB worker slot until GC).
4. **Module-global state is shared across consumers.** `currentHost`, `PRIMARY_HOST`, `FALLBACK_HOST`, `customGasLimit`, `retryTimer` are module-level `let` bindings. In multi-tenant SSR or jsdom test runners, one tenant's `setNodeConfig()` flips the active host for every other tenant. Concurrent `setNodeConfig()` calls can also leak `retryTimer` setIntervals.

## Findings (4)
| ID | Severity | Title |
|---|---|---|
| F-CORE-002 | HIGH | `withFailover` is dead code — submit paths bypass it entirely |
| F-CORE-003 | HIGH | `rawCalibratedDirtyRead` bypasses node failover via static `PACT_URL` default |
| F-CORE-004 | HIGH | `nodeFailover` module-global state leaks across consumers |
| F-CORE-008 | HIGH | No timeout on chain `submit` / `dirtyRead` calls |

## Locations
- `src/network/nodeFailover.ts:25-33,104-125,128-151,188-193`
- `src/reads/rawCalibratedRead.ts:17,49,58-59`
- `src/interactions/*.ts` — every `createClient(getPactUrl(...)).submit(...)` and `dirtyRead(...)` call site (~30+)

## Required Fixes

### Fix 1 — Wire `withFailover` into reads and submits
Replace direct `createClient(getPactUrl(...)).submit(signed)` with a `withFailover(baseUrl => createClient(baseUrl).submit(signed))` pattern. Same for the `dirtyRead` paths in `rawCalibratedDirtyRead` and the 16 pure-read sites that bypass `pactRead` (covered separately in `[ARCH-FIX]` spec — coordinate so the seam-bypass fix and the failover fix land together for the read path).

For `submit`, add a request-key dedup guard: the retry must replay the SAME signed transaction (same request key) — not rebuild a new one. Otherwise a primary-node hiccup mid-submit could double-submit (signed twice with different timestamps). Document this contract in the wrapper's JSDoc.

### Fix 2 — Default reader uses active URL
Change `rawCalibratedRead.ts:49` from:
```ts
const pactUrl = options?.pactUrl ?? PACT_URL;
```
to:
```ts
const pactUrl = options?.pactUrl ?? getActivePactUrl(chainId);
```
Import `getActivePactUrl` from `../network`. Keep the explicit-override path for tests and for consumers that pin a specific URL.

### Fix 3 — Add timeouts to all chain calls
Wrap `dirtyRead` and `submit` in `Promise.race` against an `AbortSignal.timeout(...)`. Defaults: 15s for `dirtyRead`, 60s for `submit`. Make the timeouts configurable via the same options bag as `tier`/`pactUrl`. Surface `TIMEOUT` as a distinct error code via `errors/transactionErrors.ts` so UI can show "the node is slow" rather than "transaction failed".

### Fix 4 — Isolate module-global state
Quick path: export `resetNodeFailover()` for tests so they can clean state in `afterEach`. Also call `retryTimer.unref?.()` in `startRetryLoop()` so Node consumers don't keep the event loop alive solely for the timer.

Proper path (defer if too large): convert `nodeFailover.ts` to a `NodeFailoverContext` class. Keep the module-level singleton as a default backwards-compat shim (`export const defaultFailoverContext = new NodeFailoverContext()` plus current free-function exports as thin wrappers). Multi-tenant consumers can construct their own contexts.

## Acceptance Criteria
- [ ] All `submit` call sites in `src/interactions/*` and `src/signing/codexStrategy.ts` route through a `withFailover`-aware code path.
- [ ] `rawCalibratedDirtyRead` default `pactUrl` resolves via `getActivePactUrl(chainId)` not the static `PACT_URL`.
- [ ] All chain calls (read + submit) accept and honour a configurable timeout, defaulting to 15s read / 60s submit.
- [ ] Timeout failures throw `SigningError`/`SimulationError` with `code: "TIMEOUT"`.
- [ ] `nodeFailover` exports `resetNodeFailover()` and the retry interval calls `retryTimer.unref?.()`.
- [ ] A new test in `tests/network.test.ts` exercises: primary-down → failover → submit succeeds on fallback. Use `vi.useFakeTimers()` to control the retry loop without leaking real intervals.
- [ ] A new test asserts that a 16s-hanging chain call rejects with `TIMEOUT` rather than hanging the test indefinitely.
- [ ] `npm test` passes with no leaked timers (Vitest's "Open handles" check stays clean).
- [ ] No `dirtyRead`/`submit` site in `src/` lacks an explicit timeout budget.
