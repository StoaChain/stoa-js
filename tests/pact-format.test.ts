/**
 * Pact-format helpers + code-template snapshot tests.
 *
 * Moved from OuronetUI to @stoachain/ouronet-core in Phase 2a along with
 * their subjects: formatDecimalForPact, mayComeWithDeimal, filterFreePositionData.
 *
 * Pact-code-template snapshots lock in the exact templates used by the
 * builders in src/kadena/interactions/*.ts (still in OuronetUI until Phase 2b,
 * but their format-contract lives in core from this phase onward).
 */

import { describe, it, expect } from "vitest";
import {
  formatDecimalForPact,
  formatIntegerForPact,
  mayComeWithDeimal,
  filterFreePositionData,
  type ValidatedDecimal,
  type ValidatedInteger,
} from "../src/pact";
import { KADENA_NAMESPACE } from "../src/constants";

// ══ formatDecimalForPact ══════════════════════════════════════════════════════
describe("formatDecimalForPact", () => {
  describe("integer inputs — add .0 so Pact treats as decimal", () => {
    it("'0' → '0.0'", () => {
      expect(formatDecimalForPact("0")).toBe("0.0");
    });
    it("'1' → '1.0'", () => {
      expect(formatDecimalForPact("1")).toBe("1.0");
    });
    it("'1234567890' → '1234567890.0'", () => {
      expect(formatDecimalForPact("1234567890")).toBe("1234567890.0");
    });
  });

  describe("decimal inputs — passed through if within maxDecimals", () => {
    it("'1.5' → '1.5'", () => {
      expect(formatDecimalForPact("1.5")).toBe("1.5");
    });
    it("'0.1' → '0.1'", () => {
      expect(formatDecimalForPact("0.1")).toBe("0.1");
    });
    it("'123.456789' → '123.456789' (6 decimals, under 24-default)", () => {
      expect(formatDecimalForPact("123.456789")).toBe("123.456789");
    });
    it("trailing-dot '1.' → '1.' (matches the regex, passed through)", () => {
      // Current regex allows \d+\.?\d* which permits "1."
      expect(formatDecimalForPact("1.")).toBe("1.");
    });
  });

  describe("excess decimals — TRUNCATE (not round) to maxDecimals", () => {
    it("default 24-decimal cap preserves 24 and drops the rest", () => {
      const input = "1.123456789012345678901234567890";  // 30 decimals
      expect(formatDecimalForPact(input)).toBe("1.123456789012345678901234");
    });

    it("custom maxDecimals lower than natural length → truncated there", () => {
      expect(formatDecimalForPact("1.123456789", 4)).toBe("1.1234");
    });

    it("truncates, does NOT round (1.9999 with cap 2 → 1.99, not 2.00)", () => {
      expect(formatDecimalForPact("1.9999", 2)).toBe("1.99");
    });
  });

  describe("validation — rejects malformed input", () => {
    it("throws on alphabetic characters", () => {
      expect(() => formatDecimalForPact("abc")).toThrow("Invalid decimal format");
      expect(() => formatDecimalForPact("1.5x")).toThrow();
    });

    it("throws on negative numbers", () => {
      expect(() => formatDecimalForPact("-1.5")).toThrow();
    });

    it("throws on scientific notation (Pact doesn't accept it)", () => {
      expect(() => formatDecimalForPact("1e10")).toThrow();
      expect(() => formatDecimalForPact("1.5E-3")).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => formatDecimalForPact("")).toThrow();
    });

    it("throws on double-dot garbage", () => {
      expect(() => formatDecimalForPact("1..5")).toThrow();
      expect(() => formatDecimalForPact("1.5.5")).toThrow();
    });
  });

  describe("whitespace handling — trims input", () => {
    it("strips leading/trailing whitespace", () => {
      expect(formatDecimalForPact("  1.5  ")).toBe("1.5");
      expect(formatDecimalForPact("\t100\n")).toBe("100.0");
    });
  });

  // Pin the four documented edge-case behaviors of the regex `/^\d+\.?\d*$/`.
  // Each it-block locks one observable contract that consumers (UI + HUB) rely on:
  // any future change to the regex MUST update these assertions deliberately.
  describe("documented edge cases — regex contract pinning", () => {
    it("rejects scientific notation 'e' suffix — Pact lexer has no exponent form", () => {
      expect(() => formatDecimalForPact("1e10")).toThrow("Invalid decimal format");
    });

    it("preserves leading zeros — '007.5' passes regex and returns unchanged", () => {
      // Regex `/^\d+\.?\d*$/` matches any digit run; no leading-zero stripping.
      // Pact's lexer accepts "007.5" as a decimal; consumer-side normalization
      // is the caller's responsibility, not this helper's.
      expect(formatDecimalForPact("007.5")).toBe("007.5");
    });

    it("preserves trailing zeros under maxDecimals — '1.500' returned verbatim", () => {
      // Three trailing zeros, well under the 24-decimal default cap, so the
      // truncate branch is skipped and `trimmed` is returned as-is. Trailing
      // zeros carry precision intent on-chain; do not silently strip them.
      expect(formatDecimalForPact("1.500")).toBe("1.500");
    });
  });

  // ── v3.2.0+ comma-as-decimal-separator support ────────────────────────────
  describe("v3.2.0+ — single comma normalised to period (EU-locale UI input)", () => {
    it("'1,5' → '1.5' (single comma normalised)", () => {
      expect(formatDecimalForPact("1,5")).toBe("1.5");
    });
    it("'0,9' → '0.9' (single comma normalised)", () => {
      expect(formatDecimalForPact("0,9")).toBe("0.9");
    });
    it("'1234,567890' → '1234.567890' (long fractional preserved)", () => {
      expect(formatDecimalForPact("1234,567890")).toBe("1234.567890");
    });
    it("rejects mixed comma+period — '1,5.6' is ambiguous", () => {
      expect(() => formatDecimalForPact("1,5.6")).toThrow("Invalid decimal format");
    });
    it("rejects thousand-separator-style multi-comma — '1,234,567'", () => {
      // A consumer that ships thousand-separated UI text must strip the
      // grouping before calling this helper; we don't guess at locales.
      expect(() => formatDecimalForPact("1,234,567")).toThrow("Invalid decimal format");
    });
    it("rejects mixed period+comma where comma is grouping — '1.234,56'", () => {
      // EU "1.234,56" (one-thousand-two-hundred-and-thirty-four point fifty-
      // six) is parsed by parseEU separately; format*ForPact requires the
      // already-clean digit form.
      expect(() => formatDecimalForPact("1.234,56")).toThrow("Invalid decimal format");
    });
  });

  // ── v3.2.0+ arbitrary-precision contract ──────────────────────────────────
  describe("v3.2.0+ — arbitrary-precision strings round-trip byte-identical", () => {
    it("preserves a 50-digit integer-shape (would overflow float64)", () => {
      // 2^53 is ~9.0e15; this value is far past safe-integer territory.
      // A parseFloat round-trip would silently truncate.
      const huge = "12312419843287492374257983275498759437593";
      expect(formatDecimalForPact(huge)).toBe(`${huge}.0`);
    });
    it("preserves a 39-digit-int + 38-digit-fractional decimal at maxDecimals=999", () => {
      // The integer side has 39 digits (well past 2^53) — string handling
      // preserves it. The fractional has 38 digits; the default maxDecimals
      // is 24 (would truncate), so we pass 999 to demonstrate that the
      // truncation is a deliberate cap, NOT a precision-loss artifact.
      // Pact decimals are arbitrary-precision; the consumer chooses the cap.
      const huge = "308948325783475835674896548964586458654.42389754354398523984543985348925389";
      expect(formatDecimalForPact(huge, 999)).toBe(huge);
    });
    it("default maxDecimals=24 truncates rather than rounds (v3.0.0+ contract)", () => {
      // Pre-existing contract: truncate (not round) so the value the chain
      // sees is always ≤ the user's intent. Lock this here alongside the
      // arbitrary-precision tests for clarity.
      const longFrac = "1.42389754354398523984543985348925389";
      // Fractional after dot is 35 digits; default cap is 24.
      expect(formatDecimalForPact(longFrac)).toBe("1.423897543543985239845439");
    });
    it("preserves digit-precision past float64's 15-17 significant-digit window", () => {
      // 1.0000000000000001 (16 significant figures) round-trips through
      // parseFloat as 1 (precision lost). format*ForPact preserves it.
      const subtle = "1.0000000000000001";
      expect(formatDecimalForPact(subtle)).toBe(subtle);
    });
  });
});

