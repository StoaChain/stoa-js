/**
 * v3.3.8 — documentation/deprecation cleanup pass regression locks
 * (stoa-core slice).
 *
 * Closes the audit-finding subset that lives in stoa-core code:
 *
 *   F-ARCH-011 — `src/interactions/ouroFunctions.ts:10` deep-imported
 *                `normalizeKeysetRef` from `../guard/smartAccountAuth`
 *                instead of the `../guard` barrel. Fix: consolidated
 *                into the existing barrel import line. Locked at T1
 *                below — verifies the symbol is reachable through
 *                stoa-core's `./guard` barrel and behaves correctly.
 *
 *   F-ARCH-012 — `src/dalos/account.ts` was the only file in `src/`
 *                still using single-quoted string literals (the
 *                `CreateAccountMode` discriminator labels and the
 *                typeof guard string — 19 sites total). Fix:
 *                converted all 19 to double quotes. Locked at T2
 *                below via grep-style assertion that the file
 *                carries no single-quoted string literals (English
 *                apostrophes inside JSDoc comments are exempt).
 *
 * The ouronet-core regression-lock subset (F-API-016 CoilConfig type
 * export) was split out at v4.0.0 to live alongside its SUT in
 * `packages/ouronet-core/tests/v3-3-8-doc-cleanup.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { normalizeKeysetRef } from "../src/guard";

// ══ T1 (F-ARCH-011) ═════════════════════════════════════════════════════════
describe("v3.3.8 — F-ARCH-011 normalizeKeysetRef barrel-import regression-lock", () => {
  it("`normalizeKeysetRef` is reachable through stoa-core `./guard` barrel and round-trips a keysetref-shaped object", () => {
    expect(typeof normalizeKeysetRef).toBe("function");
    // Smoke-call to prove the function works through the barrel —
    // not just that the import resolves. Pass a chain-native
    // lowercase `keysetref` field; v2.x's contract is to normalise
    // that to the camelCase `keysetRef` form.
    const input = { keysetref: { ns: "ouronet-ns", ksn: "test-ks" }, other: "field" };
    // `normalizeKeysetRef` returns `unknown` by design (it's a guard-shape
    // normaliser; consumers narrow per call-site). Cast for the assertion.
    const out = normalizeKeysetRef(input) as { keysetref: { ns: string; ksn: string } };
    expect(out).toBeTruthy();
    expect(out.keysetref).toEqual({ ns: "ouronet-ns", ksn: "test-ks" });
  });
});

// ══ T2 (F-ARCH-012) ═════════════════════════════════════════════════════════
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
