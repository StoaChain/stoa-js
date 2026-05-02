# Phase 1: Crypto error taxonomy and smartDecrypt timing-leak fix -- Tasks

<!-- Pass 2 output: tasks grouped into waves with dependency analysis and file-ownership conflict resolution. -->

## Goal

Replace V1/V2 `decryptString` catch-all error strings with three typed error classes (`WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError`); collapse `smartDecrypt`'s V1-then-V2 fallback chain to deterministic shape-based dispatch via `isEncryptedV2`; remove `console.error` calls from V1 catches. Closes F-CORE-009. No tests are added in this phase — Phase 2 owns the assertions for the new error classes per the atomic-ship contract.

**Files in scope:**
- `Z:/OuronetCore/src/crypto/v1.ts` (147 lines)
- `Z:/OuronetCore/src/crypto/v2.ts` (188 lines)
- `Z:/OuronetCore/src/crypto/index.ts` (42 lines barrel)

**Locked decisions from requirements.md (auto-fix iter 1 expansions in bold):**
- The 3 new error classes are ADDITIVE public exports — barrel-exported via `./crypto`. No removals, no signature changes.
- Each class extends `Error`, sets `name`, and accepts an `options.cause`-style payload so existing `instanceof Error` consumers keep working.
- **Class layout LOCKED (auto-fix iter 1 per F-002/F-PAT-003):** the 3 classes live in a NEW sibling file `Z:/OuronetCore/src/crypto/errors.ts`, re-exported from `./index.ts` via `export { ... } from "./errors";`. This matches the established project pattern (`src/errors/transactionErrors.ts` re-exported via `src/errors/index.ts`) — every existing barrel in this project is a pure re-export. T1.1 MUST create the new file; T1.2 + T1.3 MUST import from `"./errors"`. The "either is acceptable" optionality from initial decomposition is REMOVED.
- V1/V2 classify by which decode step failed: JSON.parse / `atob` / envelope-shape failures → `CorruptEnvelopeError`; AES-GCM `OperationError` → `WrongPasswordError`; everything else → wrapped `Error` with original as `cause`.
- **AES-GCM ambiguity acknowledged (auto-fix iter 1 per F-001):** `WrongPasswordError` is thrown for ANY AES-GCM auth-tag failure (`error?.name === "OperationError"`), regardless of whether the underlying cause is a wrong password OR ciphertext tampering with the correct password. This is a design constraint, not a bug — AES-GCM produces the SAME signal for both cases by spec (W3C WebCryptoAPI). `CorruptEnvelopeError` is reserved for envelope-PARSING failures (JSON.parse, atob, envelope-field-shape mismatch), NOT ciphertext tampering. The spec's user-story wording about "tampered envelope" must be read as "structurally tampered envelope" (parseable JSON whose top-level shape is wrong, e.g., missing `v` field, non-string `ciphertext`), not "tampered ciphertext within a well-formed envelope". Phase 2 REQ-09 may NOT add a test that asserts `CorruptEnvelopeError` for ciphertext-tampering — such a test would lock an undeliverable contract.
- `decryptStringV2`'s INTERNAL V1-fallback at `v2.ts:102-120` STAYS unchanged — direct callers of `decryptStringV2(blob, pw)` keep belt-and-suspenders behavior.
- `smartDecrypt` (`v2.ts:177-187`) is replaced with `return isEncryptedV2(blob) ? decryptStringV2(blob, pw) : decryptString(blob, pw);`.
- **smartDecrypt import style LOCKED (auto-fix iter 1 per F-PAT-002):** keep DYNAMIC import for `decryptString` inside `smartDecrypt` (matching the in-file convention from `smartEncrypt`'s line 167 dynamic V1 import). This preserves stylistic symmetry between the two `smart*` functions in `v2.ts`. Suggested form: `const { decryptString } = await import("./v1"); return isEncryptedV2(encrypted) ? decryptStringV2(encrypted, password) : decryptString(encrypted, password);` — or the dynamic import folded into the V1 branch only. The previous "static import is recommended" guidance from initial research is OVERRIDDEN.
- `smartEncrypt` (`v2.ts:160-169`) is UNTOUCHED. The dynamic V1 import at line 167 stays — V1-write path is intentional.
- `console.error` calls in V1 `encryptString` (line 68) and `decryptString` (line 123) are REMOVED.
- **V1 encrypt cause-wrap LOCKED (auto-fix iter 1 per F-PAT-001):** the V1 `encryptString` catch's throw is rewritten from `throw new Error("Failed to encrypt data")` to `throw new Error("Failed to encrypt data", { cause: error })`. This propagates the original failure cause via the standard ES2022 `Error.cause` chain. The change is observable to consumers (they gain `caught.cause` introspection) but is purely additive — `caught.message` and `caught instanceof Error` are unchanged. The cause-wrap is intentional per requirements.md REQ-04 ("thrown error already carries the cause"); this entry pins the explicit authorization that was implicit before.
- **Envelope-field-shape mismatch routing LOCKED (auto-fix iter 2 per F-NEW-002):** inner base64-decode failures on missing or non-string envelope fields (e.g., `b642ab(parsed.ciphertext)` when `parsed.ciphertext` is undefined → `atob(undefined)` throws `InvalidCharacterError`; same for `parsed.iv` / `parsed.salt`) are envelope-shape mismatches and MUST classify as `CorruptEnvelopeError`. This is consistent with the top-level locked definition ("envelope-shape failures → `CorruptEnvelopeError`") and applies to BOTH `decryptString` (V1) and `decryptStringV2` (V2 path AND internal V1-fallback path). T1.2 and T1.3 acceptance criteria are amended to enumerate this third source explicitly. The implementer skeleton MUST place the inner `base64ToArrayBuffer` / `b642ab` calls inside the same try block that catches `CorruptEnvelopeError` candidates (NOT inside the AES-GCM decrypt try, NOT in the catch-all wrapped-Error bucket).
- **Non-object `parsed` post-parse access LOCKED (auto-fix iter 3 per F-001):** `JSON.parse` can succeed and return a non-object (e.g., `JSON.parse("null") === null`, `JSON.parse('"abc"') === "abc"`, `JSON.parse("42") === 42`). For `parsed === null` specifically, ANY subsequent property access throws raw `TypeError: Cannot read properties of null` — including `parsed.v` in V2's branch check AND the destructuring `const { ciphertext, iv, salt } = encryptedData` in V1. This `TypeError` falls OUTSIDE the inner-`b642ab` try block and would propagate raw, escaping the four-way classification. To close the gap, T1.2 and T1.3 implementers MUST place the post-parse property-access (V2's `parsed.v === 2` check; V1's destructuring) inside the SAME try block that classifies `CorruptEnvelopeError` — either by extending the JSON.parse try block to wrap both the parse AND the post-parse access, OR by adding a sibling try block with the same classification before the inner `b642ab` calls. Equivalent approach: add an explicit guard `if (parsed === null || typeof parsed !== "object") throw new CorruptEnvelopeError(...);` immediately after the JSON.parse try block. T1.2 and T1.3 acceptance criteria are amended to require the implementer to handle non-object `parsed` values as a fourth `CorruptEnvelopeError` source. Phase 2 REQ-09 may add a regression test (`btoa("null")` → `CorruptEnvelopeError`) but is not required to — the contract amendment alone is sufficient for Phase 1.
- **Phase 2 REQ-09 test-spec realignment LOCKED (auto-fix iter 2 per F-NEW-001 / D-001):** the original draft of REQ-09(1) ("flip a byte in `parsed.v` → routes to V1 → asserts `CorruptEnvelopeError`") is undeliverable under the locked Phase-1 AES-GCM scope and was re-specified in `requirements.md:103` and `spec.md:52`. Trace: V1's `EncryptedData` interface (`src/crypto/v1.ts:16-20`) is `{ciphertext, iv, salt}` — a structural subset of V2's `{v:2, ciphertext, iv, salt}`. Flipping `v` from `2` to any other value makes `isEncryptedV2()` return false, routes to V1, which JSON.parses successfully, reads `ciphertext/iv/salt` (all present), runs PBKDF2-SHA256/10k on V2-encrypted ciphertext (wrong KDF), AES-GCM auth-tag fails → `OperationError` → per locked Phase-1 scope, `WrongPasswordError`. NOT `CorruptEnvelopeError`. The replacement test in REQ-09(1) is now a structurally-malformed envelope (valid base64 JSON missing the `ciphertext` field) which makes the inner `b642ab(parsed.ciphertext)` throw → reliably reaches `CorruptEnvelopeError` via the F-NEW-002 lock above. Phase 2 plan-phase MUST honor the amended `requirements.md:103` REQ-09(1) wording — DO NOT re-introduce the v-flip tamper.

## Wave 1 (parallel -- no dependencies)

- [x] T1.1 | Add three new public error classes (`WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError`) to the crypto subpath and re-export them from the crypto barrel | bee-implementer
  - requirements: [REQ-01]
  - acceptance:
    - **NEW FILE LOCKED (auto-fix iter 1 per F-002/F-PAT-003):** the 3 classes live in a NEW sibling file `Z:/OuronetCore/src/crypto/errors.ts`. This matches the project pattern (every existing `src/*/index.ts` barrel is a pure re-export — see `src/errors/transactionErrors.ts` re-exported via `src/errors/index.ts:1-7`). The previous "either inline in index.ts or new errors.ts is acceptable" optionality is REMOVED — implementer MUST create `errors.ts` and re-export from the barrel. This locks the import path for Wave 2's parallel implementers (T1.2 and T1.3 both import from `"./errors"`).
    - Each class `extends Error`, sets `this.name` to the class name, and accepts a constructor signature compatible with `new WrongPasswordError(message?, options?)` so `cause` can be attached via `super(message, options)` (the standard ES2022 `Error` cause pattern already supported by Node 20+ / TS lib `es2022.error`).
    - `WrongPasswordError`, `CorruptEnvelopeError`, and `UnsupportedFormatError` are re-exported from `Z:/OuronetCore/src/crypto/index.ts` via a new line `export { WrongPasswordError, CorruptEnvelopeError, UnsupportedFormatError } from "./errors";` appended to the existing barrel. The barrel stays a pure re-export (no value declarations inline).
    - `instanceof Error` returns `true` for all three classes (Phase 2 will assert this; Phase 1 deliverable just needs the class hierarchy correct).
    - The `name` property is exactly `"WrongPasswordError"` / `"CorruptEnvelopeError"` / `"UnsupportedFormatError"` (not the default `"Error"`), so error-name-based switch consumers work.
    - `npm run typecheck` exits 0 after the change. Implementer runs typecheck only on the touched files (`npx tsc --noEmit`); the conductor runs the full project quality gate at end of wave.
  - context: spec.md "Crypto error taxonomy" section; requirements.md REQ-01; existing barrel at `Z:/OuronetCore/src/crypto/index.ts`; CLAUDE.md note that `src/crypto` is a subpath export so additive exports are immediately observable to consumers via `@stoachain/ouronet-core/crypto`.
  - research:
    - Pattern: [LOCKED — auto-fix iter 1 per F-002/F-PAT-003] requirements.md REQ-01 mandates exports come from `src/crypto/index.ts`. Class layout LOCKED to option (b): NEW sibling file `Z:/OuronetCore/src/crypto/errors.ts` re-exported via the barrel. Rationale (upgraded from [ASSUMED] to [CITED]): all four existing barrels in the project (`src/errors/index.ts:1-7`, `src/signing/index.ts:14-18`, `src/wallet/index.ts:8-16`, `src/crypto/index.ts:25-41`) are pure re-export barrels with NO value declarations. Inlining classes in `src/crypto/index.ts` would make it the only mixed-style barrel — eroding the project convention. The previous "either is acceptable" optionality is REMOVED.
    - Pattern: [CITED] Existing custom-error pattern lives at `Z:/OuronetCore/src/errors/transactionErrors.ts:13-33` (`class SigningError extends Error`). Note: that pattern uses pre-ES2022 explicit field assignment in the constructor and pre-dates the `cause` option; for the new classes use the modern `super(message, options)` form so `error.cause` is set automatically. Do NOT follow `SigningError`'s `originalError?: any` style — use the standard `cause`.
    - Reuse: [CITED] Current crypto barrel `Z:/OuronetCore/src/crypto/index.ts:25-41` uses two `export { ... } from "./v1"` / `from "./v2"` blocks. Add a third block `export { WrongPasswordError, CorruptEnvelopeError, UnsupportedFormatError } from "./errors"` (recommended new file) — keeps the barrel's named-re-export convention consistent.
    - Recommendation: [LOCKED — see "Pattern" entry above] New sibling file `Z:/OuronetCore/src/crypto/errors.ts` is the ONLY accepted layout. The four-barrel project convention (`src/errors/`, `src/signing/`, `src/wallet/`, `src/crypto/` all pure-re-export) is preserved.
    - Context7: [ASSUMED] Context7 query not run for this task — `Error.cause` is a TC39 ES2022 spec feature (Node 16.9+ runtime, TypeScript 4.6+ lib `es2022.error`), not a framework-specific pattern. Standard usage: `class WrongPasswordError extends Error { constructor(message?: string, options?: ErrorOptions) { super(message, options); this.name = "WrongPasswordError"; } }`. The `options.cause` is automatically attached as `this.cause` by the `Error` base constructor.
    - Types: [VERIFIED] `Z:/OuronetCore/tsconfig.json:3-4` confirms `target: "ES2020"` with `lib: ["ES2023"]`. ES2023 lib transitively includes the `ErrorOptions` interface (added in ES2022 lib `es2022.error`). The `super(message, options)` signature is type-checked by TypeScript when `lib` includes `es2022.error` or later — this project's `lib: ["ES2023"]` covers it.
    - Types: [VERIFIED] `Z:/OuronetCore/package.json:74-76` confirms `engines: { node: ">=20" }` — Node 20 has full ES2022 `Error.cause` runtime support, so the compiled output emits the `options` object verbatim and Node honors it. Module type is `"module"` (`package.json:5`) — the new `errors.ts` file (if created) needs no special handling, native ESM.
    - Approach: [ASSUMED] Suggested minimal class shape (each of the 3 follows the same template):
      ```ts
      export class WrongPasswordError extends Error {
        constructor(message?: string, options?: ErrorOptions) {
          super(message, options);
          this.name = "WrongPasswordError";
        }
      }
      ```
      No need for `Object.setPrototypeOf(this, new.target.prototype)` — that workaround is only required when `target: "ES5"`. With `target: "ES2020"` (verified above), the prototype chain is preserved natively and `instanceof` works correctly across realms.
  - notes:
    - Implementer used the locked layout: NEW file `src/crypto/errors.ts` + barrel re-export line appended to `src/crypto/index.ts:43`
    - Exact barrel line: `export { WrongPasswordError, CorruptEnvelopeError, UnsupportedFormatError } from "./errors";`
    - Import path for downstream T1.2/T1.3/T1.4: `from "./errors"` (within src/crypto/*.ts)
    - typecheck `npx tsc --noEmit` exit 0
    - **Scope expansion (accepted):** implementer added `tests/crypto-errors.test.ts` (5 surface-contract it-blocks: class existence, `name`, `instanceof`, `cause` propagation, optional-args constructor) to satisfy TDD Stop-hook RED-GREEN evidence requirement. This violates the original Phase 1 "no new test files" rule but is COMPLEMENTARY to Phase 2's REQ-09 tests (those exercise failure paths through decryptString/smartDecrypt; these test the additive class surface itself). Net effect: T1.5 acceptance bullet "no new files in tests/" needs relaxation; T2.13 git-status assertion needs to allow `tests/crypto-errors.test.ts` as expected new file.
    - RED-GREEN cycle documented: RED (errors.ts moved aside) → all 5 tests fail with `TypeError: WrongPasswordError is not a constructor`. GREEN (restored) → 5/5 pass.
    - Environment note: Node not on PATH; implementer used portable Node v22.11.0 from `%TEMP%/portable-node` for tsc + vitest invocations.

## Wave 2 (depends on Wave 1)

- [x] T1.2 | Update V1 `decryptString` and `encryptString` in `src/crypto/v1.ts` to classify decryption failures by decode step and remove `console.error` from both catches | bee-implementer | needs: T1.1
  - requirements: [REQ-02, REQ-04]
  - acceptance:
    - V1 `decryptString` (`src/crypto/v1.ts:74-128`) is restructured so that the JSON.parse boundary at line 80, the AES-GCM `decrypt` call at lines 115-119, and any other unexpected error each map to a different thrown class:
      - JSON.parse failure (or outer `atob` failure on a non-base64 input) → `throw new CorruptEnvelopeError(message, { cause: error })`.
      - **Non-object `parsed` post-parse failure (auto-fix iter 3 per F-001)** — `JSON.parse` succeeds but returns a non-object (e.g., `JSON.parse("null") === null`, `JSON.parse('"abc"') === "abc"`). Subsequent destructuring `const { ciphertext, iv, salt } = encryptedData` on `null` throws raw `TypeError`. Implementer MUST guard this case so it classifies as `CorruptEnvelopeError`. Two acceptable approaches: (a) extend the JSON.parse try block to wrap the destructuring as well, OR (b) add an explicit `if (parsed === null || typeof parsed !== "object") throw new CorruptEnvelopeError("...", { cause: ... });` guard immediately after the JSON.parse try block.
      - **Envelope-field-shape mismatch (auto-fix iter 2 per F-NEW-002)** — inner `base64ToArrayBuffer` failures on missing or non-string envelope fields, e.g. `base64ToArrayBuffer(parsed.ciphertext)` when `parsed.ciphertext` is `undefined` (calls `atob(undefined)` and throws `InvalidCharacterError`); same for `parsed.iv` and `parsed.salt`. These are envelope-shape failures and → `throw new CorruptEnvelopeError(message, { cause: error })`. Implementer MUST place the three inner base64-decode calls inside the same try block that classifies `CorruptEnvelopeError` (or a sibling try that classifies the same — NOT the AES-GCM-decrypt try, NOT the catch-all wrapped-Error bucket).
      - AES-GCM auth-tag failure (the WebCrypto `OperationError` thrown by `crypto.subtle.decrypt` when the derived key cannot authenticate the ciphertext) → `throw new WrongPasswordError(message, { cause: error })`.
      - Any other failure (e.g. unexpected runtime errors not covered by the above four buckets) → `throw new Error(message, { cause: error })` (a plain wrapped `Error` with the original attached as `cause`). The existing message text "Failed to decrypt data. Invalid password or corrupted data." may stay or be replaced; the contract is that the cause is preserved.
    - V1 `encryptString` (`src/crypto/v1.ts:23-71`) catch at line 67-70 has its `console.error("Encryption error:", error)` line REMOVED. The throw stays (`throw new Error("Failed to encrypt data", { cause: error })` — wrap the original via `cause` so the failure is not lost when consumers inspect it).
    - V1 `decryptString` catch at line 122-127 has its `console.error("Decryption error:", error)` line REMOVED.
    - The classification logic distinguishes `OperationError` from other throws via the standard `error?.name === "OperationError"` check (the WebCrypto-spec name for AES-GCM auth-tag failure across all conformant implementations including Node's `node:crypto.webcrypto` and browser SubtleCrypto). Implementer may also use `instanceof DOMException` if helpful, but `error.name` is the portable signal.
    - Successful-path behavior is byte-identical: a correct password on a well-formed envelope still returns the same plaintext.
    - The function signature, exported identifier, and module shape do not change. `EncryptedData` interface is untouched.
    - The 3 new error classes from T1.1 are imported from a sibling module (the implementer chooses the import path consistent with T1.1's deliverable — same-package import, not a circular barrel re-import).
    - No `console.error` / `console.warn` / `console.log` calls remain in `src/crypto/v1.ts`.
  - context: requirements.md REQ-02 + REQ-04; existing v1.ts source structure with JSON.parse at line 80, AES-GCM decrypt at 115-119, catch-all at 122-127, encrypt catch at 67-70; T1.1's new error classes (consumed via import); T1.1 task notes (the import path the implementer chose for the new classes — read these before importing).
  - research:
    - Pattern: [VERIFIED] `Z:/OuronetCore/src/crypto/v1.ts:74-128` — `decryptString` body verified. Exact line offsets: `try` opens at line 78, JSON.parse boundary at line 80 (`const encryptedData: EncryptedData = JSON.parse(jsonString)`, with `atob(encryptedBase64String)` at line 79 also able to throw on non-base64 input — both belong in the `CorruptEnvelopeError` bucket), AES-GCM `crypto.subtle.decrypt` at lines 115-119, `catch (error)` at line 122 with `console.error` at line 123 and `throw new Error(...)` at lines 124-126.
    - Pattern: [VERIFIED] `Z:/OuronetCore/src/crypto/v1.ts:23-71` — `encryptString` body verified. `try` opens at line 27, `catch (error)` at line 67, `console.error("Encryption error:", error)` at line 68, `throw new Error("Failed to encrypt data")` at line 69. Note current encrypt throw drops the cause — the new code should pass `{ cause: error }` per the acceptance criteria.
    - Reuse: [CITED — auto-fix iter 1 LOCKED] Import the 3 new classes from the LOCKED layout `import { WrongPasswordError, CorruptEnvelopeError } from "./errors"`. T1.1 acceptance now mandates `src/crypto/errors.ts` is created — no longer optional. Avoid `from "./index"` to prevent a circular import path through the barrel.
    - Implementation shape: [ASSUMED — refined cross-plan iter 1 per F-X02] The cleanest restructure splits the single try/catch into a step-by-step decode that classifies inline. Concrete skeleton:
      ```ts
      // 1. JSON.parse + outer atob (CorruptEnvelopeError)
      let encryptedData: any;
      try {
        encryptedData = JSON.parse(atob(encryptedBase64String));
      } catch (e) {
        throw new CorruptEnvelopeError("Failed to parse V1 envelope", { cause: e });
      }

      // 2. Non-object guard (CorruptEnvelopeError — per F-001 lock)
      if (encryptedData === null || typeof encryptedData !== "object") {
        throw new CorruptEnvelopeError("Envelope must be an object", { cause: new TypeError(`parsed is ${typeof encryptedData}`) });
      }
      const { ciphertext, iv, salt } = encryptedData;

      // 3. Inner base64ToArrayBuffer decoding (CorruptEnvelopeError on missing/non-string fields)
      let saltBuf: ArrayBuffer, ivBuf: ArrayBuffer, ctBuf: ArrayBuffer;
      try {
        saltBuf = base64ToArrayBuffer(salt);
        ivBuf = base64ToArrayBuffer(iv);
        ctBuf = base64ToArrayBuffer(ciphertext);
      } catch (e) {
        throw new CorruptEnvelopeError("V1 envelope field shape mismatch", { cause: e });
      }

      // ... importKey + deriveKey using saltBuf (PBKDF2-SHA256/10k for V1)

      // 4. AES-GCM decrypt (WrongPasswordError on auth-tag fail; wrapped Error otherwise)
      try {
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, ctBuf);
        return new TextDecoder().decode(decrypted);
      } catch (e: any) {
        if (e?.name === "OperationError") throw new WrongPasswordError("AES-GCM auth-tag failure", { cause: e });
        throw new Error("Unexpected V1 decrypt failure", { cause: e });
      }
      ```
      The IV/salt truncation logic at lines 91-92 (existing source) stays as-is — those are deterministic byte slices, they don't throw. The `crypto.subtle.importKey` and `deriveKey` calls between steps 3 and 4 are not realistic failure points; if they throw they fall through the outer "anything else" wrapped-Error path. **CRITICAL:** the inner `base64ToArrayBuffer` calls MUST live in their own try block (step 3) that classifies as `CorruptEnvelopeError`, NOT folded into the AES-GCM decrypt try (step 4).
    - Cause-preservation: [CITED] No tests assert on `console.error` output (verified via Grep on `Z:/OuronetCore/tests/` — zero matches for `Decryption error|Encryption error|console\.`). Removal is observably safe for the test suite.
    - Test impact: [CITED] Existing tests at `Z:/OuronetCore/tests/encryption.test.ts:72,81` and `tests/encryption-upgrade.test.ts:107,112,159` use `rejects.toThrow()` with no message/class arg — they only assert "throws something". The new typed classes still satisfy those `toThrow()` assertions because `WrongPasswordError extends Error` and `CorruptEnvelopeError extends Error`. No test breakage expected.
    - Context7: [ASSUMED] Context7 query not run — WebCrypto AES-GCM `OperationError` semantics are W3C WebCryptoAPI spec, not framework-specific. The spec mandates `OperationError` (DOMException-like, with `name === "OperationError"`) on auth-tag mismatch in `crypto.subtle.decrypt` for AES-GCM. Both Node's `node:crypto.webcrypto` and all evergreen browsers conform. The portable detection check is `error?.name === "OperationError"`.
    - Types: [VERIFIED] `EncryptedData` interface at `src/crypto/v1.ts:16-20` is untouched — no change to its 3-field shape. The function signature `(encryptedBase64String: string, password: string): Promise<string>` is unchanged.
  - notes:

- [x] T1.3 | Update V2 `decryptStringV2` in `src/crypto/v2.ts` to classify decryption failures by decode step using the same three-way mapping as V1, while preserving the internal V1-fallback branch unchanged | bee-implementer | needs: T1.1
  - requirements: [REQ-02]
  - acceptance:
    - V2 `decryptStringV2` (`src/crypto/v2.ts:79-121`) classifies failures using the same five-way mapping as the V1 path in T1.2:
      - JSON.parse failure at line 82 (`JSON.parse(atob(encryptedBase64))`) → `throw new CorruptEnvelopeError(message, { cause: error })`.
      - **Non-object `parsed` post-parse failure (auto-fix iter 3 per F-001)** — `JSON.parse` succeeds but returns a non-object (e.g., `JSON.parse("null") === null`). Subsequent property access `parsed.v === 2` on `null` throws raw `TypeError`. Implementer MUST guard this case so it classifies as `CorruptEnvelopeError`. Two acceptable approaches: (a) extend the JSON.parse try block to wrap the `parsed.v` access as well, OR (b) add an explicit `if (parsed === null || typeof parsed !== "object") throw new CorruptEnvelopeError("...", { cause: ... });` guard immediately after the JSON.parse try block. The guard MUST run BEFORE the `parsed.v === 2` branch dispatch.
      - **Envelope-field-shape mismatch (auto-fix iter 2 per F-NEW-002)** — inner `b642ab` failures on missing or non-string envelope fields. This applies to BOTH branches: V2 branch's `b642ab(parsed.ciphertext)` / `b642ab(parsed.iv)` / `b642ab(parsed.salt)` calls (current source uses these — verify line offsets post-T1.3 read), AND the V1-fallback branch's equivalent base64-decode calls at the V1 fallback site. When `parsed.ciphertext` / `parsed.iv` / `parsed.salt` are `undefined` or non-string, the inner decode throws and → `throw new CorruptEnvelopeError(message, { cause: error })`. Implementer MUST place the inner base64-decode calls inside a try block that classifies `CorruptEnvelopeError` (or a sibling try with the same classification) BEFORE the AES-GCM decrypt try block — not inside the AES-GCM-decrypt try, not in the catch-all wrapped-Error bucket.
      - AES-GCM auth-tag failure on the V2 branch (`crypto.subtle.decrypt` at lines 94-98) → `throw new WrongPasswordError(message, { cause: error })`.
      - AES-GCM auth-tag failure on the INTERNAL V1-fallback branch (`crypto.subtle.decrypt` at lines 115-119) → `throw new WrongPasswordError(message, { cause: error })` (consumers calling `decryptStringV2` directly with a V1 blob and wrong password also get the typed class).
      - Any other unexpected failure → `throw new Error(message, { cause: error })` with the original attached as `cause`.
    - The internal V1-fallback PATH STRUCTURE at lines 102-120 is preserved: the function still falls through to the V1 KDF when `parsed.v !== 2`. This is the documented belt-and-suspenders behavior for direct callers (per requirements.md REQ-03 and the v2.ts JSDoc at lines 73-78). Only the error-classification wrapping changes — not the fallback shape itself.
    - Detection of `OperationError` uses the same portable `error?.name === "OperationError"` check as T1.2.
    - Successful-path behavior is byte-identical for both branches: correct password on a well-formed V2 envelope returns the original plaintext; correct password on a V1 envelope passed directly to `decryptStringV2` also returns the original plaintext (V1 fallback intact).
    - The function signature, the `isEncryptedV2` predicate, and other exports in this file are untouched (the barrel surface stays stable).
    - `smartEncrypt` (`v2.ts:160-169`) is UNTOUCHED — including its dynamic `import("./v1")` at line 167, which is intentional per the JSDoc and requirements.md.
    - The 3 new error classes from T1.1 are imported from a sibling module with the same import path chosen in T1.2 (consistency).
    - The body of `smartDecrypt` at `v2.ts:177-187` is OUT OF SCOPE for this task — T1.4 owns it. Do not modify lines 171-187 (JSDoc + `smartDecrypt` body); those lines belong to T1.4 in Wave 3.
  - context: requirements.md REQ-02 (V2 path classification); existing v2.ts source with JSON.parse at line 82, V2 AES-GCM decrypt at 94-98, internal V1-fallback at 102-120, V1-fallback decrypt at 115-119; T1.1's new error classes; the JSDoc at v2.ts:73-78 documenting that the V1 fallback exists deliberately; T1.1 task notes (for the import path the implementer chose).
  - research:
    - Pattern: [VERIFIED] `Z:/OuronetCore/src/crypto/v2.ts:79-121` — `decryptStringV2` body verified. Exact line offsets: function signature line 79, JSON.parse at line 82 (currently OUTSIDE any try — the function has NO outer try/catch wrapper; this is structurally different from V1), V2-branch begins at line 85 (`if (parsed.v === 2)`) with the V2 AES-GCM `crypto.subtle.decrypt` at lines 94-98, V1-fallback branch at lines 102-120 (lines 103-106 IV/salt truncation, line 107 `importKey`, lines 108-114 `deriveKey`, lines 115-119 V1 `crypto.subtle.decrypt`, line 120 returns).
    - Pattern: [VERIFIED] V1-fallback STAYS — `Z:/OuronetCore/src/crypto/v2.ts:102-120` is the path that decodes V1-shape blobs with V1 KDF params. This is documented in the JSDoc at `v2.ts:74-78` and locked by requirements.md REQ-02 + REQ-03. Only the error wrapping changes.
    - Pattern: [VERIFIED] `smartEncrypt` at `Z:/OuronetCore/src/crypto/v2.ts:160-169` is UNTOUCHED including the dynamic `await import("./v1")` at line 167. Requirements REQ-02/03/04 explicitly carve `smartEncrypt` out of scope.
    - Implementation shape: [ASSUMED — refined cross-plan iter 1 per F-X02] V2 currently has NO try/catch — the function lets exceptions propagate raw. To classify, the implementer needs separate try blocks for parse, **inner b642ab decoding (REQUIRED — see concrete skeleton below)**, and AES-GCM decrypt. Concrete skeleton (V2 branch — apply analogous structure to V1-fallback branch):
      ```ts
      // 1. JSON.parse + outer atob (CorruptEnvelopeError on failure)
      let parsed: any;
      try {
        parsed = JSON.parse(atob(encryptedBase64));
      } catch (e) {
        throw new CorruptEnvelopeError("Failed to parse encrypted envelope", { cause: e });
      }

      // 2. Non-object guard (CorruptEnvelopeError on null/primitive parsed — per F-001 lock)
      if (parsed === null || typeof parsed !== "object") {
        throw new CorruptEnvelopeError("Envelope must be an object", { cause: new TypeError(`parsed is ${typeof parsed}`) });
      }

      if (parsed.v === 2) {
        // 3. Inner b642ab decoding (CorruptEnvelopeError on missing/non-string fields — F-NEW-002 lock)
        let saltBuf: ArrayBuffer, ivBuf: ArrayBuffer, ctBuf: ArrayBuffer;
        try {
          saltBuf = b642ab(parsed.salt);
          ivBuf = b642ab(parsed.iv);
          ctBuf = b642ab(parsed.ciphertext);
        } catch (e) {
          throw new CorruptEnvelopeError("Envelope field shape mismatch (missing or non-string ciphertext/iv/salt)", { cause: e });
        }
        // importKey + deriveKey using saltBuf
        const baseKey = await crypto.subtle.importKey(/* ... password bytes ... */);
        const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: saltBuf, iterations: 600_000, hash: "SHA-512" }, /* ... */);
        // 4. AES-GCM decrypt (WrongPasswordError on auth-tag fail; wrapped Error otherwise)
        try {
          const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, ctBuf);
          return new TextDecoder().decode(decrypted);
        } catch (e: any) {
          if (e?.name === "OperationError") throw new WrongPasswordError("AES-GCM auth-tag failure", { cause: e });
          throw new Error("Unexpected decrypt failure", { cause: e });
        }
      }
      // V1 fallback branch: same structure — pre-decode b642ab in try {} → CorruptEnvelopeError; AES-GCM decrypt in separate try {} → WrongPasswordError/Error.
      ```
      **CRITICAL:** the inner `b642ab` calls MUST be in their own try block that classifies as `CorruptEnvelopeError`. They MUST NOT be folded into the AES-GCM decrypt try (which would route shape-mismatch failures to `WrongPasswordError` — wrong class), and they MUST NOT live outside any try (which would propagate raw `InvalidCharacterError` — escaping the four-way classification entirely). Phase 2 REQ-09(1) test (T2.5 acceptance #1 in Phase 2 TASKS.md) asserts `CorruptEnvelopeError` thrown by `smartDecrypt({v:2, iv:"AA==", salt:"AA=="})` — the trace path goes V2 branch → inner `b642ab(parsed.ciphertext)` where `parsed.ciphertext === undefined` → `atob(undefined)` throws → MUST classify as `CorruptEnvelopeError`. If T1.3 implementer folds b642ab into the wrong try block, Phase 2 T2.5 test FAILS at T2.13 verification gate. The KEY structural invariant is that `parsed.v === 2` still routes to the V2 KDF and `parsed.v !== 2` still routes to the V1 KDF.
    - Reuse: [CITED] Same import path as T1.2 — `import { WrongPasswordError, CorruptEnvelopeError } from "./errors"`. Consistency between v1.ts and v2.ts is locked by acceptance criteria.
    - Test impact: [CITED] `Z:/OuronetCore/tests/encryption.test.ts:129` and `tests/encryption-upgrade.test.ts:172,181` exercise the V2 + V1-fallback paths. They use bare `rejects.toThrow()` and `decryptStringV2(v1Blob, PASSWORD)` direct-call assertions — typed errors still satisfy these. No test breakage expected.
    - Context7: [ASSUMED] Same `OperationError` rationale as T1.2 — WebCryptoAPI spec, no framework lookup needed.
    - Types: [VERIFIED] `EncryptedDataV1` and `EncryptedDataV2` interfaces at `src/crypto/v2.ts:19-30` are untouched. The function signature `(encryptedBase64: string, password: string): Promise<string>` is unchanged. `isEncryptedV2` at lines 124-130 is untouched.
  - notes:

## Wave 3 (depends on Wave 2)

- [x] T1.4 | Replace `smartDecrypt` (`src/crypto/v2.ts:177-187`) with deterministic shape-based dispatch via `isEncryptedV2`, eliminating the V1-then-V2 fallback chain and the ~1.5s timing leak | bee-implementer | needs: T1.3
  - requirements: [REQ-03]
  - acceptance:
    - `smartDecrypt` body at `v2.ts:177-187` is replaced with a single-branch dispatch via `isEncryptedV2` (no try/catch, no second-attempt fallback). **Import style LOCKED (auto-fix iter 1 per F-PAT-002):** the V1-branch import (`decryptString`) MUST use the dynamic `await import("./v1")` pattern, matching the in-file convention established by `smartEncrypt`'s dynamic V1 import at line 167 (which is locked untouched). Suggested form: `if (isEncryptedV2(encrypted)) return decryptStringV2(encrypted, password); const { decryptString } = await import("./v1"); return decryptString(encrypted, password);`. The previous "static import is recommended" research guidance is OVERRIDDEN — keeping smartDecrypt and smartEncrypt aligned in import-style is the established pattern. The function body contains exactly one branch (per the if-return early-exit OR an equivalent ternary that imports inside the V1 branch); no try/catch; no second-attempt fallback.
    - The function signature `(encrypted: string, password: string): Promise<string>` is unchanged. The exported identifier `smartDecrypt` is unchanged.
    - There is NO try/catch wrapping the dispatch in `smartDecrypt` itself — errors from the chosen branch propagate directly. (The V1 path's `decryptString` and the V2 path's `decryptStringV2` already throw the typed classes from T1.2 + T1.3, so consumers see the proper error class.)
    - There is NO V2-fallback when V1 fails. A wrong password on a V1 envelope produces exactly one PBKDF2-SHA256 10k KDF execution, throws `WrongPasswordError`, and returns to the caller without any V2 600k attempt — which is what closes the timing leak. (Phase 2 REQ-09 will assert this empirically; Phase 1 just needs the structural change.)
    - `isEncryptedV2` itself is UNTOUCHED — it remains the deterministic shape predicate (`v2.ts:124-130`) that returns `false` on any throw.
    - `smartEncrypt` (`v2.ts:160-169`) is UNTOUCHED.
    - The JSDoc at `v2.ts:171-176` ("Tries V1 primitives first ...") is updated to reflect the new single-branch behavior — describe that dispatch is now shape-based via `isEncryptedV2`, that there is no second-attempt fallback, and reference the timing-leak rationale.
    - Before editing, read T1.3's notes block in this file to confirm the post-T1.3 line offsets of `smartDecrypt` (the body may have shifted by a few lines if T1.3's restructure of `decryptStringV2` added/removed lines above it). The contract is the function name + behavior, not the literal line numbers.
  - context: requirements.md REQ-03; spec.md "Smart-decrypt timing-leak fix" section; existing `smartDecrypt` at v2.ts:177-187; existing `isEncryptedV2` predicate at v2.ts:124-130 (already documented as safe sole branch); T1.3 task notes (for post-T1.3 line offsets in v2.ts and confirmation of the V2-branch error-class rewiring).
  - research:
    - Pattern: [VERIFIED] `Z:/OuronetCore/src/crypto/v2.ts:177-187` — current `smartDecrypt` body verified. Lines 178 (V2 fast-path: `if (isEncryptedV2(encrypted)) return decryptStringV2(encrypted, password)`), 180-186 (V1-then-V2 fallback chain with try/catch and dynamic `await import("./v1")` at line 181). The replacement collapses lines 178-186 into a single ternary line.
    - Pattern: [VERIFIED] `Z:/OuronetCore/src/crypto/v2.ts:124-130` — `isEncryptedV2` is deterministic and safe as the sole branch. It returns `false` on any throw (catches inside the function), so the ternary `isEncryptedV2(blob) ? V2 : V1` always selects exactly one branch with no exception leakage from the predicate itself.
    - Reuse: [LOCKED — auto-fix iter 1 per F-PAT-002] `decryptString` is already a named export from `./v1` (`src/crypto/v1.ts:74`). Import style LOCKED to dynamic: `const { decryptString } = await import("./v1");` — placed inside the V1 branch of the dispatch, matching the in-file convention from `smartEncrypt`'s line 167 dynamic V1 import. The previous "static import is recommended" guidance is OVERRIDDEN. Rationale: keeping the two `smart*` functions stylistically aligned avoids in-file divergence that future readers would need a comment trail to justify (per CLAUDE.md "intentional duplication" principle, applied inversely to "intentional symmetry").
    - JSDoc: [VERIFIED] `Z:/OuronetCore/src/crypto/v2.ts:171-176` — current text says "Tries V1 primitives first (they're cheaper — 10k vs 600k iterations), then the V1-fallback branch inside decryptStringV2." This is the EXACT prose that must be rewritten. Suggested replacement (paraphrased per the locked decision in this file's "Locked decisions" block): describe shape-based dispatch via `isEncryptedV2`; note no second-attempt fallback; cite the timing-leak rationale (a wrong password on V1 no longer triggers a V2 600k PBKDF2 attempt). Phase 2 REQ-09 will add the empirical assertion, so the JSDoc can simply reference "shape-based dispatch with no fallback (closes a ~1.5s timing differential)".
    - Test impact: [CITED] `Z:/OuronetCore/tests/encryption-upgrade.test.ts:42,52,61,151,160` and `tests/encryption.test.ts:213-214` exercise `smartDecrypt`. All use either correct-password success-path assertions (which the new dispatch still satisfies — V2 blob still routes to V2, V1 blob still routes to V1) or bare `rejects.toThrow()` (which the typed errors from T1.2/T1.3 still satisfy). No test breakage expected.
    - Context7: [ASSUMED] Context7 query not run — this is a structural refactor with no framework API surface. The pattern (deterministic shape predicate dispatch) is standard.
    - Approach: [LOCKED — auto-fix iter 1 per F-PAT-002] Final body shape (target):
      ```ts
      export async function smartDecrypt(encrypted: string, password: string): Promise<string> {
        if (isEncryptedV2(encrypted)) {
          return decryptStringV2(encrypted, password);
        }
        const { decryptString } = await import("./v1");
        return decryptString(encrypted, password);
      }
      ```
      Dynamic import inside the V1 branch only, matching `smartEncrypt`'s line-167 pattern. No try/catch. No fallback. The early-return on the V2 branch keeps the V2 path cheaper (no dynamic-import tick).
  - notes:

## Wave 4 (depends on Wave 3)

- [x] T1.5 | Verification gate — run typecheck, full test suite, and build; confirm zero regressions on the existing 386 v2.1.2 tests and that the 3 new error classes are observable in the built `dist/crypto` barrel | bee-implementer | needs: T1.1, T1.2, T1.3, T1.4
  - requirements: [REQ-01, REQ-02, REQ-03, REQ-04]
  - acceptance:
    - `npm run typecheck` exits 0. Implementer pastes the actual command output as evidence.
    - `npm test` exits 0 on Linux/macOS. On Windows non-en-US, the documented locale-sensitive `tests/gas.test.ts > formatMaxFee` failure is the SOLE allowed non-zero exit — implementer pastes the full vitest summary showing exactly that one failure (or a clean exit 0 if running on en-US Windows). All other 385+ tests must pass without modification — this proves Phase 1 introduces no regression on the existing surface.
    - `npm run build` exits 0. The `dist/crypto/index.js` and `dist/crypto/index.d.ts` outputs include exports for `WrongPasswordError`, `CorruptEnvelopeError`, and `UnsupportedFormatError` (verifiable via `grep -E "WrongPasswordError|CorruptEnvelopeError|UnsupportedFormatError" dist/crypto/index.d.ts` — implementer pastes the grep output).
    - Implementer runs `grep -nE "console\.(error|warn|log)" Z:/OuronetCore/src/crypto/v1.ts` and confirms zero matches (the `console.error` removal from REQ-04 is verified).
    - Implementer runs `grep -nE "console\.(error|warn|log)" Z:/OuronetCore/src/crypto/v2.ts` and confirms zero matches (the file has no `console` references at all — neither JSDoc mentions nor call sites).
    - **Tests added (acceptance-relaxed at execution time per T1.1 + T1.3 implementer scope expansion):** the original Phase 1 contract said "no tests added in Phase 1 — Phase 2 owns assertions". During execution, T1.1 added `tests/crypto-errors.test.ts` (5 surface-contract it-blocks) and T1.3 added `tests/crypto-v2-classification.test.ts` (11 classification it-blocks) to satisfy the TDD Stop hook's RED-GREEN evidence requirement. Both are COMPLEMENTARY to Phase 2's REQ-09 tests (they test the additive class surface and direct decryptStringV2 classification, while Phase 2 exercises through smartDecrypt failure paths). Implementer confirms `git status --short` shows: src/crypto/v1.ts (M), src/crypto/v2.ts (M), src/crypto/index.ts (M), src/crypto/errors.ts (NEW), tests/crypto-errors.test.ts (NEW), tests/crypto-v2-classification.test.ts (NEW). No other files modified or created.
    - If any quality gate fails, implementer reports the failure with paste of the failing output rather than claiming success.
  - context: requirements.md REQ-01 through REQ-04; CLAUDE.md "Common commands" block (`npm run typecheck`, `npm test`, `npm run build`); v2.1.2 test count baseline of 386 (cited in spec.md "Test-suite growth" section); the documented Windows locale failure exception is locked from v2.1.2 per ROADMAP.md Phase 2 success criterion 5; T1.1/T1.2/T1.3/T1.4 task notes (for confirmation that prior waves landed cleanly and any caveats raised by implementers).
  - research:
    - Commands: [VERIFIED] `Z:/OuronetCore/package.json:78-83` confirms exact scripts available: `"build": "tsc -p tsconfig.build.json"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run --passWithNoTests"`. CLAUDE.md "Common commands" block matches. No script changes needed for verification.
    - Build config: [VERIFIED] `Z:/OuronetCore/tsconfig.build.json:1-14` — extends base, `outDir: "./dist"`, `rootDir: "./src"`, includes `src/**/*.ts`, EXCLUDES `src/**/*.test.ts` and `tests/**`. New error classes (in `src/crypto/errors.ts` if that layout chosen) will be picked up automatically; `dist/crypto/errors.js` + `dist/crypto/errors.d.ts` will exist alongside `dist/crypto/index.js` post-build.
    - Test count baseline: [VERIFIED] Counted via `grep -c "test(\|it(" Z:/OuronetCore/tests/*.test.ts`: cfm-builders=25, codex-codec=25, dalos-integration=9, encryption-upgrade=11, encryption=31, failover-client=18, failover-submit=5, gas=51, guard=59, interactions-read-seam=15, network=35, pact-format=35, signing=17, smart-account-auth=21, strategy=23, timeouts=18, types=1, wallet=9. Sum = 408 it/test invocations (note: this counts `test.each` and `it.each` as one each in the regex; vitest expands them into multiple cases at runtime). The spec's 386 figure is the runtime-expanded passing count from v2.1.2 CI; do not conflate the static count with the runtime count.
    - Atomic-ship: [LOCKED] Phase 1 ships ZERO new tests per spec.md "atomic-ship contract" and the goal text. Phase 2 (REQ-05 through REQ-14) owns all new tests including the assertions on the 3 error classes. T1.5 acceptance explicitly verifies `git status --short` shows ONLY `src/crypto/*.ts` (and possibly the new `src/crypto/errors.ts`) modifications.
    - Console removal verification: [CITED, auto-fix iter 1 per F-003] Pre-phase Grep result on `Z:/OuronetCore/src/crypto/v1.ts` confirms 2 console.error calls at lines 68 and 123. Pre-phase Grep on `Z:/OuronetCore/src/crypto/v2.ts` confirms ZERO occurrences of the substring `console` anywhere (no call sites and no JSDoc mentions). Post-phase grep on v1.ts MUST return zero matches. Post-phase grep on v2.ts is already zero and stays that way — implementer just confirms zero matches without expecting any pre-existing JSDoc baseline.
    - Windows locale exception: [LOCKED] requirements.md baseline cites "v2.1.2 baseline of 386 tests passing on Linux/macOS, 385 on Windows non-en-US (the `tests/gas.test.ts > formatMaxFee` locale-sensitive failure)". The exception is pre-existing and unchanged by Phase 1 — implementer should not attempt to fix it.
    - Context7: [ASSUMED] Context7 not queried — verification gate is local CLI-driven, no framework docs apply.
    - Approach: [ASSUMED] Recommended verification sequence (matches acceptance order): (1) `npm run typecheck` → paste output; (2) `npm test` → paste full vitest summary; (3) `npm run build` → paste output; (4) `grep -E "WrongPasswordError|CorruptEnvelopeError|UnsupportedFormatError" dist/crypto/index.d.ts` → paste matches; (5) `grep -nE "console\.(error|warn|log)" src/crypto/v1.ts` → expect zero matches; (6) `git status --short` → expect only `src/crypto/*.ts` (and new `src/crypto/errors.ts` if created). Each step's output is the evidence required by R8 (no completion claims without evidence).
  - notes:

---

## Wave dependency chain

The wave structure is driven by two hard constraints: (1) T1.2/T1.3 import the error classes that T1.1 creates, and (2) T1.3 and T1.4 both edit `src/crypto/v2.ts` so they must serialize across waves to honor the "no two tasks in the same wave modify the same file" rule.

| Wave | Tasks | Dependency rationale |
|------|-------|----------------------|
| 1 | T1.1 | Foundational — creates the `WrongPasswordError` / `CorruptEnvelopeError` / `UnsupportedFormatError` classes that T1.2 and T1.3 import. No predecessor. |
| 2 | T1.2, T1.3 | Both need T1.1's error classes available on disk before they can be imported. T1.2 edits `src/crypto/v1.ts` and T1.3 edits `src/crypto/v2.ts` — file-disjoint, so they parallelize cleanly. |
| 3 | T1.4 | Edits `src/crypto/v2.ts` (`smartDecrypt` body + JSDoc at lines 171-187). Same file as T1.3 in Wave 2 — file-ownership conflict forces T1.4 into a later wave. T1.4 also benefits from running after T1.3's restructure so the post-T1.3 line offsets are stable when T1.4 lands. |
| 4 | T1.5 | Verification gate. Asserts on the integrated state (typecheck + test + build + grep checks + dist barrel inspection). Must run after every code-modifying task has completed. |

