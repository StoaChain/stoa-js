[CRITICAL-FIX] Consolidate IKadenaKeypair to a single canonical declaration

## Problem
The `IKadenaKeypair` type — the signing-ready keypair shape consumed by every signing call site — has SIX independent declarations across the codebase. Only one (`signing/types.ts`) is canonical and one (`ouroFunctions.ts`) is documented Phase-2b backwards-compat. The remaining four are undocumented duplicates, including one that is *not exported* and invisible to find-references tooling.

The duplicates are not byte-identical. The canonical includes `seedType: "foreign"` and types `encryptedSecretKey: unknown`; every duplicate omits `"foreign"` and uses `encryptedSecretKey: any`. TypeScript treats them as structurally compatible today, but the moment any one copy adds a required field — or any consumer narrows on `seedType === "foreign"` — the drift becomes a runtime/compile error landing silently on partial migrations.

## Locations
| File | Lines | Status |
|---|---|---|
| `src/signing/types.ts` | 22-30 | Canonical (keep) |
| `src/interactions/ouroFunctions.ts` | 812-818 | Documented Phase-2b exemption (keep with `@deprecated` JSDoc) |
| `src/interactions/activateFunctions.ts` | 27-33 | Undocumented duplicate (delete) |
| `src/interactions/dexFunctions.ts` | 31-37 | Undocumented duplicate (delete) |
| `src/interactions/kpayFunctions.ts` | 28-34 | Undocumented duplicate (delete) |
| `src/interactions/coilFunctions.ts` | 15-21 | Non-exported duplicate (delete) |

## Audit reference
- `F-CORE-001` (CRITICAL) — merged from F-ARCH-001, F-INT-007, F-INT-011
- See `.bee/AUDIT-REPORT.md` and `.bee/audit-findings.json`

## Required Fix
1. In each of the four offender files, delete the local `interface IKadenaKeypair` declaration.
2. Replace with `import type { IKadenaKeypair } from "../signing/types";` (or via `"../signing"` if the barrel re-exports it; verify the barrel does).
3. In `ouroFunctions.ts`, keep the local declaration but add a `@deprecated` JSDoc pointing to the canonical, and re-export the canonical alongside (so existing consumers that import from `ouroFunctions` keep working while new consumers reach the canonical).
4. Spot-check that the four affected files still compile by running `npm run typecheck`.
5. Verify the `seedType: "foreign"` literal is now usable from interaction call sites that accept an `IKadenaKeypair`.

## Side effects
- Consumers that import from `@stoachain/ouronet-core/interactions/dexFunctions` (etc.) for the type will see a moved-but-still-resolvable symbol. The `IKadenaKeypair` shape becomes wider (gains `"foreign"`) — non-breaking for existing users.
- The non-exported duplicate in `coilFunctions.ts` is invisible externally; deleting it has zero public-API impact.

## Acceptance Criteria
- [ ] Local `interface IKadenaKeypair` declarations removed from `activateFunctions.ts`, `dexFunctions.ts`, `kpayFunctions.ts`, `coilFunctions.ts`.
- [ ] Each affected file imports the canonical type via `import type { IKadenaKeypair } from "../signing"` (or a relative path).
- [ ] `ouroFunctions.ts` retains its local declaration with `@deprecated` JSDoc pointing to the canonical.
- [ ] `npm run typecheck` passes with zero new errors.
- [ ] `npm test` passes with zero regressions.
- [ ] A new test asserts that `seedType: "foreign"` is assignable to a function parameter typed as `IKadenaKeypair` from each interactions subpath that previously had a duplicate.
- [ ] No `interface IKadenaKeypair` remains in the codebase except in `signing/types.ts` and `ouroFunctions.ts`.
