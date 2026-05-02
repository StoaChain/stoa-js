# [UNIFIED-AUDIT-BUNDLE] 3 milestones consolidated from 2 loose audit-specs + 1 bundle (2026-05-02)

**Source:** Unification of `.bee/audit-specs/` produced by `/bee:unify-audit-specs` on 2026-05-02. Source audit-specs are preserved alongside this file at `.bee/audit-specs-unified/2026-05-02-comprehensive/`.

**Milestone count:** 3
**Total findings closed across all milestones:** 14 (7 MEDIUM + 6 LOW + 1 HIGH-representative covering ~25 sites)
**Recommended consumption:** process milestones one at a time via `/bee:new-spec --from-discussion`. Each milestone is a self-contained shipping unit with its own version target and phase set. Three distinct ship cycles → three distinct npm releases (v2.3.0 → v2.3.1 → v3.0.0) → clean release boundaries.

## Milestones overview

| # | Milestone | Version target | Severity | Source | # specs | # findings | Type |
|---|-----------|----------------|----------|--------|---------|------------|------|
| 1 | medium-bundle | **v2.3.0 minor** | MEDIUM | `bundles/medium/` | 3 | 7 | additive |
| 2 | low-improvements | **v2.3.1 patch** | LOW | loose `low-improvements.md` | 1 | 6 | output-preserving polish |
| 3 | high-error-fabricated-fallbacks | **v3.0.0 major** | HIGH | loose `high-error-fabricated-fallbacks.md` | 1 | 1 (representative; ~25 site catalog) | **BREAKING** (return-type widens) |

## Sequencing strategy

Recommended order: **M1 → M2 → M3**

