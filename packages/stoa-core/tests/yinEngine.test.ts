/**
 * Yin Engine gas floor regression suite.
 *
 * The formula was independently re-implemented four times across the
 * ecosystem before landing here as the single canonical source
 * (@stoachain/stoa-core/gas). This test vector table is ported verbatim
 * from the one used to validate OuronetUI's independent implementation —
 * it must match bit-for-bit.
 */

import { describe, it, expect } from "vitest";
import {
  GENESIS_TIME_S,
  GENESIS_MIN_GAS_ANU,
  MAX_GAS_ANU,
  GAS_PRICE_INTERVAL_S,
  minGasPriceAnu,
  anuToStoaNumber,
  stoaGasMeta,
} from "../src/gas";

// ══ Constants ═════════════════════════════════════════════════════════════
describe("Yin Engine constants", () => {
  it("genesis time is 2026-02-23T18:00:00Z (unix 1771869600)", () => {
    expect(GENESIS_TIME_S).toBe(1771869600);
  });
  it("genesis minimum equals the legacy static floor (10,000 ANU)", () => {
    expect(GENESIS_MIN_GAS_ANU).toBe(10_000);
  });
  it("cap is 400,000 ANU", () => {
    expect(MAX_GAS_ANU).toBe(400_000);
  });
  it("tick interval is 3 hours (10,800s)", () => {
    expect(GAS_PRICE_INTERVAL_S).toBe(10_800);
  });
});

// ══ minGasPriceAnu — ported test-vector table ════════════════════════════
describe("minGasPriceAnu — ported test vectors", () => {
  it("1s before genesis clamps to 10,000 (pre-genesis clamp)", () => {
    expect(minGasPriceAnu(1771869599)).toBe(10_000);
  });
  it("exact genesis → 10,000", () => {
    expect(minGasPriceAnu(1771869600)).toBe(10_000);
  });
  it("1s before first tick → still 10,000", () => {
    expect(minGasPriceAnu(1771869600 + 10799)).toBe(10_000);
  });
  it("exact first tick → 10,001", () => {
    expect(minGasPriceAnu(1771869600 + 10800)).toBe(10_001);
  });
  it("second tick → 10,002", () => {
    expect(minGasPriceAnu(1771869600 + 10800 * 2)).toBe(10_002);
  });
  it("far enough out that 10,000+ticks > 400,000 → capped at 400,000", () => {
    // 400,000 - 10,000 = 390,000 ticks needed to hit the cap exactly;
    // go well past that.
    const farFuture = GENESIS_TIME_S + GAS_PRICE_INTERVAL_S * 1_000_000;
    expect(minGasPriceAnu(farFuture)).toBe(400_000);
  });
  it("well before genesis (large negative elapsed) also clamps to 10,000", () => {
    expect(minGasPriceAnu(0)).toBe(10_000);
    expect(minGasPriceAnu(-1_000_000)).toBe(10_000);
  });
});

// ══ Monotonicity ══════════════════════════════════════════════════════════
describe("minGasPriceAnu — monotonicity", () => {
  it("never decreases as creationTime increases", () => {
    const start = GENESIS_TIME_S - 100_000;
    let prev = minGasPriceAnu(start);
    for (let t = start; t <= GENESIS_TIME_S + GAS_PRICE_INTERVAL_S * 500; t += 3_701) {
      const cur = minGasPriceAnu(t);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it("is monotonic across the cap boundary too", () => {
    const justBeforeCap = GENESIS_TIME_S + GAS_PRICE_INTERVAL_S * 389_999;
    const atCap = GENESIS_TIME_S + GAS_PRICE_INTERVAL_S * 390_000;
    const wayPastCap = atCap + GAS_PRICE_INTERVAL_S * 1_000_000;
    expect(minGasPriceAnu(justBeforeCap)).toBeLessThanOrEqual(minGasPriceAnu(atCap));
    expect(minGasPriceAnu(atCap)).toBeLessThanOrEqual(minGasPriceAnu(wayPastCap));
    expect(minGasPriceAnu(wayPastCap)).toBe(400_000);
  });
});

// ══ anuToStoaNumber — precision-safe conversion ═══════════════════════════
describe("anuToStoaNumber", () => {
  // Note on magnitude: every value in the live 10,000-400,000 ANU range
  // converts to a STOA value < 1e-6 (10,000 / 1e12 = 1e-8 ... 400,000 / 1e12
  // = 4e-7), which is exactly the range where JS's default Number-to-string
  // conversion switches to exponential notation. That's not a defect here —
  // it's already the accepted baseline in this ecosystem: the vendored
  // composePactCommand.cjs default is literally `gasPrice: 1.0e-8`, and
  // `JSON.stringify` renders both that literal and this function's output
  // identically (`1e-8`), which chainweb's JSON/decimal parser accepts fine.
  // What actually matters — and is verified below — is that the underlying
  // float is exact, i.e. round-trips back to the original integer ANU value
  // with no precision loss.
  it("converts genesis floor exactly", () => {
    expect(anuToStoaNumber(10_000)).toBe(1e-8);
  });
  it("converts the cap exactly", () => {
    expect(anuToStoaNumber(400_000)).toBe(4e-7);
  });
  it("round-trips exactly for the full 10,000-400,000 ANU range", () => {
    // Exhaustive loop over the entire live-formula range — this was
    // exhaustively verified elsewhere; port that verification here.
    for (let anu = 10_000; anu <= 400_000; anu++) {
      const stoa = anuToStoaNumber(anu);
      expect(Number.isFinite(stoa)).toBe(true);
      // toFixed(12) never throws / never loses precision beyond 12 places.
      const fixed = stoa.toFixed(12);
      expect(fixed.split(".")[1]?.length).toBe(12);
      // Round-trip: multiplying back by ANU_PER_STOA and rounding recovers
      // the original ANU integer exactly — the load-bearing property that
      // plain `anu / ANU_PER_STOA` float division cannot guarantee.
      expect(Math.round(stoa * 1_000_000_000_000)).toBe(anu);
    }
  }, 20_000);
});

// ══ stoaGasMeta — the anti-race primitive ════════════════════════════════
describe("stoaGasMeta", () => {
  it("derives both creationTime and gasPrice from a single supplied clock read", () => {
    const nowS = 1771869600 + 10800; // exact first tick → 10,001 ANU
    const meta = stoaGasMeta(nowS);
    expect(meta.creationTime).toBe(nowS);
    expect(meta.gasPrice).toBe(anuToStoaNumber(10_001));
  });

  it("defaults to Math.floor(Date.now() / 1000) when nowS is omitted", () => {
    const before = Math.floor(Date.now() / 1000);
    const meta = stoaGasMeta();
    const after = Math.floor(Date.now() / 1000);
    expect(meta.creationTime).toBeGreaterThanOrEqual(before);
    expect(meta.creationTime).toBeLessThanOrEqual(after);
  });

  it("gasPrice always reflects minGasPriceAnu(creationTime) converted via anuToStoaNumber", () => {
    const nowS = GENESIS_TIME_S + GAS_PRICE_INTERVAL_S * 5;
    const meta = stoaGasMeta(nowS);
    expect(meta.gasPrice).toBe(anuToStoaNumber(minGasPriceAnu(nowS)));
  });
});
