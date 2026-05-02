# Requirements: medium-and-low-audit-closures

## Initial Description

Ship v2.3.0 minor (additive) closing the entire MEDIUM tier (M1, 7 findings) AND the entire LOW tier (M2, 6 findings) from the 2026-04-30 audit cycle. The bundle source is `.bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md`. M3 (high-error-fabricated-fallbacks, BREAKING) is deferred to a separate v3.0.0 spec.

This spec covers 13 audit-finding closures across two milestones combined into one ship:

**MEDIUM tier (M1 — 3 phases, 7 findings):**
- Phase 1: F-CORE-015 — `safeCreationTime` DRY refactor (mechanical, byte-identical)
- Phase 2: F-CORE-013 + F-CORE-014 — codex shape validation + foreign-key resolver pre-flight (additive contract tightening)
- Phase 3: F-CORE-016a/b/c + F-CORE-017 — guard / Smart Account hardening (additive analysis enhancements + new typed error class)

**LOW tier (M2 — 3 phases, 6 findings):**
- Phase 4: F-CORE-018a + F-CORE-018b — documentation refresh (README version table + CONTEXT.md interactions section)
- Phase 5: F-CORE-019 + F-CORE-021 — catch-block consistency in ouroFunctions.ts + drop unreachable outer try/catch in addLiquidityFunctions.ts
- Phase 6: F-CORE-020 + F-CORE-022 — tier-semantics JSDoc + new central logger seam (`src/observability/logger.ts` mirroring `setPactReader` pattern, exported via new `./observability` subpath)

**Phase 7 — Release artifacts:** package.json 2.2.0→2.3.0; CHANGELOG `## 2.3.0` entry; README maintenance-rule updates; verification gate.

All 13 findings are additive: new validation throws on previously-flowing-through-broken inputs; new analysis flags; new error classes; new JSDoc; one mechanical refactor with byte-identical behavior; one new public surface (logger seam) at a new subpath. No public API removed; no return-type widening; no breaking changes.

## Requirements Discussion

This spec was created via `--from-discussion .bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md`. The unified bundle was produced by `/bee:unify-audit-specs` on 2026-05-02 from 2 loose audit-specs + 1 pre-existing bundle. The discussion is recorded as Q&A for traceability:

### Questions & Answers

**Q1:** Three milestones in the unified bundle (M1 medium → v2.3.0, M2 low → v2.3.1, M3 high-breaking → v3.0.0). Which to spec first?
**A1:** **M1 + M2 combined in this spec.** Both are additive — bundling them is safe. M3 deferred to a separate spec because it's BREAKING (return-type widening on 3 financial-math functions); shipping it as a separate v3.0.0 lets consumers (OuronetUI, AncientHolder HUB) adopt M1+M2 transparently first, then plan their migration to v3.0.0 deliberately.

**Q2:** Version target for the combined M1+M2 ship?
**A2:** **v2.3.0 minor.** Both M1 and M2 are additive — one minor bump covers both. v2.3.1 effectively skipped. Next bump after this spec is M3 → v3.0.0 major.

**Q3:** Phase strategy?
**A3:** **7-phase structure.** M1 phases 1-3 (safeCreationTime DRY, codex+resolver contract, guard hardening), M2 phases 4-6 (docs refresh, catch-block cleanup, tier-semantics + logger seam), release artifacts phase 7. Granular phase boundaries match plan-all + ship's atomic-task-tracking model.

**Q4:** Implementation mode?
**A4:** **Premium** (Opus everything). Both source bundles specify premium — Phase 2 touches the codex import boundary (security-sensitive UX); Phase 3 changes guard classification semantics that drive Smart Ouronet Account auth (consumer-visible behavior); Phase 6's logger-seam contract surface is consumer-facing.

**Q5:** Use locked decisions from the audit-spec sources, or re-litigate?
**A5:** **Use as starting point.** All file paths, line numbers, finding IDs, and per-phase scope are already locked in the audit-spec sources (each finding has a CITED location in the codebase). Re-litigating wastes time on a fast-path discovery flow.

### Existing Code to Reference

From the unified-bundle's per-milestone scope sections (each cites locations verified during the original 2026-04-30 audit):

