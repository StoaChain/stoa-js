/**
 * smart-account-auth.test.ts — Tier 1, Group A from the testing
 * strategy doc.
 *
 * Covers the v1.6.0 additions in `src/guard/smartAccountAuth.ts`:
 *
 *   - `classifyGuardKind`   — pure shape discriminator
 *   - `extractKeysetFromGuard` — keyset payload pulling
 *   - `analyzeSmartAccountAuthPaths` — three-branch summary
 *
 * The discriminator's truth-table has to match OuronetUI's
 * `<GuardTree>` 1:1 — these tests pin the contract so future
 * additions can't drift the two apart.
 */

import { describe, it, expect } from "vitest";
import {
  classifyGuardKind,
  extractKeysetFromGuard,
  analyzeSmartAccountAuthPaths,
  normalizeKeysetRef,
} from "../src/guard/smartAccountAuth";

// ─── Fixture guards (one of each shape) ─────────────────────────────────────

const KEYSET = {
  pred: "keys-all",
  keys: ["pubA", "pubB"],
};

const KEYSET_REF_UNRESOLVED = {
  keysetref: { ns: "ouronet-ns", ksn: "dh_sc_dpdc-keyset" },
};

const CAPABILITY_GUARD = {
  cgName: "ouronet-ns.MOD.CAP_X",
  cgArgs: ["arg1", 42],
  cgPactId: null,
};

const USER_GUARD = {
  fun: "ouronet-ns.MOD.UEV_Any",
  args: ["acc-1", "acc-2"],
};

// ─── classifyGuardKind ─────────────────────────────────────────────────────

describe("classifyGuardKind", () => {
  it("recognises an inline keyset", () => {
    expect(classifyGuardKind(KEYSET)).toBe("keyset");
  });
  it("recognises an unresolved keyset-ref", () => {
    expect(classifyGuardKind(KEYSET_REF_UNRESOLVED)).toBe("keyset-ref");
  });
  it("recognises a capability guard", () => {
    expect(classifyGuardKind(CAPABILITY_GUARD)).toBe("capability");
  });
  it("recognises a user guard", () => {
    expect(classifyGuardKind(USER_GUARD)).toBe("user");
  });

  it("returns 'unknown' for null / undefined", () => {
    expect(classifyGuardKind(null)).toBe("unknown");
    expect(classifyGuardKind(undefined)).toBe("unknown");
  });
  it("returns 'unknown' for primitives and arrays", () => {
    expect(classifyGuardKind("plain string")).toBe("unknown");
    expect(classifyGuardKind(42)).toBe("unknown");
    expect(classifyGuardKind(true)).toBe("unknown");
    expect(classifyGuardKind([1, 2, 3])).toBe("unknown");
  });
  it("returns 'unknown' for objects with no recognised discriminator field", () => {
    expect(classifyGuardKind({ random: "shape" })).toBe("unknown");
  });

  it("orders specificity: capability > user > keyset-ref > keyset", () => {
    // Defensive: a guard carrying both cgName and pred (impossible in
    // practice but easy to construct) must classify as the more
    // specific 'capability'. Mirrors GuardTree's order.
    const overlap = { cgName: "x", cgArgs: [], cgPactId: null, pred: "p", keys: [] };
    expect(classifyGuardKind(overlap)).toBe("capability");
  });
});

// ─── classifyGuardKind — minimal-shape tightening ──────────────────────────

describe("classifyGuardKind — minimal-shape tightening", () => {
  it("classifies under-specified capability guard (missing cgArgs) as unknown", () => {
    expect(classifyGuardKind({ cgName: "ouronet-ns.MOD.CAP_X" })).toBe("unknown");
  });

  it("classifies under-specified capability guard (missing cgPactId) as unknown", () => {
    expect(classifyGuardKind({ cgName: "x", cgArgs: [] })).toBe("unknown");
  });

  it("classifies fully-shaped capability guard correctly (regression)", () => {
    expect(classifyGuardKind({ cgName: "x", cgArgs: ["a"], cgPactId: null })).toBe("capability");
    expect(classifyGuardKind({ cgName: "x", cgArgs: ["a"], cgPactId: "pact-id-123" })).toBe("capability");
  });

  it("classifies under-specified user guard (missing args) as unknown", () => {
    expect(classifyGuardKind({ fun: "ouronet-ns.MOD.UEV_Any" })).toBe("unknown");
  });

  it("classifies user guard with explicit undefined args as unknown", () => {
    expect(classifyGuardKind({ fun: "x", args: undefined })).toBe("unknown");
  });

  it("classifies under-specified keyset guard (missing keys) as unknown", () => {
    expect(classifyGuardKind({ pred: "keys-all" })).toBe("unknown");
  });

  it("classifies keyset guard with non-array keys as unknown", () => {
    expect(classifyGuardKind({ pred: "keys-all", keys: "not-an-array" })).toBe("unknown");
  });

  it("accepts camelCase keysetRef as keyset-ref", () => {
    expect(classifyGuardKind({ keysetRef: { ns: "ouronet-ns", ksn: "foo" } })).toBe("keyset-ref");
  });

  it("accepts lowercase keysetref as keyset-ref (chain-native casing)", () => {
    expect(classifyGuardKind({ keysetref: { ns: "ouronet-ns", ksn: "foo" } })).toBe("keyset-ref");
  });
});

