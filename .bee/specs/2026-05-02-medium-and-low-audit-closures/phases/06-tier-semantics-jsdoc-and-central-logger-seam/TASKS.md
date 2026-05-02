# Phase 6: Tier semantics JSDoc + central logger seam — Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = which REQ-IDs this task addresses (REQ-12, REQ-13)
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (prevents pattern hallucination)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

Close F-CORE-020 (REQ-12) and F-CORE-022 (REQ-13). JSDoc the canonical tier mapping on `src/reads/pactReader.ts` + `src/reads/rawCalibratedRead.ts:40-46`. Introduce the SECOND of two NEW PUBLIC SURFACES: a central logger seam at NEW `./observability` subpath mirroring the `setPactReader` pattern. Sweep every remaining `console.warn`/`console.error` in `src/` and route via `getLogger()`. Atomic-ship: lands in same v2.3.0 commit as Phases 1-5 + 7.

**Premium mode** (Opus implementation + review). All 7 tasks below.

## Cross-phase dependency annotation (HARD)

**Phase 5 (catch-block cleanup) has a HARD source-level dependency on this phase's source files** — Phase 5's implementer imports `getLogger` from `../observability`, so `src/observability/{logger.ts,index.ts}` MUST exist on disk before Phase 5's tests run. The atomic-ship contract (NFR-06) places both phases in the same commit, but the conductor's wave logic across phases must prioritize Phase 6 Wave 1 (T6.1) and Wave 2 (T6.2) ahead of Phase 5 implementer tasks. Phase 6 owns the source layout and barrel; Phase 5 consumes it.

**Intra-phase coordination with Phase 3 (REQ-07):** Phase 3 modifies `src/guard/guardUtils.ts:76-79` to throw `UnknownPredicateError` (removing the existing `console.warn`). Phase 6's T6.5 sweep also touches that file. Both paths converge on ZERO `console.*` matches at commit time: if Phase 3 lands the guardUtils edit first, the hit is gone before T6.5 runs and T6.5 has nothing to do there; if T6.5 lands first, it routes via `getLogger().warn(...)` and Phase 3 then removes the call entirely when wiring the typed throw. The verification gate (T6.7) is written once Phase 3 + Phase 6 are both complete in the staged tree.

**Phase 5 / Phase 6 ouroFunctions.ts division of labor:** Phase 5 explicitly owns the 7 catch sites in `src/interactions/ouroFunctions.ts` at lines 1842, 1860, 1877, 1894, 1916, 2069, 2088 (REQ-10). Phase 6's T6.5 covers all OTHER `console.*` hits in that file (estimated ~8 remaining at lines 66, 87, 106, 1165, 1194, 1310, 1462, 1478, 1641, 1920, 2073, 2092, 2156, 2310, 2333 — minus any of the 7 Phase 5 sites). The implementer of T6.5 MUST grep first, exclude the Phase 5 line numbers from the sweep, and document the exclusion list in the task notes for the verification gate to cross-check.

## Wave Dependency Chain

```
Wave 1 (1 task)               Wave 2 (3 tasks parallel)        Wave 3 (2 tasks parallel)        Wave 4 (1 task)
─────────────────             ────────────────────────         ────────────────────────         ───────────────
T6.1  logger.ts impl  ──────► T6.2 index.ts barrel    ─┐
                              T6.3 package.json export │
                              T6.4 reads/ JSDoc        │
                                                       ├──────► T6.5 console.* sweep    ──┐
                                                       │        T6.6 logger seam tests  ──┴───► T6.7 verification gate
                                                       └─────────────────────────────────────────► (final)
```

T6.1 is the foundation — the seam impl with the Logger type, default `_logger`, set/get, and null-rejection. T6.2 (barrel), T6.3 (package.json), T6.4 (reads JSDoc) are all independent of each other once T6.1 exists. T6.5 (sweep) and T6.6 (tests) both need the import path live (T6.1 + T6.2). T6.7 is the verification gate run after everything else is on disk.

## Wave 1 (parallel — no dependencies)

