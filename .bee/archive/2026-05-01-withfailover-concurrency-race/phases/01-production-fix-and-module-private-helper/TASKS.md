# Phase 1: Production Fix and Module-Private Helper -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = which REQ-IDs from ROADMAP.md this task addresses
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (filled by researcher in Pass 1.5)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

Rewrite the failover wrapper function in `src/network/nodeFailover.ts:106-127` so its retry decision uses a per-invocation captured base URL instead of the shared module-level `currentHost`. Add the supporting module-private helper that returns the canonical primary-host base URL. No new public exports, no changes to consumers, no test additions (Phase 2 owns the regression test).

## Wave 1 (parallel -- no dependencies)

- [x] T1.1 | Rewrite `withFailover` to use per-invocation captured base URL and add module-private `getPrimaryBaseUrl()` helper in `src/network/nodeFailover.ts` | bee-implementer
  - requirements: [REQ-01, REQ-02, REQ-03]
  - acceptance:
    - A new module-private (non-exported) function `getPrimaryBaseUrl()` is added to `src/network/nodeFailover.ts`. It returns a string of shape `${PRIMARY_HOST}/chainweb/0.0/${KADENA_NETWORK}` (mirroring `getActiveBaseUrl()`'s URL-construction at lines 82-85, but reading `PRIMARY_HOST` instead of `currentHost`).
    - The `getPrimaryBaseUrl()` helper has NO `export` keyword. Its visibility is module-internal only. **Automated check (auto-fix iter 1 lock per F-004):** `grep -E "^export[[:space:]].*getPrimaryBaseUrl" src/network/nodeFailover.ts` MUST return zero matches. (`grep "getPrimaryBaseUrl" src/network/nodeFailover.ts | wc -l` should return exactly 2 — one for the function declaration, one for the call site inside `withFailover`.)
    - **Helper placement (auto-fix iter 1 lock per F-PAT-001):** `getPrimaryBaseUrl()` is placed in the file's non-exported-helpers cluster (lines 36-80, between `stopRetryLoop` at line 80 and the exported-getters block starting at `getActiveBaseUrl` line 82). DO NOT place the helper amid the exported-getters cluster — that would break the file's existing visibility-grouping convention. The non-exported helpers cluster currently contains: `isHealthy` (line 36), `switchToFallback` (line 49), `switchToPrimary` (line 56), `startRetryLoop` (line 64), `stopRetryLoop` (line 75). Insert `getPrimaryBaseUrl` at the end of this cluster (immediately before line 82's `getActiveBaseUrl` exported getter).
    - **JSDoc on the helper (auto-fix iter 1 lock per F-PAT-002):** `getPrimaryBaseUrl()` carries a single-line JSDoc matching the style of `getActiveBaseUrl()` at line 82. Suggested text: `/** Get the canonical primary node base URL (chainweb API root). Module-private — reads PRIMARY_HOST regardless of currentHost. Used by withFailover for per-invocation primary-host comparison. */`.
    - The `withFailover` function (lines 106-127) is rewritten so that:
      - At entry (before invoking `fn`), it captures BOTH the current attempted base URL AND the current primary base URL into local consts: `const attemptedBaseUrl = getActiveBaseUrl();` and `const attemptedPrimaryBaseUrl = getPrimaryBaseUrl();`. Both captures happen at fn-entry — at catch-time, neither value is re-read from module state. (Auto-fix iter 1 lock: the prior single-capture form was vulnerable to F-001/F-002/F-003 — `setNodeConfig` or `resetNodeFailover` running mid-flight would mutate `PRIMARY_HOST`, causing a re-read at catch-time to compare against a different primary URL than the one in effect at entry. Capturing both URLs at entry guarantees the guard reflects "what was the primary AT THE TIME OF ATTEMPT".)
      - The catch-block guard at line 120 is replaced from `if (isNetworkError && currentHost === PRIMARY_HOST)` to `if (isNetworkError && attemptedBaseUrl === attemptedPrimaryBaseUrl)`. Both operands of the comparison are LOCAL captures, NOT global re-reads. This makes the guard robust to ANY concurrent module-state mutation (sibling withFailover flip, sibling setNodeConfig, sibling resetNodeFailover).
      - Inside the retry path, `switchToFallback()` is called UNCONDITIONALLY (no redundant gate). `switchToFallback`'s pre-existing idempotency at `src/network/nodeFailover.ts:50` (`if (currentHost === FALLBACK_HOST) return;`) correctly handles the concurrent-flip case — no additional guard is required at the call site. (Auto-fix iter 1 lock: the prior `if (getActiveBaseUrl() === attemptedBaseUrl) switchToFallback();` gate was BOTH redundant given idempotency AND incorrect under setNodeConfig race, per F-002. Removing the gate eliminates both issues.)
      - The retry call is `return await fn(getActiveBaseUrl())` (with `await`) so the second attempt always runs against the now-active fallback regardless of which invocation triggered the flip. (Auto-fix iter 1 lock: `await` keyword added per F-005 — symmetric with the initial `await fn(attemptedBaseUrl)` and ensures sync-throw cases produce a rejected promise rather than a sync throw out of the async wrapper.)
    - The network-error classification (`Failed to fetch` / `NetworkError` / `ECONNREFUSED` / `AbortError`) is preserved verbatim from the pre-fix shape. No new error signals are added.
    - Non-network errors continue to `throw err` without retry, identical to pre-fix.
    - When the captured `attemptedBaseUrl` is not the primary base URL (i.e., the call originated on the fallback), the error continues to propagate without a second retry, identical to pre-fix.
    - No other function in `src/network/nodeFailover.ts` is modified. Specifically, `setNodeConfig`, `resetNodeFailover`, `isHealthy`, `startRetryLoop`, `stopRetryLoop`, `switchToFallback`, `switchToPrimary`, `getActiveBaseUrl`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl` retain their current source byte-for-byte aside from any incidental whitespace adjustment.
    - `src/network/index.ts` is unchanged. It continues to read `export * from "./nodeFailover"; export * from "./failoverClient";` with no additions. The new helper is NOT visible through the `@stoachain/ouronet-core/network` subpath.
    - `npm run typecheck` exits 0 with no new TypeScript errors introduced.
    - `npm test` (running the pre-existing, unmodified test suite) exits 0. In particular the 7 it-blocks in the existing `withFailover` describe at `tests/network.test.ts:142-218` continue to pass without modification.
    - No new test file is created and no existing test file is modified in this phase. (Phase 2 owns the regression test.)
  - context:
    - Phase context: spec.md "Failover Retry Behavior" + "Internal Helper Surface" + "Public API Stability" sections; requirements.md REQ-01 through REQ-03; phases.md Phase 1 deliverables.
    - Files to read before editing:
      - `src/network/nodeFailover.ts` (full file — the only file edited)
      - `src/network/index.ts` (verify barrel surface invariant — read-only)
      - `tests/network.test.ts:142-218` (the 7 existing `withFailover` it-blocks that must keep passing — read-only, for reference on what "unchanged behavior" means)
    - Stack skill: `skills/stacks/typescript-library/SKILL.md` (native ESM, strict mode, `import type` for type-only imports if any are needed — none expected for this task).
    - Project conventions from CLAUDE.md: this is a pluggable-seam library; module-level mutable state (`currentHost`, `PRIMARY_HOST`, `FALLBACK_HOST`) is intentional. The fix preserves this design and works WITH the existing idempotency of `switchToFallback` (lines 49-54) and `startRetryLoop` (lines 64-65) — do NOT modify either.
  - research:
    - Pre-fix function body verified: [CITED] `src/network/nodeFailover.ts:106-127` reads currently as `export async function withFailover<T>(fn: (baseUrl: string) => Promise<T>): Promise<T>` with try-block calling `fn(getActiveBaseUrl())` at line 110, catch-block computing `isNetworkError` at lines 114-118 (the four-clause `||`-chain), and the load-bearing global-host guard at line 120: `if (isNetworkError && currentHost === PRIMARY_HOST)`. Inside that branch, line 121 calls `switchToFallback()` and line 123 calls `return fn(getActiveBaseUrl())`. Final fall-through `throw err;` at line 125. This is the exact body the rewrite replaces.
    - Pattern: [CITED] `src/network/nodeFailover.ts:82-85` — `getActiveBaseUrl()` body verified verbatim: ``return `${currentHost}/chainweb/0.0/${KADENA_NETWORK}`;``. The new `getPrimaryBaseUrl()` mirrors this shape exactly, swapping the single token `currentHost` for `PRIMARY_HOST`. No other change.
    - Constants in scope: [CITED] `KADENA_NETWORK = "stoa"` at `src/network/nodeFailover.ts:11`. `PRIMARY_HOST` is declared `let PRIMARY_HOST = NODE2_HOST;` at line 25 (mutable — `setNodeConfig` reassigns it, so the new helper must read it at call-time, not capture it at module load). `FALLBACK_HOST` at line 26, `customGasLimit` at line 27, `currentHost` at line 32, `retryTimer` at line 33. Note: the Phase 1 spec/TASKS goal references "lines 25-33" as a block; actual interleaving is `PRIMARY_HOST` 25, `FALLBACK_HOST` 26, `customGasLimit` 27, `HEALTH_TIMEOUT_MS` 29, `RETRY_INTERVAL_MS` 30, `currentHost` 32, `retryTimer` 33.
    - Reuse: [CITED] `switchToFallback()` body verified at `src/network/nodeFailover.ts:49-54` — line 50 is `if (currentHost === FALLBACK_HOST) return;` (idempotency gate). Line 51 emits `console.warn("[node-failover] Primary node down, switching to fallback:", FALLBACK_HOST);` ONLY when actually flipping, so the redundant-call path produces no log spam even without an explicit gate at the call site.
    - Reuse: [CITED] `startRetryLoop()` idempotency confirmed at `src/network/nodeFailover.ts:65` — `if (retryTimer) return;`. The new code does NOT call `startRetryLoop` directly; it propagates through `switchToFallback`. No change here.
    - Reuse: [LOCKED auto-fix iter 1, F-002] DROP the prior retry-path gate. Call `switchToFallback()` UNCONDITIONALLY in the retry path — `switchToFallback`'s built-in idempotency at line 50 (`if (currentHost === FALLBACK_HOST) return;`) correctly handles the concurrent-flip case. The previous proposed gate `if (getActiveBaseUrl() === attemptedBaseUrl) switchToFallback();` was BOTH redundant given idempotency AND incorrect under setNodeConfig race (would skip the flip if `setNodeConfig` mutated `currentHost` between fn-entry and catch). Dropping the gate eliminates both issues. The implementer MUST NOT add a redundant gate.
    - Reuse: [CITED] Network-error classification block at `src/network/nodeFailover.ts:113-118` (`Failed to fetch` / `NetworkError` / `ECONNREFUSED` / `AbortError`) — preserve verbatim per REQ-01 and the spec's "Failover Retry Behavior" clause "no new error classifications are added".
    - Barrel surface: [CITED] `src/network/index.ts` is byte-exact 5 lines: line 1 `// @stoachain/ouronet-core/network`, line 2 blank, line 3 `export * from "./nodeFailover";`, line 4 `export * from "./failoverClient";`, trailing newline. No prior `getPrimaryBaseUrl` symbol exists in `index.ts` — verified. Barrel must remain unmodified; the new helper is module-private (no `export` keyword) so even with `export *`, an un-exported function cannot leak through.
    - Symbol-collision check: [VERIFIED via Grep] `getPrimaryBaseUrl` does not exist anywhere in `src/` or `tests/` — only references are in `.bee/audit-specs/` and `.bee/specs/` planning artifacts. No collision risk in the production code. Adding the new helper is a clean introduction.
    - Imports / type-only imports: [CITED] `nodeFailover.ts` has ZERO `import` statements (verified with `Grep "^import"` — no matches). The file is fully self-contained; all referenced symbols (`KADENA_NETWORK`, `PRIMARY_HOST`, `currentHost`, `getActiveBaseUrl`, `switchToFallback`) are module-locals. The new `getPrimaryBaseUrl(): string` helper requires no new imports and no `import type` — it is plain `function getPrimaryBaseUrl(): string { return ... }` with all dependencies already in scope.
    - Types: [CITED] `withFailover<T>(fn: (baseUrl: string) => Promise<T>): Promise<T>` signature at lines 106-108 is unchanged. `attemptedBaseUrl` is a local `string` const (no new type declarations needed). The new helper signature is `(): string` — no generics, no parameters, return type inferred from the template literal but explicit annotation `function getPrimaryBaseUrl(): string` matches the style of `getActiveBaseUrl(): string` at line 83.
    - Approach: [DERIVED FROM REQUIREMENTS, auto-fix iter 1 LOCKED] The expected post-rewrite shape of the function body is:
      ```ts
      export async function withFailover<T>(
        fn: (baseUrl: string) => Promise<T>
      ): Promise<T> {
        // Capture BOTH URLs at entry. Re-reading PRIMARY_HOST at catch-time
        // would be wrong if setNodeConfig/resetNodeFailover ran mid-flight
        // (auto-fix iter 1 lock per F-001/F-002/F-003).
        const attemptedBaseUrl = getActiveBaseUrl();
        const attemptedPrimaryBaseUrl = getPrimaryBaseUrl();
        try {
          return await fn(attemptedBaseUrl);
        } catch (err: any) {
          const isNetworkError =
            err?.message?.includes("Failed to fetch") ||
            err?.message?.includes("NetworkError") ||
            err?.message?.includes("ECONNREFUSED") ||
            err?.name === "AbortError";

          if (isNetworkError && attemptedBaseUrl === attemptedPrimaryBaseUrl) {
            // Call switchToFallback unconditionally — its line-50 idempotency
            // (if currentHost === FALLBACK_HOST return;) handles the concurrent
            // flip case correctly. No redundant gate needed (auto-fix iter 1
            // lock per F-002 — prior gate was both redundant AND incorrect
            // under setNodeConfig race).
            switchToFallback();
            // Retry on the now-active fallback (await is symmetric with the
            // initial await above; sync throws now produce a rejected promise
            // rather than a sync throw out of the async wrapper — auto-fix
            // iter 1 lock per F-005).
            return await fn(getActiveBaseUrl());
          }
          throw err;
        }
      }
      ```
      The exact whitespace/formatting must follow the rest of `nodeFailover.ts` (2-space indent, double quotes, semicolons — visible in lines 49-127). The helper `getPrimaryBaseUrl()` is placed in the non-exported helpers cluster (lines 36-80) per F-PAT-001 — specifically AFTER `stopRetryLoop` (line 80) and BEFORE `getActiveBaseUrl` (line 82). The helper carries a single-line JSDoc matching `getActiveBaseUrl`'s style per F-PAT-002.
    - Verification commands the implementer must run before claiming done:
      - `npm run typecheck` — must exit 0.
      - `npx vitest run tests/network.test.ts` — the 7 existing `withFailover` it-blocks at lines 142-218 must all pass without modification. (Running the targeted test file rather than the full suite is acceptable for the per-task gate; the conductor runs the full suite once after the wave per the scoped-testing convention.)
      - Visual diff check on `src/network/index.ts` — must be identical to the pre-task contents (5 lines, byte-exact).
      - **`grep -E "^export[[:space:]].*getPrimaryBaseUrl" src/network/nodeFailover.ts` — MUST return zero matches** (auto-fix iter 1 lock per F-004 — automated check that the helper has no `export` keyword).
      - `grep -c "getPrimaryBaseUrl" src/network/nodeFailover.ts` — MUST return exactly 2 (one declaration + one call site inside `withFailover`).
  - notes:

## Notes

This phase contains 1 task in 1 wave by design. Pass 1's decomposition rationale established that REQ-01 (per-invocation captured base URL), REQ-02 (module-private `getPrimaryBaseUrl()` helper), and REQ-03 (sibling-flip gate inside the retry path) are three tightly-coupled changes to a single function (`withFailover`) plus its co-located helper, both inside the same file (`src/network/nodeFailover.ts`). Splitting them across tasks would either (a) introduce a forced file-edit dependency chain on the same function body — which violates the wave invariant "no two tasks modify the same file" — or (b) produce intermediate non-compilable states that the SubagentStop hook would reject. The atomic task is the correct granularity.

File-ownership conflict scan: T1.1 is the sole task; no intra-wave conflict possible. Only `src/network/nodeFailover.ts` is written; `src/network/index.ts` and `tests/network.test.ts` are read-only references.

Dependency scan: T1.1 has no `needs:` entry — it depends on no prior phase task and no prior wave task. Wave 1 placement is correct.

## Fragmentation Note

The fragmentation heuristic (`waves * 2.5 <= tasks`) reports `warn` for this phase because `1 * 2.5 = 2.5 > 1`. The single-task-wave structure is unavoidable and intentional, not a missed consolidation opportunity:

- There is no preceding wave to merge into (this is Wave 1 of Phase 1).
- The three requirements (REQ-01, REQ-02, REQ-03) all mutate the same function body in `src/network/nodeFailover.ts:106-127` plus add one adjacent helper. They cannot be parallelized across tasks without violating the "no two tasks modify the same file" wave invariant.
- Pass 1's deliberate decomposition decision (recorded in the phase planning rationale) selected single-task granularity over artificial splitting that would produce non-compilable intermediate states.

This is a genuine sequential/atomic constraint, not orchestration fragmentation.