// ─── normalizeKeysetRef ─────────────────────────────────────────────────────

describe("normalizeKeysetRef", () => {
  it("adds camelCase keysetRef when only lowercase keysetref is present", () => {
    const input = { keysetref: { ns: "ouronet-ns", ksn: "foo" } };
    const result = normalizeKeysetRef(input) as Record<string, unknown>;
    expect(result.keysetref).toEqual({ ns: "ouronet-ns", ksn: "foo" });
    expect(result.keysetRef).toEqual({ ns: "ouronet-ns", ksn: "foo" });
  });

  it("does not mutate the original input (pure function)", () => {
    const input: Record<string, unknown> = { keysetref: { ns: "x", ksn: "y" } };
    normalizeKeysetRef(input);
    expect(Object.keys(input).sort()).toEqual(["keysetref"]);
    expect(input.keysetRef).toBeUndefined();
  });

  it("returns input unchanged when keysetRef is already present", () => {
    const input = { keysetRef: { ns: "x", ksn: "y" } };
    expect(normalizeKeysetRef(input)).toBe(input);
  });

  it("returns input unchanged for null / undefined / primitives / arrays", () => {
    expect(normalizeKeysetRef(null)).toBeNull();
    expect(normalizeKeysetRef(undefined)).toBeUndefined();
    expect(normalizeKeysetRef("string")).toBe("string");
    expect(normalizeKeysetRef(42)).toBe(42);
    const arr = [1, 2];
    expect(normalizeKeysetRef(arr)).toBe(arr);
  });

  it("preserves other fields when adding keysetRef", () => {
    const input = { keysetref: { ns: "a", ksn: "b" }, extra: "preserve-me" };
    const result = normalizeKeysetRef(input) as Record<string, unknown>;
    expect(result.extra).toBe("preserve-me");
    expect(result.keysetRef).toEqual({ ns: "a", ksn: "b" });
  });
});

// ─── extractKeysetFromGuard ─────────────────────────────────────────────────

describe("extractKeysetFromGuard", () => {
  it("returns the keyset for an inline keyset guard", () => {
    expect(extractKeysetFromGuard(KEYSET)).toEqual({ pred: "keys-all", keys: ["pubA", "pubB"] });
  });
  it("preserves keysetRef field when present (resolved keyset-ref)", () => {
    const resolved = { pred: "keys-2", keys: ["x", "y", "z"], keysetRef: "ouronet-ns.foo-keyset" };
    expect(extractKeysetFromGuard(resolved)).toEqual({
      pred: "keys-2",
      keys: ["x", "y", "z"],
      keysetRef: "ouronet-ns.foo-keyset",
    });
  });
  it("returns null for unresolved keyset-refs", () => {
    expect(extractKeysetFromGuard(KEYSET_REF_UNRESOLVED)).toBeNull();
  });
  it("returns null for capability and user guards", () => {
    expect(extractKeysetFromGuard(CAPABILITY_GUARD)).toBeNull();
    expect(extractKeysetFromGuard(USER_GUARD)).toBeNull();
  });
  it("returns null for null / undefined / primitives", () => {
    expect(extractKeysetFromGuard(null)).toBeNull();
    expect(extractKeysetFromGuard(undefined)).toBeNull();
    expect(extractKeysetFromGuard("not a guard")).toBeNull();
  });
});

// ─── analyzeSmartAccountAuthPaths ───────────────────────────────────────────

