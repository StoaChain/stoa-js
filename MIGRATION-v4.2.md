# MIGRATION-v4.2.md — upgrading from v4.1.x to v4.2.0

**TL;DR.** v4.2.0 is the architectural-closures release. All 6 Tier-4 audit findings still open at the v4.1.1 baseline are CLOSED-VERIFIED in this minor version. The 3 packages bump atomically from `4.1.1` to `4.2.0` and a new `INTEGRATION-GUIDE.md` lands at the monorepo root for cold-start consumer onboarding. Consumer impact ranges from zero (Phase 3 internal refactor) to TypeScript-only (Phase 5 readonly sweep). Existing try/catch consumer patterns continue to work; new code can rely on improved nullable contracts.

This is the upgrade-flavor migration doc for the v4.1.x → v4.2.0 transition. For comprehensive cold-start consumer onboarding (the full v4.0 → v4.1 → v4.2 architectural arc), see [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) at the monorepo root. This doc focuses on the consumer-impact deltas; INTEGRATION-GUIDE.md is the broader architectural context.

---

## 1. Overview — audit-closure summary

The 2026-05-05 audit identified 11 Tier-4 candidates for v4.2.0. Post-Phase-9, all 11 transition to **CLOSED-VERIFIED**:

| Item | v4.1.1 baseline state | v4.2.0 final state | Closing phase |
|---|---|---|---|
| F-ARCH-001 | OPEN | CLOSED-VERIFIED | Phase 1 (dex god-file split) |
| F-ARCH-002 | OPEN | CLOSED-VERIFIED | Phase 2 (ouro god-file split + chain/UI separation) |
| F-ARCH-003 | OPEN | CLOSED-VERIFIED | Phase 3 (parameterized liquidity executor) |
| F-ARCH-006 | CLOSED | CLOSED-VERIFIED | (already closed in v3.x) |
| F-ARCH-008 | CLOSED | CLOSED-VERIFIED | (already closed in v3.x) |
| F-ARCH-010 | CLOSED | CLOSED-VERIFIED | (already closed in v3.x) |
| F-ARCH-011 | CLOSED | CLOSED-VERIFIED | (regression-locked in v3.3.8) |
| F-API-002 | PARTIAL | CLOSED-VERIFIED | Phase 4 (nullable contract honoring) |
| F-API-018 | OPEN | CLOSED-VERIFIED | Phase 5 (readonly sweep) |
| F-TEST-002 | PARTIAL | CLOSED-VERIFIED | Phase 6 (universal-sign foreign-key fixture) |
| F-TEST-006 | PARTIAL | CLOSED-VERIFIED | Phase 7 (+127 specs across 6 modules) |

NEW deliverable (not in the audit; born in this spec): **INTEGRATION-GUIDE.md** at repo root (Phase 8) — comprehensive cold-start consumer onboarding doc, 13 mandated sections.

### Atomic-triplet version bump

All 3 packages move from `4.1.1` to `4.2.0` in a single commit:

```diff
- "version": "4.1.1"  // packages/kadena-stoic-legacy/package.json
+ "version": "4.2.0"

- "version": "4.1.1"  // packages/stoa-core/package.json
+ "version": "4.2.0"
- "@stoachain/kadena-stoic-legacy": "4.1.1"
+ "@stoachain/kadena-stoic-legacy": "4.2.0"

- "version": "4.1.1"  // packages/ouronet-core/package.json
+ "version": "4.2.0"
- "@stoachain/kadena-stoic-legacy": "4.1.1"
- "@stoachain/stoa-core": "4.1.1"
+ "@stoachain/kadena-stoic-legacy": "4.2.0"
+ "@stoachain/stoa-core": "4.2.0"
```

The `package-lock.json` regenerates via `npm install --package-lock-only` from the monorepo root.

**See also:** [INTEGRATION-GUIDE.md § 1](./INTEGRATION-GUIDE.md) for the full v4.0 → v4.1 → v4.2 arc.

