# Changelog: consolidate-ikadenakeypair

## consolidate-ikadenakeypair (2026-04-30)

Closes audit finding **F-CORE-001 (CRITICAL)** from the v1.6.1 audit pass — six independent declarations of `IKadenaKeypair` with subtly drifted shapes consolidated to a single canonical source plus a `@deprecated`-tagged Phase-2b copy.

Released as `@stoachain/ouronet-core@1.7.0` on the public npm registry.

### Added
- New `tests/types.test.ts` regression lock — 5 type-level assignability assertion sites (1 canonical via direct type import + 4 `Parameters<typeof fn>[N]` extractions covering both struct-nested and direct-positional shapes) that fail-compile if drifted local `IKadenaKeypair` reappears (REQ-13).
- New `tsconfig.tests.json` extending the root tsconfig with `tests/types.test.ts` added to its include — the load-bearing config that lets vitest's typecheck pass actually visit the regression-lock file (added during final-review fix; the original Phase 2 plan assumed vitest auto-included tests/, which empirical testing falsified for vitest 4.1.5).
- `vitest.config.ts` gains `test.typecheck = { enabled: true, tsconfig: "tsconfig.tests.json", include: ["tests/types.test.ts"] }` (REQ-13 infrastructure).
- `export type { IKadenaKeypair } from "../signing";` re-export added to each of the 4 affected interactions subpaths to preserve their public API surface (final-review fix for F-BUG-001 — without this, consumers importing the type from `@stoachain/ouronet-core/interactions/{activate,dex,kpay,coil}Functions` would have hit `TS2305` on upgrade).

### Changed
- `src/interactions/activateFunctions.ts` — duplicate `interface IKadenaKeypair` removed; canonical imported and re-exported via `export type` from `../signing` (REQ-01, REQ-07).
- `src/interactions/dexFunctions.ts` — same shape (REQ-02, REQ-07).
- `src/interactions/kpayFunctions.ts` — same shape (REQ-03, REQ-07).
- `src/interactions/coilFunctions.ts` — same shape PLUS the sibling non-exported `interface IOuroAccountKeypair` duplicate removed and routed to `import type { IOuroAccountKeypair } from "./ouroFunctions";` (REQ-04, REQ-05, REQ-08); ALL imports reordered into a single contiguous top-of-file block (REQ-06; resolves F-INT-011).
- `src/interactions/addLiquidityFunctions.ts:10` — single combined `import { IOuroAccountKeypair, IKadenaKeypair } from "./dexFunctions"` line split: `IOuroAccountKeypair` keeps its value-position import from `./dexFunctions` (deferred consolidation per Non-Goals), `IKadenaKeypair` moves to a type-only import from `../signing` (REQ-09; breaks the IKadenaKeypair half of the F-INT-001 circular dependency).
- `src/interactions/guardFunctions.ts:13` — value-position `import { IKadenaKeypair } from "./ouroFunctions"` switched to `import type { IKadenaKeypair } from "../signing"` (REQ-10).
- `src/interactions/wrapFunctions.ts:18` — same (REQ-11).
- `src/interactions/ouroFunctions.ts:812-818` — `@deprecated` JSDoc block added above the Phase-2b `IKadenaKeypair` declaration; declaration body itself byte-equivalent (preserves `encryptedSecretKey?: any` for backwards-compat consumers using the root barrel) (REQ-12).
- `package.json` — version bumped 1.6.1 → 1.7.0.
- Project root `CHANGELOG.md` — v1.7.0 entry written.

