/**
 * V2 decryptStringV2 — typed-error classification (Phase 1, T1.3).
 *
 * Asserts the five-way failure classification mandated by REQ-02 for both
 * the V2 branch AND the internal V1-fallback branch inside decryptStringV2:
 *
 *   1. JSON.parse / outer atob failure       → CorruptEnvelopeError
 *   2. Non-object parsed payload (e.g. null) → CorruptEnvelopeError
 *   3. Envelope-field-shape mismatch         → CorruptEnvelopeError
 *   4. AES-GCM auth-tag failure              → WrongPasswordError
 *   5. Any other failure                     → wrapped Error with `cause`
 *
 * Phase 2 REQ-09 owns the broader integration assertions through
 * `smartDecrypt`; this file pins the per-branch contract on the direct
 * `decryptStringV2` call site so future refactors cannot silently regress
 * the inner-b642ab try-block placement (the F-NEW-002 / F-X02 invariant).
 */

import { describe, it, expect } from "vitest";
import {
  encryptString,
  encryptStringV2,
  decryptStringV2,
  WrongPasswordError,
  CorruptEnvelopeError,
} from "../src/crypto";

const PASSWORD = "correct-horse-battery-staple";
const WRONG_PASSWORD = "wrong-horse-battery-staple";
const PLAINTEXT = "the quick brown fox jumps over the lazy dog";

describe("decryptStringV2 — typed error classification", () => {
  describe("CorruptEnvelopeError — envelope-parse failures", () => {
    it("throws CorruptEnvelopeError when input is not valid base64", async () => {
      await expect(decryptStringV2("not-valid-base64!!!", PASSWORD)).rejects.toBeInstanceOf(
        CorruptEnvelopeError,
      );
    });

    it("throws CorruptEnvelopeError when base64 decodes to non-JSON", async () => {
      const bad = btoa("this is not json at all");
      await expect(decryptStringV2(bad, PASSWORD)).rejects.toBeInstanceOf(CorruptEnvelopeError);
    });

    it("throws CorruptEnvelopeError when JSON.parse yields null (non-object guard)", async () => {
      const badNull = btoa("null");
      await expect(decryptStringV2(badNull, PASSWORD)).rejects.toBeInstanceOf(
        CorruptEnvelopeError,
      );
    });

    it("throws CorruptEnvelopeError when JSON.parse yields a primitive", async () => {
      const badNumber = btoa("42");
      await expect(decryptStringV2(badNumber, PASSWORD)).rejects.toBeInstanceOf(
        CorruptEnvelopeError,
      );
    });
  });

  describe("CorruptEnvelopeError — envelope-field-shape mismatches", () => {
    it("V2 branch: missing ciphertext field → CorruptEnvelopeError", async () => {
      const malformed = btoa(JSON.stringify({ v: 2, iv: "AAAA", salt: "AAAA" }));
      await expect(decryptStringV2(malformed, PASSWORD)).rejects.toBeInstanceOf(
        CorruptEnvelopeError,
      );
    });

    it("V2 branch: non-string iv → CorruptEnvelopeError", async () => {
      const malformed = btoa(
        JSON.stringify({ v: 2, ciphertext: "AAAA", iv: 12345, salt: "AAAA" }),
      );
      await expect(decryptStringV2(malformed, PASSWORD)).rejects.toBeInstanceOf(
        CorruptEnvelopeError,
      );
    });

    it("V1-fallback branch: missing salt field → CorruptEnvelopeError", async () => {
      // No `v` field → routes to V1-fallback branch inside decryptStringV2
      const malformed = btoa(JSON.stringify({ ciphertext: "AAAA", iv: "AAAA" }));
      await expect(decryptStringV2(malformed, PASSWORD)).rejects.toBeInstanceOf(
        CorruptEnvelopeError,
      );
    });
  });

  describe("WrongPasswordError — AES-GCM auth-tag failures", () => {
    it("V2 branch: wrong password on V2 envelope → WrongPasswordError", async () => {
      const enc = await encryptStringV2(PLAINTEXT, PASSWORD);
      await expect(decryptStringV2(enc, WRONG_PASSWORD)).rejects.toBeInstanceOf(
        WrongPasswordError,
      );
    });

    it("V1-fallback branch: wrong password on V1 envelope passed directly → WrongPasswordError", async () => {
      const v1Blob = await encryptString(PLAINTEXT, PASSWORD);
      await expect(decryptStringV2(v1Blob, WRONG_PASSWORD)).rejects.toBeInstanceOf(
        WrongPasswordError,
      );
    });
  });

  describe("typed errors preserve cause via ES2022 Error.cause", () => {
    it("WrongPasswordError carries the underlying OperationError as `cause`", async () => {
      const enc = await encryptStringV2(PLAINTEXT, PASSWORD);
      try {
        await decryptStringV2(enc, WRONG_PASSWORD);
        throw new Error("expected decryptStringV2 to reject");
      } catch (e) {
        expect(e).toBeInstanceOf(WrongPasswordError);
        expect((e as WrongPasswordError).cause).toBeDefined();
      }
    });

    it("CorruptEnvelopeError carries the underlying parse error as `cause`", async () => {
      try {
        await decryptStringV2("###not base64###", PASSWORD);
        throw new Error("expected decryptStringV2 to reject");
      } catch (e) {
        expect(e).toBeInstanceOf(CorruptEnvelopeError);
        expect((e as CorruptEnvelopeError).cause).toBeDefined();
      }
    });
  });
});
