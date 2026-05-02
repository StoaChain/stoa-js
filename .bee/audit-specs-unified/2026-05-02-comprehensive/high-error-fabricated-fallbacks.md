[ERROR-FIX] Surface fabricated fallback values in read helpers

## Problem
Three read helpers swallow chain-call failures and return a plausible-looking value that callers cannot distinguish from a successful read. Particularly dangerous because the fabricated values flow into financial calculations:

- `getStoaPriceUSD` returns `1.0` on success-without-data, `1.0` on failure status, and `1.0` from the catch block. A network error at the price oracle is indistinguishable from "the price is 1.0 USD" — and `1.0` is a believable USD price that could feed a swap-quote calculation.
- `getTokenDecimals` returns `8` on every failure. A pool quote built against a token that's actually 12-decimal will round wrong silently.
- `getPoolTotalFee` returns `0` on every failure. A swap quote shows a zero-fee pool when actually the read crashed mid-keystroke.

The pattern is widespread (the audit found ~25 empty-catch sites across `interactions/*`); these three are the highest-impact because their values are consumed in user-facing financial math.

## Findings (1, but representative)
| ID | Severity | Title |
|---|---|---|
| F-CORE-007 | HIGH | Empty catches fabricate fallback values (1.0 USD, 0% fee, 8 decimals) |

This finding is the visible tip of a broader pattern. Fixing the three named functions covers the most dangerous surface; cataloguing the rest is in scope as a secondary task.

## Locations
| File | Lines | Function | Fabricated value |
|---|---|---|---|
| `src/interactions/ouroFunctions.ts` | 2042-2054 | `getStoaPriceUSD` | `1.0` |
| `src/interactions/dexFunctions.ts` | 1308 | `getTokenDecimals` | `8` |
| `src/interactions/dexFunctions.ts` | 1346-1349 | `getPoolTotalFee` | `0` |

Secondary (catalog only — not all in scope for this spec):
- `src/interactions/dexFunctions.ts:261, 1318, 1512, 1523, 1533, 1543, 1589, 1633, 1911, 1931`
- `src/interactions/addLiquidityFunctions.ts:256, 274, 939`
- `src/interactions/ouroFunctions.ts:1842, 1860, 1877, 1894, 2108, 2122, 2135, 2286`
- `src/interactions/urStoaFunctions.ts:55, 102, 520`

## Required Fix

Convert each of the three primary functions from "swallow + sentinel" to "discriminated union or null":

```ts
// Before:
export async function getStoaPriceUSD(): Promise<number> {
  try {
    const r = await pactRead(...);
    if (r.result.status === "success") return Number(r.result.data) || 1.0;
    return 1.0;
  } catch { return 1.0; }
}

// After (option A — discriminated union):
export async function getStoaPriceUSD(): Promise<
  | { ok: true; value: number }
  | { ok: false; reason: "network" | "no-data" | "parse" }
> {
  try {
    const r = await pactRead(...);
    if (r.result.status !== "success") return { ok: false, reason: "no-data" };
    const value = Number(r.result.data);
    if (!Number.isFinite(value)) return { ok: false, reason: "parse" };
    return { ok: true, value };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// After (option B — return null on failure):
export async function getStoaPriceUSD(): Promise<number | null> {
  try {
    const r = await pactRead(...);
    if (r.result.status !== "success") return null;
    const value = Number(r.result.data);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
```

Recommendation: **option B** for these three (smaller blast radius — consumers branch on `null` vs the value). Reserve option A for new functions where the caller benefits from knowing WHY a read failed.

In addition, drop the `console.error` calls inside the catches (they leak to consumer stdout/stderr and aren't actionable). Replace with a hook into the future logger seam (cross-reference `[IMPROVEMENT]` spec). For now, silent failure with a `null` return is preferable to noisy `console.error` that consumers can't suppress.

## Side effects
- This is a breaking change for consumers calling `getStoaPriceUSD`, `getTokenDecimals`, `getPoolTotalFee`. The OuronetUI consumer must update its call sites to handle `null`.
- Decide whether to bump major (semver-strict per CLAUDE.md) or land in a transition: keep the existing functions returning fabricated values, add `getStoaPriceUSDOrNull` etc., deprecate the old ones across two minor versions, then remove. Recommendation: **major bump** — the audit-driven rationale is "users were silently lied to about prices"; consumers SHOULD be forced to handle the null case.

## Acceptance Criteria
- [ ] `getStoaPriceUSD`, `getTokenDecimals`, `getPoolTotalFee` no longer return fabricated values on failure.
- [ ] Each function returns `null` (or a discriminated union) on every non-success path.
- [ ] `console.error` removed from these three catches; failure path is silent (or wires into the future logger seam if that ships first).
- [ ] A new test in `tests/interactions-pricing.test.ts` (new file) mocks a failing reader and asserts each function returns `null` rather than `1.0` / `8` / `0`.
- [ ] CHANGELOG.md gets a major-version entry documenting the breaking return-shape change with a migration note.
- [ ] OuronetUI's consumer code is identified (catalog the call sites of the three functions in OuronetUI) and a follow-up issue is filed there to handle the null case.
- [ ] `npm test` passes.