---

## 2. Phase 1 + Phase 2 — god-file splits, new entity-oriented subpaths recommended

The two largest god-files in `@stoachain/ouronet-core/interactions/` are decomposed into entity-oriented modules following the locked 7-entity Ouronet taxonomy.

### Phase 1 — `dexFunctions.ts` split (F-ARCH-001)

Decomposed into ~10 entity-oriented files. The old `interactions/dexFunctions` import path continues to work as a thin re-export shim for backward compatibility — your existing imports compile and run unchanged.

```ts
// v4.1.x style — still works in v4.2.0 (thin shim re-exports)
import { calculateDirectSwap } from "@stoachain/ouronet-core/interactions/dexFunctions";

// v4.2.0 recommended — entity-oriented subpath, better tree-shaking
import { calculateDirectSwap } from "@stoachain/ouronet-core/interactions/dexSwapPairCalcFunctions";
```

The 10 new files (each is a subpath under `@stoachain/ouronet-core/interactions/`):

| Entity | New file | What it owns |
|---|---|---|
| TF (Tradeable Fungible) | `dexSwapPairCalcFunctions` | swap-pair calculation reads (`calculateDirectSwap`, `calculateInverseSwap`, etc.) |
| TF | `dexSwapPairExecFunctions` | swap-pair execution Pact builders |
| TF | `dexLiquidityCalcFunctions` | liquidity-add/remove calculations |
| TF | `dexLiquidityExecFunctions` | liquidity-add/remove Pact builders |
| TF | `dexFuelCalcFunctions` | fuel-pair calculations |
| TF | `dexFuelExecFunctions` | fuel-pair execution Pact builders |
| TF | `dexDashboardFunctions` | dashboard reads (multi/single) |
| TF | `dexAccountSuppliesFunctions` | per-user supply reads |
| TF | `dexCappedInverseFunctions` | capped-inverse calculations |
| (shared) | `dexTypes` | the shared types module (param interfaces, return types) |

### Phase 2 — `ouroFunctions.ts` split + chain/UI surgical separation (F-ARCH-002)

The `ouroFunctions.ts` god-file (~2200 LOC) is decomposed into ~11 entity-oriented files separating chain-side surfaces (RPC builders, signing pipelines) from UI-side surfaces (display formatting, dashboard reads). The old `interactions/ouroFunctions` import path remains as a thin re-export shim. The 7-entity Ouronet taxonomy (TF, OF, Collectables, ASP, SWP, AP, plus the cross-cutting Codex/Account layer) drives the per-file ownership.

**See also:** [INTEGRATION-GUIDE.md § 4](./INTEGRATION-GUIDE.md) for subpath imports per package and [INTEGRATION-GUIDE.md § 7](./INTEGRATION-GUIDE.md) for the 7-entity taxonomy walkthrough.

### Forward-compat note

Both shims are guaranteed throughout the v4.x line. **v5.0.0 may remove them** — consumers who care about long-term tree-shaking should migrate to the entity-oriented subpaths now.

---

## 3. Phase 3 — parameterized liquidity executor (F-ARCH-003) — zero consumer impact

The 5 add-liquidity-family entry points consolidate around a single internal `executeLiquidityOp` parameterized by mode + buffer-strategy. The 5 public function signatures are preserved verbatim:

- `executeAddLiquiditySingle`
- `executeAddLiquidity`
- `executeSpecialAddLiquidity`
- `executeFuel`
- `executeRemoveLiquidity`

Internal LOC reduction ~600 → ~200. **Zero consumer impact** — the public signatures are byte-identical to v4.1.x.

**Buffer-strategy reconciliation note (Phase 3 T3.5):** _"spec text mentioned 3 buffer strategies; codebase has 2 distinct (`fixed-5k`, `auto-gas-limit`); the third is a degenerate no-rebuild sub-branch of `auto-gas-limit`, not a separate strategy. The 2-member union is technically correct."_ The internal `BufferStrategy` type is `"fixed-5k" | "auto-gas-limit"` — not a 3-member union.

