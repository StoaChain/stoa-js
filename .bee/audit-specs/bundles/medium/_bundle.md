# [MEDIUM-BUNDLE] 3 MEDIUM-tier audit closures (v2.3.0 minor)

**Source:** `/bee:audit` 2026-04-30. Bundles all 3 remaining MEDIUM-severity audit-specs into one multi-phase spec.

**Severity:** MEDIUM (× 3 specs, 7 underlying findings: F-CORE-013 / F-CORE-014 / F-CORE-015 / F-CORE-016a / F-CORE-016b / F-CORE-016c / F-CORE-017)
**Version target:** v2.3.0 minor (additive: shape validation throws on malformed codex import, foreign-key resolver throws explicit error pre-flight, guard-classification rejects malformed inputs that previously silently mis-classified, predicate-recognition flag added to analysis result; no public API removed; no return-type widening; one DRY refactor with byte-identical behaviour)

## Bundle composition

| Phase | Source audit-spec | Findings | Type |
|-------|------------------|----------|------|
| 1 | `medium-safecreationtime-dry.md` | F-CORE-015 | Pure mechanical refactor (zero behavior change) |
| 2 | `medium-codex-and-foreign-key-contract.md` | F-CORE-013 + F-CORE-014 | Additive: shape validation + explicit foreign-key error |
| 3 | `medium-guard-smart-account-hardening.md` | F-CORE-016a + F-CORE-016b + F-CORE-016c + F-CORE-017 | Additive: tighter classification + casing normalization + state docs + predicate-recognition flag |

## Why these together

- **All MEDIUM-tier from the same 2026-04-30 audit cycle.** Closes 3 of the remaining 3 MEDIUM specs in one ship.
- **No file-ownership conflicts between phases:**
  - Phase 1: 11 files in `src/interactions/*` (delete `function safeCreationTime` declarations) + each of those files' `../pact` imports.
  - Phase 2: `src/codex/codec.ts`, `src/signing/codexStrategy.ts`, `src/signing/types.ts` (JSDoc only on KeyResolver).
  - Phase 3: `src/guard/smartAccountAuth.ts`, `src/guard/guardUtils.ts`.
  Zero overlap. Phase 1 exclusively touches `src/interactions/*`; Phases 2 and 3 don't touch `src/interactions/` at all.
- **Independent rollback granularity preserved by separate phases.** Phase 1 in particular is a pure mechanical refactor and could be reverted independently of the other phases without disturbing them.
- **Single npm publish + GitHub Release for the bundle** instead of 3.

## Per-phase scope summary

### Phase 1: safeCreationTime DRY (F-CORE-015)
**Reads:** `.bee/audit-specs/bundles/medium/medium-safecreationtime-dry.md`

**Removes (11 files):**
- `function safeCreationTime` private declarations in: `activateFunctions.ts:20-22`, `addLiquidityFunctions.ts:17-19`, `coilFunctions.ts:30-32`, `crossChainFunctions.ts:11-13`, `dexFunctions.ts:16-18`, `guardFunctions.ts:19-21`, `kpayFunctions.ts:16-18`, `ouroFunctions.ts:118-120`, `pensionFunctions.ts:18-20`, `urStoaFunctions.ts:28-30`, `wrapFunctions.ts:25-27`.

