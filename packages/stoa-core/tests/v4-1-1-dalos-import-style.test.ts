import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

describe("REQ-17: dalos source files quote/extension regression-lock (closed v3.3.8 8f92ad8)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dalosDir = resolve(here, "../src/dalos");

  function getDalosFiles(): string[] {
    return readdirSync(dalosDir)
      .filter(f => f.endsWith(".ts") && !f.endsWith(".d.ts"))
      .map(f => join(dalosDir, f));
  }

  it("dalos directory contains expected files (sanity check)", () => {
    const files = getDalosFiles();
    expect(files.length).toBeGreaterThanOrEqual(2); // At least index.ts + account.ts
    expect(files.some(f => f.endsWith("index.ts"))).toBe(true);
  });

  it("no dalos source file uses single-quote import strings", () => {
    const files = getDalosFiles();
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Check import lines specifically — match line-anchored pattern
      const importLines = content.split("\n").filter(line => /^\s*import\b/.test(line));
      for (const line of importLines) {
        expect(line, `${file}: single-quote import detected — ${line}`).not.toMatch(/from '[^']+'/);
      }
    }
  });

  it("no dalos source file imports with `.js` extension in `from` clause", () => {
    const files = getDalosFiles();
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const importLines = content.split("\n").filter(line => /^\s*import\b/.test(line));
      for (const line of importLines) {
        // Match `from "X.js"` or `from 'X.js'` — `.js` extension before closing quote
        expect(line, `${file}: .js extension import detected — ${line}`).not.toMatch(/from\s+["'][^"']+\.js["']/);
      }
    }
  });
});