// ══ formatIntegerForPact (v3.2.0+) ═══════════════════════════════════════════
describe("formatIntegerForPact — integer-string canonicalisation", () => {
  describe("happy path", () => {
    it("'0' → '0'", () => {
      expect(formatIntegerForPact("0")).toBe("0");
    });
    it("'1' → '1'", () => {
      expect(formatIntegerForPact("1")).toBe("1");
    });
    it("'1234567890' → '1234567890'", () => {
      expect(formatIntegerForPact("1234567890")).toBe("1234567890");
    });
    it("trims leading/trailing whitespace", () => {
      expect(formatIntegerForPact("  42  ")).toBe("42");
    });
    it("preserves leading zeros (Pact accepts '007')", () => {
      expect(formatIntegerForPact("007")).toBe("007");
    });
  });

  describe("arbitrary-precision contract", () => {
    it("preserves a 41-digit integer (well past 2^53 - 1)", () => {
      // Pact integers are arbitrary-precision; JS `Number()` would
      // collapse this to scientific-notation float at this length.
      const huge = "12312419843287492374257983275498759437593";
      expect(formatIntegerForPact(huge)).toBe(huge);
    });
    it("preserves a 100-digit integer", () => {
      const massive = "9".repeat(100);
      expect(formatIntegerForPact(massive)).toBe(massive);
    });
  });

  describe("rejection cases — strict integer regex", () => {
    it("rejects decimal point", () => {
      expect(() => formatIntegerForPact("1.0")).toThrow("Invalid integer format");
    });
    it("rejects bare period", () => {
      expect(() => formatIntegerForPact("1.")).toThrow("Invalid integer format");
    });
    it("rejects empty string", () => {
      expect(() => formatIntegerForPact("")).toThrow("Invalid integer format");
    });
    it("rejects negative sign — chain integers are non-negative", () => {
      expect(() => formatIntegerForPact("-5")).toThrow("Invalid integer format");
    });
    it("rejects positive sign — leading '+' not part of Pact integer literal", () => {
      expect(() => formatIntegerForPact("+5")).toThrow("Invalid integer format");
    });
    it("rejects scientific notation", () => {
      expect(() => formatIntegerForPact("1e10")).toThrow("Invalid integer format");
    });
    it("rejects comma as decimal separator (use formatDecimalForPact for decimals)", () => {
      expect(() => formatIntegerForPact("1,5")).toThrow("Invalid integer format");
    });
    it("rejects letters / non-digit characters", () => {
      expect(() => formatIntegerForPact("1abc")).toThrow("Invalid integer format");
    });
    it("rejects whitespace within the number", () => {
      expect(() => formatIntegerForPact("1 000")).toThrow("Invalid integer format");
    });
  });
});

