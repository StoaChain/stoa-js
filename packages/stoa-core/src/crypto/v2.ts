/**
 * V2 encryption — the current codex format.
 *
 * PBKDF2 / SHA-512 / 600,000 iterations → AES-GCM-256 / 16-byte salt / 12-byte IV.
 * Envelope: btoa(JSON.stringify({ v: 2, ciphertext, iv, salt }))  (the `v: 2`
 * marker is what distinguishes this from V1 and what `smartDecrypt` keys off).
 *
 * This module also owns the format-detection + auto-decode helpers
 * (`isEncryptedV2`, `smartDecrypt`, `isCodexUpgraded`, `smartEncrypt`) so
 * consumers have one import site for every "encrypted blob" concern.
 *
 * Pure — no localStorage, no DOM. `smartEncrypt` takes the schema version
 * as an argument rather than reading `localStorage.codex_schema_version`,
 * so this file works in Node / HUB / tests identically to the browser.
 * The OuronetUI ships a tiny `smart-encrypt-browser.ts` wrapper that
 * reads localStorage and delegates here.
 */

import { WrongPasswordError, CorruptEnvelopeError } from "./errors";
import { getLogger } from "../observability/logger";

export interface EncryptedDataV2 {
  v: 2;
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * V1 envelope shape (legacy). PBKDF2-SHA256 / 10,000 iterations / AES-GCM-256.
 *
 * **Security note (v3.3.7, closes audit finding F-SEC-004):** OWASP's
 * password-storage cheat sheet (2023+) recommends a PBKDF2-SHA256 minimum
 * of **600,000** iterations. V1 ships at 10,000 — meaningfully crackable
 * on commodity GPU hardware in ways the V2 envelope (PBKDF2-SHA512 /
 * 600,000 iterations) is not.
 *
 * V1 lingers in the codebase for backwards-compat: codex backups exported
 * before the V2 upgrade still parse via this shape (the V1-fallback path
 * inside `decryptStringV2`). New writes always go through `encryptStringV2`
 * — every `smartEncrypt` call with `schemaVersion >= "1"` produces a V2
 * envelope. Consumers holding V1 codices should **upgrade in place** by
 * decrypting with the password and re-encrypting via `encryptStringV2`
 * (or by triggering the OuronetUI codex-upgrade flow).
 *
 * v3.3.7 surfaces a one-time `getLogger().warn(...)` event on the first
 * V1 envelope decoded per process, plus the optional
 * `decryptStringV2WithDetails` / `smartDecryptWithDetails` variants that
 * return `{ plaintext, wasLegacyV1 }` so consumers can react
 * programmatically.
 */
/**
 * V1 envelope shape — alias for EncryptedData from v1.ts.
 * Re-exported here so existing imports of `EncryptedDataV1` from `./v2` keep working.
 * (Phase 1 closure of REQ-04 / F-API-007: byte-identical duplicate interfaces collapsed.)
 *
 * (PRESERVE the existing OWASP / v3.3.7 / F-SEC-004 JSDoc context above this line.)
 */
export type { EncryptedData as EncryptedDataV1 } from "./v1";

/**
 * Result shape returned by `decryptStringV2WithDetails` /
 * `smartDecryptWithDetails`. The `wasLegacyV1` flag tells the caller
 * whether the input envelope was decoded via the V1-fallback path
 * (sub-OWASP iteration count) or the canonical V2 path. Use it to
 * trigger an in-place re-encrypt to V2, or to surface a "your codex
 * uses outdated encryption" banner in the consumer UI.
 *
 * Added in v3.3.7 (closes audit finding F-SEC-004).
 */
export interface DecryptResultWithDetails {
  plaintext: string;
  wasLegacyV1: boolean;
}

// v3.3.7 (F-SEC-004): one-shot warning when the V1 fallback path executes.
// The warning fires on the first V1 decrypt per process and stays silent
// after that, so a codex bulk-decrypt of N V1 entries doesn't spam the
// consumer's log pipeline with N copies. The `wasLegacyV1` flag returned
// by `*WithDetails` variants is the per-call programmatic signal.
let _v1WarningEmitted = false;

function emitV1WarningOnce(): void {
  if (_v1WarningEmitted) return;
  _v1WarningEmitted = true;
  getLogger().warn(
    "[ouronet-core/crypto] V1-format encrypted blob decoded successfully. " +
      "V1 uses PBKDF2-SHA256 at 10,000 iterations, well below OWASP's current " +
      "600,000 minimum (cracked meaningfully faster on commodity GPU hardware). " +
      "Re-encrypt affected codex entries to V2 (PBKDF2-SHA512 / 600,000) at the " +
      "earliest opportunity. Use `decryptStringV2WithDetails` or `smartDecryptWithDetails` " +
      "for the per-call `wasLegacyV1` flag. This warning fires once per process lifetime.",
  );
}

/**
 * @internal Test-only helper to reset the one-shot V1-warning guard so
 * each test in `tests/v3-3-7-v1-warning.test.ts` starts from a clean
 * state. NOT exported via the public barrel — consumers should never
 * call this; the warning is intentionally one-shot in production.
 */
export function _resetV1WarningEmittedForTests(): void {
  _v1WarningEmitted = false;
}

function ab2b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  let s = "";
  for (let i = 0; i < copy.byteLength; i++) s += String.fromCharCode(copy[i]);
  return btoa(s);
}

