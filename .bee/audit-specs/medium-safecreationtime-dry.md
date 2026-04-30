[TECH-DEBT] Consolidate `safeCreationTime` to a single canonical export

## Problem
The 3-line helper `function safeCreationTime() { return Math.floor(Date.now() / 1000) - 30; }` is copy-pasted as a private (non-exported) function into 11 files in `src/interactions/`. It is also exported canonically from `src/pact/format.ts:138-140` via the `./pact` subpath barrel. Seven of the duplicating files already import OTHER helpers from `../pact`, so the import path is established.

The `-30` value is the safety margin preventing Pact's "creation time too far in the future" error. Any future change (NTP discipline tightening, chain-clock change, Stoa-side adjustment) requires editing 12 files. Drift between copies (e.g. one file uses -60 while six others stay at -30) is invisible until a chain rejection.

## Audit reference
- `F-CORE-015` (MEDIUM) — merged from F-ARCH-002, F-PERF-007, F-ERR-024
- All three audit agents flagged the same duplication; severity capped at MEDIUM because the -30 constant is currently uniform across all copies (no actual drift today, only structural risk).

## Locations
| File | Lines |
|---|---|
| `src/pact/format.ts` | 138-140 (canonical, exported) |
| `src/interactions/activateFunctions.ts` | 20-22 |
| `src/interactions/addLiquidityFunctions.ts` | 17-19 |
| `src/interactions/coilFunctions.ts` | 30-32 |
| `src/interactions/crossChainFunctions.ts` | 11-13 |
| `src/interactions/dexFunctions.ts` | 16-18 |
| `src/interactions/guardFunctions.ts` | 19-21 |
| `src/interactions/kpayFunctions.ts` | 16-18 |
| `src/interactions/ouroFunctions.ts` | 118-120 |
| `src/interactions/pensionFunctions.ts` | 18-20 |
| `src/interactions/urStoaFunctions.ts` | 28-30 |
| `src/interactions/wrapFunctions.ts` | 25-27 |

## Required Fix
Mechanical refactor:

1. In each of the 11 interaction files, delete the local `function safeCreationTime` declaration.
2. Add `safeCreationTime` to the existing `import` from `../pact` (or create the import if the file doesn't already pull from `../pact`).
3. Verify by grep: `function safeCreationTime` should appear only in `src/pact/format.ts` after the change.
4. Run `npm run typecheck` and `npm test` — all 320 tests should still pass (the function body is byte-identical to the canonical, so behaviour is unchanged).

## Note
This is a candidate for `/bee:quick` instead of a full spec — the change is mechanical, the test suite already covers the behaviour transitively, and there's no design choice to discuss. The spec form is provided here for completeness; the developer can choose to run `/bee:quick "Consolidate safeCreationTime to canonical export from src/pact/format.ts"` and skip the planning pipeline if preferred.

## Acceptance Criteria
- [ ] `function safeCreationTime` declaration removed from all 11 interaction files.
- [ ] Each affected file imports `safeCreationTime` from `../pact`.
- [ ] `grep -r "function safeCreationTime" src/` returns exactly one hit (in `src/pact/format.ts`).
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes with zero regressions.
- [ ] CHANGELOG.md notes the internal refactor (no public-API change — `safeCreationTime` was already exported from `./pact` for any consumer that wanted it).