// ══ ValidatedDecimal / ValidatedInteger brand types (v3.2.0+) ═══════════════
describe("brand types — type-level validation passthrough", () => {
  it("formatDecimalForPact return value is assignable to ValidatedDecimal", () => {
    // Compile-time check: a function declared `(x: ValidatedDecimal) => string`
    // must accept the formatter's return value without `as` casting. The
    // runtime body only proves the value is the expected string.
    const v: ValidatedDecimal = formatDecimalForPact("1.5");
    const consume = (d: ValidatedDecimal): string => d;
    expect(consume(v)).toBe("1.5");
  });

  it("formatIntegerForPact return value is assignable to ValidatedInteger", () => {
    const v: ValidatedInteger = formatIntegerForPact("42");
    const consume = (i: ValidatedInteger): string => i;
    expect(consume(v)).toBe("42");
  });

  it("ValidatedDecimal and ValidatedInteger are distinct types", () => {
    // Compile-time check: the brands are distinct, so a `ValidatedInteger`
    // cannot be passed where `ValidatedDecimal` is expected (and vice versa)
    // without a deliberate cast. This locks in the lexer-level int vs decimal
    // distinction at the type boundary.
    const dec: ValidatedDecimal = formatDecimalForPact("1.5");
    const int: ValidatedInteger = formatIntegerForPact("42");
    // @ts-expect-error — ValidatedInteger is not assignable to ValidatedDecimal
    const _x: ValidatedDecimal = int;
    // @ts-expect-error — ValidatedDecimal is not assignable to ValidatedInteger
    const _y: ValidatedInteger = dec;
    expect(dec).toBe("1.5");
    expect(int).toBe("42");
  });
});

// ══ mayComeWithDeimal ════════════════════════════════════════════════════════
describe("mayComeWithDeimal — unwrap Pact {decimal: ...} object", () => {
  it("unwraps a Pact decimal object", () => {
    expect(mayComeWithDeimal({ decimal: "123.456" })).toBe("123.456");
  });

  it("returns the value as-is when not wrapped", () => {
    expect(mayComeWithDeimal("123.456")).toBe("123.456");
    expect(mayComeWithDeimal(42)).toBe(42);
  });

  it("handles null/undefined without throwing", () => {
    expect(mayComeWithDeimal(null)).toBe(null);
    expect(mayComeWithDeimal(undefined)).toBe(undefined);
  });

  it("passes through objects without 'decimal' key unchanged", () => {
    const obj = { foo: "bar" };
    expect(mayComeWithDeimal(obj)).toBe(obj);
  });

  it("unwraps even when decimal field is falsy (current behavior)", () => {
    expect(mayComeWithDeimal({ decimal: "0" })).toBe("0");
    expect(mayComeWithDeimal({ decimal: 0 })).toBe(0);
  });
});