- [x] T6.1 | Create `src/observability/logger.ts` — central logger seam mirroring `setPactReader` pattern | bee-implementer
  - requirements: [REQ-13]
  - acceptance:
    - File `src/observability/logger.ts` exists.
    - Exports `Logger` type with exactly two methods: `warn(msg: string, ...args: unknown[]): void` and `error(msg: string, ...args: unknown[]): void`.
    - Module-private state: `let _logger: Logger = <default>` where the default routes `warn` to `console.warn` and `error` to `console.error` (bind-or-arrow form, NOT just `console` reassignment — the default must be a fresh object so `setLogger` can swap it without leaking references).
    - Exports `setLogger(logger: Logger): void` mutator. If `logger === null` OR `logger === undefined`, throws `TypeError` with message EXACTLY `setLogger requires a non-null Logger` (byte-identical — the changelog Added-section text in Phase 7 commits to this string).
    - Exports `getLogger(): Logger` accessor returning the currently-installed `_logger`.
    - JSDoc on the module mirrors `pactReader.ts` style: brief problem statement, contract, default-vs-configured behavior, "narrow injection seam — NOT a full DI framework" framing.
    - File is ~30-50 lines.
    - `npm run typecheck` exits 0 after the file is added.
  - context:
    - Spec: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` REQ-13.
    - Pattern reference (read this): `Z:/OuronetCore/src/reads/pactReader.ts` — direct template.
    - Phase research notes below.
  - research:
    - Pattern: [CITED] `Z:/OuronetCore/src/reads/pactReader.ts:33-65` is the locked template — module-private `let _reader`, `setPactReader(reader)` mutator, `getPactReader()` accessor, default value bound at module load. Mirror exactly: `let _logger`, `setLogger(logger)`, `getLogger()`, default at module load.
    - Pattern: [CITED] `Z:/OuronetCore/src/reads/pactReader.ts:1-23` — JSDoc style. Open with the problem statement (mixed `console.*` calls across `src/`, no consumer-injection point), the contract (call once at boot, later calls replace), the default behavior (routes to `console.warn` / `console.error` for parity with pre-seam behavior), and the deliberate scope limit ("narrow injection seam — NOT a full DI framework").
    - Reuse: [CITED] Default `_logger` shape: `{ warn: (msg, ...args) => console.warn(msg, ...args), error: (msg, ...args) => console.error(msg, ...args) }`. Arrow form (NOT `console.warn.bind(console)`) keeps the spread-args contract explicit and matches the `Logger` type signature exactly.
    - Types: [CITED] `Logger` shape per REQ-13: `interface Logger { warn(msg: string, ...args: unknown[]): void; error(msg: string, ...args: unknown[]): void }`. `unknown[]` (NOT `any[]`) per repo convention — see `src/network/nodeFailover.ts:51` argument shapes that `console.warn` already accepts (string + arbitrary follow-up). The Phase 5 catch sites (`error` in catch blocks) all match this shape.
    - Approach: [CITED + LOCKED] Null-rejection — REQ-13 LOCKS the message text exactly: `setLogger requires a non-null Logger`. Throw `TypeError` (NOT `Error` — type-mismatch at the API boundary is a `TypeError`, matching JS-stdlib conventions like `Object.assign(null, ...)`). Check both `null` and `undefined` (`logger == null` covers both via JS coercion, but write the explicit `=== null || === undefined` form for code clarity).
    - Approach: [ASSUMED] Export `Logger` as a `type` (not `interface`) for parity with how `PactReader` is exported in `pactReader.ts:33`. Both are valid; matching the local convention reduces review noise.
    - Context7: [N/A] No external library docs needed — this is a self-contained module pattern internal to ouronet-core.
  - notes:

## Wave 2 (depends on T6.1)

- [x] T6.2 | Create `src/observability/index.ts` — barrel re-exporting the public surface | bee-implementer | needs: T6.1
  - requirements: [REQ-13]
  - acceptance:
    - File `src/observability/index.ts` exists.
    - Re-exports `Logger`, `setLogger`, `getLogger` from `./logger` via `export * from "./logger";` OR explicit named re-exports (either is acceptable; explicit named is more grep-friendly).
    - File is ~5-10 lines including a short module header comment mirroring `src/reads/index.ts` style.
    - `npm run typecheck` exits 0 after the file is added.
    - `npm run build` produces `dist/observability/index.js` and `dist/observability/index.d.ts` (no tsconfig change needed — `src/**/*.ts` glob already picks it up).
  - context:
    - Pattern reference: `Z:/OuronetCore/src/reads/index.ts` (10 lines, short header + `export *`).
    - Phase research notes below.
    - T6.1's `src/observability/logger.ts` MUST exist on disk before this task starts (Wave 2 dep).
  - research:
    - Pattern: [CITED] `Z:/OuronetCore/src/reads/index.ts:1-12` is the locked template — header comment summarizing what the subpath provides, then `export * from "./<implementation-file>"`. Two-file source layout (LOCKED iter 1 per spec-review I-003) means this barrel re-exports from `./logger` only; future observability modules would add their own `export * from "./<new-module>"` lines.
    - Reuse: [CITED] Use `export * from "./logger";` — this is the convention in `src/reads/index.ts:10-11`, `src/network/index.ts`, etc. Explicit named re-exports are also valid and slightly clearer at the cost of having to update on new exports — pick whichever the implementer prefers, but match the file already chosen elsewhere in the repo (the wildcard-export convention is the dominant choice).
    - Approach: [CITED] Header comment format from `src/reads/index.ts:1-9`: `// @stoachain/ouronet-core/observability` followed by a short paragraph (3-5 lines) describing the seam: "Central logger seam. Default routes to `console.warn`/`console.error`; consumers call `setLogger(logger)` once at boot to redirect." Cross-reference the `setPactReader` parallel.
    - Context7: [N/A] No external library docs needed.
  - notes:

- [x] T6.3 | Add `./observability` subpath to `package.json` exports map | bee-implementer | needs: T6.1
  - requirements: [REQ-13]
  - acceptance:
    - `Z:/OuronetCore/package.json` `exports` field has a new entry under the existing subpath block:
      ```json
      "./observability": {
        "types": "./dist/observability/index.d.ts",
        "import": "./dist/observability/index.js"
      }
      ```
    - Entry placement matches the existing alphabetical/logical pattern in the file (current order: `.`, `./constants`, `./network`, `./gas`, `./guard`, `./crypto`, `./errors`, `./signing`, `./wallet`, `./codex`, `./reads`, `./pact`, `./interactions`, `./interactions/*`, `./dalos`). Inserting `./observability` near `./network` (alphabetically) OR at the end before `./dalos` are both acceptable — match the locally established pattern.
    - JSON remains valid (commas, brackets correct).
    - File ends with a newline (preserve existing trailing-newline convention).
    - No version bump in this task — Phase 7 owns version 2.2.0 → 2.3.0.
    - After this task + T6.2 are both done, `node -e "import('./dist/observability/index.js').then(m => console.log(Object.keys(m)))"` (post-build) lists `setLogger` and `getLogger`. (Verified in T6.7, not here.)
  - context:
    - File: `Z:/OuronetCore/package.json` (current exports map at lines 8-69).
    - This task is independent of T6.2 at the file level (different file) — runs in parallel with T6.2 in Wave 2.
  - research:
    - Pattern: [CITED] `Z:/OuronetCore/package.json:8-69` — every existing subpath entry is `{ "types": "./dist/<name>/index.d.ts", "import": "./dist/<name>/index.js" }`. Mirror byte-identically. The `./reads` entry (lines 49-52) is the closest semantic parallel — both expose a small surface (a few exports each).
    - Pattern: [CITED] `Z:/OuronetCore/package.json:69` is the closing `}` of the `exports` block. The trailing comma on the last entry (`./dalos`) is absent in JSON-strict — preserve that convention. New entry inserted before `./dalos` needs a trailing comma after its closing `}`.
    - Reuse: [N/A] No code reuse — this is a JSON config edit.
    - Approach: [CITED + LOCKED] Subpath name `./observability` is LOCKED per REQ-13 — do NOT shorten to `./obs`, `./log`, or `./logger`. The spec text references `./observability` byte-identically and the changelog Added-section in Phase 7 commits to it.
    - Context7: [N/A]
  - notes:

- [x] T6.4 | JSDoc updates on `src/reads/pactReader.ts` and `src/reads/rawCalibratedRead.ts:40-46` — canonical tier mapping (REQ-12, F-CORE-020) | bee-implementer | needs: T6.1
  - requirements: [REQ-12]
  - acceptance:
    - `src/reads/pactReader.ts`: JSDoc enumerates the canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static) — match OuronetUI's reader semantics. The JSDoc explicitly notes that the default `rawCalibratedDirtyRead` IGNORES the `tier` argument (it has no cache). Cross-references `setPactReader` for cache-aware consumers (OuronetUI).
    - `src/reads/rawCalibratedRead.ts:40-46`: existing JSDoc for `tier` is extended (NOT replaced) with the canonical T1/T2/T3/T7 enumeration so consumers reading the raw reader's source see the same mapping.
    - JSDoc additions only — ZERO runtime code changes in either file. The `PactReader` type signature, the `_reader` state, and the function bodies remain byte-identical.
    - **Optional NODE_ENV development warning code is NOT added** — REQ-12 explicitly DROPS this iter 1 per advisory #2 (JSDoc-only).
    - `npm run typecheck` exits 0; `npm run build` exits 0 with no JSDoc-related TS errors.
    - The two existing JSDoc blocks remain readable (NOT bloated) — target +10-20 lines total across both files.
    - This task does NOT introduce any import to the new `./observability` subpath — `pactReader.ts` and `rawCalibratedRead.ts` stay self-contained on the reads-only surface.
    - Why this depends on T6.1: it does NOT depend on T6.1 functionally — but the conductor runs T6.4 in Wave 2 to keep the wave structure simple (Wave 1 = single foundational create; Wave 2 = parallel adds that touch independent files). The dependency edge is "soft" (organizational), not "hard" (compile-time).
  - context:
    - Files: `Z:/OuronetCore/src/reads/pactReader.ts` (full file already small — read all 76 lines), `Z:/OuronetCore/src/reads/rawCalibratedRead.ts:40-46` (the existing `tier?: string` JSDoc block).
    - Spec: REQ-12 in `requirements.md` — verbatim canonical tier mapping requirement.
  - research:
    - Pattern: [CITED] `Z:/OuronetCore/src/reads/rawCalibratedRead.ts:40-46` is the existing JSDoc block. It already says "Accepted and ignored" — the task is to ADD the canonical T1/T2/T3/T7 enumeration BELOW that text, not replace it. Form: a short list of bullet-style JSDoc lines like `*  T1 — balance reads (high churn, very short TTL in cache-aware consumers).`
    - Pattern: [CITED] `Z:/OuronetCore/src/reads/pactReader.ts:33-44` — the `PactReader` `options.tier?: string` field has NO JSDoc currently. Add a JSDoc comment block ABOVE the `tier?: string;` line that enumerates the mapping. Cross-reference `setPactReader` (line 54) by name in prose.
    - Reuse: [CITED] The "match OuronetUI's reader" wording in REQ-12 implies the mapping is a documented reality — list T1, T2, T3, T7 (per the requirements text) without inventing intermediate tiers (T4-T6) unless the implementer can find them documented in OuronetUI sources. The spec text only commits to T1, T2, T3, T7 — stay there.
    - Approach: [CITED + LOCKED] JSDoc-ONLY — REQ-12 explicitly drops the optional NODE_ENV development warning. Do NOT add `if (process.env.NODE_ENV === "development") console.warn(...)` or any runtime branching. The motivation for the drop (LOCKED iter 1 per advisory #2): adding NODE_ENV branching introduces a build-time dependency on `process.env` that doesn't fit the JSDoc-only scope of REQ-12 and would conflict with the logger-seam introduction in T6.1 (which DOES handle runtime warnings via the new `getLogger().warn`).
    - Context7: [N/A] No external docs — this is internal documentation work.
  - notes:

## Wave 3 (depends on Wave 2)

- [x] T6.5 | Sweep `console.warn` / `console.error` in `src/` — route via `getLogger()` from `../observability` | bee-implementer | needs: T6.1, T6.2
  - requirements: [REQ-13]
  - acceptance:
    - Every `console.warn` / `console.error` call site in `src/` is replaced with `getLogger().warn(...)` / `getLogger().error(...)`, EXCEPT the two carve-outs below.
    - Each modified file gains an import for `getLogger` from `../observability` (relative path; the subpath `@stoachain/ouronet-core/observability` is for external consumers, not internal source).
    - **Carve-out A — Phase 5 owns these (DO NOT TOUCH):** the 7 catch sites in `src/interactions/ouroFunctions.ts` at lines 1842, 1860, 1877, 1894, 1916, 2069, 2088. T6.5 sweeps all OTHER `console.*` hits in that file (estimated lines: 66, 87, 106, 1165, 1194, 1310, 1462, 1478, 1641, 1920, 2073, 2092, 2156, 2310, 2333 — re-grep at task start and exclude any of the Phase 5 line numbers if they overlap).
    - **Carve-out B — Phase 3 owns these (DO NOT TOUCH):** `src/guard/guardUtils.ts:78` `console.warn(\`[guardUtils] Unknown predicate: ...\`)` is removed entirely by Phase 3 (REQ-07 throws `UnknownPredicateError` instead). T6.5 leaves it alone IF Phase 3 has already landed in the staged tree (file no longer contains the call); IF Phase 3 has not yet landed, T6.5 routes the call via `getLogger().warn(...)` and Phase 3 will then remove it as part of its own edit. Either way, the verification gate at T6.7 sees ZERO matches.
    - **Carve-out C — `src/errors/transactionErrors.ts:251-254`** (3 calls inside `logDetailedError` debug helper): RE-ROUTE these too via `getLogger().error(...)`. The function is exported and could be called by consumers; treating it as part of the sweep keeps the contract simple. (`console.group` / `console.groupEnd` / `console.info` at lines 250, 257, 259 are NOT in scope — REQ-13 covers `warn` and `error` only.)
    - Sweep verification: `grep -nE "console\.(warn|error)" src/` returns ZERO matches AFTER Phase 3 + Phase 5 + Phase 6 are all staged together. The implementer of T6.5 should run the grep before and after their edit and document the diff in task notes.
    - File-level expected coverage (re-verify with grep at task start — these counts are from the planning-time grep):
      - `src/errors/transactionErrors.ts` — 3 hits (lines 251, 252, 254).
      - `src/network/nodeFailover.ts` — 1 hit (line 51).
      - `src/interactions/activateFunctions.ts` — 1 hit (line 93).
      - `src/interactions/addLiquidityFunctions.ts` — 8 hits (lines 110, 481, 692, 801, 827, 848, 863, plus any others — re-grep). NOTE (cross-plan auto-fix iter 1 per CI-001): Phase 5 modifies the outer try/catch around `getLPTypeInfo` (structural anchor — actual line range 219-257 in current file, NOT 285-287 as some upstream docs say; lines shift through the spec). None of the bodies in or around `getLPTypeInfo` contain `console.*` calls so there is no overlap with T6.5.
      - `src/interactions/coilFunctions.ts` — 1 hit (line 152).
      - `src/interactions/dexFunctions.ts` — ~30 hits (largest file in the sweep).
      - `src/interactions/guardFunctions.ts` — 1 hit (line 60).
      - `src/interactions/infoOneFunctions.ts` — ~17 hits.
      - `src/interactions/kpayFunctions.ts` — 5 hits (45, 71, 99, 139, 228).
      - `src/interactions/ouroFunctions.ts` — ~8 remaining hits AFTER Phase 5 carve-out (66, 87, 106, 1165, 1194, 1310, 1462, 1478, 1641, 1920, 2073, 2092, 2156, 2310, 2333 — 15 total minus the 7 Phase 5 owns = 8 in T6.5 scope; re-grep to confirm exact line set).
      - `src/interactions/urStoaFunctions.ts` — 3 hits (84, 170, 313).
      - `src/interactions/wrapFunctions.ts` — 4 hits (50, 68, 89, 228).
    - Total in T6.5 scope: ~85-90 call-site replacements across ~12 files (the audit-spec's "~25 across 8 files" estimate predates a fuller grep — REQ-13's binding contract is `grep returns ZERO`, NOT a fixed count).
    - Argument shapes: each call site preserves its existing arguments byte-identically. `console.error("Foo failed:", err)` becomes `getLogger().error("Foo failed:", err)` — same string, same trailing args, same number of args. ZERO behavior change at the default-logger path (default routes back to `console.error`).
    - `npm run typecheck` exits 0; `npm run build` exits 0; the existing test suite continues to pass (the default `_logger` is byte-identical to direct `console.*` so all existing tests' captured output remains the same).
  - context:
    - Spec: REQ-13 in `requirements.md`.
    - Phase 5 task list (read this before starting): `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/phases/05-catch-block-cleanup-logger-routed/TASKS.md` — confirms which 7 line numbers Phase 5 owns in `ouroFunctions.ts`.
    - Phase 3 task list: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/phases/03-guard-hardening-and-unknownpredicateerror/TASKS.md` — confirms `guardUtils.ts:78` console.warn is owned by Phase 3 (deleted, not routed).
    - Reference files: `src/observability/index.ts` (created in T6.2), `src/observability/logger.ts` (created in T6.1).
  - research:
    - Pattern: [CITED] Existing import-from-relative-subpath convention — see `Z:/OuronetCore/src/interactions/dexFunctions.ts` for how it imports from `../pact`, `../network`, etc. T6.5 adds `import { getLogger } from "../observability";` (or extends an existing import block if the file happens to import from another relative path that is alphabetically adjacent — purely cosmetic).
    - Pattern: [CITED] Replacement form — `console.error("Single Swap WITH Slippage Error:", error)` becomes `getLogger().error("Single Swap WITH Slippage Error:", error)`. Single-call replacement; no wrapper function; no buffering. The default `_logger` (T6.1) preserves the exact `console.error` behavior.
    - Reuse: [CITED] T6.1's `getLogger()` accessor — call once per use site (NOT cached in a module-level variable, since `setLogger` may swap the impl after module load). This matches the `pactRead`/`getPactReader` pattern in `src/reads/pactReader.ts:63-65`.
    - Types: [N/A] All call sites already pass `string + ...args` — already matches the `Logger` type T6.1 defines. No type errors expected.
    - Approach: [CITED + LOCKED] Carve-outs A and B are LOCKED. Implementer MUST grep `console\.(warn|error)` BEFORE editing each file, list the line numbers in task notes, cross-check against Phase 5 / Phase 3 owned lines, and only then edit. This is how the verification gate (T6.7) reaches zero matches.
    - Approach: [ASSUMED] Carve-out C (`logDetailedError` in `transactionErrors.ts`) is an inferred extension of REQ-13's "every `console.warn` and `console.error` in `src/`" wording. The function is exported but not in REQ-13's listed file set. Including it keeps the grep contract simple (zero matches, no carve-outs). If review flags this as out-of-scope, T6.5 can be amended in a fixer task, but the safer default is to include.
    - Context7: [N/A] No framework documentation lookups needed — this is mechanical refactoring within the project.
  - notes:

- [x] T6.6 | New test file `tests/observability-logger.test.ts` — logger seam contract (≥4 cases) | bee-implementer | needs: T6.1, T6.2
  - requirements: [REQ-13]
  - acceptance:
    - File `tests/observability-logger.test.ts` exists.
    - At least 4 test cases land (NFR-04 floor is 3; this phase commits to 4):
      1. **Default routing — warn:** assert that `getLogger().warn("hello", 1, 2)` invokes `console.warn("hello", 1, 2)` (use vitest's `vi.spyOn(console, "warn")` pattern; assert call args byte-identically).
      2. **Default routing — error:** assert that `getLogger().error("err", new Error("x"))` invokes `console.error("err", <Error>)`.
      3. **Setter swap + getter identity:** call `setLogger(customLogger)` where `customLogger = { warn: vi.fn(), error: vi.fn() }`; assert `getLogger() === customLogger` (reference identity); call `getLogger().warn("x")` and assert `customLogger.warn` was called with `"x"` and `console.warn` was NOT called.
      4. **Null-rejection:** `expect(() => setLogger(null as any)).toThrow(TypeError)`; check the message text byte-identically equals `setLogger requires a non-null Logger`. Also assert `setLogger(undefined as any)` throws the same TypeError + same message.
    - Test file uses `beforeEach` / `afterEach` (or `vi.restoreAllMocks` / a manual reset) to RESTORE the default logger between tests so cross-test pollution is impossible. (The seam is module-scoped state; without restoration test 4 could see test 3's swapped logger.)
    - File follows the existing test-file conventions in `tests/` (top-level, NOT co-located in `src/`; vitest imports; describe/it structure).
    - `npx vitest run tests/observability-logger.test.ts` exits 0 with all 4+ tests passing.
    - Watch It Fail: each new test case is verified to fail BEFORE T6.1's implementation is written (in the TDD-first cycle). Since T6.1 already lands by the time T6.6 runs in Wave 3, the implementer can validate this by temporarily commenting out the null-rejection check and confirming test 4 fails — then restoring it. Document the watch-fail step in task notes (paste the failing-output block).
    - The test file does NOT import from the published subpath (`@stoachain/ouronet-core/observability`) — it imports from the relative `src/` path (`../src/observability/logger` or `../src/observability`). The published-subpath verification happens at T6.7 via runtime ESM import after `npm run build`.
  - context:
    - Spec: REQ-13 + NFR-04 in `requirements.md`.
    - Reference test files: `Z:/OuronetCore/tests/encryption.test.ts` (console-spy pattern — locked precedent from v2.2.0 T2.5 #4 per the requirements.md "Reusability Opportunities" section), `Z:/OuronetCore/tests/cfm-builders.test.ts` (vitest convention).
  - research:
    - Pattern: [CITED] Console-spy pattern — `Z:/OuronetCore/tests/encryption.test.ts` uses `vi.spyOn(console, "warn")` in v2.2.0 T2.5 #4. Mirror exactly: `const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})` BEFORE the call, then `expect(warnSpy).toHaveBeenCalledWith("hello", 1, 2)` AFTER. Restore in `afterEach` via `vi.restoreAllMocks()` or `warnSpy.mockRestore()`.
    - Pattern: [CITED] vitest TypeError-with-exact-message assertion form: `expect(() => setLogger(null as any)).toThrow(new TypeError("setLogger requires a non-null Logger"))` matches BOTH error type AND message text. Alternative: `expect(() => setLogger(null as any)).toThrowError("setLogger requires a non-null Logger")` for message-only.
    - Reuse: [CITED] `tests/cfm-builders.test.ts` describe/it/expect imports from `vitest` are the project convention. No special wrapper; standard vitest top-level test file.
    - Reuse: [ASSUMED] beforeEach/afterEach reset pattern — call `setLogger(<default logger>)` at the end of each test that swapped the logger, OR re-import the module fresh. Simplest form: capture the default at suite start (`const defaultLogger = getLogger()`) and call `setLogger(defaultLogger)` in `afterEach`.
    - Approach: [CITED + LOCKED] Test 4 message text MUST be byte-identical to T6.1's throw. The changelog entry in Phase 7 (REQ-15) commits to this exact text — divergence between test, implementation, and changelog text fails the spec audit.
    - Context7: [VERIFIED via repo conventions] Vitest 4.x is the test runner per `package.json:106`. `vi.spyOn` and `vi.fn()` are the standard patterns; no Context7 lookup required since the patterns are already used in `tests/encryption.test.ts`.
  - notes:

## Wave 4 (depends on Wave 3 — single sequential gate)

- [x] T6.7 | Verification gate — phase-end checks before handing off to Phase 7 | bee-implementer | needs: T6.5, T6.6
  - requirements: [REQ-12, REQ-13]
  - acceptance:
    - Run `grep -nE "console\.(warn|error)" src/` — output must be EMPTY (zero matches). If non-empty, identify each remaining hit, cross-reference Phase 3 / Phase 5 ownership; if a hit is genuinely outside any carve-out, fail this gate and hand back to T6.5 for completion.
    - `Z:/OuronetCore/package.json` — confirm `./observability` subpath entry exists in the `exports` map with the locked shape `{ "types": "./dist/observability/index.d.ts", "import": "./dist/observability/index.js" }`. Confirm JSON validity via `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exit 0.
    - `npm run typecheck` exits 0.
    - `npm test` exits 0 (or sole allowed non-zero per the locked Windows-locale `tests/gas.test.ts > formatMaxFee` exception). Test count INCREASES by ≥4 (the new logger tests from T6.6); cross-reference with the prior-phase test count to confirm no test was lost.
    - `npm run build` exits 0; `dist/observability/index.js`, `dist/observability/index.d.ts`, `dist/observability/logger.js`, `dist/observability/logger.d.ts` all 4 files present (LOCKED iter 1 per spec-review I-003 — corresponds to the two-file source layout in T6.1+T6.2).
    - Runtime ESM import verification: `node -e "import('./dist/observability/index.js').then(m => { console.log(typeof m.setLogger, typeof m.getLogger); })"` outputs `function function`. (`Logger` is a type — not observable at runtime; verified via `dist/observability/index.d.ts` containing the export.)
    - Verify the `Logger` type is exported in the d.ts: `grep -E "(export type|export interface) Logger" dist/observability/logger.d.ts dist/observability/index.d.ts` — at least one match.
    - JSDoc on `src/reads/pactReader.ts` and `src/reads/rawCalibratedRead.ts` mentions the canonical T1/T2/T3/T7 mapping — visual inspection (no automated check; reviewer signs off).
    - `tests/types.test.ts` v1.7.0 type-regression lock (NFR-02) still passes — the new public surface is ADDITIVE, so the type-regression test should continue to pass without modification.
    - All findings are reported as a single task-notes block; pass/fail is binary per item.
    - On fail: hand back to the responsible upstream task (T6.1/T6.2/T6.3/T6.4/T6.5/T6.6) with the exact failing diagnostic; do NOT silently fix unrelated issues here.
  - context:
    - Spec: REQ-12, REQ-13, REQ-17 (Phase 7's verification gate is the SUPERSET of this gate; T6.7 is Phase 6's local gate).
    - All upstream task notes from T6.1 through T6.6 (read all of them in TASKS.md).
  - research:
    - Pattern: [CITED] T2.13-style verification gate from v2.2.0 spec at `Z:/OuronetCore/.bee/archive/2026-05-02-crypto-pact-test-hardening/` — single task at the end of a phase that runs the contract checks listed in the spec's success criteria, reports pass/fail per item, hands back failing items by ID. Mirror the structure.
    - Pattern: [CITED] Workflow-gate parity — `.github/workflows/publish.yml:99/111/120` enforces version-parity grep checks at publish time; T6.7 doesn't re-run those (Phase 7 owns the version bump that those checks gate on), but the `[[:space:]]+` and `[[:space:]]` anchor convention is documented in REQ-17 for Phase 7's reference.
    - Reuse: [CITED] The grep command `grep -nE "console\.(warn|error)" src/` is verbatim from REQ-13's verification clause and the success criteria in `ROADMAP.md` Phase 6 row #5.
    - Approach: [CITED + LOCKED] The 4 dist files (`dist/observability/{index,logger}.{js,d.ts}`) are LOCKED iter 1 per spec-review I-003. The two-file source layout (T6.1 + T6.2) is the upstream lock that this gate verifies the downstream artifact of.
    - Context7: [N/A] No external docs needed — this is project-internal verification.
  - notes:

## Fragmentation check

`waves * 2.5 = 4 * 2.5 = 10` vs `tasks = 7` → fails the average-density target (target ≥ 10 tasks for 4 waves).

**Status: ok (consolidated)** — the wave structure is genuinely sequential, not fragmentation-by-accident. Detailed justification per small wave:

- **Wave 1 (1 task — T6.1):** Single foundational task by design. Every other task in the phase has either a hard compile-time dependency (T6.2 imports from `./logger`; T6.5 imports `getLogger` from `../observability`; T6.6 tests the impl) or a soft organizational dependency (T6.3 declares the subpath that T6.1 implements; T6.4 is reads-JSDoc only and could move to Wave 1 — see below). Cannot be merged with a "Wave 0" because there is no preceding wave.
- **Wave 4 (1 task — T6.7):** Verification gate by definition. Must run after all upstream edits are on disk. Cannot merge with Wave 3 because Wave 3's tasks are the inputs that the gate validates.

**Could T6.4 (reads JSDoc) move from Wave 2 to Wave 1?** Functionally yes — T6.4 has zero compile-time dependency on T6.1. The `needs: T6.1` annotation is organizational (keep Wave 1 minimal). Moving T6.4 to Wave 1 would give a 2-task / 2-task / 2-task / 1-task structure (averaging 1.75 — still under target). The decision to leave T6.4 in Wave 2 is intentional: Wave 1 is reserved for the seam-creation single-source-of-truth task; Wave 2 is the parallel breadth (barrel + package.json + reads JSDoc — three independent files). This is more readable for the conductor and the implementer than mixing creation + JSDoc in Wave 1. Phase fragmentation gate is informational, not blocking — sequential structure here is genuinely required by the seam-then-consume topology.

**Conclusion:** fragmentation is `ok` — every 1-task wave has a documented genuine sequential dependency. No anti-pattern.

## File ownership conflict matrix

| Wave | Task | Files written |
|------|------|--------------|
| 1 | T6.1 | `src/observability/logger.ts` (NEW) |
| 2 | T6.2 | `src/observability/index.ts` (NEW) |
| 2 | T6.3 | `Z:/OuronetCore/package.json` (modify) |
| 2 | T6.4 | `src/reads/pactReader.ts` (JSDoc-only modify), `src/reads/rawCalibratedRead.ts` (JSDoc-only modify) |
| 3 | T6.5 | `src/errors/transactionErrors.ts`, `src/network/nodeFailover.ts`, `src/interactions/{activate,addLiquidity,coil,dex,guard,infoOne,kpay,ouro,urStoa,wrap}Functions.ts` (~12 files modify) |
| 3 | T6.6 | `tests/observability-logger.test.ts` (NEW) |
| 4 | T6.7 | (NO file writes — verification only; runs commands, reads files, reports pass/fail) |

**Within-wave conflict scan:**
- Wave 2 (T6.2/T6.3/T6.4): file sets are disjoint (`src/observability/index.ts` ≠ `package.json` ≠ `src/reads/*.ts`) — no conflict.
- Wave 3 (T6.5/T6.6): file sets are disjoint (`src/**/*.ts` excluding `tests/` ≠ `tests/observability-logger.test.ts`) — no conflict.