#### M1 Phase 1 — F-CORE-015 safeCreationTime DRY
- **Canonical (KEEP):** `Z:/OuronetCore/src/pact/format.ts:138-140` `function safeCreationTime` — single source of truth.
- **Duplicates to remove (11 files):**
  - `src/interactions/activateFunctions.ts:20-22`
  - `src/interactions/addLiquidityFunctions.ts:17-19`
  - `src/interactions/coilFunctions.ts:30-32`
  - `src/interactions/crossChainFunctions.ts:11-13`
  - `src/interactions/dexFunctions.ts:16-18`
  - `src/interactions/guardFunctions.ts:19-21`
  - `src/interactions/kpayFunctions.ts:16-18`
  - `src/interactions/ouroFunctions.ts:118-120`
  - `src/interactions/pensionFunctions.ts:18-20`
  - `src/interactions/urStoaFunctions.ts:28-30`
  - `src/interactions/wrapFunctions.ts:25-27`

#### M1 Phase 2 — F-CORE-013 + F-CORE-014
- **F-CORE-013:** `src/codex/codec.ts:75-93` `deserializeCodex` — adds runtime shape validation after the version check.
- **F-CORE-014:** `src/signing/codexStrategy.ts:180-182` — pre-flight check for `requestForeignKey` resolver method.
- **F-CORE-014 (JSDoc):** `src/signing/types.ts:62-69` `KeyResolver.requestForeignKey` JSDoc clarification.

#### M1 Phase 3 — F-CORE-016a/b/c + F-CORE-017
- **F-CORE-016a:** `src/guard/smartAccountAuth.ts:84-106` `classifyGuardKind` — tighten minimal shape per kind.
- **F-CORE-016b:** `src/guard/smartAccountAuth.ts:118-126` `normalizeKeysetRef` helper at `resolveGuard` boundary.
- **F-CORE-016c:** `src/guard/smartAccountAuth.ts:209-240` `SmartAccountAuthPathsAnalysis` JSDoc + optional `firstSignableButUnsatisfied: number` field.
- **F-CORE-017:** `src/guard/guardUtils.ts:76-79` `computeThreshold` throws new `UnknownPredicateError` (typed class); `analyzeGuard` catches and folds into `predicateRecognized: false` flag.

#### M2 Phase 4 — F-CORE-018a + F-CORE-018b
- **F-CORE-018a:** `Z:/OuronetCore/README.md` — header version table refresh (currently lags behind v1.6.x; should update to current v2.2.0 + cross-reference CHANGELOG).
- **F-CORE-018b:** `Z:/OuronetCore/.bee/CONTEXT.md` — interactions section refresh (missing v1.4-v1.6 additions: `AccountSelectorData` `public-key`/`sovereign`/`governor` fields; Leto/Artemis/Apollo re-exports + `createGen1Primitive` factory; Smart Ouronet Account auth-path resolution primitives + `buildRotateSovereignPactCode` builder).

#### M2 Phase 5 — F-CORE-019 + F-CORE-021
- **F-CORE-019:** `src/interactions/ouroFunctions.ts` — silent-vs-logging catch inconsistency at lines 1842, 1860, 1877, 1894 (silent) vs 1916, 2069, 2088 (logging). Convention LOCKED to route-via-`getLogger().error(...)` per REQ-10 (I-004 iter 1 lock); the original audit-spec's "recommended: silent" option is REJECTED. Phase 5 has a HARD source-level dependency on Phase 6's `src/observability/{index.ts,logger.ts}` files.
- **F-CORE-021:** `src/interactions/addLiquidityFunctions.ts` `getLPTypeInfo` — outer try/catch is dead code (Promise.all of two never-rejecting promises cannot itself reject). Drop it. **Line numbers (cross-plan auto-fix iter 1 per CI-001):** the audit-spec source cited lines 285-287 but the actual file currently has the function at line 218 with outer `try {` at line 219 and outer `} catch (error) { return { hasFrozenLP: false, hasSleepingLP: false }; }` at lines 255-257 (file shifted between audit time and spec creation). All TASKS.md references should structurally anchor on the function name `getLPTypeInfo` rather than absolute line numbers; Phase 1's safeCreationTime DRY refactor will further shift lines. Phase 5 T5.2 anchors the edit by structure ("immediately after `export async function getLPTypeInfo`...").