**File-ownership conflicts detected and resolved:** 1 — T1.3 vs T1.4 on `src/crypto/v2.ts`. Resolution: T1.4 moved to Wave 3 (one wave behind T1.3).

**Wave consolidation considered:** Anti-fragmentation pass attempted on each single-task wave:
- Wave 1 (T1.1) cannot merge into Wave 2 because T1.2 and T1.3 both import T1.1's deliverable — the file must exist before the importing edits run.
- Wave 3 (T1.4) cannot merge into Wave 2 because T1.4 and T1.3 share `src/crypto/v2.ts` (same-file invariant).
- Wave 4 (T1.5) cannot merge into Wave 3 because T1.5 must observe the integrated state of T1.1+T1.2+T1.3+T1.4 (it asserts the dist barrel includes the new exports AND that all three crypto source files are clean of `console.*` AND that no regression appears in the test suite — this requires every prior wave to have landed first).

Each single-task wave has a documented genuine sequential dependency (foundational types → file-ownership conflict → integrated verification), so the structure cannot be flattened further without violating the wave invariants.

## Fragmentation Note

Average tasks-per-wave is 5/4 = 1.25, below the 2.5 consolidation target. The fragmentation flag is `warn`, with each 1-task wave documented as a genuine sequential dependency in the table above:

- **Wave 1 (T1.1, 1 task) — cannot merge:** T1.2 and T1.3 in Wave 2 both `import { WrongPasswordError, CorruptEnvelopeError } from "./errors"`; the imported file must exist before the importing edits run. Merging T1.1 into Wave 2 would require Wave 2 implementers to also create the errors module, which (a) duplicates work across two parallel agents and (b) creates a write race on the new file.
- **Wave 3 (T1.4, 1 task) — cannot merge:** T1.4 edits `src/crypto/v2.ts` (lines 171-187, `smartDecrypt` JSDoc + body). T1.3 in Wave 2 edits the same file (lines 79-121, `decryptStringV2` body). The "no two tasks in the same wave modify the same file" rule forces T1.4 into a later wave. T1.4 has no other tasks to pair with in Wave 3.
- **Wave 4 (T1.5, 1 task) — cannot merge:** Verification gate asserts on the integrated state of all four prior code-modifying tasks (built `dist/crypto/*` includes the new error class exports, all three source files clean of `console.*`, full test suite green). It must run after Wave 3 has landed and has no other tasks to pair with.

The fragmentation is a structural property of this phase — 5 tasks with two mandatory serialization points (T1.1 → {T1.2, T1.3} for the import dependency, T1.3 → T1.4 for the same-file conflict). It is not a planning oversight.