**Cross-phase conflict scan (for atomic-ship awareness):**
- Phase 6 T6.5 vs Phase 5 T5.1 (catch-block routing): both touch `src/interactions/ouroFunctions.ts`. Resolved via Carve-out A (line-set partition: Phase 5 owns 7 lines; T6.5 owns the remaining ~8). The conductor's wave logic must serialize Phase 5 T5.1 vs Phase 6 T6.5 (they cannot run as concurrent agents on the same file). The atomic-ship contract permits both edits to land in one commit but not in one agent invocation.
- Phase 6 T6.5 vs Phase 3 T3.4 (UnknownPredicateError throw): both touch `src/guard/guardUtils.ts:76-79`. Resolved via Carve-out B (Phase 3 owns the deletion; T6.5 leaves it alone if Phase 3 has landed first OR routes via getLogger if Phase 3 has not landed — Phase 3 then deletes the route call when wiring its throw). Both paths converge on zero matches. Same conductor-serialization note applies.
- Phase 6 T6.3 vs Phase 7 T7.1 (package.json): both modify `package.json`. Phase 6 adds `./observability` subpath; Phase 7 bumps version 2.2.0 → 2.3.0. Resolved by Phase 7 reading the post-Phase-6 file and editing only the `version` field.
- No other cross-phase file conflicts.

**Conflicts detected and resolved at planning time:** 3 (all cross-phase, all resolved via documented carve-outs). 0 within-phase conflicts.

Phase 6: 7 tasks, 4 waves | conflicts: 3 | research: ok | fragmentation: ok
