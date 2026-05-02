/**
 * Logger seam contract tests.
 *
 * Pins the public contract of `src/observability/logger.ts`:
 *   - default `getLogger().warn(...)` routes to `console.warn`
 *   - default `getLogger().error(...)` routes to `console.error`
 *   - `setLogger(custom)` swaps the active logger (reference identity preserved)
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

  it("setLogger(custom) swaps the active logger; getLogger() returns the new reference", () => {
    const customLogger: Logger = { warn: vi.fn(), error: vi.fn() };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    setLogger(customLogger);

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
});
