import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { SmartAccountAuthPaths } from "../src/guard/smartAccountAuth";
import { analyzeSmartAccountAuthPaths } from "../src/guard/smartAccountAuth";

describe("REQ-15: firstSignableButUnsatisfied required (drop ?:)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../..");

  it("source: NO optional marker on firstSignableButUnsatisfied declaration", () => {
    const file = readFileSync(
      resolve(repoRoot, "packages/stoa-core/src/guard/smartAccountAuth.ts"),
      "utf8",
    );
    // After this change the field must be required — must NOT have `?:` immediately after the field name
    expect(file).not.toMatch(/firstSignableButUnsatisfied\?\s*:/);
    // Must have a non-optional declaration
    expect(file).toMatch(/firstSignableButUnsatisfied\s*:\s*number/);
  });

  it("type-level: SmartAccountAuthPaths.firstSignableButUnsatisfied is `number` (NOT `number | undefined`)", () => {
    expectTypeOf<SmartAccountAuthPaths["firstSignableButUnsatisfied"]>().toEqualTypeOf<number>();
  });

  it("runtime: producer initialises field to -1 sentinel when no signable-unsatisfied branch exists", () => {
    // All branches are non-keyset (user guard / capability guard) — no signable branch, field must be -1
    const userGuard = { fun: "ouronet-ns.MOD.UEV_Any", args: ["acc-1"] };
    const capGuard = { cgName: "ouronet-ns.MOD.CAP_X", cgArgs: [], cgPactId: null };
    const result = analyzeSmartAccountAuthPaths(
      { accountGuard: userGuard, sovereignGuard: userGuard, governor: capGuard },
      new Set<string>(),
    );
    expect(typeof result.firstSignableButUnsatisfied).toBe("number");
    expect(result.firstSignableButUnsatisfied).toBe(-1);
  });

  it("runtime: producer sets field to branch index when a key-based unsatisfied branch exists", () => {
    // branch[1] is the first key-based unsatisfied branch (missing keys not in codex)
    const userGuard = { fun: "ouronet-ns.MOD.UEV_Any", args: ["acc-1"] };
    const keyset = { pred: "keys-all", keys: ["pubA", "pubB"] };
    const result = analyzeSmartAccountAuthPaths(
      { accountGuard: userGuard, sovereignGuard: keyset, governor: keyset },
      new Set(["pubA"]), // codex has only pubA, keys-all needs both
    );
    expect(typeof result.firstSignableButUnsatisfied).toBe("number");
    expect(result.firstSignableButUnsatisfied).toBe(1);
  });
});
