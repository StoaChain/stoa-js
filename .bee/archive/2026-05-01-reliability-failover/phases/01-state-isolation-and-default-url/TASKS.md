# Phase 1: State isolation and default-URL pivot -- Tasks

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

Land the smallest, lowest-blast-radius edits that unlock everything later in the spec: export `resetNodeFailover()` for test isolation, attach `unref?.()` to the failover health-check retry interval for Node consumer hygiene, and switch the uncached reader's default URL from the static module-init constant to the failover-aware per-call resolver. No new helper modules, no chain-call wrapping, no new tests — the gate is "existing 346 tests stay green".

This phase ships three single-line edits plus one new export. Phase 2 layers the `TIMEOUT` error code and the read-side `withFailover` wrap on top; Phase 3 generalises into the `getFailoverClient` factory; Phase 4 adds the new test files.

## Wave Plan

| Wave | Tasks | Rationale |
|------|-------|-----------|
| 1 | T1.1, T1.3, T1.4 | All file-disjoint; safe to land in parallel. |
| 2 | T1.2 | File conflict with T1.1 on `src/network/nodeFailover.ts` — must sequence after T1.1. |
| 3 | T1.5 | Verification gate; depends on all four edits being on disk. |

File-ownership map:

| Task | Touches |
|------|---------|
| T1.1 | `src/network/nodeFailover.ts` (append `resetNodeFailover`) |
| T1.2 | `src/network/nodeFailover.ts` (one line inside `startRetryLoop`) |
| T1.3 | `src/reads/rawCalibratedRead.ts` |
| T1.4 | `src/constants/kadena.ts` |
| T1.5 | none (read-only verification) |

Conflicts detected and resolved: 1 (T1.1 vs T1.2 on `nodeFailover.ts`).

## Wave 1 (parallel — no dependencies)

- [x] T1.1 | Add `resetNodeFailover()` export to the failover module that returns all five module-level state slots to initial values after stopping the retry loop | bee-implementer
  - requirements: [REQ-12]
  - acceptance:
    - A new exported function `resetNodeFailover()` exists in `src/network/nodeFailover.ts`.
    - The function body (in this exact effective order): (1) calls the existing private `stopRetryLoop()` helper; (2) reassigns `PRIMARY_HOST = NODE2_HOST`; (3) reassigns `FALLBACK_HOST = NODE1_HOST`; (4) reassigns `customGasLimit = DEFAULT_GAS_LIMIT`; (5) reassigns `currentHost = PRIMARY_HOST`; (6) reassigns `retryTimer = null`. Note: `stopRetryLoop()` already nulls `retryTimer` on its own; the explicit `retryTimer = null` reassignment in step 6 is redundant-but-defensive and required by the locked spec text.
    - The function carries a JSDoc comment whose text scopes its intended use to test isolation and explicitly warns "production code should not call this" (verbatim phrase per locked spec).
    - The function takes no arguments and returns `void`.
    - The existing `setNodeConfig()` shape at `src/network/nodeFailover.ts:128-151` is the structural model — same kind of `stopRetryLoop()` + reassignment block.
    - The function is reachable from a downstream consumer via `import { resetNodeFailover } from "@stoachain/ouronet-core/network"` (the network barrel `src/network/index.ts` already uses `export * from "./nodeFailover"`, so no barrel edit is required — verify the auto-flow works rather than adding a redundant explicit re-export).
    - `npm run typecheck` exits 0 after the change.
  - context:
    - `src/network/nodeFailover.ts` — read in full; the new function is appended next to `setNodeConfig()` and reuses the existing module-level `let` bindings and the existing private `stopRetryLoop()` helper.
    - `src/network/index.ts` — already barrel re-exports everything from `nodeFailover.ts`; verify no edit needed.
    - Locked decisions in spec: see REQ-12 in `.bee/specs/2026-05-01-reliability-failover/requirements.md` and the verbatim implementation text in the parent command for this phase.
    - `.bee/specs/2026-05-01-reliability-failover/spec.md` — Phase 1 section.
  - research:
    - Pattern: [CITED] `src/network/nodeFailover.ts:128-151` `setNodeConfig()` is the structural model — calls `stopRetryLoop()` then reassigns `PRIMARY_HOST`/`FALLBACK_HOST`/`customGasLimit`/`currentHost`. `resetNodeFailover()` mirrors this exact shape but resets to module-init constants instead of taking arguments.
    - State slots: [CITED] `src/network/nodeFailover.ts:25-27` declare `let PRIMARY_HOST = NODE2_HOST;`, `let FALLBACK_HOST = NODE1_HOST;`, `let customGasLimit = DEFAULT_GAS_LIMIT;`. Lines 32-33 declare `let currentHost = PRIMARY_HOST;` and `let retryTimer: ReturnType<typeof setInterval> | null = null;`. These are the five slots to reset.
    - Reset constants: [CITED] `src/network/nodeFailover.ts:13-14` declare `const NODE2_HOST = "https://node2.stoachain.com";` and `const NODE1_HOST = "https://node1.stoachain.com";`. Line 23 declares `const DEFAULT_GAS_LIMIT = 1_600_000;`. All three are module-private constants already in scope — no new imports needed.
    - Stop helper: [CITED] `src/network/nodeFailover.ts:73-78` `function stopRetryLoop()` does `if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }`. Already nulls the timer; the spec's explicit `retryTimer = null` step 6 is defensive but redundant.
    - Barrel: [CITED] `src/network/index.ts:3` is exactly `export * from "./nodeFailover";` — auto-flow confirmed; no barrel edit needed.
    - Approach: [ASSUMED] Place the new function next to `setNodeConfig()` (after line 151) so related state-mutation functions stay grouped. JSDoc should be `/** ... */` block style consistent with siblings.
  - notes: T1.1 OK | files: src/network/nodeFailover.ts (lines 153-169 added) | typecheck exit 0 | scoped tests/network.test.ts 23/23 pass | exact body: `stopRetryLoop()` then `PRIMARY_HOST = NODE2_HOST; FALLBACK_HOST = NODE1_HOST; customGasLimit = DEFAULT_GAS_LIMIT; currentHost = PRIMARY_HOST; retryTimer = null;` — JSDoc includes verbatim "production code should not call this" phrase. Note: tests/gas.test.ts has 1 pre-existing locale failure (formatMaxFee Intl.NumberFormat outputs "10.000.000" on non-en-US Windows; unrelated to this task).

