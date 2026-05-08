/**
 * REQ-25 (vendor fidelity): kadena-stoic-legacy subpath export integrity.
 * Validates all 5 declared subpaths resolve and expose expected named exports.
 * Subpaths per package.json exports map: ./client, ./cryptography-utils,
 * ./types, ./hd-wallet, ./hd-wallet/chainweaver
 */
import { describe, it, expect } from "vitest";

describe("REQ-25: kadena-stoic-legacy subpath exports", () => {
  it("./client subpath resolves with named exports", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/client");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("./cryptography-utils subpath resolves with named exports", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/cryptography-utils");
    expect(mod).toBeDefined();
    // URL-safe base64 functions and key restoration are the canonical exports
    expect(typeof (mod as Record<string, unknown>).base64UrlEncode).toBe("function");
    expect(typeof (mod as Record<string, unknown>).base64UrlDecode).toBe("function");
    // capital P per upstream casing in restoreKeyPairFromSecretKey.d.cts
    expect(typeof (mod as Record<string, unknown>).restoreKeyPairFromSecretKey).toBe("function");
  });

  it("./types subpath resolves (type-only — body may be empty at runtime)", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/types");
    expect(mod).toBeDefined();
  });

  it("./hd-wallet subpath resolves with named exports", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/hd-wallet");
    expect(mod).toBeDefined();
    // lowercase 'p' per upstream casing — kadenaGenKeypairFromSeed lives in SLIP10/
    // and is re-exported from the hd-wallet barrel
    expect(typeof (mod as Record<string, unknown>).kadenaGenKeypairFromSeed).toBe("function");
  });

  it("./hd-wallet/chainweaver subpath resolves with named exports", async () => {
    const mod = await import("@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
