import { describe, it, expect } from "vitest";
import { SmartAccountAuthError } from "../src/signing/errors";

describe("SmartAccountAuthError", () => {
  it("is constructable and extends Error", () => {
    const err = new SmartAccountAuthError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SmartAccountAuthError);
  });
});
