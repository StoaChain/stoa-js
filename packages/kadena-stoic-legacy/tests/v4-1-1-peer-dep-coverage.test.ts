/**
 * Peer-dep coverage for kadena-stoic-legacy.
 * kadena-stoic-legacy has ZERO @stoachain/* peer-deps (it's the base package).
 * This test asserts that fact + that any third-party peers use valid version
 * specifiers. The hotfix-class invariant (@scure/bip39 exact pin) is the
 * primary lock here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-05: kadena-stoic-legacy peer-dep coverage", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8"));
  const peers = pkg.peerDependencies ?? {};

  it("has NO @stoachain/* peer dependencies (base package)", () => {
    const stoachainPeers = Object.keys(peers).filter(k => k.startsWith("@stoachain/"));
    expect(stoachainPeers).toEqual([]);
  });

  it("@scure/bip39 peer-dep is exact-pin '1.2.1' (matches vendored copy)", () => {
    expect(peers["@scure/bip39"]).toBe("1.2.1");
  });

  it("all peer-dep version specifiers are well-formed", () => {
    for (const version of Object.values(peers)) {
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^(\d+\.\d+\.\d+|\^\d+\.\d+\.\d+)$/);
    }
  });
});