### Fixed
- **Phase 1 review iter 1:** Off-spec `tests/wrap-functions-import.test.ts` (4 reviewer findings converged: F-001 HIGH bug-detector, D-001 + D-002 MEDIUM pattern-reviewer same-class incompleteness, OS-001 MEDIUM plan-compliance over-scope) — file used `node:fs.readFileSync` + regex matching against source-text, a pattern not found in any of the 12 baseline test files. Deleted; test count restored from 322 to baseline 320.
- **Phase 1 review iter 1:** D-003 MEDIUM pattern-reviewer — moved `import type { IKadenaKeypair } from "../signing";` to the END of the contiguous import block in 4 files (activate, dex, addLiquidity, wrap; guard was already compliant), matching the pensionFunctions:12 / urStoaFunctions:20 precedent.
- **Phase 2 review iter 1:** CRITICAL regression-lock failure caught by T2.4 manual experiment — vitest 4.1.5's typecheck mode does NOT auto-add test files to its tsc program (root cause traced to `node_modules/vitest/dist/chunks/index.UpGiHP7g.js:1547-1561`). The plan's `[VERIFIED]` claim that `typecheck.include` controls tsc compilation was empirically wrong. Plan-compliance flagged as SG-001 HIGH. Fix: created `tsconfig.tests.json` extending root tsconfig with `include: ["src/**/*.ts", "tests/types.test.ts"]` (narrow scope to avoid retroactive typechecking of 12 pre-existing test files with latent unused-locals violations); set `vitest.config.ts:9` `typecheck.tsconfig: "tsconfig.tests.json"`. T2.4 drift experiment re-run with fix: lock fires correctly with `TS2322 "foreign" is not assignable to "koala" | "chainweaver" | "eckowallet" | undefined` at tests/types.test.ts:62, exit non-zero; restored state passes exit 0.
- **Final implementation review:** F-BUG-001 HIGH public-API regression — Phase 1 deleted `export interface IKadenaKeypair` from 4 interactions files but only added `import type` (consumption-only, no re-export). Consumers using `import { IKadenaKeypair } from "@stoachain/ouronet-core/interactions/dexFunctions"` (etc.) would have hit `TS2305: has no exported member`, violating the spec's NFR "non-breaking widening". Fix: appended `export type { IKadenaKeypair } from "../signing";` to each of 4 files. `export type` is erased from emitted JS — public API restored, F-INT-001 IKadenaKeypair-half cycle break preserved.
- **Final implementation review:** Doc-only fix on `tests/types.test.ts` JSDoc — original wording claimed both `seedType: "foreign"` AND `encryptedSecretKey: unknown` were locked. Empirically only the `seedType` literal lock fires; TypeScript accepts assignment of `unknown` into an `any` slot, so `unknown → any` weakening would silently pass. Updated JSDoc to accurately document coverage scope and reference `expectTypeOf` / `IsAny<T>` as migration paths if `encryptedSecretKey` width enforcement is later needed.
- **Plan-review:** 9 issues fixed across 3 iterations of Phase 1 plan review (off-by-one line numbers, missing positive-preservation greps, deprecated-shape preservation, value-position negative grep, seedType-widening risk note, `.d.ts` spot-check ambiguity, JSDoc backtick escaping).
- **Plan-review:** 4 issues fixed across 3 iterations of Phase 2 plan review (vitest typecheck.include glob, T2.4 safety guidance, T2.2 positive-visitation proof, vitest output label correction).
- **Cross-plan review:** 6 inter-phase issues fixed across 3 iterations (CI-001/F-XPHASE-002 merged on direct-positional vs struct-nested distinction, CI-002 ROADMAP↔TASKS contradiction, CI-003 placeholder function names, F-XPHASE-001 retroactive typecheck of 12 pre-existing test files, F-XPHASE-003 acceptance↔research-note narrowing inconsistency, T2.4 placeholder leak after T2.1 concretisation).

### Internal
- `chore: add BeeDev workflow scaffolding (.bee/, CLAUDE.md)` (e93eeb5) — output of `/bee:init` + `/bee:audit` + `/bee:audit-to-spec` + `/bee:new-spec` + `/bee:plan-all` capturing the 32 audit findings, 10 generated spec descriptions, and the executed spec's full requirements/plan/ROADMAP/TASKS.

### Stats
- Files changed: 13 (10 modified + 2 NEW + 1 modified config)
- Lines added: 217
- Lines removed: 46
- Phases: 2 (Type Consolidation + Type-Level Regression Lock)
- Total tasks: 16 (11 in Phase 1, 5 in Phase 2)
- Plan-review iterations: 3 + 3 + 3 (Phase 1 + Phase 2 + Cross-plan)
- Code-review iterations: 2 + 2 (Phase 1 + Phase 2)
- Final-review iterations: 1 (single-pass)
- Total auto-fix decisions logged: 11
- Audit findings closed by this release: 1 of 32 (the CRITICAL F-CORE-001)

### Process
This release was produced via the BeeDev workflow:
`/bee:init` → `/bee:audit` → `/bee:audit-to-spec` → `/bee:new-spec` → `/bee:plan-all` → `/bee:ship`. Final commit: `e7bdcb4`. Tagged `v1.7.0` (npm release tag). Spec lifecycle tag: `spec/consolidate-ikadenakeypair/v1`.