function b642ab(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // Return a fresh ArrayBuffer that's not shared
  return bytes.buffer.slice(0);
}

/** Encrypt plaintext to V2 envelope. */
export async function encryptStringV2(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const saltArr = crypto.getRandomValues(new Uint8Array(16));
  const ivArr = crypto.getRandomValues(new Uint8Array(12));
  const salt = saltArr.slice();
  const iv = ivArr.slice();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-512" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const data: EncryptedDataV2 = {
    v: 2,
    ciphertext: ab2b64(encrypted),
    iv: ab2b64(iv.buffer),
    salt: ab2b64(salt.buffer),
  };
  return btoa(JSON.stringify(data));
}

/**
 * Decrypt a V2 envelope. Includes a V1 fallback path: if the envelope lacks
 * `v: 2`, this still decodes it using V1 params. That keeps V2-only call
 * sites (e.g. a codex-wide re-encrypt job) safe when stray V1 blobs linger.
 *
 * **v3.3.7 (closes audit finding F-SEC-004):** the V1-fallback path emits
 * `getLogger().warn(...)` on the FIRST execution per process lifetime,
 * surfacing the sub-OWASP-iteration-count security advisory exactly once
 * (one-shot guard prevents bulk-decrypt log spam). For the per-call
 * programmatic signal, use the `decryptStringV2WithDetails` variant which
 * returns `{ plaintext, wasLegacyV1 }`. See the `EncryptedDataV1` JSDoc
 * for the security background.
 *
 * Failure classification (applies to BOTH V2 branch and V1-fallback branch):
 *   - JSON.parse / outer atob failure        → CorruptEnvelopeError
 *   - Non-object parsed payload              → CorruptEnvelopeError
 *   - Missing or non-string envelope fields  → CorruptEnvelopeError
 *   - AES-GCM auth-tag failure               → WrongPasswordError
 *   - Anything else                          → wrapped Error with `cause`
 */
