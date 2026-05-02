# Roadmap: medium-and-low-audit-closures

## Phase-Requirement Mapping

| Phase | Goal | Requirements | Success Criteria |
|-------|------|-------------|------------------|
| 1. `safeCreationTime` DRY refactor | Mechanical deduplication of 11 inline `function safeCreationTime` declarations across `src/interactions/*Functions.ts`, leaving exactly one canonical declaration in `src/pact/format.ts:138-140`. Pure mechanical refactor with byte-identical behavior. | REQ-01 | 1. `grep -r "function safeCreationTime" src/` returns exactly one hit (the canonical at `src/pact/format.ts:138-140`); the 11 inline duplicates are gone. 2. Each of the 11 affected interaction files imports `safeCreationTime` from `../pact` (added to an existing pact-subpath import line or as a new import). 3. `npm test` passes with ZERO test count change (NFR-04: Phase 1 produces no behavior change). 4. `npm run typecheck` exits 0; `npm run build` exits 0. |
| 2. Codex shape validation + foreign-key resolver pre-flight | Tighten two domain contracts: codex deserializer gains runtime shape checks; codex signing strategy gains a pre-flight check for the foreign-key resolver method. Additive — well-formed inputs continue to work; previously-broken inputs now fail with clear errors. | REQ-02, REQ-03 | 1. A consumer with a malformed codex backup (e.g., `kadenaWallets` is not an array) sees a domain-prefixed error naming the bad field but NOT echoing its value (no info disclosure). 2. A server resolver that omits `requestForeignKey` AND receives a foreign-key transaction sees a precise error before reaching `universalSignTransaction` (was: opaque deep-stack failure). 3. Existing well-formed codex backups deserialize byte-identically. 4. Existing resolvers WITH `requestForeignKey` continue to work unchanged. 5. At least 3 new test cases land covering shape-validation hits, name-only-no-value-echo, and foreign-key pre-flight error. |
| 3. Guard hardening + UnknownPredicateError | Tighten `classifyGuardKind` minimal shape; normalize keysetRef casing at chain-IO boundary; document 4 reachable states of `SmartAccountAuthPathsAnalysis`; introduce typed `UnknownPredicateError` class (FIRST of two NEW PUBLIC SURFACES) thrown by `computeThreshold` and folded into a `predicateRecognized: false` analysis bit. | REQ-04, REQ-05, REQ-06, REQ-07 | 1. Under-specified guard payloads (missing required fields per kind) now classify as `unknown` instead of silently mis-classifying. 2. Lowercase chain-native `keysetref` is normalized to camelCase `keysetRef` at the resolveGuard boundary; internal code only sees camelCase. 3. The 4 reachable states of `SmartAccountAuthPathsAnalysis` are documented in JSDoc; new optional `firstSignableButUnsatisfied: number` field is observable on the analysis result. 4. Consumers can `try { computeThreshold(...) } catch (e: UnknownPredicateError) { ... }`; `UnknownPredicateError` is re-exported from `src/guard/index.ts` (LOCKED — NOT errors subpath). 5. `analyzeGuard` catches `UnknownPredicateError` and folds it into `analysis.predicateRecognized === false` (no silent `console.warn`). 6. At least 3 new test cases land. |
| 4. Documentation refresh | Refresh README header version table and CONTEXT.md interactions section. Documentation only, zero code risk. | REQ-08, REQ-09 | 1. README header version table reflects current v2.2.0 reality (was: stale at v1.3.0/v1.4.0); cross-references CHANGELOG for per-version detail. 2. CONTEXT.md interactions section describes v1.4 (`AccountSelectorData` field additions), v1.5 (DALOS curve re-exports + `createGen1Primitive` factory + `AddressPrefixPair` type), v1.6 (Smart Ouronet Account auth-path resolution primitives + `buildRotateSovereignPactCode`). 3. Coordination note in phase artifacts: this section may be redone wholesale by a future `/bee:refresh-context` invocation. |
| 5. Catch-block cleanup (logger-routed) | Normalize 7 mixed catch-block sites in `ouroFunctions.ts` to ONE convention — route via `getLogger().error(...)` from `../observability` (LOCKED I-004 + I-001). Drop the dead outer try/catch on `getLPTypeInfo` in `addLiquidityFunctions.ts` (structural anchor — actual current range 219-257, lines shift through the spec; cross-plan auto-fix iter 2 per CI-006). Option A LOCKED — NOT comment as belt-and-braces. | REQ-10, REQ-11 | 1. All 7 catch sites in `ouroFunctions.ts` route via `getLogger().error(...)`; convention documented in a code comment near the affected handlers. 2. The dead outer try/catch on `getLPTypeInfo` (`addLiquidityFunctions.ts:285-287`) is REMOVED. A future contributor removing one of the inner catches now surfaces the broken behavior as a real test failure rather than silently masking under the dead outer handler. 3. Phase 5 has a HARD source-level dependency on Phase 6's `src/observability/{index.ts,logger.ts}` (atomic-ship contract puts both phases in the same v2.3.0 commit). |
| 6. Tier semantics JSDoc + central logger seam | JSDoc the canonical tier mapping on `pactReader.ts` and `rawCalibratedRead.ts`. Introduce the SECOND of two NEW PUBLIC SURFACES: a central logger seam at NEW `./observability` subpath (mirroring `setPactReader` pattern). Sweep ~25 `console.warn`/`console.error` call sites across ~8 source files. | REQ-12, REQ-13 | 1. Consumers reading `pactReader.ts` / `rawCalibratedRead.ts` JSDoc see the canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static, etc.) and the documented contract that the default reader ignores `tier`. (Optional NODE_ENV development warning explicitly DROPPED — JSDoc-only.) 2. Consumers can `import { setLogger, getLogger, type Logger } from "@stoachain/ouronet-core/observability"` after upgrade. 3. `setLogger(null)` throws `TypeError` with message exactly `setLogger requires a non-null Logger` (LOCKED — NOT silently installed). 4. Default behavior is byte-identical to pre-upgrade: `getLogger().warn(...)` routes to `console.warn`; `getLogger().error(...)` routes to `console.error`. 5. `grep -nE "console\.(warn\|error)" src/` returns ZERO matches (was: ~25 hits across ~8 files). 6. `package.json` exports map gains the `./observability` subpath. 7. At least 3 new test cases land (default routing, setter swap, null-rejection). |
| 7. Release artifacts + verification gate | Produce all release artifacts (package.json bump, CHANGELOG entry, README updates) in the same commit so the publish workflow's three-check version-parity gate passes. Run full verification gate. Atomic-ship: all 7 phases land in one v2.3.0 commit + tag. | REQ-14, REQ-15, REQ-16, REQ-17 | 1. `npm publish` succeeds for v2.2.0 → v2.3.0 (workflow gate confirms README `## Status` block + version history paragraph + CHANGELOG first heading all reference 2.3.0 byte-identically per `.github/workflows/publish.yml:99/111/120` `[[:space:]]+` and `[[:space:]]` anchors). 2. CHANGELOG `## 2.3.0` entry documents F-CORE-013/014/015/016a/b/c/017 (M1) + F-CORE-018a/b/019/020/021/022 (M2) closures grouped by milestone, plus the 2 NEW PUBLIC SURFACES (`UnknownPredicateError` + `./observability` subpath with `Logger`/`setLogger`/`getLogger`). 3. README Status block leads with v2.3.0; version history extended; test-count refreshed to actual post-build count; NEW `./observability` submodule table row; optional "What's new in v2.3.0" section with copy-paste TypeScript example. 4. CI green: typecheck exit 0, full vitest run passes (or sole allowed non-zero exit per locked Windows-locale gas-test exception), build emits clean dist/ with `dist/observability/{index,logger}.{js,d.ts}` all 4 files present. 5. Runtime export verification confirms `Logger`/`setLogger`/`getLogger` load via dynamic ESM import. |