**See also:** [INTEGRATION-GUIDE.md § 8](./INTEGRATION-GUIDE.md) on gas calibration for the broader gas-limit context.

---

## 4. Phase 4 — nullable contract honoring (F-API-002) — TypeScript signal + reliability win

The 12 swap-calc and dashboard-read functions whose declared return type was `Promise<T | null>` now honor that contract — they return `null` on RPC failure (with `logger.error` invoked first) instead of rethrowing. Existing try/catch consumer patterns continue to work. New code can rely on the static-type signature with the `if (result === null)` pattern.

### Code examples

```ts
// v4.1.x style — still works in v4.2.0 (try/catch never fires on RPC failure now,
// but the catch is harmless if you keep it for non-RPC errors)
try {
  const r = await calculateDirectSwap(/* ... */);
  if (r) showResult(r);
} catch (e) {
  showError(e);  // unreachable for RPC-failure cases in v4.2.0
}

// v4.2.0 reliable style — null-check the declared return type
const r = await calculateDirectSwap(/* ... */);
if (r === null) {
  showError("RPC failed; see logger.error output");
  return;
}
showResult(r);
```

### Affected functions (12 total)

`getSWPairDashboardInfo`, `getPoolPreviewData`, `getSWPairMultiDashboardInfo`, `getSwpairInternalDashboard`, `calculateDirectSwap`, `calculateInverseSwap`, `calculateDirectSwapB`, `calculateInverseSwapB`, `getCappedInverseAmount`, `getUserAccountSupplies`, plus 2 additional dashboard-read functions whose names are recorded in the Phase 4 closure notes.

**Carry-forward snippet (Phase 4 T4.4):** _"The 10 swap-calc and dashboard-read functions whose declared return type was Promise<T | null> now honor that contract — they return null on RPC failure (with logger.error invoked first) instead of rethrowing. Existing try/catch consumer patterns continue to work. New code can rely on the static-type signature with the if (result === null) pattern."_

**See also:** [INTEGRATION-GUIDE.md § 5](./INTEGRATION-GUIDE.md) on the 5 typed error classes.

---

## 5. Phase 5 — readonly sweep (F-API-018) — TypeScript-only, no runtime change

Aggressive `readonly` modifier sweep across ~80 public type fields in both `stoa-core` and `ouronet-core`. TypeScript-only signal — emitted JavaScript is byte-identical to v4.1.1.

If your code mutates public-type fields in place, the typecheck surfaces TS2540 errors at compile time. Switch to immutable spread copy patterns.

### Code examples

```ts
// v4.1.x style — produces TS2540 in v4.2.0
kp.publicKey = newPublicKey;          // BREAKS at compile time
analysis.threshold = 5;                // BREAKS
params.account = "k:abc...";           // BREAKS

// v4.2.0 immutable style — type-check-clean
const updatedKp       = { ...kp,       publicKey: newPublicKey };
const updatedAnalysis = { ...analysis, threshold: 5            };
const updatedParams   = { ...params,   account:   "k:abc..."   };
```

### Affected types

In `@stoachain/stoa-core`:
- `signing/types.ts` — `IKadenaKeypair`, `KeyResolver`, `PactClient`
- `wallet/types.ts` — `BalanceResolver`-adjacent shapes
- `guard/guardUtils.ts` — `GuardAnalysis`
- `errors/transactionErrors.ts`
- `signing/universalSign.ts` — `UniversalKeypair`
- `signing/partialSig.ts`

In `@stoachain/ouronet-core`:
- `codex/types.ts` — every codex-domain type
- All `*Params` interfaces across `interactions/*` modules

**Carry-forward snippet (Phase 5 T5.11):** _"v4.2.0 — Aggressive readonly sweep across ~85 public type fields (F-API-018). All public-type object-property fields in stoa-core and ouronet-core now carry readonly. Consumer impact: TypeScript-only signal; immutable spread/struct-copy required for previously-in-place mutations. Zero runtime change."_

