/**
 * Phase 5 catch-block routing regression guard — closes F-CORE-019.
 *
 * Pins that the seven catch-block sites in `src/interactions/ouroFunctions.ts`
 * route via `getLogger().error(...)` from `../observability` rather than:
 *
 *   - calling `console.error(...)` directly (the pre-Phase-5 routed shape on
 *     three of the seven sites — `getRotateKadenaInfo`, `getUnwrapStoaTarget`,
 *     `checkCoinAccountExists`); OR
 *   - silently swallowing the error with `} catch { return "0"; }` (the
 *     pre-Phase-5 silent shape on four of the seven sites — `getIgnisBalance`,
 *     `getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro`).
 *
 * The audit closure rationale (F-CORE-019) is that mixed conventions across the
 * same module lose diagnostic info on the silent paths and create reviewer
 * cognitive load on the routed paths. This test pins ONE convention so a future
 * regression to either the silent OR the direct-console form breaks the build.
 *
 * Strategy: install a throwing PactReader via `setPactReader(...)`, install a
 * spy logger via `setLogger(...)`, exercise one previously-silent function
 * (`getIgnisBalance` — exercises the path Phase 5 had to add error binding to)
 * and one previously-routed function (`getRotateKadenaInfo` — exercises the
 * `console.error` → `getLogger().error` swap), and assert (a) the spy logger
 * captured both calls, (b) the global `console.error` was never invoked
 * directly, and (c) each function still returned its documented fallback.
 *
 * Both seams (PactReader + Logger) are restored in `afterEach` to keep tests
 * independent — Phase 6's `setLogger` and Phase 2b's `setPactReader` both hold
 * module-private state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "../src/reads";
import { getLogger, setLogger, type Logger } from "../src/observability";
import {
  getIgnisBalance,
  getRotateKadenaInfo,
} from "../src/interactions/ouroFunctions";

const throwingReader: PactReader = () => {
  return Promise.reject(new Error("simulated pactRead failure"));
};

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
  setPactReader(throwingReader);
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

describe("Phase 5 catch-block routing (F-CORE-019)", () => {
  it("getIgnisBalance routes its catch via getLogger().error and returns the documented '0' fallback", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getIgnisBalance("k:abc");

    expect(out).toBe("0");
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getIgnisBalance:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getRotateKadenaInfo routes its catch via getLogger().error and returns the documented null fallback", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getRotateKadenaInfo("patron", "k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error getting RotateKadena info:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
