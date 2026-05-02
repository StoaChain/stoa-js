# Phase 2: Test coverage for critical untested surfaces + v2.2.0 release - Discussion Context

**Generated:** 2026-05-02T15:15:00Z
**Mode:** Smart discuss (ship) - auto-recorded from plan-review locks
**Domain:** RUN + READ + ORGANIZED (test coverage, release artifacts, version-parity gate)

<domain>
## Phase Boundary
Add 4 new test files + 5 test-file extensions covering Phase 1's new error-class surface AND the 4 previously-untested critical surfaces flagged in F-CORE-011 + F-CORE-012. Bump `package.json` to 2.2.0, prepend `## 2.2.0` CHANGELOG entry citing closures + F-CORE-010 rejection, update README per locked maintenance rule. Ship as atomic v2.2.0 commit + tag with Phase 1.
</domain>

<decisions>
## Implementation Decisions

### Locked Constraints (from plan-review iterations 1-3 + cross-plan 1-3, 24 findings auto-fixed total)
All implementation decisions are LOCKED in `TASKS.md` (T2.1-T2.13 acceptance + research + locked-decisions preamble). Auto-accepted at HIGH confidence:

- **Test count math:** Per-file floors `5+6+10+3+5+1+1+2+3 = 36 NEW tests`; baseline `M = N - 386` (v2.2.0-only delta from v2.1.2 baseline; F-302 cross-plan iter 3 corrected from `N - 346` cumulative-since-v1.x to match file-list scope)
- **T2.5 floor 5 (raised from spec floor 3):** 3 typed-error tests + 1 console-spy behavioral test (F-X04 cross-plan iter 1) + 1 V1-encrypt cause-wrap behavioral test (F-X06 cross-plan iter 1)
- **T2.5 + T2.6 cross-phase dependency:** explicit `needs: phase-1` annotation (F-X01 cross-plan iter 1 — Phase 1 deliverable must land before Phase 2 imports resolve)
- **REQ-09(1) test:** structurally-malformed envelope missing `ciphertext` field via `btoa(JSON.stringify({v:2, iv:"AA==", salt:"AA=="}))` routed through `smartDecrypt` → V2 branch → inner `b642ab(parsed.ciphertext)` → `CorruptEnvelopeError`
- **REQ-04 traceability:** T2.5's `requirements:` field updated to `[REQ-09, REQ-04]` (CI-001 cross-plan iter 2 — added behavioral coverage of REQ-04)
- **T2.13 verification gate:** `npm run clean` before `npm run build`; explicit `test -f dist/crypto/errors.d.ts`; runtime export verification via dynamic ESM import; per-file wall-time budgets (wallet-builder <3000ms; encryption <2000ms; others <500ms); per-extended-file NEW it-block deltas enforced (encryption ≥5, encryption-upgrade ≥1, codex-codec ≥1, cfm-builders ≥2, pact-format ≥3); workflow-gate-verbatim grep patterns matching `.github/workflows/publish.yml:99/111/120` with exact `[[:space:]]+`/`[[:space:]]` anchors
- **Release artifact format:** package.json single-character version edit; CHANGELOG `## 2.2.0 — 2026-05-02` heading with Lead/Added/Fixed/Rejected/Stats sections; CHANGELOG bold convention `**N** passing` (F-PAT-004 iter 2 — bold wraps NUMBER ONLY); README `+M new tests across <file-list>` phrasing keeping the 9 v2.2.0 file basenames (F-PAT-005 iter 2 — preserves at-a-glance scan cue, no build-internal text leak)
- **Placeholder-patching responsibility:** T2.13 implementer (NOT conductor) patches `≥{N}` and `+{M}` placeholders post-`npm test` (F-004 iter 1 + F-303 iter 3); CHANGELOG stat-block ships clean consumer-facing prose only (no build-internal `≥29 / ≥34 / ≥420` literals)
- **F-CORE-010 explicit rejection:** dedicated `### Rejected (decisions log)` section in CHANGELOG documenting chain-side validation rationale; submodule table row + What's new section in README cite the 3 new error classes
- **Import path for in-repo tests:** `from "../src/crypto"` ONLY (F-008 iter 2 — package-name self-reference rejected because exports map routes to dist/ which doesn't exist before npm run build)
- **T2.4 unknown-input string:** `"v3-future-seed"` (NOT `"garbage"` — F-PAT-001 iter 1 + F-007 iter 2 — `"garbage"` already exercised at codex-codec.test.ts:219 idempotence loop)

### Carried Forward (from Phase 1 lock-down)
- AES-GCM ambiguity scope: `WrongPasswordError` for ALL auth-tag failures; `CorruptEnvelopeError` reserved for envelope-PARSING only
- The 3 new error classes from `src/crypto/errors.ts` re-exported via `src/crypto/index.ts` barrel
- Atomic-ship contract: Phase 2 lands in same commit + tag as Phase 1; Phase 1 deliverables MUST be on disk before Phase 2 tests run

### Claude's Discretion
- Implementer of T2.5 chooses describe-block placement (new vs scattered)
- Implementer of T2.4 chooses unknown-input string from acceptable alternatives (`"v3-future-seed"`, `"future-seed-type-v3"`, hex blob, etc.)
- Implementer of T2.11/T2.12 chooses placeholder form (`≥{N}` literal vs `≥415` lower-bound — both work for T2.13's grep)
</decisions>

<code_context>
## Codebase Findings (from plan-review research + cross-plan integrity sweep)
- `Z:/OuronetCore/tests/encryption.test.ts:1-271` — 31 existing it-blocks, parseEnvelope helper at line 36
- `Z:/OuronetCore/tests/encryption-upgrade.test.ts:1-231` — 11 existing it-blocks
- `Z:/OuronetCore/tests/codex-codec.test.ts:202-232` — 5 existing migrateSeedType tests (DO NOT DUPLICATE)
- `Z:/OuronetCore/tests/cfm-builders.test.ts:293-317` — `it.each` parameterized template
- `Z:/OuronetCore/tests/pact-format.test.ts:65-88` — formatDecimalForPact rejection pattern
- `Z:/OuronetCore/tests/interactions-read-seam.test.ts:163-170` — pactReader reset pattern (mirrored in T2.1)
- `Z:/OuronetCore/src/reads/pactReader.ts` — setPactReader/pactRead/getPactReader API
- `Z:/OuronetCore/src/wallet/KadenaWalletBuilder.ts` — createWalletPairFromMnemonic/isValidMnemonic/generateMnemonic
- `Z:/OuronetCore/src/errors/transactionErrors.ts:46-198` — 5+5 createSigningError/createSimulationError branches
- `Z:/OuronetCore/src/codex/seedTypeMigration.ts:24-32` — RawSeedType + SEED_TYPE_MIGRATION 5-row matrix
- `Z:/OuronetCore/CHANGELOG.md:1-21` — v2.1.2 entry establishes the per-release format pattern
- `Z:/OuronetCore/README.md:7-99,250,302` — Status/version-history/test-count/submodule pattern reference
- `Z:/OuronetCore/.github/workflows/publish.yml:99,111,120` — three workflow-gate grep checks (verbatim mirror in T2.13)
</code_context>

<deferred>
## Deferred Ideas
- F-X05 dropping `UnsupportedFormatError` from public surface — REJECTED in cross-plan iter 1 (spec REQ-01 mandates 3 classes; "reserved for future format extensions" documented in CHANGELOG)
</deferred>
