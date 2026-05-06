/**
 * Contract test for the pluggable Pact-reader injection seam at
 * `src/reads/pactReader.ts`. This file exists alongside
 * `tests/interactions-read-seam.test.ts` (which exercises the seam via the
 * 16 migrated interaction call sites) but covers a different surface: the
 * setter / getter / forwarder behaviour itself, which the integration guard
 * does not assert.
 *
 * Coverage scope:
 *   1. Default reader is `rawCalibratedDirtyRead` with no `setPactReader` call.
 *   2. `setPactReader(stub)` swaps the active reader so `pactRead(...)` routes
 *      to the stub and never to a previous reader.
 *   3. `pactRead(code, opts)` forwards both arguments verbatim to the
 *      configured reader (asserted via `vi.fn().mock.calls`).
 *   4. Successive `setPactReader` calls REPLACE the active reader (no stacking
 *      / no previous-reader fall-through).
 *   5. `getPactReader()` returns the currently-configured reader by reference
 *      identity, and switches when the seam is reconfigured.
 *
 * No real network: stubs are `vi.fn().mockResolvedValue(...)` or plain arrow
 * functions returning `Promise.resolve(...)`. `rawCalibratedDirtyRead` is
 * imported only for the `afterEach` default-restore — never invoked.
 *
 * Reset pattern mirrors `tests/interactions-read-seam.test.ts:163-170`: the
 * module keeps `_reader` as a private mutable closure
 * (`src/reads/pactReader.ts:46`), so an `afterEach` that calls
 * `setPactReader(rawCalibratedDirtyRead)` is required to prevent state bleed
 * across test files in the same vitest run.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  setPactReader,
  getPactReader,
  pactRead,
  rawCalibratedDirtyRead,
  type PactReader,
} from "../src/reads";

afterEach(() => {
  // Restore the module-level default so any later-loaded test file sees a
  // clean seam — same pattern as interactions-read-seam.test.ts:168-170.
  setPactReader(rawCalibratedDirtyRead);
});

describe("pactReader injection-seam contract", () => {
  it("returns rawCalibratedDirtyRead as the default reader when setPactReader has not been called", () => {
    // Verifies the module-level initialiser at src/reads/pactReader.ts:46
    // (`let _reader: PactReader = rawCalibratedDirtyRead`). The afterEach in
    // this file restores the default before each it-block, so this assertion
    // describes the cold-boot state any consumer sees pre-configuration.
    expect(getPactReader()).toBe(rawCalibratedDirtyRead);
  });

  it("setPactReader(stub) swaps the active reader so pactRead invokes the stub and not the previous reader", async () => {
    const previous: PactReader = vi.fn().mockResolvedValue("previous-result");
    const next: PactReader = vi.fn().mockResolvedValue("next-result");

    setPactReader(previous);
    setPactReader(next);

    const result = await pactRead("(coin.get-balance \"k:abc\")");

    expect(next).toHaveBeenCalledTimes(1);
    expect(previous).not.toHaveBeenCalled();
    expect(result).toBe("next-result");
  });

  it("pactRead(pactCode, options) forwards both arguments verbatim to the configured reader", async () => {
    const stub = vi.fn<PactReader>().mockResolvedValue({ ok: true });
    setPactReader(stub);

    const code = "(my.module.fn \"arg\")";
    const options = {
      pactUrl: "https://example.invalid/pact",
      chainId: "3",
      tier: "T2",
      skipTempWatcher: true,
      readTimeoutMs: 7500,
      customField: "passthrough",
    };

    await pactRead(code, options);

    expect(stub).toHaveBeenCalledTimes(1);
    // `mock.calls[0]` is the array of args from the first invocation. Strict
    // identity on `options` proves the forwarder does not clone / mutate.
    expect(stub.mock.calls[0][0]).toBe(code);
    expect(stub.mock.calls[0][1]).toBe(options);
  });

  it("calling setPactReader twice replaces (does not stack) the active reader", async () => {
    const stubA: PactReader = vi.fn().mockResolvedValue("A");
    const stubB: PactReader = vi.fn().mockResolvedValue("B");

    setPactReader(stubA);
    setPactReader(stubB);

    const first = await pactRead("(noop)");
    const second = await pactRead("(noop)");

    // Two pactRead calls, both routed to stubB. stubA must remain at zero
    // invocations — proving the seam holds a single reference, not a stack.
    expect(stubA).not.toHaveBeenCalled();
    expect(stubB).toHaveBeenCalledTimes(2);
    expect(first).toBe("B");
    expect(second).toBe("B");
  });

  it("getPactReader returns the currently-configured reader by reference identity and switches on reconfiguration", () => {
    const stubA: PactReader = (_code, _options) => Promise.resolve("a");
    const stubB: PactReader = (_code, _options) => Promise.resolve("b");

    setPactReader(stubA);
    expect(getPactReader()).toBe(stubA);

    setPactReader(stubB);
    expect(getPactReader()).toBe(stubB);
    // stubA must no longer be the active reader after the second configure.
    expect(getPactReader()).not.toBe(stubA);
  });
});