**Adds (per file):**
- `safeCreationTime` to the existing `import { ... } from "../pact"` block (or a new `from "../pact"` import if the file doesn't already pull from it).

**Type:** Pure mechanical refactor (byte-identical behaviour). The function body is identical to the canonical `src/pact/format.ts:138-140`. `npm test` should pass with zero regressions because the behaviour is unchanged.

**Verify:** `grep -r "function safeCreationTime" src/` returns exactly one hit (canonical at `src/pact/format.ts:138-140`).

### Phase 2: Codex + foreign-key resolver contract (F-CORE-013 + F-CORE-014)
**Reads:** `.bee/audit-specs/bundles/medium/medium-codex-and-foreign-key-contract.md`

**Adds:**
- **Codec shape validation (F-CORE-013):** `src/codex/codec.ts:75-93` `deserializeCodex` gains runtime shape checks after the version check. Validates `kadenaWallets`/`ouronetWallets`/`addressBook` are arrays and `uiSettings` is an object. Throws domain-prefixed errors that name the bad field but do not echo its value (no info disclosure). Forward-compat: unknown extra fields survive the cast.
- **Foreign-key resolver pre-flight (F-CORE-014):** `src/signing/codexStrategy.ts:180-182` adds a pre-flight check — if the transaction requires a foreign-key signer AND `this.resolver.requestForeignKey` is undefined, throw a precise error before reaching `universalSignTransaction`. Recommended approach is **Option B** from the source audit-spec (minimal API surface change, clear error message).
- **JSDoc clarifications:** `src/signing/types.ts:62-69` `KeyResolver.requestForeignKey` JSDoc states "Optional in the interface; required at execute time when any guard requires a foreign key. Server resolvers should either implement-and-throw or omit the method (the strategy fails fast on first foreign-key need)."

**Type:** Additive (new validation throws on previously-flowing-through-broken inputs). Existing well-formed codex backups continue to deserialize. Existing resolvers WITH `requestForeignKey` continue to work. Server resolvers that omit `requestForeignKey` AND receive a foreign-key transaction now get a clear error instead of an opaque deep-stack failure.

**Files touched:**
- `src/codex/codec.ts:75-93`
- `src/signing/codexStrategy.ts:180-182`
- `src/signing/types.ts:62-69` (JSDoc only)

### Phase 3: Guard / Smart Account hardening (F-CORE-016a/b/c + F-CORE-017)
**Reads:** `.bee/audit-specs/bundles/medium/medium-guard-smart-account-hardening.md`

**Adds:**
- **F-CORE-016a — Tighten guard classification:** `classifyGuardKind` requires the FULL minimal shape per kind (capability needs `cgName` + `cgArgs` + `cgPactId`; user needs `fun` + `args`; keyset needs `pred` + `keys`; keyset-ref accepts either casing of the ref field).
- **F-CORE-016b — Casing normalization:** `normalizeKeysetRef` helper applied at the `resolveGuard` boundary so internal code only sees `keysetRef` (camelCase). Maps `keysetref` (lowercase chain-native) → `keysetRef` at the chain-IO boundary.
- **F-CORE-016c — State combinations documented:** `SmartAccountAuthPathsAnalysis` JSDoc enumerates the 4 reachable states (`firstSatisfied >= 0`; `firstSatisfied === -1 && anyKeyBased === true`; `firstSatisfied === -1 && anyKeyBased === false && anyKnownKind`; all-unknown). Optional `firstSignableButUnsatisfied: number` field added.
- **F-CORE-017 — Surface unknown predicates:** `computeThreshold` throws a typed `UnknownPredicateError` (Option B from source spec) that `analyzeGuard` catches and folds into a `predicateRecognized: false` bit on the returned analysis. Removes the silent `console.warn` (or routes via the future logger seam from `low-improvements.md`).

**Type:** Additive on the analysis result. Existing consumers branching on `firstSatisfied`/`anyKeyBased` keep working. Test fixtures may need updating where they pass under-specified guard shapes that currently classify as one of the four kinds — those tests are updated to use realistic shapes.

**Files touched:**
- `src/guard/smartAccountAuth.ts:84-106` (classifyGuardKind tightening)
- `src/guard/smartAccountAuth.ts:118-126` (casing normalization)
- `src/guard/smartAccountAuth.ts:209-240` (state docs + optional field)
- `src/guard/guardUtils.ts:76-79` (predicate recognition)

## Hard invariants (every phase)

- `tests/types.test.ts` v1.7.0 type-regression lock continues to pass at every phase boundary.
- `npm run typecheck` exit 0 at every phase.
- `npm test` exit 0 at every phase. Phase 1 should produce zero test count change (mechanical refactor); Phase 2 + Phase 3 should add at least 3 new test cases each.
- No new "Open handles" warnings.
- Public API: only ADDITIVE changes (new error class for unknown predicate, new analysis flag, new shape validation). No symbol renames, no removals.
- AUDIT.md tracks closure of F-CORE-013 / F-CORE-014 / F-CORE-015 / F-CORE-016a / F-CORE-016b / F-CORE-016c / F-CORE-017 at v2.3.0.
- CHANGELOG.md gets one `## 2.3.0 — YYYY-MM-DD` entry covering all 3 phases.
- README.md `## Status` block leads with v2.3.0 and the version history is extended.

## Out of scope (deferred to other audit-specs)

- F-CORE-007 (fabricated fallback values in read helpers — return-type widening is BREAKING) → standalone `high-error-fabricated-fallbacks.md`, ships LAST as v3.0.0 major.
- All HIGH-severity findings (F-CORE-009/010/011/012) → `bundles/high-additive/_bundle.md`, ships FIRST as v2.2.0.
- LOW improvements → `low-improvements.md` standalone (patch v2.3.1 after this bundle ships).
- F-BUG-001 (withFailover concurrency race surfaced during reliability-failover) — needs a new audit-spec written first.

## Implementation mode

**premium** — Opus on implementation + review. Phase 2 touches the codex import boundary (security-sensitive UX). Phase 3 changes guard classification semantics that drive Smart Ouronet Account auth (consumer-visible behaviour). Phase 1 is mechanical and would be safe on quality mode, but premium keeps the per-phase model uniform across the bundle.

## Phase ordering rationale

Phase 1 first because it's the lowest-risk, mechanical refactor — building confidence that the bundle's tooling pipeline is healthy before the contract-tightening work in Phases 2 and 3. Phase 2 second — independent of Phase 3, but the codec contract change is more localised (3 files) than the guard-classification work (which touches a broader test fixture surface). Phase 3 last because its test-fixture updates are the most extensive of the three.

No phase has a hard dependency on a prior phase's output — the ordering is risk-based, not dependency-based.

## Estimated phase count

3 phases, ~10-14 tasks total, 1-2 waves per phase. Compatible with `/bee:plan-all` + `/bee:ship` autonomous flow.

## Sequencing with sibling bundles

This bundle should ship **AFTER** `bundles/high-additive/_bundle.md` (v2.2.0) because:
- Conventional severity ordering: HIGH-tier security + test-coverage work lands first; MEDIUM-tier contract hardening follows.
- No structural dependency from this bundle to high-additive's output; the ordering is preference.
- Phase 3's predicate-recognition flag (F-CORE-017) interacts loosely with `low-improvements.md`'s F-CORE-022 (central logger seam) — the source spec notes the logger seam is a co-beneficiary. If the logger seam landed first the `console.warn` removal would be cleaner, but neither is a blocker for the other.

Recommended global sequence after this bundle: low-improvements (v2.3.1 patch) → high-error-fabricated-fallbacks (v3.0.0 major, ships LAST).
