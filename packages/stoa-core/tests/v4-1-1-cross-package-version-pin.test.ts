/**
 * Cross-package version-pin consistency.
 *
 * Reads each package's package.json + peer-deps and asserts the dependency
 * pins are consistent. Comparison-based (not hardcoded version strings) so
 * this test survives future version bumps cleanly.
 *
 * Scope note (Phase-4 reorg): this repo now holds the CHAIN-level pair only.
 * The former atomic-TRIPLET invariant (kadena-stoic-legacy + stoa-core +
 * ouronet-core all at one version) is now an atomic PAIR — ouronet-core moved
 * to OuroborosNetwork/ouronet-libs as @ouronet/ouronet-core and carries its own
 * independent version line, consuming this repo's packages from npm. Asserting
 * a shared version across that boundary would be wrong, so it is deliberately
 * absent.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("cross-package version-pin consistency", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");

  const ksl = JSON.parse(readFileSync(resolve(repoRoot, "packages/kadena-stoic-legacy/package.json"), "utf8"));
  const stoa = JSON.parse(readFileSync(resolve(repoRoot, "packages/stoa-core/package.json"), "utf8"));

  it("both packages share the same version (atomic-pair invariant)", () => {
    expect(stoa.version).toBe(ksl.version);
  });

  it("stoa-core's @stoachain/kadena-stoic-legacy peer-dep matches kadena-stoic-legacy version", () => {
    const peer = stoa.peerDependencies?.["@stoachain/kadena-stoic-legacy"];
    expect(peer).toBe(ksl.version);
  });

  it("that peer-dep is an EXACT pin, not a range", () => {
    const peer = stoa.peerDependencies?.["@stoachain/kadena-stoic-legacy"];
    expect(peer).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("@scure/bip39 peer-dep is identical across kadena-stoic-legacy + stoa-core", () => {
    const kslBip39 = ksl.peerDependencies?.["@scure/bip39"];
    const stoaBip39 = stoa.peerDependencies?.["@scure/bip39"];
    expect(kslBip39).toBe(stoaBip39);
  });

  // The dependency direction with ouronet-libs is one-way: ouronet-libs -> here.
  // This locks that direction. Note it targets the ouronet-libs packages by name
  // rather than the whole @ouronet scope: @ouronet/dalos-crypto is a foundational
  // cryptography library that sits BELOW stoa-core, and stoa-core depends on it
  // legitimately — the scope a package is published under does not by itself say
  // which layer it occupies.
  it("no package here depends on an ouronet-libs package (one-way dependency direction)", () => {
    const forbidden = ["@ouronet/ouronet-core", "@ouronet/ouronet-codex"];
    for (const pkg of [ksl, stoa]) {
      const every = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.peerDependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      const found = Object.keys(every).filter((n) => forbidden.includes(n));
      expect(found, `${pkg.name} must not depend on ouronet-libs: ${found.join(", ")}`).toEqual([]);
    }
  });
});
