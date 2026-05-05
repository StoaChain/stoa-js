/**
 * Logger seam contract tests.
 *
 * Pins the public contract of `src/observability/logger.ts`:
 *   - default `getLogger().warn(...)` routes to `console.warn`
 *   - default `getLogger().error(...)` routes to `console.error`
 *   - default `getLogger().info(...)` routes to `console.info` (v3.3.0+)
 *   - `setLogger(custom)` swaps the active logger
 *     - reference identity preserved when input has all 3 methods
 *     - synthesised wrapper when input lacks `info` (v3.3.0 backwards-compat
 *       for v3.2.x consumers wiring `setLogger({warn, error})`)
 *   - `setLogger(null)` / `setLogger(undefined)` throw `TypeError` with the
 *     byte-identical message `setLogger requires a non-null Logger`
 *
 * The seam is module-scoped state, so each test that swaps the logger MUST
 * restore the default in `afterEach` to keep tests independent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getLogger,
  setLogger,
  type Logger,
} from "../src/observability/logger";

describe("observability/logger", () => {
  let defaultLogger: Logger;

  beforeEach(() => {
    defaultLogger = getLogger();
  });

  afterEach(() => {
    // Restore the default so cross-test pollution is impossible.
    setLogger(defaultLogger);
    vi.restoreAllMocks();
  });

  it("default getLogger().warn(...) routes to console.warn with byte-identical args", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getLogger().warn("hello", 1, 2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("hello", 1, 2);
  });

  it("default getLogger().error(...) routes to console.error with byte-identical args", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("x");
    getLogger().error("err", err);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("err", err);
  });

  it("setLogger(custom) preserves reference identity when input has all 3 methods", () => {
    const customLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    setLogger(customLogger);

    // Full-shape input → reference identity preserved (no wrapping needed).
    expect(getLogger()).toBe(customLogger);

    getLogger().warn("x");
    expect(customLogger.warn).toHaveBeenCalledWith("x");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("setLogger(null) throws TypeError with the locked message text", () => {
    expect(() => setLogger(null as unknown as Logger)).toThrow(TypeError);
    expect(() => setLogger(null as unknown as Logger)).toThrow(
      "setLogger requires a non-null Logger",
    );
  });

  it("setLogger(undefined) throws TypeError with the locked message text", () => {
    expect(() => setLogger(undefined as unknown as Logger)).toThrow(TypeError);
    expect(() => setLogger(undefined as unknown as Logger)).toThrow(
      "setLogger requires a non-null Logger",
    );
  });

  // ── v3.3.0 — info() channel + backwards-compat wrapping ─────────────────
  it("default getLogger().info(...) routes to console.info with byte-identical args", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    getLogger().info("hi", { ctx: 1 });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("hi", { ctx: 1 });
  });

  it("v3.3.0 backwards-compat: setLogger({warn, error}) (no info) is wrapped, info falls through to console.info", () => {
    // Pre-v3.3.0 consumers wired `setLogger({warn, error})` against the
    // 2-method Logger shape. Post-v3.3.0 the type has 3 methods, but the
    // setter accepts a 2-method input and synthesises `info` from the
    // default `console.info` routing — non-breaking for v3.2.x consumers.
    const v32Logger = { warn: vi.fn(), error: vi.fn() };
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    setLogger(v32Logger);

    // The synthesised wrapper is NOT the same reference as the input
    // (info had to be filled in).
    expect(getLogger()).not.toBe(v32Logger);

    // warn/error route to the consumer's logger (their custom impl wins).
    getLogger().warn("w");
    expect(v32Logger.warn).toHaveBeenCalledWith("w");

    // info routes to the default (consumer didn't provide one) → console.info.
    getLogger().info("i", 42);
    expect(infoSpy).toHaveBeenCalledWith("i", 42);
  });

  it("v3.3.0 setLogger({warn, error, info}) (full shape) preserves reference identity", () => {
    const fullLogger: Logger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };
    setLogger(fullLogger);
    expect(getLogger()).toBe(fullLogger);
    getLogger().info("x");
    expect(fullLogger.info).toHaveBeenCalledWith("x");
  });
});