describe("analyzeSmartAccountAuthPaths", () => {
  const codex = new Set<string>(["pubA"]);

  it("returns three branches in canonical order", () => {
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: KEYSET, sovereignGuard: KEYSET, governor: KEYSET },
      codex,
    );
    expect(r.branches).toHaveLength(3);
    expect(r.branches[0].which).toBe("guard");
    expect(r.branches[1].which).toBe("sovereign");
    expect(r.branches[2].which).toBe("governor");
  });

  it("classifies a mixed Smart account: keyset / keyset / user-guard", () => {
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: KEYSET, sovereignGuard: KEYSET, governor: USER_GUARD },
      codex,
    );
    expect(r.branches[0].kind).toBe("keyset");
    expect(r.branches[1].kind).toBe("keyset");
    expect(r.branches[2].kind).toBe("user");
    expect(r.branches[0].keyBased).toBe(true);
    expect(r.branches[1].keyBased).toBe(true);
    expect(r.branches[2].keyBased).toBe(false);
  });

  it("runs analyzeGuard on key-based branches and leaves the rest as null", () => {
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: KEYSET, sovereignGuard: USER_GUARD, governor: CAPABILITY_GUARD },
      codex,
    );
    expect(r.branches[0].analysis).not.toBeNull();
    expect(r.branches[0].analysis?.codexKeys).toEqual(["pubA"]);
    expect(r.branches[1].analysis).toBeNull();
    expect(r.branches[2].analysis).toBeNull();
  });

  it("computes anyKeyBased correctly", () => {
    expect(
      analyzeSmartAccountAuthPaths(
        { accountGuard: USER_GUARD, sovereignGuard: CAPABILITY_GUARD, governor: USER_GUARD },
        codex,
      ).anyKeyBased,
    ).toBe(false);

    expect(
      analyzeSmartAccountAuthPaths(
        { accountGuard: USER_GUARD, sovereignGuard: KEYSET, governor: CAPABILITY_GUARD },
        codex,
      ).anyKeyBased,
    ).toBe(true);
  });

  it("computes firstSatisfied = -1 when no branch is satisfied", () => {
    // KEYSET requires both pubA + pubB (keys-all of 2). Codex only has pubA.
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: KEYSET, sovereignGuard: KEYSET, governor: KEYSET },
      new Set(["pubA"]),
    );
    expect(r.firstSatisfied).toBe(-1);
  });

  it("computes firstSatisfied to the earliest satisfied branch", () => {
    // KEYSET keys-all of 2 — satisfied when codex has BOTH keys.
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: USER_GUARD, sovereignGuard: KEYSET, governor: KEYSET },
      new Set(["pubA", "pubB"]),
    );
    // Branch 0 is user-guard (not satisfied — not key-based).
    // Branch 1 is keyset, fully satisfied.
    expect(r.firstSatisfied).toBe(1);
  });

  it("handles null guards (guard fetch failure) as 'unknown' / non-key-based", () => {
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: null, sovereignGuard: undefined, governor: null },
      codex,
    );
    expect(r.branches.every((b) => b.kind === "unknown")).toBe(true);
    expect(r.anyKeyBased).toBe(false);
    expect(r.firstSatisfied).toBe(-1);
  });

  it("threads resolvedManualKeys through to analyzeGuard", () => {
    const r = analyzeSmartAccountAuthPaths(
      { accountGuard: { pred: "keys-all", keys: ["pubA", "pubB"] }, sovereignGuard: USER_GUARD, governor: USER_GUARD },
      new Set(["pubA"]),
      // Manual key for pubB → branch 0 should now be satisfied.
      { pubB: "0".repeat(64) },
    );
    expect(r.branches[0].analysis?.satisfied).toBe(true);
    expect(r.firstSatisfied).toBe(0);
  });

  describe("firstSignableButUnsatisfied (state B index)", () => {
    it("returns the first key-based branch that is unsatisfied (state B)", () => {
      // branch[0] = user-guard (skipped), branch[1] = keyset unsatisfied,
      // branch[2] = keyset unsatisfied. Codex has only pubA but keyset
      // requires both pubA + pubB.
      const r = analyzeSmartAccountAuthPaths(
        { accountGuard: USER_GUARD, sovereignGuard: KEYSET, governor: KEYSET },
        new Set(["pubA"]),
      );
      expect(r.firstSatisfied).toBe(-1);
      expect(r.anyKeyBased).toBe(true);
      expect(r.firstSignableButUnsatisfied).toBe(1);
    });

    it("returns -1 when no branch is key-based (state C/D)", () => {
      const r = analyzeSmartAccountAuthPaths(
        { accountGuard: USER_GUARD, sovereignGuard: USER_GUARD, governor: CAPABILITY_GUARD },
        new Set(["pubA"]),
      );
      expect(r.anyKeyBased).toBe(false);
      expect(r.firstSignableButUnsatisfied).toBe(-1);
    });

    it("returns first key-based unsatisfied even when a later branch is satisfied (state A overlap)", () => {
      // branch[0] = keyset unsatisfied (codex missing pubB), branch[1] = user (skipped),
      // branch[2] = keyset satisfied (codex has pubA via keys-any).
      const r = analyzeSmartAccountAuthPaths(
        {
          accountGuard: KEYSET, // keys-all over [pubA, pubB] - unsatisfied with codex={pubA}
          sovereignGuard: USER_GUARD,
          governor: { pred: "keys-any", keys: ["pubA", "pubB"] }, // keys-any - satisfied with pubA
        },
        new Set(["pubA"]),
      );
      expect(r.firstSatisfied).toBe(2);
      expect(r.firstSignableButUnsatisfied).toBe(0);
    });

    it("returns -1 when every key-based branch is already satisfied", () => {
      const easy = { pred: "keys-any", keys: ["pubA"] };
      const r = analyzeSmartAccountAuthPaths(
        { accountGuard: easy, sovereignGuard: easy, governor: easy },
        new Set(["pubA"]),
      );
      expect(r.firstSatisfied).toBe(0);
      expect(r.firstSignableButUnsatisfied).toBe(-1);
    });
  });
});
