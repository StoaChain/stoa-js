/**
 * REQ-28 (T7.8 catch-up): kadena-stoic-legacy package.json sideEffects: false invariant.
 * Locks the no-side-effects declaration so consumers can tree-shake.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-28: kadena-stoic-legacy sideEffects: false invariant", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8"));

  it("package.json declares sideEffects: false", () => {
    expect(pkg.sideEffects).toBe(false);
  });
});
