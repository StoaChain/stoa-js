/**
 * v3.3.7 — F-SEC-003 closure: seam-setter input validation.
 *
 * Pre-v3.3.7 the two pluggable seams (`setPactReader` and `setLogger`)
 * had inconsistent guards:
 *
 *   - `setPactReader(fn)` accepted ANY value (including `undefined`,
 *     `null`, numbers, etc.). The misconfiguration only surfaced later
 *     as a confusing `_reader is not a function` at the first
 *     `pactRead(...)` call site, often far from the boot wiring that
 *     installed the bad value.
 *
 *   - `setLogger(logger)` only guarded `null`/`undefined`. Passing an
 *     object whose `warn` or `error` was non-callable (a typo'd field
 *     name, a half-finished test fixture, an undefined property
 *     access) silently installed the bad logger; the error surfaced
 *     later as `_logger.warn is not a function` at the first
 *     catch-block routing site.
 *
 * v3.3.7 ships:
 *
 *   - `InvalidPactReaderError extends TypeError` from
 *     `@stoachain/ouronet-core/reads`.
 *   - `InvalidLoggerError extends TypeError` from
 *     `@stoachain/ouronet-core/observability`.
 *   - `setPactReader` rejects non-function inputs.
 *   - `setLogger` rejects non-object inputs AND objects whose `warn`
 *     or `error` are non-callable.
 *
 * Backwards-compat preserved:
 *
 *   - `setLogger(null)` / `setLogger(undefined)` still throw with the
 *     EXACT pre-v3.3.7 message `"setLogger requires a non-null Logger"`
 *     — the existing `tests/observability-logger.test.ts:68-80` test
 *     suite locks that string. The test class is now `InvalidLoggerError`
 *     but `instanceof TypeError` still holds (subclass), so consumer
 *     `try { ... } catch (e) { if (e instanceof TypeError) ... }` code
 *     continues to catch.
 *
 *   - `setLogger({warn, error})` (no `info`) STILL succeeds and
 *     synthesises the missing `info` from `console.info` — v3.3.0's
 *     v3.2.x compat path is intact.
 *
 * What this file locks (10 it-blocks across 3 describe groups)
 * ------------------------------------------------------------
 *
 *   setPactReader (3 tests):
 *     - rejects undefined → InvalidPactReaderError
 *     - rejects null → InvalidPactReaderError
 *     - rejects non-function (number, string) → InvalidPactReaderError
 *     - accepts a valid PactReader function (no throw + replaces seam)
 *
 *   setLogger — input-shape validation (5 tests):
 *     - rejects null with the v3.3.0-locked message + InvalidLoggerError
 *     - rejects undefined with the v3.3.0-locked message + InvalidLoggerError
 *     - rejects non-object (string) → InvalidLoggerError
 *     - rejects {warn: undefined, error: () => {}} → InvalidLoggerError
 *       naming the warn invariant
 *     - rejects {warn: () => {}, error: "not a function"} →
 *       InvalidLoggerError naming the error invariant
 *
 *   setLogger — backwards-compat preservation (2 tests):
 *     - {warn, error, info} with all functions still installs cleanly
 *       (v3.3.0+ full-shape consumers unchanged)
 *     - {warn, error} (no info) still installs cleanly with synthesised
 *       info (v3.2.x compat path unchanged)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  pactRead,
  InvalidPactReaderError,
  type PactReader,
} from "../src/reads";
import {
  setLogger,
  getLogger,
  InvalidLoggerError,
  type Logger,
} from "../src/observability";

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

// ══ setPactReader input validation (F-SEC-003) ══════════════════════════════
describe("v3.3.7 — F-SEC-003 setPactReader input validation", () => {
  it("rejects undefined with InvalidPactReaderError naming the actual type", () => {
    expect(() => setPactReader(undefined as unknown as PactReader)).toThrow(
      InvalidPactReaderError,
    );
    expect(() => setPactReader(undefined as unknown as PactReader)).toThrow(
      /received undefined/,
    );
    // InvalidPactReaderError extends TypeError — instanceof TypeError holds.
    expect(() => setPactReader(undefined as unknown as PactReader)).toThrow(TypeError);
  });

  it("rejects null with InvalidPactReaderError (the type label is 'null', not 'object')", () => {
    expect(() => setPactReader(null as unknown as PactReader)).toThrow(
      InvalidPactReaderError,
    );
    expect(() => setPactReader(null as unknown as PactReader)).toThrow(
      /received null/,
    );
  });

  it("rejects non-function values (number / string / object)", () => {
    expect(() => setPactReader(42 as unknown as PactReader)).toThrow(InvalidPactReaderError);
    expect(() => setPactReader(42 as unknown as PactReader)).toThrow(/received number/);

    expect(() => setPactReader("not a function" as unknown as PactReader)).toThrow(
      InvalidPactReaderError,
    );

    expect(() => setPactReader({} as unknown as PactReader)).toThrow(InvalidPactReaderError);
    expect(() => setPactReader({} as unknown as PactReader)).toThrow(/received object/);
  });

  it("accepts a valid PactReader function and routes pactRead through it", async () => {
    const stub: PactReader = () =>
      Promise.resolve({ result: { status: "success", data: "stub-data" } } as any);
    expect(() => setPactReader(stub)).not.toThrow();

    // Verify the new reader is actually installed (not just the throw skipped).
    const out = await pactRead("(some.pact.code)");
    expect((out as any).result.data).toBe("stub-data");
  });
});

// ══ setLogger input-shape validation (F-SEC-003) ════════════════════════════
describe("v3.3.7 — F-SEC-003 setLogger input-shape validation", () => {
  it("rejects null with InvalidLoggerError + the byte-identical pre-v3.3.7 message", () => {
    // Backwards-compat: existing tests at observability-logger.test.ts:68-80
    // lock the EXACT message text. The error class is now
    // InvalidLoggerError but the message is preserved verbatim.
    expect(() => setLogger(null as unknown as Logger)).toThrow(InvalidLoggerError);
    expect(() => setLogger(null as unknown as Logger)).toThrow(
      "setLogger requires a non-null Logger",
    );
    // instanceof TypeError still holds — consumer catch blocks unchanged.
    expect(() => setLogger(null as unknown as Logger)).toThrow(TypeError);
  });

  it("rejects undefined with InvalidLoggerError + the byte-identical pre-v3.3.7 message", () => {
    expect(() => setLogger(undefined as unknown as Logger)).toThrow(InvalidLoggerError);
    expect(() => setLogger(undefined as unknown as Logger)).toThrow(
      "setLogger requires a non-null Logger",
    );
  });

  it("rejects non-object inputs (string, number)", () => {
    expect(() => setLogger("not a logger" as unknown as Logger)).toThrow(
      InvalidLoggerError,
    );
    expect(() => setLogger("not a logger" as unknown as Logger)).toThrow(
      /requires a Logger object, received string/,
    );

    expect(() => setLogger(42 as unknown as Logger)).toThrow(InvalidLoggerError);
    expect(() => setLogger(42 as unknown as Logger)).toThrow(
      /requires a Logger object, received number/,
    );
  });

  it("rejects {warn: undefined, error: () => {}} → names the warn invariant", () => {
    const broken = { warn: undefined, error: () => {} } as unknown as Logger;
    expect(() => setLogger(broken)).toThrow(InvalidLoggerError);
    expect(() => setLogger(broken)).toThrow(
      /logger\.warn must be a function/,
    );
  });

  it("rejects {warn: () => {}, error: 'oops'} → names the error invariant", () => {
    const broken = { warn: () => {}, error: "oops" } as unknown as Logger;
    expect(() => setLogger(broken)).toThrow(InvalidLoggerError);
    expect(() => setLogger(broken)).toThrow(
      /logger\.error must be a function/,
    );
  });
});

// ══ setLogger backwards-compat preservation ═════════════════════════════════
describe("v3.3.7 — F-SEC-003 setLogger backwards-compat is preserved", () => {
  it("v3.3.0+ full-shape {warn, error, info} still installs cleanly (reference identity preserved)", () => {
    const fullLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    expect(() => setLogger(fullLogger)).not.toThrow();
    expect(getLogger()).toBe(fullLogger);
  });

  it("v3.2.x partial-shape {warn, error} (no info) still installs cleanly with synthesised info", () => {
    const v32Logger = { warn: vi.fn(), error: vi.fn() };
    expect(() => setLogger(v32Logger)).not.toThrow();
    // Synthesised wrapper, NOT the input ref (v3.3.0 contract preserved).
    expect(getLogger()).not.toBe(v32Logger);
    // warn routes to the consumer's mock (their impl wins).
    getLogger().warn("hello");
    expect(v32Logger.warn).toHaveBeenCalledWith("hello");
    // info was synthesised — calling it doesn't throw (routes to console.info default).
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    getLogger().info("operational");
    expect(infoSpy).toHaveBeenCalledWith("operational");
  });
});