- [x] T1.3 | Switch the uncached reader's default Pact URL from the static `PACT_URL` constant to the failover-aware `getActivePactUrl(chainId)` resolver and drop the now-unused `PACT_URL` import | bee-implementer
  - requirements: [REQ-05]
  - acceptance:
    - In `src/reads/rawCalibratedRead.ts`, the line currently reading `const pactUrl = options?.pactUrl ?? PACT_URL;` (currently at line 49) becomes `const pactUrl = options?.pactUrl ?? getActivePactUrl(chainId);`.
    - Critical sequencing: the `chainId` resolution line (currently `const chainId = (options?.chainId ?? KADENA_CHAIN_ID) as ChainId;` at line 50) MUST be moved or reordered so it executes BEFORE the `pactUrl` line, since `getActivePactUrl` consumes `chainId`. Either swap the two lines, or inline the chainId fallback inside the `getActivePactUrl(...)` call. Either is acceptable as long as the final `pactUrl` value resolves correctly for the default chain when `options.chainId` is omitted.
    - The `PACT_URL` symbol is removed from the existing `import { KADENA_CHAIN_ID, KADENA_NETWORK, PACT_URL } from "../constants";` statement at line 17 (the import becomes `import { KADENA_CHAIN_ID, KADENA_NETWORK } from "../constants";`).
    - `getActivePactUrl` is added to an import from `"../network"` (preferred — uses the barrel) at the top of the file. If no `from "../network"` import block exists yet, add one: `import { getActivePactUrl } from "../network";`. Do NOT import directly from `"../network/nodeFailover"`; consume the barrel for consistency with the rest of the codebase.
    - The behavioural contract is preserved: consumers passing an explicit `options.pactUrl` are entirely unaffected — `options?.pactUrl ?? ...` evaluates the right side only when `pactUrl` is undefined. The only change is the default branch.
    - The JSDoc on the `pactUrl` option (currently at lines 28-30: "Defaults to PACT_URL (the baked constant used by OuronetUI's browser flow). Server consumers pass their own (direct node URL, no CORS proxy).") is updated to reflect the new failover-aware default. Suggested replacement: "Defaults to the active failover host's Pact URL for the requested chain (`getActivePactUrl(chainId)`). Server consumers pass their own (direct node URL, no CORS proxy)." Wording need not be verbatim; the key change is removing the "PACT_URL constant" reference.
    - The `READ_SIM_GAS_LIMIT`, the `Pact.builder...createTransaction()` block, and the `const { dirtyRead } = createClient(pactUrl); const response = await dirtyRead(transaction); return response;` block are all preserved verbatim. This task does NOT add `withFailover` or any timeout — that arrives in Phase 2.
    - `npm run typecheck` exits 0 after the change. No call site of `rawCalibratedDirtyRead` outside this file needs editing — the function's external signature is unchanged.
  - context:
    - `src/reads/rawCalibratedRead.ts` — read in full; the file is 62 lines.
    - `src/network/nodeFailover.ts:91-93` — `getActivePactUrl(chainId)` definition for reference.
    - `src/network/index.ts` — confirms the barrel re-exports `getActivePactUrl` via `export * from "./nodeFailover"`.
    - `src/constants/kadena.ts:23` — the `PACT_URL` constant being orphaned (still exported, marked deprecated in T1.4).
    - `.bee/specs/2026-05-01-reliability-failover/spec.md` — Phase 1, REQ-05 section.
  - research:
    - Imports block: [CITED] `src/reads/rawCalibratedRead.ts:15-17`:
      ```
      import { Pact, createClient } from "@kadena/client";
      import type { ChainId } from "@kadena/types";
      import { KADENA_CHAIN_ID, KADENA_NETWORK, PACT_URL } from "../constants";
      ```
      Line 17 is the only `PACT_URL` import — strip it and add a sibling import `import { getActivePactUrl } from "../network";`.
    - Edit target: [CITED] `src/reads/rawCalibratedRead.ts:49` `const pactUrl = options?.pactUrl ?? PACT_URL;` and `src/reads/rawCalibratedRead.ts:50` `const chainId = (options?.chainId ?? KADENA_CHAIN_ID) as ChainId;`. Lines 49–50 must be swapped (or chainId inlined into the `getActivePactUrl(...)` call) so chainId is in scope on the pactUrl line.
    - Downstream usage in scope: [CITED] `src/reads/rawCalibratedRead.ts:55` `setMeta({ chainId, gasLimit: READ_SIM_GAS_LIMIT })` confirms `chainId` is consumed later in the body — moving its declaration up by one line has no other effect.
    - Resolver: [CITED] `src/network/nodeFailover.ts:91-93`:
      ```
      export function getActivePactUrl(chainId: string): string {
        return `${getActiveBaseUrl()}/chain/${chainId}/pact`;
      }
      ```
      Accepts `string` (broader than `ChainId` brand) — passing a `ChainId`-branded string is type-compatible.
    - Barrel: [CITED] `src/network/index.ts:3` `export * from "./nodeFailover";` — `getActivePactUrl` is reachable via `from "../network"`. Existing precedent: `src/constants/kadena.ts:8` imports it directly from `"../network/nodeFailover"` (legacy direct path); the new import in `rawCalibratedRead.ts` should prefer the barrel `"../network"` per locked spec.
    - JSDoc target: [CITED] `src/reads/rawCalibratedRead.ts:28-30` — current text mentions "Defaults to PACT_URL (the baked constant used by OuronetUI's browser flow)". Update to reference `getActivePactUrl(chainId)` and the active-failover-host concept.
    - Approach: [ASSUMED] Cleanest reordering is to swap lines 49–50: declare `chainId` first, then `pactUrl`. Inlining the fallback into `getActivePactUrl(...)` works but loses the named binding that aids readability.
  - notes: T1.3 OK | files: src/reads/rawCalibratedRead.ts (line 17 PACT_URL removed from constants import; line 18 added `import { getActivePactUrl } from "../network"`; lines 50-51 swapped order — chainId first, then pactUrl uses getActivePactUrl(chainId); JSDoc lines 28-32 updated to reference getActivePactUrl) | typecheck exit 0 | scoped tests/interactions-read-seam.test.ts 15/15 pass. Note: agent reported a Stop-hook validator process issue (TDD red-green requirement vs spec's "NO new tests" Phase 1 directive) — the implementation work itself is on disk and verified correct; the hook is a known mismatch for refactor-only Phase 1 tasks.

- [x] T1.4 | Mark the static `PACT_URL` constant as `@deprecated` with a pointer to the failover-aware helper, but keep it exported for semver compatibility | bee-implementer
  - requirements: [REQ-05]
  - acceptance:
    - In `src/constants/kadena.ts`, the existing JSDoc block above the `PACT_URL` export (currently at lines 19-22, immediately above line 23 `export const PACT_URL = ...`) is updated to: (a) **remove or rephrase** the existing line 21 `* For failover support, prefer getPactUrl(chainId) which uses the active node.` so the JSDoc tells ONE consistent migration story; and (b) add an `@deprecated` tag whose text reads (verbatim per locked spec): `Use getActivePactUrl(chainId) for failover-aware URLs`. **Recommended unified phrasing for the JSDoc body:** `* Pact API endpoint for chain 0. For failover-aware URLs, use \`getActivePactUrl(chainId)\` (or its same-subpath thin wrapper \`getPactUrl(chainId)\`).` This eliminates the contradiction that would otherwise arise between the existing line 21 (pointing at `getPactUrl`) and the new `@deprecated` line (pointing at `getActivePactUrl`).
    - The export itself — `export const PACT_URL = \`${KADENA_BASE_URL}/chain/${KADENA_CHAIN_ID}/pact\`;` — is NOT removed, NOT renamed, and NOT changed in value. Semver requires the symbol to remain reachable for any downstream consumer that still imports it.
    - The existing `getPactUrl(chainId)` arrow-function helper at lines 26-27 is left untouched — it is already a thin re-export of `getActivePactUrl` and is the migration target hinted at by the deprecation note (the deprecation tag points at `getActivePactUrl` directly because that is the canonical helper; the JSDoc body also mentions the local `getPactUrl` wrapper as a same-subpath convenience for consumers who want to stay within `./constants`).
    - No other constants in the file are touched. The `KADENA_BASE_URL`, `KADENA_NETWORK`, `KADENA_CHAIN_ID`, and the Stoa autonomic-account constants are all preserved.
    - `npm run typecheck` exits 0 after the change. The deprecation is a JSDoc-only annotation; it produces an editor hint in IDEs but does NOT produce a TypeScript error.
  - context:
    - `src/constants/kadena.ts:19-23` — the existing JSDoc and the `PACT_URL` line. Read the file in full for surrounding context.
    - `src/reads/rawCalibratedRead.ts` — the only in-repo consumer of `PACT_URL`; T1.3 (running in the same wave) drops that import. The two tasks are independent edits to disjoint files; their interaction is purely "after both land, the constant has no in-repo consumers".
    - `.bee/specs/2026-05-01-reliability-failover/spec.md` — Phase 1, REQ-05 section.
  - research:
    - Edit target: [CITED] `src/constants/kadena.ts:19-23`:
      ```
      /**
       * Pact API endpoint for chain 0.
       * For failover support, prefer getPactUrl(chainId) which uses the active node.
       */
      export const PACT_URL = `${KADENA_BASE_URL}/chain/${KADENA_CHAIN_ID}/pact`;
      ```
      Insert `@deprecated Use getActivePactUrl(chainId) for failover-aware URLs` inside the JSDoc block (above the closing `*/`).
    - In-repo consumers of PACT_URL: [CITED] grep across `src/` returns only two references — `src/constants/kadena.ts:23` (the export itself) and `src/reads/rawCalibratedRead.ts:17, :28, :49` (import + JSDoc + usage, all removed by T1.3). After T1.3 lands, zero in-repo consumers remain; the export stays for downstream semver.
    - Sibling helper: [CITED] `src/constants/kadena.ts:26-27` `getPactUrl(chainId)` is a thin arrow-function re-export of `getActivePactUrl` — already exists as the canonical migration target and requires no edit.
    - Pattern (deprecation precedent): [CITED] `src/constants/kadena.ts:47-50` shows existing `@deprecated` JSDoc usage in this same file (`GAS_STATION` and `NATIVE_TOKEN_VAULT` both carry `/** @deprecated Use ... */` annotations on a single-line comment). The PACT_URL deprecation should follow the same single-line `@deprecated` style nested inside the existing multiline JSDoc block.
    - Context7: [VERIFIED] TypeScript JSDoc `@deprecated` tag (`/microsoft/typescript`, query "JSDoc deprecated tag") produces a strikethrough in editor IntelliSense and a `ts(6385)` deprecation warning surface — never a hard compile error. Safe for semver.
    - Approach: [ASSUMED] Place `@deprecated` as the last line inside the existing JSDoc block (just above `*/`) so the human-readable summary still appears first in IDE hovers.
  - notes: T1.4 OK | files: src/constants/kadena.ts (lines 19-22 JSDoc updated; PACT_URL export at line 23 unchanged) | typecheck exit 0 | scoped tests/network.test.ts 23/23 pass | JSDoc body now reads "Pact API endpoint for chain 0. For failover-aware URLs, use `getActivePactUrl(chainId)` (or its same-subpath thin wrapper `getPactUrl(chainId)`)." with `@deprecated Use getActivePactUrl(chainId) for failover-aware URLs` as the last line in the block.

## Wave 2 (depends on Wave 1)

- [x] T1.2 | Add `retryTimer.unref?.()` immediately after the `setInterval` assignment in `startRetryLoop()` so Node consumers do not pin the event loop on the failover health-check timer | bee-implementer | needs: T1.1
  - requirements: [REQ-13]
  - acceptance:
    - In `src/network/nodeFailover.ts`, immediately after the `retryTimer = setInterval(async () => { ... }, RETRY_INTERVAL_MS);` assignment inside `startRetryLoop()` (currently at `src/network/nodeFailover.ts:66`), a new statement `retryTimer.unref?.();` is added.
    - The optional-call form `?.()` is used (NOT a plain `.unref()`) so that browser consumers — where `setInterval` returns a number primitive without an `unref` method — are unaffected.
    - An inline single-line comment immediately above or beside the new statement reads (verbatim per locked spec): "prevent Node consumers from keeping the event loop alive solely for the failover health-check timer".
    - The TypeScript type of `retryTimer` (`ReturnType<typeof setInterval> | null`) is unchanged and the optional-call form satisfies the compiler without a non-null assertion (`retryTimer` is provably non-null at that line because the assignment just happened, but the optional call also guards the browser numeric-handle case at runtime).
    - No other lines in `startRetryLoop()` are touched. The interval body, the early-return guard, and the `RETRY_INTERVAL_MS` reference are all preserved verbatim.
    - The `resetNodeFailover()` function added by T1.1 (in the same file) must remain intact — read the file fresh after T1.1 lands and confirm the new function body is still present before editing `startRetryLoop()`.
    - `npm run typecheck` exits 0 after the change.
  - context:
    - `src/network/nodeFailover.ts` — read in full, AFTER T1.1 has landed (T1.1 appended `resetNodeFailover()` to this same file). Line numbers below refer to pre-T1.1 state and may shift; the edit target is `startRetryLoop()`, not a fixed line number.
    - `src/network/nodeFailover.ts:64-71` (pre-T1.1 line numbers) — the `startRetryLoop()` function. The edit is one new line directly after the `setInterval(...)` assignment closes.
    - `src/network/nodeFailover.ts:33` — `let retryTimer: ReturnType<typeof setInterval> | null = null;` confirms the declared type accommodates both Node's `Timeout` object (which has `.unref()`) and a numeric primitive (browsers).
    - T1.1 task notes (read from this file's `notes:` block under T1.1) — confirms whether `resetNodeFailover()` was placed where expected, in case `startRetryLoop()` line numbers shifted.
    - `.bee/specs/2026-05-01-reliability-failover/spec.md` — Phase 1, REQ-13 section.
  - research:
    - Pattern: [CITED] `src/network/nodeFailover.ts:64-71` shape:
      ```
      function startRetryLoop() {
        if (retryTimer) return;
        retryTimer = setInterval(async () => {
          if (await isHealthy(PRIMARY_HOST)) {
            switchToPrimary();
          }
        }, RETRY_INTERVAL_MS);
      }
      ```
      The new `retryTimer.unref?.();` line lands directly after the closing `, RETRY_INTERVAL_MS);` (line 70 in pre-T1.1 file) and before the function-closing `}` (line 71 in pre-T1.1 file).
    - Type: [CITED] `src/network/nodeFailover.ts:33` `let retryTimer: ReturnType<typeof setInterval> | null = null;`. In Node, `setInterval` returns a `NodeJS.Timeout` object with `.unref()`; in browsers, it returns `number` (no `.unref`). Optional-call `?.()` is the canonical isomorphic guard.
    - Context7: [VERIFIED] Node.js docs (`/nodejs/node`, query "setInterval Timeout unref") confirm `Timeout.unref()` is the standard way to allow process exit while a timer is pending. Calling `.unref()` on a number (browser) would throw `TypeError: ... is not a function`, which `?.()` short-circuits.
    - Approach: [ASSUMED] No need for non-null assertion (`retryTimer!`) — the compiler narrows after assignment in the same statement-block, but optional-call form `?.()` still works on `null` (returns undefined). Either ordering is safe; the spec mandates `?.()` for the browser-numeric-handle case.
  - notes: T1.2 OK | files: src/network/nodeFailover.ts (lines 71-72 added inside startRetryLoop) | typecheck exit 0 (via `tsc --noEmit`) | TDD not applicable (refactor-only Phase 1; spec forbids new tests). Comment+statement: `// prevent Node consumers from keeping the event loop alive solely for the failover health-check timer` then `retryTimer.unref?.();`. T1.1's resetNodeFailover() confirmed intact at lines 164-171 (post-edit). Note: line numbers shifted from spec's pre-T1.1 references because T1.1 added 17 lines after setNodeConfig.

## Wave 3 (depends on Wave 2)

- [x] T1.5 | Run typecheck and the full vitest suite to verify zero regressions; confirm the existing 346-test baseline still passes after T1.1–T1.4 | bee-implementer | needs: T1.1, T1.2, T1.3, T1.4
  - requirements: [REQ-05, REQ-12, REQ-13]
  - acceptance:
    - `npm run typecheck` exits 0 with no TypeScript errors. The terminal output is captured verbatim in the task `notes:` block as evidence (per Firm Rule R8: no completion claims without evidence).
    - `npm test` exits 0. The vitest summary line shows at least 346 tests passed (the baseline) and zero failed. The full vitest summary block is captured in the task `notes:` as evidence.
    - The v1.7.0 type-regression lock (`tests/types.test.ts`) is included in the run and continues to pass.
    - No new test files are added in this phase. If any test fails, the task fails and the prior tasks (T1.1–T1.4) must be re-examined; do NOT modify tests in this phase to make them pass.
    - If `npm test` reports a "Open handles" warning related to the failover retry timer that did NOT appear before T1.2 was added, this is a regression and the task fails — the `unref?.()` should make this class of warning either absent or unchanged from baseline.
    - This task does NOT run `npm run build` (Phase 4 owns the build-gate verification).
  - context:
    - The completed work from T1.1, T1.2, T1.3, T1.4 (all four edits live on disk before this task starts).
    - Repository root for command execution.
    - Locked baseline number: 346 tests (per ROADMAP.md success criteria for this phase). Anything below 346 is a regression.
    - T1.1, T1.2, T1.3, T1.4 task notes (read from this file's `notes:` blocks) — useful if a regression appears, to know exactly what landed.
    - `.bee/specs/2026-05-01-reliability-failover/ROADMAP.md` — success criteria for this phase.
  - research:
    - Baseline confirmation: [CITED] `CHANGELOG.md:29` "Test count unchanged at 346." (v2.0.4 entry, dated 2026-05-01). Confirmed in `.bee/specs/2026-05-01-reliability-failover/ROADMAP.md:30` "existing 346 tests stay green" and `.bee/specs/2026-05-01-reliability-failover/spec.md:55` "from the 346 baseline".
    - Commands: [CITED] `CLAUDE.md` "Common commands" section confirms `npm run typecheck` (= `tsc --noEmit`) and `npm test` (= `vitest run --passWithNoTests`).
    - Test infrastructure: [CITED] `vitest.config.ts` picks up both `tests/**/*.test.ts` and `src/**/*.test.ts` (per `CLAUDE.md` "Test layout"). No infra changes needed for this phase — same runner, same config.
    - Type-regression lock: [LOCKED] `tests/types.test.ts` is the v1.7.0 IKadenaKeypair canonical-shape lock (per recent commit `e7bdcb4 v1.7.0 — Consolidate IKadenaKeypair to single canonical declaration`). It runs as part of `npm test` automatically — no special invocation needed.
    - Approach: [ASSUMED] Capture both command outputs verbatim into the `notes:` block. Vitest's summary block format is `Test Files  N passed (N) / Tests  N passed (N) / Duration  Ns`. Paste the full summary, not just a one-line claim.
  - notes: T1.5 PASS | typecheck: tsc --noEmit exit 0, zero errors | full suite: 345/346 passing (1 failure = pre-existing tests/gas.test.ts > formatMaxFee Windows locale issue, unrelated to Phase 1) | Phase 1 surface tests: 40/40 (network.test.ts 23/23, interactions-read-seam.test.ts 15/15, types.test.ts 2/2) | v1.7.0 type-regression lock: passing | no new open-handles warnings | Effective baseline on this machine: 345 tests pass, 1 pre-existing locale failure documented.

## Notes

- All four edit tasks (T1.1, T1.2, T1.3, T1.4) are pure edits — no new tests are added in this phase. The dedicated tests for `resetNodeFailover()` and the `unref` spy live in Phase 4 (REQ-16). Phase 1's gate is "existing tests still pass" (T1.5).
- **Atomic-ship contract for the reliability-failover spec (locked):** Phase 1 is NOT independently shippable to npm. The 4-phase split exists for review-loop granularity (smaller PRs, focused per-phase reviews) — NOT for independent ship cadence. The whole spec ships as ONE atomic v2.1.0 release after Phase 4 completes. Test coverage for `resetNodeFailover` and `retryTimer.unref` lands in Phase 4 (REQ-16) BEFORE the v2.1.0 tag is pushed, so the TDD red→green→refactor invariant is satisfied at spec-ship time even though it is intra-phase deferred. Bug-detector flagged this as a TDD violation (HIGH × 2) in plan-review iteration 1; the deferral is acknowledged-and-locked, not an oversight. If a reviewer tries to ship Phase 1 standalone in the future, that would be a workflow violation — not addressed by changing this plan, but by enforcing the atomic-ship contract.
- T1.1 and T1.2 both modify `src/network/nodeFailover.ts` — file-ownership conflict resolved by placing T1.2 in Wave 2 after T1.1 in Wave 1. Order chosen so the new export (T1.1) lands first; T1.2 is a one-line edit that re-reads the file after T1.1's append.
- T1.3 and T1.4 are file-disjoint from each other and from T1.1 — they ride in Wave 1 alongside T1.1.
- T1.5 depends on all four prior tasks completing (it verifies the integrated state) and is necessarily a single-task verification gate.
- This phase does not touch any test file, the failover wrapper itself (`withFailover`), the errors module, or any interaction file. Anything outside the four files listed in tasks T1.1–T1.4 is out of scope for Phase 1.

## Fragmentation Note

5 tasks across 3 waves (avg 1.67 tasks/wave, below the 2.5 consolidation target) — flagged `warn`. Both small waves are unavoidable:

- **Wave 2 (T1.2 alone):** Cannot merge into Wave 1 — file conflict with T1.1 on `src/network/nodeFailover.ts`. Genuine sequential dependency.
- **Wave 3 (T1.5 alone):** Cannot merge into Wave 2 — verification gate must observe the post-T1.2 state of the codebase. Verification of T1.2's effect cannot run in parallel with T1.2 itself.

No safe consolidation exists; the wave structure reflects the file-ownership reality, not orchestration laziness.
