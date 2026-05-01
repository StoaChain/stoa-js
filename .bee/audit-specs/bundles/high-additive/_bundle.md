# [HIGH-BUNDLE] 2 HIGH-additive audit closures (v2.2.0 minor)

**Source:** `/bee:audit` 2026-04-30. Bundles 2 of the remaining HIGH-additive audit-specs into one multi-phase spec. Excludes `high-error-fabricated-fallbacks.md` (return-type widening = breaking, ships standalone as v3.0.0 major LAST).

**Severity:** HIGH (× 2 specs, 4 underlying findings: F-CORE-009 / F-CORE-010 / F-CORE-011 / F-CORE-012)
**Version target:** v2.2.0 minor (additive: 3 new error classes, 1 new helper, 4 new test files + 4 test-file extensions; no public API removed; no return-type widening; one input-validation tightening that throws on illegal characters which were never part of the documented public input charset)

## Bundle composition

| Phase | Source audit-spec | Findings | Type |
|-------|------------------|----------|------|
| 1 | `high-security-crypto-and-injection.md` (F-CORE-009 portion) | F-CORE-009 | Additive: new error taxonomy + timing-leak fix |
| 2 | `high-security-crypto-and-injection.md` (F-CORE-010 portion) | F-CORE-010 | Additive: `pactString()` helper + builder wraps |
| 3 | `high-test-coverage-critical-surfaces.md` | F-CORE-011 + F-CORE-012 | Pure additive (4 new test files + 4 extensions) |

## Why these together

- **All HIGH-additive from the same 2026-04-30 audit cycle.** Closes F-CORE-009 / F-CORE-010 / F-CORE-011 / F-CORE-012 in one ship.
- **Cross-phase reinforcement:** Phase 3's `tests/transaction-errors.test.ts` and the `tests/encryption.test.ts`/`tests/encryption-upgrade.test.ts` extensions specifically validate the surface that Phase 1 introduces (new error classes, single-KDF `smartDecrypt`). Bundling guarantees the tests land in the same release as the code they exercise — no "tests for un-shipped work" or "untested new surface" gap between releases.
- **No file-ownership conflicts between phases:**
  - Phase 1: `src/crypto/v1.ts`, `src/crypto/v2.ts`, `src/crypto/index.ts`
  - Phase 2: `src/pact/format.ts`, `src/pact/cfmBuilders.ts`
  - Phase 3: `tests/*.test.ts` (new and extended)
  No overlap between Phase 1 and Phase 2 source files. Phase 3 only adds/extends test files.
- **Independent rollback granularity preserved by separate phases.** Each phase corresponds to one finding cluster; per-phase commits (or revert per-phase commit) are clean.
- **Single npm publish + GitHub Release for the bundle** instead of 2.

## Per-phase scope summary

### Phase 1: Crypto error taxonomy + smartDecrypt timing-leak fix (F-CORE-009)
**Reads:** `.bee/audit-specs/bundles/high-additive/high-security-crypto-and-injection.md` (Section 1, F-CORE-009)

**Adds:**
- `WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError` classes exported from `src/crypto/index.ts`.
- V1 `decryptString` and V2 `decryptStringV2` classify errors by which decode step failed (JSON.parse → CorruptEnvelopeError, AES-GCM `OperationError` → WrongPasswordError).
- `smartDecrypt` switches from V1-then-V2 fallback chain to deterministic shape-based dispatch via `isEncryptedV2`. Eliminates the ~1.5s timing side channel.
- `console.error` calls removed from V1 encrypt/decrypt catches (the thrown error already carries the cause).

**Type:** Additive only — no removals, no signature changes. Existing thrown messages remain readable as `Error`; consumers gain optional `instanceof WrongPasswordError` discrimination.

**Files touched:**
- `src/crypto/index.ts` — new exports
- `src/crypto/v1.ts:67-70, 122-127` — error classification, `console.error` removal
- `src/crypto/v2.ts:177-187` — `smartDecrypt` shape-based dispatch

### Phase 2: Pact-code injection escaping (F-CORE-010)
**Reads:** `.bee/audit-specs/bundles/high-additive/high-security-crypto-and-injection.md` (Section 2, F-CORE-010)

**Adds:**
- `pactString(s, fieldName)` validation helper in `src/pact/format.ts`, exported via `./pact` barrel.
- Charset regex `/^[a-zA-Z0-9_\-:. À-ſ]+$/` accepting Σ./Ѻ. prefixes, `k:abc...` accounts, token IDs (`n-coin`, `ouro:STOA`).
- Every interpolated string field in every `buildXPactCode` builder wrapped through `pactString(field, fieldName)`.

