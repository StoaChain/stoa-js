/**
 * REQ-28 (T7.8 catch-up): stoa-core ESM dynamic-import roundtrip.
 * Validates the built artifact is importable from a Node ESM context.
 * The root barrel is intentionally empty; subpath exports carry the surface.
 */
import { describe, it, expect } from "vitest";

describe("REQ-28: stoa-core ESM roundtrip", () => {
  it("dynamically imports the package root barrel", async () => {
    const mod = await import("@stoachain/stoa-core");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("wallet subpath is dynamically importable and non-empty", async () => {
    const mod = await import("@stoachain/stoa-core/wallet");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
    const exportNames = Object.keys(mod);
    expect(exportNames.length).toBeGreaterThan(0);
  });

  it("crypto subpath is dynamically importable and non-empty", async () => {
    const mod = await import("@stoachain/stoa-core/crypto");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
    const exportNames = Object.keys(mod);
    expect(exportNames.length).toBeGreaterThan(0);
  });
});