// ══ filterFreePositionData ═══════════════════════════════════════════════════
describe("filterFreePositionData — 'no positions' sentinel normalisation", () => {
  it("passes through non-sentinel arrays unchanged", () => {
    const real = [{ "reward-tokens": ["OURO", "AURYN"], balance: "1.5" }];
    expect(filterFreePositionData(real)).toBe(real);
  });

  it("passes through multi-row arrays even when one looks like the sentinel", () => {
    const input = [
      { "reward-tokens": [0] },
      { "reward-tokens": ["OURO"], balance: "1.0" },
    ];
    expect(filterFreePositionData(input)).toBe(input);
  });

  it("replaces a single-row reward-tokens=[0] sentinel with an empty array", () => {
    const input = [{ "reward-tokens": [0] }];
    expect(filterFreePositionData(input)).toEqual([]);
  });

  it("passes through a single row with real content unchanged", () => {
    const input = [{ "reward-tokens": ["OURO"], balance: "0.1" }];
    expect(filterFreePositionData(input)).toBe(input);
  });

  it("passes through a single row with reward-tokens of non-zero content", () => {
    const input = [{ "reward-tokens": [1] }];
    expect(filterFreePositionData(input)).toBe(input);
  });

  it("passes through a single row missing reward-tokens entirely", () => {
    const input = [{ balance: "0.1" }];
    expect(filterFreePositionData(input)).toBe(input);
  });

  it("passes through an empty array unchanged", () => {
    const input: any[] = [];
    expect(filterFreePositionData(input)).toBe(input);
  });
});

// ══ Pact code template snapshots ══════════════════════════════════════════════
//
// Explicit strings reconstructing the templates used by OuronetUI's Pact
// builders (src/kadena/interactions/*.ts). Any drift in argument order,
// function name, or whitespace → assertion fails at CI instead of silently
// on-chain.
describe("Pact code templates — snapshot format assertions", () => {
  const PATRON = "k:aaaa0000";
  const COILER = "OU_Stoa_x";
  const CURLER = "OU_Stoa_y";
  const ATS    = "Auryndex-O136CBn22ncY";
  const ATS2   = "EliteAuryndex-O136CBn22ncY";
  const RT     = "OURO-8Nh-JO8JO4F5";
  const AMOUNT = "1.5";

  it("C_Coil template", () => {
    const decimal = formatDecimalForPact(AMOUNT);
    const pactCode =
      `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Coil "${PATRON}" "${COILER}" "${ATS}" "${RT}" ${decimal})`;
    expect(pactCode).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Coil "k:aaaa0000" "OU_Stoa_x" "Auryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" 1.5)`
    );
  });

  it("C_Curl template (two ATS args — pair picker)", () => {
    const decimal = formatDecimalForPact(AMOUNT);
    const pactCode =
      `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Curl "${PATRON}" "${CURLER}" "${ATS}" "${ATS2}" "${RT}" ${decimal})`;
    expect(pactCode).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Curl "k:aaaa0000" "OU_Stoa_y" "Auryndex-O136CBn22ncY" "EliteAuryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" 1.5)`
    );
  });

  it("C_Transfer template (vanilla coin.C_Transfer)", () => {
    const decimal = formatDecimalForPact("10");
    const pactCode = `(coin.C_Transfer "${PATRON}" "k:bbbb0000" ${decimal})`;
    expect(pactCode).toBe(
      `(coin.C_Transfer "k:aaaa0000" "k:bbbb0000" 10.0)`
    );
  });

  it("INFO template shape — INFO_* queries use namespaced INFO-ONE", () => {
    const decimal = formatDecimalForPact(AMOUNT);
    const pactCode =
      `(${KADENA_NAMESPACE}.INFO-ONE.ATS|INFO_Coil "${PATRON}" "${COILER}" "${ATS}" "${RT}" ${decimal})`;
    expect(pactCode).toBe(
      `(ouronet-ns.INFO-ONE.ATS|INFO_Coil "k:aaaa0000" "OU_Stoa_x" "Auryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" 1.5)`
    );
  });

  describe("decimal formatting in templates preserves integrity", () => {
    it("integer amount renders with .0", () => {
      expect(formatDecimalForPact("100")).toBe("100.0");
    });

    it("leading-zero decimal stays as-is (Pact accepts 0.5)", () => {
      expect(formatDecimalForPact("0.5")).toBe("0.5");
    });

    it("high-precision decimal preserved up to 24 places by default", () => {
      expect(formatDecimalForPact("1.000000000000000000000001"))
        .toBe("1.000000000000000000000001");
    });
  });
});
