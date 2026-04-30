# Phase 1: Type Consolidation -- Tasks

<!-- Pass 2 output: waves assigned, context packets defined.
     Wave 1 = 8 source-edit tasks (mutually exclusive file ownership, all parallel).
     Wave 2 = 3 quality-gate tasks (typecheck, test, build) -- read-only verification of Wave 1 disk state. -->

## Goal

Eliminate every undocumented duplicate of `IKadenaKeypair` (and the sibling non-exported `IOuroAccountKeypair` duplicate in `coilFunctions.ts`) from the `interactions/` layer, route every consumer of those types to the canonical declarations via type-only imports, mark the load-bearing Phase-2b copy in `ouroFunctions.ts` as `@deprecated`, restructure `coilFunctions.ts` so its imports form a single contiguous block at the top of the file, and verify the full tree passes typecheck, tests, and build with zero regressions. After this phase the type graph has a single canonical home for `IKadenaKeypair` and the `IKadenaKeypair` half of the F-INT-001 circular dependency is broken.

## Wave Notes

- **File ownership:** All eight Wave-1 tasks (T1.1-T1.8) own a single, distinct source file under `D:/_Claude/OuronetCore/src/interactions/`. No two tasks write to the same file. Mutual exclusivity is total -- they can run fully in parallel.
- **Transitive re-export interaction (T1.2 ↔ T1.5):** `src/interactions/dexFunctions.ts:22` contains `export * from "./addLiquidityFunctions";`. After T1.2 deletes the local `IKadenaKeypair` interface in `dexFunctions.ts` and T1.5 routes `addLiquidityFunctions.ts:10`'s `IKadenaKeypair` to `../signing` via `import type`, the canonical `IKadenaKeypair` is NOT re-exported through the dex barrel (because `import type` does not re-emit). Neither task writes to the other's file -- file ownership remains clean -- but reviewers should be aware that the public reachability of `IKadenaKeypair` from `@stoachain/ouronet-core/interactions/dexFunctions` shifts after both land. Canonical reachability via `@stoachain/ouronet-core/signing` is unaffected. T1.9/T1.10/T1.11 will catch any consumer that depended on the old transitive export.
- **T1.4 verification path:** `coilFunctions.ts` has zero per-file unit tests in the existing 12-test-file baseline. T1.4's correctness is verified purely through the global typecheck in T1.9 (and incidentally through the type-aware build in T1.11). T1.4's acceptance criteria already encode this -- no per-task test step is added.
- **Wave 2 parallelism:** T1.9, T1.10, T1.11 read disk state but do not write to source files, so they are mutually compatible. They depend on Wave 1 because all three are global gates -- any unbroken type edit in any Wave-1 file would surface here.
- **Fragmentation:** 8 tasks in Wave 1 + 3 tasks in Wave 2 = 11 tasks across 2 waves (avg 5.5 tasks/wave, well above the 2.5 consolidation target). No single-task waves.

## Wave 1 (parallel -- no dependencies)

