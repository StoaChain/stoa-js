/**
 * v3.3.7 — F-SEC-004 closure: V1-fallback security advisory.
 *
 * V1 envelopes use PBKDF2-SHA256 / 10,000 iterations / AES-GCM-256.
 * OWASP's password-storage cheat sheet (2023+) recommends a PBKDF2-SHA256
 * minimum of **600,000** iterations — V1 is well below that bar and
 * meaningfully crackable on commodity GPU hardware. V2 envelopes use
 * PBKDF2-SHA512 / 600,000 iterations and meet the modern bar.
 *
 * V1 lingers in the codebase for backwards-compat: codex backups
 * exported before the V2 upgrade still parse via the V1 path inside
 * `decryptStringV2` (envelopes lacking `v: 2`) and the V1 primitive
 * route inside `smartDecrypt`. Pre-v3.3.7 these paths were silent —
 * consumers had no way to detect that a successful decrypt had used
 * legacy-strength KDF parameters, and could not surface "your codex
 * uses outdated encryption" UI banners or trigger in-place re-encrypt
 * flows.
 *
 * v3.3.7 ships:
 *
 *   - One-shot `getLogger().warn(...)` advisory: fires on the FIRST V1
 *     decrypt per process lifetime (one-shot guard prevents bulk-decrypt
 *     log spam — a codex with 100 V1 entries logs ONE warning, not 100).
 *
 *   - `decryptStringV2WithDetails(blob, password): Promise<{plaintext, wasLegacyV1}>`
 *     for the per-call programmatic signal. Same failure contract as
 *     `decryptStringV2` (CorruptEnvelopeError / WrongPasswordError).
 *
 *   - `smartDecryptWithDetails(blob, password): Promise<{plaintext, wasLegacyV1}>`
 *     for the auto-detect entry point. Mirrors `smartDecrypt`'s shape
 *     dispatch (V2 envelopes route through `decryptStringV2`,
 *     non-V2 envelopes route through the V1 primitive).
 *
 *   - JSDoc CVE-style risk documentation on `EncryptedDataV1`,
 *     `decryptStringV2`, and `smartDecrypt` so future contributors
 *     reading the source see the security context inline.
 *
 * What this file locks (10 it-blocks across 3 describe groups)
 * ------------------------------------------------------------
 *
 *   decryptStringV2WithDetails (3 tests):
 *     - V2 envelope (encryptStringV2) → wasLegacyV1: false
 *     - V1 envelope (encryptString from v1) → wasLegacyV1: true,
 *       plaintext correct
 *     - WrongPasswordError still propagates via the rich variant (the
 *       failure contract is identical to the plain `decryptStringV2`)
 *
 *   smartDecryptWithDetails (2 tests):
 *     - V2 envelope → wasLegacyV1: false (routes via decryptStringV2)
 *     - V1 envelope → wasLegacyV1: true (routes via the V1 primitive)
 *
 *   one-shot warning behavior (5 tests):
 *     - First V1 decrypt via decryptStringV2 emits getLogger().warn
 *       once with the security-advisory text
 *     - Second V1 decrypt is silent (one-shot guard intact)
 *     - V2 decrypts NEVER emit the warning (the advisory is V1-specific)
 *     - First V1 decrypt via smartDecrypt also emits the warning
 *       (smartDecrypt short-circuits to the V1 primitive without
 *       reaching decryptStringV2's V1-fallback path — needs its own
 *       warning hook)
 *     - The rich `*WithDetails` variants emit the warning identically
 *       (they delegate to the plain functions; the warning fires from
 *       the underlying call)
 *
 * Each test calls `_resetV1WarningEmittedForTests()` in `beforeEach`
 * to start from a clean one-shot state so test ordering doesn't
 * matter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encryptStringV2,
  decryptStringV2,
  decryptStringV2WithDetails,
  smartDecrypt,
  smartDecryptWithDetails,
  WrongPasswordError,
} from "../src/crypto";
import { encryptString } from "../src/crypto/v1";
import { _resetV1WarningEmittedForTests } from "../src/crypto/v2";
import { setLogger, getLogger, type Logger } from "../src/observability";

const PASSWORD = "correct-horse-battery-staple";
const WRONG_PASSWORD = "wrong-horse-battery-staple";
const PLAINTEXT = "v3.3.7 F-SEC-004 fixture text";

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
  _resetV1WarningEmittedForTests();
});

afterEach(() => {
  setLogger(defaultLogger);
  _resetV1WarningEmittedForTests();
  vi.restoreAllMocks();
});

// ══ decryptStringV2WithDetails ══════════════════════════════════════════════
describe("v3.3.7 — F-SEC-004 decryptStringV2WithDetails", () => {
  it("V2 envelope → { plaintext, wasLegacyV1: false }", async () => {
    const v2blob = await encryptStringV2(PLAINTEXT, PASSWORD);
    const out = await decryptStringV2WithDetails(v2blob, PASSWORD);
    expect(out.plaintext).toBe(PLAINTEXT);
    expect(out.wasLegacyV1).toBe(false);
  });

  it("V1 envelope → { plaintext, wasLegacyV1: true } and plaintext is correct", async () => {
    // Mute the warning during this test so the assertion is purely about
    // the return shape, not the side-effect.
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });

    const v1blob = await encryptString(PLAINTEXT, PASSWORD);
    const out = await decryptStringV2WithDetails(v1blob, PASSWORD);
    expect(out.plaintext).toBe(PLAINTEXT);
    expect(out.wasLegacyV1).toBe(true);
  });

  it("WrongPasswordError still propagates from the rich variant (failure contract unchanged)", async () => {
    const v2blob = await encryptStringV2(PLAINTEXT, PASSWORD);
    await expect(
      decryptStringV2WithDetails(v2blob, WRONG_PASSWORD),
    ).rejects.toThrow(WrongPasswordError);
  });
});

// ══ smartDecryptWithDetails ═════════════════════════════════════════════════
describe("v3.3.7 — F-SEC-004 smartDecryptWithDetails", () => {
  it("V2 envelope → wasLegacyV1: false (routes via decryptStringV2)", async () => {
    const v2blob = await encryptStringV2(PLAINTEXT, PASSWORD);
    const out = await smartDecryptWithDetails(v2blob, PASSWORD);
    expect(out.plaintext).toBe(PLAINTEXT);
    expect(out.wasLegacyV1).toBe(false);
  });

  it("V1 envelope → wasLegacyV1: true (routes via the V1 primitive)", async () => {
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });

    const v1blob = await encryptString(PLAINTEXT, PASSWORD);
    const out = await smartDecryptWithDetails(v1blob, PASSWORD);
    expect(out.plaintext).toBe(PLAINTEXT);
    expect(out.wasLegacyV1).toBe(true);
  });
});

// ══ One-shot warning behavior ═══════════════════════════════════════════════
describe("v3.3.7 — F-SEC-004 one-shot V1 warning", () => {
  it("first V1 decrypt via decryptStringV2 emits getLogger().warn with the security advisory", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const v1blob = await encryptString(PLAINTEXT, PASSWORD);
    await decryptStringV2(v1blob, PASSWORD);

    expect(spyLogger.warn).toHaveBeenCalledTimes(1);
    expect(spyLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/V1-format encrypted blob decoded successfully/),
    );
    expect(spyLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/PBKDF2-SHA256 at 10,000 iterations/),
    );
    expect(spyLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/below OWASP's current 600,000 minimum/),
    );
  });

  it("second V1 decrypt is silent — one-shot guard intact (no log spam on bulk decrypt)", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const v1blob1 = await encryptString(PLAINTEXT, PASSWORD);
    const v1blob2 = await encryptString("different fixture", PASSWORD);

    await decryptStringV2(v1blob1, PASSWORD);
    await decryptStringV2(v1blob2, PASSWORD);

    // Two V1 decrypts but only ONE warning — load-bearing assertion for the
    // bulk-codex-decrypt UX (a 100-entry V1 codex doesn't log 100 times).
    expect(spyLogger.warn).toHaveBeenCalledTimes(1);
  });

  it("V2 decrypts NEVER emit the warning (the advisory is V1-specific)", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const v2blob = await encryptStringV2(PLAINTEXT, PASSWORD);
    await decryptStringV2(v2blob, PASSWORD);

    expect(spyLogger.warn).not.toHaveBeenCalled();
  });

  it("first V1 decrypt via smartDecrypt also emits the warning (separate code path needs its own hook)", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const v1blob = await encryptString(PLAINTEXT, PASSWORD);
    await smartDecrypt(v1blob, PASSWORD);

    expect(spyLogger.warn).toHaveBeenCalledTimes(1);
    expect(spyLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/V1-format encrypted blob decoded successfully/),
    );
  });

  it("rich *WithDetails variants emit the warning the same way (delegation chain intact)", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const v1blob = await encryptString(PLAINTEXT, PASSWORD);
    await decryptStringV2WithDetails(v1blob, PASSWORD);

    expect(spyLogger.warn).toHaveBeenCalledTimes(1);
  });
});
