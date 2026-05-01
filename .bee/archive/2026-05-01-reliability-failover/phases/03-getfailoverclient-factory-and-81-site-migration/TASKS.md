# Phase 3: getFailoverClient factory and 81-site migration -- Tasks

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

Add the new `src/network/failoverClient.ts` module exporting `getFailoverClient(chainId, options?)` (returning `{ dirtyRead, submit, listen, pollOne }` with `withFailover` + per-tier default timeout baked in) and `runWithTimeout(operation, fn, timeoutMs)` (a controller-factory-aware helper for use by Phase 4's codex-strategy wraps and by Phase 3's own refactor of Phase 2's inline read-side wrap). Then migrate every chain-call site in the 11 interaction files from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)` — **43–44 `createClient` invocations across 11 files** (the range reflects T3.10's reconciliation rule: spec said 13 active sites in `ouroFunctions.ts` but researcher grep found 12 active + 1 commented-out; total is 43 if ouro=12, 44 if ouro=13. Implementer's task is "migrate every ACTIVE invocation, none missed" — both branches of the range are valid). Each replacement is one-for-one (each retains its existing destructure).

Largest phase by edit count but mechanically the simplest: each interaction-file site is a one-line replacement. The 16 already-`pactRead`-routed read sites are NOT touched (they inherit failover via Phase 2's wrap inside `rawCalibratedDirtyRead`). The 2 codex-strategy sites are NOT touched in this phase — Phase 4 wraps them with `runWithTimeout` (timeout-only, no failover, per REQ-04 trade-off).

This phase also REFACTORS Phase 2's inline `Promise.race` + `AbortController` block inside `src/reads/rawCalibratedRead.ts` to consume the new `runWithTimeout` helper. This eliminates the temporary code duplication acknowledged-and-locked at Phase 2 ship and aligns with the spec's "future fixes touch one place" goal.

NO new tests in Phase 3. Test coverage for the factory's per-tier timeouts, the override precedence chain, and the request-key dedup contract lands in Phase 4 (REQ-14, REQ-15). Atomic-ship contract carries forward — the whole spec ships as v2.1.0 after Phase 4 completes.

## Wave Plan

| Wave | Tasks | Rationale |
|------|-------|-----------|
| 1 | T3.1 | Foundational module + barrel re-export. All Wave-2 tasks import from it. |
| 2 | T3.2, T3.3, T3.4, T3.5, T3.6, T3.7, T3.8, T3.9, T3.10, T3.11, T3.12, T3.13 | Refactor inline wrap (T3.2) + 11 parallel file migrations (T3.3–T3.13). All file-disjoint; all import the now-exported helpers. |
| 3 | T3.14 | Verification gate; depends on all 13 prior tasks. |

File-ownership map:

| Task | Touches |
|------|---------|
| T3.1 | `src/network/failoverClient.ts` (NEW), `src/network/index.ts` (one-line barrel re-export append) |
| T3.2 | `src/reads/rawCalibratedRead.ts` |
| T3.3 | `src/interactions/activateFunctions.ts` |
| T3.4 | `src/interactions/addLiquidityFunctions.ts` |
| T3.5 | `src/interactions/coilFunctions.ts` |
| T3.6 | `src/interactions/crossChainFunctions.ts` |
| T3.7 | `src/interactions/dexFunctions.ts` |
| T3.8 | `src/interactions/guardFunctions.ts` |
| T3.9 | `src/interactions/kpayFunctions.ts` |
| T3.10 | `src/interactions/ouroFunctions.ts` |
| T3.11 | `src/interactions/pensionFunctions.ts` |
| T3.12 | `src/interactions/urStoaFunctions.ts` |
| T3.13 | `src/interactions/wrapFunctions.ts` |
| T3.14 | none (read-only verification) |

Conflicts detected and resolved: 0 within Wave 2 (every task touches a disjoint file).

## Wave 1 (no dependencies — foundational)

- [x] T3.1 | Create `src/network/failoverClient.ts` exporting `runWithTimeout` (controller-factory signature) and `getFailoverClient(chainId, options?)` returning `{ dirtyRead, submit, listen, pollOne }` with `withFailover` + per-tier default timeout baked in; add the one-line barrel re-export to `src/network/index.ts` | bee-implementer
  - requirements: [REQ-01, REQ-02, REQ-09, REQ-10]
  - acceptance:
    - A new file `src/network/failoverClient.ts` is created and exports two named symbols: `runWithTimeout` and `getFailoverClient`.
    - **`runWithTimeout` signature (controller-factory pattern, locked per Phase 2 F-301 finding):** `export async function runWithTimeout<T>(operation: string, fn: (controller: AbortController) => Promise<T>, timeoutMs: number): Promise<T>`. The helper:
      - **Input validation (locked, addresses F-004):** at the top of the function body, validate `Number.isFinite(timeoutMs) && timeoutMs > 0`. If the check fails (caller passed `0`, a negative number, `NaN`, `Infinity`, `-Infinity`, or a non-numeric type that coerced through `?? DEFAULT`), throw a synchronous `Error` with message `"runWithTimeout(${operation}): timeoutMs must be a finite positive number, received ${String(timeoutMs)}"`. Rationale: `??` only short-circuits on `undefined`/`null`, so a caller passing `submitTimeoutMs: 0` (intending "no timeout") would otherwise hit `setTimeout(..., 0)` and reject immediately — defeating the entire timeout layer silently. Throwing a clear synchronous error surfaces the misconfiguration at call time. The non-`?` coercion of `0` is the only realistic foot-gun; the other invalid values (`NaN`, etc.) are defense-in-depth.
      - Constructs a fresh `AbortController` per invocation (the controller-factory hand-off — caller's `fn` receives it as its sole argument).
      - Invokes `fn(controller)` and races it against a `setTimeout`-scheduled rejection of `timeoutMs` milliseconds.
      - The timeout-rejection path: calls `controller.abort()` then rejects with an `Error` whose `.name === "AbortError"` (NOT a `SigningError(TIMEOUT)` directly — defers TIMEOUT classification to the OUTER boundary, mirroring Phase 2 T2.2's pattern, so `withFailover`'s line-116 abort-error classifier still triggers fallback retry on a primary-side timeout).
      - On the success path AND on any rejection path, clears the `setTimeout` handle via `try { ... } finally { clearTimeout(timer); }` so a successful or non-timeout-failed call leaves no pending timer (matches Phase 2 T2.2's stricter `finally` cleanup discipline).
      - **Critical rationale (locked):** the controller-factory shape (`fn: (controller) => Promise<T>`) — NOT a simple `fn: () => Promise<T>` — is what makes per-attempt AbortController scoping correct under `withFailover`. A simple-shape helper would close over a single controller across primary AND fallback retries; once the primary timeout fires `controller.abort()`, the fallback's call to the same `dirtyRead(transaction, { signal })` would synchronously reject because the signal is already aborted. With the factory shape, the caller can construct a new controller per `withFailover` callback invocation by writing `withFailover(async (baseUrl) => runWithTimeout(operation, (controller) => dirtyRead(transaction, { signal: controller.signal }), timeoutMs))` — a fresh `runWithTimeout` call (fresh controller) per failover attempt.
      - JSDoc explicitly documents this controller-factory rationale and notes that callers MUST construct the per-attempt scope themselves. Include a short usage example showing the `withFailover` integration.
      - JSDoc also documents that `runWithTimeout` does NOT retry on its own; it only times out and rejects. Failover-on-timeout is a caller responsibility (achieved by composing with `withFailover`).
    - **`getFailoverClient` signature (locked):** `export function getFailoverClient(chainId: string, options?: FailoverClientOptions): { dirtyRead: (...) => Promise<...>; submit: (...) => Promise<...>; listen: (...) => Promise<...>; pollOne: (...) => Promise<...>; }`. The exact return type aligns with `@kadena/client`'s `IClient` shape for these four methods (see research notes for the type signatures verified from `node_modules/@kadena/client/dist/client.d.ts`). Each returned method preserves its `@kadena/client` return type so call-site destructures continue to type-check.
    - **`FailoverClientOptions` type (locked):** `export type FailoverClientOptions = { readTimeoutMs?: number; submitTimeoutMs?: number; listenTimeoutMs?: number; pollTimeoutMs?: number; }`. All four fields optional. Defaults: `readTimeoutMs: 15000`, `submitTimeoutMs: 60000`, **`listenTimeoutMs: 180000`** (per REQ-09 update; ~6 Kadena blocks at ~30 s block time — matches long-polling listen semantics), `pollTimeoutMs: 30000` (per REQ-09).
    - **Per-call options bag and per-tier signatures (locked, REQ-09 two-tier override + verified `@kadena/client` types):**
      - `dirtyRead(transaction: IUnsignedCommand, callOpts?: { readTimeoutMs?: number })` returns `Promise<ICommandResult>`.
      - `submit(transaction: ICommand, callOpts?: { submitTimeoutMs?: number })` returns `Promise<ITransactionDescriptor>` (single-transaction overload — verified all interaction-file destructures use this form).
      - `listen(descriptor: ITransactionDescriptor, callOpts?: { listenTimeoutMs?: number })` returns `Promise<ICommandResult>`. **CORRECTED: `listen` takes `ITransactionDescriptor` (an object `{ requestKey, networkId, chainId }`), NOT a bare `string`** — verified from `node_modules/@kadena/client/dist/client.d.ts:327`.
      - `pollOne(descriptor: ITransactionDescriptor, callOpts?: { pollTimeoutMs?: number })` returns `Promise<ICommandResult>`. **CORRECTED: `pollOne` takes `ITransactionDescriptor`, NOT a bare `string`** — verified from `node_modules/@kadena/client/dist/client.d.ts:545`. (Note: `pollOne`'s upstream second arg is `IPollOptions`, NOT `ClientRequestInit`. For Phase 3 simplicity, the factory's `pollOne` wrapper accepts only the timeout override; if upstream `IPollOptions` fields like `interval`/`onPoll`/`confirmationDepth` are needed in the future, extend the wrapper signature in a follow-up phase. Phase 3's wrapper does NOT forward additional `IPollOptions` — timeout-only.)
      - **Precedence (locked per REQ-09):** `callOpts.{tier}TimeoutMs ?? options.{tier}TimeoutMs ?? DEFAULT_{TIER}_TIMEOUT_MS`. Per-call wins over factory-time wins over locked default.
    - **Failover wiring per method (locked):** every returned method composes `withFailover` + `runWithTimeout` with the per-attempt-controller pattern. Reference shape for `submit`:
      ```
      submit: (transaction, callOpts) => {
        const timeoutMs = callOpts?.submitTimeoutMs ?? options?.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
        return outerBoundaryConvert("submit", timeoutMs, () =>
          withFailover(async (baseUrl) => {
            const url = `${baseUrl}/chain/${chainId}/pact`;
            const { submit } = createClient(url);
            return runWithTimeout("submit", (controller) =>
              submit(transaction, { signal: controller.signal }),
              timeoutMs
            );
          })
        );
      }
      ```
      The same shape applies to `dirtyRead`, `listen`, `pollOne` (with their own per-tier timeout and per-tier default constant). Identifier names may vary; the structural shape (per-attempt `createClient`, per-attempt `runWithTimeout`, per-attempt fresh controller via the factory parameter, outer-boundary TIMEOUT conversion when both sides time out) is what matters.
    - **Outer-boundary TIMEOUT conversion (locked):** the `withFailover(...)` call inside each method is wrapped in a try/catch (or an `outerBoundaryConvert` helper local to the file). If `withFailover` rejects with an `Error` whose `.name === "AbortError"` (i.e., BOTH primary AND fallback exhausted their respective timeouts), the catch throws `createTimeoutError(operation, timeoutMs, abortErr)` — converting the abort-shaped rejection into a consumer-facing `SigningError(code: "TIMEOUT")`. Other errors propagate unchanged. This wiring makes REQ-10's "beneficial side-effect" claim actually fire: a primary-side timeout rejects with `name="AbortError"`, `withFailover`'s line-116 classifier matches and triggers the fallback retry; only if the fallback ALSO times out does the consumer see TIMEOUT.
    - **`submit` request-key dedup contract (locked per REQ-01):** the `submit` method's wrapper closure MUST capture the SAME `transaction` reference passed in by the caller — never rebuild, never clone, never re-create. The closure's `transaction` parameter is closed over by the inner `runWithTimeout` callback, which means BOTH the primary attempt AND the fallback retry receive identically-the-same `ICommand` object — preserving the request-key dedup contract on the chainweb side. JSDoc on `submit` (and on the `getFailoverClient` factory itself) explicitly documents this contract and warns implementers against any future refactor that interposes a `JSON.parse(JSON.stringify(transaction))` or similar object-cloning step.
    - **Caller-side immutability warning (locked, addresses F-005):** JSDoc on `submit` MUST also include the warning: "Caller MUST NOT mutate the `transaction` `ICommand` reference between calling `submit(transaction)` and the returned promise settling. Mutations during in-flight submit (e.g., reassigning `transaction.sigs`, mutating `transaction.cmd`, splicing `transaction.hash`) may break request-key dedup on the fallback retry — the primary attempt sends one payload, the fallback sees the mutated payload, and the chainweb mempool treats them as distinct request-keys, defeating the dedup contract this method is built around." This warning protects the dedup contract from caller-side races.
    - **`submit` overload narrowing (locked, addresses F-003):** JSDoc on `submit` MUST explicitly document the deliberate narrowing: "This factory's `submit` exposes only the SINGLE-transaction overload of `@kadena/client.ISubmit` — it accepts an `ICommand` and returns `Promise<ITransactionDescriptor>`. The batch overload (`ICommand[]` → `Promise<ITransactionDescriptor[]>`) is intentionally NOT exposed because failover-on-array-submit has unclear request-key dedup semantics across the array elements. Consumers needing the batch form should call `createClient(getActivePactUrl(chainId)).submit([...])` directly and accept that failover does NOT apply." All 38 `await submit(...)` sites in `src/interactions/*` use the single-tx form (verified by grep), so the narrowing has zero migration impact.
    - **Per-tier default constants (locked, per REQ-09):** the file declares four module-private `const DEFAULT_READ_TIMEOUT_MS = 15_000;`, `const DEFAULT_SUBMIT_TIMEOUT_MS = 60_000;`, **`const DEFAULT_LISTEN_TIMEOUT_MS = 180_000;`** (~6 Kadena blocks; locked per REQ-09 listen-default rationale to prevent false-TIMEOUT on long-polling listen during normal block-time variance — addresses Phase 3 plan-review F-001), `const DEFAULT_POLL_TIMEOUT_MS = 30_000;`. These are NOT exported; they are the default values used when neither factory-time nor per-call options override.
    - **Imports inside the new file:** `import { createClient } from "@kadena/client";` (Pact-builder is NOT used inside the factory — only by interaction files that construct transactions before passing to `submit`/`dirtyRead`); `import { withFailover } from "./nodeFailover";` (sibling file in same directory; use relative import `./nodeFailover`, NOT the barrel — avoid circular import via `./index.ts`); `import { createTimeoutError } from "../errors";` (barrel; consistent with Phase 2 T2.2's import discipline). Type-only imports for `IUnsignedCommand`, `ICommand`, `ICommandResult`, `ITransactionDescriptor`, etc. as required by the per-method signatures (use `import type { ... } from "@kadena/client";` to avoid runtime cost).
    - **Barrel re-export (locked, REQ-02):** in `src/network/index.ts`, append a new line `export * from "./failoverClient";` AFTER the existing `export * from "./nodeFailover";` line. Append-after preserves the existing line untouched.
    - The new file is reachable from a downstream consumer via `import { getFailoverClient, runWithTimeout } from "@stoachain/ouronet-core/network"`. Verify the auto-flow works through the barrel.
    - The existing `src/network/nodeFailover.ts` is NOT modified by this task. The `withFailover`, `getActiveBaseUrl`, `setNodeConfig`, `resetNodeFailover` (added in Phase 1), `getActivePactUrl`, etc. exports are all preserved verbatim.
    - The existing `src/errors/transactionErrors.ts` (and its `createTimeoutError` from Phase 2 T2.1) is NOT modified. T3.1 only consumes the existing factory.
    - `npm run typecheck` exits 0 after the change.
    - This task does NOT migrate any interaction file (T3.3–T3.13 own those) and does NOT touch the read-side wrap (T3.2 owns that).
  - context:
    - `D:\_Claude\OuronetCore\src\network\nodeFailover.ts` — read in full (post-Phase-1 state with `resetNodeFailover` appended). The new `failoverClient.ts` consumes `withFailover` from this file.
    - `D:\_Claude\OuronetCore\src\network\index.ts` — read in full (3 lines pre-edit). T3.1 appends one new export line.
    - `D:\_Claude\OuronetCore\src\errors\transactionErrors.ts` — read AFTER Phase 2 T2.1 lands; verify `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)` is exported with the locked signature.
    - `D:\_Claude\OuronetCore\src\errors\index.ts` — barrel; confirms `createTimeoutError` reachable via `import { createTimeoutError } from "../errors"`.
    - `D:\_Claude\OuronetCore\src\reads\rawCalibratedRead.ts` — read AFTER Phase 2 T2.2 lands. The inline `Promise.race` + `AbortController` + outer-boundary TIMEOUT conversion block in T2.2 is the prototype that informs `runWithTimeout`'s contract; `runWithTimeout` should be functionally identical except for the controller-factory parameter shape.
    - `D:\_Claude\OuronetCore\node_modules\@kadena\client\dist\client.d.ts` — read for the four method signatures: `dirtyRead` line 510, `submit`/`submitOne` lines 300/528, `listen` line 327, `pollOne` line 545. Verify the exact parameter and return types so `getFailoverClient`'s return-type literal matches. **CRITICAL: `listen` and `pollOne` take `ITransactionDescriptor`, NOT bare strings.**
    - `D:\_Claude\OuronetCore\.bee\specs\2026-05-01-reliability-failover\requirements.md` — REQ-01, REQ-02, REQ-09, REQ-10 sections.
    - `D:\_Claude\OuronetCore\.bee\specs\2026-05-01-reliability-failover\spec.md` — Phase 3 section, plus the locked-decisions block in the parent command.
  - research:
    - Pattern: [CITED] `withFailover<T>(fn: (baseUrl: string) => Promise<T>): Promise<T>` at `src/network/nodeFailover.ts:104-125`. Verified by reading file: the callback receives the chainweb API root from `getActiveBaseUrl()` (line 108), shape `https://{host}/chainweb/0.0/stoa` (composed at `nodeFailover.ts:81-83`). Failover classifier at `nodeFailover.ts:112-116` matches `err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError") || err?.message?.includes("ECONNREFUSED") || err?.name === "AbortError"`. Retry-once-on-fallback gate at `nodeFailover.ts:118-122` (only fires when `currentHost === PRIMARY_HOST`).
    - Pattern: [CITED] Pact-URL composition pattern verified at `src/network/nodeFailover.ts:91-93` — `getActivePactUrl(chainId)` returns `${getActiveBaseUrl()}/chain/${chainId}/pact`. Inside the `withFailover` callback the implementer composes the same shape manually as `${baseUrl}/chain/${chainId}/pact` because the callback already has `baseUrl` in hand and a separate `getActivePactUrl` call would re-read the active host (potentially wrong host if a switch occurred between calls). DO NOT call `getActivePactUrl(chainId)` inside the `withFailover` callback — use the `baseUrl` parameter.
    - Pattern: [CITED] Phase 2 T2.2's inline block in `src/reads/rawCalibratedRead.ts` (post-Phase-2 state) is the structural prototype. T3.1's `runWithTimeout` generalises that pattern with the controller-factory parameter shape.
    - Reuse: [CITED] `src/network/index.ts` is currently 3 lines verified by Read: line 1 `// @stoachain/ouronet-core/network`, line 2 blank, line 3 `export * from "./nodeFailover";`. Append `export * from "./failoverClient";` as line 4 — single-line additive change, no risk of symbol collision. Existing exports from `nodeFailover.ts`: `getActiveBaseUrl`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl`, `withFailover`, `setNodeConfig`, `getActiveGasLimit`, `getNodeGasLimit`, `CHAINWEB_DEFAULT_GAS_LIMIT`, `getNodeConfig`, `getCurrentNodeStatus`, `initNodeFailover` — none collide with `runWithTimeout`/`getFailoverClient`/`FailoverClientOptions`.
    - Types: [VERIFIED] `@kadena/client` v1.18.3 method signatures extracted from `node_modules/@kadena/client/dist/client.d.ts` by direct read:
      - `dirtyRead: (transaction: IUnsignedCommand, options?: ClientRequestInit) => Promise<ICommandResult>` at line 510
      - `submitOne: (transaction: ICommand, options?: ClientRequestInit) => Promise<ITransactionDescriptor>` at line 528 (single-tx form; all interaction-file destructures use the single-tx form via `{ submit }`).
      - `listen: (transactionDescriptor: ITransactionDescriptor, options?: ClientRequestInit) => Promise<ICommandResult>` at line 327
      - `pollOne: (transactionDescriptor: ITransactionDescriptor, options?: IPollOptions) => Promise<ICommandResult>` at line 545. Note: `pollOne`'s second param is `IPollOptions` (not `ClientRequestInit`).
    - Types: [VERIFIED CRITICAL] `listen` and `pollOne` take `ITransactionDescriptor` (object `{ requestKey, networkId, chainId }`), NOT bare strings. Acceptance corrected accordingly.
    - Reuse: [CITED] `createTimeoutError` from Phase 2 T2.1, signature `(operation: string, timeoutMs: number, originalError?: unknown, additionalContext?: string) => SigningError` (returns existing `SigningError` class with `code: "TIMEOUT"`).
    - Reuse: [CITED] `src/errors/index.ts` (7 lines, verified) is `export * from "./transactionErrors";` — `createTimeoutError` reachable via `import { createTimeoutError } from "../errors"` once T2.1 adds it.
    - Approach: [ASSUMED] The outer-boundary TIMEOUT conversion can be expressed as a tiny module-private helper `async function outerBoundaryConvert<T>(operation: string, timeoutMs: number, fn: () => Promise<T>): Promise<T>` to avoid repeating the `try/catch (err) { if (err?.name === "AbortError") throw createTimeoutError(operation, timeoutMs, err); throw err; }` block across all four methods. Internal to `failoverClient.ts`, NOT exported. Optional but recommended for readability.
    - Approach: [VERIFIED] `Pact` import from `@kadena/client` is NOT needed in `failoverClient.ts` — only `createClient`. Pact-builder is consumed in interaction files (the call sites that construct transactions before passing to `submit`). The factory only forwards the already-built transaction.
    - Approach: [ASSUMED] Use a direct relative import `./nodeFailover` (NOT the barrel `./index`) to avoid circular import — `./index.ts` re-exports both `failoverClient.ts` and `nodeFailover.ts`, so importing from the barrel inside one of them creates a cycle.
    - Context7: [ASSUMED] Context7 query not initiated (stdlib + project-internal types only). Implementer should verify `@kadena/client` v1.18.3 method signatures via direct read of `node_modules/@kadena/client/dist/client.d.ts` (already done above). AbortController + Promise.race + setTimeout are stdlib — no external API surface lookup needed.
  - notes:

## Wave 2 (parallel — depend on Wave 1)

- [x] T3.2 | Refactor Phase 2's inline `Promise.race` + `AbortController` block in `src/reads/rawCalibratedRead.ts` to consume the new `runWithTimeout` helper, eliminating the temporary code duplication | bee-implementer | needs: T3.1
  - requirements: [REQ-01, REQ-10]
  - acceptance:
    - In `src/reads/rawCalibratedRead.ts` (post-Phase-2 state), the two inline `Promise.race` + `AbortController` blocks (one inside the `withFailover` callback for the failover branch, one inside the explicit-`pactUrl` bypass branch) are EACH replaced with a call to `runWithTimeout` from `../network`.
    - **Failover-branch refactor (locked):** the inside-`withFailover` block becomes:
      ```
      withFailover(async (baseUrl) => {
        const url = `${baseUrl}/chain/${chainId}/pact`;
        const { dirtyRead } = createClient(url);
        return runWithTimeout("rawCalibratedDirtyRead", (controller) =>
          dirtyRead(transaction, { signal: controller.signal }),
          readTimeoutMs
        );
      })
      ```
      Identifiers may vary; the structural shape (the per-attempt `createClient`, the per-attempt `runWithTimeout` call, the controller-factory hand-off) is what matters. The `controller` is constructed FRESH per `withFailover` invocation by `runWithTimeout` itself — the per-attempt-AbortController invariant from Phase 2 F-301 is preserved by the controller-factory parameter shape.
    - **Explicit-`pactUrl`-bypass-branch refactor (locked):** the bypass branch becomes:
      ```
      const { dirtyRead } = createClient(options.pactUrl);
      return runWithTimeout("rawCalibratedDirtyRead", (controller) =>
        dirtyRead(transaction, { signal: controller.signal }),
        readTimeoutMs
      );
      ```
      Functionally identical to the failover-branch version except for: (a) no `withFailover` wrap (the consumer-supplied URL must be honored verbatim, no host-switching), and (b) **outer-boundary TIMEOUT conversion is MANDATORY in this branch (LOCKED — cross-plan CI-001 fix; re-asserts the Phase 2 T2.2 LOCKED requirement "Both branches enforce the timeout — addresses F-002"):** wrap the `runWithTimeout(...)` call in the SAME outer-boundary `try/catch` shape used in the failover branch. If `runWithTimeout` rejects with `err?.name === "AbortError"`, throw `createTimeoutError("rawCalibratedDirtyRead", readTimeoutMs, err)`. Other errors propagate unchanged. Do NOT conditionally read T2.2's notes to determine whether to apply this — the Phase 2 acceptance already mandates BOTH branches receive the outer-boundary conversion, and T3.2 MUST re-assert this invariant explicitly rather than delegating to implementation notes.
    - **Verification step (mandatory):** after the refactor, the implementer reads the post-edit file in full and confirms: (a) NO `new AbortController()` lines remain in `rawCalibratedRead.ts`; (b) NO `Promise.race(...)` lines remain; (c) NO `setTimeout` lines remain; (d) NO `clearTimeout` lines remain; (e) the `runWithTimeout` import is added to the existing `from "../network"` import block (alongside `withFailover` and `getActivePactUrl`); (f) the file compiles cleanly. The refactor is SUCCESSFUL when the inline timeout machinery is fully replaced by two `runWithTimeout` calls (one per branch).
    - The behavioural contract is unchanged: success path returns the same `dirtyRead` response; primary-side network failure or timeout triggers fallback retry via `withFailover`; both-sides timeout surfaces as `SigningError(code: "TIMEOUT")` via the outer-boundary catch (preserved from Phase 2 T2.2 — the catch wraps the `withFailover(...)` call, NOT the per-attempt `runWithTimeout` call).
    - The `READ_SIM_GAS_LIMIT`, the `Pact.builder...createTransaction()` block, the `pactUrl`/`chainId`/`readTimeoutMs` resolution from Phase 1+2 are all preserved verbatim. The function's external signature (and the Phase 2 T2.2-added `readTimeoutMs?: number` field) is unchanged.
    - The `createTimeoutError` import (added by Phase 2 T2.2) is preserved — the outer-boundary catch still calls it directly.
    - The 16 already-`pactRead`-routed read sites in `src/interactions/*` continue to inherit failover + timeout via this single-place wrap; no per-call-site changes.
    - `npm run typecheck` exits 0 after the change.
    - File-disjoint from all other Wave 2 tasks (T3.3–T3.13 touch interaction files; T3.2 touches only `src/reads/rawCalibratedRead.ts`).
  - context:
    - `D:\_Claude\OuronetCore\src\reads\rawCalibratedRead.ts` — read in full AFTER Phase 2 T2.2 has landed (the file's `withFailover` + inline `Promise.race` + `AbortController` block is the pre-T3.2 state; T3.2 replaces the inline machinery with `runWithTimeout` calls).
    - `D:\_Claude\OuronetCore\src\network\failoverClient.ts` — read AFTER T3.1 lands; verify `runWithTimeout(operation, fn, timeoutMs)` is exported with the controller-factory signature (`fn: (controller: AbortController) => Promise<T>`).
    - `D:\_Claude\OuronetCore\src\network\index.ts` — read AFTER T3.1 lands; confirm `runWithTimeout` reachable via the barrel.
    - **T3.1 task notes** (read from this file's `notes:` block after Wave 1 completes) — confirm the exact signature of `runWithTimeout` matches the locked spec before importing.
    - `D:\_Claude\OuronetCore\.bee\specs\2026-05-01-reliability-failover\requirements.md` — REQ-01, REQ-10 sections.
    - `D:\_Claude\OuronetCore\.bee\specs\2026-05-01-reliability-failover\phases\02-timeout-error-code-and-read-side-failover-wrap\TASKS.md` — read T2.2's notes block to understand exactly what inline shape is in `rawCalibratedRead.ts` post-Phase-2 (which branches got the outer-boundary conversion, etc.).
  - research:
    - Pre-state: [CITED] Pre-Phase-2 `src/reads/rawCalibratedRead.ts` is 62 lines. Phase 2 T2.2 adds withFailover + AbortController + Promise.race + outer-boundary conversion. T3.2 then collapses the inline timeout machinery into `runWithTimeout` calls.
    - Pattern: [LOCKED] T2.2's inline implementation pattern (per Phase 2 TASKS.md): `new AbortController()` + `Promise.race([dirtyRead(transaction, { signal }), new Promise((_, reject) => { setTimeout(() => { controller.abort(); const err = new Error("Timeout"); err.name = "AbortError"; reject(err); }, readTimeoutMs); })])` + `try/finally clearTimeout`. T3.2 collapses each block to a single `runWithTimeout("rawCalibratedDirtyRead", (controller) => dirtyRead(transaction, { signal: controller.signal }), readTimeoutMs)` call.
    - Pattern: [LOCKED] The OUTER-boundary `try { ... } catch (err) { if (err?.name === "AbortError") throw createTimeoutError("rawCalibratedDirtyRead", readTimeoutMs, err); throw err; }` block from T2.2 is preserved unchanged. It wraps the OUTER `withFailover(...)` call (the one that the inside-callback `runWithTimeout` is now nested inside), NOT the inner `runWithTimeout` itself. This preserves the "both-sides-timeout → SigningError(TIMEOUT)" semantic.
    - Reuse: [LOCKED] `runWithTimeout` from T3.1 — verify its signature matches the locked spec (`fn: (controller: AbortController) => Promise<T>`). If T3.1's notes indicate a deviation from the locked signature, halt and surface a planning bug.
    - Reuse: [CITED] Pre-edit imports (post-Phase-2): `withFailover` from `../network` (added in T2.2), `createTimeoutError` from `../errors` (added in T2.1+T2.2). Only addition T3.2 makes: `runWithTimeout` to the `../network` named-imports block alongside `withFailover`. The current pre-Phase-2 import `import { Pact, createClient } from "@kadena/client";` is preserved — `createClient` is still called inside both branches (factory does not encapsulate it; `runWithTimeout` only wraps the `dirtyRead` invocation).
    - Approach: [ASSUMED] Implementer should diff their post-edit file against the pre-edit file: removed lines should be ONLY the inline timeout machinery (no `new AbortController()`, no `Promise.race`, no `setTimeout`, no `clearTimeout`, no manual error name assignment); added lines should be ONLY two `runWithTimeout` calls + the import addition. If any other change appears in the diff, the refactor introduced unintended drift — halt and re-evaluate.
    - Context7: [ASSUMED] Not applicable — pure refactor consuming a sibling helper from T3.1.
  - notes:

- [x] T3.3 | Migrate the 1 chain-call site in `src/interactions/activateFunctions.ts` (1 destructure of `{ dirtyRead, submit }` at line 173) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/activateFunctions.ts`, the 1 `createClient(getPactUrl(KADENA_CHAIN_ID))` invocation at line 173 is replaced with `getFailoverClient(KADENA_CHAIN_ID)` (preserving the `{ dirtyRead, submit }` destructure verbatim).
    - **Expected site count:** 1 `createClient` invocation (1 destructure with 2 operations: dirtyRead-as-sim + submit). Verify with `grep -n createClient src/interactions/activateFunctions.ts` post-edit — should yield 0 matches.
    - **Import surgery (locked):** `createClient` is removed from `import { Pact, createClient } from "@kadena/client";` (becomes `import { Pact } from "@kadena/client";`). `getPactUrl` is removed from the `../constants` named-imports block IF AND ONLY IF no other code in this file still references it (verify with fresh grep on the post-edit file). A new import `import { getFailoverClient } from "../network";` is added.
    - **`Pact` import preservation (critical):** the `Pact` symbol from `@kadena/client` is USED at line 143 (`Pact.builder...`). DO NOT remove `Pact` from the import — only `createClient` is being removed.
    - **Per-call timeout overrides:** NONE in this phase. All call sites use the factory-time defaults (15s read, 60s submit, 180s listen, 30s pollOne).
    - The behavioural contract is preserved: each migrated site continues to return the same `dirtyRead`/`submit` result shape; the only difference is that the call now goes through `withFailover` + per-tier timeout. No call-site-visible API change.
    - `npm run typecheck` exits 0 after the change.
    - **Surrounding-code preservation (locked):** all `Pact.builder` blocks, `signTransaction` calls, `await submit(signed)` patterns, error handling, gas calculation are preserved verbatim. T3.3 is a SURGICAL replacement of `createClient(getPactUrl(...))` → `getFailoverClient(...)` ONLY.
    - **No new tests** added in this phase. Verification of failover behavior at the migrated sites is integration-tested via Phase 4's `tests/failover-submit.test.ts` (REQ-15).
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\activateFunctions.ts` — read in full to identify the destructure shape at line 173.
    - `D:\_Claude\OuronetCore\src\network\failoverClient.ts` — read AFTER T3.1 lands; verify `getFailoverClient(chainId)` is exported with the expected return shape `{ dirtyRead, submit, listen, pollOne }`.
    - `D:\_Claude\OuronetCore\src\network\index.ts` — read AFTER T3.1 lands; confirm `getFailoverClient` reachable via the barrel.
    - `D:\_Claude\OuronetCore\src\constants\kadena.ts` — read for reference; `getPactUrl(chainId)` is the legacy helper being phased out at the call sites (still exported, marked deprecated in Phase 1 T1.4).
    - **T3.1 task notes** — confirm the exact return-shape of `getFailoverClient` matches the locked spec before destructuring.
    - `D:\_Claude\OuronetCore\.bee\specs\2026-05-01-reliability-failover\requirements.md` — REQ-03 section.
  - research:
    - Sites: [CITED] EXACTLY 1 createClient invocation at `src/interactions/activateFunctions.ts:173` — shape `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 10. `getPactUrl` imported in multi-line block at lines 6-9 (line 8).
    - Pact preservation: [CITED] `Pact.builder` used at line 143 — confirms `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY use of `getPactUrl` in this file is at line 173 → safe to remove from `../constants` import.
    - Reuse: [LOCKED] `getFailoverClient` from T3.1, signature `(chainId: string, options?: FailoverClientOptions) => { dirtyRead, submit, listen, pollOne }`. T3.3 omits the second arg (uses defaults).
    - Approach: [ASSUMED] One-line search-and-replace: `createClient(getPactUrl(KADENA_CHAIN_ID))` → `getFailoverClient(KADENA_CHAIN_ID)`. Final greps: createClient=0, getPactUrl=0, getFailoverClient=2 (1 import + 1 site).
    - Context7: [ASSUMED] Not applicable — pure call-site migration.
  - notes:

- [x] T3.4 | Migrate the 9 chain-call invocations in `src/interactions/addLiquidityFunctions.ts` (mix breakdown verified: 6 dirtyRead + 6 submit + 2 listen = 14 operation sites across 9 destructures) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/addLiquidityFunctions.ts`, every `createClient(getPactUrl(...))` invocation is replaced with `getFailoverClient(...)` preserving the destructure and the chain id argument verbatim.
    - **Expected site count (RECONCILED):** 9 `createClient` invocations totaling 14 operation sites. **Verified breakdown is `6 dirtyRead + 6 submit + 2 listen = 14`** (NOT the spec's earlier framing of "9 submit + 5 dirtyRead" — same total, different mix; the file contains 2 `{ listen }` single-destructures at lines 411 and 573 that the spec's original count missed). Implementer should report the actual mix in `notes:` for retroactive Phase 4 spec update. Verify with `grep -n createClient` post-edit — should yield 0 matches.
    - **Import surgery:** same pattern as T3.3 — remove `createClient` from `@kadena/client` import (preserve `Pact` if used elsewhere in file), conditionally remove `getPactUrl` from `../constants` import (only if no remaining references), add `getFailoverClient` to `../network` import.
    - All other acceptance criteria from T3.3 apply identically: no per-call overrides, surrounding-code preservation, behavioural contract preservation, no new tests, typecheck clean.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\addLiquidityFunctions.ts` — read in full to identify the 9 `createClient` invocations and their destructure shapes.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 9 createClient invocations at the following lines (verified by grep):
      - Line 305: `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (2 sites: 1 dirtyRead + 1 submit)
      - Line 381: `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (2 sites)
      - Line 411: `const { listen } = createClient(getPactUrl(KADENA_CHAIN_ID));` (1 site)
      - Line 463: `const { submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (1 site)
      - Line 520: `const { submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (1 site)
      - Line 573: `const { listen } = createClient(getPactUrl(KADENA_CHAIN_ID));` (1 site)
      - Line 767: `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (2 sites)
      - Line 941: `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (2 sites)
      - Line 1013: `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` (2 sites)
      - Total operation sites: 6 dirtyRead + 6 submit + 2 listen = 14. **Reconciled vs spec's "9 submit + 5 dirtyRead = 14" framing — same total, corrected mix.**
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 8. `getPactUrl` in multi-line block at lines 2-7 (line 6).
    - Pact preservation: [CITED] grep `Pact\.` confirms `Pact.builder` usage in file body — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms NO non-createClient uses of `getPactUrl` in this file → safe to remove from `../constants`.
    - Network import: [CITED] No existing `from "../network"` import in this file — fresh import line for `getFailoverClient`.
    - Approach: [ASSUMED] Search-and-replace `createClient(getPactUrl(` → `getFailoverClient(` is safe — pattern uniquely disambiguates. Final greps: createClient=0, getPactUrl=0, getFailoverClient=10 (1 import + 9 sites).
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.5 | Migrate the 1 chain-call site in `src/interactions/coilFunctions.ts` (1 destructure of `{ dirtyRead, submit }` at line 201) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/coilFunctions.ts`, the 1 `createClient(getPactUrl(...))` invocation at line 201 is replaced with `getFailoverClient(...)` preserving the destructure and the chain id argument verbatim.
    - **Expected site count:** 1 `createClient` invocation totaling 2 operation sites (1 dirtyRead + 1 submit).
    - All acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\coilFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 1 createClient invocation at `src/interactions/coilFunctions.ts:201` — `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`. 2 operation sites.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 7. `getPactUrl` in multi-line block at lines 2-6 (line 5).
    - Pact preservation: [CITED] `Pact.builder` used at line 176 — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY use of `getPactUrl` is the createClient site → safe to remove.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Identical to T3.3. Final greps: createClient=0, getPactUrl=0, getFailoverClient=2.
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.6 | Migrate the 4 chain-call sites in `src/interactions/crossChainFunctions.ts` (heterogeneous chain ids; mix is 2 submit + 1 pollOne + 1 listen, NO dirtyRead in this file) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; PRESERVE the `getPactUrl` import (still used at lines 28 and 403 in `pactRead` option blocks — file-specific exception); update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/crossChainFunctions.ts`, every `createClient(getPactUrl(...))` invocation at lines 216, 228, 375, 386 is replaced with `getFailoverClient(...)` preserving the destructure and the chain id argument verbatim.
    - **Expected site count:** 4 `createClient` invocations totaling 4 operation sites (a mix of submit/pollOne/listen, NO dirtyRead in this file). Verify with `grep -n createClient` post-edit — should yield 0 matches.
    - **Cross-chain quirk to preserve verbatim (locked):** cross-chain operations use HETEROGENEOUS chain ids — NOT all `KADENA_CHAIN_ID`. Specifically:
      - Line 216: chain id arg is `sourceChain` (parameter)
      - Line 228: chain id arg is `chainId` (parameter)
      - Line 375: chain id arg is `targetChain` (parameter)
      - Line 386: chain id arg is `chainId` (parameter)
      Preserve each chain id argument VERBATIM — DO NOT collapse to `KADENA_CHAIN_ID`.
    - **CRITICAL — `getPactUrl` import MUST BE PRESERVED (file-specific exception, locked):** `getPactUrl` is also used at lines 28 and 403 inside `pactUrl: getPactUrl(chainId),` option blocks (for `pactRead`/`rawCalibratedDirtyRead` calls — read-side wraps that are NOT migrated in this phase by design). After removing the 4 createClient sites, `getPactUrl` is STILL in use at lines 28 + 403. **DO NOT remove `getPactUrl` from the `../constants` import** — this file is the SOLE exception to T3.3's import-removal pattern. The implementer must NOT dead-code-eliminate it. Verify with `grep -n getPactUrl src/interactions/crossChainFunctions.ts` post-edit — MUST return EXACTLY 2 matches (lines 28 and 403, or wherever they end up post-migration if line numbers shift).
    - **Type quirk on listen/pollOne sites:** verified per `@kadena/client/dist/client.d.ts:327,545`, `listen` and `pollOne` take `ITransactionDescriptor` (not bare strings). Verify the call sites at lines 228 (pollOne) and 386 (listen) pass `ITransactionDescriptor`-shaped arguments. If a site passes a bare string, the migrated code may type-fail unless T3.1's factory matches the loose shape — surface as a finding in `notes:` if encountered.
    - **Import surgery:** `createClient` is removed from `@kadena/client` import (preserve `Pact` and `ITransactionDescriptor`). `getPactUrl` STAYS in the `../constants` import per the file-specific exception above. A new import `import { getFailoverClient } from "../network";` is added.
    - All other acceptance criteria from T3.3 apply identically (surrounding-code preservation, no new tests, typecheck clean, no per-call overrides).
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\crossChainFunctions.ts` — read in full; pay special attention to (a) the chain id arguments (heterogeneous), (b) lines 28 and 403 where `getPactUrl` is consumed inside `pactRead` option blocks.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 4 createClient invocations with HETEROGENEOUS chain id arguments:
      - Line 216: `const { submit } = createClient(getPactUrl(sourceChain));`
      - Line 228: `const { pollOne } = createClient(getPactUrl(chainId));`
      - Line 375: `const { submit } = createClient(getPactUrl(targetChain));`
      - Line 386: `const { listen } = createClient(getPactUrl(chainId));`
      - Total operation sites: 2 submit + 1 pollOne + 1 listen = 4. Confirmed: NO `{ dirtyRead }` destructure in this file.
    - Pre-edit imports: [CITED] Single-line import at line 2: `import { KADENA_NETWORK, getPactUrl, getSpvUrl, GAS_STATION, KADENA_NAMESPACE } from "../constants";`. `createClient` at line 1 alongside `Pact` and `ITransactionDescriptor`.
    - Pact preservation: [CITED] `Pact.builder` used at lines 102, 166, 191, 346 — `Pact` import MUST be preserved. `ITransactionDescriptor` also preserved (used elsewhere).
    - **getPactUrl REMOVAL BLOCKED [CITED CRITICAL]:** `getPactUrl` is ALSO used at lines 28 and 403 inside `pactUrl: getPactUrl(chainId),` option blocks. After T3.6 migration removes the createClient sites, `getPactUrl` is STILL used at lines 28 + 403. → DO NOT remove `getPactUrl` from the `../constants` import. This is the file-specific exception to T3.3's import-removal pattern.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Type quirk: [VERIFIED] Per `@kadena/client/dist/client.d.ts:327,545`, `listen` and `pollOne` take `ITransactionDescriptor` (not bare strings). Implementer verifies actual call site arg shapes during migration.
    - Approach: [ASSUMED] Same search-and-replace `createClient(getPactUrl(` → `getFailoverClient(` works for all 4 sites despite different chain id arguments. Final greps: createClient=0, getPactUrl=2 (lines 28, 403 — read-side, NOT migrated), getFailoverClient=5 (1 import + 4 sites).
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.7 | Migrate the 6 chain-call invocations in `src/interactions/dexFunctions.ts` (uniform `{ dirtyRead, submit }` shape; 6 dirtyRead + 6 submit = 12 operation sites) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/dexFunctions.ts`, every `createClient(getPactUrl(...))` invocation is replaced with `getFailoverClient(...)`.
    - **Expected site count:** 6 `createClient` invocations totaling 12 operation sites (6 dirtyRead + 6 submit — all `{ dirtyRead, submit }` dual-destructure form, uniform across all sites).
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\dexFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 6 createClient invocations at the following lines (all uniform shape `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`):
      - Line 869, line 960, line 1059, line 1273, line 1385, line 1457
      - Total operation sites: 6 dirtyRead + 6 submit = 12.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 7. `getPactUrl` in multi-line block at lines 1-6 (line 5).
    - Pact preservation: [CITED] `Pact.builder` used in file body — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY uses of `getPactUrl` are the 6 createClient sites → safe to remove from `../constants` import after migration.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Search-and-replace works perfectly given uniform pattern. Final greps: createClient=0, getPactUrl=0, getFailoverClient=7 (1 import + 6 sites).
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.8 | Migrate the 1 chain-call site in `src/interactions/guardFunctions.ts` (1 destructure of `{ dirtyRead, submit }` at line 167) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/guardFunctions.ts`, the 1 `createClient(getPactUrl(...))` invocation at line 167 is replaced with `getFailoverClient(...)`.
    - **Expected site count:** 1 `createClient` invocation totaling 2 operation sites (1 dirtyRead + 1 submit).
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\guardFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 1 createClient invocation at `src/interactions/guardFunctions.ts:167` — `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 9. `getPactUrl` in multi-line block at lines 2-8 (line 7).
    - Pact preservation: [CITED] `Pact.builder.execution(` used at line 121 — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY use of `getPactUrl` is the createClient site → safe to remove.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Identical to T3.3. Final greps: createClient=0, getPactUrl=0, getFailoverClient=2.
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.9 | Migrate the 1 chain-call site in `src/interactions/kpayFunctions.ts` (1 destructure of `{ dirtyRead, submit }` at line 238) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/kpayFunctions.ts`, the 1 `createClient(getPactUrl(...))` invocation at line 238 is replaced with `getFailoverClient(...)`.
    - **Expected site count:** 1 `createClient` invocation totaling 2 operation sites (1 dirtyRead + 1 submit).
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\kpayFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 1 createClient invocation at `src/interactions/kpayFunctions.ts:238` — `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 8. `getPactUrl` in multi-line block at lines 2-7 (line 6).
    - Pact preservation: [CITED] `Pact.builder` used at line 196 — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY use of `getPactUrl` is the createClient site → safe to remove.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Identical to T3.3. Final greps: createClient=0, getPactUrl=0, getFailoverClient=2.
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.10 | Migrate the chain-call invocations in `src/interactions/ouroFunctions.ts` (largest file in the migration; reconcile active count between spec's "13 active sites" and grep's "12 active matches" before declaring success) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/ouroFunctions.ts`, every ACTIVE `createClient(getPactUrl(...))` invocation is replaced with `getFailoverClient(...)`.
    - **Expected site count (RECONCILIATION REQUIRED):** the spec's earlier framing said "13 active createClient invocations". Verified grep on the current on-disk file returned **12 active matches** (not 13) plus 1 commented-out reference. **Reconciliation rule (locked):** if grep finds 12 active createClient invocations (not 13), reconcile by leaving the 1 commented-out site as-is and migrating the 12 active. Document the discrepancy in the task `notes:` block (with the exact count and any extra-shape destructures observed) so Phase 4 can retroactively update the spec from "27 sites / 13 active" to the verified counts. **If grep finds 13 active — proceed with 13 migrations as originally framed.** Either outcome is acceptable; the unambiguous requirement is "every ACTIVE createClient invocation in this file is migrated, none missed".
    - **Pre-existing comment-out reference:** the file contains a commented line `// const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));` (around line 154) that is NOT counted in the active sites. Implementer should preserve the comment (it documents historical intent) but may also choose to update it to `// const { dirtyRead } = getFailoverClient(KADENA_CHAIN_ID);` for consistency. Either preservation OR update of the commented line is acceptable; do NOT delete it.
    - **Largest file in the migration — extra care warranted:** the implementer performs a final `grep -n createClient` AND `grep -n getPactUrl` AND `grep -n getFailoverClient` after the edit. Site count expectations: `grep -c createClient` post-edit = 0 (or 1 if the commented line is preserved verbatim with `createClient` still in the comment text — note explicitly which case in `notes:`); `grep -c getFailoverClient` post-edit = 1 import + N call sites (where N is the active count: 12 or 13).
    - **Import surgery:** same pattern as T3.3 — `createClient` removed from `@kadena/client` import (preserve `Pact`); `getPactUrl` removed from `../constants` import only if no remaining references (verify with grep — comment lines do NOT count as references because they are not type-checked); `getFailoverClient` added to `../network` import.
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\ouroFunctions.ts` — read in full (~2400 lines; the file is large but the migration is a uniform per-site edit).
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED RECONCILIATION REQUIRED] Grep returned 12 active matches + 1 commented; spec says 13 active. Likely active sites at lines 866, 954, 1037, 1112, 1238, 1377, 1528, 1689, 1790, 2017, 2246, 2415 = 12. Implementer must read file and reconcile the count, reporting the actual active count and the per-site destructure shapes in `notes:`.
    - Commented line: [CITED] Around line 154: `// const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));` — preserve.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 11. `getPactUrl` in multi-line block at lines 2-7 (line 6).
    - Pact preservation: [CITED] `Pact.builder` used heavily — `Pact` import MUST be preserved. Also imports `formatEU`, `mayComeWithDeimal`, `formatDecimalForPact`, `IKeyset`, multiple signing/error helpers — none affected by migration.
    - getPactUrl removal: [CITED] grep confirms ONLY uses of `getPactUrl` are the createClient sites (active and commented) → safe to remove from `../constants` import after migration.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [LOCKED] Recommended workflow: (1) read file to confirm pattern consistency and reconcile 12-vs-13 active count discrepancy; (2) do search-and-replace `createClient(getPactUrl(` → `getFailoverClient(`; (3) read file again to spot-check 3-4 random sites; (4) run grep to confirm zero `createClient` matches in active code body; (5) decide on commented-line treatment; (6) run typecheck; (7) document the reconciled count in `notes:`.
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.11 | Migrate the 2 chain-call invocations in `src/interactions/pensionFunctions.ts` (uniform `{ dirtyRead, submit }` shape at lines 62 and 125; 2 dirtyRead + 2 submit = 4 operation sites) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/pensionFunctions.ts`, the 2 `createClient(getPactUrl(...))` invocations at lines 62 and 125 are replaced with `getFailoverClient(...)`.
    - **Expected site count:** 2 `createClient` invocations totaling 4 operation sites (2 dirtyRead + 2 submit).
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\pensionFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 2 createClient invocations (uniform shape `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`):
      - Line 62, line 125
      - Total operation sites: 2 dirtyRead + 2 submit = 4.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 9. `getPactUrl` in multi-line block at lines 2-7 (line 6).
    - Pact preservation: [CITED] `Pact.builder` used at lines 37, 100 — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY uses of `getPactUrl` are the 2 createClient sites → safe to remove.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Identical to T3.3. Final greps: createClient=0, getPactUrl=0, getFailoverClient=3 (1 import + 2 sites).
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.12 | Migrate the 4 chain-call invocations in `src/interactions/urStoaFunctions.ts` (uniform `{ dirtyRead, submit }` shape at lines 263, 447, 493, 571; 4 dirtyRead + 4 submit = 8 operation sites) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/urStoaFunctions.ts`, the 4 `createClient(getPactUrl(...))` invocations at lines 263, 447, 493, 571 are replaced with `getFailoverClient(...)`.
    - **Expected site count:** 4 `createClient` invocations totaling 8 operation sites (4 dirtyRead + 4 submit).
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\urStoaFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 4 createClient invocations (uniform shape `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`):
      - Line 263, line 447, line 493, line 571
      - Total operation sites: 4 dirtyRead + 4 submit = 8.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 9. `getPactUrl` in multi-line block at lines 12-18 (line 16).
    - Pact preservation: [CITED] `Pact.builder` used at lines 222, 349, 432, 478, 549 — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY uses of `getPactUrl` are the 4 createClient sites → safe to remove from `../constants` import.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Identical to T3.3. Final greps: createClient=0, getPactUrl=0, getFailoverClient=5 (1 import + 4 sites).
    - Context7: [ASSUMED] Not applicable.
  - notes:

- [x] T3.13 | Migrate the 2 chain-call invocations in `src/interactions/wrapFunctions.ts` (uniform `{ dirtyRead, submit }` shape at lines 173 and 282; 2 dirtyRead + 2 submit = 4 operation sites) from `createClient(getPactUrl(chainId))` to `getFailoverClient(chainId)`; update imports accordingly | bee-implementer | needs: T3.1
  - requirements: [REQ-03]
  - acceptance:
    - In `src/interactions/wrapFunctions.ts`, the 2 `createClient(getPactUrl(...))` invocations at lines 173 and 282 are replaced with `getFailoverClient(...)`.
    - **Expected site count:** 2 `createClient` invocations totaling 4 operation sites (2 dirtyRead + 2 submit).
    - All other acceptance criteria from T3.3 apply identically.
    - File-disjoint from all other Wave 2 tasks.
  - context:
    - `D:\_Claude\OuronetCore\src\interactions\wrapFunctions.ts` — read in full.
    - All other context entries identical to T3.3.
  - research:
    - Sites: [CITED] EXACTLY 2 createClient invocations (uniform shape `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));`):
      - Line 173, line 282
      - Total operation sites: 2 dirtyRead + 2 submit = 4.
    - Pre-edit imports: [CITED] `import { Pact, createClient } from "@kadena/client";` at line 6. `getPactUrl` in multi-line block at lines 8-15 (line 12).
    - Pact preservation: [CITED] `Pact.builder` used at lines 116, 137, 253 — `Pact` import MUST be preserved.
    - getPactUrl removal: [CITED] grep confirms ONLY uses of `getPactUrl` are the 2 createClient sites → safe to remove from `../constants` import.
    - Network import: [CITED] No existing `../network` import — fresh import line needed.
    - Approach: [ASSUMED] Identical to T3.3. Final greps: createClient=0, getPactUrl=0, getFailoverClient=3 (1 import + 2 sites).
    - Context7: [ASSUMED] Not applicable.
  - notes:

## Wave 3 (verification gate — depends on Wave 2)

- [x] T3.14 | Run typecheck and the full vitest suite to verify zero regressions; confirm exactly 346 tests still pass after T3.1–T3.13; assert with grep that `createClient` is fully purged from `src/interactions/*.ts` AND that `getPactUrl` survives in EXACTLY 2 spots in `crossChainFunctions.ts` only | bee-implementer | needs: T3.1, T3.2, T3.3, T3.4, T3.5, T3.6, T3.7, T3.8, T3.9, T3.10, T3.11, T3.12, T3.13
  - requirements: [REQ-01, REQ-02, REQ-03, REQ-09, REQ-10]
  - acceptance:
    - `npm run typecheck` exits 0 with no TypeScript errors. The terminal output is captured verbatim in the task `notes:` block as evidence (per Firm Rule R8).
    - `npm test` exits 0. The vitest summary line shows **EXACTLY 346 tests passed** (the Phase 1+2 baseline, unchanged because Phase 3 adds no new tests) and zero failed. The full vitest summary block is captured in the task `notes:` as evidence. Note: this is `==`, not `>=` — Phase 3 invariant is "no new tests added in this phase". New tests for the factory's per-tier timeouts, override precedence, and request-key dedup contract land in Phase 4 (REQ-14 + REQ-15).
    - The v1.7.0 type-regression lock (`tests/types.test.ts`) is included in the run and continues to pass.
    - **Migration completeness greps (locked, mandatory; output captured verbatim in `notes:`):**
      - `grep -rn "createClient" src/interactions/*.ts` — **MUST RETURN ZERO MATCHES.** Any non-zero result indicates an incomplete migration in one of T3.3–T3.13. Note: a commented-line `createClient` in `ouroFunctions.ts` (per T3.10's preservation option) is acceptable IF the comment text was deliberately left untouched per T3.10's acceptance — the implementer must distinguish active code from comment in the grep output and document any commented-line residue explicitly. Active-code matches = FAIL.
      - `grep -rn "getPactUrl" src/interactions/*.ts` — **MUST RETURN EXACTLY 2 MATCHES**, both inside `src/interactions/crossChainFunctions.ts` (lines 28 and 403 in the pre-migration file, or wherever they end up post-migration if line numbers shift). Any other match indicates the corresponding T3.3–T3.13 task did not properly drop the `getPactUrl` import after migration.
      - `grep -rn "getFailoverClient" src/interactions/*.ts` — expected: 11 import lines + ~44 site lines = ~55 matches total. Distribution: T3.3=2, T3.4=10, T3.5=2, T3.6=5, T3.7=7, T3.8=2, T3.9=2, T3.10=13 or 14 (1 import + 12 or 13 sites — reconcile against T3.10 notes), T3.11=3, T3.12=5, T3.13=3. Implementer captures the actual count in `notes:`. Wide deviation (e.g., < 40 or > 70) signals a structural anomaly worth investigating.
      - `grep -rn "createClient" src/network/` — expected: at least 1 match in `src/network/failoverClient.ts` (the new file imports `createClient` from `@kadena/client` to compose chain operations inside the factory). The other network files (`nodeFailover.ts`, `index.ts`) should have 0 matches.
      - `grep -rn "createClient" src/reads/` — expected: at least 1 match in `src/reads/rawCalibratedRead.ts` (the file still constructs a `createClient` inside the `withFailover` callback and the explicit-`pactUrl` branch — `runWithTimeout` does not encapsulate the `createClient` call, only the `dirtyRead` invocation).
      - `grep -rn "runWithTimeout" src/` — expected: 1 export-line in `src/network/failoverClient.ts` + 4 use-lines inside `failoverClient.ts` (one per dirtyRead/submit/listen/pollOne method) + 2 use-lines inside `src/reads/rawCalibratedRead.ts` (one per failover/explicit-pactUrl branch) + 1 import line in `rawCalibratedRead.ts` = ~8 matches total. Capture actual count in `notes:`.
    - If any test fails OR any of the greps surface unexpected results, the task fails and T3.1–T3.13 must be re-examined; do NOT modify tests in this phase to make them pass, and do NOT touch any of the migrated interaction files in this verification gate.
    - This task does NOT run `npm run build` (Phase 4 owns the build-gate verification per REQ-20).
    - This task does NOT add any new test files (Phase 4 owns the new tests per REQ-14, REQ-15, REQ-16).
  - context:
    - The completed work from T3.1, T3.2, T3.3, T3.4, T3.5, T3.6, T3.7, T3.8, T3.9, T3.10, T3.11, T3.12, T3.13 (all 13 prior tasks live on disk before this task starts).
    - Repository root `D:\_Claude\OuronetCore` for command execution.
    - Locked baseline number: 346 tests (per Phase 1+2 success criteria — Phase 3 adds zero new tests, so the post-Phase-3 count is still 346). Anything below 346 is a regression.
    - **T3.1, T3.2, T3.3–T3.13 task notes** (read from this file's `notes:` blocks) — useful if a regression appears, to know exactly what landed in each task; especially T3.10's reconciliation note for the active site count.
    - `D:\_Claude\OuronetCore\.bee\specs\2026-05-01-reliability-failover\ROADMAP.md` — Phase 3 success criteria.
    - `D:\_Claude\OuronetCore\CLAUDE.md` — confirms `npm run typecheck` and `npm test` are the command names.
  - research:
    - Baseline: [CITED] 346 tests — confirmed in `phases/01-state-isolation-and-default-url/TASKS.md` and `phases/02-timeout-error-code-and-read-side-failover-wrap/TASKS.md`. Phase 1+2 baselines are both locked at 346. Phase 3 adds zero new tests.
    - Migration count: [CITED] Total `createClient` invocations in `src/interactions/*.ts` pre-migration = 44 (verified by `grep -cE "createClient\\s*\\(" src/interactions/*.ts`): activate=1, addLiquidity=9, coil=1, crossChain=4, dex=6, guard=1, kpay=1, ouro=12 or 13 (reconciliation pending T3.10), pension=2, urStoa=4, wrap=2. Files with 0 pre-existing matches: `infoOneFunctions.ts`, `kadenaFunctions.ts`, `index.ts`. After migration: all become 0 (post-T3.3–T3.13).
    - **getPactUrl post-migration expectation [CITED CRITICAL]:** `grep -rn getPactUrl src/interactions/` MUST return EXACTLY 2 matches AFTER migration — both in `crossChainFunctions.ts` at lines 28 and 403 (read-side `pactUrl:` option blocks, NOT in scope for Phase 3). All other files have only createClient-site uses of `getPactUrl` and will return 0 matches after migration. Any other match indicates an incomplete migration.
    - Pattern: [CITED] Verification-gate tasks for prior phases (T1.5, T2.4) used the same shape — typecheck + npm test + capture full vitest summary as evidence. T3.14 adds the migration-completeness greps because Phase 3's edit count (44 createClient invocations + 1 refactor + 1 new module) makes silent stragglers a real risk.
    - Approach: [ASSUMED] Run greps in this order: (1) typecheck first to catch type errors before functional ones; (2) full test suite second to catch behavioural regressions; (3) migration-completeness greps third to catch mechanical-edit stragglers. Capture each command's output verbatim in the task `notes:` block.
    - Approach: [ASSUMED] If a test fails with a message about `createClient` or `getPactUrl` being undefined, this almost certainly means a test mock that previously stubbed `@kadena/client.createClient` is no longer reached because the production code now goes through `getFailoverClient`. Per the acceptance criteria, do NOT modify the test in Phase 3 to update the mock — that would mask the migration's behavioural impact. Surface the failure as a regression and re-evaluate which task introduced the breakage.
    - Approach: [ASSUMED] An "open handles" warning in vitest output that did NOT appear in Phase 1 or Phase 2's verification runs would indicate either (a) `runWithTimeout`'s `clearTimeout` discipline is broken (a setTimeout leaks), or (b) one of the migrated interaction files is calling `getFailoverClient` in a code path that doesn't await the result. The implementer captures the warning and surfaces it as a regression, identifying the originating task.
    - Context7: [ASSUMED] Not applicable — verification gate uses tooling already present in the repo.
  - notes:

## Notes

- All 13 edit tasks (T3.1, T3.2, T3.3–T3.13) are pure code changes — no new tests are added in this phase. Test coverage for `getFailoverClient`'s per-tier timeouts, the override precedence chain, the request-key dedup contract, and the migrated sites' failover behaviour lives in Phase 4 (REQ-14, REQ-15).
- **Atomic-ship contract for the reliability-failover spec (locked, inherited from Phase 1+2 notes):** Phase 3 is NOT independently shippable to npm. The 4-phase split exists for review-loop granularity (smaller PRs, focused per-phase reviews) — NOT for independent ship cadence. The whole spec ships as ONE atomic v2.1.0 release after Phase 4 completes. Test coverage for this phase's deliverables lands in Phase 4 BEFORE the v2.1.0 tag is pushed, so the TDD red→green→refactor invariant is satisfied at spec-ship time even though it is intra-phase deferred. This is acknowledged-and-locked, not an oversight.
- **Phase 2 → Phase 3 refactor closure:** T3.2 closes the temporary code duplication acknowledged-and-locked at Phase 2 ship. After T3.2 lands, `src/reads/rawCalibratedRead.ts` no longer contains any inline `Promise.race` / `AbortController` / `setTimeout` / `clearTimeout` machinery — all timeout discipline is delegated to `runWithTimeout` from `src/network/failoverClient.ts`. The Phase 2 inline implementation was the prototype that informed the helper's contract; T3.2 collapses the duplication in the same direction the spec's "future fixes touch one place" goal points.
- **Controller-factory parameter shape (Phase 2 F-301 lesson applied):** T3.1's `runWithTimeout` uses `fn: (controller: AbortController) => Promise<T>` — NOT a simple `fn: () => Promise<T>`. This is the SOLE design difference between T3.1's helper and T2.2's inline block, and it is what enables safe extraction without breaking the per-attempt-AbortController invariant under `withFailover`. Reviewers and future implementers MUST preserve this signature; any future refactor that simplifies it back to `fn: () => Promise<T>` re-introduces the F-301 bug (single controller closed across primary + fallback retries → fallback synchronously rejects with stale AbortError).
- **Reconciliation findings baked into acceptance (researcher-verified, locked into Pass-2):**
  1. **T3.4 acceptance:** Site mix corrected to "6 dirtyRead + 6 submit + 2 listen = 14" (NOT spec's earlier "9 submit + 5 dirtyRead = 14" framing — same total, corrected per-tier breakdown). Implementer reports actual mix in `notes:` for Phase 4 retroactive spec update.
  2. **T3.10 acceptance:** 12-vs-13 active createClient count discrepancy between spec and grep is documented as a reconciliation rule — implementer reads file, reports actual active count, migrates EVERY active site without missing any, and notes the reconciliation in `notes:` for Phase 4 retroactive spec update.
  3. **T3.1 acceptance:** `listen` and `pollOne` corrected to take `ITransactionDescriptor` (not bare `string`), per verified reads of `node_modules/@kadena/client/dist/client.d.ts:327,545`.
  4. **T3.6 acceptance:** Explicit "DO NOT remove `getPactUrl` import" lock with line refs (28, 403) added to prevent dead-code-elimination by the implementer. This file is the SOLE exception to the standard import-removal pattern.
  5. **T3.14 verification gate:** Post-migration grep assertion locked — `grep -rn "getPactUrl" src/interactions/*.ts` MUST return EXACTLY 2 matches (both inside `crossChainFunctions.ts`); `grep -rn "createClient" src/interactions/*.ts` MUST return ZERO matches (active-code matches; commented `createClient` in `ouroFunctions.ts` is acceptable per T3.10's preservation option).
- **File-ownership map (post-Pass-2 wave assignment):** T3.1 → `src/network/failoverClient.ts` + `src/network/index.ts` (Wave 1; the `index.ts` edit is a 1-line append, file-disjoint from any other task). T3.2 → `src/reads/rawCalibratedRead.ts` (Wave 2). T3.3–T3.13 → 11 disjoint interaction files (Wave 2, all parallel). T3.14 → none, verification gate (Wave 3). No file-ownership conflicts within any wave.
- **Why T3.3–T3.13 are 11 separate tasks (not one bulk task):** each task is ~5-15 minutes for the small files and ~20-30 minutes for ouroFunctions.ts. Splitting per-file enables maximum parallel execution in Wave 2 (12 tasks running simultaneously) AND keeps each task's cognitive load minimal — the implementer reads ONE file, edits ONE file, verifies ONE file. A single bulk task would block on the slowest file and impose a 2-3× cognitive load on the implementer. The per-file split is also the granularity at which a failure can be cleanly retried without re-doing successful migrations.
- This phase does not touch any test file, the codex strategy (Phase 4 owns those wraps), the failover health-check timer (Phase 1 owned that), the errors module (Phase 2 owned `createTimeoutError`), the constants module (Phase 1 owned the `PACT_URL` deprecation), `infoOneFunctions.ts`, `kadenaFunctions.ts`, or any of the 16 already-`pactRead`-routed read sites (they inherit failover via Phase 2's wrap inside `rawCalibratedRead.ts`, refactored in T3.2 to consume `runWithTimeout`).

## Fragmentation Note

14 tasks across 3 waves (avg 4.67 tasks/wave, ABOVE the 2.5 consolidation target — `ok`). Wave 2 is heavily parallelised (12 tasks all file-disjoint). Wave 1 (T3.1 alone) and Wave 3 (T3.14 alone) are unavoidable single-task waves:

- **Wave 1 (T3.1 alone):** T3.1 is the foundational module that ALL Wave 2 tasks (T3.2–T3.13) import from. Cannot merge into Wave 2 — every Wave 2 task has a hard compile-time dependency on T3.1's exported symbols (`getFailoverClient` and `runWithTimeout`).
- **Wave 3 (T3.14 alone):** Verification gate that observes the integrated state of T3.1–T3.13 on disk (typecheck + npm test + grep assertions). By design must run AFTER all 13 edit tasks complete. Structural sequential gate.

The single-task waves at the boundaries are intrinsic to the dependency graph; the bulk of the work (12 parallel tasks in Wave 2) drives the average up well above the 2.5 target.