## Coverage Validation

- **Total functional requirements:** 17 (REQ-01 through REQ-17)
- **Mapped:** 17
- **Unmapped:** 0

All 17 functional requirements (REQ-01 through REQ-17) mapped across 7 phases.

Cross-cutting non-functional requirements (NFR-01 additive-only, NFR-02 type-regression lock, NFR-03 30s wall-time, NFR-04 ≥3 new tests per substantive phase, NFR-05 no-open-handles, NFR-06 atomic-ship single-commit-single-tag) apply at every phase boundary and are enforced by Phase 7's verification gate.

## Phase Details

### Phase 1: `safeCreationTime` DRY refactor
**Goal:** Pure mechanical deduplication of 11 inline `function safeCreationTime` declarations. Byte-identical behavior; zero test count change.
**Requirements:** REQ-01
**Success Criteria** (what must be TRUE when this phase completes):
1. `grep -r "function safeCreationTime" src/` returns exactly 1 hit (canonical at `src/pact/format.ts:138-140`).
2. Each of 11 interaction files imports `safeCreationTime` from `../pact`.
3. `npm test` passes with ZERO test count change.
4. `npm run typecheck` and `npm run build` both exit 0.

### Phase 2: Codex shape validation + foreign-key resolver pre-flight
**Goal:** Tighten codex deserializer + signing strategy contracts. Additive — well-formed inputs unchanged; previously-broken inputs now throw clearly.
**Requirements:** REQ-02, REQ-03
**Success Criteria:**
1. Malformed codex (e.g., non-array `kadenaWallets`) throws domain-prefixed error naming field but NOT value.
2. Server resolver omitting `requestForeignKey` + receiving foreign-key transaction throws precise pre-flight error.
3. Existing well-formed codex backups deserialize byte-identically.
4. Existing resolvers with `requestForeignKey` continue to work.
5. ≥3 new test cases.

### Phase 3: Guard hardening + UnknownPredicateError (NEW SURFACE 1/2)
**Goal:** Tighten guard classification + introduce typed `UnknownPredicateError` class (re-exported from guard subpath, NOT errors subpath).
**Requirements:** REQ-04, REQ-05, REQ-06, REQ-07
**Success Criteria:**
1. Under-specified guard payloads classify as `unknown` (no silent mis-classification).
2. Lowercase `keysetref` normalized to camelCase `keysetRef` at boundary.
3. 4 reachable states of `SmartAccountAuthPathsAnalysis` documented; new `firstSignableButUnsatisfied?: number` field.
4. `UnknownPredicateError` re-exported from `src/guard/index.ts` (LOCKED).
5. `analyzeGuard` folds the error into `analysis.predicateRecognized === false`.
6. ≥3 new test cases.

### Phase 4: Documentation refresh
**Goal:** README version table + CONTEXT.md interactions section refresh.
**Requirements:** REQ-08, REQ-09
**Success Criteria:**
1. README header table reflects v2.2.0 baseline + cross-refs CHANGELOG.
2. CONTEXT.md interactions section covers v1.4/v1.5/v1.6 additions (`AccountSelectorData`, DALOS re-exports, Smart Account auth primitives).
3. Coordination note for `/bee:refresh-context`.

### Phase 5: Catch-block cleanup (logger-routed)
**Goal:** All 7 catch sites in `ouroFunctions.ts` route via `getLogger().error(...)`. Drop dead try/catch in `getLPTypeInfo`.
**Requirements:** REQ-10, REQ-11
**Success Criteria:**
1. All 7 catch sites route via `getLogger().error(...)` from `../observability`.
2. `addLiquidityFunctions.ts` outer try/catch on `getLPTypeInfo` REMOVED (Option A LOCKED; structural anchor — actual current range 219-257, lines shift through the spec).
3. HARD source-level dependency on Phase 6's `src/observability/{index.ts,logger.ts}` (atomic-ship contract).

### Phase 6: Tier semantics JSDoc + central logger seam (NEW SURFACE 2/2)
**Goal:** JSDoc tier mapping + introduce `./observability` subpath with logger seam.
**Requirements:** REQ-12, REQ-13
**Success Criteria:**
1. `pactReader.ts` + `rawCalibratedRead.ts` JSDoc enumerates canonical tier mapping. NODE_ENV warning DROPPED.
2. Consumers can `import { setLogger, getLogger, type Logger } from "@stoachain/ouronet-core/observability"`.
3. `setLogger(null)` throws `TypeError` with message exactly `setLogger requires a non-null Logger`.
4. Default `getLogger()` routes to `console.warn`/`console.error`.
5. `grep -nE "console\.(warn|error)" src/` returns ZERO matches.
6. `package.json` exports map gains `./observability` subpath.
7. ≥3 new test cases.

### Phase 7: Release artifacts + verification gate
**Goal:** package.json + CHANGELOG + README updates + verification gate. Atomic-ship: single v2.3.0 commit + tag.
**Requirements:** REQ-14, REQ-15, REQ-16, REQ-17
**Success Criteria:**
1. Workflow gate's 3 grep checks all pass byte-identically (publish.yml:99/111/120).
2. CHANGELOG `## 2.3.0` entry covers M1 (7 findings) + M2 (6 findings) + 2 new public surfaces.
3. README Status block leads with v2.3.0; version history + test count + new `./observability` submodule row + optional "What's new" section all updated.
4. CI green: typecheck, test (locked Windows-locale gas-test exception only), build.
5. `dist/observability/{index,logger}.{js,d.ts}` all 4 files present; runtime ESM import verifies `Logger`/`setLogger`/`getLogger` are live.
