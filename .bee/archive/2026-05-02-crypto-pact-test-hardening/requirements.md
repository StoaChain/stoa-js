# Requirements: crypto-pact-test-hardening

## Initial Description

Ship v2.2.0 minor (additive) closing 3 of the 4 HIGH-additive audit findings from the 2026-04-30 audit cycle. The bundle source is `.bee/audit-specs/bundles/high-additive/_bundle.md`. After deeper review during spec discovery, the 4th finding (F-CORE-010 — Pact-code injection escaping) was **rejected** as consumer-side overreach (chain-side Pact compilation already validates; mirroring duplicates logic + carries DALOS-charset drift risk). v2.2.0 ships 2 phases instead of the bundle's original 3:

- **Phase 1** — Crypto error taxonomy + smartDecrypt timing-leak fix (F-CORE-009)
- **Phase 2** — Test coverage for critical untested surfaces (F-CORE-011 + F-CORE-012)

Everything in v2.2.0 is additive: 3 new public error classes added to `src/crypto/index.ts`, 4 new test files, and 5 existing test-file extensions. No public API removed; no return-type widening; the only behavior change is in `smartDecrypt`'s internal dispatch (timing-leak fix that consumers can't observe except via wall-clock equalization on a wrong-password path).

## Requirements Discussion

This spec was created via `--from-discussion .bee/audit-specs/bundles/high-additive/_bundle.md`. The discussion is recorded as Q&A for traceability:

### Questions & Answers

**Q1:** What's the version target?
**A1:** v2.2.0 minor. New public exports (3 error classes) require minor bump per strict semver. Additive only — v2.1.x consumers upgrade transparently.

**Q2:** The audit-spec proposes a `pactString(s, fieldName)` validator with a `/^[a-zA-Z0-9_\-:. À-ſ]+$/` charset regex (F-CORE-010). Researcher flagged that Σ./Ѻ. account prefixes are NOT in the proposed regex's allowed Unicode range — locking it would break every existing Smart/Standard account name. What charset should we use?
**A2:** **Skip Phase 2 entirely (drop F-CORE-010).** Rationale: format validation (account-shape, token-ID-shape, DALOS-charset) is already enforced by the chain at Pact compilation/simulation time. Mirroring chain-side validation in core would (a) duplicate logic, (b) drift from chain reality whenever DALOS adds characters, and (c) impose maintenance burden for theoretical defense-in-depth. Injection prevention as a narrow `pactString` blocklist (throw on `"`, `\`, newline) was considered as a middle ground but also rejected — same theoretical-only argument. F-CORE-010 marked **REJECTED** in the decisions log; future audit-specs may revisit if a non-chain-validated context emerges (e.g., HUB-side automation that bypasses Pact compilation).

**Q3:** Should `AUDIT.md` (referenced as a closure-tracking invariant in the original `_bundle.md`) be created as a Phase 2 deliverable?
**A3:** **No — drop the AUDIT.md invariant.** The file doesn't exist in the repo, and CHANGELOG.md already serves as the canonical record of closed findings (v2.1.0 closes F-CORE-002/003/004/008; v2.1.2 closes F-BUG-001; v2.2.0 closes F-CORE-009/011/012). No separate audit-trail artifact is needed.

**Q4:** Implementation mode?
**A4:** Premium (Opus everything). Phase 1 touches crypto error semantics (security-sensitive — wrong classification could downgrade attack surface visibility); Phase 2's `tests/transaction-errors.test.ts` and `tests/wallet-builder.test.ts` need careful mocking + vendor-test-vector handling.

**Q5:** Phase 3's audit-spec acceptance proposed "≥30 new tests across {failover-client, timeouts, failover-submit}" — but those are existing v2.1.0 test files, not new ones. Is the target still ≥30?
**A5:** Updated target: **≥29 new it-blocks** for Phase 2 (renamed from Phase 3 after F-CORE-010 drop). Distribution: pact-reader.test.ts ≥5, wallet-builder.test.ts ≥6, transaction-errors.test.ts ≥10, seed-type-migration.test.ts ≥3, encryption.test.ts +3, encryption-upgrade.test.ts +1, codex-codec.test.ts +1, cfm-builders.test.ts +2 (defensive amount only — drops per-builder negative-charset since Phase 2 was cut), pact-format.test.ts +3 = 34 maximum if every it-block target is hit. Floor of 29; ceiling driven by implementer's judgment when authoring vendor-vector tests.

**Q6:** Is `migrateSeedType` already covered by existing tests?
**A6:** Yes — `tests/codex-codec.test.ts:202-232` has 5 existing `migrateSeedType` it-blocks. Phase 2's new `tests/seed-type-migration.test.ts` must NOT duplicate them. Focus the new file on round-trip INTEGRATION through `serializeCodex`/`deserializeCodex` plus pinning the locked unknown-input behaviour (`migrateSeedType("garbage") → "koala"` per audit acceptance criterion).

### Existing Code to Reference

From the researcher's verification pass:

#### Phase 1 (crypto)
- **`Z:/OuronetCore/src/crypto/v1.ts`** — 147 lines.
  - Lines 67-70: V1 `encryptString` catch-all (`console.error` + `throw new Error("Failed to encrypt data")`).
  - Lines 79-80: JSON.parse boundary inside `decryptString` (CorruptEnvelopeError source).
  - Lines 94, 102, 115-119: AES-GCM call sites (`importKey`, `deriveKey`, `decrypt`). Auth-tag failure at line 115-119 → WrongPasswordError source.
  - Lines 122-127: V1 `decryptString` catch-all (`console.error` + `throw new Error("Failed to decrypt data. Invalid password or corrupted data.")`).

- **`Z:/OuronetCore/src/crypto/v2.ts`** — 188 lines.
  - Line 82: V2 JSON.parse boundary (CorruptEnvelopeError source).
  - Lines 94-98: V2 AES-GCM call (WrongPasswordError source).
  - Lines 102-120: `decryptStringV2`'s internal V1-fallback path. **Stays untouched** — this is a belt-and-suspenders branch consumers may hit directly via `decryptStringV2(blob, pw)`.
  - Lines 124-130: `isEncryptedV2(blob)` deterministic shape predicate (`JSON.parse(atob(...))?.v === 2`, returns `false` on any throw). **Confirmed safe as the sole branch in `smartDecrypt`.**
  - Lines 167: `smartEncrypt` dynamic V1 import. **Stays untouched** — V1-write path is intentional.
  - Lines 177-187: `smartDecrypt` V1-then-V2 fallback chain. **Replaced** with `return isEncryptedV2(blob) ? decryptStringV2(blob, pw) : decryptString(blob, pw);`.

- **`Z:/OuronetCore/src/crypto/index.ts`** — 42 lines, current barrel exports from `./v1` and `./v2`. The 3 new error classes are added here.

#### Phase 2 (test coverage)
- **`Z:/OuronetCore/src/reads/pactReader.ts`** — 77 lines. `PactReader` type alias (line 33-44), `setPactReader(reader: PactReader): void` (line 54), `getPactReader(): PactReader` (line 63), `pactRead(pactCode, options?)` (line 71). Module-private state `_reader = rawCalibratedDirtyRead` at line 46. **No runtime null guard** on `setPactReader` — `setPactReader(null!)` would silently install null and break the next read. Existing partial coverage at `tests/interactions-read-seam.test.ts` (15 it-blocks).
- **`Z:/OuronetCore/src/wallet/KadenaWalletBuilder.ts`** — 151 lines. `createWalletPair` (line 41), `createWalletPairFromMnemonic` (line 56) with seedType dispatch at line 62, `encrypt`/`decrypt` (lines 95, 102), `generateMnemonic(length: 12 | 24)` (line 110), `isValidMnemonic` (line 125). Vendor test vectors via peerDep `@kadena/hd-wallet ^0.6.0`.
- **`Z:/OuronetCore/src/errors/transactionErrors.ts`** — 261 lines. `SigningError` class (line 13), `createSigningError` 5 branches (line 38, branches at 46/60/74/88/103), `createSimulationError` 5 branches (line 119, branches at 127/144/158/172/187). Gas-extraction regex `/exceeded:\s*(\d+)/` at line 128. `createTimeoutError` already exists (line 207, v2.1.0). `formatErrorForUser` at line 229.
- **`Z:/OuronetCore/src/codex/seedTypeMigration.ts`** — 43 lines. Already partly tested at `tests/codex-codec.test.ts:202-232`.
- **`Z:/OuronetCore/src/codex/codec.ts`** — 94 lines. `deserializeCodex` (line 75) preserves unknown future fields via `parsed as CodexExportV1_2<...>` cast — Phase 2 pins this contract via test.
- **`Z:/OuronetCore/src/pact/format.ts`** — 162 lines. `formatDecimalForPact` (line 28-48) already throws on scientific notation. Phase 2 extends `tests/pact-format.test.ts` with leading-zero, EU-separator, trailing-zero edge cases.

#### Existing test patterns to mirror
- `tests/encryption.test.ts:36` — `parseEnvelope(enc)` helper for tampered-envelope tests.
- `tests/encryption-upgrade.test.ts:166-183` — `decryptStringV2 V1-fallback path` block (preserved post-fix).
- `tests/cfm-builders.test.ts:293-317` — `it.each` cross-cutting pattern.
- `tests/codex-codec.test.ts:202-232` — existing `migrateSeedType` block (do not duplicate).
- `tests/interactions-read-seam.test.ts:51` — `setPactReader(stub)` + `beforeEach`/`afterEach` reset.
- `tests/wallet.test.ts:42` — injection-seam contract style.
- `tests/signing.test.ts:18` — RFC 8032 vector style for wallet-builder tests.

### Follow-up Questions

None. The discussion above resolved the design questions; remaining details are implementation-side and will be locked in plan-phase TASKS.md.

## Visual Assets

No visual assets provided. This is a backend library spec with no UI surface.

## Implementation Mode

**premium** (Opus everything) — locked per Q4 above.

## Requirements Summary

### Functional Requirements

#### Phase 1: Crypto error taxonomy + smartDecrypt timing-leak fix (F-CORE-009)

- [x] **REQ-01:** Add three new error classes — `WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError` — exported from `src/crypto/index.ts`. Each extends `Error` with `name` set appropriately. They are observable in the `dist/crypto` barrel after build (additive public exports).
- [x] **REQ-02:** V1 `decryptString` (`src/crypto/v1.ts:67-127`) and V2 `decryptStringV2` (`src/crypto/v2.ts:79-121`) are updated to classify errors by which decode step failed: JSON.parse failure → throw `CorruptEnvelopeError`; AES-GCM auth-tag failure (`OperationError`) → throw `WrongPasswordError`; other failures → throw a wrapped `Error` with the original as `cause`. The previous catch-all string messages are replaced.
- [x] **REQ-03:** `smartDecrypt` (`src/crypto/v2.ts:177-187`) replaces its V1-then-V2 fallback chain with deterministic shape-based dispatch: `return isEncryptedV2(blob) ? decryptStringV2(blob, pw) : decryptString(blob, pw);`. This eliminates the ~1.5s wall-time differential on a wrong-password path against a V1 envelope (the timing side channel). `decryptStringV2`'s internal V1-fallback path at lines 102-120 stays untouched (consumers can still call `decryptStringV2(blob, pw)` directly with a V1 blob).
- [x] **REQ-04:** `console.error` calls in V1 `encryptString` (line 67-70) and `decryptString` (line 122-127) catches are removed. The thrown error already carries the cause (via the `cause` parameter or the typed class); consumers (or a future logger seam) decide whether to log.

#### Phase 2: Test coverage for critical untested surfaces (F-CORE-011 + F-CORE-012)

- [x] **REQ-05:** New test file `tests/pact-reader.test.ts` covers the `setPactReader`/`pactRead`/`getPactReader` injection seam. At minimum 5 it-blocks: (1) default reader is `rawCalibratedDirtyRead` when no `setPactReader` call has happened, (2) `setPactReader(fn)` swaps the active reader, (3) `pactRead(code, opts)` calls the configured reader with forwarded args, (4) calling `setPactReader` twice replaces (does not stack), (5) `getPactReader()` returns the currently-configured reader. Mock the default reader via dependency injection — no real network.
- [x] **REQ-06:** New test file `tests/wallet-builder.test.ts` covers `KadenaWalletBuilder` mnemonic dispatch. At minimum 6 it-blocks: (1) round-trip a fixed 24-word BIP39 mnemonic through `createWalletPairFromMnemonic(pw, m, 0, "koala")`, assert derived pubkey matches a vendor test vector from `@kadena/hd-wallet`; (2) same for a 12-word Chainweaver mnemonic; (3) same for `eckowallet` 12-word; (4) mismatched mnemonic length + seedType throws (e.g., 12-word with `"koala"`); (5) `isValidMnemonic` returns true/false correctly for valid/invalid/wrong-length cases; (6) `generateMnemonic(12)` and `(24)` produce correct length; any other length throws.
- [x] **REQ-07:** New test file `tests/transaction-errors.test.ts` covers every documented branch of `createSigningError` and `createSimulationError`. At minimum 10 it-blocks: 5 for `createSigningError` branches (`INVALID_SIGNATURE`, `PRIVATE_KEY_ERROR`, `CAPABILITY_ERROR`, `GAS_ERROR`, `GENERIC_SIGNING_ERROR` fall-through), 5 for `createSimulationError` branches (`GAS_LIMIT_EXCEEDED`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `KEYSET_ERROR`, `SIMULATION_FAILED` fall-through). Plus a gas-extraction regex test (`"exceeded: 12345"` → captures `"12345"`) and a `formatErrorForUser` shape test (output includes message + at least one suggestion).
- [x] **REQ-08:** New test file `tests/seed-type-migration.test.ts` covers `migrateSeedType` round-trip integration. **Must not duplicate** the existing 5 it-blocks at `tests/codex-codec.test.ts:202-232`. At minimum 3 NEW it-blocks: (1) Phase-1 codex round-trip — serialize a v1.2 codex containing legacy seed-type strings, deserialize, run through `migrateSeedType`, assert idempotence; (2) `migrateSeedType("garbage") → "koala"` (audit-locked unknown-input fallback); (3) all 5 enumerated input strings → expected outputs in a parameterized `it.each` block.
- [x] **REQ-09:** Extend `tests/encryption.test.ts` with at minimum 3 new it-blocks: (1) **structurally-malformed envelope produces `CorruptEnvelopeError`** — pass a valid-base64 input that decodes to a JSON envelope MISSING the required `ciphertext` field (e.g., `btoa(JSON.stringify({v:2, iv:"...", salt:"..."}))`) to `smartDecrypt`; the inner `b642ab(parsed.ciphertext)` call fails (`atob(undefined)` throws) → V2 path throws `CorruptEnvelopeError`. **Note (locked iter 2):** the original "flip a byte in `parsed.v`" tamper does NOT produce `CorruptEnvelopeError` — V1 envelopes are structurally a subset of V2 envelopes (`{ciphertext, iv, salt}` vs `{v:2, ciphertext, iv, salt}`), so flipping `v` from 2 to anything else routes to V1 which decodes the fields successfully and reaches AES-GCM-decrypt-with-wrong-KDF, yielding `WrongPasswordError` per the locked Phase-1 AES-GCM scope. Re-spec'd to a structurally-malformed envelope so `CorruptEnvelopeError` is reliably reachable. (2) `smartEncrypt(plaintext, password, "0")` produces V1, `(plaintext, password, "1")` produces V2, `(plaintext, password, null)` matches documented behavior; (3) wrong-password V1 throws `WrongPasswordError` (asserts the new error class from REQ-01 is thrown).
- [x] **REQ-10:** Extend `tests/encryption-upgrade.test.ts` with at minimum 1 new it-block: direct call to `smartDecrypt(corruptedV1Blob, password)` asserts it does NOT silently succeed under the new single-KDF dispatch. Throws `CorruptEnvelopeError` (or appropriate class) — does NOT fall through to V2 KDF.
- [x] **REQ-11:** Extend `tests/codex-codec.test.ts` with at minimum 1 new it-block: round-trip a hand-crafted JSON `{"version":"1.2","kadenaWallets":[],"ouronetWallets":[],"addressBook":[],"uiSettings":{},"futureFieldX":"x"}` through `deserializeCodex`, assert the parsed result preserves `futureFieldX` (forward-compat pin — unknown extra fields survive the cast).
- [x] **REQ-12:** Extend `tests/cfm-builders.test.ts` with at minimum 2 new it-blocks: defensive amount-validation tests asserting `() => buildXPactCode({...valid, amount: "abc"})` throws (since `formatDecimalForPact` already throws). Choose 2 representative builders. **Note:** the original audit-spec proposed per-builder negative-charset tests for `pactString` rejection; those are dropped because Phase 2 (F-CORE-010) was rejected.
- [x] **REQ-13:** Extend `tests/pact-format.test.ts` with at minimum 3 new it-blocks: `formatDecimalForPact` edge cases — scientific notation `"1e10"` (already rejected by current regex), leading zeros `"007.5"` (currently accepted), EU separator `"1,5"` (currently rejected — confirms regex behaviour), trailing zeros `"1.500"` (currently accepted, no truncation under 24 decimals).
- [x] **REQ-14:** Total project test count grows by ≥29 it-blocks (target ~415 from v2.1.2 baseline of 386). CI test wall-time stays under 30s on Node 22 / Ubuntu (current 15-20s baseline grows to ~25s without concern).

#### Release artifacts

- [x] **REQ-15:** `package.json` `"version"` field bumped from `2.1.2` to `2.2.0`.
- [x] **REQ-16:** `CHANGELOG.md` prepended with a `## 2.2.0 — YYYY-MM-DD` entry. Format mirrors v2.1.0 / v2.1.2 single-concern patches but for a minor: lead paragraph describing the additive nature, `### Added (public surface)` listing the 3 new error classes, `### Fixed` citing F-CORE-009 / F-CORE-011 / F-CORE-012 closures, `### Rejected (decisions log)` section explicitly noting F-CORE-010 was reviewed and intentionally not implemented (chain-side validation duplicates), `### Stats` block with new test count (≥415 passing), files-changed list, and the no-public-API-removal note.
- [x] **REQ-17:** `README.md` updates per the locked maintenance rule:
    - `## Status` block leads with `2.2.0` and a one-line summary of the additive changes.
    - Version history extended with a v2.2.0 paragraph mentioning F-CORE-009 closure + the 4 new test files + the F-CORE-010 rejection rationale.
    - Test-count references refreshed (`386` → new total, `+40 new` → new derived counter).
    - Submodule table row for `./crypto` cites the v2.2.0+ additions (`WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError`).
    - Optional: brief "What's new in v2.2.0" section with copy-paste error-class usage example (similar to v2.1.0's "What's new" block).

### Non-Functional Requirements

- [x] **NFR-01: Strict semver compliance.** Minor version bump (additive only). New public exports (3 error classes); no removals; no signature changes; existing thrown messages remain readable as `Error`.
- [x] **NFR-02: Sequential consumer compatibility.** All existing crypto consumers see equivalent behavior on success. On failure they get a more specific error class; `instanceof Error` and `error.message` still work as before. Consumers gain optional `instanceof WrongPasswordError` discrimination.
- [x] **NFR-03: Test isolation, deterministic, no real network calls.** All new tests use mocking. CI test runtime stays under 30s on Node 22 / Ubuntu.
- [x] **NFR-04: Documentation alignment.** README + CHANGELOG reflect v2.2.0 per locked maintenance rule. The publish workflow's README+CHANGELOG version-parity gate (added 2026-05-02) blocks publish if any of the three doc surfaces (`## Status` block, version history paragraph, CHANGELOG first heading) drift.
- [x] **NFR-05: F-CORE-010 explicit rejection.** Decisions log records the rationale (chain-side Pact compilation validates; consumer-side mirroring is overreach). Future audit-specs may revisit only if a non-chain-validated context emerges.
- [ ] **NFR-06: Atomic-ship contract.** All deliverables (Phase 1 + Phase 2 tests + version + CHANGELOG + README) ship in a single commit and a single `v2.2.0` annotated tag, like prior releases. Workflow gate enforces version parity.

### Reusability Opportunities

- **`parseEnvelope` helper at `tests/encryption.test.ts:36`** — directly reusable for tampered-envelope tests in REQ-09.
- **Existing tampering pattern at `tests/encryption.test.ts:75-83`** (V1 corrupted-ciphertext) — shape for the corrupted-V1-blob test in REQ-10.
- **`it.each` cross-cutting pattern at `tests/cfm-builders.test.ts:293-317`** — reusable for the 5-input × 2-roundtrip migration matrix in REQ-08.
- **`setPactReader(stub)` + `beforeEach`/`afterEach` reset pattern at `tests/interactions-read-seam.test.ts:51`** — shape for REQ-05.
- **RFC 8032 vector style at `tests/signing.test.ts:18`** — shape for REQ-06's vendor-test-vector assertions.
- **Vitest 4.x + `vi.fn().mockResolvedValue(...)` patterns** already established across all existing test files.
- **`@kadena/hd-wallet` peerDep test fixtures** for vendor mnemonic vectors used in REQ-06.

### Scope Boundaries

**In Scope:**
- [ ] Phase 1 production code: 3 source files (`src/crypto/v1.ts`, `src/crypto/v2.ts`, `src/crypto/index.ts`) + 3 new error classes.
- [ ] Phase 2 test coverage: 4 new test files + 5 extensions to existing test files.
- [ ] Release artifacts: `package.json` bump + CHANGELOG entry + README update per locked maintenance rule.
- [ ] Single atomic commit + `v2.2.0` annotated tag + npm publish via existing workflow.

**Out of Scope:**
- F-CORE-010 (Pact-code injection escaping). Reviewed during spec discovery and rejected. Rationale: chain-side validation already enforces account-format / token-ID-format / Pact-compilation correctness at simulation time; consumer-side mirroring duplicates logic, drifts from chain reality, and imposes maintenance burden for theoretical defense-in-depth. The audit-spec source `high-security-crypto-and-injection.md` Section 2 (F-CORE-010) is left in place under `bundles/high-additive/` with a "rejected" note; it stays in `audit-specs-done/` post-archive.
- AUDIT.md creation. The file doesn't exist; CHANGELOG.md is the canonical closure record.
- Any change to `src/pact/cfmBuilders.ts` or `src/pact/format.ts`'s `pactString` would-be helper. Phase 2 (F-CORE-010) dropped.
- Any other audit-spec from the 2026-04-30 audit cycle: `bundles/medium/_bundle.md` (v2.3.0 target), `low-improvements.md` (v2.3.1 patch), `high-error-fabricated-fallbacks.md` (v3.0.0 major, ships LAST per breaking nature).
- `migrateSeedType` unit-level coverage (already in `tests/codex-codec.test.ts:202-232`). REQ-08 explicitly avoids duplication.
- DALOS charset enforcement, account-shape validation, token-ID-shape validation — all chain-side concerns.

### Technical Considerations

- **Atomic-ship contract.** Phase 1 + Phase 2 ship as ONE v2.2.0 release. Test coverage for Phase 1's new error classes lands in Phase 2's REQ-09 (encryption.test.ts extension). The tests assert the new error classes are thrown for their specific failure modes — which means Phase 2's tests run AGAINST Phase 1's production code in the same release. Both phases are committed atomically.
- **Phase 1 → Phase 2 boundary.** Phase 1 introduces the 3 error classes. Phase 2's `tests/encryption.test.ts` (REQ-09) assertions reference them by name. If Phase 1 lands but Phase 2 doesn't, the new error surface ships untested — the v2.2.0 publish gate (typecheck + 415-test target + dist barrel check) catches this.
- **Workflow gate.** `.github/workflows/publish.yml` (updated 2026-05-02) blocks publish if README ## Status block, README version history, or CHANGELOG first heading don't reference `2.2.0`. The gate runs BEFORE `npm publish`. Stale-README ships are physically impossible.
- **Pre-existing locale failure** (`tests/gas.test.ts > formatMaxFee` on Windows non-en-US) continues to exist. Phase 2's verification gate accepts this as the sole-allowed non-zero exit via the criterion locked in v2.1.2's Phase 2.
- **Vendor test vectors for REQ-06.** `@kadena/hd-wallet ^0.6.0` exposes test fixtures. Implementer reads its `tests/` to extract a known-good 24-word + 12-word vector before authoring `wallet-builder.test.ts`.
- **CI test wall-time.** Current baseline ~15-20s. Adding ≥29 test scenarios may push toward 25s; the spec's NFR-03 caps at 30s on Node 22 / Ubuntu. Implementer should profile during T2.x quality-gate verification.
- **No new runtime dependencies.** All Phase 1 + Phase 2 work uses existing imports. `@kadena/hd-wallet` test fixtures are dev-only.