**Type:** Additive (helper) + tightening (input validation throws on illegal chars). Inputs containing `"`, `\`, `(`, `)`, newlines, or unicode-zero now throw early at the builder boundary instead of being rejected later by chainweb. UX improvement; technically observable for consumers passing exotic characters.

**Files touched:**
- `src/pact/format.ts` — new `pactString` helper
- `src/pact/cfmBuilders.ts` — every `buildXPactCode` (representative line ranges 47-57, 65-70, 82-88, 300-306, etc.)

### Phase 3: Test coverage for critical untested surfaces (F-CORE-011 + F-CORE-012)
**Reads:** `.bee/audit-specs/bundles/high-additive/high-test-coverage-critical-surfaces.md`

**Adds (4 new test files):**
- `tests/pact-reader.test.ts` — `setPactReader`/`pactRead` injection seam (≥5 tests).
- `tests/wallet-builder.test.ts` — Koala-24 / Chainweaver-12 / eckowallet mnemonic dispatch (≥6 tests, vendor test vectors).
- `tests/transaction-errors.test.ts` — every documented branch of `createSigningError`/`createSimulationError` (full coverage of the pattern-match table).
- `tests/seed-type-migration.test.ts` — `migrateSeedType` round-trip from a Phase-1 codex.

**Extends (existing test files):**
- `tests/encryption.test.ts` — tampered V2 envelope, `smartEncrypt` schemaVersion edge cases (`null`/`"0"`/`"1"`).
- `tests/encryption-upgrade.test.ts` — corrupted V1 blob through `smartDecrypt` (uses the single-KDF behaviour from Phase 1).
- `tests/codex-codec.test.ts` — round-trip with unknown future field (forward-compat pin).
- `tests/cfm-builders.test.ts` — empty-string field, field with `"` / `(` / scientific-notation amount (uses `pactString` from Phase 2 to verify rejection).
- `tests/pact-format.test.ts` — `formatDecimalForPact` edge cases (sci notation, leading zeros, EU separators).

**Type:** Pure additive (test files only). Total test count grows by ≥30; CI wall-time stays under 30s on Node 22 / Ubuntu (current 15s baseline grows to ~25s).

**Files touched:**
- 4 NEW `tests/*.test.ts` files
- 4 existing `tests/*.test.ts` files extended

## Hard invariants (every phase)

- `tests/types.test.ts` v1.7.0 type-regression lock continues to pass at every phase boundary.
- `npm run typecheck` exit 0 at every phase.
- `npm test` exit 0 at every phase (with the appropriate test-count target per phase).
- No new "Open handles" warnings.
- Public API: only ADDITIVE changes (new exports, new helper). No symbol renames, no removals, no signature widening.
- AUDIT.md tracks closure of F-CORE-009 / F-CORE-010 / F-CORE-011 / F-CORE-012 at v2.2.0.
- CHANGELOG.md gets one `## 2.2.0 — YYYY-MM-DD` entry covering all 3 phases.
- README.md `## Status` block leads with v2.2.0 and the version history is extended (per the user's locked README maintenance rule from v2.1.1).

## Out of scope (deferred to other audit-specs)

- F-CORE-007 (fabricated fallback values in read helpers — return-type widening is BREAKING) → standalone `high-error-fabricated-fallbacks.md`, ships LAST as v3.0.0 major.
- All MEDIUM-severity findings → `bundles/medium/_bundle.md`.
- LOW improvements → `low-improvements.md` standalone (patch).
- F-BUG-001 (withFailover concurrency race surfaced during reliability-failover) — needs a new audit-spec written first.

## Implementation mode

**premium** — Opus on implementation + review. Phase 1 touches crypto error semantics (security-sensitive); Phase 2 affects every public CFM builder (consumer-visible boundary); Phase 3 establishes test coverage for surfaces that are otherwise unverified.

## Phase ordering rationale

Phase 1 first because it introduces the new error classes that Phase 3's `tests/transaction-errors.test.ts` and `tests/encryption.test.ts` extensions exercise. Phase 2 second — independent of Phase 1 (different files), but Phase 3's `tests/cfm-builders.test.ts` extension relies on `pactString` rejection behaviour. Phase 3 last so the test extensions exercise the integrated post-Phase-1+2 state.

## Estimated phase count

3 phases, ~10-15 tasks total, 1-2 waves per phase. Compatible with `/bee:plan-all` + `/bee:ship` autonomous flow.

## Sequencing with sibling bundles

This bundle should ship **FIRST** (before `bundles/medium/_bundle.md`) because:
- Phase 3's `tests/cfm-builders.test.ts` extension establishes the `pactString` invariant. The MEDIUM bundle's guard-hardening phase (medium-guard-smart-account-hardening) does NOT depend on this, but landing the HIGH-tier security work first is the conventional fail-fast ordering.
- No structural dependency from medium → high; the ordering is preference, not constraint.

Recommended global sequence after this bundle: medium bundle (v2.3.0) → low-improvements (v2.3.1 patch) → high-error-fabricated-fallbacks (v3.0.0 major, ships LAST).
