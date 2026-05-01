# Phase 4: CodexStrategy wraps, tests, quality gates, ship -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = which REQ-IDs from ROADMAP.md this task addresses
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (filled in by researcher in pre-Pass-2 step)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping) — assigned in Pass 2
-->

## Goal

Close the last two unwrapped chain-call sites (in `src/signing/codexStrategy.ts`) with `runWithTimeout` timeout-only wraps, then prove the entire spec's behavioural assertions with three test deliverables: the project's first `vi.useFakeTimers` file covering all four timeout tiers, a failover-submit file pinning the request-key dedup contract via reference-equality assertions, and two new cases extended into the existing network test. After all tests are green, run the three quality gates (typecheck, full suite ≥361 tests, clean build), then bump the version to v2.1.0 and write the CHANGELOG entry to mark the spec complete.

## Dependency Analysis

| Task | Depends On | Files Owned |
|------|-----------|-------------|
| T4.1 | Phase 3 complete (runWithTimeout available) | `src/signing/codexStrategy.ts` |
| T4.2 | Phase 3 complete (getFailoverClient available) | `tests/timeouts.test.ts` (NEW) |
| T4.3 | Phase 3 complete (getFailoverClient available) | `tests/failover-submit.test.ts` (NEW) |
| T4.4 | Phase 1 complete (resetNodeFailover available) | `tests/network.test.ts` |
| T4.5 | T4.1, T4.2, T4.3, T4.4 | none (read-only verification) |
| T4.6 | T4.5 | `package.json`, `CHANGELOG.md` |

**File-conflict scan (Wave 1):** T4.1 owns `src/signing/codexStrategy.ts`. T4.2 creates `tests/timeouts.test.ts` (new file). T4.3 creates `tests/failover-submit.test.ts` (new file). T4.4 modifies `tests/network.test.ts`. All four file sets are disjoint — zero conflicts. T4.1–T4.4 run in parallel as Wave 1.

**Wave consolidation:** T4.5 is a single-task wave with a genuine sequential dependency (must run after all four Wave 1 tasks produce their output; it verifies their integrated result). T4.6 is a single-task wave with a genuine sequential dependency on T4.5 (the CHANGELOG entry must reflect the verified test count). Both 1-task waves cannot be merged without violating documented sequential dependencies.

## Wave 1 (parallel -- no dependencies)

