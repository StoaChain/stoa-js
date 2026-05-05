import { describe, it, expect } from "vitest";
import pkg from "../package.json" with { type: "json" };

describe("package.json version", () => {
  it("declares the released semver string", () => {
    expect(pkg.version).toBe("3.1.0");
  });

  it("is a valid semver MAJOR.MINOR.PATCH triplet", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
