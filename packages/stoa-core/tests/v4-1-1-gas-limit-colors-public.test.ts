/**
 * REQ-18 (F-ARCH-013): GAS_LIMIT_COLORS public-export invariant lock.
 *
 * Per Phase 3 D-001/P-001 override, the GAS_LIMIT_COLORS export is KEPT
 * (not removed) and marked @public. This test locks the invariant: no
 * source file in any package of this workspace imports GAS_LIMIT_COLORS.
 * If the lock test ever fails, an internal consumer was added — that
 * consumer should either justify the import or be refactored to use
 * the value as a parameter.
 *
 * The scan enumerates `packages/*​/src` rather than naming packages, so it
 * stays correct as the workspace roster changes (the Ouronet-level packages
 * left for OuroborosNetwork/ouronet-libs in the Phase-4 reorg; they now
 * consume this value across the published package boundary, where the
 * invariant no longer applies).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

describe("REQ-18: GAS_LIMIT_COLORS invariant locks", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../..");

  function walkSrc(dir: string, results: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(full, results);
      else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts")) {
        results.push(full);
      }
    }
    return results;
  }

  it("GAS_LIMIT_COLORS export remains in gasUtils.ts (not removed)", () => {
    const file = readFileSync(resolve(repoRoot, "packages/stoa-core/src/gas/gasUtils.ts"), "utf8");
    // Match both `export const GAS_LIMIT_COLORS =` and `export const GAS_LIMIT_COLORS: SomeType =`
    expect(file).toMatch(/export const GAS_LIMIT_COLORS[\s\S]*?=\s*\{/);
  });

  it("GAS_LIMIT_COLORS has @public JSDoc tag", () => {
    const file = readFileSync(resolve(repoRoot, "packages/stoa-core/src/gas/gasUtils.ts"), "utf8");
    expect(file).toMatch(/@public[\s\S]+export const GAS_LIMIT_COLORS/);
  });

  it("no internal */src/ consumer imports GAS_LIMIT_COLORS (excluding the declaration itself)", () => {
    const packagesDir = resolve(repoRoot, "packages");
    const srcDirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(packagesDir, e.name, "src"))
      .filter((d) => existsSync(d));
    expect(srcDirs.length, "no packages/*/src directories found to scan").toBeGreaterThan(0);
    const files = srcDirs.flatMap((d) => walkSrc(d));
    const consumers: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Skip the gasUtils.ts declaration site itself
      if (file.endsWith("gasUtils.ts") && content.includes("export const GAS_LIMIT_COLORS")) continue;
      // Look for any import or reference to GAS_LIMIT_COLORS
      if (/\bGAS_LIMIT_COLORS\b/.test(content)) {
        consumers.push(file);
      }
    }
    expect(consumers, `Internal consumers found: ${consumers.join(", ")}`).toEqual([]);
  });
});