Rationale (per the `audit-specs-bundling` skill's cross-bundle sequencing rules + per-bundle "Sequencing with sibling bundles" sections):

- **M1 (MEDIUM, additive) ships FIRST** — smallest blast radius among shippable additive batches. Closes the entire MEDIUM tier from the 2026-04-30 audit cycle in one ship. Three phases, no file-ownership conflicts, premium implementation mode.
- **M2 (LOW, polish) ships SECOND** — once MEDIUM is stable, the polish/observability work lands cleanly. F-CORE-022 (central logger seam) is high-leverage despite its LOW rating: it directly enables future `console.error` removals already cited as "wires into the future logger seam" in M1's Phase 3 (F-CORE-017) and M3's catch blocks (F-CORE-007). Landing the seam in M2 unblocks cleaner observability everywhere downstream.
- **M3 (HIGH, breaking) ships LAST** — major version bump to v3.0.0. Consumers (OuronetUI, AncientHolder HUB) must update call sites to handle `null`. Isolated to its own release so M1 and M2 can ship without forcing a major bump on consumers first.

Cross-bundle dependency citations:
- M1 (`bundles/medium/_bundle.md`) cites: "Recommended global sequence after this bundle: low-improvements (v2.3.1 patch) → high-error-fabricated-fallbacks (v3.0.0 major, ships LAST)." — preserved here.
- M2 (`low-improvements.md`) cites F-CORE-022 as the leverage finding: "landing the seam unblocks the `console.error` removals in F-CORE-009 (security) and F-CORE-007 (error handling)." — F-CORE-009 already shipped in v2.2.0; F-CORE-007 is M3.
- M3 (`high-error-fabricated-fallbacks.md`) cites F-CORE-007 as the representative finding for a broader pattern of ~25 empty-catch sites across `src/interactions/*`.

No cross-bundle ordering overrides are needed; the default severity-based sequence (MEDIUM → LOW → HIGH-breaking) is what the source bundles also recommend.

## Global hard invariants (apply to every milestone)

- `tests/types.test.ts` v1.7.0 type-regression lock continues to pass at every milestone boundary.
- `npm run typecheck` exit 0 at every milestone.
- `npm test` exit 0 at every milestone (sole allowed non-zero exit: the documented Windows-locale `tests/gas.test.ts > formatMaxFee` failure locked from v2.1.2).
- `npm run build` exit 0 at every milestone; `dist/` includes the milestone's deliverables.
- No new "Open handles" warnings.
- `.github/workflows/publish.yml` 3-check version-parity gate passes at every milestone (Status block, version-history paragraph, CHANGELOG first heading all reference the milestone's version).
- AUDIT.md (or CHANGELOG `### Fixed`/`### Rejected` sections — current convention) tracks closure of each milestone's findings at the milestone's target version.
- CHANGELOG.md gets one `## {version} — YYYY-MM-DD` entry per milestone, format mirroring v2.2.0's Lead/Added/Fixed/Rejected/Stats structure.
- README.md `## Status` block leads with the milestone's version; version history paragraph extended; submodule table row updated if the milestone changes a public surface; test-count refreshed.

## Implementation guidance

For each milestone, the user can choose to:

**(a) Process all milestones together** — one giant spec with phases for each milestone. `/bee:ship` runs through everything, one big release. **Risky for M3 (breaking)**; only safe if all milestones were output-preserving. NOT RECOMMENDED for this unification because M3 is breaking — it should ship as a separate v3.0.0 major to give consumers time to update.

**(b) Process one milestone at a time (Recommended)** — `/bee:new-spec --from-discussion .bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md` and at the decomposition check pick "Milestone 1 only". Ship as v2.3.0, archive, then re-run for Milestone 2 → v2.3.1, then Milestone 3 → v3.0.0. Three specs over time, each tied to one release, each with its own atomic-ship contract.

**(c) Skip ahead to a specific milestone** — same as (b) but pick a non-first milestone. Useful if the user wants to ship M2 (LOW polish + logger seam) BEFORE M1 to unblock observability work; the source bundle ordering is recommendation, not requirement.

Source audit-specs are preserved in this folder. Each milestone's "Source" reference points to either:
- A bundle subfolder (read its `_bundle.md` for full per-phase scope)
- A loose audit-spec file (read directly for findings)

---

## Milestone 1: medium-bundle (v2.3.0 minor)

**Source bundle:** `bundles/medium/_bundle.md` (full discussion preserved alongside)
**Severity:** MEDIUM (× 3 specs, 7 underlying findings: F-CORE-013 / F-CORE-014 / F-CORE-015 / F-CORE-016a / F-CORE-016b / F-CORE-016c / F-CORE-017)
**Type:** additive (shape validation throws on malformed codex import, foreign-key resolver throws explicit error pre-flight, guard-classification rejects malformed inputs that previously silently mis-classified, predicate-recognition flag added to analysis result; no public API removed; no return-type widening; one DRY refactor with byte-identical behaviour)
**Estimated phase count:** 3 phases, ~10-14 tasks total, 1-2 waves per phase.

### Bundle composition

| Phase | Source audit-spec | Findings | Type |
|-------|------------------|----------|------|
| 1 | `medium-safecreationtime-dry.md` | F-CORE-015 | Pure mechanical refactor (zero behavior change) |
| 2 | `medium-codex-and-foreign-key-contract.md` | F-CORE-013 + F-CORE-014 | Additive: shape validation + explicit foreign-key error |
| 3 | `medium-guard-smart-account-hardening.md` | F-CORE-016a + F-CORE-016b + F-CORE-016c + F-CORE-017 | Additive: tighter classification + casing normalization + state docs + predicate-recognition flag |

### Why these together

- **All MEDIUM-tier from the same 2026-04-30 audit cycle.** Closes 3 of the remaining 3 MEDIUM specs in one ship.
- **No file-ownership conflicts between phases:**
  - Phase 1: 11 files in `src/interactions/*` (delete `function safeCreationTime` declarations) + each of those files' `../pact` imports.
  - Phase 2: `src/codex/codec.ts`, `src/signing/codexStrategy.ts`, `src/signing/types.ts` (JSDoc only on KeyResolver).
  - Phase 3: `src/guard/smartAccountAuth.ts`, `src/guard/guardUtils.ts`.
  Zero overlap. Phase 1 exclusively touches `src/interactions/*`; Phases 2 and 3 don't touch `src/interactions/` at all.
- **Independent rollback granularity preserved by separate phases.** Phase 1 in particular is a pure mechanical refactor and could be reverted independently of the other phases without disturbing them.
- **Single npm publish + GitHub Release for the bundle** instead of 3.

### Per-phase scope summary

#### Phase 1: safeCreationTime DRY (F-CORE-015)
**Reads:** `bundles/medium/medium-safecreationtime-dry.md`

**Removes (11 files):** `function safeCreationTime` private declarations in: `activateFunctions.ts:20-22`, `addLiquidityFunctions.ts:17-19`, `coilFunctions.ts:30-32`, `crossChainFunctions.ts:11-13`, `dexFunctions.ts:16-18`, `guardFunctions.ts:19-21`, `kpayFunctions.ts:16-18`, `ouroFunctions.ts:118-120`, `pensionFunctions.ts:18-20`, `urStoaFunctions.ts:28-30`, `wrapFunctions.ts:25-27`.

**Adds (per file):** `safeCreationTime` to the existing `import { ... } from "../pact"` block (or a new `from "../pact"` import if the file doesn't already pull from it).

**Type:** Pure mechanical refactor (byte-identical behaviour). The function body is identical to the canonical `src/pact/format.ts:138-140`. `npm test` should pass with zero regressions because the behaviour is unchanged.

**Verify:** `grep -r "function safeCreationTime" src/` returns exactly one hit (canonical at `src/pact/format.ts:138-140`).

#### Phase 2: Codex + foreign-key resolver contract (F-CORE-013 + F-CORE-014)
**Reads:** `bundles/medium/medium-codex-and-foreign-key-contract.md`

**Adds:**
- **Codec shape validation (F-CORE-013):** `src/codex/codec.ts:75-93` `deserializeCodex` gains runtime shape checks after the version check. Validates `kadenaWallets`/`ouronetWallets`/`addressBook` are arrays and `uiSettings` is an object. Throws domain-prefixed errors that name the bad field but do not echo its value (no info disclosure). Forward-compat: unknown extra fields survive the cast.
- **Foreign-key resolver pre-flight (F-CORE-014):** `src/signing/codexStrategy.ts:180-182` adds a pre-flight check — if the transaction requires a foreign-key signer AND `this.resolver.requestForeignKey` is undefined, throw a precise error before reaching `universalSignTransaction`. Recommended approach is **Option B** from the source audit-spec.
- **JSDoc clarifications:** `src/signing/types.ts:62-69` `KeyResolver.requestForeignKey` JSDoc states "Optional in the interface; required at execute time when any guard requires a foreign key. Server resolvers should either implement-and-throw or omit the method (the strategy fails fast on first foreign-key need)."

**Type:** Additive (new validation throws on previously-flowing-through-broken inputs). Existing well-formed codex backups continue to deserialize. Existing resolvers WITH `requestForeignKey` continue to work. Server resolvers that omit `requestForeignKey` AND receive a foreign-key transaction now get a clear error instead of an opaque deep-stack failure.

**Files touched:** `src/codex/codec.ts:75-93`, `src/signing/codexStrategy.ts:180-182`, `src/signing/types.ts:62-69` (JSDoc only).

#### Phase 3: Guard / Smart Account hardening (F-CORE-016a/b/c + F-CORE-017)
**Reads:** `bundles/medium/medium-guard-smart-account-hardening.md`

**Adds:**
- **F-CORE-016a — Tighten guard classification:** `classifyGuardKind` requires the FULL minimal shape per kind (capability needs `cgName` + `cgArgs` + `cgPactId`; user needs `fun` + `args`; keyset needs `pred` + `keys`; keyset-ref accepts either casing of the ref field).
- **F-CORE-016b — Casing normalization:** `normalizeKeysetRef` helper applied at the `resolveGuard` boundary so internal code only sees `keysetRef` (camelCase). Maps `keysetref` (lowercase chain-native) → `keysetRef` at the chain-IO boundary.
- **F-CORE-016c — State combinations documented:** `SmartAccountAuthPathsAnalysis` JSDoc enumerates the 4 reachable states. Optional `firstSignableButUnsatisfied: number` field added.
- **F-CORE-017 — Surface unknown predicates:** `computeThreshold` throws a typed `UnknownPredicateError` (Option B from source spec) that `analyzeGuard` catches and folds into a `predicateRecognized: false` bit on the returned analysis. Removes the silent `console.warn` (or routes via the future logger seam from M2's F-CORE-022).

**Type:** Additive on the analysis result. Existing consumers branching on `firstSatisfied`/`anyKeyBased` keep working. Test fixtures may need updating where they pass under-specified guard shapes that currently classify as one of the four kinds.

**Files touched:** `src/guard/smartAccountAuth.ts:84-106` (classify tightening), `:118-126` (casing norm), `:209-240` (state docs + optional field), `src/guard/guardUtils.ts:76-79` (predicate recognition).

### Hard invariants (this milestone, beyond global)

- `tests/types.test.ts` v1.7.0 type-regression lock passes at every phase boundary.
- Phase 1 should produce zero test count change (mechanical refactor); Phase 2 + Phase 3 should add at least 3 new test cases each.
- Public API: only ADDITIVE changes (new error class for unknown predicate, new analysis flag, new shape validation). No symbol renames, no removals.
- AUDIT.md tracks closure of F-CORE-013/014/015/016a/016b/016c/017 at v2.3.0.

### Out of scope (deferred to other milestones)

- F-CORE-007 (fabricated fallback values in read helpers) → **M3** v3.0.0 (BREAKING).
- LOW improvements (F-CORE-018a/018b/019/020/021/022) → **M2** v2.3.1.
- HIGH-additive (F-CORE-009/011/012) → already shipped in v2.2.0.

### Implementation mode

**premium** — Opus on implementation + review. Phase 2 touches the codex import boundary (security-sensitive UX). Phase 3 changes guard classification semantics that drive Smart Ouronet Account auth (consumer-visible behaviour).

### Phase ordering rationale

Phase 1 first (lowest-risk mechanical refactor) → Phase 2 (localized codec contract) → Phase 3 (broader test-fixture surface). Risk-based, not dependency-based.

---

## Milestone 2: low-improvements (v2.3.1 patch)

**Source:** 1 loose audit-spec (`low-improvements.md`) — synthesized into one milestone (no pre-existing bundle).
**Severity:** LOW (× 1 spec, 6 underlying findings: F-CORE-018a / F-CORE-018b / F-CORE-019 / F-CORE-020 / F-CORE-021 / F-CORE-022)
**Type:** output-preserving polish (documentation drift, observability cleanup, dead-code removal, central logger seam)
**Estimated phase count:** 1-3 phases depending on grouping (suggested 3 — see below).

### Bundle composition

| Phase | Source finding(s) | Files | Type |
|-------|------------------|-------|------|
| 1 | F-CORE-018a + F-CORE-018b | `README.md`, `.bee/CONTEXT.md` | Documentation refresh |
| 2 | F-CORE-019 + F-CORE-021 | `src/interactions/ouroFunctions.ts`, `src/interactions/addLiquidityFunctions.ts` | Catch-block consistency + dead-code removal |
| 3 | F-CORE-020 + F-CORE-022 | `src/reads/pactReader.ts`, `src/reads/rawCalibratedRead.ts`, NEW `src/observability/logger.ts`, ~25 console.* call sites across 8 files | Tier-semantics docs + central logger seam |

### Why these together

- **All LOW-tier from the 2026-04-30 audit cycle.** Closes the entire LOW backlog in one ship.
- **No file-ownership conflicts between phases.** Phase 1 = docs only. Phase 2 = `src/interactions/*`. Phase 3 = `src/reads/*` + new `src/observability/*` + console.* sweep across `src/network/`, `src/crypto/`, `src/guard/`, `src/interactions/` (the sweep replaces existing call sites, doesn't introduce conflicts).
- **F-CORE-022 (central logger seam) is high-leverage despite its LOW rating.** Source audit-spec line 73-75: "This change has more leverage than its LOW rating implies — it directly enables the `console.error` removals in F-CORE-007, F-CORE-009, and F-CORE-019." F-CORE-009 shipped in v2.2.0 with console.* removed inline; F-CORE-019 closes here automatically when the seam lands; F-CORE-007 (M3) wires through the seam if it ships before M3.
- **Single npm publish + GitHub Release** for all the polish in one go.

### Per-phase scope summary

#### Phase 1: Documentation refresh (F-CORE-018a + F-CORE-018b)
**Adds:**
- **README version table:** updated header version table from 1.3.0/1.4.0 baseline to current (post-v2.2.0 reality). Cross-reference CHANGELOG for per-version detail.
- **CONTEXT.md interactions section:** describes the v1.4-v1.6 additions (`AccountSelectorData` `public-key`/`sovereign`/`governor` fields, Leto/Artemis/Apollo re-exports + `createGen1Primitive` factory, Smart Ouronet Account auth-path resolution primitives + `buildRotateSovereignPactCode`).

**Note:** May be redone wholesale by `/bee:refresh-context` if that command is run after subsequent code changes — coordinate timing with maintainer.

#### Phase 2: Catch-block consistency + dead code (F-CORE-019 + F-CORE-021)
**Adds:**
- **F-CORE-019:** Pick one convention (recommended: log nothing, let the future logger seam from F-CORE-022 in Phase 3 handle observability) and apply to all catch blocks in `ouroFunctions.ts`. If sequenced after Phase 3 (when logger seam lands), wire to `getLogger()` instead.
- **F-CORE-021:** Drop the outer `try/catch (error) { return { hasFrozenLP: false, hasSleepingLP: false }; }` at `addLiquidityFunctions.ts:285-287`. Promise.all of two never-rejecting promises cannot itself reject; the outer catch is unreachable. Recommendation **A** (drop) over B (comment as belt-and-braces).

#### Phase 3: Tier semantics + central logger seam (F-CORE-020 + F-CORE-022)
**Adds:**
- **F-CORE-020:** Update JSDoc on `pactReader.ts` and `rawCalibratedRead.ts` listing canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static). Document that the default reader ignores `tier` and consumers wanting cache must call `setPactReader`. Optionally add a `process.env.NODE_ENV === "development"` warning when a `tier`-less call hits `pactRead`.
- **F-CORE-022:** New `src/observability/logger.ts` mirroring the `setPactReader` pattern. Exports `Logger` type, `setLogger(logger: Logger): void`, `getLogger(): Logger`. Default routes to `console.warn`/`console.error`. Replace every `console.warn` and `console.error` in `src/` with `getLogger().warn(...)` / `.error(...)`. New `./observability` subpath added to `package.json` exports.

**Type:** Output-preserving — default reader behaviour unchanged; default logger routes to console (existing behaviour). `setLogger`-aware consumers (HUB/OuronetUI) gain ability to route log events through their own facility (Sentry, structured stdout, etc.) without OuronetCore changes.

### Hard invariants (this milestone, beyond global)

- New tests for the logger seam: default routes to console; `setLogger` swaps; `setLogger(null!)` is rejected.
- `package.json` `./observability` export added with proper types/import map.
- All `console.warn` / `console.error` calls in `src/` route through `getLogger()` (verifiable via `grep -nE "console\.(warn|error)" src/` returning ZERO matches).
- AUDIT.md tracks closure of F-CORE-018a/018b/019/020/021/022 at v2.3.1.

### Out of scope (deferred to other milestones)

- F-CORE-007 (BREAKING fabricated-fallback fix) → **M3** v3.0.0.
- F-CORE-013 through F-CORE-017 → **M1** v2.3.0 (already shipped if M1 lands first).
- F-CORE-009 already shipped in v2.2.0 (console.* removal landed inline; this milestone just routes whatever console calls remain through the seam).

### Implementation mode

**premium** — for the logger seam contract design. The seam mirrors `setPactReader` so the implementation is mechanical, but the contract surface (Logger type, `setLogger(null!)` rejection, default-routing semantics) is consumer-facing.

### Phase ordering rationale

Phase 1 first (docs-only, no risk). Phase 2 second (interaction-file cleanup, can land independently). Phase 3 third because the logger seam touches `package.json` exports and the new subpath wants a clean prior state. Phases 2 and 3 could be reordered if convenience dictates — Phase 2's `console.error` removals will need re-routing through `getLogger()` if Phase 3 ships first.

### Sequencing with sibling milestones

This milestone should ship **AFTER** M1 (v2.3.0) because:
- Severity ordering: MEDIUM-tier closures land first, LOW polish follows.
- M1's Phase 3 F-CORE-017 says "Removes the silent `console.warn` (or routes via the future logger seam from `low-improvements.md`)" — if M2's Phase 3 logger seam lands before M1's Phase 3, the F-CORE-017 implementation is cleaner. But this is a preference, not a hard dependency.
- No structural blocker either way.

This milestone should ship **BEFORE** M3 (v3.0.0) because:
- M3's F-CORE-007 fix removes `console.error` calls per the source spec line 87. If M2's logger seam exists, F-CORE-007 wires through `getLogger().error(...)`. If M2 ships after M3, F-CORE-007 just removes the console call inline (less consistent but functional).

---

## Milestone 3: high-error-fabricated-fallbacks (v3.0.0 major — BREAKING)

**Source:** 1 loose audit-spec (`high-error-fabricated-fallbacks.md`) — synthesized into one milestone (no pre-existing bundle).
**Severity:** HIGH (× 1 spec, 1 representative finding F-CORE-007; ~25-site catalog of empty-catch sites across `src/interactions/*`)
**Type:** **BREAKING** (return type widens `Promise<number>` → `Promise<number | null>` for 3 functions; consumers must update call sites)
**Estimated phase count:** 1-2 phases (suggested 2: representative fix + catalog sweep).

### Bundle composition

| Phase | Source finding(s) | Files | Type |
|-------|------------------|-------|------|
| 1 | F-CORE-007 (3 representative functions) | `src/interactions/ouroFunctions.ts`, `src/interactions/dexFunctions.ts` | **BREAKING** return-type widening |
| 2 (optional) | Catalog sweep of remaining ~22 empty-catch sites | `src/interactions/dexFunctions.ts`, `src/interactions/addLiquidityFunctions.ts`, `src/interactions/ouroFunctions.ts`, `src/interactions/urStoaFunctions.ts` | Same BREAKING pattern, broader scope |

### Why isolated as its own milestone

- **BREAKING change requires a major version bump.** Strict semver per CLAUDE.md "Versioning discipline" — return type widening from `Promise<number>` to `Promise<number | null>` forces consumers to handle the null case. Cannot land in a minor or patch.
- **Cannot bundle with additive changes.** Mixing breaking + additive in one ship would force consumers to deal with both at once unnecessarily.
- **Ships LAST so consumers (OuronetUI, AncientHolder HUB) can adopt v2.3.0 + v2.3.1 transparently first**, then plan their migration to v3.0.0 deliberately.

### Per-phase scope summary

#### Phase 1: Representative fix (F-CORE-007)

**Locations to change:**
| File | Lines | Function | Current fabricated value | New return |
|------|-------|----------|--------------------------|------------|
| `src/interactions/ouroFunctions.ts` | 2042-2054 | `getStoaPriceUSD` | `1.0` on every failure | `null` on every failure |
| `src/interactions/dexFunctions.ts` | 1308 | `getTokenDecimals` | `8` on every failure | `null` on every failure |
| `src/interactions/dexFunctions.ts` | 1346-1349 | `getPoolTotalFee` | `0` on every failure | `null` on every failure |

**Pattern:** Convert each function from "swallow + sentinel" to "return null on failure" (Option B from source spec — smaller blast radius than discriminated union; consumers branch on `null` vs the value).

```ts
// Before:
export async function getStoaPriceUSD(): Promise<number> {
  try {
    const r = await pactRead(...);
    if (r.result.status === "success") return Number(r.result.data) || 1.0;
    return 1.0;
  } catch { return 1.0; }
}

// After (Option B):
export async function getStoaPriceUSD(): Promise<number | null> {
  try {
    const r = await pactRead(...);
    if (r.result.status !== "success") return null;
    const value = Number(r.result.data);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
```

**Drop `console.error` calls inside catches.** If M2 (logger seam) shipped first, route through `getLogger().error(...)`. Otherwise silent failure with `null` return.

**New test file:** `tests/interactions-pricing.test.ts` mocks a failing reader and asserts each function returns `null` rather than `1.0` / `8` / `0`. At minimum 3 it-blocks (one per function).

#### Phase 2 (optional): Catalog sweep

The 3 representative functions are the highest-impact (their values feed user-facing financial math). The audit catalogued ~22 additional empty-catch sites that follow the same pattern. Phase 2 sweeps these:

- `src/interactions/dexFunctions.ts:261, 1318, 1512, 1523, 1533, 1543, 1589, 1633, 1911, 1931`
- `src/interactions/addLiquidityFunctions.ts:256, 274, 939`
- `src/interactions/ouroFunctions.ts:1842, 1860, 1877, 1894, 2108, 2122, 2135, 2286`
- `src/interactions/urStoaFunctions.ts:55, 102, 520`

For each, decide: keep as fabricated-value (audit accepted) or convert to `null` return. The audit-spec doesn't strictly mandate Phase 2 — it's "in scope as a secondary task." Maintainer can scope this aggressively (Phase 1 only) or comprehensively (Phase 1 + Phase 2). For a major bump, comprehensive sweep is the higher-quality option.

### Hard invariants (this milestone, beyond global)

- `package.json` version bumps to `3.0.0` (major, not minor or patch).
- CHANGELOG.md gets a `## 3.0.0 — YYYY-MM-DD` entry with prominent **breaking change** call-out + migration note explaining how consumers update call sites.
- README.md `## Status` block leads with v3.0.0 + breaking-change banner.
- New `tests/interactions-pricing.test.ts` exists with at minimum 3 it-blocks (one per Phase 1 function).
- A follow-up GitHub issue is filed in OuronetUI (and AncientHolder HUB if applicable) cataloguing call sites of the changed functions; consumers track the migration deliberately.

### Out of scope

- M1 + M2 findings (assumed already shipped in v2.3.0 + v2.3.1 before this milestone lands).

### Implementation mode

**premium** — Opus on implementation + review. Breaking change to consumer-facing financial-math functions; maintainer wants thorough review of every renamed return type and each test assertion.

### Phase ordering rationale

Phase 1 alone is sufficient to close the audit finding (F-CORE-007 was rated HIGH because the 3 representative functions feed user-facing financial calculations). Phase 2 is "in scope as a secondary task" per the source audit-spec — maintainer's call whether to bundle it.

### Sequencing with sibling milestones

This milestone should ship **LAST** because:
- Major version bump isolates breaking change to its own release.
- Consumers (OuronetUI, AncientHolder HUB) update call sites in a deliberate migration window, not piggybacked onto a feature release.
- M1 (v2.3.0) + M2 (v2.3.1) ship transparently to consumers first — they get bug fixes and observability without needing to handle null returns.

---

## Footer: provenance + tooling

This `_unified.md` was produced by `/bee:unify-audit-specs` on 2026-05-02. The command's behavior is documented in:
  `~/.claude/plugins/cache/bee-dev/bee/4.3.0/commands/unify-audit-specs.md`

To regenerate this unification (different slug, re-classification, etc.):
- Move source files back from `audit-specs-unified/2026-05-02-comprehensive/` to `audit-specs/`
- Re-run `/bee:unify-audit-specs --slug <new-name>`

To process a milestone:
  `/bee:new-spec --from-discussion .bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md`

The discovery loop's decomposition check sees 3 milestones and offers:
- "Milestone 1 (medium-bundle, v2.3.0) only" — Recommended for clean release boundaries
- "All milestones together" — NOT recommended (M3 is breaking)
- Pick a specific milestone (M2 or M3 first if user wants out-of-order shipping)

To file a milestone after `/bee:archive-spec`:
  the `audit-specs-lifecycle` skill files the consumed milestone into `.bee/audit-specs-done/{archive-date}-{milestone-slug}/`. For M1 (bundle), the entire `bundles/medium/` subfolder moves. For M2/M3 (loose specs), just the single `.md` file moves.

After all 3 milestones in this unification have been processed (M1 → v2.3.0 ships → M2 → v2.3.1 ships → M3 → v3.0.0 ships), this `2026-05-02-comprehensive/` folder remains as a historical artifact. The next `/bee:audit` produces fresh files in `.bee/audit-specs/`, and the next `/bee:unify-audit-specs` creates a new dated folder under `audit-specs-unified/`.