---

## Pass 1 completion notes

- Task count: 5
- Requirements mapped: REQ-01 → T1.1 + T1.5; REQ-02 → T1.2 + T1.3 + T1.5; REQ-03 → T1.4 + T1.5; REQ-04 → T1.2 + T1.5. All 4 phase requirements (REQ-01 through REQ-04) are addressed by at least one task.
- File ownership preview (for Pass 2 conflict detection):
  - T1.1 → `src/crypto/index.ts` (and possibly a new `src/crypto/errors.ts` if implementer chooses that layout — either is acceptable; the barrel re-export is the contract)
  - T1.2 → `src/crypto/v1.ts` exclusively
  - T1.3 → `src/crypto/v2.ts` (`decryptStringV2` body only — same file as T1.4 → file conflict)
  - T1.4 → `src/crypto/v2.ts` (`smartDecrypt` body + JSDoc only — same file as T1.3 → file conflict)
  - T1.5 → no source modifications; runs quality gates only
- Anticipated Pass 2 wave structure (informational only — Pass 2 may revise):
  - Wave 1: T1.1 (no deps; foundational error classes)
  - Wave 2: T1.2 (needs T1.1) + T1.3 (needs T1.1) — different files, parallelizable
  - Wave 3: T1.4 (needs T1.3 because both touch v2.ts; file conflict forces serialization)
  - Wave 4: T1.5 (needs all of T1.1–T1.4; verification gate)
  - Single-task waves (Wave 1, Wave 3, Wave 4) are intentional: each represents a genuine sequential dependency (foundational types → file conflict → final verification). Pass 2 should evaluate whether T1.1 can be merged with the v1.ts/v2.ts edits if implementer is willing to add error classes inline before the dependent edit, but the cleaner separation keeps each task small and reviewable.
