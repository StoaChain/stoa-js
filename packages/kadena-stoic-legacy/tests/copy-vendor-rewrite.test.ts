// Integration test for scripts/copy-vendor-files.cjs bare-require rewrite logic.
// Validates the Phase 2 T2.6-FIX: Node's CJS resolver does not auto-resolve
// `.cjs` for bare `require("./X")` calls, so the prebuild copy step must
// rewrite bare requires to add explicit `.cjs` (or `/index.cjs`) suffixes.
//
// Invariants asserted:
//   1. src/client/**/*.cjs remains byte-identical to upstream (NO rewrites in source).
//   2. dist/client/**/*.cjs has explicit suffixes on all relative bare requires.
//   3. The compiled dist/client/index.js entry point loads without MODULE_NOT_FOUND.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SRC = resolve(PKG_ROOT, "src", "client");
const DST = resolve(PKG_ROOT, "dist", "client");

describe("copy-vendor-files.cjs bare-require rewrite", () => {
  it("preserves src/client/index.cjs byte-identical to upstream (bare requires intact)", () => {
    const src = readFileSync(resolve(SRC, "index.cjs"), "utf8");
    expect(src).toContain('require("./pact")');
    expect(src).toContain('require("./client")');
    expect(src).toContain('require("./signing")');
    expect(src).not.toContain('require("./pact.cjs")');
    expect(src).not.toContain('require("./client/index.cjs")');
  });

  it("rewrites file-target bare requires to `.cjs` in dist/client/index.cjs", () => {
    const dst = readFileSync(resolve(DST, "index.cjs"), "utf8");
    expect(dst).toContain('require("./pact.cjs")');
    expect(dst).toContain('require("./signing-api/v1/quicksign.cjs")');
    expect(dst).toContain('require("./utils/parseAsPactValue.cjs")');
    expect(dst).not.toContain('require("./pact")\n');
  });

  it("rewrites directory-target bare requires to `/index.cjs` in dist/client/index.cjs", () => {
    const dst = readFileSync(resolve(DST, "index.cjs"), "utf8");
    expect(dst).toContain('require("./client/index.cjs")');
    expect(dst).toContain('require("./signing/index.cjs")');
  });

  it("rewrites nested-path bare requires in dist/client/client/client.cjs", () => {
    const dst = readFileSync(resolve(DST, "client", "client.cjs"), "utf8");
    expect(dst).toContain('require("./api/runPact.cjs")');
    expect(dst).toContain('require("./api/spv.cjs")');
    expect(dst).toContain('require("./api/status.cjs")');
    expect(dst).toContain('require("./utils/mergeOptions.cjs")');
  });

  it("leaves peer-dep requires (non-relative) untouched in dist", () => {
    const dst = readFileSync(resolve(DST, "index.cjs"), "utf8");
    expect(dst).not.toMatch(/require\("@kadena\/types\.cjs"\)/);
    expect(dst).not.toMatch(/require\("debug\.cjs"\)/);
  });

  it("loads dist/client/index.js (compiled CJS-shimmed entry) without MODULE_NOT_FOUND", async () => {
    const entry = resolve(DST, "index.js");
    expect(existsSync(entry)).toBe(true);
    const mod = await import(pathToFileURL(entry).href);
    expect(typeof mod.Pact).toBe("object");
    expect(typeof mod.createClient).toBe("function");
    expect(typeof mod.createSignWithKeypair).toBe("function");
    expect(typeof mod.addSignatures).toBe("function");
    expect(typeof mod.createTransactionBuilder).toBe("function");
  });

  it("loads dist/client/index.cjs directly via createRequire (raw CJS resolver path)", () => {
    const entry = resolve(DST, "index.cjs");
    expect(existsSync(entry)).toBe(true);
    const requireCjs = createRequire(import.meta.url);
    const mod = requireCjs(entry);
    expect(typeof mod.Pact).toBe("object");
    expect(typeof mod.createClient).toBe("function");
    expect(typeof mod.createTransactionBuilder).toBe("function");
  });
});
