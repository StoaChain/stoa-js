/**
 * Peer-dep coverage for stoa-core.
 * Locks the cross-package version pin (kadena-stoic-legacy) AND the @scure/bip39
 * exact-pin parity (the v4.1.0 hotfix #1 class — bip39 1.2.1 across both packages).
 *
 * Phase 8 hand-off: when version bumps to 4.1.1, this assertion string updates.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-05: stoa-core peer-dep coverage", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8"));
  const peers = pkg.peerDependencies ?? {};

  it("@stoachain/kadena-stoic-legacy peer-dep is exact-pin '4.4.0'", () => {
    expect(peers["@stoachain/kadena-stoic-legacy"]).toBe("4.4.0");
  });

  it("@scure/bip39 peer-dep is exact-pin '1.2.1' (matches kadena-stoic-legacy nested copy; v4.1.0 hotfix #1 alignment)", () => {
    expect(peers["@scure/bip39"]).toBe("1.2.1");
  });

  it("@scure/bip39 peer-dep matches kadena-stoic-legacy's @scure/bip39 (cross-package parity)", () => {
    const kslPath = resolve(here, "..", "..", "kadena-stoic-legacy", "package.json");
    const ksl = JSON.parse(readFileSync(kslPath, "utf8"));
    const kslBip39 = ksl.peerDependencies?.["@scure/bip39"];
    const stoaBip39 = peers["@scure/bip39"];
    expect(stoaBip39).toBeDefined();
    expect(kslBip39).toBeDefined();
    expect(stoaBip39).toBe(kslBip39); // BOTH must be "1.2.1"
  });

  it("all peer-dep version specifiers are well-formed", () => {
    for (const version of Object.values(peers)) {
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^(\d+\.\d+\.\d+|\^\d+\.\d+\.\d+)$/);
    }
  });

  // The 4.3.7 release exists to move this dependency off the deprecated
  // @stoachain name. A published tarball's dependencies cannot be edited, so a
  // regression here would silently drag every consumer back onto a deprecated
  // package with no way to override it. Lock both directions.
  describe("DALOS dependency (the 4.3.7 rename)", () => {
    const deps = pkg.dependencies ?? {};

    it("depends on @ouronet/dalos-crypto", () => {
      expect(deps["@ouronet/dalos-crypto"]).toBeDefined();
    });

    it("that dependency is an exact pin", () => {
      expect(deps["@ouronet/dalos-crypto"]).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("does NOT depend on the deprecated @stoachain/dalos-crypto, in any dependency field", () => {
      for (const field of ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"]) {
        expect(Object.keys(pkg[field] ?? {}), `@stoachain/dalos-crypto must not appear in ${field}`).not.toContain(
          "@stoachain/dalos-crypto",
        );
      }
    });

    it("no source file imports the deprecated @stoachain/dalos-crypto", () => {
      const srcDir = resolve(here, "..", "src");
      const { readdirSync } = require("node:fs") as typeof import("node:fs");
      const walk = (dir: string, out: string[] = []): string[] => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const full = resolve(dir, e.name);
          if (e.isDirectory()) walk(full, out);
          else if (e.isFile() && e.name.endsWith(".ts")) out.push(full);
        }
        return out;
      };
      const offenders = walk(srcDir).filter((f) => readFileSync(f, "utf8").includes("@stoachain/dalos-crypto"));
      expect(offenders, `still importing the deprecated name: ${offenders.join(", ")}`).toEqual([]);
    });
  });
});
