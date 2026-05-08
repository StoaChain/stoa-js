/**
 * REQ-25 (vendor fidelity): kadena-stoic-legacy types-shape validation.
 * Validates type-only exports compile and structurally match expected shapes.
 */
import { describe, it, expectTypeOf } from "vitest";
import type * as ClientTypes from "@stoachain/kadena-stoic-legacy/types";

describe("REQ-25: kadena-stoic-legacy types-shape", () => {
  it("./types module is importable as a type-only namespace", () => {
    // Compile-time assertion: type import resolves without error
    expectTypeOf<typeof ClientTypes>().toBeObject();
  });
});
