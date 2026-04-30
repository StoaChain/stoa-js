# Phase 2: Type-Level Regression Lock -- Tasks

<!-- Pass 2 output: 5 tasks across 2 waves.
     Researcher surfaced TWO BLOCKING findings that reshape this phase:
       (i)  IKadenaKeypair is NOT re-exported from the 4 interactions/* subpaths after Phase 1
            (their `import type { IKadenaKeypair } from "../signing"` is consumption-only).
            T2.1 therefore CANNOT use direct type imports from those subpaths -- it must
            assert assignability THROUGH the call surface using `Parameters<typeof fn>[N]`.
       (ii) `tsconfig.json:23` restricts include to `src/**/*.ts`, so `npm run typecheck`
            does NOT typecheck tests/. New T2.0 enables vitest's `test.typecheck` mode
            (3-line vitest.config.ts edit) so the regression lock actually fires under
            `npm test`. T2.3 remains for src/ correctness as a weaker secondary gate. -->

## Goal

Lock the Phase-1 `IKadenaKeypair` consolidation in place by adding a single new test file `tests/types.test.ts` that asserts cross-subpath type assignability of `IKadenaKeypair` resolved from each of the four previously-duplicating `interactions/*` subpaths (via their public function call surfaces) PLUS the canonical `signing` subpath (via direct type import). The assertions exercise (a) the `seedType: "foreign"` literal -- which the now-deleted duplicates lacked -- and (b) the `encryptedSecretKey: unknown` typing -- which the duplicates weakened to `any`. Together these are the two attributes that distinguished the canonical from the deleted duplicates, so the test file functions as a build-breaking regression lock: any future change that reintroduces a drifted local `interface IKadenaKeypair` (omitting `"foreign"` or weakening to `any`) on any of the five subpaths will fail to typecheck. The phase modifies one config file (`vitest.config.ts`, to enable typecheck) and adds one new test file (`tests/types.test.ts`); zero source-file edits in `src/`.

## Phase Context

- **Prerequisite:** Phase 1's TASKS.md at `D:/_Claude/OuronetCore/.bee/specs/2026-04-30-consolidate-ikadenakeypair/phases/01-type-consolidation/TASKS.md`. After Phase 1 lands, `IKadenaKeypair` resolved from `../signing` and from any function-parameter slot in the four `interactions/*` subpaths refers to the canonical declaration at `src/signing/types.ts:22-30`.
- **Files written by this phase:**
  1. `D:/_Claude/OuronetCore/vitest.config.ts` -- 3-line edit to enable `test.typecheck` (T2.0).
  2. `D:/_Claude/OuronetCore/tests/types.test.ts` -- new file (T2.1).
  No edits to `src/`. No edits to `tests/strategy.test.ts` (read-only convention reference per spec).
- **Test framework:** vitest v4.1.0. Existing test convention in `tests/strategy.test.ts:21` uses `import { describe, it, expect } from "vitest"`. Type-level assertions need no runtime body; minimal `it("compiles", () => { /* type-only */ })` blocks are idiomatic and keep vitest collection happy.
- **Regression-lock semantics:** TypeScript's compile-time typechecking IS the regression lock. With T2.0 enabling vitest's `test.typecheck` mode, `npm test` becomes the load-bearing CI gate (T2.2). T2.3 (`npm run typecheck`) remains as a secondary gate covering `src/` correctness only. A drifted local `IKadenaKeypair` (without `"foreign"`, or with `encryptedSecretKey: any`) on any of the five subpaths would cause `npm test` to fail under vitest's typecheck mode.
- **Requirement coverage:** REQ-13 only -- the sole functional requirement assigned to Phase 2 in `ROADMAP.md`. REQ-01 through REQ-12 are Phase-1 territory and are NOT re-asserted here.

## Wave Notes (cross-task findings the implementer/reviewer must know)

1. **Assertion idiom for the 4 interactions subpaths is `Parameters<typeof fn>[N]`, NOT direct type import.** After Phase 1, `IKadenaKeypair` is consumed but NOT re-exported from `src/interactions/{activate,dex,kpay,coil}Functions.ts`. `import type { IKadenaKeypair } from "../src/interactions/activateFunctions"` would fail with `TS2305: has no exported member 'IKadenaKeypair'`. The fix: import a real exported function from each subpath and assert assignability against its parameter slot, e.g. `const _check_activate: Parameters<typeof activateAccount>[N] = FIXTURE_WITH_FOREIGN`. This exercises the actual public API surface (a STRONGER test than direct type alias import). Only the canonical `../src/signing` import uses the direct `import type { IKadenaKeypair }` form, since `src/signing/index.ts:16` re-exports `*` from `./types`.

2. **T2.0's vitest.config.ts edit is what makes the regression lock fire.** The root `tsconfig.json:23` restricts include to `src/**/*.ts`, so `npm run typecheck` (= `tsc --noEmit`) does NOT typecheck `tests/types.test.ts`. Without T2.0, T2.1's assertions would compile-fail silently and T2.2 would report a false pass. T2.0 enables `test.typecheck = { enabled: true }` in `vitest.config.ts`; from that point forward, `npm test` runs vitest's internal `tsc` pass against the test files and the regression lock becomes load-bearing. T2.3 (`npm run typecheck` against root tsconfig) is retained as a weaker secondary gate that still verifies `src/` correctness but is NOT the primary regression-lock gate for this phase.

## Wave 1 (parallel -- no dependencies)

- [x] T2.0 | Enable vitest's typecheck mode by editing `vitest.config.ts` to add `test.typecheck = { enabled: true }` so the new `tests/types.test.ts` is actually subject to compile-time type checking when `npm test` runs | bee-implementer
  - requirements: [REQ-13]
  - acceptance:
    - File `D:/_Claude/OuronetCore/vitest.config.ts` is modified.
    - The `test` config block in `vitest.config.ts` contains a `typecheck` sub-object with BOTH `enabled: true` AND an `include` array that covers `tests/types.test.ts`. **CRITICAL:** vitest v4's `test.typecheck.include` defaults to `["**/*.{test,spec}-d.?(c|m)[jt]s?(x)"]` (the `-d` suffix convention for type-test files), NOT the value of `test.include`. Without an explicit `typecheck.include` override, the typecheck pass collects ZERO files and `tests/types.test.ts` is silently skipped — the regression lock would be a no-op.
    - **Scope-narrowing requirement (avoid retroactive typecheck of 12 pre-existing test files):** the `typecheck.include` glob MUST be narrowed to ONLY the new file: `["tests/types.test.ts"]`. The 12 pre-existing test files (`tests/cfm-builders.test.ts`, `codex-codec.test.ts`, ..., `strategy.test.ts`) have NEVER been typechecked under `tsc --noEmit` because `tsconfig.json:23` excludes `tests/`. Enabling vitest typecheck over `tests/**/*.test.ts` would retroactively typecheck ALL 13 files; any latent type error in any of the 12 pre-existing files would surface as a Phase-2 commit blocker appearing unrelated to the IKadenaKeypair consolidation. Narrowing `typecheck.include` to `["tests/types.test.ts"]` exactly scopes the regression lock to the new file only. (Future specs can broaden the glob when the 12 existing files are confirmed type-clean — that broadening is OUT OF SCOPE for this spec.) Verify: `grep -c 'typecheck' vitest.config.ts` returns at least `1`; `grep -c 'enabled: true' vitest.config.ts` returns at least `1`; `grep -c '"tests/types.test.ts"' vitest.config.ts` returns at least `1`; `grep -c '"tests/\*\*/\*.test.ts"' vitest.config.ts` does NOT count the typecheck.include line (only the existing `test.include` line).
    - The pre-existing `include`, `globals`, and resolve `alias` settings remain intact (no accidental config regressions). Verify by inspection of the diff: only the `typecheck` key is added; nothing else changes.
    - `npm test` exits 0 against the current (post-Phase-1) repo state with the new config (i.e. enabling typecheck does not regress any existing test). The implementer pastes the vitest stdout block into notes as evidence.
    - No edits to `src/`. No edits to `tsconfig.json`, `tsconfig.build.json`, or `package.json`.
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/vitest.config.ts`.
    - Reference: `vitest.config.ts:8` for the existing `include` glob and `vitest.config.ts:11-13` for the `@/` resolve alias.
    - Vitest v4 docs (Context7 [vitest /vitest/dev]): `test.typecheck.enabled` boolean enables `tsc`-driven type checking of test files during `vitest run`. Default `tsconfig` is the root `tsconfig.json`; vitest re-uses it but adds the matched test files to its in-memory program.
    - Cross-task: T2.1 depends on this gate being enabled for its assertions to actually fire under `npm test` (T2.2). T2.0 and T2.1 are file-disjoint and run in parallel within Wave 1.
  - research:
    - Current config shape: [CITED] `vitest.config.ts:1-15` defines `defineConfig({ test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts"], globals: true }, resolve: { alias: { "@/": "/src/" } } })` (or equivalent). The edit adds a `typecheck: { enabled: true }` field inside the `test` block.
    - Vitest typecheck behaviour: [VERIFIED] vitest v4 (`package.json:105` -- `"vitest": "^4.1.0"`) supports `test.typecheck.enabled`. When true, `vitest run` invokes an internal `tsc --noEmit` pass against test files (using the project's root `tsconfig.json` by default) and surfaces type errors as test failures. Reference: T2.3's research note in the pre-wave version cited this option; this task elevates it from "mitigation candidate" to the chosen approach.
    - Why this approach over alternatives: [ASSUMED] Compared to (b) adding a separate `tsconfig.tests.json` + new npm script, approach (a) is a 3-line edit, requires no new script, and consolidates the regression lock under the existing `npm test` gate that CI already runs. The runtime cost of vitest's typecheck pass is ~1-3s on this codebase size; acceptable.
    - tsconfig include scope concern: [VERIFIED] vitest's typecheck mode does NOT itself respect the root `tsconfig.json:23` `include` array for the test files it picks up via its own `typecheck.include` glob -- it adds them to the `tsc` program directly. So even though `tsconfig.json:23` excludes `tests/`, vitest's typecheck pass DOES type-check `tests/types.test.ts` once enabled AND the `typecheck.include` glob is explicitly set to cover it.
    - **`typecheck.include` default — CRITICAL:** [VERIFIED via Vitest docs `https://vitest.dev/config/#typecheck-include`] vitest v4's `test.typecheck.include` defaults to `["**/*.{test,spec}-d.?(c|m)[jt]s?(x)"]` (the `-d` suffix convention for type-test files), which does NOT match `tests/types.test.ts`. The plan therefore MUST set `typecheck.include` explicitly. Recommended config (single-file scope per the F-XPHASE-001 cross-plan finding — see acceptance bullet at line 42; do NOT use the broad `tests/**/*.test.ts` glob here, which would retroactively typecheck the 12 pre-existing test files):
      ```ts
      test: {
        // ... existing globals/include/etc.
        typecheck: { enabled: true, include: ["tests/types.test.ts"] },
      }
      ```
      Without the `include` override, T2.2's typecheck pass collects zero files and reports vacuous "0 errors" — the regression lock would silently no-op. Without the SINGLE-FILE narrowing, vitest would retroactively typecheck the 12 pre-existing test files (cfm-builders, codex-codec, dalos-integration, encryption-upgrade, encryption, gas, guard, network, pact-format, signing, smart-account-auth, strategy) which have never been typechecked under `tsc --noEmit`; any latent type error in those files would surface as Phase 2 commit blockers appearing unrelated to IKadenaKeypair consolidation.
    - Predicted output on success: [ASSUMED] `npm test` reports the same 320 pre-existing tests passing, plus the new `tests/types.test.ts` collected; the typecheck pass appears as an additional vitest section (typically prefixed `[typecheck]` or similar) reporting zero errors.
  - notes:

- [x] T2.1 | Create `tests/types.test.ts` with 5 type-level assignability assertion sites: ONE direct-type-import assertion against `../src/signing` (canonical) and FOUR `Parameters<typeof fn>[N]` assertions against an exported function from each of the four `interactions/*` subpaths -- exercising both the `seedType: "foreign"` literal and the `encryptedSecretKey: unknown` typing | bee-implementer
  - requirements: [REQ-13]
  - acceptance:
    - File `D:/_Claude/OuronetCore/tests/types.test.ts` exists.
    - File contains exactly ONE `import type { IKadenaKeypair }` line sourced from `../src/signing`. Verify: `grep -c 'import type { IKadenaKeypair' tests/types.test.ts` returns `1` and `grep -c 'from "../src/signing"' tests/types.test.ts` returns `1`.
    - File contains FOUR value imports of one exported function each from the four `interactions/*` subpaths:
      - `grep -c 'from "../src/interactions/activateFunctions"' tests/types.test.ts` returns `1`
      - `grep -c 'from "../src/interactions/dexFunctions"' tests/types.test.ts` returns `1`
      - `grep -c 'from "../src/interactions/kpayFunctions"' tests/types.test.ts` returns `1`
      - `grep -c 'from "../src/interactions/coilFunctions"' tests/types.test.ts` returns `1`
      Each imports an existing exported function. **CRITICAL DISTINCTION:** Two of the four subpaths have `IKadenaKeypair` as a DIRECT positional parameter; two have it NESTED inside a parameter-struct interface. Use the assertion shape that matches:
      - **Direct-positional (`Parameters<typeof fn>[N]` works directly):**
        - `kpayFunctions.ts:160-167` → `kpayBuy` exports an `IKadenaKeypair` at parameter index `4` (verify exact index against the file). Idiom: `Parameters<typeof kpayBuy>[4]`.
        - `coilFunctions.ts:169-173` → `coilTokensGeneric` exports an `IKadenaKeypair` at parameter index `1` (verify exact index). Idiom: `Parameters<typeof coilTokensGeneric>[1]`.
      - **Struct-nested (`Parameters<typeof fn>[0]["fieldName"]` required):**
        - `activateFunctions.ts:115-131` → `executeDeployStandardAccount` takes a single `params: DeployStandardAccountParams`; `IKadenaKeypair` is the `gasPayerKey` field of that interface. Idiom: `Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]`.
        - `dexFunctions.ts:218-222` (or `:1133-1137`) → an `executeSwap`-family function takes a `SwapExecutionParams` / `SmartSwapExecutionParams` struct; `IKadenaKeypair` is the `kadenaKeypair` field. Idiom: `Parameters<typeof executeSwap>[0]["kadenaKeypair"]` (verify exact field name and exported function name against the file).
      Implementer chooses one canonical export per subpath; whichever one is selected must already be exported and stably typed. The grep `grep -cE 'Parameters<typeof \\w+>\\[\\d+\\](\\["[^"]+"\\])?'` returning `4` accepts both shapes.
    - File contains a fixture object literal carrying the canonical-only attributes: `seedType: "foreign"` literal AND `encryptedSecretKey` typed as `unknown` (NOT cast to `any`). Verify:
      - `grep -c 'seedType: "foreign"' tests/types.test.ts` returns at least `1`.
      - `grep -c 'encryptedSecretKey' tests/types.test.ts` returns at least `1`.
      - `grep -c ': unknown' tests/types.test.ts` returns at least `1`.
    - File contains 5 distinct typed-const assignment sites that exercise assignability of the fixture against the resolved `IKadenaKeypair`:
      1. ONE site typed directly as `IKadenaKeypair` (from the canonical `../src/signing` import).
      2. FOUR sites typed as `Parameters<typeof fn>[N]` where `fn` is the imported function and `N` is the index of the `IKadenaKeypair`-typed parameter in that function's signature.
      Verify: `grep -cE 'Parameters<typeof \w+>\[[0-9]+\](\["[^"]+"\])?' tests/types.test.ts` returns `4` (accepts both direct-positional `[N]` and struct-nested `[0]["fieldname"]` shapes). Verify: `grep -cE ':\s*IKadenaKeypair\b' tests/types.test.ts` returns at least `1` (the canonical site). Combined assertion-site count must total 5 (one canonical + four parameter-slot).
    - All 5 typed-const declarations live INSIDE an `it(...)` or `test(...)` block body so `noUnusedLocals` from `tsconfig.json:14` does not flag them (function-scope locals are exempt). Alternatively, declarations may be prefixed with `_` if at module scope, but inside-`it` is preferred.
    - File contains at least one `it(` or `test(` block. Verify: `grep -cE '\b(it|test)\(' tests/types.test.ts` returns at least `1`. Bodies may contain only the typed-const declarations -- no runtime assertions required.
    - File begins with a JSDoc block explaining: (a) this is the regression lock for the Phase-1 `IKadenaKeypair` consolidation, (b) the assertions are compile-time only and fire under vitest's `test.typecheck` mode (enabled by T2.0), (c) the four interactions subpaths use `Parameters<typeof fn>` because `IKadenaKeypair` is consumed-not-re-exported there, (d) reintroducing a drifted local `IKadenaKeypair` on any of the five subpaths (omitting `"foreign"` or weakening `encryptedSecretKey` to `any`) will cause this file to fail to typecheck.
    - File uses `import { describe, it, expect } from "vitest";` (mirroring `tests/strategy.test.ts:21`).
    - No edits to any file under `D:/_Claude/OuronetCore/src/`. No edits to `tests/strategy.test.ts` or any other pre-existing test file. Verify: `git status` shows only `tests/types.test.ts` (added) and `vitest.config.ts` (modified by T2.0) in the working tree.
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/tests/types.test.ts`.
    - Reference patterns (read-only):
      - `tests/strategy.test.ts:21,25-29,46-48` -- vitest import line, type-only import from `../src/signing/types`, typed-const fixture pattern with `seedType` literal.
      - `src/signing/types.ts:22-30` -- canonical `IKadenaKeypair` declaration; fixture must satisfy this shape.
      - `src/interactions/activateFunctions.ts:124,126,206` -- example function with `kadenaAccount: IKadenaKeypair` parameter; pick one export name from this file (e.g. the function declared at line 124's container, see file).
      - `src/interactions/dexFunctions.ts:1136-1137` -- same pattern.
      - `src/interactions/kpayFunctions.ts:165,166` -- same pattern.
      - `src/interactions/coilFunctions.ts:171,172,261,262,282,283,303,304` -- same pattern.
    - Cross-task: T2.0 enables vitest typecheck mode; without it, T2.1's compile-time assertions would not fire under `npm test`. T2.0 and T2.1 are file-disjoint and run in parallel.
  - research:
    - Test-file convention: [CITED] `tests/strategy.test.ts:21` uses `import { describe, it, expect } from "vitest";` -- mirror exactly. `tests/codex-codec.test.ts:12` and `tests/encryption.test.ts:17` use the identical line.
    - Test-file path convention: [CITED] All `tests/*.test.ts` files use relative `../src/...` paths, never the `@/` alias. Examples: `tests/strategy.test.ts:24-29`, `tests/encryption.test.ts:18`, `tests/gas.test.ts:19`, `tests/pact-format.test.ts:18`. Pin to `../src/...` for consistency.
    - Pre-existing `IKadenaKeypair` import precedent: [CITED] `tests/strategy.test.ts:25-29` already does `import type { IKadenaKeypair, KeyResolver, PactClient } from "../src/signing/types";` and constructs `const KP_A: IKadenaKeypair = { publicKey: PUB_A, privateKey: PRIV_A, seedType: "koala" };` at line 46-48. Same shape pattern works for T2.1 with `seedType: "foreign"` and an `encryptedSecretKey: unknown` field added.
    - **Critical export-visibility finding (REVISED IDIOM):** [CITED] After Phase 1, the four `interactions/*` subpaths have `import type { IKadenaKeypair } from "../signing";` for in-file type use ONLY -- TypeScript does NOT re-export type-only imports. Direct `import type { IKadenaKeypair } from "../src/interactions/activateFunctions"` fails with `TS2305: has no exported member 'IKadenaKeypair'`. **Resolution: use `Parameters<typeof fn>[N]` against an exported function whose parameter is typed `IKadenaKeypair`.** This exercises the call surface end-to-end -- a STRONGER assertion than direct type import, because if a future change reintroduces a drifted local `IKadenaKeypair` and the function's parameter type still resolves to it, the typed-const assignment of `seedType: "foreign"` fails. The four subpaths each have multiple exported functions with `kadenaAccount: IKadenaKeypair` parameters (see context file paths).
    - Canonical site uses direct type import: [CITED] `src/signing/index.ts:16` -- `export * from "./types"` re-exports `IKadenaKeypair`. So `import type { IKadenaKeypair } from "../src/signing"` resolves correctly. The canonical assertion site uses this directly: `const _check_signing: IKadenaKeypair = FIXTURE`.
    - Type-level assertion idiom (chosen): [VERIFIED] Typed-const inside `it(...)` body. Pure compile-time assignability via assignment; failure surfaces as a `tsc` error directly on the offending field. Considered alternatives: (i) `expectTypeOf<X>().toMatchTypeOf<Y>()` -- vitest v4 supports this but requires more boilerplate; (ii) `satisfies` operator -- works but less explicit about which subpath the assertion targets.
    - `noUnusedLocals` interaction: [CITED] `tsconfig.json:14` enables `noUnusedLocals`. Function-body locals are exempt; place all 5 typed-const declarations inside the `it(...)` body. Underscore prefix (`_check_*`) is an additional belt-and-braces measure if any future refactor moves them to module scope.
    - Suggested fixture and assertion shape (uses REAL exported function names from each subpath; verify each via grep against the post-Phase-1 source before finalising): [VERIFIED]
      ```ts
      import { describe, it } from "vitest";
      import type { IKadenaKeypair } from "../src/signing";
      import { executeDeployStandardAccount } from "../src/interactions/activateFunctions";
      // Pick a real executeSwap-family export from dexFunctions; verify field name (likely "kadenaKeypair") via grep against SmartSwapExecutionParams interface
      import { executeSmartSwapWithSlippage } from "../src/interactions/dexFunctions";
      import { kpayBuy } from "../src/interactions/kpayFunctions";
      import { coilTokensGeneric } from "../src/interactions/coilFunctions";

      const FIXTURE = {
        publicKey: "deadbeef",
        privateKey: "00ff",
        seedType: "foreign" as const,
        encryptedSecretKey: undefined as unknown,
      };

      describe("IKadenaKeypair regression lock", () => {
        it("compile-time assignability across all 5 subpaths", () => {
          const _check_signing:  IKadenaKeypair                                                          = FIXTURE;
          // Struct-nested: activateFunctions takes DeployStandardAccountParams, IKadenaKeypair lives at .gasPayerKey
          const _check_activate: Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]       = FIXTURE;
          // Struct-nested: dexFunctions takes SmartSwapExecutionParams, IKadenaKeypair lives at .kadenaKeypair (verify field name)
          const _check_dex:      Parameters<typeof executeSmartSwapWithSlippage>[0]["kadenaKeypair"]     = FIXTURE;
          // Direct-positional: kpayBuy takes IKadenaKeypair at parameter index 4 (verify exact index)
          const _check_kpay:     Parameters<typeof kpayBuy>[4]                                           = FIXTURE;
          // Direct-positional: coilTokensGeneric takes IKadenaKeypair at parameter index 1 (verify exact index)
          const _check_coil:     Parameters<typeof coilTokensGeneric>[1]                                 = FIXTURE;
        });
      });
      ```
      Implementer MUST verify each function name and index/field name against the post-Phase-1 source before finalising — line numbers cited in the candidate block above (T2.1 acceptance) are the authoritative starting points. The `_check_dex` field name `"kadenaKeypair"` is the most likely candidate per the SmartSwapExecutionParams interface — confirm by grepping `dexFunctions.ts:218-222` or `:1133-1137` for the `IKadenaKeypair` field name.
    - Vitest collection block: [CITED] `tests/strategy.test.ts:106-200` shows the standard `describe(...) { it(...) }` pattern. One `it(...)` block satisfies the collection requirement; vitest reports it as a passing test.
  - notes:

## Wave 2 (depends on Wave 1)

- [x] T2.2 | Quality gate: run `npm test` and confirm (a) all pre-existing 320 tests still pass, (b) the new `tests/types.test.ts` collects and passes, AND (c) vitest's typecheck pass (enabled by T2.0) reports zero errors against the new file -- making this command the load-bearing regression-lock CI gate | bee-implementer | needs: T2.0, T2.1
  - requirements: [REQ-13]
  - acceptance:
    - `npm test` exits with code `0`.
    - The vitest output shows `tests/types.test.ts` collected and passing.
    - The vitest output includes a typecheck section (typically labelled `[typecheck]` or equivalent in vitest v4 output) reporting zero errors. Verify: the output does NOT contain `error TS` or `Type '"foreign"' is not assignable` lines.
    - **Positive proof of typecheck visitation (CRITICAL — guards against silent zero-files-collected false-pass):** vitest v4's default reporter prefixes typechecked test files with a literal ` TS ` label (verified via `node_modules/vitest/dist/chunks/index.UpGiHP7g.js:2349,3009` — `c.bgBlue(c.bold(" TS "))`; color codes strip when piped/redirected). The grep targets that label adjacent to the file path. Verify: `npm test 2>&1 | tee /tmp/vitest.log; grep -E '\bTS\b.*tests/types\.test\.ts' /tmp/vitest.log` returns at least 1 line. **Tolerant fallback** (in case the per-file label format changes in a future vitest minor): `grep 'tests/types.test.ts' /tmp/vitest.log` returns ≥1 AND `grep 'typecheck' /tmp/vitest.log` returns ≥1 (the Duration summary line always contains the word `typecheck` when typecheck is enabled). The implementer pastes the matching line(s) into notes as evidence. Do NOT use the regex pattern `[typecheck]` or `(typecheck)` next to the file path — vitest v4 does not emit those labels (the literal word `typecheck` only appears in the Duration summary line).
    - All 320 pre-existing test cases continue to pass -- zero new failures, zero newly-skipped tests vs. the post-Phase-1 baseline.
    - The implementer pastes the actual vitest stdout AND stderr blocks into the task notes as evidence (per R8).
    - Run from repo root: `D:/_Claude/OuronetCore/`. Command resolves to `vitest run --passWithNoTests` per `package.json:79`.
  - context:
    - Files owned: none (read-only command runner).
    - Cross-task dependencies: T2.0 (vitest config edit makes typecheck fire) AND T2.1 (creates the file being typechecked). Both must land before this gate runs.
    - Reference: `package.json:79` defines the script.
  - research:
    - Command: [CITED] `package.json:79` -- `"test": "vitest run --passWithNoTests"`. Exits 0 on pass, non-zero on fail.
    - Collection pattern: [CITED] `vitest.config.ts:8` -- `include: ["src/**/*.test.ts", "tests/**/*.test.ts"]`. The new file matches the second glob and is collected automatically.
    - Vitest typecheck pass behaviour: [VERIFIED] With T2.0's `test.typecheck.enabled = true`, vitest runs an internal `tsc --noEmit` pass against the test files in its include glob. Errors surface as test-runner failures with file:line annotations. **This is what makes T2.2 the load-bearing regression-lock gate -- without T2.0, vitest's esbuild transform strips types without checking.**
    - Predicted outcome: [ASSUMED] 320 pre-existing tests + 1 new `it(...)` block from T2.1 = 321 passing, plus the typecheck pass reporting zero errors. The exact vitest output format depends on v4 configuration; key signal is the absence of `error TS` lines and exit code 0.
    - Test-file count baseline: [CITED] `Glob tests/**/*.test.ts` returns 12 files pre-Phase-2. After T2.1, count becomes 13.
    - Failure-mode reference: [ASSUMED] If the regression lock fires (e.g. T2.1's file mistakenly imports from a subpath that doesn't re-export `IKadenaKeypair`), the typecheck section reports `TS2305: Module '...' has no exported member 'IKadenaKeypair'`. If a future change reintroduces a drifted local (the actual lock target), the typecheck section reports `TS2322: Type '"foreign"' is not assignable to type '"koala" | "chainweaver" | "eckowallet"'`. Both shapes cause `npm test` to exit non-zero.
  - notes:

- [x] T2.3 | Quality gate: run `npm run typecheck` and confirm `tsc --noEmit` reports zero errors against `src/` -- a secondary gate verifying that Phase 1's source-side consolidation remains internally consistent (note: this gate does NOT typecheck `tests/types.test.ts` because `tsconfig.json:23` includes only `src/`; T2.2 is the test-file gate) | bee-implementer | needs: T2.0, T2.1
  - requirements: [REQ-13]
  - acceptance:
    - `npm run typecheck` exits with code `0`.
    - The output shows zero TypeScript errors anywhere under `src/`.
    - The implementer pastes the actual `tsc` output block (or "no output" + exit code) into the task notes as evidence (per R8).
    - Run from repo root: `D:/_Claude/OuronetCore/`. Command resolves to `tsc --noEmit` per `package.json:78`.
    - **Note in task notes:** This gate covers `src/` only (per `tsconfig.json:23` include scope). The test file `tests/types.test.ts` is checked by T2.2's vitest typecheck pass, not by this gate. The two gates together cover the full surface: T2.3 = `src/`, T2.2 = `tests/` + runtime.
  - context:
    - Files owned: none (read-only command runner).
    - Cross-task dependencies: T2.0 (config) AND T2.1 (file existence) -- T2.1 indirectly because T2.1's compile errors, if any, would surface only in T2.2 (vitest), but a workspace-wide `tsc` invocation in some configurations can still pick them up; safer to wait for both Wave 1 tasks.
    - Reference: `package.json:78` defines the script; `tsconfig.json:11-23` defines the strict flags and include scope.
  - research:
    - Command: [CITED] `package.json:78` -- `"typecheck": "tsc --noEmit"`. No `-p` flag; uses root `tsconfig.json`.
    - Include scope: [CITED] `tsconfig.json:23` -- `"include": ["src/**/*.ts"]`. `tsc --noEmit` does NOT visit `tests/` directly. T2.3 verifies `src/` correctness (Phase 1's edits) and Phase 1 should already make this pass; T2.3 is a sanity-check that no Phase-2-side change leaked into `src/`.
    - Build-config corroboration: [CITED] `tsconfig.build.json:13` -- `"exclude": ["node_modules", "dist", "src/**/*.test.ts", "tests/**"]`. Build pipeline keeps `tests/` out; T2.3 inherits the same scope behaviour from the root config.
    - Why retain T2.3 at all: [ASSUMED] T2.2 (vitest with typecheck) is the load-bearing gate for the regression lock against `tests/types.test.ts`. T2.3 is retained because (i) it is the canonical "is `src/` typesafe" CI gate and any project ought to keep running it, (ii) it executes much faster than `npm test` (1-2s vs 10-15s) and provides a quick smoke-check, (iii) it would catch any accidental edit to `src/` (which Phase 2 forbids). Cost of keeping it: zero. Removing it would weaken the workflow.
    - Strict flags: [CITED] `tsconfig.json:11-15` enables `strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`. `src/` is expected to satisfy all of these post-Phase-1.
    - Predicted outcome: [ASSUMED] `tsc --noEmit` produces no output and exits 0. If it errors, the failure is a Phase-1 regression -- not a Phase-2 issue -- and should be triaged back to Phase 1.
  - notes:

- [x] T2.4 | Document the manual regression-lock sanity-check procedure in the task notes (and optionally execute it) -- temporarily reintroduce a drifted local `interface IKadenaKeypair` without `"foreign"` on one of the four `interactions/*` subpaths, confirm `npm test` (which now includes vitest's typecheck pass per T2.0) fails on `tests/types.test.ts`, then revert | bee-implementer | needs: T2.0, T2.1
  - requirements: [REQ-13]
  - acceptance:
    - The task notes section contains a step-by-step manual procedure that a reviewer can follow to verify the regression lock is load-bearing. Procedure must include:
      0. **Safety guidance (MUST appear at the top of the procedure):**
         (a) Run the experiment from a working tree where T2.0 (`vitest.config.ts`) and T2.1 (`tests/types.test.ts`) are EITHER fully committed OR fully stashed via `git stash`. Otherwise step 5's revert path is at risk.
         (b) Use ONLY `git checkout -- <file>` for the revert (step 5). Do NOT use `git reset --hard` — that would also clobber any uncommitted T2.0/T2.1 edits and any uncommitted task-notes drafts.
         (c) Do NOT `git add` or `git commit` the transient drift introduced in steps 2-3. The experiment is purely local-working-tree; nothing from this experiment lands in version control.
      1. Pick one of the four `interactions/*` subpaths (recommended: `src/interactions/activateFunctions.ts` -- smallest in-file usage footprint per Phase 1 research).
      2. Temporarily add an `export interface IKadenaKeypair` declaration to that file matching the OLD drifted shape -- specifically, `seedType` typed as `"koala" | "chainweaver" | "eckowallet"` (NO `"foreign"`) and `encryptedSecretKey?: any`.
      3. Comment out OR delete the `import type { IKadenaKeypair } from "../signing";` line that Phase 1 added near the top of that file -- otherwise TS errors on a duplicate-binding clash before reaching the assignability assertion (`Cannot redeclare exported variable IKadenaKeypair`).
      4. Run `npm test` and confirm it FAILS with a vitest typecheck error pointing at the `_check_activate: Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"] = FIXTURE` assignment site in `tests/types.test.ts` (or whichever real exported function name the implementer selected for the activateFunctions site in T2.1 — see T2.1 acceptance line 79). Expected error shape: `TS2322: Type '"foreign"' is not assignable to type '"koala" | "chainweaver" | "eckowallet" | undefined'`.
      5. `git checkout -- src/interactions/activateFunctions.ts` to revert the experiment.
      6. Re-run `npm test` and confirm it now passes.
    - Optional execution: if the implementer chooses to actually run the experiment, paste the failing `npm test` output (from step 4) AND the passing output after revert (from step 6) into the notes as evidence.
    - If NOT executed, the procedure is still documented in the notes -- this is the formal hand-off to a reviewer to perform during the spec's review pass.
    - Working tree must be clean after this task (modulo `tests/types.test.ts` from T2.1 and `vitest.config.ts` from T2.0).
    - DO NOT permanently modify any source file under `src/` -- the experiment is transient and its only output is the documented procedure in the notes.
  - context:
    - Files owned: none for permanent edits (the optional experiment is fully reverted).
    - Cross-task dependencies: T2.0 (typecheck mode enabled) AND T2.1 (test file exists).
    - Reference: `src/interactions/activateFunctions.ts:27-33` (pre-Phase-1 declaration shape, derived from Phase 1 research notes -- now removed by Phase 1; the experiment reintroduces it).
  - research:
    - Procedure category: [ASSUMED] "Trust-but-verify" sanity check, not part of CI. Optional execution; documentation is mandatory. Reviewer hand-off path.
    - Recommended subpath: [CITED] `src/interactions/activateFunctions.ts` -- smallest in-file usage footprint (3 type-position usages at `activateFunctions.ts:124,126,206` per Phase 1 T1.1 research). Quickest to revert; least likely to surface unrelated errors.
    - Drift-shape paste-fragment (exact text for the procedure): [CITED] derived from the pre-Phase-1 declaration:
      ```ts
      export interface IKadenaKeypair {
        publicKey: string;
        privateKey: string;
        seedType?: "koala" | "chainweaver" | "eckowallet";
        encryptedSecretKey?: any;
        password?: string;
      }
      ```
    - Step 3 detail: [CITED] After Phase 1, `activateFunctions.ts` has `import type { IKadenaKeypair } from "../signing";` near the top (line ~13 per Phase 1 research). The experiment must comment-out OR delete that line so the new locally-declared `interface IKadenaKeypair` shadows the canonical without a duplicate-binding error.
    - **Why this procedure works under the new idiom:** [CITED] T2.1's `_check_activate` assertion uses `Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]` (struct-nested — the `IKadenaKeypair` type lives at the `gasPayerKey` field of the `DeployStandardAccountParams` interface, not as a direct positional parameter). After step 2-3 of the experiment, the local drifted `interface IKadenaKeypair` shadows the canonical, the `DeployStandardAccountParams.gasPayerKey` field type resolves to the drifted union, and the fixture's `seedType: "foreign"` fails to assign — producing the expected error.
    - Expected typecheck error: [ASSUMED]
      ```
      tests/types.test.ts:NN:NN - error TS2322: Type '{ publicKey: string; privateKey: string; seedType: "foreign"; encryptedSecretKey: unknown; }' is not assignable to type 'Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]'.
        Types of property 'seedType' are incompatible.
          Type '"foreign"' is not assignable to type '"koala" | "chainweaver" | "eckowallet" | undefined'.
      ```
    - Revert command (exact): [CITED] `git checkout -- src/interactions/activateFunctions.ts` -- single-file revert, leaves no other working-tree mutation. **Do NOT use `git reset --hard`** as an alternative; that would also wipe uncommitted T2.0/T2.1 edits and any uncommitted task-notes drafts.
    - Working-tree hygiene: [LOCKED] T2.4 MUST leave the working tree clean (modulo `tests/types.test.ts` from T2.1 and `vitest.config.ts` from T2.0). The experiment is transient.
    - CI relevance: [ASSUMED] T2.4's experiment is NOT part of CI. CI runs `npm test` (T2.2) which now includes vitest's typecheck pass -- the regression lock fires automatically there. T2.4 exists to give a human reviewer a 5-minute manual confirmation that the lock is sound.
  - notes:

## Notes for Reviewer

- Phase 2 produces ONE new file (`tests/types.test.ts`) and ONE config edit (`vitest.config.ts`). Both are visible in `git status`.
- The regression-lock gate is `npm test` (T2.2), made load-bearing by T2.0's vitest typecheck enable. `npm run typecheck` (T2.3) is a secondary gate covering `src/` only.
- The four interactions assertions use `Parameters<typeof fn>[N]` not direct `import type { IKadenaKeypair }` because Phase 1's type-only imports do not re-export. This is a STRONGER test than direct type import (it exercises the public API surface end-to-end).
- T2.4's optional experiment is the human-reviewable proof that the lock fires; either the implementer runs it and pastes evidence, or the reviewer runs it during the review pass.

Phase 2: 5 tasks, 2 waves | conflicts: 0 | research: ok | fragmentation: ok
