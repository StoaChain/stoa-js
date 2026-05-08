/**
 * Compilation-check test for the MnemonicMismatchError stub.
 *
 * This test's sole purpose is to verify that MnemonicMismatchError is
 * importable from the wallet subpath barrel and is a subclass of Error.
 * The constructor body is intentionally empty at this wave — Wave-2 fills
 * it in. The test therefore only asserts the inheritance contract, not
 * message formatting (which Wave-2 will cover).
 */

import { describe, it, expect } from "vitest";
import { MnemonicMismatchError } from "../src/wallet";

describe("MnemonicMismatchError stub", () => {
  it("is importable from the wallet barrel", () => {
    expect(MnemonicMismatchError).toBeDefined();
  });

  it("extends Error (instanceof check passes)", () => {
    const err = new MnemonicMismatchError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MnemonicMismatchError);
  });
});