export async function decryptStringV2(encryptedBase64: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(encryptedBase64));
  } catch (error) {
    throw new CorruptEnvelopeError("Failed to parse encrypted envelope", { cause: error });
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new CorruptEnvelopeError("Envelope must be an object", {
      cause: new TypeError(`parsed is ${parsed === null ? "null" : typeof parsed}`),
    });
  }

  const envelope = parsed as { v?: unknown; ciphertext?: unknown; iv?: unknown; salt?: unknown };

  // V2 format
  if (envelope.v === 2) {
    let saltBuf: ArrayBuffer;
    let ivBuf: ArrayBuffer;
    let ctBuf: ArrayBuffer;
    try {
      saltBuf = b642ab(envelope.salt as string);
      ivBuf = b642ab(envelope.iv as string);
      ctBuf = b642ab(envelope.ciphertext as string);
    } catch (error) {
      throw new CorruptEnvelopeError(
        "V2 envelope field shape mismatch (missing or non-string ciphertext/iv/salt)",
        { cause: error },
      );
    }

    const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBuf, iterations: 600_000, hash: "SHA-512" },
      km,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBuf },
        key,
        ctBuf,
      );
      return dec.decode(decrypted);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "OperationError") {
        throw new WrongPasswordError("AES-GCM auth-tag failure", { cause: error });
      }
      throw new Error("Unexpected V2 decrypt failure", { cause: error });
    }
  }

  // V1 fallback (10k SHA-256) — truncate IV/salt in case browser used pooled buffer
  let ivRaw: ArrayBuffer;
  let saltRaw: ArrayBuffer;
  let ctBuf1: ArrayBuffer;
  try {
    ivRaw = b642ab(envelope.iv as string);
    saltRaw = b642ab(envelope.salt as string);
    ctBuf1 = b642ab(envelope.ciphertext as string);
  } catch (error) {
    throw new CorruptEnvelopeError(
      "V1-fallback envelope field shape mismatch (missing or non-string ciphertext/iv/salt)",
      { cause: error },
    );
  }
  const iv1 = ivRaw.byteLength > 12 ? ivRaw.slice(0, 12) : ivRaw;
  const salt1 = saltRaw.byteLength > 16 ? saltRaw.slice(0, 16) : saltRaw;
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt1, iterations: 10_000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv1 },
      key,
      ctBuf1,
    );
    // v3.3.7 (F-SEC-004): success path on the V1-fallback branch — this is
    // the moment the security advisory becomes actionable (we just decoded
    // sub-OWASP-iteration ciphertext successfully). Warning is one-shot
    // per process; programmatic per-call signal is via
    // `decryptStringV2WithDetails`.
    emitV1WarningOnce();
    return dec.decode(decrypted);
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "OperationError") {
      throw new WrongPasswordError("AES-GCM auth-tag failure", { cause: error });
    }
    throw new Error("Unexpected V1-fallback decrypt failure", { cause: error });
  }
}

/**
 * Same as `decryptStringV2`, but returns `{ plaintext, wasLegacyV1 }` so
 * consumers can react programmatically per call. `wasLegacyV1: true`
 * means the input envelope was decoded via the V1-fallback path
 * (PBKDF2-SHA256 / 10k iterations — sub-OWASP); `wasLegacyV1: false`
 * means the canonical V2 path (PBKDF2-SHA512 / 600k iterations).
 *
 * Use this variant when you need to trigger an in-place re-encrypt-to-V2
 * after detecting a V1 codex entry, OR to surface a per-entry "outdated
 * encryption" banner in the consumer UI. The plain `decryptStringV2`
 * still works for pure decrypt-and-throw-away use cases — the
 * one-shot `getLogger().warn(...)` advisory fires from BOTH variants
 * (a single warning per process for the first V1 decrypt encountered).
 *
 * Added in v3.3.7 (closes audit finding F-SEC-004).
 *
 * Failure classification is identical to `decryptStringV2` — same
 * `CorruptEnvelopeError` / `WrongPasswordError` / wrapped-Error contract.
 */
export async function decryptStringV2WithDetails(
  encryptedBase64: string,
  password: string,
): Promise<DecryptResultWithDetails> {
  // Best-effort detect whether this WILL be a V1-fallback path before we
  // call into the full decrypt — the path branches deterministically on
  // `parsed.v === 2`, and `isEncryptedV2` already implements that check
  // with the same JSON.parse + atob shape. If the envelope is malformed,
  // both functions throw the same `CorruptEnvelopeError` from the same
  // call site, so the `isEncryptedV2`-then-`decryptStringV2` ordering
  // doesn't change the observable error contract.
  const wasLegacyV1 = !isEncryptedV2(encryptedBase64);
  const plaintext = await decryptStringV2(encryptedBase64, password);
  return { plaintext, wasLegacyV1 };
}

/** True iff the envelope is V2 (has `v: 2` after base64-JSON decode). */
export function isEncryptedV2(encryptedBase64: string): boolean {
  try {
    return JSON.parse(atob(encryptedBase64))?.v === 2;
  } catch {
    return false;
  }
}

