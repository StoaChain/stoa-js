/**
 * Pact-format helpers — pure functions that sit between TypeScript and Pact.
 *
 * - formatDecimalForPact: canonicalize a decimal string for inclusion in a Pact
 *   code literal. Pact distinguishes integer vs decimal at the lexer level, so
 *   "1" and "1.0" are NOT the same value; functions expecting `decimal` reject
 *   the integer form. This helper adds a trailing ".0" to integer strings and
 *   truncates to a maximum fractional length (not rounds — see §truncate below).
 * - formatIntegerForPact: canonicalize an integer string for inclusion in a
 *   Pact code literal as an `integer`. Validated arbitrary-precision string —
 *   never round-trips through JS float64 so values larger than `Number.MAX_SAFE_INTEGER`
 *   (2^53 - 1) round-trip byte-identical.
 * - mayComeWithDeimal: Pact reads often return `{ decimal: "123.456" }` objects
 *   for decimal values (vs. plain numbers for int). This unwraps to the string.
 * - filterFreePositionData: normalize the "no positions" sentinel the chain
 *   returns from free-position reads (a single row with reward-tokens=[0]).
 *
 * ### Number-hygiene contract (v3.2.0+)
 *
 * Pact has arbitrary-precision integers AND arbitrary-precision decimals;
 * JavaScript's number primitive is IEEE-754 float64 (~15-17 significant
 * digits, with overflow at 2^1024). Round-tripping a chain value through
 * `parseFloat`/`Number()`/`.toFixed()` silently destroys precision for any
 * value beyond float64's range. The contract enforced here:
 *
 *   1. UI/consumer code passes amounts AS STRINGS, never as `number`.
 *   2. The `format*ForPact` family is the sole boundary where a string
 *      becomes a Pact-code literal. Validation regex enforces digits-only
 *      with exactly one optional decimal point. No exponent notation, no
 *      thousand-separators, no signs (chain values are non-negative).
 *   3. The `ValidatedDecimal` / `ValidatedInteger` brand types prove
 *      "this string passed the formatter" at the type level — downstream
 *      code that interpolates them can rely on the chain accepting them
 *      verbatim.
 *
 * Two precision-loss vectors closed by this contract: chain-bound amounts
 * never lose digits during the JS→Pact handoff, and consumers never need
 * to reason about float64 edge cases when their input is already a string
 * (UI text fields, redux state, JSON envelopes are all string-natural).
 */

// ─── Brand types ─────────────────────────────────────────────────────────────
// TypeScript-only newtype pair — zero runtime cost, prevents accidentally
// passing an unvalidated string where a Pact-code interpolation is expected.
// The `__brand` field is never set at runtime; it exists at the type level
// only so structural assignment requires going through a formatter.

declare const ValidatedDecimalBrand: unique symbol;
declare const ValidatedIntegerBrand: unique symbol;

/**
 * A decimal string that has passed `formatDecimalForPact` validation.
 *
 * Use as the parameter type when a function interpolates a decimal value
 * into Pact code — the brand prevents accidental passthrough of raw user
 * input or float-derived strings. The runtime value is a plain string;
 * the brand is type-only.
 */
export type ValidatedDecimal = string & { readonly [ValidatedDecimalBrand]: true };

/**
 * An integer string that has passed `formatIntegerForPact` validation.
 *
 * Use as the parameter type when a function interpolates an integer value
 * into Pact code. Same shape as `ValidatedDecimal` but reserved for the
 * integer code-path so the type system can distinguish "decimal: 1.0" from
 * "integer: 1" at the function boundary (Pact's lexer distinguishes them).
 */
export type ValidatedInteger = string & { readonly [ValidatedIntegerBrand]: true };