#### M2 Phase 6 — F-CORE-020 + F-CORE-022
- **F-CORE-020:** `Z:/OuronetCore/src/reads/rawCalibratedRead.ts:40-46` — JSDoc clarifying that `tier` is accepted-and-ignored by the default reader; cross-reference to `setPactReader` for cache-aware consumers.
- **F-CORE-020:** `Z:/OuronetCore/src/reads/pactReader.ts` — JSDoc listing canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static).
- **F-CORE-022:** **NEW FILE** `Z:/OuronetCore/src/observability/logger.ts` — central logger seam mirroring `setPactReader` pattern. Exports `Logger` type, `setLogger(logger: Logger): void`, `getLogger(): Logger`. Default routes to `console.warn`/`console.error`.
- **F-CORE-022:** Sweep all `console.warn` / `console.error` calls in `src/` (across `src/network/nodeFailover.ts`, `src/crypto/v1.ts` (any remaining), `src/guard/guardUtils.ts`, `src/interactions/ouroFunctions.ts`, ~25 hits across 8 files per audit-spec) and route them through `getLogger().warn(...)` / `.error(...)`.
- **F-CORE-022:** `Z:/OuronetCore/package.json` — add new `./observability` subpath export pointing at `dist/observability/index.js` + `dist/observability/index.d.ts`.

#### Phase 7 — Release artifacts
- `Z:/OuronetCore/package.json` — version 2.2.0 → 2.3.0
- `Z:/OuronetCore/CHANGELOG.md` — prepend `## 2.3.0 — YYYY-MM-DD` entry with Lead/Added/Fixed sections covering all 13 finding closures
- `Z:/OuronetCore/README.md` — Status block, version history paragraph, test-count refresh, NEW `./observability` submodule table row, optional "What's new in v2.3.0" section
- `Z:/OuronetCore/.github/workflows/publish.yml` — already-existing 3-check version-parity gate (verified during v2.1.2 housekeeping)

### Visual Assets

No visual assets provided. This is an audit-driven backend/infrastructure spec — no UI changes.

### Implementation Mode

**premium** — Opus on implementation + review.

## Requirements Summary

### Functional Requirements