- [x] T1.1 | Delete the duplicate `IKadenaKeypair` interface from `activateFunctions.ts` and replace it with a type-only canonical re-import | bee-implementer
  - requirements: [REQ-01, REQ-07]
  - acceptance:
    - `grep -c "interface IKadenaKeypair" src/interactions/activateFunctions.ts` returns `0`
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/activateFunctions.ts` returns `1`
    - All in-file references to `IKadenaKeypair` resolve to the imported type (no dangling local references; `tsc --noEmit` passes for this file)
    - Import is placed inside the existing top-of-file import block (no new interspersed imports)
    - File otherwise unchanged: no other interfaces deleted, no runtime code modified
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/activateFunctions.ts`
    - Lines to delete: `25-33` (the `// ─── Types ──` section header at line 25, blank line 26, the `export interface IKadenaKeypair { ... }` block at lines 27-33). Leave line 35's `DeployStandardAccountInfo` interface intact.
    - Line to add: `import type { IKadenaKeypair } from "../signing";` -- insert immediately after the existing `../signing` value import at line 12 (`import { universalSignTransaction, fromKeypair } from "../signing";`).
    - Canonical declaration to inspect (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30` -- the `IKadenaKeypair` source of truth (`encryptedSecretKey: unknown`, tighter than the deleted `any` -- spec accepts the tightening).
    - Pattern reference (read-only): `D:/_Claude/OuronetCore/src/interactions/pensionFunctions.ts:12` -- same canonical-import shape, but pension routes through `./ouroFunctions`; T1.1 routes through `../signing` instead.
    - In-file usages to leave intact (read-only): `activateFunctions.ts:124, 126, 206` -- 3 type-position references that resolve via the new import.
    - Verification commands:
      - `grep -c 'interface IKadenaKeypair' D:/_Claude/OuronetCore/src/interactions/activateFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/activateFunctions.ts` → `1`
    - Spec section: REQ-01, REQ-07 -- delete duplicate interface, route consumer to canonical via `import type`.
  - research:
    - Canonical: [CITED] `src/signing/types.ts:22-30` declares the canonical `IKadenaKeypair` (re-exported from `src/signing/index.ts:16` via `export * from "./types"`). Note `encryptedSecretKey` is typed `unknown` in canonical vs `any` in the duplicates -- per spec scope, accept the tighter type.
    - Pattern: [CITED] `src/interactions/pensionFunctions.ts:12` already uses the target shape `import type { IOuroAccountKeypair, IKadenaKeypair } from "./ouroFunctions";` -- this task uses the analogous shape but routes `IKadenaKeypair` to `../signing` instead.
    - File state: [CITED] `src/interactions/activateFunctions.ts:1-14` has a contiguous top-of-file import block. Line 12 already imports values (`universalSignTransaction, fromKeypair`) from `../signing` -- the new line MUST be a SEPARATE `import type { ... }` because mixing type-only `import type` with value imports on one line is not possible (would require `import { type IKadenaKeypair, universalSignTransaction, fromKeypair } from "../signing"`; cleanest is a new dedicated `import type` line directly below line 12).
    - Delete target: [CITED] `src/interactions/activateFunctions.ts:25-33` -- the section header comment `// ─── Types ──` (line 25) and the `export interface IKadenaKeypair { ... }` block (lines 27-33). Per acceptance "no other interfaces deleted", leave line 25 comment + line 35 `DeployStandardAccountInfo` interface intact; only lines 27-33 (and adjacent blank lines 26, 34 if appropriate) are removed.
    - Re-export risk: [CITED] `activateFunctions.ts:27` declares `export interface IKadenaKeypair`. Removing the `export` here is a downstream-visible removal IF any consumer imports `IKadenaKeypair` from `./activateFunctions` directly. Grep confirms ZERO such imports exist in `src/` (`Grep "from .*activateFunctions"` finds only the barrel re-export in `src/interactions/index.ts`); since the canonical `IKadenaKeypair` will still be exported via the barrel re-export chain (`./activateFunctions` re-exports nothing now, but `./ouroFunctions` and `./dexFunctions` still export their copies plus the canonical via `signing` -- public API surface unchanged for consumers reading from `@stoachain/ouronet-core/interactions`).
    - In-file usages: [CITED] `activateFunctions.ts:124, 126, 206` -- 3 type-position usages (`gasPayerKey: IKadenaKeypair`, `guardSignerKeys: IKadenaKeypair[]`, `const allSigners: IKadenaKeypair[]`). All resolve cleanly via the type-only import.
    - Approach: [ASSUMED] Insert `import type { IKadenaKeypair } from "../signing";` immediately after line 12 (`import { universalSignTransaction, fromKeypair } from "../signing";`) for visual grouping by source module.
  - notes:

- [x] T1.2 | Delete the duplicate `IKadenaKeypair` interface from `dexFunctions.ts` and replace it with a type-only canonical re-import | bee-implementer
  - requirements: [REQ-02, REQ-07]
  - acceptance:
    - `grep -c "interface IKadenaKeypair" src/interactions/dexFunctions.ts` returns `0`
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/dexFunctions.ts` returns `1`
    - The sibling `IOuroAccountKeypair` declaration in `dexFunctions.ts` is left untouched (deferred per Non-Goals)
    - All in-file references to `IKadenaKeypair` continue to resolve; `tsc --noEmit` passes for this file
    - Import is placed inside the existing top-of-file import block
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/dexFunctions.ts`
    - Lines to delete: `31-37` -- the `export interface IKadenaKeypair { ... }` block. DO NOT touch `IOuroAccountKeypair` at lines 25-29 (deferred per Non-Goals).
    - Line to add: `import type { IKadenaKeypair } from "../signing";` -- insert immediately after the existing `../signing` value import at line 8.
    - DO NOT touch line 22 (`export * from "./addLiquidityFunctions";`) -- the barrel re-export must remain for sibling-file functionality.
    - Canonical declaration (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30`.
    - Pattern reference (read-only): `D:/_Claude/OuronetCore/src/interactions/pensionFunctions.ts:12` -- canonical-import shape.
    - In-file usages to leave intact (read-only): `dexFunctions.ts:221, 222, 1136, 1137`.
    - Verification commands:
      - `grep -c 'interface IKadenaKeypair' D:/_Claude/OuronetCore/src/interactions/dexFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/dexFunctions.ts` → `1`
      - `grep -c 'interface IOuroAccountKeypair' D:/_Claude/OuronetCore/src/interactions/dexFunctions.ts` → `1` (untouched)
    - Cross-task awareness: T1.5 modifies `addLiquidityFunctions.ts` (the file `dexFunctions.ts:22` re-exports). After both T1.2 and T1.5 land, the `dexFunctions` barrel no longer re-emits `IKadenaKeypair` (because T1.5 makes it a type-only import in addLiquidity). Acceptable; documented in Wave Notes.
    - Spec section: REQ-02, REQ-07.
  - research:
    - Pattern: [CITED] Same as T1.1 -- mirror the canonical re-import pattern. `src/interactions/dexFunctions.ts:1-10` is the existing import block; line 8 already imports values from `../signing` so add a sibling `import type` line.
    - Delete target: [CITED] `src/interactions/dexFunctions.ts:31-37` -- the `export interface IKadenaKeypair { ... }` block. Leave `IOuroAccountKeypair` at lines 25-29 untouched per spec Non-Goals.
    - Re-export chain (CRITICAL): [CITED] `src/interactions/dexFunctions.ts:22` -- `export * from "./addLiquidityFunctions";`. After T1.5 lands, `addLiquidityFunctions.ts` will `import type { IKadenaKeypair } from "../signing";` -- that type-only import does NOT re-export, so `dexFunctions`' barrel `export *` does not re-emit `IKadenaKeypair` from this side. The canonical name `IKadenaKeypair` will still be reachable from `@stoachain/ouronet-core/interactions/dexFunctions` because the canonical lives in the public `signing` subpath; consumers should migrate to `signing` long-term, but Phase 1 does not delete the indirect reachability of the name from any other interactions barrel paths.
    - Consumer scan: [CITED] `Grep "from \"./dexFunctions\""` shows only `addLiquidityFunctions.ts:10` reads `IKadenaKeypair` from `./dexFunctions`. T1.5 fixes that consumer. No other in-tree consumer imports `IKadenaKeypair` from this module.
    - In-file usages: [CITED] `dexFunctions.ts:221, 222, 1136, 1137` -- 4 type-position usages (all `kadenaKeypair: IKadenaKeypair` / `guardKeypair: IKadenaKeypair`).
    - Approach: [ASSUMED] Insert the new `import type { IKadenaKeypair } from "../signing";` after line 8 (existing `../signing` value import). Leaves the `IOuroAccountKeypair` interface (lines 25-29) and the `// Type definitions for DEX data structures` block intact.
  - notes:

- [x] T1.3 | Delete the duplicate `IKadenaKeypair` interface from `kpayFunctions.ts` and replace it with a type-only canonical re-import | bee-implementer
  - requirements: [REQ-03, REQ-07]
  - acceptance:
    - `grep -c "interface IKadenaKeypair" src/interactions/kpayFunctions.ts` returns `0`
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/kpayFunctions.ts` returns `1`
    - The sibling `IOuroAccountKeypair` declaration in `kpayFunctions.ts` is left untouched (deferred per Non-Goals)
    - All in-file references to `IKadenaKeypair` continue to resolve; `tsc --noEmit` passes for this file
    - Import is placed inside the existing top-of-file import block
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/kpayFunctions.ts`
    - Lines to delete: `28-34` -- the `export interface IKadenaKeypair { ... }` block. DO NOT touch line 21 comment header or `IOuroAccountKeypair` at lines 22-26.
    - Line to add: `import type { IKadenaKeypair } from "../signing";` -- insert immediately after the existing `../signing` value import at line 10.
    - Canonical declaration (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30`.
    - Pattern reference (read-only): `D:/_Claude/OuronetCore/src/interactions/pensionFunctions.ts:12`.
    - In-file usages to leave intact (read-only): `kpayFunctions.ts:165, 166`.
    - Verification commands:
      - `grep -c 'interface IKadenaKeypair' D:/_Claude/OuronetCore/src/interactions/kpayFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/kpayFunctions.ts` → `1`
      - `grep -c 'interface IOuroAccountKeypair' D:/_Claude/OuronetCore/src/interactions/kpayFunctions.ts` → `1` (untouched)
    - Spec section: REQ-03, REQ-07.
  - research:
    - Pattern: [CITED] Same as T1.1/T1.2.
    - File state: [CITED] `src/interactions/kpayFunctions.ts:1-10` -- contiguous import block; line 10 imports values from `../signing`.
    - Delete target: [CITED] `src/interactions/kpayFunctions.ts:28-34` -- the `export interface IKadenaKeypair { ... }` block. Leave the comment header at line 21 and `IOuroAccountKeypair` at lines 22-26 untouched.
    - Consumer scan: [CITED] `Grep "from \"./kpayFunctions\""` finds zero in-tree consumers reading `IKadenaKeypair` from this module -- removal of the local re-export is safe.
    - In-file usages: [CITED] `kpayFunctions.ts:165, 166` -- 2 type-position usages (`kadenaAccount: IKadenaKeypair`, `guardAccount: IKadenaKeypair`).
    - Approach: [ASSUMED] Insert the new `import type { IKadenaKeypair } from "../signing";` immediately after line 10 (existing `../signing` value import).
  - notes:

- [x] T1.4 | Consolidate `coilFunctions.ts`: delete both local interface duplicates, add the two type-only canonical imports, and reorder all imports into a single contiguous top-of-file block | bee-implementer
  - requirements: [REQ-04, REQ-05, REQ-06, REQ-07, REQ-08]
  - acceptance:
    - `grep -c "interface IKadenaKeypair" src/interactions/coilFunctions.ts` returns `0`
    - `grep -c "interface IOuroAccountKeypair" src/interactions/coilFunctions.ts` returns `0`
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/coilFunctions.ts` returns `1`
    - `grep -c "import type { IOuroAccountKeypair } from \"./ouroFunctions\"" src/interactions/coilFunctions.ts` returns `1`
    - **The three currently-misplaced imports at lines 22-24 are PRESERVED in the new top-of-file block — none are dropped during the reorder.** Verify with three positive greps (each must return `1`):
      - `grep -c 'from "@kadena/client"' src/interactions/coilFunctions.ts` returns `1`
      - `grep -c 'from "../reads"' src/interactions/coilFunctions.ts` returns `1`
      - `grep -c 'universalSignTransaction.*fromKeypair.*from "../signing"' src/interactions/coilFunctions.ts` returns `1`
    - All `import` statements form a single contiguous block at the top of the file (no `import` lines appear after any non-import statement; verifiable by inspecting the file: the previously-misplaced imports at lines 22-24 — `@kadena/client`, `pactRead` (from `../reads`), and `universalSignTransaction`/`fromKeypair` — are now lifted into the top-of-file block)
    - No `interface` or other declaration appears between any two `import` statements
    - All in-file references to `IKadenaKeypair` and `IOuroAccountKeypair` continue to resolve; `tsc --noEmit` passes for this file (this is the SOLE verification path for T1.4 -- no per-file unit tests exist for `coilFunctions.ts`; correctness flows through T1.9's global typecheck)
    - No runtime / behavioural code modified — only deletions, additions, and reordering of imports
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/coilFunctions.ts`
    - Largest task in Wave 1 (5 sub-actions in one file). No per-file unit tests exist -- T1.9 is the verification gate.
    - Current structure (read-only inspection at lines 1-24, verified against the actual file):
      - Lines 1-6: `../constants` multi-line import (closes on line 6 with `} from "../constants";`)
      - Line 7: `import { formatDecimalForPact } from "../pact";`
      - Line 8: standalone comment `// Use same interfaces as ouroFunctions.ts` (DELETE — it has no purpose once the interfaces below are gone)
      - Lines 9-13: `interface IOuroAccountKeypair { ... }` (NON-exported, DELETE)
      - Line 14: blank line
      - Lines 15-21: `interface IKadenaKeypair { ... }` (NON-exported, DELETE)
      - Line 22: `import { Pact, createClient } from "@kadena/client";` (MOVE up)
      - Line 23: `import { pactRead } from "../reads";` (MOVE up)
      - Line 24: `import { universalSignTransaction, fromKeypair } from "../signing";` (MOVE up)
    - Target shape (suggested order; implementer may reorder as long as block is contiguous):
      1. `../constants` (multi-line, currently lines 1-6)
      2. `@kadena/client` (currently line 22)
      3. `../reads` (currently line 23)
      4. `../pact` (currently line 7)
      5. `../signing` value import (currently line 24)
      6. `import type { IKadenaKeypair } from "../signing";` (NEW)
      7. `import type { IOuroAccountKeypair } from "./ouroFunctions";` (NEW)
    - Delete targets: lines 8-21 — the standalone comment at line 8, the `IOuroAccountKeypair` declaration at lines 9-13, the blank line at 14, and the `IKadenaKeypair` declaration at lines 15-21.
    - Move targets: lines 22-24 must be MOVED into the contiguous top block, NOT deleted.
    - DO NOT touch any function body. Verify visually that executable-line count is unchanged.
    - Canonical declarations (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30` and `D:/_Claude/OuronetCore/src/interactions/ouroFunctions.ts:806-810`.
    - Pattern reference (read-only): `D:/_Claude/OuronetCore/src/interactions/pensionFunctions.ts:1-12` -- the desired clean shape.
    - In-file usages to leave intact (read-only): `coilFunctions.ts:170, 171, 172, 260, 261, 262, 281, 282, 283, 302, 303, 304` -- 12 type-position usages.
    - Verification commands:
      - `grep -c 'interface IKadenaKeypair' D:/_Claude/OuronetCore/src/interactions/coilFunctions.ts` → `0`
      - `grep -c 'interface IOuroAccountKeypair' D:/_Claude/OuronetCore/src/interactions/coilFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/coilFunctions.ts` → `1`
      - `grep -c 'import type { IOuroAccountKeypair } from "./ouroFunctions"' D:/_Claude/OuronetCore/src/interactions/coilFunctions.ts` → `1`
    - Spec section: REQ-04 (delete IKadenaKeypair duplicate), REQ-05 (delete IOuroAccountKeypair duplicate), REQ-06 (contiguous import block), REQ-07 (canonical route), REQ-08 (zero runtime touch).
  - research:
    - Current structure (verified against the actual file): [CITED] `src/interactions/coilFunctions.ts:1-24` is the structural mess:
      - Lines 1-6: `../constants` multi-line import (closes line 6 with `} from "../constants";`)
      - Line 7: `import { formatDecimalForPact } from "../pact";`
      - Line 8: standalone comment `// Use same interfaces as ouroFunctions.ts`
      - Lines 9-13: `interface IOuroAccountKeypair { ... }` (NON-exported)
      - Line 14: blank
      - Lines 15-21: `interface IKadenaKeypair { ... }` (NON-exported)
      - Line 22: `import { Pact, createClient } from "@kadena/client";`
      - Line 23: `import { pactRead } from "../reads";`
      - Line 24: `import { universalSignTransaction, fromKeypair } from "../signing";`
    - Pattern (canonical reference): [CITED] `src/interactions/pensionFunctions.ts:1-12` shows the desired clean shape -- all imports contiguous, types as `import type` at the bottom of the import block. coilFunctions should match this layout but route `IKadenaKeypair` to `../signing` instead of `./ouroFunctions`.
    - Target shape (suggested order, [ASSUMED] -- order is implementer's call as long as block is contiguous):
      1. `../constants` (multi-line, currently lines 1-6)
      2. `@kadena/client` (currently line 22)
      3. `../reads` (currently line 23)
      4. `../pact` (currently line 7)
      5. `../signing` value import (currently line 24)
      6. `import type { IKadenaKeypair } from "../signing";` (NEW)
      7. `import type { IOuroAccountKeypair } from "./ouroFunctions";` (NEW)
    - Delete targets: [CITED] Lines 8-21 (the standalone comment `// Use same interfaces as ouroFunctions.ts` at line 8, the `IOuroAccountKeypair` declaration at lines 9-13, blank line 14, and the `IKadenaKeypair` declaration at lines 15-21). The misplaced import lines 22-24 must be MOVED, not deleted.
    - Consumer scan: [CITED] `Grep "from \"./coilFunctions\""` -- no in-tree imports of `IKadenaKeypair` or `IOuroAccountKeypair` from this module (they were never `export`-prefixed -- "non-exported duplicates"). Safe to delete.
    - In-file usages: [CITED] `coilFunctions.ts:170, 171, 172, 260, 261, 262, 281, 282, 283, 302, 303, 304` -- 12 type-position usages of these two types in function signatures. All resolve via the new type-only imports.
    - Why split sources: [LOCKED] Spec mandates `IKadenaKeypair` from `../signing` (canonical) and `IOuroAccountKeypair` from `./ouroFunctions` (deferred consolidation, Non-Goal). Cannot use the single-line pensionFunctions shape because the two types live in different canonical homes after this phase.
    - Approach: [ASSUMED] Treat this as a pure mechanical reorder + delete; do NOT touch any function body, exported value, or runtime statement. Verify visually that line count of executable code is unchanged after edit (only import-block lines and the two interface declarations move/disappear).
  - notes:

- [x] T1.5 | Split `addLiquidityFunctions.ts:10` into two imports: keep `IOuroAccountKeypair` from `./dexFunctions` (value-position) and move `IKadenaKeypair` to a type-only import from `../signing`, breaking the F-INT-001 cycle for that type | bee-implementer
  - requirements: [REQ-09]
  - acceptance:
    - `grep -c "IKadenaKeypair.*from \"./dexFunctions\"" src/interactions/addLiquidityFunctions.ts` returns `0` (the type no longer flows through the peer interactions file)
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/addLiquidityFunctions.ts` returns `1`
    - `IOuroAccountKeypair` is still imported from `./dexFunctions` (its consolidation is deferred); `grep -c "IOuroAccountKeypair.*from \"./dexFunctions\"" src/interactions/addLiquidityFunctions.ts` returns `1`
    - **`IOuroAccountKeypair` MUST stay value-position (no `import type` switch — that consolidation is deferred and out of scope per Non-Goals).** Negative grep: `grep -c "import type.*IOuroAccountKeypair.*from \"./dexFunctions\"" src/interactions/addLiquidityFunctions.ts` returns `0`
    - All in-file usages of both types continue to resolve; `tsc --noEmit` passes for this file
    - The `IKadenaKeypair` half of the F-INT-001 circular dependency between `addLiquidityFunctions` and `dexFunctions` is broken (verifiable: no value-position import of `IKadenaKeypair` from `./dexFunctions` remains in `addLiquidityFunctions.ts`)
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/addLiquidityFunctions.ts`
    - F-INT-001 cycle break -- this is the load-bearing edit for REQ-09.
    - Line to replace: `10` -- currently `import { IOuroAccountKeypair, IKadenaKeypair } from "./dexFunctions";`
    - Replacement: TWO lines
      - `import { IOuroAccountKeypair } from "./dexFunctions";` (keep value-position; spec accepts current import form -- consolidating IOuroAccountKeypair is deferred)
      - `import type { IKadenaKeypair } from "../signing";` (NEW canonical route)
    - DO NOT switch `IOuroAccountKeypair` to `import type` -- that change is OUT OF SCOPE for Phase 1 and would expand the diff beyond REQ-09.
    - Canonical declaration (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30`.
    - Cycle context (read-only): `D:/_Claude/OuronetCore/src/interactions/dexFunctions.ts:22` (`export * from "./addLiquidityFunctions";`) -- DO NOT touch this; T1.2 is the only writer to dexFunctions.
    - In-file usages to leave intact (read-only): `addLiquidityFunctions.ts:41, 42` -- 2 type-position usages.
    - Verification commands:
      - `grep -c 'IKadenaKeypair.*from "./dexFunctions"' D:/_Claude/OuronetCore/src/interactions/addLiquidityFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/addLiquidityFunctions.ts` → `1`
      - `grep -c 'IOuroAccountKeypair.*from "./dexFunctions"' D:/_Claude/OuronetCore/src/interactions/addLiquidityFunctions.ts` → `1`
      - `grep -c 'import type.*IOuroAccountKeypair.*from "./dexFunctions"' D:/_Claude/OuronetCore/src/interactions/addLiquidityFunctions.ts` → `0` (IOuroAccountKeypair must stay value-position; `import type` switch is out of scope)
    - Spec section: REQ-09 -- F-INT-001 cycle break for IKadenaKeypair half.
  - research:
    - Cycle source: [CITED] The F-INT-001 cycle is created by `dexFunctions.ts:22` (`export * from "./addLiquidityFunctions";`) plus `addLiquidityFunctions.ts:10` (`import { IOuroAccountKeypair, IKadenaKeypair } from "./dexFunctions";`). After this task, the `IKadenaKeypair` half no longer routes through the cycle (canonical `../signing` is acyclic with `interactions/`).
    - Current line: [CITED] `src/interactions/addLiquidityFunctions.ts:10` -- `import { IOuroAccountKeypair, IKadenaKeypair } from "./dexFunctions";` (value-position; both types).
    - Target split: [ASSUMED] Replace line 10 with TWO lines:
      - `import type { IOuroAccountKeypair } from "./dexFunctions";` (kept; consolidation deferred per Non-Goals -- but spec REQ-09 only mandates removing IKadenaKeypair from dexFunctions, NOT switching IOuroAccountKeypair to type-only. Re-read REQ-09 carefully: it requires `IOuroAccountKeypair` "still imported from ./dexFunctions" -- preserves value-position is allowed. SAFER reading: keep the existing value-position import to minimise diff scope; spec acceptance bullet says "kept value-position".) → final: `import { IOuroAccountKeypair } from "./dexFunctions";`
      - `import type { IKadenaKeypair } from "../signing";` (NEW canonical route)
    - Note on type-only: [ASSUMED] Since `IOuroAccountKeypair` is purely structural and used only in type positions in this file, switching to `import type` would be cleaner -- but that is OUT OF SCOPE for Phase 1 (deferred to the IOuroAccountKeypair consolidation phase). Keep the existing `import` form for both halves of the original line; only the `IKadenaKeypair` symbol moves.
    - In-file usages: [CITED] `addLiquidityFunctions.ts:41, 42` -- 2 type-position usages (`kadenaKeypair: IKadenaKeypair`, `guardKeypair: IKadenaKeypair`). No value-position uses, so `import type` is safe.
    - Other imports: [CITED] No other line in `addLiquidityFunctions.ts:1-12` references `IKadenaKeypair`. The split is local to line 10.
    - Pattern: [CITED] `src/signing/types.ts:22` -- canonical type. Same as T1.1-T1.4 use of `../signing`.
  - notes:

- [x] T1.6 | Switch `guardFunctions.ts:13` to a type-only import of `IKadenaKeypair` routed through `../signing` | bee-implementer
  - requirements: [REQ-10]
  - acceptance:
    - `grep -c "IKadenaKeypair.*from \"./ouroFunctions\"" src/interactions/guardFunctions.ts` returns `0`
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/guardFunctions.ts` returns `1`
    - All in-file references to `IKadenaKeypair` continue to resolve; `tsc --noEmit` passes for this file
    - No other imports in the file are altered
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/guardFunctions.ts`
    - Line to replace: `13` -- currently `import { IKadenaKeypair } from "./ouroFunctions";`
    - Replacement: `import type { IKadenaKeypair } from "../signing";`
    - DO NOT touch line 11 (`import { universalSignTransaction, fromKeypair } from "../signing";`) -- the new line is positionally adjacent for visual grouping, but is a SEPARATE `import type` line.
    - Canonical declaration (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30`.
    - In-file usages to leave intact (read-only): `guardFunctions.ts:37, 38, 39, 40, 111` -- 5 type-position usages.
    - Verification commands:
      - `grep -c 'IKadenaKeypair.*from "./ouroFunctions"' D:/_Claude/OuronetCore/src/interactions/guardFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/guardFunctions.ts` → `1`
    - Spec section: REQ-10 -- consumer reroute via `import type`.
  - research:
    - Current line: [CITED] `src/interactions/guardFunctions.ts:13` -- `import { IKadenaKeypair } from "./ouroFunctions";` (value-position).
    - Existing `../signing` import: [CITED] `guardFunctions.ts:11` already has `import { universalSignTransaction, fromKeypair } from "../signing";` (value-position). Per type-only-import semantics, keep this line untouched and add a SEPARATE `import type` line for `IKadenaKeypair` -- mixing type and value with `import { type X, y }` is technically possible but adds noise; cleanest is a dedicated `import type` line right below line 11 or 12.
    - Target replacement: [ASSUMED] Replace line 13 with `import type { IKadenaKeypair } from "../signing";` (single-line swap; positionally adjacent to existing `../signing` value import for visual grouping).
    - In-file usages: [CITED] `guardFunctions.ts:37, 38, 39, 40, 111` -- 5 type-position usages (`gasStationKey: IKadenaKeypair`, three `IKadenaKeypair[]` fields, one `const allSigners: IKadenaKeypair[]`). All compatible with `import type`.
    - Pattern: [CITED] Same as T1.1-T1.5.
  - notes:

- [x] T1.7 | Switch `wrapFunctions.ts:18` to a type-only import of `IKadenaKeypair` routed through `../signing` | bee-implementer
  - requirements: [REQ-11]
  - acceptance:
    - `grep -c "IKadenaKeypair.*from \"./ouroFunctions\"" src/interactions/wrapFunctions.ts` returns `0`
    - `grep -c "import type { IKadenaKeypair } from \"../signing\"" src/interactions/wrapFunctions.ts` returns `1`
    - All in-file references to `IKadenaKeypair` continue to resolve; `tsc --noEmit` passes for this file
    - No other imports in the file are altered
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/wrapFunctions.ts`
    - Line to replace: `18` -- currently `import { IKadenaKeypair } from "./ouroFunctions";`
    - Replacement: `import type { IKadenaKeypair } from "../signing";`
    - DO NOT touch line 17 (`import { universalSignTransaction, fromKeypair } from "../signing";`) -- adjacent for visual grouping, separate line.
    - Canonical declaration (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30`.
    - In-file usages to leave intact (read-only): `wrapFunctions.ts:119, 120, 121, 122, 211, 264, 265, 266, 326` -- 9 type-position usages across 3 function signatures.
    - Verification commands:
      - `grep -c 'IKadenaKeypair.*from "./ouroFunctions"' D:/_Claude/OuronetCore/src/interactions/wrapFunctions.ts` → `0`
      - `grep -c 'import type { IKadenaKeypair } from "../signing"' D:/_Claude/OuronetCore/src/interactions/wrapFunctions.ts` → `1`
    - Spec section: REQ-11.
  - research:
    - Current line: [CITED] `src/interactions/wrapFunctions.ts:18` -- `import { IKadenaKeypair } from "./ouroFunctions";`.
    - Existing `../signing` import: [CITED] `wrapFunctions.ts:17` already has `import { universalSignTransaction, fromKeypair } from "../signing";`. Same disposition as T1.6 -- add adjacent `import type` line.
    - Target replacement: [ASSUMED] Replace line 18 with `import type { IKadenaKeypair } from "../signing";`.
    - In-file usages: [CITED] `wrapFunctions.ts:119, 120, 121, 122, 211, 264, 265, 266, 326` -- 9 type-position usages across 3 function signatures (gas-station + payment-signer + guards arrays + 3 `const allSigners: IKadenaKeypair[]` lines). All compatible with `import type`.
    - Pattern: [CITED] Same as T1.6.
  - notes:

- [x] T1.8 | Add an `@deprecated` JSDoc block above the Phase-2b `IKadenaKeypair` declaration at `ouroFunctions.ts:812-818`, leaving the declaration itself unchanged | bee-implementer
  - requirements: [REQ-12]
  - acceptance:
    - The `interface IKadenaKeypair` declaration in `ouroFunctions.ts` still exists and is byte-equivalent to the prior version (only a JSDoc block is added above it; no field changes, no export-status changes)
    - `grep -c "interface IKadenaKeypair" src/interactions/ouroFunctions.ts` returns `1`
    - **Declaration body is byte-equivalent.** Verify the deprecated copy's exact field shapes are preserved (NOT tightened to canonical):
      - `grep -c 'encryptedSecretKey?: any' src/interactions/ouroFunctions.ts` returns `1` (must stay `any`, NOT `unknown`)
      - The `seedType` field shape (`"koala" | "chainweaver" | "eckowallet"`) is unchanged from the prior version (NO `"foreign"` added — this is the deprecated copy, not the canonical)
      - Optional sanity: `git diff src/interactions/ouroFunctions.ts` shows ONLY ADDED lines (the JSDoc block) and ZERO deleted/modified lines in the 812-818 range
    - The JSDoc block immediately above the declaration contains the `@deprecated` tag
    - The JSDoc references the canonical declaration at `src/signing/types.ts` and the public consumer-facing subpath `@stoachain/ouronet-core/signing`
    - `tsc --noEmit` passes for this file
    - No other content in the file is modified
  - context:
    - File owned (sole writer): `D:/_Claude/OuronetCore/src/interactions/ouroFunctions.ts`
    - Insertion point: directly above line 812 (the `export interface IKadenaKeypair { ... }` declaration). Insertion-only edit -- DO NOT touch lines 812-818 (the declaration body) or lines 805-810 (sibling `IOuroAccountKeypair` and shared comment).
    - Suggested JSDoc text (4-line block):
      ```
      /**
       * @deprecated Phase-2b backwards-compat copy. Use the canonical `IKadenaKeypair` from
       * `@stoachain/ouronet-core/signing` (declared in `src/signing/types.ts`) instead.
       */
      ```
    - DO NOT tighten `encryptedSecretKey?: any;` to `unknown` -- the deprecated copy preserves its current shape for backwards-compat.
    - Canonical reference (read-only): `D:/_Claude/OuronetCore/src/signing/types.ts:22-30`.
    - Existing JSDoc style reference (read-only): `D:/_Claude/OuronetCore/src/constants/kadena.ts:47, 49` (single-line `/** @deprecated ... */`). Multi-line is appropriate here because the message is longer.
    - Verification command:
      - `grep -c 'interface IKadenaKeypair' D:/_Claude/OuronetCore/src/interactions/ouroFunctions.ts` → `1`
      - Manually confirm the `@deprecated` tag and references appear in the JSDoc directly above line 812.
    - Spec section: REQ-12 -- mark the load-bearing copy as deprecated without altering it.
  - research:
    - Target declaration: [CITED] `src/interactions/ouroFunctions.ts:812-818` -- `export interface IKadenaKeypair { ... }`. Sibling `IOuroAccountKeypair` at `:806-810` (left untouched per Non-Goals). The `// Interface definitions for keypair types` comment at line 805 currently sits above the `IOuroAccountKeypair` declaration and is shared by both interfaces; do NOT remove or move it.
    - Existing `@deprecated` style in this repo: [CITED] `src/constants/kadena.ts:47, 49` uses single-line JSDoc form `/** @deprecated Use STOA_AUTONOMIC_OURONETGASSTATION */`. For T1.8 the message is longer, so multi-line JSDoc is appropriate.
    - JSDoc pattern: [CITED] Existing multi-line JSDoc style in this file is visible at `src/interactions/ouroFunctions.ts:29-...` (`AccountSelectorData` field comments) -- standard `/** ... */` blocks with `*` line prefixes.
    - Suggested JSDoc text [ASSUMED]: see the canonical 4-line block in the **context** section above (the `Suggested JSDoc text (4-line block)` fenced code block). Do NOT copy from this line — the rendered backticks in the context block are literal backticks (correct for inline-code rendering on IDE hover); reproducing them here would risk an over-escaped copy. Implementer should copy directly from the context block.
    - Re-export risk: [CITED] `Grep "from \"./ouroFunctions\""` -- after T1.6 and T1.7 land, the only remaining in-tree consumer of `IKadenaKeypair from "./ouroFunctions"` is... none (T1.6 fixes guardFunctions, T1.7 fixes wrapFunctions; pensionFunctions.ts:12 imports `IOuroAccountKeypair, IKadenaKeypair` from `./ouroFunctions` -- pensionFunctions stays as-is per Non-Goals). The deprecation tag is informational only -- the declaration must remain exported for pensionFunctions and any external consumer.
    - Approach: [LOCKED] Insertion-only edit. No deletion, no reformat, no field change. The existing `encryptedSecretKey?: any;` stays `any` (NOT tightened to `unknown`) -- the canonical version is the one with `unknown`; the deprecated copy preserves its current shape for backwards-compat.
  - notes:

## Wave 2 (depends on Wave 1 -- global quality gates, parallel)

- [x] T1.9 | Run `npm run typecheck` over the full tree and confirm zero new errors after all source edits land | bee-implementer | needs: T1.1, T1.2, T1.3, T1.4, T1.5, T1.6, T1.7, T1.8
  - requirements: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12]
  - acceptance:
    - `npm run typecheck` exits with code `0`
    - The output shows zero TypeScript errors
    - The implementer pastes the actual command output as evidence in the task notes (per R8)
    - Any error surfaced by EITHER of two intentional widening surfaces is documented in the notes:
      - **`encryptedSecretKey: any → unknown`** — diagnostic of latent bugs the looser `any` was hiding. Errors here are real bugs; if outside this phase's scope, log for follow-up rather than silently fix.
      - **`seedType` literal-union widening** — canonical adds `"foreign"` to the union. Any consumer doing exhaustive `switch (kp.seedType)` without a `default` case AND without a `"foreign"` arm will fail typecheck under `noFallthroughCasesInSwitch`. THIS IS INTENTIONAL — it surfaces unsafe narrowing. Log for follow-up; do NOT revert the consolidation.
  - context:
    - Read-only command runner -- writes nothing to source.
    - Command: `npm run typecheck` (resolves to `tsc --noEmit` per `package.json:78`).
    - Run from repo root: `D:/_Claude/OuronetCore/`.
    - Active strict flags (read-only reference): `tsconfig.json:11-15` -- `strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`. Most likely failure: latent `tx.encryptedSecretKey.someField` access uncovered by the canonical's `unknown` typing (vs duplicate `any`).
    - Dependency notes (from Wave 1): read each of T1.1-T1.8's notes section before running -- if any Wave-1 task reported partial completion or error, escalate before running typecheck.
    - Sole verification gate for T1.4 (no per-file unit tests for coilFunctions.ts).
    - Evidence requirement (R8): paste the full stdout/stderr block of `npm run typecheck` into the notes section as proof. Claims without output are not evidence.
    - Out-of-scope handling: errors in files NOT modified by T1.1-T1.8 must be logged in notes for follow-up, not silently patched.
    - Spec section: all 12 requirements (this is the global gate).
  - research:
    - Command: [VERIFIED] `package.json:78` -- `"typecheck": "tsc --noEmit"`.
    - Strict flags active (verified): [CITED] `tsconfig.json:11-15` -- `strict: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. `skipLibCheck: true` (line 16) means peer-dep `.d.ts` errors are suppressed.
    - Likely failure mode: [ASSUMED] After the duplicate deletions land, the canonical `IKadenaKeypair.encryptedSecretKey: unknown` (vs duplicates' `any`) is the most likely error surface. Any `tx.encryptedSecretKey.someField` access in `interactions/*` (without a narrowing cast) would now be flagged. Audit was not done in this research pass; if errors arise they are diagnostic of latent bugs and should be logged in notes per acceptance criterion #4.
    - Also note: [CITED] `noUnusedLocals: true` means if any deletion accidentally orphans a variable, typecheck fails -- this catches incomplete edits in T1.1-T1.7.
    - Approach: [ASSUMED] Run from repo root. If failures occur outside the 8 source files this phase touches (T1.1-T1.8), document in notes as out-of-scope follow-up rather than fix in-place.
  - notes:

- [x] T1.10 | Run `npm test` over the full suite and confirm all 320 pre-existing tests pass with zero regressions | bee-implementer | needs: T1.1, T1.2, T1.3, T1.4, T1.5, T1.6, T1.7, T1.8
  - requirements: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12]
  - acceptance:
    - `npm test` exits with code `0`
    - The output shows all 320 pre-existing test cases passing (the new `tests/types.test.ts` is Phase 2 scope and is NOT expected here)
    - The implementer pastes the actual test runner output as evidence in the task notes (per R8)
    - Zero failed, zero skipped (vs. the pre-refactor baseline)
  - context:
    - Read-only command runner -- writes nothing to source.
    - Command: `npm test` (resolves to `vitest run --passWithNoTests` per `package.json:79`).
    - Run from repo root: `D:/_Claude/OuronetCore/`.
    - Baseline test files (12, read-only reference): `tests/cfm-builders.test.ts`, `tests/codex-codec.test.ts`, `tests/dalos-integration.test.ts`, `tests/encryption-upgrade.test.ts`, `tests/encryption.test.ts`, `tests/gas.test.ts`, `tests/guard.test.ts`, `tests/network.test.ts`, `tests/pact-format.test.ts`, `tests/signing.test.ts`, `tests/smart-account-auth.test.ts`, `tests/strategy.test.ts`. Total: 320 cases.
    - Phase 2's `tests/types.test.ts` is NOT yet present -- if vitest collects it, this is unexpected.
    - Dependency notes (from Wave 1): same as T1.9 -- read T1.1-T1.8's notes sections before running.
    - Predicted impact: zero -- `interactions/*` modules have no direct unit tests; refactor is type-position only. Any regression indicates an unexpected runtime touch.
    - Evidence requirement (R8): paste the full vitest output block into notes as proof.
    - Spec section: all 12 requirements.
  - research:
    - Command: [VERIFIED] `package.json:79` -- `"test": "vitest run --passWithNoTests"`.
    - Test files (existing baseline, [CITED]): `tests/cfm-builders.test.ts`, `codex-codec.test.ts`, `dalos-integration.test.ts`, `encryption-upgrade.test.ts`, `encryption.test.ts`, `gas.test.ts`, `guard.test.ts`, `network.test.ts`, `pact-format.test.ts`, `signing.test.ts`, `smart-account-auth.test.ts`, `strategy.test.ts` (12 files). Phase 2's `tests/types.test.ts` is NOT in this list -- confirms Phase 1 should see zero `types.test.ts` collected.
    - Vitest config: [ASSUMED] No `vitest.config.ts` was checked; default config picks up `tests/**/*.test.ts`. The `--passWithNoTests` flag prevents a false failure if a wave runs no tests, but the full suite has 320 cases per spec.
    - Test impact prediction: [ASSUMED] None of the 12 test files exercise the 8 source files directly modified in T1.1-T1.8. Tests are at the `signing/`, `gas/`, `guard/`, `network/` layer -- the `interactions/*` modules are a higher integration layer with no direct unit tests. Tests should be unaffected by this refactor (pure type-position changes); regressions would indicate an unexpected runtime touch.
    - Approach: [ASSUMED] Run from repo root after T1.9 passes. If any test fails, root-cause and report -- do not silently fix unrelated test breakage.
  - notes:

- [x] T1.11 | Run `npm run build` and confirm `dist/` is produced cleanly with the consolidated type reflected in the emitted `.d.ts` files | bee-implementer | needs: T1.1, T1.2, T1.3, T1.4, T1.5, T1.6, T1.7, T1.8
  - requirements: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12]
  - acceptance:
    - `npm run build` exits with code `0`
    - The output shows zero TypeScript errors
    - The implementer pastes the actual build output as evidence in the task notes (per R8)
    - Spot-check (negative signal only): the emitted `dist/interactions/activateFunctions.d.ts` does NOT contain a local `interface IKadenaKeypair { ... }` declaration block. Verify with `grep -c 'interface IKadenaKeypair' dist/interactions/activateFunctions.d.ts` returns `0`. **Whether an `import type` line appears in the emitted `.d.ts` is implementation-dependent** (TypeScript may erase or inline type-only imports per project resolution); presence/absence of the import line is NOT part of this gate
    - `dist/` is not staged or committed (it remains gitignored per repo policy)
  - context:
    - Read-only command runner -- writes to `D:/_Claude/OuronetCore/dist/` only (gitignored).
    - Command: `npm run build` (resolves to `tsc -p tsconfig.build.json` per `package.json:77`).
    - Run from repo root: `D:/_Claude/OuronetCore/`.
    - Build config (read-only reference): `tsconfig.build.json` -- extends `tsconfig.json`, `noEmit: false`, `outDir: ./dist`, `rootDir: ./src`, `declaration: true`, excludes test files.
    - Spot-check target: `D:/_Claude/OuronetCore/dist/interactions/activateFunctions.d.ts` -- after build, this file should NOT contain `interface IKadenaKeypair`. Use `grep -c 'interface IKadenaKeypair' dist/interactions/activateFunctions.d.ts` -- expected `0`. (Note: `import type` statements may be erased from `.d.ts` if not re-exported, so the absence of the interface declaration IS the positive signal; an explicit import line may not appear.)
    - DO NOT stage or commit `dist/`.
    - Optional: `npm run clean && npm run build` for a fresh emit if the spot-check matters.
    - Dependency notes (from Wave 1): same as T1.9/T1.10.
    - Evidence requirement (R8): paste the full build output block into notes as proof.
    - Spec section: all 12 requirements.
  - research:
    - Command: [VERIFIED] `package.json:77` -- `"build": "tsc -p tsconfig.build.json"`.
    - Build config: [CITED] `tsconfig.build.json` -- extends `tsconfig.json`, sets `noEmit: false`, `outDir: ./dist`, `rootDir: ./src`, `declaration: true`. `exclude: ["node_modules", "dist", "src/**/*.test.ts", "tests/**"]` confirms no test files leak into the build (acceptance bullet #5 is auto-satisfied by config).
    - Public exports: [CITED] `package.json:8-69` -- `"./interactions"` (`./dist/interactions/index.d.ts`), `"./interactions/*"` (per-file subpath), `"./signing"` (`./dist/signing/index.d.ts`). Build emits all of these. The canonical `IKadenaKeypair` is reachable at consumer-facing `@stoachain/ouronet-core/signing` (per package.json:37-40 mapping).
    - Spot-check target [ASSUMED]: After build, inspect `dist/interactions/activateFunctions.d.ts` for the absence of `interface IKadenaKeypair` and the presence of an import (TypeScript may erase pure `import type` statements from `.d.ts` if the type isn't re-exported -- since activateFunctions does NOT re-export `IKadenaKeypair` after T1.1, the resulting `.d.ts` likely will NOT contain any IKadenaKeypair reference at all in the public surface; types referenced internally appear in function-signature positions where TS inlines them via the import). This is the expected outcome.
    - Gitignore: [CITED] `package.json:71-73` `"files": ["dist"]` for npm publish; `dist/` is conventionally gitignored in TypeScript libraries (not verified here -- assume present per repo policy).
    - Approach: [ASSUMED] Run `npm run clean && npm run build` for a fresh emit if the spot-check matters, otherwise plain `npm run build`. Do NOT stage or commit `dist/`.
  - notes:
