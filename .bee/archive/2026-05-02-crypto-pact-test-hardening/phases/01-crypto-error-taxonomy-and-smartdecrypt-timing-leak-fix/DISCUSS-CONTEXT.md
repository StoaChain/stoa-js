# Phase 1: Crypto error taxonomy + smartDecrypt timing-leak fix - Discussion Context

**Generated:** 2026-05-02T15:15:00Z
**Mode:** Smart discuss (ship) - auto-recorded from plan-review locks
**Domain:** RUN (execution/behavior — error class dispatch + KDF flow)

<domain>
## Phase Boundary
Replace V1/V2 `decryptString` catch-all error strings with three typed error classes (`WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError`); collapse `smartDecrypt`'s V1-then-V2 fallback chain to deterministic shape-based dispatch via `isEncryptedV2`; remove `console.error` calls from V1 catches. Closes F-CORE-009. No tests added in this phase — Phase 2 owns the assertions per the atomic-ship contract.
</domain>

<decisions>
## Implementation Decisions

### Locked Constraints (from plan-review iterations 1-3, 8 findings auto-fixed)
All implementation decisions are LOCKED in `TASKS.md` "Locked decisions" block (lines 14-30). Auto-accepted at HIGH confidence — the plan-review process iterated 3 times to converge on these:

- **Class layout:** New sibling file `src/crypto/errors.ts` re-exported from `src/crypto/index.ts` (matches project's pure-re-export barrel convention; F-002/F-PAT-003 iter 1)
- **Import path for in-repo tests:** `from "../src/crypto"` ONLY (NOT package-name self-reference; F-008 iter 2 + F-301 iter 3)
- **AES-GCM ambiguity:** `WrongPasswordError` thrown for ANY AES-GCM auth-tag failure regardless of cause; `CorruptEnvelopeError` reserved for envelope-PARSING failures only (F-001 iter 1; W3C WebCryptoAPI spec)
- **REQ-09(1) test wording:** structurally-malformed envelope missing `ciphertext` field (NOT v-flip; F-NEW-001/D-001 iter 2 — locked into requirements.md:103 + spec.md:52)
- **Envelope-field-shape mismatch routing:** inner `b642ab`/`base64ToArrayBuffer` failures on missing/non-string fields → `CorruptEnvelopeError` (F-NEW-002 iter 2)
- **Non-object `parsed` post-parse access:** `JSON.parse("null") === null` → property access throws raw TypeError → MUST be guarded as `CorruptEnvelopeError` via either extending JSON.parse try block or explicit `if (parsed === null || typeof parsed !== "object")` guard (F-001 iter 3)
- **smartDecrypt import style:** dynamic `await import("./v1")` matching smartEncrypt's existing pattern (F-PAT-002 iter 1)
- **V1 encrypt cause-wrap:** `throw new Error("Failed to encrypt data", { cause: error })` with explicit ES2022 `Error.cause` chain (F-PAT-001 iter 1)
- **Concrete try-block skeleton in T1.2/T1.3:** 5-step structure (parse → non-object guard → inner b642ab → importKey/deriveKey → AES-GCM decrypt) with each step in its own classifying try (F-X02 cross-plan iter 1)
- **Sequential consumer compatibility:** `instanceof Error` and existing `error.message` access still work for un-upgraded consumers — new typed classes are opt-in additive surface

### Carried Forward (from plan-review iterations 1-3 + cross-plan iterations 1-3)
- 8 distinct findings closed across 3 plan-review iterations
- 9 cross-plan findings closed across 3 cross-plan iterations
- All decisions verified at iter 3 final by both bug-detector and plan-compliance-reviewer (CLEAN)

### Claude's Discretion
- Implementer chooses concrete variable names (`saltBuf`/`ivBuf`/`ctBuf` per skeleton are suggestions)
- Implementer chooses whether to use option (a) extended-try or option (b) explicit guard for non-object `parsed` (both acceptable)
- Implementer chooses message text (locked: cause is preserved; message wording flexible)
</decisions>

<code_context>
## Codebase Findings (from plan-review research)
- `Z:/OuronetCore/src/crypto/v1.ts:74-128` — `decryptString` body verified; JSON.parse line 80, AES-GCM decrypt 115-119, catch 122-127
- `Z:/OuronetCore/src/crypto/v1.ts:23-71` — `encryptString`; catch line 67-70 with `console.error` to remove
- `Z:/OuronetCore/src/crypto/v2.ts:79-121` — `decryptStringV2`; structural V2 branch + V1 fallback intact
- `Z:/OuronetCore/src/crypto/v2.ts:124-130` — `isEncryptedV2` predicate (deterministic, returns false on throw)
- `Z:/OuronetCore/src/crypto/v2.ts:160-169` — `smartEncrypt` UNTOUCHED including dynamic import line 167
- `Z:/OuronetCore/src/crypto/v2.ts:177-187` — `smartDecrypt` to be replaced with shape-based dispatch
- `Z:/OuronetCore/src/crypto/index.ts:25-41` — barrel; gain new `export { ... } from "./errors"`
- `Z:/OuronetCore/src/errors/transactionErrors.ts:13-33` — pre-ES2022 custom-error precedent (use modern `super(message, options)` instead)
- `Z:/OuronetCore/tsconfig.json` — `target: "ES2020"`, `lib: ["ES2023"]` — supports `ErrorOptions` natively
- `Z:/OuronetCore/package.json:74-76` — Node ≥20 confirmed (`Error.cause` runtime support)
</code_context>

<deferred>
## Deferred Ideas
- F-X05 `UnsupportedFormatError` YAGNI concern (no thrown source) — REJECTED in cross-plan iter 1, ships per spec REQ-01 with documented "reserved for future format extensions" note in CHANGELOG
- T1.4 smartDecrypt restructure could be made `static import` rather than `dynamic` — REJECTED iter 1, dynamic import preserves stylistic symmetry with `smartEncrypt`'s line-167 pattern
</deferred>
