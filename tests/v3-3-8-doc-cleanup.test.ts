/**
 * v3.3.8 — documentation/deprecation cleanup pass regression locks.
 *
 * Closes 5 LOW-severity findings from the 2026-05-05 audit:
 *
 *   F-API-015 — Stale `strict` JSDoc parameter mention in
 *               `src/dalos/account.ts:42-45` referenced a parameter
 *               the `CreateAccountOptions` type union never had.
 *               Fix: rewrote the JSDoc to document the actual
 *               mode-vs-primitive contract (the function throws on
 *               mismatch with no opt-out flag). Pure docstring
 *               change — no runtime regression to lock.
 *
 *   F-API-016 — `CoilConfig` interface used by the exported
 *               `COIL_CONFIGS` constant was itself NOT exported.
 *               Consumers holding a `CoilConfig` value (e.g. from
 *               `COIL_CONFIGS.ouroToAuryn`) could USE it but couldn't
 *               TYPE-ANNOTATE a parameter or local with `CoilConfig`
 *               without re-declaring the shape. Fix: added `export`.
 *               Locked at T1 below.
 *
 *   F-SEC-005 / F-ARCH-014 — `KADENA_BASE_URL` constant was pinned
 *               to `node2.stoachain.com` and bypassed the failover
 *               layer added in v2.1.0. Direct consumers reading the
 *               constant lost node-recovery + node-degradation
 *               handling. Fix: added `@deprecated` JSDoc redirecting
 *               to `getActivePactUrl(chainId)` / `getActiveSpvUrl`
 *               with v4.0.0 removal advisory. Pure JSDoc — no runtime
 *               regression to lock.
 *
 *   F-ARCH-011 — `src/interactions/ouroFunctions.ts:10` deep-imported
 *               `normalizeKeysetRef` from `../guard/smartAccountAuth`
 *               instead of going through the `../guard` barrel.
 *               Inconsistent with the project's subpath-import
 *               discipline (every other consumer goes through the
 *               barrel). Fix: consolidated into the existing
 *               `import { IKeyset, normalizeKeysetRef } from "../guard"`
 *               line. Locked at T2 below — verifies the symbol is
 *               reachable through the barrel (= the import we
 *               consolidated to actually works).
 *
 *   F-ARCH-012 — `src/dalos/account.ts` was the only file in `src/`
 *               using single-quoted string literals (the
 *               `CreateAccountMode` discriminator labels and the
 *               typeof guard string). v3.1.1 fixed `src/dalos/index.ts`
 *               but missed account.ts. Fix: converted all 19
 *               single-quoted string literals to double quotes,
 *               matching the rest of `src/`. Pure stylistic — locked
 *               at T3 below via grep-style assertion that the file
 *               carries no single-quoted string literals (English
 *               apostrophes inside JSDoc comments are exempt).
 *
 * What this file locks (3 it-blocks)
 * ----------------------------------
 *
 *   T1 (F-API-016): the `CoilConfig` interface is reachable as a
 *      type from `../src/interactions/coilFunctions`. The
 *      `expectTypeOf` assertion verifies the type EXPORT — if a
 *      future edit accidentally drops the `export` keyword, this
 *      test fails at typecheck time.
 *
 *   T2 (F-ARCH-011): `normalizeKeysetRef` is reachable through the
 *      `../src/guard` barrel. The barrel-import works at runtime
 *      AND the function behaves correctly (smoke-call with a
 *      keysetref-shaped object). If a future edit removes the
 *      `export *` line in the barrel, this test fails.
 *
 *   T3 (F-ARCH-012): `src/dalos/account.ts` has no single-quoted
 *      string literals. Reads the file source verbatim and asserts
 *      the only single-quote characters are inside JSDoc comments
 *      (English apostrophes like "registry's", "doesn't"). A
 *      future edit that introduces single-quoted string literals
 *      fails the test.
 *
 * F-API-015 (stale JSDoc) and F-SEC-005/F-ARCH-014 (`@deprecated`
 * marker on KADENA_BASE_URL) are pure JSDoc changes that don't
 * surface at runtime — no test added. The CHANGELOG entry is the
 * audit trail.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { CoilConfig, COIL_CONFIGS } from "../src/interactions/coilFunctions";
import { normalizeKeysetRef } from "../src/guard";

// ══ T1 (F-API-016) ══════════════════════════════════════════════════════════
describe("v3.3.8 — F-API-016 CoilConfig type export regression-lock", () => {
  it("CoilConfig is exported as a type from `@stoachain/ouronet-core/interactions/coilFunctions`", () => {
    // The import line above resolves CoilConfig as a type. If the
    // `export` keyword on the interface is dropped, TS errors out
    // at typecheck time (the test file fails to compile). Runtime
    // assertion is just belt-and-suspenders that the COIL_CONFIGS
    // values still match the shape — exercises the type by usage.
    const sample: CoilConfig = COIL_CONFIGS.ouroToAuryn;
    expectTypeOf<CoilConfig>().toEqualTypeOf<{
      atsPair: string;
      sourceToken: string;
      targetToken: string;
      previewCommand: string;
    }>();
    expect(typeof sample.atsPair).toBe("string");
    expect(typeof sample.sourceToken).toBe("string");
    expect(typeof sample.targetToken).toBe("string");
    expect(typeof sample.previewCommand).toBe("string");
  });
});

// ══ T2 (F-ARCH-011) ═════════════════════════════════════════════════════════
describe("v3.3.8 — F-ARCH-011 normalizeKeysetRef barrel-import regression-lock", () => {
  it("`normalizeKeysetRef` is reachable through `../src/guard` barrel and round-trips a keysetref-shaped object", () => {
    expect(typeof normalizeKeysetRef).toBe("function");
    // Smoke-call to prove the function works through the barrel —
    // not just that the import resolves. Pass a chain-native
    // lowercase `keysetref` field; v2.x's contract is to normalise
    // that to the camelCase `keysetRef` form.
    const input = { keysetref: { ns: "ouronet-ns", ksn: "test-ks" }, other: "field" };
    const out = normalizeKeysetRef(input);
    expect(out).toBeTruthy();
    expect(out.keysetref).toEqual({ ns: "ouronet-ns", ksn: "test-ks" });
  });
});

// ══ T3 (F-ARCH-012) ═════════════════════════════════════════════════════════
describe("v3.3.8 — F-ARCH-012 src/dalos/account.ts quote-style regression-lock", () => {
  it("contains no single-quoted string literals (English apostrophes in JSDoc are exempt)", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const accountTsPath = resolve(__dirname, "..", "src", "dalos", "account.ts");
    const source = readFileSync(accountTsPath, "utf8");
    const lines = source.split("\n");

    // Strategy: walk each line, strip the JSDoc/single-line comment
    // portion, then assert no single-quote characters remain in the
    // code-only portion.
    //
    // Rules:
    //   - Lines starting with `*` (block comment continuation) or `//`
    //     are pure comments — skip entirely.
    //   - Lines starting with `/**` (block comment open) — skip.
    //   - Lines containing `*/` (block comment close, possibly inline
    //     code after) — handled below.
    //   - Otherwise the line is code; assert no `'` characters in the
    //     code portion (any inline `//` strips trailing comment).
    const violations: { line: number; text: string }[] = [];
    let inBlockComment = false;
    for (let i = 0; i < lines.length; i += 1) {
      let line = lines[i];

      // Track block-comment state (very simple — assumes well-formed
      // JSDoc; account.ts has only top-of-file + per-export blocks).
      const trimmed = line.trim();
      if (trimmed.startsWith("/**") || trimmed.startsWith("/*")) {
        inBlockComment = !trimmed.includes("*/");
        continue;
      }
      if (inBlockComment) {
        if (trimmed.includes("*/")) inBlockComment = false;
        continue;
      }
      if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;

      // Strip trailing single-line comment if present.
      const commentIdx = line.indexOf("//");
      if (commentIdx >= 0) line = line.slice(0, commentIdx);

      if (line.includes("'")) {
        violations.push({ line: i + 1, text: line.trim() });
      }
    }

    expect(violations).toEqual([]);
  });
});