/**
 * Format a numeric string for inclusion in a Pact code literal as a `decimal`.
 *
 * Rules:
 *   - Whitespace is trimmed.
 *   - A single comma is normalized to a period (so `"1,5"` and `"1.5"` both
 *     work). This accommodates European-locale UI inputs without needing the
 *     consumer to swap separators upstream. Multiple commas (thousand-style
 *     `1,234`) are still rejected — input must come from a UI that strips
 *     thousand-separators before the call.
 *   - Input must match `/^\d+\.?\d*$/` after normalization (non-negative,
 *     no scientific, no thousand-separators) — throws "Invalid decimal
 *     format" otherwise.
 *   - Integer-looking strings get ".0" appended (Pact needs a decimal point
 *     to lex as decimal rather than integer).
 *   - Fractional parts longer than `maxDecimals` are TRUNCATED, not rounded —
 *     this matches Pact's own integer-division behavior and avoids producing
 *     a value the on-chain code can't represent.
 *   - Arbitrary-precision: the input string is validated and reshaped, never
 *     passed through `parseFloat` or `Number()`. A 50-digit decimal round-trips
 *     byte-identical.
 *
 * @returns A `ValidatedDecimal` (string at runtime, branded at the type level).
 */
export function formatDecimalForPact(amount: string, maxDecimals: number = 24): ValidatedDecimal {
  let trimmed = amount.trim();

  // Comma-to-period normalisation. Single comma only — multiple commas
  // (e.g. "1,234,567") indicate thousand-separators which we reject so
  // the consumer can't accidentally send a number with stripped grouping.
  const commaCount = (trimmed.match(/,/g) || []).length;
  if (commaCount === 1 && !trimmed.includes(".")) {
    trimmed = trimmed.replace(",", ".");
  } else if (commaCount > 0) {
    throw new Error("Invalid decimal format");
  }

  if (!/^\d+\.?\d*$/.test(trimmed)) {
    throw new Error("Invalid decimal format");
  }

  const parts = trimmed.split(".");

  // No decimal part — add .0 so Pact lexes as decimal
  if (parts.length === 1) {
    return `${trimmed}.0` as ValidatedDecimal;
  }

  // Truncate (not round) if exceeds max decimals
  if (parts[1].length > maxDecimals) {
    return `${parts[0]}.${parts[1].substring(0, maxDecimals)}` as ValidatedDecimal;
  }

  return trimmed as ValidatedDecimal;
}

/**
 * Format an integer string for inclusion in a Pact code literal as an `integer`.
 *
 * Pact distinguishes integers from decimals at the lexer level. Functions
 * expecting `integer` arguments (counts, indices, slot numbers, integer-typed
 * cap arguments) reject `1.0` and accept `1`. This helper validates that the
 * input is a non-negative integer and returns it unchanged (no float
 * round-trip; arbitrary precision preserved).
 *
 * Rules:
 *   - Whitespace is trimmed.
 *   - Input must match `/^\d+$/` — throws "Invalid integer format" otherwise.
 *     No decimal point, no comma, no scientific notation, no signs.
 *   - Returned string is the trimmed input verbatim (no leading-zero
 *     normalisation — `"007"` round-trips as `"007"`, which Pact accepts).
 *   - Arbitrary-precision: a 50-digit integer string is returned as-is.
 *     Never passes through JS `Number()` so values beyond `2^53 - 1` are
 *     safe.
 *
 * @returns A `ValidatedInteger` (string at runtime, branded at the type level).
 */
export function formatIntegerForPact(amount: string): ValidatedInteger {
  const trimmed = amount.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Invalid integer format");
  }

  return trimmed as ValidatedInteger;
}

/**
 * Unwrap a Pact `{ decimal: "..." }` value to the underlying string.
 *
 * Pact returns decimal values inside an object envelope `{ decimal: "…" }`
 * to distinguish them from integers (which come back as plain numbers).
 * This helper peels the envelope when present and passes other shapes through
 * unchanged. Null / undefined / non-object inputs round-trip unchanged.
 *
 * Name preserved from the OuronetUI original (typo intentional, "Deimal"
 * instead of "Decimal") — any consumer that imported this under its old
 * name keeps working after extraction. A `mayComeWithDecimal` alias could
 * ship as a deprecation path if the typo ever matters.
 */
