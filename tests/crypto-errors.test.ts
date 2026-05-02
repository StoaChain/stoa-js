/**
 * Phase 1 surface verification for the typed crypto error taxonomy.
 *
 * Three classes (`WrongPasswordError`, `CorruptEnvelopeError`,
 * `UnsupportedFormatError`) are added to `src/crypto/errors.ts` and
 * re-exported from the crypto barrel. Phase 2 will exercise these via
 * the actual decrypt paths; this file only asserts the additive surface
 * contract — class hierarchy, `name` property, and ES2022 `cause`
 * propagation — which is the deliverable scoped to Phase 1.
 */

import { describe, it, expect } from "vitest";
import {
  WrongPasswordError,
  CorruptEnvelopeError,
  UnsupportedFormatError,
} from "../src/crypto";

describe("crypto error taxonomy — surface contract", () => {
  it("WrongPasswordError extends Error and sets name", () => {
    const err = new WrongPasswordError("wrong pw");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(WrongPasswordError);
    expect(err.name).toBe("WrongPasswordError");
    expect(err.message).toBe("wrong pw");
  });

  it("CorruptEnvelopeError extends Error and sets name", () => {
    const err = new CorruptEnvelopeError("malformed envelope");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CorruptEnvelopeError);
    expect(err.name).toBe("CorruptEnvelopeError");
    expect(err.message).toBe("malformed envelope");
  });

  it("UnsupportedFormatError extends Error and sets name", () => {
    const err = new UnsupportedFormatError("unknown schema v");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UnsupportedFormatError);
    expect(err.name).toBe("UnsupportedFormatError");
    expect(err.message).toBe("unknown schema v");
  });

  it("propagates ES2022 ErrorOptions.cause through super()", () => {
    const root = new Error("root cause");
    const wrapped = new WrongPasswordError("auth failed", { cause: root });
    expect(wrapped.cause).toBe(root);
  });

  it("constructor accepts no arguments (message and options both optional)", () => {
    const err = new CorruptEnvelopeError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("CorruptEnvelopeError");
  });
});