#### Phase 1 — F-CORE-015 safeCreationTime DRY (M1)
- [ ] **REQ-01:** `function safeCreationTime` private declarations are removed from all 11 listed `src/interactions/*Functions.ts` files. Each affected file gains `safeCreationTime` in its `import { ... } from "../pact"` block (or a new `from "../pact"` import if the file doesn't already pull from it). Behavior is byte-identical because the canonical body at `src/pact/format.ts:138-140` is the same as the removed inline copies. `grep -r "function safeCreationTime" src/` returns exactly one hit (the canonical) post-phase.

#### Phase 2 — F-CORE-013 + F-CORE-014 codex/resolver contract (M1)
- [ ] **REQ-02:** `deserializeCodex` at `src/codex/codec.ts:75-93` gains runtime shape checks after the version check. Validates that `kadenaWallets`, `ouronetWallets`, and `addressBook` are arrays and that `uiSettings` is an object. On invalid input, throws domain-prefixed errors that name the bad field but do NOT echo its value (no info disclosure). Forward-compat is preserved: unknown extra fields survive the cast.
- [ ] **REQ-03:** `CodexSigningStrategy` at `src/signing/codexStrategy.ts:180-182` gains a pre-flight check — if the transaction requires a foreign-key signer AND `this.resolver.requestForeignKey` is undefined, throws a precise error before reaching `universalSignTransaction`. JSDoc on `KeyResolver.requestForeignKey` at `src/signing/types.ts:62-69` is clarified to state the contract: optional in the interface, required at execute time when any guard requires a foreign key. Server resolvers that omit `requestForeignKey` AND receive a foreign-key transaction now get a clear error instead of an opaque deep-stack failure.

#### Phase 3 — F-CORE-016a/b/c + F-CORE-017 guard hardening (M1)
- [ ] **REQ-04:** `classifyGuardKind` at `src/guard/smartAccountAuth.ts:84-106` requires the FULL minimal shape per kind: capability needs `cgName` + `cgArgs` + `cgPactId`; user needs `fun` + `args`; keyset needs `pred` + `keys`; keyset-ref accepts either casing of the ref field (camelCase or lowercase). Under-specified guard shapes that previously silently mis-classified now classify as `unknown` and are surfaced to the caller.
- [ ] **REQ-05:** `normalizeKeysetRef` helper applied at the `resolveGuard` boundary (`src/guard/smartAccountAuth.ts:118-126`) so internal code only sees `keysetRef` (camelCase). Maps `keysetref` (lowercase chain-native) → `keysetRef` at the chain-IO boundary.
- [ ] **REQ-06:** `SmartAccountAuthPathsAnalysis` JSDoc at `src/guard/smartAccountAuth.ts:209-240` enumerates the 4 reachable states: `firstSatisfied >= 0`; `firstSatisfied === -1 && anyKeyBased === true`; `firstSatisfied === -1 && anyKeyBased === false && anyKnownKind`; all-unknown. Optional `firstSignableButUnsatisfied: number` field added.
- [ ] **REQ-07:** `computeThreshold` at `src/guard/guardUtils.ts:76-79` throws a typed `UnknownPredicateError` (NEW class, additive) when it encounters an unrecognized predicate. `analyzeGuard` catches this and folds it into a `predicateRecognized: false` bit on the returned analysis. The silent `console.warn` in the previous implementation is removed.

#### Phase 4 — F-CORE-018a + F-CORE-018b documentation refresh (M2)
- [ ] **REQ-08:** `Z:/OuronetCore/README.md` header version table is refreshed from the v1.3.0/1.4.0 baseline to current v2.2.0 reality. Cross-reference CHANGELOG for per-version detail.
- [ ] **REQ-09:** `Z:/OuronetCore/.bee/CONTEXT.md` interactions section is refreshed describing v1.4 (`AccountSelectorData` gains `public-key`, `sovereign`, `governor` fields), v1.5 (Leto/Artemis/Apollo re-exports + `createGen1Primitive` factory + `AddressPrefixPair` type), and v1.6 (Smart Ouronet Account auth-path resolution primitives + `buildRotateSovereignPactCode`). Coordination: this may be redone wholesale by `/bee:refresh-context` if that command is run after subsequent code changes.

#### Phase 5 — F-CORE-019 + F-CORE-021 catch cleanup (M2)
- [ ] **REQ-10:** `src/interactions/ouroFunctions.ts` catch blocks consistently route via `getLogger().error(...)` (LOCKED iter 1 per I-004). Both phases land in the same atomic v2.3.0 commit per NFR-06, so the implementation order is irrelevant — the routed path is the higher-value outcome that closes F-CORE-019 cleanly AND avoids ambiguity in the Phase 7 changelog text. Implementer of Phase 5 imports `getLogger` from the new `./observability` subpath (or relative `../observability` if landing before Phase 6's barrel is wired). Convention documented in a code comment at the top of the catch-block sweep.
- [ ] **REQ-11:** `src/interactions/addLiquidityFunctions.ts` — outer try/catch on `getLPTypeInfo` (structural anchor; see line 80 footnote on cross-plan auto-fix iter 1 — actual current range 219-257, lines shift through the spec) is **dropped (Option A — LOCKED per spec-review iter 1 I-001)**. The audit-spec source's "comment as belt-and-braces" alternative is explicitly REJECTED: a future contributor removing one of the inner catches must surface the failure as a real test break rather than have it silently masked under the dead outer handler. The closure rationale documented in `spec.md:42` ("future regressions in inner catches surface as real failures") only holds under Option A.

#### Phase 6 — F-CORE-020 + F-CORE-022 tier semantics + logger seam (M2)
- [ ] **REQ-12:** `src/reads/pactReader.ts` and `src/reads/rawCalibratedRead.ts:40-46` JSDoc lists the canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static, etc. — match OuronetUI's reader). Documents that the default reader ignores `tier` and that consumers wanting cache must call `setPactReader`. **Optional `process.env.NODE_ENV === "development"` warning DROPPED (LOCKED iter 1 per advisory #2):** the warning was offered as an option in the audit-spec source but is rejected here to keep Phase 6 scoped tightly — adding NODE_ENV branching introduces a build-time dependency that doesn't fit the JSDoc-only nature of REQ-12. JSDoc clarification is sufficient. If a future spec wants a runtime warning, that's its own scope.
- [ ] **REQ-13:** **NEW FILES (LOCKED iter 1 per I-003):** `src/observability/logger.ts` (implementation file with Logger seam, `setLogger`, `getLogger`, default `_logger`) AND `src/observability/index.ts` (barrel re-exporting the public surface). Two-file source layout produces matching `dist/observability/{logger,index}.{js,d.ts}` artifacts that REQ-17's verification gate asserts.
  - **Logger seam contract** (mirrors `setPactReader` at `src/reads/pactReader.ts:33-71`):
    - Exports `Logger` type with `warn(msg: string, ...args: unknown[]): void` and `error(msg: string, ...args: unknown[]): void`.
    - `setLogger(logger: Logger): void` mutator. **Null-rejection LOCKED iter 1 per I-003:** if `logger === null` or `logger === undefined`, throws `TypeError` with message exactly `setLogger requires a non-null Logger` (NOT silently installed). The exact message text is required so the changelog Added-section can document it precisely.
    - `getLogger(): Logger` accessor returns the currently-installed logger.
    - Default `_logger` routes to `console.warn` / `console.error`.
  - **Sweep:** every `console.warn` and `console.error` in `src/` (across `src/network/nodeFailover.ts`, `src/crypto/v1.ts` (any remaining), `src/guard/guardUtils.ts`, `src/interactions/ouroFunctions.ts`, ~25 hits across 8 files per audit-spec) is replaced with `getLogger().warn(...)` / `.error(...)`. Verifiable post-phase via `grep -nE "console\.(warn|error)" src/` returning ZERO matches.
  - **Package exports:** `Z:/OuronetCore/package.json` adds new `./observability` subpath pointing at `dist/observability/index.js` + `dist/observability/index.d.ts` (per locked-decision file layout above — `index.ts` is the barrel; `logger.ts` is the implementation).

#### Phase 7 — Release artifacts
- [ ] **REQ-14:** `Z:/OuronetCore/package.json` `version` field bumped from `2.2.0` to `2.3.0`.
- [ ] **REQ-15:** `Z:/OuronetCore/CHANGELOG.md` is prepended with a `## 2.3.0 — YYYY-MM-DD` entry. Format mirrors v2.2.0 single-concern minor: lead paragraph describing the additive nature, `### Added (public surface)` listing the new `UnknownPredicateError` class and the new `./observability` subpath with `Logger`/`setLogger`/`getLogger` exports, `### Fixed` citing F-CORE-013/014/015/016a/b/c/017 (M1) + F-CORE-018a/b/019/020/021/022 (M2) closures grouped by milestone, `### Stats` block with new test count and files-changed list.
- [ ] **REQ-16:** `Z:/OuronetCore/README.md` updates per the locked maintenance rule:
  - `## Status` block leads with `2.3.0` and a one-line summary of the additive changes (closes 13 audit findings — 7 MEDIUM + 6 LOW; new `./observability` logger seam).
  - Version history extended with a v2.3.0 paragraph.
  - Test-count references refreshed (post-phase actual count from `npm test`).
  - NEW submodule table row for `./observability` documenting the logger seam.
  - Optional "What's new in v2.3.0" section with copy-paste TypeScript example showing how a consumer routes log events via `setLogger(...)` (mirrors v2.1.0/v2.2.0 precedent).
- [ ] **REQ-17:** Verification gate — `npm run typecheck` exit 0; `npm test` exit 0 (or sole allowed non-zero exit per the locked Windows-locale `tests/gas.test.ts > formatMaxFee` exception); `npm run build` exit 0; `dist/observability/{index,logger}.{js,d.ts}` all 4 files present (LOCKED iter 1 per I-003 — corresponds to the two-file source layout `src/observability/{index.ts,logger.ts}` mandated in REQ-13); runtime export verification for the logger seam (dynamic ESM import asserts `Logger`/`setLogger`/`getLogger` are functions/types as expected); workflow-gate 3-check version-parity grep checks all PASS (already enforced by `.github/workflows/publish.yml:99/111/120` byte-identically — `[[:space:]]+` and `[[:space:]]` anchors verified during v2.1.2 housekeeping). Phase 1 verification specifically runs `grep -r "function safeCreationTime" src/` (NOT against `dist/` or `tests/`) — expected one hit, the canonical at `src/pact/format.ts:138-140`.

### Non-Functional Requirements

- [ ] **NFR-01:** All public-API additions are ADDITIVE. No symbol renames; no return-type widening; no public exports removed. Strict semver — minor bump to v2.3.0.
- [ ] **NFR-02:** `tests/types.test.ts` v1.7.0 type-regression lock continues to pass at every phase boundary.
- [ ] **NFR-03:** CI test wall-time stays under 30 seconds on Node 22 / Ubuntu (current ~15-20s baseline).
- [ ] **NFR-04:** Phase 1 should produce ZERO test count change (mechanical refactor, byte-identical behavior). Phase 2 + Phase 3 + Phase 6 should add at least 3 new test cases each (shape validation, foreign-key pre-flight, predicate-recognition flag, logger seam contract).
- [ ] **NFR-05:** No new "Open handles" warnings from vitest after any phase.
- [ ] **NFR-06:** Atomic-ship contract — all 7 phases land in a single commit + single annotated tag (v2.3.0). Single npm publish + GitHub Release for the entire spec.

### Reusability Opportunities

- **`setPactReader` pattern** at `src/reads/pactReader.ts` is the direct template for the new `setLogger` seam in REQ-13. Mirror its module-private state, `set`/`get` accessor pair, and JSDoc style.
- **`v2.2.0` spec precedent** at `.bee/archive/2026-05-02-crypto-pact-test-hardening/` for: workflow-gate verbatim grep patterns; CHANGELOG bold convention `**N** passing`; README placeholder pattern; T2.13-style verification gate; per-task wall-time budgets in T2.13 acceptance.
- **Existing barrel re-export pattern** at `src/crypto/index.ts:43` (3 error classes from `./errors`) for the new `UnknownPredicateError` re-export from `src/guard/index.ts` (LOCKED per spec-review iter 1 I-002 — guard subpath, NOT errors subpath; the changelog Added-section text in phases.md:68 commits to "the new typed predicate error class re-exported from the guard subpath" so a divergent landing location would invalidate the changelog).
- **v2.2.0 placeholder/patch pattern** for test-count references (T2.13 placeholder-patching step) for REQ-16's test-count refresh.
- **Existing `tests/encryption.test.ts` console-spy pattern** (T2.5 #4 from v2.2.0) for verifying the logger seam catches all `console.*` calls.

### Scope Boundaries

**In scope:**
- All 13 audit-finding closures listed above (7 MEDIUM + 6 LOW from 2026-04-30 audit)
- Release artifacts (package.json, CHANGELOG, README) for v2.3.0
- Verification gate covering all phases

**Out of scope (deferred to other specs):**
- F-CORE-007 (fabricated fallback values in 3 read helpers — BREAKING return-type widening) → next spec, v3.0.0 major (M3 of unified bundle)
- F-CORE-009/011/012 — already shipped in v2.2.0
- F-CORE-008 — shipped in v2.1.0
- F-CORE-002/003/004 — shipped in v2.1.0
- F-BUG-001 — shipped in v2.1.2
- Catalog sweep of ~22 additional empty-catch sites in `src/interactions/*` beyond the 3 representative functions in F-CORE-007 — Phase 2 of the v3.0.0 spec (optional secondary task per audit)

### Technical Considerations

- **Phase ordering rationale:** Risk-based, not dependency-based. Phase 1 first (lowest-risk mechanical refactor — establishes pipeline confidence). Phase 2 second (localized codec contract; 3 files). Phase 3 third (broader test-fixture surface — guard classification semantics). Phase 4 fourth (docs only — zero code risk). Phase 5 fifth (small interaction-file cleanup). Phase 6 sixth (logger seam touches `package.json` exports + new subpath; wants clean prior state). Phase 7 last (release artifacts + verification gate after all code changes have landed).
- **Cross-phase dependency (LOCKED iter 2 per spec-review I-002):** Phase 5's F-CORE-019 catches route via `getLogger().error(...)` per REQ-10's I-004 lock. This creates a HARD source-level dependency from Phase 5 onto Phase 6's `src/observability/{index.ts,logger.ts}` files. The atomic-ship contract (NFR-06) means both phases land in the same v2.3.0 commit, so the dependency is intra-commit ordering — the conductor's wave logic ensures Phase 6's source files exist on disk before Phase 5's tests run. The previous "silent vs routed implementer's-choice" wording is REJECTED as it directly contradicted the I-004 lock.
- **Atomic-ship contract:** Phase 7's release-artifact updates land in the same commit as Phase 1-6 work. Single v2.3.0 tag covers all 7 phases.
- **Workflow gate parity:** REQ-17's verification gate must mirror the workflow gate's 3-check grep patterns at `.github/workflows/publish.yml:99/111/120` byte-identically (per v2.2.0 F-002 lock — `[[:space:]]+` and `[[:space:]]` anchors enforced).
- **Backwards-compatibility:** All 13 changes are observable to consumers ONLY through additive surface (new error class, new analysis flag, new subpath export, new shape validation throws on previously-broken inputs). v2.2.0 consumers upgrade transparently — `instanceof Error` and existing API shapes still work.
