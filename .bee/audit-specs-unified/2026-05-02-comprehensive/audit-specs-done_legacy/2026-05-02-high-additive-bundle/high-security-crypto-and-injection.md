[SECURITY-FIX] Crypto error taxonomy + Pact-code injection hardening

## Problem
Two security-relevant gaps in the public surface:

### 1. V1 decrypt error swallowing (F-CORE-009)
Three concerns reinforce each other:

- **V1 catch-all collapses every failure into one string.** `decryptString` (V1) wraps the entire decode path in `try { ... } catch (error) { console.error(...); throw new Error("Failed to decrypt data. Invalid password or corrupted data."); }`. The caller cannot distinguish wrong-password from corrupt-blob from unsupported-version.
- **`smartDecrypt` double-tries V1 then V2 with observable timing.** When the envelope is V1-shaped, `smartDecrypt` first attempts `decryptString` (~50ms PBKDF2-SHA256 10k); on any failure it falls through to `decryptStringV2` which re-runs PBKDF2-SHA512 600k (~1.5s). A wrong-password attempt against a V1 envelope therefore takes ~1.5s longer than against a V2 envelope. This timing differential is observable to a malicious page that can trigger `smartDecrypt` and time the rejection.
- **`console.error('Decryption error:', error)` leaks crypto error context.** The original error (whose stack trace can include nearby call-site identifiers) lands in the consumer's stdout/stderr — a publishing surface the library doesn't own.

### 2. Pact-code injection (F-CORE-010)
Every `buildXPactCode` builder in `src/pact/cfmBuilders.ts` produces Pact code by interpolating untrusted-shaped fields directly into the template. Patron, sender, receiver, and token-id fields arrive from UI inputs. None are validated; none are escaped against the embedded `"` quote. A field containing a `"` would close the string literal and inject Pact tokens into the signed transaction.

The chain rejects malformed Pact code so this isn't (today) a route to an unauthorised on-chain action. But the builders are the public seam — any future caller (HUB-side flows, automation scripts, third-party CFM modal authors with less-trusted inputs) inherits the gap. And future builders for richer fields (Pact strings with backslashes, JSON values) inherit the gap by default.

## Findings (2)
| ID | Severity | Title |
|---|---|---|
| F-CORE-009 | HIGH | V1 decrypt error swallowing — KDF leak + UX confusion + info disclosure |
| F-CORE-010 | HIGH | CFM-builders use unescaped string interpolation into Pact code |

## Locations

### Crypto error taxonomy
- `src/crypto/v1.ts:67-70` — V1 encrypt catch-all
- `src/crypto/v1.ts:122-127` — V1 decrypt catch-all + console.error leak
- `src/crypto/v2.ts:177-187` — `smartDecrypt` double-try fallback

### Pact-code injection
- `src/pact/cfmBuilders.ts` — every `buildXPactCode` builder (representative line ranges: 47-57, 65-70, 82-88, 300-306, etc.)

## Required Fixes

### Fix 1 — Distinguish error types
Introduce a small error taxonomy in `src/crypto/index.ts`:

```ts
export class WrongPasswordError extends Error { name = "WrongPasswordError"; }
export class CorruptEnvelopeError extends Error { name = "CorruptEnvelopeError"; }
export class UnsupportedFormatError extends Error { name = "UnsupportedFormatError"; }
```

In V1 `decryptString`, classify based on which decode step failed: JSON.parse → `CorruptEnvelopeError`, `crypto.subtle.decrypt` `OperationError` → `WrongPasswordError` (this is the only error AES-GCM throws on auth-tag mismatch), anything else → wrap with the original as `cause`.

In V2 `decryptStringV2`, do the same.

In `smartDecrypt`:
- Eliminate the V1-then-V2 fallback chain. The envelope is **always discriminable by shape** — `isEncryptedV2(blob)` is deterministic. Use it as the sole branch:
  ```ts
  return isEncryptedV2(blob) ? decryptStringV2(blob, pw) : decryptString(blob, pw);
  ```
- This kills the timing side channel by guaranteeing each envelope path runs exactly one KDF.

Drop the `console.error` calls in V1's catches. The thrown error already carries the cause; consumers (or the future logger seam) decide whether to log.

### Fix 2 — Pact string sanitization
Add a helper in `src/pact/format.ts`:

```ts
const PACT_STRING_RE = /^[a-zA-Z0-9_\-:. À-ſ]+$/;
//                      ^  account/token/chainId charset  ^ extended Latin for Σ./Ѻ. prefixes

export function pactString(s: string, fieldName: string): string {
  if (!PACT_STRING_RE.test(s)) {
    throw new Error(`pactString: ${fieldName} contains illegal characters`);
  }
  return s;
}
```

Wrap every interpolated field in every `buildXPactCode` builder:
```ts
// Before:
return `(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_Transfer "${p.patron}" ...)`;

// After:
return `(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_Transfer "${pactString(p.patron, 'patron')}" ...)`;
```

Charset must accept Σ./Ѻ. prefixes (Smart/Standard accounts), token-id format (e.g. `n-coin`, `ouro:STOA`), and Kadena-style `k:abc...` accounts.

Add a negative test per builder family: pass a value containing `"`, `\\`, `(`, `)`, newline, or unicode-zero — assert each throws.

## Side effects
- Crypto error taxonomy is **non-breaking** (existing thrown messages still readable as `Error`); consumers that branch on `instanceof WrongPasswordError` get a clean upgrade.
- Pact-string validation **could break** consumers passing exotic but legal characters in token IDs. Verify against the on-chain reality of token IDs before locking the regex. If on-chain accepts more characters than the regex, widen the regex. Coordinate with the Stoa side.

## Acceptance Criteria

### Crypto
- [ ] `WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError` defined and exported from `src/crypto/index.ts`.
- [ ] V1 and V2 decrypt paths throw the right specific class based on which decode step failed.
- [ ] `smartDecrypt` runs exactly one KDF per call (no V1-then-V2 fallback).
- [ ] `console.error` removed from V1 encrypt/decrypt catches.
- [ ] New test: `smartDecrypt` of a wrong-password V1 envelope and wrong-password V2 envelope take comparable wall-time within ±10% (mock the KDF if needed).
- [ ] New tests assert each error class is thrown for its specific failure mode.
- [ ] Existing `tests/encryption.test.ts` and `tests/encryption-upgrade.test.ts` continue to pass.

### Pact-code
- [ ] `pactString(s, fieldName)` helper added to `src/pact/format.ts` and exported via `./pact` barrel.
- [ ] Every interpolated string field in every `buildXPactCode` builder routes through `pactString`.
- [ ] New negative test per builder family asserts injected `"`/backslash/parens throw.
- [ ] `npm run typecheck` and `npm test` pass.
- [ ] CHANGELOG.md notes the validation tightening (consumers passing illegal chars will see a clear early throw rather than chain rejection — UX improvement, but technically observable).
