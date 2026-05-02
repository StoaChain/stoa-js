# Phase 2: Regression Test, Verification Gate, and v2.1.2 Release Artifacts -- Tasks

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

Lock the corrected `withFailover` behavior delivered in Phase 1 under regression test, run the full verification gate (typecheck + test + build), and produce every release artifact required for the atomic v2.1.2 commit + tag: `package.json` version bump (2.1.1 → 2.1.2), CHANGELOG entry prepended for `## 2.1.2 — 2026-05-01` citing F-BUG-001 closure, and README `## Status` block + version history updated per the locked maintenance rule. All four sub-deliverables (Phase 1 production code + this phase's regression test + version + CHANGELOG/README) ship in a single commit and a single `v2.1.2` annotated tag.

## Wave 1 (parallel -- no dependencies)

- [x] T2.1 | Add concurrent-failover regression test scenario to `tests/network.test.ts` | bee-implementer
  - requirements: [REQ-04, REQ-05]
  - acceptance:
    - A new top-level `describe("withFailover — concurrent retry race", ...)` block is added to `tests/network.test.ts`. (Auto-fix iter 1 lock per F-PAT-002: name uses em-dash subject-qualifier form matching the sibling `withFailover — primary-fallback retry` describe at line 143 and the `retryTimer unref on Node` form at line 239. Em-dash is U+2014 with single space on each side. Do NOT use `withFailover under concurrent failover` (preposition form) — that breaks the file's established describe-naming convention.) The block is placed AFTER the existing `withFailover` describe (closing brace at line 218) and BEFORE the `resetNodeFailover` describe (opening at line 220). It does not modify any pre-existing it-block or describe block.
    - The new describe contains at minimum one it-block that:
      - Constructs TWO independent `vi.fn()` mock callbacks (`fn1` and `fn2`), each chained `.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")` — mirroring the canonical mocking pattern at `tests/network.test.ts:156-166`.
      - Dispatches both invocations concurrently via `await Promise.all([withFailover(fn1), withFailover(fn2)])`.
      - Asserts that BOTH resolved values equal `"ok-on-fallback"` (or whatever literal the test author picks, used consistently across both mocks).
      - Asserts that EACH mock callback was invoked exactly twice (once on the primary that failed, once on the fallback that succeeded) — `expect(fn1).toHaveBeenCalledTimes(2)` and `expect(fn2).toHaveBeenCalledTimes(2)`. Total of four mock invocations across the two parallel calls.
      - Optionally asserts the call ordering of arguments (first call to each fn arrives with the primary base URL, second call with the fallback base URL) using `toHaveBeenNthCalledWith(1, ...)` / `toHaveBeenNthCalledWith(2, ...)`. Not strictly required by the spec but consistent with the existing `withFailover` describe's assertion style at lines 163-164.
    - Test isolation is enforced. The new describe contains either:
      - **Option 1 (afterEach hook):** An `afterEach(() => { resetNodeFailover(); })` hook that runs after every it-block in the new describe. Requires extending the vitest import at line 8 with `afterEach` (the only allowed import edit, per the rule below).
      - **Option 2 (try/finally per-test):** A per-test `try { ... } finally { resetNodeFailover(); }` wrapping the test body. Requires no import changes — mirrors the `tests/network.test.ts:247-259` precedent.
      Either approach satisfies NFR-03. Option 2 is the lower-friction default (no import change required) and mirrors the existing `retryTimer unref on Node` describe's exact cleanup pattern.
    - **Imports rule (auto-fix iter 1 lock per F-001/F-PAT-001):** The `"../src/network"` import block at lines 19-20 is NOT modified — `withFailover` and `resetNodeFailover` are already imported there. The `vitest` import at line 8 MAY be extended IF AND ONLY IF the implementer chooses the `afterEach` cleanup style (option 1 below) — in that case, append `afterEach` to the existing `import { describe, it, expect, beforeEach, vi }` line to read `import { describe, it, expect, beforeEach, afterEach, vi }`. If the implementer chooses the `try/finally` cleanup style (option 2 below), the vitest import line is also unchanged. Either path is acceptable; the import-extension is the ONLY allowed import edit and ONLY when option 1 is chosen.
    - The module-level `beforeEach(() => { setNodeConfig("node2"); })` at lines 28-30 already covers the per-test reset of the active-host slot back to node2 before each test. The new describe does not need its own `beforeEach` for this; it only needs the `afterEach` (or per-test `finally`) for the post-test reset of any concurrent-flow side effects.
    - Running `npx vitest run tests/network.test.ts` exits 0 with the new it-block passing AND all 25 pre-existing it-blocks in the file continuing to pass without modification. The total count for this file grows to ≥ 26.
    - Running the full suite `npm test` exits 0 with the project-wide test count growing by at least one (the new it-block) compared to the v2.1.1 baseline.
    - No production source file is modified by this task. Only `tests/network.test.ts` is edited.
  - context:
    - Files to read before editing:
      - `tests/network.test.ts` (full file — the only file edited; specifically lines 1-30 for the imports + module-level beforeEach, lines 142-218 for the existing withFailover describe to mirror style, lines 220-260 for the resetNodeFailover describe to ensure the new block lands BETWEEN them).
      - `src/network/nodeFailover.ts` (read-only — the post-Phase-1 corrected `withFailover` implementation; the test exercises this exact body).
    - Stack skill: `skills/stacks/typescript-library/SKILL.md` (vitest is the test runner; `vi.fn()` chained mocks; `describe`/`it`/`expect` API).
    - Spec sections: spec.md "Regression Test Coverage"; requirements.md REQ-04 and REQ-05; phases.md Phase 2 deliverables.
    - Project conventions from CLAUDE.md: tests live in `tests/` (top-level, not co-located); the test file is excluded from `dist/` via `tsconfig.build.json`. No `import type` needed — runtime values only.
  - research:
    - Pattern: [CITED] Mirror the canonical chained-mock pattern at `tests/network.test.ts:156-166` — `vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("ok-on-fallback")`, then `await withFailover(fn)`, then assertions on `toHaveBeenCalledTimes(2)` + `toHaveBeenNthCalledWith(1, NODE2_BASE_URL)` / `toHaveBeenNthCalledWith(2, NODE1_BASE_URL)`. The new test simply duplicates this for `fn1` and `fn2` and wraps both in `Promise.all`.
    - Pattern: [CITED] Local URL constants `NODE2 = "https://node2.stoachain.com"` and `NODE1 = "https://node1.stoachain.com"` are already defined at `tests/network.test.ts:24-25`. The chainweb path suffix is `/chainweb/0.0/stoa` — see lines 153, 163-164 for the exact `${NODE2}/chainweb/0.0/stoa` shape used in `toHaveBeenCalledWith`. Reuse these constants directly; do NOT redeclare.
    - Pattern: [CITED] The `try { ... } finally { ... }` per-test cleanup precedent already lives in the `retryTimer unref on Node` describe at `tests/network.test.ts:247-259` (uses `setIntervalSpy.mockRestore()` + `resetNodeFailover()` in `finally`). Either this style or a describe-level `afterEach(() => { resetNodeFailover(); })` is acceptable for the new block — both fit existing conventions.
    - Reuse: [CITED] Imports at `tests/network.test.ts:8-22` already cover everything needed: `describe`, `it`, `expect`, `beforeEach`, `vi` from vitest, plus `withFailover`, `resetNodeFailover`, `setNodeConfig`, `getCurrentNodeStatus` from `"../src/network"`. NO new imports needed. If `afterEach` is used for cleanup it must be added to the vitest import list (currently absent — only `beforeEach` is imported at line 8).
    - Reuse: [CITED] Module-level `beforeEach(() => { setNodeConfig("node2"); })` at `tests/network.test.ts:28-30` runs before EVERY test in the file (top-level describe-less hook). The new describe inherits this — no need to redeclare.
    - Context7: [ASSUMED] Context7 MCP tools not invoked in this research pass — `vi.fn()` chained mock semantics (`.mockRejectedValueOnce` / `.mockResolvedValueOnce` consume in FIFO order, queue exhausted → falls back to default mock implementation) are taken from training knowledge confirmed by the existing pattern at lines 156-166. `Promise.all` semantics for two independent vi.fn callbacks are standard Promise concurrency — both `fn(getActiveBaseUrl())` calls evaluate the URL synchronously before yielding, which is the precise race the regression test must lock down.
    - Types: N/A — no new types introduced. `withFailover<T>` signature at `src/network/nodeFailover.ts:106-108` is `(fn: (baseUrl: string) => Promise<T>) => Promise<T>`. The test infers T as string from the mock return value `"ok-on-fallback"`.
    - Approach: [CITED] No precedent for `Promise.all`-based concurrent-state-mutation tests in `tests/network.test.ts`. `Promise.all` IS used in `tests/encryption-upgrade.test.ts:92,201,211` and `tests/interactions-read-seam.test.ts:33,122,263` but ONLY for parallel-decryption / parallel-read fan-out — NOT for racing module-level state mutations. The new test will be the FIRST regression that asserts concurrent-mutation correctness in this codebase. This makes T2.1's coverage uniquely valuable — the bug Phase 1 fixes was undetectable by the existing 25 single-call tests in the file.
    - Approach: [CITED] Phase 1 production code has NOT yet landed at the time of this research pass. The current `src/network/nodeFailover.ts:120` still reads `if (isNetworkError && currentHost === PRIMARY_HOST)` (the buggy shared-state guard). The implementer of T2.1 MUST be told that the regression test will FAIL against the pre-Phase-1 code (correctly, since it's locking down a bug fix that is by design only on disk after Phase 1 lands). T2.1 runs in Wave 1 of Phase 2, AFTER Phase 1 is fully merged onto the working branch — confirm `currentHost === PRIMARY_HOST` is no longer present at line 120 before authoring the test.
    - Approach: [VERIFIED — auto-fix iter 2 lock per cross-plan CI-001] The "fail before fix" TDD red-phase verification: with the pre-Phase-1 buggy code at `src/network/nodeFailover.ts:106-127`, `Promise.all([withFailover(fn1), withFailover(fn2)])` produces this trace: BOTH fn1 and fn2 receive the primary URL synchronously at fn-entry (since `withFailover` calls `fn(getActiveBaseUrl())` synchronously before yielding, and `currentHost === PRIMARY_HOST` for both at entry). Both await the rejection. fn1's catch runs first (microtask order): guard `currentHost === PRIMARY_HOST` is TRUE → `switchToFallback()` flips `currentHost = FALLBACK_HOST` → fn1 retries on fallback URL → resolves "ok-on-fallback" (called twice total). fn2's catch runs next: guard `currentHost === PRIMARY_HOST` is now FALSE (fn1 flipped it) → falls through to `throw err` → fn2 rejects with "Failed to fetch" (called only once). Result: `Promise.all` rejects (the await throws), AND `expect(fn2).toHaveBeenCalledTimes(2)` would fail (called only once). Two independent assertion failures detect the bug. The post-fix code captures BOTH `attemptedBaseUrl` and `attemptedPrimaryBaseUrl` per invocation, so each catch decides "did I attempt the primary URL?" against locally-captured constants → both fn1 and fn2 retry → both resolve → test passes. The acceptance assertions at lines 27-28 (`toHaveBeenCalledTimes(2)` for BOTH fns) correctly capture this distinction.
  - notes:

## Wave 2 (depends on Wave 1)

- [x] T2.2 | Run full verification gate (typecheck + test + build) and report final test count | bee-implementer | needs: T2.1
  - requirements: [REQ-05]
  - acceptance:
    - `npm run typecheck` is executed and exits 0 with no new TypeScript errors. The full output is captured in the task notes (or at minimum the exit code + the trailing summary line — "Found 0 errors").
    - `npm test` (vitest run) is executed. The full output is captured in the task notes. The gate is considered PASSED if EITHER (a) the run exits 0, OR (b) the run exits non-zero with ONLY the documented pre-existing locale failure (`tests/gas.test.ts > formatMaxFee > multiplies gas price × gas limit for ANU total`) as the failing test. Any OTHER failure constitutes a gate FAIL — surface it explicitly. (Auto-fix iter 1 lock per F-002: the prior unconditional "exits 0" was incompatible with the documented Windows non-en-US locale failure; this relaxed criterion makes the gate deterministic on both Linux CI and Windows dev environments.)
    - **Test count semantics (auto-fix iter 2 lock per F-NEW-002):** Record the **PASSING** count from vitest's `Tests N passed | M failed (T)` summary line, NOT the total `T`. The v2.1.1 baseline `385` cited in CHANGELOG.md:43 and README.md:85,290 is a passing-count value. The new value MUST also be a passing-count value for direct comparison. Cite environment in the notes:
      - On **Linux CI** (en-US locale): the locale test passes; passing count = `385 + 1 (new it-block) = 386` (assuming exactly 1 new test).
      - On **Windows dev** (non-en-US locale): the locale test fails; pre-existing Windows passing count was `384` (385 baseline minus 1 locale failure); post-fix Windows passing count = `384 + 1 = 385` AND vitest exits non-zero (1 failed) — gate PASSED via path (b).
      - Notes record BOTH numbers when applicable: "Linux CI passing count: 386 (was 385 at v2.1.1). Windows dev passing count: 385 (was 384 at v2.1.1; locale failure unchanged)." The CHANGELOG cites the Linux CI number (`386`) since CI is the canonical reference environment.
    - This count is the source of truth that T2.3 consumes for the CHANGELOG `### Stats` block and the README test-count refresh.
    - `npm run build` is executed and exits 0. A clean `dist/` is produced. The notes record that the build completed without warnings or errors.
    - The pre-existing locale-related failure in `tests/gas.test.ts > formatMaxFee` (Windows non-en-US locale issue, called out in requirements.md "Technical Considerations") is NOT a blocker for this gate. If it appears in the run, the notes call it out as the known pre-existing failure unrelated to this spec, and the rest of the gate is considered satisfied. The acceptance signal is that NO NEW failures are introduced by Phase 1 + Phase 2 work — pre-existing unrelated failures remain pre-existing.
    - No source files are modified by this task. The task is verification-only.
    - The notes contain three labelled output blocks ("typecheck", "test", "build") so T2.3 and the conductor have an unambiguous record of the gate state.
  - context:
    - Files to read before running gates: none required. This task runs commands and reports results.
    - Stack skill: `skills/stacks/typescript-library/SKILL.md` (commands: `npm run typecheck`, `npm test`, `npm run build`).
    - Spec sections: spec.md "Build, Type, and Test Gates"; requirements.md REQ-05 and the implicit gate-block in NFR-01 through NFR-04; phases.md Phase 2 success criterion #2 ("Verification gates green").
    - Project conventions from CLAUDE.md: scoped testing in parallel agents — but this task IS the conductor-style full-suite gate, so it runs the FULL suite intentionally. This is an exception to the "agents run only their task's test file" rule because the gate's purpose is the project-wide green signal.
  - research:
    - Pattern: [CITED] The three gate scripts are defined verbatim in `package.json:78-80`: `"build": "tsc -p tsconfig.build.json"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run --passWithNoTests"`. Run them as `npm run typecheck`, `npm test`, `npm run build` (the test script alias is just `test`, not `test:run`). The order in the acceptance — typecheck → test → build — matches the order in `.github/workflows/ci.yml` (per CLAUDE.md "CI runs typecheck → test → build on every PR/push").
    - Pattern: [CITED] The pre-existing locale failure is at `tests/gas.test.ts:111-115`: `it("multiplies gas price × gas limit for ANU total", () => { const result = formatMaxFee(10_000, 1_000); expect(result.anu).toMatch(/10,000,000/); });`. The assertion uses regex `/10,000,000/` (en-US comma-grouped formatting) but on a Windows non-en-US locale (the developer's machine), `Intl.NumberFormat` defaults to the OS locale and produces `"10.000.000"` (period-grouped), failing the regex. This is environmental, NOT introduced by Phase 1 or Phase 2 work. Note in T2.2 output: "Pre-existing failure (locale): tests/gas.test.ts > formatMaxFee > multiplies gas price × gas limit for ANU total — Windows non-en-US locale; unrelated to F-BUG-001."
    - Reuse: [CITED] Test count baseline (v2.1.1): README states `385 tests` at `README.md:85` and `README.md:290`. CHANGELOG cites `385 tests` at `CHANGELOG.md:11,27,43`. Note that a naive line-grep of `it(` calls in `tests/` returns 370 occurrences across 18 files, but `tests/cfm-builders.test.ts:311` uses an `it.each(samples.map((fn, i) => [i, fn]))(...)` parameterized form that expands to many runtime tests — vitest reports the expanded count, not the source-line count. The authoritative number is whatever vitest's terminal summary line reports after `npm test`. Phase 1 adds zero tests (fix-only, no new it-blocks). T2.1 adds one new it-block. So the expected post-Phase-2 count is `385 + 1 = 386` — but T2.2 must record the actual vitest output, not assume.
    - Context7: [ASSUMED] Context7 not invoked. Vitest 4.1.0 (per `package.json:106`) `vitest run` writes a final summary block of the form `Test Files <N> passed | <M> failed (<total>)` and `Tests <N> passed | <M> failed (<total>)`. The "Tests" line is the count to record. Behaviour assumed from Vitest training knowledge — verifiable when the gate actually runs.
    - Types: N/A — verification task, no code authored.
    - Approach: [CITED] If the locale failure surfaces, document it as the SOLE known failure and treat the gate as PASSED for spec purposes provided no NEW failures appear. The CLAUDE.md publishing flow requires `tsc --noEmit` to pass cleanly and the full vitest run to be green BEFORE pushing the v* tag (`.github/workflows/publish.yml` re-runs the same gate). If the locale failure blocks the publish workflow on Linux CI, that is a CI-environment matter — it does not block this spec's atomic-commit deliverable because Linux CI runs in en-US locale and the regex matches. Document the local-vs-CI delta in T2.2's notes for transparency.
  - notes:

## Wave 3 (depends on Wave 2)

- [x] T2.3 | Bump package version, prepend CHANGELOG entry, update README Status + version history | bee-implementer | needs: T2.2
  - requirements: [REQ-06, REQ-07]
  - acceptance:
    - `package.json` `"version"` field is changed from `"2.1.1"` to `"2.1.2"`. No other field in `package.json` is modified. The file's trailing newline and indentation are preserved.
    - `CHANGELOG.md` has a new entry prepended at the top (immediately after the `# Changelog` header and the introductory line, BEFORE the existing `## 2.1.1 — 2026-05-01` entry). The new entry's structure mirrors the v2.1.1 single-concern patch format observed at `CHANGELOG.md:5-43`:
      - Heading: `## 2.1.2 — 2026-05-01` (em-dash, no brackets, exactly one space on each side of the em-dash — same character used in v2.1.1).
      - One-line bold lead: e.g. `**Concurrency-race correction in withFailover. No public API change.**` or equivalent single-concern phrasing.
      - A lead paragraph (3-6 lines, hard-wrapped consistent with the rest of the file) describing the race that v2.1.0's `getFailoverClient` adoption widened the blast radius for, and the per-invocation captured-base-URL correction that closes it. The paragraph cites that this is a behavior correction toward the documented contract, not a feature addition.
      - A `### Fixed` section with at minimum one bullet citing the **F-BUG-001** audit-spec closure (the audit-spec lives at `.bee/audit-specs/high-withfailover-concurrency-race.md`). The bullet describes the per-invocation `attemptedBaseUrl` capture replacing the shared-host guard at the former `src/network/nodeFailover.ts:120` site, and notes the new module-private `getPrimaryBaseUrl()` helper. No new public exports.
      - A `### Stats` section reporting: files changed (`src/network/nodeFailover.ts`, `tests/network.test.ts`, `package.json`, `CHANGELOG.md`, `README.md`), the post-fix test count (from T2.2's notes — the numeric value is consumed verbatim, e.g. `Test count: 386 (was 385 at v2.1.1)`), and the no-new-public-exports note.
    - `README.md` `## Status` block (lines 7-17 in the v2.1.1 baseline) is updated to lead with `2.1.2`. The first sentence references the v2.1.2 patch as a concurrency-race correction in `withFailover` with no public API change. The lead paragraph notes that v2.1.0's reliability hardening surface is intact and the v2.1.1 README documentation patch context still applies.
    - `README.md` version history is extended with a new v2.1.2 paragraph in the same prose style as the v2.1.0 / v2.1.1 entries currently in the file. The new paragraph summarizes the concurrency-race fix in 2-4 lines and cites F-BUG-001.
    - Test-count references in `README.md` that previously cited the v2.1.1 baseline (`385`) are refreshed to the new total recorded by T2.2. Per CHANGELOG.md:27-29 there are TWO such references in v2.1.1 (the `## Status` paragraph at `README.md:85` and the `npm test` block under `## Local development` at `README.md:290`). Both must be updated.
    - **Derived counter refresh (auto-fix iter 1 lock per F-003):** `README.md:85` also contains the derived counter `+39 new` (delta from the v2.1.0 baseline of 346: 385 − 346 = 39). When the absolute count updates from 385 to T2.2's reported value (e.g., 386), the derived counter MUST also update (e.g., 386 − 346 = 40 → "+40 new"). Specifically:
      - Run `grep -nE "[0-9]+ tests" README.md` and `grep -nE "\+[0-9]+ new" README.md` to enumerate ALL stale numerics.
      - Update each occurrence: absolute count `385 → newCount`, derived `+39 → +(newCount - 346)`.
      - The accompanying prose `up from 346 baseline; +X new tests across tests/{failover-client,timeouts,failover-submit}.test.ts and extensions to tests/{network,strategy}.test.ts` remains coherent — the new it-block in `tests/network.test.ts` is subsumed by the existing "extensions to tests/{network,strategy}.test.ts" clause.
    - If the project-wide grep against the v2.1.1 baseline finds ADDITIONAL `385` or `+39` occurrences beyond the two/one already known, those are ALSO updated. **Confirm completeness (auto-fix iter 2 lock per F-NEW-003)** with a robust word-boundary grep: `grep -nE '\b385\b|\+39\b' README.md` (or `rg -nE '\b385\b|\+39\b' README.md`). Both forms use word boundaries to avoid substring false-negatives (e.g., `3850` would not match `\b385\b`). Confirm zero matches post-edit.
    - No `src/` files are modified by this task. Only `package.json`, `CHANGELOG.md`, `README.md`.
    - After this task completes, all four sub-deliverables (Phase 1 production code already on disk + Phase 2's regression test + version bump + CHANGELOG/README) are staged-clean for the single atomic v2.1.2 commit. The implementer does NOT run `git commit` or `git tag` — those are user-controlled per Bee's no-auto-commit rule. The implementer's notes confirm the working tree state is ready for the user's `/bee:commit` invocation.
    - A simple version-parity self-check is run: `grep -m1 "^## " CHANGELOG.md` should output `## 2.1.2 — 2026-05-01`, matching the new `package.json` version. The notes record this check.
  - context:
    - Files to read before editing:
      - `package.json` (full file — the `"version"` field is the single source of truth).
      - `CHANGELOG.md:1-43` (the v2.1.1 entry — the precedent for v2.1.2's structure, tone, and section ordering).
      - `README.md` (full file — the `## Status` block at the top, the version history paragraphs that follow, and ALL `385` test-count references).
    - Files to write:
      - `package.json` (single-token edit: `"2.1.1"` → `"2.1.2"`).
      - `CHANGELOG.md` (prepend new entry at top, preserve existing entries verbatim).
      - `README.md` (Status block + version history extension + test-count refresh).
    - T2.2's notes (consumed verbatim for the post-fix test count value).
    - Stack skill: `skills/stacks/typescript-library/SKILL.md` (publishing flow: bump version + CHANGELOG, then user creates the atomic commit + tag).
    - Spec sections: spec.md "Release Documentation" and "Release Coordination"; requirements.md REQ-06 and REQ-07 + NFR-04; phases.md Phase 2 deliverables (the four sub-deliverable list).
    - Project conventions from CLAUDE.md: "Bump package.json version + add CHANGELOG.md entry" is step 1 of the publishing flow; the version-parity check between the git tag and `package.json` is load-bearing in `publish.yml`. The implementer must NOT push a tag whose number disagrees with `package.json` — but tag creation is the user's responsibility (no auto-commit), so the implementer just ensures `package.json` reads `2.1.2` and CHANGELOG leads with `2.1.2`.
  - research:
    - Pattern: [CITED] Current `package.json:3` reads `"version": "2.1.1",` exactly. Two-space indentation, trailing comma, no other quirks. The single-token edit is `"2.1.1"` → `"2.1.2"` at line 3 only. No other `2.1.1` substring appears in `package.json` (verified via Grep). Preserve the trailing newline at file end.
    - Pattern: [CITED] CHANGELOG v2.1.1 precedent at `CHANGELOG.md:5-43` — exact structure to mirror:
      - Line 5: `## 2.1.1 — 2026-05-01` (heading, em-dash U+2014, single space on each side, no brackets)
      - Line 7: `**README documentation patch. No runtime change.**` (one-line bold lead)
      - Lines 9-17: lead paragraph (9 prose lines, hard-wrapped at ~66 columns to match existing wrap)
      - Line 19: `### Fixed` section header
      - Lines 21-37: bullet list of fixes (each top-level bullet on a single line, indented continuations 2 spaces)
      - Line 39: `### Stats` section header
      - Lines 41-43: bullet list of stats (files changed, src/tests changes, test count)
      The new v2.1.2 entry must mirror this exact structure: heading → bold lead → paragraph → `### Fixed` → `### Stats`. Prepend at line 5 (immediately after the `# Changelog` header at line 1 and the intro line `All notable changes to ...` at line 3), pushing existing v2.1.1 down.
    - Pattern: [CITED] CHANGELOG v2.1.0 entry at `CHANGELOG.md:45-100+` shows the alternate "feature release" structure — `### Fixed`, `### Added (public surface)`, `### Stats`. v2.1.2 is a fix-only patch (no new public surface) so it follows the v2.1.1 single-concern shape, NOT the v2.1.0 multi-section shape.
    - Pattern: [CITED] Em-dash character used in CHANGELOG headings is U+2014 EM DASH, NOT a hyphen-minus or two hyphens. Verified at `CHANGELOG.md:5,45`. Use the same character for `## 2.1.2 — 2026-05-01`.
    - Reuse: [CITED] README `## Status` block at `README.md:7-89`. The block currently leads with `**`2.1.0` on public npmjs**` at line 9 (NOT 2.1.1 — the v2.1.1 patch was documentation-only and did NOT update the Status block lead per CHANGELOG.md:21-23 which says it leads with 2.1.0). The version-history paragraph chain runs from `**v1.3.0**` at line 24 through `**v2.1.0**` at line 71. Each prior version is a 3-7 line paragraph in the same prose style. v2.1.1 is NOT in the version history because it's the documentation patch itself. v2.1.2 needs:
      - A NEW Status lead block (replacing or augmenting line 9's `2.1.0` lead) that mentions 2.1.2 as the concurrency-race correction
      - A NEW version-history paragraph for v2.1.2 inserted after the v2.1.0 paragraph (which ends at line 89), in the same 2-4 line prose style.
    - Reuse: [CITED] Test-count `385` references in `README.md`: TWO occurrences confirmed via Grep:
      - `README.md:85` — `**385 tests** pass on every commit (up from 346 baseline; +39 new`
      - `README.md:290` — `npm test             # vitest run — 385 tests across crypto, guard, ...`
      Both must be updated to T2.2's reported new count. CHANGELOG.md also contains `385` at lines 11, 27, 43 (all inside the v2.1.1 entry — DO NOT modify these; they are historical).
    - Reuse: [CITED] Audit-spec source at `.bee/audit-specs/high-withfailover-concurrency-race.md` (verified to exist via `ls`). Cite this exact path in the F-BUG-001 bullet of the new `### Fixed` section, mirroring how prior CHANGELOG entries cite F-CORE-* audit findings (e.g., `CHANGELOG.md:58,62,72,84` cite F-CORE-002 / F-CORE-003 / F-CORE-008 / F-CORE-004 inline in bullet leads).
    - Reuse: [CITED] Version-parity discipline — CLAUDE.md "Publishing flow" section warns: "The version-parity check is load-bearing — never push a tag whose number disagrees with `package.json`." `.github/workflows/publish.yml` enforces this. The implementer's self-check (`grep -m1 "^## " CHANGELOG.md` matches `package.json` version) preempts a publish-time failure.
    - Context7: [ASSUMED] Context7 not invoked. SemVer 2.0.0 patch-bump rules (2.1.1 → 2.1.2 for backwards-compatible bug fixes, no new public API) are taken from the SemVer spec from training knowledge — verified consistent with CLAUDE.md "Strict semver. Breaking changes → major bump → consumers upgrade deliberately."
    - Types: N/A — documentation task, no code authored.
    - Approach: [CITED] Order of file edits matters only for the implementer's mental model: (a) edit `package.json` first (single-token, lowest risk), (b) prepend `CHANGELOG.md` (largest delta, mirrors v2.1.1 structure), (c) update `README.md` Status + version history + test-count refresh. After all three, run the self-check `grep` to confirm version-parity. The implementer does NOT commit or tag — per CLAUDE.md "Publishing flow" step 2, that is the user's `/bee:commit` action.
  - notes:

## Notes

Pass 1 decomposition rationale: Phase 2's work splits cleanly into three deliverables — (a) the regression test file edit, (b) the verification gate run, (c) the release-documentation file edits. Splitting them into three tasks rather than one yields:

- Clear acceptance signals per task (the SubagentStop hook validates each).
- A natural data-flow channel: T2.2's notes record the post-fix test count, which T2.3 consumes verbatim for the CHANGELOG `### Stats` block and the README test-count refresh. Bundling these into one task would force the implementer to interleave verification-and-edit cycles, with no clean checkpoint.
- Independent file ownership: T2.1 owns `tests/network.test.ts` only; T2.2 owns no files (verification-only); T2.3 owns `package.json` + `CHANGELOG.md` + `README.md`. No two tasks write the same file.

A 1-task or 2-task consolidation was considered and rejected:

- **1-task** (everything in one shot): violates the "single deliverable per task" granularity guideline; the SubagentStop hook would have to validate test-edit + gate-run + version-bump + CHANGELOG + README all at once, which conflates four distinct success signals.
- **2-task** (test + everything-else, OR test+gate vs. release-docs): either bundles the verification gate with file-editing work (which dilutes the gate's role as a separate green-light signal) or forces the release-docs task to re-run the gate to know the test count (duplicate work).

Pass 2 wave assignment: T2.1 → Wave 1 (no dependencies); T2.2 → Wave 2 (`needs: T2.1` — the gate must reflect the regression test landed on disk, otherwise the test count and full-suite green signal are stale); T2.3 → Wave 3 (`needs: T2.2` — the CHANGELOG `### Stats` block and the README test-count refresh consume T2.2's reported test count verbatim, and the version-parity self-check requires T2.2's gate to have green-lit the working tree first). Three sequential waves, each with one task. The dependency chain is genuine and load-bearing: each task consumes a concrete artifact from the prior — T2.1 produces a new it-block on disk, T2.2 produces a verified test count + gate-green signal in its notes, T2.3 consumes that count for documentation. No reordering or merging preserves correctness.

REQ coverage check (Phase 2 owns REQ-04, REQ-05, REQ-06, REQ-07):
- REQ-04 (new it-block in new describe between line 218 and 220) → T2.1.
- REQ-05 (all existing tests pass + total count grows by ≥1) → T2.1 (introduces the +1) + T2.2 (verifies the full suite stays green).
- REQ-06 (package.json bump + CHANGELOG entry) → T2.3.
- REQ-07 (README Status + version history + test-count refresh) → T2.3.

All four phase-owned requirements mapped. NFR-03 (test isolation) is enforced inside T2.1's acceptance via the `afterEach(resetNodeFailover)` requirement. NFR-04 (documentation alignment) is enforced inside T2.3's acceptance.

## Fragmentation Note

This phase ships three sequential 1-task waves (Wave 1: T2.1; Wave 2: T2.2; Wave 3: T2.3). Consolidation into fewer waves was considered and rejected because each task has a genuine sequential data-flow dependency on its predecessor that cannot be parallelized:

- **Wave 1 → Wave 2 (T2.1 → T2.2):** T2.2's full-suite gate must observe the new it-block from T2.1 already on disk. Running the gate before T2.1 lands would record a stale test count (385 instead of 386) and would not validate that the regression test passes against the post-Phase-1 production code. Merging T2.1 + T2.2 into a single task is rejected per the Pass 1 rationale (conflates the test-edit success signal with the gate-green success signal).
- **Wave 2 → Wave 3 (T2.2 → T2.3):** T2.3's CHANGELOG `### Stats` block and the README test-count refresh consume T2.2's reported test count verbatim. The version-parity self-check at the tail of T2.3 requires the gate to have already green-lit the working tree so that the v2.1.2 commit and tag the user creates afterwards via `/bee:commit` will pass `publish.yml`'s tag-vs-`package.json` parity check. Running T2.3 in parallel with T2.2 would force a guess at the test count and risk a stale CHANGELOG number.

The single-task-per-wave shape is the correct shape for this phase — the data-flow ordering is load-bearing. Average tasks/wave = 1.0, below the 2.5 consolidation target, but this is the genuine-sequential-dependency exception to the fragmentation rule.
