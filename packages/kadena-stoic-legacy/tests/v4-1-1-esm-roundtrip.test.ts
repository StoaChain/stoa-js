/**
 * REQ-28 (T7.8 catch-up): kadena-stoic-legacy ESM dynamic-import roundtrip.
 * Validates the built artifact is importable from a Node ESM context.
 * The root barrel is intentionally empty, so subpath exports are tested instead.
 */
import { describe, it, expect } from "vitest";

describe("REQ-28: kadena-stoic-legacy ESM roundtrip", () => {
  it("hd-wallet subpath is dynamically importable", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/hd-wallet");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("hd-wallet subpath exposes at least one named export", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/hd-wallet");
    const exportNames = Object.keys(mod);
    expect(exportNames.length).toBeGreaterThan(0);
  });

  it("cryptography-utils subpath is dynamically importable and non-empty", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/cryptography-utils");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
    const exportNames = Object.keys(mod);
    expect(exportNames.length).toBeGreaterThan(0);
  });
});
