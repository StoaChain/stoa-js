# Roadmap: crypto-pact-test-hardening

## Phase-Requirement Mapping

| Phase | Goal | Requirements | Success Criteria |
|-------|------|-------------|------------------|
| 1. Crypto error taxonomy + smartDecrypt timing-leak fix | Replace V1/V2 catch-all error strings with three typed error classes; collapse `smartDecrypt`'s V1-then-V2 fallback to deterministic shape-based dispatch. | REQ-01, REQ-02, REQ-03, REQ-04 | 1. Consumers can `catch (e: WrongPasswordError)` after upgrading to v2.2.0. 2. `smartDecrypt` of a wrong-password V1 envelope takes the same wall-time as a wrong-password V2 envelope (~1.5s timing leak closed). 3. V1 encrypt/decrypt no longer write to consumer stderr via `console.error`. 4. All existing v2.1.2 crypto consumers see equivalent behavior (`instanceof Error` still holds; existing string-message consumers unaffected). |
| 2. Test coverage for critical untested surfaces + v2.2.0 release | Land 4 new test files + 5 test-file extensions covering Phase 1's new surface AND the 4 previously-untested critical surfaces (pactReader seam, KadenaWalletBuilder mnemonic dispatch, transactionErrors branch coverage, migrateSeedType round-trip). Bump version, prepend CHANGELOG, update README per locked maintenance rule, ship as atomic v2.2.0. | REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17 | 1. `npm publish` succeeds for v2.2.0 (workflow gate confirms README ## Status block + version history + CHANGELOG first heading all reference 2.2.0). 2. CHANGELOG entry documents F-CORE-009/011/012 closures AND explicitly records the F-CORE-010 rejection with rationale. 3. README Status block leads with v2.2.0; consumers landing on the npm package page see the new error-class surface in the submodule table. 4. Project test count grows from 386 baseline to ≥415; previously-untested critical surfaces (pactReader, KadenaWalletBuilder, transactionErrors, migrateSeedType integration) gain meaningful regression coverage. 5. CI green: typecheck exit 0; full vitest run passes (or exits non-zero with ONLY the documented Windows locale failure per v2.1.2's locked criterion); build emits clean dist/ with the 3 new error classes observable in the network barrel typed output. |

## Coverage Validation

- Total requirements: 17
- Mapped: 17
- Unmapped: 0

All 17 functional requirements (REQ-01 through REQ-17) mapped across 2 phases.

## Phase Details

### Phase 1: Crypto error taxonomy + smartDecrypt timing-leak fix

**Goal:** Replace the V1/V2 decryptString catch-all error strings with three typed error classes (`WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError`), collapse `smartDecrypt`'s V1-then-V2 fallback chain to deterministic shape-based dispatch via `isEncryptedV2`, and remove `console.error` calls from V1's catches. Closes F-CORE-009. Files: `src/crypto/v1.ts`, `src/crypto/v2.ts`, `src/crypto/index.ts`.

**Requirements:** REQ-01, REQ-02, REQ-03, REQ-04

**Success Criteria** (what must be TRUE when this phase completes):
1. **Consumer-visible error discrimination unlocked.** A consumer's `try { decryptString(blob, pw) } catch (e) { if (e instanceof WrongPasswordError) ... else if (e instanceof CorruptEnvelopeError) ... }` works correctly — wrong-password path throws `WrongPasswordError`; corrupted-envelope path throws `CorruptEnvelopeError`; existing `instanceof Error` and `error.message` access still work for un-upgraded consumers.
2. **Timing side channel closed.** `smartDecrypt` of a V1 envelope under wrong password takes the same wall-time as `smartDecrypt` of a V2 envelope under wrong password (each path runs exactly one KDF, no double-try). Observable via the test that lands in Phase 2's REQ-09.
3. **Stderr no longer polluted by V1 catches.** A consumer running V1 encrypt or decrypt under failure conditions sees no `console.error` output from `@stoachain/ouronet-core`. The thrown error carries the cause; the consumer (or a future logger seam) decides whether to log.
4. **Sequential consumer compatibility preserved.** All v2.1.2 crypto consumers (`smartDecrypt`/`decryptString`/`decryptStringV2`/`smartEncrypt`) observe equivalent success-path behavior. The internal V1-fallback in `decryptStringV2` (lines 102-120) stays intact for consumers that call `decryptStringV2` directly with a V1 blob.

