import { describe, it, expect } from "vitest";
import pkg from "../package.json" with { type: "json" };

describe("@stoachain/stoa-core package.json version", () => {
  it("declares the released semver string", () => {
    expect(pkg.version).toBe("4.3.5");
  });

  it("is a valid semver MAJOR.MINOR.PATCH triplet", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("declares the canonical package name", () => {
    expect(pkg.name).toBe("@stoachain/stoa-core");
  });
});