/** True iff every string in the array is a V2 envelope. Empty array → false. */
export function allEncryptedV2(strings: string[]): boolean {
  return strings.length > 0 && strings.every(isEncryptedV2);
}

/**
 * Has the codex been upgraded to the V2-writes world? The answer comes
 * from whatever string the caller hands in. OuronetUI passes the value
 * of `localStorage.getItem("codex_schema_version")`; the HUB will pass
 * whatever it reads from its config.
 *
 * Pure — the storage lookup happens at the boundary.
 */
export function isCodexUpgraded(schemaVersion: string | null): boolean {
  try { return parseInt(schemaVersion || "0", 10) >= 1; } catch { return false; }
}

/**
 * Writes V2 if the codex has been upgraded, V1 otherwise. The caller
 * supplies the schema-version string (usually from localStorage on the
 * browser, from a persisted config on the server). Pure — no storage
 * I/O here.
 *
 * OuronetUI users with V1 codexes that haven't been upgraded still write
 * V1 blobs. The `upgradeCodexEncryption` flow (triggered on unlock) is
 * what migrates everything to V2, after which future smartEncrypt calls
 * see `schemaVersion >= 1` and take the V2 path.
 */
export async function smartEncrypt(
  plaintext: string,
  password: string,
  schemaVersion: string | null,
): Promise<string> {
  if (isCodexUpgraded(schemaVersion)) return encryptStringV2(plaintext, password);
  // Fallback to V1
  const { encryptString } = await import("./v1");
  return encryptString(plaintext, password);
}

/**
 * Decrypts either format transparently using deterministic shape-based
 * dispatch via `isEncryptedV2`: V2 envelopes go straight to `decryptStringV2`,
 * everything else routes to the V1 primitive. There is no second-attempt
 * fallback — a wrong password on a V1 envelope runs exactly one PBKDF2-SHA256
 * 10k KDF and throws, never triggering a V2 600k retry.
 *
 * Closes a ~1.5s timing differential between V1-success and V1-then-V2-fail
 * paths (the previous try/catch chain ran V1 KDF, then V2 KDF on failure,
 * leaking envelope-format / password-correctness state to a wall-clock
 * observer). This is the single entry point every "decrypt on login" or
 * "decrypt on recovery" call site should use.
 *
 * Errors from the chosen branch (`WrongPasswordError`, `CorruptEnvelopeError`,
 * etc.) propagate directly to the caller — no try/catch wrapping here.
 */
export async function smartDecrypt(encrypted: string, password: string): Promise<string> {
  if (isEncryptedV2(encrypted)) {
    return decryptStringV2(encrypted, password);
  }
  // v3.3.7 (F-SEC-004): non-V2 envelope → V1 path. Surface the one-shot
  // security advisory here too, since `smartDecrypt` short-circuits to
  // the V1 primitive (`decryptString` from `./v1`) directly and never
  // reaches `decryptStringV2`'s V1-fallback path. Without this, codex
  // unlocks via `smartDecrypt` would silently skip the warning.
  emitV1WarningOnce();
  const { decryptString } = await import("./v1");
  return decryptString(encrypted, password);
}

/**
 * Same as `smartDecrypt`, but returns `{ plaintext, wasLegacyV1 }` so
 * consumers can react programmatically per call. `wasLegacyV1: true` for
 * non-V2 envelopes (routed through the V1 primitive); `false` for V2.
 *
 * The single best entry point for "decrypt this codex entry AND tell me
 * whether it was a V1 envelope so I can re-encrypt it to V2 next."
 *
 * Added in v3.3.7 (closes audit finding F-SEC-004). See `EncryptedDataV1`
 * JSDoc for security context.
 */
export async function smartDecryptWithDetails(
  encrypted: string,
  password: string,
): Promise<DecryptResultWithDetails> {
  const wasLegacyV1 = !isEncryptedV2(encrypted);
  const plaintext = await smartDecrypt(encrypted, password);
  return { plaintext, wasLegacyV1 };
}