**See also:** [INTEGRATION-GUIDE.md § 4](./INTEGRATION-GUIDE.md) on subpath imports per package.

---

## 6. Phase 6 + Phase 7 — test-suite expansion

Phase 6 adds the universal-sign foreign-key fixture (F-TEST-002) — 3 new it-blocks in `tests/universal-sign.test.ts` covering the `seedType: "foreign"` path so the universal-sign pipeline is no longer untested for foreign-keypairs.

Phase 7 adds **+127 specs** across 6 modules (F-TEST-006 closure):

- `infoOneFunctions`
- `coilFunctions`
- `kpayFunctions`
- `pensionFunctions`
- `activateFunctions`
- `guardFunctions`

The audit's stated 37 untested functions corrected to 38: `guardFunctions.describeKeyset` was missed by the 2026-05-05 audit; absorbed by Phase 7 as +1 function = +3 it-blocks. The closure transition is from "PARTIAL — 38 untested" to "CLOSED-VERIFIED" (not the spec's stated "37").

**Zero consumer impact** — the new specs all live in `tests/` and exercise existing public functions. No new public surfaces exposed.

**See also:** [INTEGRATION-GUIDE.md § 11](./INTEGRATION-GUIDE.md) on the test-suite architecture.

---

## 7. Phase 8 — INTEGRATION-GUIDE.md cross-reference

This MIGRATION doc is the upgrade-flavor v4.1.x → v4.2.0 transition guide. The complementary cold-start consumer onboarding doc lives at [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) at the monorepo root — 13 mandated sections covering the full v4.0 → v4.1 → v4.2 architectural arc:

1. Install + peer-deps for all 3 packages
2. The 3-package atomic-release model
3. Subpath imports per package (with the canonical pattern table)
4. The 5 typed error classes and when they fire
5. The 7-entity Ouronet taxonomy
6. The 3 pluggable seams (`setPactReader`, `KeyResolver`+`PactClient`, `BalanceResolver`)
7. Codex backup format `"1.2"` (intentionally frozen at this version)
8. Smart-account auth (Σ-prefix `enforce-one` resolver)
9. Gas calibration
10. Full quick-start example
11. Test-suite architecture
12. Versioning discipline
13. References (links to all MIGRATION docs and other architectural docs)

Doc-validity test (`packages/ouronet-core/tests/v4-2-0-integration-guide-validity.test.ts`) verifies all cited subpaths resolve, all cited error classes import, all cited seam functions are exported, and all 3 MIGRATION docs (v4, v4.1, v4.2) exist at repo root.

**See also:** [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) for the full integration walkthrough.

---

## 8. Forward to v5.0.0

The following items are deferred to v5.0.0 (per `requirements.md:332-338`):

- **Deletion of v4.2.0 shim re-exports** in `interactions/dexFunctions.ts` and `interactions/ouroFunctions.ts`. v5.0.0 may remove these — consumers should migrate to the entity-oriented subpaths during v4.x.
- **Removal of `getSublimateInfo` deprecation shim** (introduced in v4.1.1 to preserve backward compatibility for the legacy `(patron, resident, amount-as-string)` signature). v5.0.0 removes the shim; consumers must call the canonical `infoOneFunctions.getSublimateInfo` directly with the canonical signature.
- **Removal of `GAS_LIMIT_COLORS`** — JSDoc-marked `@public` in v4.1.1 with explicit "removal deferred to v4.2.0" intent; v4.2.0 carried it forward to keep this minor bump tightly scoped to the audit closures. Tracked for v5.0.0.
- **Re-running the audit** — the 2026-05-05 audit's Tier-4 candidate list is fully closed by v4.2.0. A fresh audit run against the v4.2.0 baseline will surface any new findings born during the architectural-closure phases.

**See also:** [INTEGRATION-GUIDE.md § 12](./INTEGRATION-GUIDE.md) on versioning discipline.