export const mayComeWithDeimal = (data: any): any => {
  if (data?.hasOwnProperty("decimal")) {
    return data.decimal;
  }
  return data;
};

// ─── EU locale number formatters ─────────────────────────────────────────────
// Display-side counterparts — convert chain numbers to/from European locale
// (dot thousands separator, comma decimal separator). Both sides of core-based
// code (OuronetUI's display + HUB's admin output) format the same way.

/**
 * Parse a European-locale number string back to a float.
 * "1.234,56" → 1234.56, "1.234" → 1234 (if no comma), "0,9" → 0.9.
 * Falls back to parseFloat for non-EU strings.
 */
export function parseEU(s: string | null | undefined): number {
  if (!s) return 0;
  const trimmed = s.trim();
  if (trimmed === "???" || trimmed === "N/A" || trimmed === "—" || trimmed === "") return 0;
  if (trimmed.includes(",")) {
    return parseFloat(trimmed.replace(/\./g, "").replace(",", ".")) || 0;
  }
  const dotParts = trimmed.split(".");
  if (dotParts.length === 2 && dotParts[1].length === 3 && /^\d+$/.test(dotParts[1])) {
    return parseFloat(trimmed.replace(/\./g, "")) || 0;
  }
  return parseFloat(trimmed) || 0;
}

/**
 * Format a numeric string/number to European locale.
 * "6081.3874" → "6.081,3874"   "42067.93$" → "42.067,93$"
 * Returns "???" for null/undefined; passes "???", "N/A", "—", "" unchanged.
 */
export function formatEU(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "???";
  const s = String(raw).trim();
  if (s === "???" || s === "N/A" || s === "—" || s === "") return s;

  const m = s.match(/^(\d+(?:\.\d+)?)((?:\s+\([^)]+\))*)\s*(\$|¢)?$/);
  if (!m) return s;

  const numStr = m[1];
  const annotation = m[2] || "";
  const suffix = m[3] || "";

  const dotIdx = numStr.indexOf(".");
  let intPart: string;
  let decPart: string | undefined;

  if (dotIdx >= 0) {
    intPart = numStr.slice(0, dotIdx);
    decPart = numStr.slice(dotIdx + 1);
  } else {
    intPart = numStr;
    decPart = undefined;
  }

  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const formatted = decPart !== undefined ? `${intPart},${decPart}` : intPart;
  return `${formatted}${annotation}${suffix ? " " + suffix : ""}`.trim();
}

/**
 * Safe `creationTime` for Pact `setMeta({creationTime})`.
 *
 * Subtracts 30 seconds from current wall-clock time to sidestep chain-side
 * "creation time is too far in the future" rejections when the client's
 * clock drifts slightly ahead of the node's. Every on-chain tx this cluster
 * submits has used this rule since the first days of the UI — keep it
 * consistent so simulations and submits don't diverge.
 */
export function safeCreationTime(): number {
  return Math.floor(Date.now() / 1000) - 30;
}

/**
 * Normalize raw free-position-data rows from the chain.
 *
 * When a user's free-positions list clears, `URC_0017_TruefungibleButton`
 * (and similar position reads) return a single placeholder row with
 * `reward-tokens = [0]` instead of an empty array. That's a "no positions
 * in use" signal from the chain, NOT a real position. Callers should treat
 * it as empty.
 */
export function filterFreePositionData(raw: any[]): any[] {
  if (
    raw.length === 1 &&
    Array.isArray(raw[0]?.["reward-tokens"]) &&
    raw[0]["reward-tokens"].length === 1 &&
    Number(raw[0]["reward-tokens"][0]) === 0
  ) {
    return [];
  }
  return raw;
}
