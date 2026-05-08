/**
 * REQ-18 (F-ARCH-013): GAS_LIMIT_COLORS public-export invariant lock.
 *
 * Per Phase 3 D-001/P-001 override, the GAS_LIMIT_COLORS export is KEPT
 * (not removed) and marked @public. This test locks the invariant: no
 * internal stoa-core/ouronet-core source file imports GAS_LIMIT_COLORS.
 * If the lock test ever fails, an internal consumer was added — that
 * consumer should either justify the import or be refactored to use
 * the value as a parameter.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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
    const stoaSrc = resolve(repoRoot, "packages/stoa-core/src");
    const ouronetSrc = resolve(repoRoot, "packages/ouronet-core/src");
    const files = [...walkSrc(stoaSrc), ...walkSrc(ouronetSrc)];
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