**Test deferral note:** Phase 1 deliberately does NOT add tests. The new error classes are asserted in Phase 2's REQ-09 (`tests/encryption.test.ts` extension). Per the atomic-ship contract, both phases land in a single v2.2.0 release, so the new error surface is never published without test coverage — the deferral is intra-spec, not intra-release.

### Phase 2: Test coverage for critical untested surfaces + v2.2.0 release

**Goal:** Add 4 new test files and 5 test-file extensions covering both Phase 1's new error-class surface AND the 4 previously-untested critical surfaces flagged in F-CORE-011 + F-CORE-012. Then bump `package.json` to 2.2.0, prepend a `## 2.2.0` CHANGELOG entry citing F-CORE-009/011/012 closures + F-CORE-010 rejection note, update README per the locked maintenance rule, and stage everything for the atomic v2.2.0 commit + tag.

**Requirements:** REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17

**Success Criteria** (what must be TRUE when this phase completes):
1. **v2.2.0 publishes successfully.** The publish workflow's three-check gate (`grep -E "\`2.2.0\` on public npmjs" README.md`, version-history paragraph, CHANGELOG first heading) all pass; `npm publish --access public` succeeds with NPMPUSHER token; v2.2.0 visible on npm registry with gitHead matching the v2.2.0 tag commit. Per the post-publish polling rule, ship is "done" only after the npm.com website page (not just the registry API) reflects the new version.
2. **CHANGELOG records both closures and the F-CORE-010 rejection.** A consumer reading `CHANGELOG.md` sees a `## 2.2.0 — YYYY-MM-DD` entry citing F-CORE-009 (crypto error taxonomy + timing fix), F-CORE-011 (4 new test files for previously-untested critical surfaces), F-CORE-012 (5 test-file extensions for boundary edge cases), AND a dedicated `### Rejected (decisions log)` section noting F-CORE-010 was reviewed and intentionally not implemented (chain-side validation duplicates).
3. **README leads with v2.2.0 + new public surface visible.** A consumer landing on https://www.npmjs.com/package/@stoachain/ouronet-core (after CDN catches up) sees `## Status` opening with `2.2.0 on public npmjs`, a v2.2.0 paragraph in the version history, the test-count refreshed (`386` → new total, `+40 new` → new derived counter), and the `./crypto` submodule table row citing the 3 new error classes (`WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError`).
4. **Test coverage measurably expanded.** `npm test` reports a passing count ≥415 (up from 386 v2.1.2 baseline; +29 floor / 34 ceiling). The 4 previously-untested critical surfaces (`pactReader` injection seam, `KadenaWalletBuilder` mnemonic dispatch, `transactionErrors` branch coverage, `migrateSeedType` round-trip integration) all have dedicated test files. CI test wall-time stays under 30s on Node 22 / Ubuntu.
5. **All quality gates green at v2.2.0 commit time.** `npm run typecheck` exit 0; `npm test` exit 0 (or exit-non-zero with ONLY the documented `tests/gas.test.ts > formatMaxFee` Windows locale failure per v2.1.2's locked criterion); `npm run build` exit 0; `dist/crypto/index.{js,d.ts}` and `dist/crypto/index.d.ts` show the 3 new error classes (additive observable through the existing `./crypto` subpath barrel — no new package.json export needed).

**Phase dependency note:** Phase 2 explicitly depends on Phase 1. The `tests/encryption.test.ts` extension in REQ-09 references the error classes by name (`WrongPasswordError`, `CorruptEnvelopeError`); these don't exist until Phase 1 lands. Both phases ship in a single atomic v2.2.0 commit + tag — the dependency is intra-commit ordering, not inter-release.

**F-CORE-010 rejection note:** Per the discussion in `requirements.md` Q2/A2, F-CORE-010 (Pact-code injection escaping) was reviewed and rejected. Rationale: chain-side Pact compilation already validates account-format, token-ID-format, and string-literal correctness at simulation time. Consumer-side mirroring (whether via narrow injection blocklist or wider DALOS-charset allowlist) duplicates logic and carries drift risk. The audit-spec source `high-security-crypto-and-injection.md` Section 2 stays in `bundles/high-additive/` with a "rejected" note; CHANGELOG records the rejection so future reviewers can find the rationale without re-deriving it.