- [x] T4.1 | Wrap the two chain calls in `src/signing/codexStrategy.ts` (the simulate dirty-read at line 131 and the final submit at line 153) with `runWithTimeout`, providing timeout enforcement and TIMEOUT classification only — no failover | bee-implementer
  - requirements: [REQ-04]
  - acceptance:
    - In `src/signing/codexStrategy.ts`, the line `const simResult = await this.client.dirtyRead(sim);` (currently at line 131) is replaced with a `runWithTimeout`-wrapped version. The timeout value uses 15000 ms (the locked read default).
    - The line `const raw = await this.client.submit(signed);` (currently at line 153) is similarly replaced with a `runWithTimeout`-wrapped version using 60000 ms (the locked submit default).
    - **Signal forwarding is prohibited at this seam.** `PactClient.dirtyRead` and `PactClient.submit` in `src/signing/types.ts` do NOT accept a second options argument with `signal`. The `runWithTimeout` callback still receives a `controller` parameter (for the race discipline) but MUST NOT forward `{ signal: controller.signal }` to the client calls. The wrapper callbacks take the form `(controller) => this.client.dirtyRead(sim)` and `(controller) => this.client.submit(signed)`. The controller is constructed inside `runWithTimeout` for the `Promise.race` timeout mechanism; the `controller.abort()` fires in the timeout path but fetch-level cancellation is not possible at this seam.
    - **Deliberate trade-off documented at both call sites (locked per REQ-04):** a JSDoc or inline comment at each wrap explains that failover is intentionally NOT applied at this seam because adding a base-URL accessor to the public `PactClient` interface would be a breaking change. The consumer's `PactClient` implementation is responsible for its own failover. The timeout fires via `Promise.race`; the signal is constructed but not forwarded to the client because the `PactClient` interface does not declare the parameter.
    - **Callback form MUST be concise arrow (implicit return):** write `(controller) => this.client.dirtyRead(sim)` and `(controller) => this.client.submit(signed)` — NOT a block-body form `(controller) => { this.client.dirtyRead(sim); }`. A block body without an explicit `return` would resolve with `undefined`, silently losing the simulation result and the submitted transaction descriptor.
    - **Outer-boundary catch required at this seam (locked, iter-3 fix):** Per Phase 3 T3.1's design, `runWithTimeout` itself rejects with an `AbortError` (not `SigningError(TIMEOUT)` directly — this is intentional: the AbortError shape lets `withFailover`'s line-116 classifier trigger fallback retry at the `getFailoverClient` seam). At the `getFailoverClient` seam, the outer method wraps `withFailover` and converts the final AbortError to `createTimeoutError`. At the `codexStrategy.ts` seam there is NO `withFailover`, so `codexStrategy.ts`'s `execute()` method MUST add its own outer-boundary catch. Pattern: wrap each `await runWithTimeout(...)` in a `try/catch` block — if `err?.name === "AbortError"` (or `err instanceof Error && err.name === "AbortError"`), rethrow as `createTimeoutError(operationName, timeoutMs)`. This mirrors Phase 2 T2.2's outer-boundary pattern. `createTimeoutError` is imported from `"../errors"` (the errors barrel).
    - `runWithTimeout` is imported from `"../network"` (the barrel). All existing imports (`"../guard"`, `"../gas"`, `"./universalSign"`, `"./types"`, `@kadena/types`) are preserved verbatim.
    - The `PactClient` interface in `src/signing/types.ts` is NOT modified.
    - The `sign(...)` method and the resolver calls are unchanged. Only the two `await this.client.*` calls in `execute(...)` are modified.
    - `npm run typecheck` exits 0 after the change.
  - context:
    - `Z:/OuronetCore/src/signing/codexStrategy.ts` — read in full (193 lines); the two target lines are 131 and 153. The full execute pipeline (lines 47–156) provides context for the signal-forwarding decision.
    - `Z:/OuronetCore/src/signing/types.ts` — read in full; verify that `PactClient.dirtyRead` and `PactClient.submit` do NOT accept a second options argument with `signal?: AbortSignal`. This confirms the signal must NOT be forwarded.
    - `Z:/OuronetCore/src/network/failoverClient.ts` — verify `runWithTimeout(operation, fn, timeoutMs)` is exported with the controller-factory signature `fn: (controller: AbortController) => Promise<T>`.
    - `Z:/OuronetCore/src/network/index.ts` — confirm `runWithTimeout` is reachable via the barrel (after Phase 3 T3.1 has landed).
    - Spec Phase 4 section and REQ-04 in `.bee/specs/2026-05-01-reliability-failover/spec.md`.
    - **Key constraint:** use inline numeric literals `15_000` and `60_000` directly — the timeout constants are module-private in `failoverClient.ts` and not exported.
  - research:
    - Pattern: [CITED] `src/signing/codexStrategy.ts:131` — `const simResult = await this.client.dirtyRead(sim);` is the first target line. `src/signing/codexStrategy.ts:153` — `const raw = await this.client.submit(signed);` is the second target line. Both are plain `await this.client.*` calls with no current signal forwarding.
    - Types: [CITED] `src/signing/types.ts:83-86` — `PactClient` interface has `dirtyRead(tx: IUnsignedCommand): Promise<any>` and `submit(signed: ICommand | IUnsignedCommand): Promise<any>`. NEITHER method accepts a second options argument. The controller MUST be constructed by the `runWithTimeout` callback but `{ signal: controller.signal }` MUST NOT be forwarded to the client calls because the interface does not declare the parameter.
    - Reuse: [CITED] `src/network/index.ts:3` — after Phase 3 T3.1 lands, `export * from "./failoverClient";` is appended and `runWithTimeout` is reachable via `import { runWithTimeout } from "../network"`.
    - Reuse: [CITED] `src/signing/codexStrategy.ts:20-30` — existing import block. The new `runWithTimeout` import goes to `"../network"` as a fresh named-import line.
    - Approach: [ASSUMED] Wrapper callbacks take the form `(controller) => this.client.dirtyRead(sim)` and `(controller) => this.client.submit(signed)` — the `controller` parameter is received but not used to forward the signal. A JSDoc comment at each site documents this limitation per REQ-04's trade-off text.
    - Approach: [ASSUMED] Use inline numeric literals `15_000` and `60_000` directly (matching the locked defaults from Phase 3) rather than importing the constants — the constants are module-private in `failoverClient.ts` and not exported.
  - notes:

- [x] T4.2 | Create `tests/timeouts.test.ts` — the project's first vi.useFakeTimers file — covering all four operation tiers (read/submit/listen/pollOne) plus the codexStrategy TIMEOUT classification seam, with ~13 it-blocks: one timeout-past-default + one success-under-default per tier (8 scenarios) + a three-level precedence test on one tier (3 scenarios) + two codexStrategy TIMEOUT seam scenarios (2 scenarios) | bee-implementer
  - requirements: [REQ-14]
  - acceptance:
    - A new file `tests/timeouts.test.ts` is created. It is the first file in the test suite to use `vi.useFakeTimers()`.
    - **afterEach hook (mandatory, same-scope rule, prevents timer-mock leakage):** `vi.useRealTimers()` MUST be called in an `afterEach` at the SAME describe scope as the `vi.useFakeTimers()` activation. If `vi.useFakeTimers()` is called per-`it` block, place `afterEach(() => vi.useRealTimers())` at the top-level describe. If `vi.useFakeTimers()` is called in a `beforeEach` within a nested describe, place the matching `afterEach(() => vi.useRealTimers())` inside that SAME nested describe. NEVER pair a nested `beforeEach` activation with a top-level-only `afterEach` — on test failure within the nested describe, the outer hook fires after the whole nested scope, not between individual `it` blocks, leaving fake timers active mid-describe.
    - **The file exercises `getFailoverClient` methods** (read/submit/listen/pollOne) — NOT bare `runWithTimeout` directly and NOT `rawCalibratedDirtyRead` or the codex strategy. The `getFailoverClient` methods include an outer-boundary AbortError→SigningError(TIMEOUT) converter (added in Phase 3 T3.1), so asserting `{ code: "TIMEOUT" }` is valid when testing via these methods. Testing bare `runWithTimeout` would require the test itself to add the outer-boundary catch, which conflates testing the helper with testing the seam integration.
    - **Four tiers covered:** read (15000 ms default), submit (60000 ms default), listen (180000 ms default), poll-one (30000 ms default).
    - **Timeout-past-default test per tier (4 it-blocks):** for each tier, mock the underlying chain call as never-resolving. Call with fake timers, advance time past the default with `vi.advanceTimersByTimeAsync(DEFAULT_MS + 1)`, and assert the returned promise rejects with a `SigningError` carrying `code: "TIMEOUT"` — use `await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" })`. Do NOT assert `.name === "AbortError"` — that is the raw abort intermediate, not the classified error that `runWithTimeout` emits per REQ-07/REQ-10.
    - **Success-under-default test per tier (4 it-blocks):** for each tier, mock the chain call to resolve immediately. Assert the promise resolves with the mocked return value and does NOT reject.
    - **Three-level precedence test on one tier (3 it-blocks):** choose one tier (submit or read). Test: (1) no override fires at locked default; (2) factory-time override wins over locked default; (3) per-call override wins over factory-time.
    - **codexStrategy seam coverage (locked, addresses CI-001 from cross-plan review — mandatory):** add a `describe("codexStrategy TIMEOUT classification", ...)` block in this same file. The codexStrategy seam (T4.1) adds its own outer-boundary `try/catch` converting `AbortError` → `createTimeoutError(...)`, but this path is NOT tested by the `getFailoverClient`-method scenarios above — those test the factory's own converter; T4.1's converter is a separate code path in `codexStrategy.ts`. Two additional it-blocks required:
      - **dirtyRead timeout path:** create a minimal `PactClient` stub with `dirtyRead: () => new Promise(() => {})` (never resolves). Construct a `CodexSigningStrategy` with this stub (pass a minimal resolver stub that satisfies the constructor). Call `execute(...)` with a valid-shape argument. Activate fake timers, then advance past `15_001` ms via `vi.advanceTimersByTimeAsync(15_001)`. Assert the returned promise rejects with `toMatchObject({ code: "TIMEOUT" })`. If `CodexSigningStrategy` is not easily constructable in isolation, test via the `runWithTimeout` + outer-boundary catch pattern directly using the `runWithTimeout` + catch wrapping approach that T4.1 uses — invoke `runWithTimeout("test", () => new Promise(() => {}), 15_000)` inside a `try/catch` that converts AbortError to `createTimeoutError(...)`, then assert `{ code: "TIMEOUT" }`.
      - **submit timeout path:** similarly stub `PactClient.submit` to never resolve (or use the `runWithTimeout` direct approach). Advance past `60_001` ms. Assert rejects with `{ code: "TIMEOUT" }`.
    - **Total it-blocks (updated):** 4 + 4 + 3 + 2 = 13 minimum.
    - **`vi.useFakeTimers()` placement:** called either (a) inside each `it` block directly, or (b) in a `beforeEach` inside a nested describe that ALSO contains the matching `afterEach(() => vi.useRealTimers())`. NOT at the module top level.
    - No real network calls are made — all chain operations are mocked.
    - Running `npx vitest run tests/timeouts.test.ts` exits 0 with ≥11 passing tests. The full vitest summary block is captured in the task `notes:` as evidence.
  - context:
    - `Z:/OuronetCore/src/network/failoverClient.ts` — read AFTER Phase 3 T3.1 lands; understand `runWithTimeout` signature, `getFailoverClient` return shape, per-tier defaults, and per-call options bag shape.
    - `Z:/OuronetCore/tests/network.test.ts` — read as the canonical mock/vi.fn pattern reference (how to mock, how to assert, how to use beforeEach).
    - `Z:/OuronetCore/tests/interactions-read-seam.test.ts` — read as the stub + before/after reset pattern reference.
    - `Z:/OuronetCore/src/errors/transactionErrors.ts` — read AFTER Phase 2 T2.1 lands; understand `createTimeoutError` return shape if the test asserts `SigningError(code: "TIMEOUT")`.
    - Spec REQ-14 in `.bee/specs/2026-05-01-reliability-failover/spec.md` for the locked it-block contract.
    - **Key pattern (corrected from review F-001/PAT-002):** timeout rejection from `runWithTimeout` must be asserted as `expect(promise).rejects.toMatchObject({ code: "TIMEOUT" })` — this matches the `SigningError` produced by `createTimeoutError` per REQ-07/REQ-10. The `tests/network.test.ts:183-191` `AbortError` pattern is for the raw abort-signal injection into `withFailover`, NOT for the classified output of `runWithTimeout`. Asserting `.name === "AbortError"` would validate a bug (unclassified rejection leaking out of `runWithTimeout`).
    - **Key pattern:** three-level precedence test requires `getFailoverClient` (not bare `runWithTimeout`) because the factory-time override (`options.submitTimeoutMs`) is threaded through `getFailoverClient`'s closure.
  - research:
    - Pattern: [CITED] `tests/network.test.ts:8` — imports `{ describe, it, expect, beforeEach, vi }` from `"vitest"`. `afterEach` must be added to the import block for T4.2.
    - Pattern: [CITED] `tests/network.test.ts:27-29` — module-level `beforeEach(() => { setNodeConfig("node2"); })` pattern. T4.2 places `afterEach(() => { vi.useRealTimers(); })` at the SAME describe scope as the `vi.useFakeTimers()` activation (per the same-scope rule in acceptance) — NOT at module level (outside all describes). If `vi.useFakeTimers()` is called per-`it` block (option a), a top-level-describe `afterEach` is correct. If called in a nested `beforeEach` (option b), the `afterEach` must be inside the SAME nested describe.
    - Pattern: [CITED] `tests/network.test.ts:148-152` — `vi.fn().mockResolvedValue("ok")` as the canonical mock-function pattern; `expect(fn).toHaveBeenCalledTimes(1)` for call-count assertion.
    - Pattern: [CITED] `tests/interactions-read-seam.test.ts:51-52` — `import { describe, it, expect, beforeEach, afterEach } from "vitest"` and canonical before/after reset pattern for stub isolation.
    - Pattern: [CITED] `tests/network.test.ts:183-191` — `abortErr.name = "AbortError"` assertion shape.
    - Reuse: [CITED] `src/network/index.ts:3` — after Phase 3 T3.1 lands, `runWithTimeout` and `getFailoverClient` reachable via `import { runWithTimeout, getFailoverClient } from "../src/network"` (tests use `../src/network` prefix per `tests/network.test.ts:21`).
    - Approach: [ASSUMED] `vi.useFakeTimers()` in vitest 4.x is called inside `it` blocks or in `beforeEach` within a describe scope. `vi.advanceTimersByTimeAsync(ms)` advances time and flushes async microtasks — required for `Promise.race` against `setTimeout` to resolve. Prefer `vi.advanceTimersByTimeAsync(DEFAULT_MS + 1)` for precision. `vi.useRealTimers()` in `afterEach` is the correct restoration pattern.
    - Approach: [ASSUMED] The three-level precedence test uses `getFailoverClient(chainId, { submitTimeoutMs: 5000 })` for factory-time override and `.submit(tx, { submitTimeoutMs: 2000 })` for per-call override.
  - notes:

- [x] T4.3 | Create `tests/failover-submit.test.ts` — covers the primary-down scenario: first submit attempt throws a network-class failure, fallback retry succeeds, and the same signed-transaction reference is passed to both attempts | bee-implementer
  - requirements: [REQ-15]
  - acceptance:
    - A new file `tests/failover-submit.test.ts` is created.
    - **Prerequisite before writing the test:** read `src/network/failoverClient.ts` submit implementation to confirm the signed-tx argument is captured in a closure before the `withFailover` call and is never rebuilt (no `{ ...signedTx }` spread, no reconstruction) between the primary attempt and the fallback retry. If the implementation rebuilds the transaction, that is a Phase 3 bug — surface it to the conductor before writing the reference-equality assertion.
    - The file imports `getFailoverClient` from the network barrel. **Mock approach is locked to `vi.mock("@kadena/client", ...)` (hoisted factory mock).** Do NOT use `vi.spyOn` on a named static import — this project uses native ESM (`"type": "module"`) and `vi.spyOn` on a named ESM export may silently fail to intercept the call, producing a vacuous test. The `vi.mock` call must appear at the top of the file (vitest hoists it above imports automatically).
    - **Primary-down scenario (≥1 it-block):** set up a mock `submit` that rejects on the first call with a network-class error (`new Error("Failed to fetch")`), then resolves on the second call with a plausible `ITransactionDescriptor`. Call `getFailoverClient(chainId).submit(signedTx)`. Assert: (a) the returned promise resolves, and (b) the `submit` mock was called exactly twice.
    - **Reference-equality dedup assertion (locked per REQ-15 and REQ-01):** assert that the `signedTx` reference passed to the second (retry) call is `===` the same object as passed to the first call. Use `expect(submitMock.mock.calls[0][0]).toBe(submitMock.mock.calls[1][0])` or equivalent. This pins the request-key dedup contract.
    - **Minimum it-blocks:** ≥2 it-blocks total.
    - The test uses real timers (not fake timers) — this file tests failover retry, not timeout mechanics.
    - A `beforeEach` or `afterEach` hook resets the failover state using `resetNodeFailover()` from the network barrel (or `setNodeConfig("node2")` as fallback if Phase 1 has not landed) so state does not leak between tests.
    - Running `npx vitest run tests/failover-submit.test.ts` exits 0 with ≥2 passing tests. The full vitest summary block is captured in the task `notes:` as evidence.
  - context:
    - `Z:/OuronetCore/src/network/failoverClient.ts` — read AFTER Phase 3 T3.1 lands; understand the submit method's `withFailover` wiring and the transaction closure to verify the reference is captured correctly.
    - `Z:/OuronetCore/src/network/nodeFailover.ts` — read for `withFailover` semantics (primary-down → fallback retry), `resetNodeFailover` (Phase 1 T1.1), and `setNodeConfig` (the existing test reset pattern).
    - `Z:/OuronetCore/tests/interactions-read-seam.test.ts` — read as the canonical before/after stub-reset pattern.
    - `Z:/OuronetCore/tests/network.test.ts` — read lines 141–217 for how `withFailover` is tested with mock fns.
    - Spec REQ-15 and REQ-01 in `.bee/specs/2026-05-01-reliability-failover/spec.md` for the locked dedup contract.
    - **Key pattern:** `tests/network.test.ts:155-164` — canonical `withFailover` primary-down test: `vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")`, call, assert fn called twice. T4.3 follows this same pattern through `getFailoverClient(chainId).submit(signedTx)`.
  - research:
    - Pattern: [CITED] `tests/network.test.ts:155-164` — canonical `withFailover` primary-down test pattern: `vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")`, call `withFailover(fn)`, assert `fn` called twice, assert first call with NODE2 URL, second with NODE1 URL. T4.3 follows this same pattern but through `getFailoverClient(chainId).submit(signedTx)` instead of directly through `withFailover`.
    - Pattern: [CITED] `tests/network.test.ts:142-144` — `beforeEach(() => { setNodeConfig("node2"); })` is the existing state-reset pattern. T4.3 uses `resetNodeFailover()` (from Phase 1 T1.1) or falls back to `setNodeConfig("node2")`.
    - Pattern: [CITED] `tests/interactions-read-seam.test.ts:163-170` — canonical two-hook cleanup pattern; T4.3 uses `beforeEach(() => { resetNodeFailover(); })`.
    - Types: [CITED] `src/network/nodeFailover.ts:104-125` — `withFailover` classifier at lines 112-116 matches `err?.message?.includes("Failed to fetch")`. The `getFailoverClient` factory's submit method is wired through `withFailover`, so the same mock pattern applies.
    - Approach: [CITED from review FINDING-002 + iter-2 fix] Lock the stub approach to `vi.mock("@kadena/client", ...)`. `vi.spyOn` on a named ESM import will silently fail to intercept in native ESM mode (`"type": "module"` in `package.json:4`). **Critical hoisting trap:** `vi.mock` factories execute BEFORE all `import` statements and variable declarations. A `const submitMock = vi.fn()` declared at the top of the file will be in the temporal dead zone when the factory runs, so `submitMock` evaluates to `undefined` inside the factory. Use `vi.hoisted()` to share the variable between the factory and the test body:
      ```ts
      const submitMock = vi.hoisted(() => vi.fn()
        .mockRejectedValueOnce(new Error("Failed to fetch"))
        .mockResolvedValueOnce({ requestKey: "abc", chainId: "1", networkId: "mainnet01" }));
      vi.mock("@kadena/client", () => ({ createClient: vi.fn().mockReturnValue({ submit: submitMock }) }));
      ```
      `vi.hoisted()` runs its callback at hoist-time, before imports, so `submitMock` is correctly initialized when the factory executes. The `mock.calls` assertions in acceptance will then correctly capture the two call arguments.
    - Approach: [ASSUMED] `resetNodeFailover` is a Phase 1 T1.1 deliverable. If Phase 1 has not landed, fall back to `setNodeConfig("node2")` (existing pattern at `tests/network.test.ts:27`) as the state-reset mechanism.
  - notes:

- [x] T4.4 | Extend `tests/network.test.ts` with two new cases: (1) `resetNodeFailover()` returns all five state slots to initial values, and (2) the retry interval handle has `.unref()` invoked on it on Node | bee-implementer
  - requirements: [REQ-16]
  - acceptance:
    - The existing file `tests/network.test.ts` is extended in-place. No existing tests are modified or deleted.
    - **Import additions:** `resetNodeFailover` is added to the named-import block from `"../src/network"`. `vi` is already imported; no new test framework imports needed.
    - **New describe block: `resetNodeFailover()`** — add a new `describe("resetNodeFailover", () => { ... })` block at the bottom of the file (after the `withFailover` describe). Contains at minimum:
      - An it-block that verifies all five state slots return to initial values after `resetNodeFailover()` is called following state mutation. The five slots: `getNodeConfig().primary === NODE2`, `getNodeConfig().fallback === NODE1`, `getActiveGasLimit() === 2_000_000` (the locked default via `NODE_GAS_LIMITS[NODE2_HOST]`), `getActiveHost() === NODE2`, `getCurrentNodeStatus().isOnPrimary === true`.
      - Test sequence: (1) call `setNodeConfig("custom", "https://x.example.com", 500_000)` to set a custom gas limit; (2) call `resetNodeFailover()`; (3) assert all four directly-observable slots: `getNodeConfig().primary === NODE2`, `getNodeConfig().fallback === NODE1`, `getActiveHost() === NODE2`, `getCurrentNodeStatus().isOnPrimary === true`.
      - **`customGasLimit` testability note (iter-3 fix):** after `resetNodeFailover()` restores `currentHost` to `NODE2_HOST`, `getActiveGasLimit()` returns `NODE_GAS_LIMITS[NODE2_HOST] = 2_000_000` via the map lookup — regardless of `customGasLimit`'s value. There is no public API that exposes `customGasLimit` independently. The fourth assertion slot cannot be verified through the public API alone. The test asserts the four observable slots; for `customGasLimit`, the implementer must verify in the `resetNodeFailover()` source that the line `customGasLimit = DEFAULT_GAS_LIMIT` (or equivalent) is present, and add an inline comment in the test: `// customGasLimit reset verified by reading nodeFailover.ts — not independently observable via public API`. REQ-12's "all five state slots" language is met by the implementation; the test covers the four verifiable ones.
    - **New describe block: `retryTimer.unref()`** — add a new `describe("retryTimer unref on Node", () => { ... })` block. Contains at minimum:
      - An it-block that spies on `setInterval` from the global scope (using `vi.spyOn(globalThis, "setInterval")`), triggers a failover (e.g., by calling `withFailover` with a fn that rejects with a network-class error), and asserts that the interval handle returned by `setInterval` had `.unref?.()` called on it. Mock `setInterval` to return `{ unref: vi.fn() }`, then assert the spy was called once. Use `?.` guards consistent with Phase 1 T1.2's optional-call pattern.
      - After the test, call `resetNodeFailover()` or `setNodeConfig("node2")` to stop any running retry loop.
    - The existing `beforeEach(() => { setNodeConfig("node2"); })` at the top of the file continues to reset state between all tests.
    - Running `npx vitest run tests/network.test.ts` exits 0 with all previously-passing tests plus the 2 new cases. The full vitest summary block is captured in the task `notes:` as evidence.
  - context:
    - `Z:/OuronetCore/tests/network.test.ts` — read in full (218 lines); new describe blocks are appended after the existing `withFailover` describe. The existing import block and beforeEach pattern are the structural templates.
    - `Z:/OuronetCore/src/network/nodeFailover.ts` — read AFTER Phase 1 T1.1 and T1.2 have landed; verify `resetNodeFailover()` is exported and `retryTimer.unref?.()` is in `startRetryLoop()`.
    - `Z:/OuronetCore/src/network/index.ts` — confirm `resetNodeFailover` is reachable via the barrel.
    - Spec REQ-16 and REQ-12/REQ-13 in `.bee/specs/2026-05-01-reliability-failover/spec.md`.
    - Phase 1 TASKS.md T1.1 notes and T1.2 notes — confirm the exact state-slot names and optional-call form used.
    - **Key pattern:** `tests/network.test.ts:131-139` — `getCurrentNodeStatus` assertion shape: direct template for the resetNodeFailover it-block assertions.
    - **Key pattern:** `tests/network.test.ts:155-164` — `withFailover` mock pattern reused to trigger `startRetryLoop()` code path for the `unref()` test.
  - research:
    - Pattern: [CITED] `tests/network.test.ts:8` — existing imports: `{ describe, it, expect, beforeEach, vi }`. `resetNodeFailover` must be added to the `from "../src/network"` import at line 21.
    - Pattern: [CITED] `tests/network.test.ts:21` — existing network import line; append `resetNodeFailover` to this list.
    - Pattern: [CITED] `tests/network.test.ts:131-139` — `getCurrentNodeStatus` assertion shape: `expect(s.primary).toBe(NODE2); expect(s.fallback).toBe(NODE1); expect(s.active).toBe(NODE2); expect(s.isOnPrimary).toBe(true);` — direct template for the resetNodeFailover it-block assertions.
    - Pattern: [CITED] `tests/network.test.ts:142-144` — new describe blocks append AFTER the `withFailover` describe closing brace at line 217.
    - Pattern: [CITED] `tests/network.test.ts:155-164` — `withFailover` mock pattern with `.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")` — the `retryTimer.unref()` test reuses this to trigger `startRetryLoop()`.
    - Types: [CITED] `src/network/nodeFailover.ts:33` — `let retryTimer: ReturnType<typeof setInterval> | null = null;` — module-level slot reset by `resetNodeFailover()`. Not directly observable from outside; infer via `getCurrentNodeStatus()`.
    - Types: [CITED] `src/network/nodeFailover.ts:64-71` — `startRetryLoop()` calls `setInterval(...)` at line 66. Phase 1 T1.2 adds `retryTimer.unref?.()` after this line.
    - Approach: [ASSUMED] `resetNodeFailover` is a Phase 1 T1.1 deliverable (verified: not yet present in `src/network/nodeFailover.ts`). The implementer MUST verify Phase 1 has landed before adding the import.
    - Approach: [ASSUMED] For the `retryTimer.unref()` test: `vi.spyOn(globalThis, "setInterval")` intercepts the call. Mock implementation returns `{ unref: vi.fn() }`, then assert `mockHandle.unref` was called once. Since vitest runs in `environment: "node"` (per `vitest.config.ts:6`), `setInterval` returns a `NodeJS.Timeout` natively; `?.` is a safety guard.
  - notes:

## Wave 2 (depends on Wave 1 -- T4.1, T4.2, T4.3, T4.4 complete)

- [x] T4.5 | Run all three quality gates: typecheck exits 0 (REQ-18), full test suite passes with ≥361 tests (REQ-19), clean `dist/` build with `getFailoverClient` observable through the network subpath barrel (REQ-20); verify no "Open handles" warnings and the v1.7.0 type-regression lock still fires | bee-implementer
  - requirements: [REQ-17, REQ-18, REQ-19, REQ-20]
  - needs: T4.1, T4.2, T4.3, T4.4
  - acceptance:
    - `npm run typecheck` exits 0 with no TypeScript errors. The terminal output is captured verbatim in the task `notes:` block as evidence (Firm Rule R8).
    - `npm test` exits 0. The vitest summary line shows **at least 363 tests passed** (346 baseline + ≥17 new it-blocks from T4.2 + T4.3 + T4.4) and zero failed. **Programmatic count verification:** run `npm test 2>&1 | grep -E "[0-9]+ passed"` and confirm the extracted number is ≥363. The full vitest summary block is captured in the task `notes:` as evidence. If the count is below 363, surface the discrepancy (which of T4.2/T4.3/T4.4 fell short of their minimum it-block target and by how many). Note: if the actual post-Phase-3 baseline differs from 346, use the observed count as the new baseline and require ≥(baseline + 17) instead.
    - The v1.7.0 type-regression lock (`tests/types.test.ts`) is included in the run and continues to pass (REQ-17).
    - Vitest reports no "Open handles" warnings. If warnings appear despite Phase 1's `unref?.()` and Phase 3's `clearTimeout` discipline, surface them as a regression tied to the specific task that introduced the leaking handle (REQ-17).
    - `npm run build` exits 0, producing a clean `dist/` directory. The terminal output is captured verbatim in the task `notes:`.
    - **Barrel export verification (locked, REQ-20):** after the build, confirm `getFailoverClient` is observable from a downstream consumer via the network subpath. Verification method: `grep -r "getFailoverClient" dist/` — must return at least one match inside the network subpath output (e.g., `dist/network/index.js` or `dist/network/failoverClient.js`). Capture the grep output in `notes:`.
    - If any gate fails, do NOT attempt to fix the underlying issue inside this task — surface the failure clearly (which command failed, what the error message was) so the conductor can route to the correct prior task for a fix. This task is a read-only verification gate.
  - context:
    - Completed work from T4.1, T4.2, T4.3, T4.4 (all four tasks live on disk before this task starts).
    - Repository root `Z:/OuronetCore` for command execution.
    - Locked minimum test count: 363 (346 baseline + ≥17 new it-blocks: T4.2 ≥13, T4.3 ≥2, T4.4 = 2).
    - `Z:/OuronetCore/CLAUDE.md` — confirms `npm run typecheck`, `npm test`, `npm run build` command names.
    - Task notes from T4.2, T4.3, T4.4 — read the actual it-block counts reported there to understand the expected total before running the suite.
    - **Gate sequence:** run typecheck first (catches type errors before running tests), test suite second (functional validation), build third (distribution artifact).
  - research:
    - Pattern: [CITED] `package.json:78-83` — exact script names: `"typecheck": "tsc --noEmit"`, `"test": "vitest run --passWithNoTests"`, `"build": "tsc -p tsconfig.build.json"`. All three gates map to these exact npm scripts.
    - Pattern: [CITED] `vitest.config.ts:8` — `include: ["src/**/*.test.ts", "tests/**/*.test.ts"]` — confirms all three new test files (`tests/timeouts.test.ts`, `tests/failover-submit.test.ts` and the extended `tests/network.test.ts`) are auto-included by glob without any config change.
    - Reuse: [CITED] `src/network/index.ts:3` — after Phase 3 T3.1 appends `export * from "./failoverClient";`, `getFailoverClient` flows through `./network` subpath barrel to `dist/network/index.js`. The post-build grep `grep -r "getFailoverClient" dist/` will match there.
    - Pattern: [CITED] `package.json:17-20` — `"./network"` subpath export maps to `"types": "./dist/network/index.d.ts"` and `"import": "./dist/network/index.js"`. The barrel is the canonical consumer entry point.
    - Approach: [ASSUMED] The three gates run sequentially: typecheck first, test suite second, build third. If typecheck fails, surface it before running the test suite.
  - notes:

## Wave 3 (depends on Wave 2 -- T4.5 complete)

- [x] T4.6 | Bump `package.json` version to v2.1.0 and add a CHANGELOG.md entry describing all four closed findings and the non-breaking nature of the change | bee-implementer
  - requirements: [REQ-18, REQ-19, REQ-20]
  - needs: T4.5
  - acceptance:
    - In `package.json`, the `"version"` field is changed from its current value (verify on disk — expected `"2.0.4"`) to `"2.1.0"`. No other fields in `package.json` are changed.
    - In `CHANGELOG.md`, a new entry is prepended (added at the top of the file, above all existing entries). The entry:
      - Has the heading `## 2.1.0 — 2026-05-01` (match the EXISTING file format — no square brackets around version, em-dash separator, as used in `## 2.0.4 — 2026-05-01`).
      - Identifies this as a MINOR non-breaking release.
      - Summarises the four closed audit findings: F-CORE-002 (automatic failover wired into every submit and read via `getFailoverClient` factory + 81-site migration), F-CORE-003 (default reader now resolves URL from active failover host per call), F-CORE-008 (bounded timeouts on all four operation tiers with `TIMEOUT` classification), F-CORE-004 (state isolation via `resetNodeFailover()` + Node event-loop hygiene via `retryTimer.unref()`).
      - Notes the new public surface additions: `getFailoverClient`, `runWithTimeout`, `resetNodeFailover`, `createTimeoutError` — all additive exports, no breaking changes.
      - Notes the test count growth from the T4.5 notes (actual verified count).
      - Is concise (5-15 bullet lines) and matches the CHANGELOG style of existing entries.
    - **Both files must be edited before any verification runs.** Edit `package.json` first, then `CHANGELOG.md`, then run verification — do not typecheck between the two file edits (avoids a state where version is bumped but CHANGELOG has no entry).
    - **Local version parity check (mandatory):** after both files are edited, run `grep -m1 "^## " CHANGELOG.md` and confirm the version token matches the `"version"` field in `package.json`. Expected: `## 2.1.0 — 2026-05-01`. If the strings disagree (e.g., a copy-paste error left the old heading), fix the CHANGELOG before proceeding. This is the local pre-commit equivalent of the publish workflow's version-parity check.
    - The tag-vs-`package.json` version-parity check runs during the publish workflow (not in this task) — but the CHANGELOG heading must match `package.json` before this task is complete.
    - `npm run typecheck` exits 0 after both files have been edited and the parity check has passed (the version field is a string literal; no type impact expected, but verify).
    - The task `notes:` block records the final `package.json` version and the CHANGELOG heading added.
  - context:
    - `Z:/OuronetCore/package.json` — read the current `"version"` field before editing.
    - `Z:/OuronetCore/CHANGELOG.md` — read the first 50 lines to understand the existing entry format (headings, bullet style, date format) before writing the new entry.
    - `Z:/OuronetCore/CLAUDE.md` — "Publishing flow" section explains the tag-based publish contract (informational only; this task only bumps the version, not the tag).
    - Task notes from T4.5 — confirm the final test count and that all quality gates passed before writing the CHANGELOG.
    - **Key format constraint:** existing CHANGELOG headings omit square brackets (e.g., `## 2.0.4 — 2026-05-01`). Do NOT use `## [2.1.0] — 2026-05-01` — match the file's actual format.
  - research:
    - Pattern: [CITED] `package.json:2` — current `"version": "2.0.4"`. Target bump is to `"2.1.0"` (MINOR per semver — all new exports are additive; no breaking changes to existing public types or barrel exports).
    - Pattern: [CITED] `CHANGELOG.md:5-29` — existing entry format for v2.0.4: heading `## 2.0.4 — 2026-05-01` (no square brackets), bold summary line, prose paragraph, `### Fixed` subsection with bullet list, `### Stats` subsection with bullet list.
    - Pattern: [CITED] `CHANGELOG.md:31-60` — v2.0.3 entry confirms `### Fixed` / `### Stats` structure with `- Files changed:`, `- Lines added:` pattern for Stats. For v2.1.0, the Stats bullet should reflect the actual `src/` and `tests/` changes.
    - Approach: [ASSUMED] The CHANGELOG entry heading format in this repo omits square brackets around the version. Match the existing file format (no brackets) over any wording in the acceptance criteria that uses brackets.
  - notes:

## Notes

- **Test count arithmetic:** baseline after Phase 3 is 346 tests. REQ-19 requires ≥363 after Phase 4 (updated by cross-plan CI-001 fix: T4.2 adds 2 codexStrategy seam it-blocks). The three new/extended test deliverables must contribute ≥17 new it-blocks combined: T4.2 (timeouts.test.ts) ≥13, T4.3 (failover-submit.test.ts) ≥2, T4.4 (network.test.ts extension) = 2. Exactly meeting these minimums yields 346 + 17 = 363.
- **TDD note for this phase:** the production code (T4.1's `runWithTimeout` wraps in codexStrategy.ts) and the tests (T4.2, T4.3, T4.4) are in the same wave (Wave 1) because they are file-disjoint and their dependencies are all in earlier phases. T4.1 does not produce symbols that the test tasks import — the test tasks exercise `runWithTimeout` and `getFailoverClient` from Phase 3, not from T4.1. So T4.1 and the test tasks are safely parallel. The atomic-ship contract (spec ships as one v2.1.0 release after Phase 4 completes) satisfies the TDD invariant: red→green is verified at T4.5 when the full suite runs for the first time against all Phase 4 deliverables together.
- **Signal forwarding in T4.1:** `PactClient.dirtyRead` and `PactClient.submit` do NOT accept a `signal` option (verified via `src/signing/types.ts:83-86`). The `runWithTimeout` callback still constructs a controller for the race discipline, but does NOT forward `{ signal: controller.signal }` to the client call. The timeout enforcement fires via the `Promise.race` half; only the in-flight fetch cancellation benefit is lost. This is explicitly documented at the call site per REQ-04's trade-off text.
- **Timer mock isolation:** T4.2 is the only file using `vi.useFakeTimers()`. The mandatory `afterEach(() => vi.useRealTimers())` hook ensures fake-timer mode never leaks into T4.3, T4.4, or any other test file. This design is locked per REQ-14's "real-timers-restored after-each hook" requirement.
- **Atomic-ship contract (inherited, locked):** Phase 4 is the final phase; upon T4.6 completion the codebase is tagged v2.1.0 and published. The version-parity check (tag = package.json version) runs automatically in the publish workflow. No further spec phases follow.
- **1-task waves justified:** Wave 2 (T4.5) and Wave 3 (T4.6) are single-task waves with genuine sequential dependencies. T4.5 must verify the integrated output of all four Wave 1 tasks — it cannot merge into Wave 1 because it depends on those tasks completing first. T4.6 must read T4.5's verified test count before writing the CHANGELOG — it cannot merge into Wave 2 because T4.5 is its gating dependency. Neither wave can be merged without violating the dependency ordering.
- **File-ownership map:**

| Task | Wave | Touches |
|------|------|---------|
| T4.1 | 1 | `src/signing/codexStrategy.ts` |
| T4.2 | 1 | `tests/timeouts.test.ts` (NEW) |
| T4.3 | 1 | `tests/failover-submit.test.ts` (NEW) |
| T4.4 | 1 | `tests/network.test.ts` |
| T4.5 | 2 | none (read-only verification + build) |
| T4.6 | 3 | `package.json`, `CHANGELOG.md` |

## Fragmentation Note

Wave 2 (T4.5 alone) and Wave 3 (T4.6 alone) are 1-task waves that cannot be merged. T4.5 has a genuine sequential dependency on all four Wave 1 tasks (it verifies their integrated output — running it in parallel would race against incomplete deliverables). T4.6 has a genuine sequential dependency on T4.5 (the CHANGELOG entry cites T4.5's verified test count). Consolidation into Wave 1 or Wave 2 respectively would violate both dependency contracts.
