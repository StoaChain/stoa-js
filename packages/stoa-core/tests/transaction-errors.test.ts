/**
 * transaction-errors.test.ts — branch coverage for the pure error-factory
 * surface in `src/errors/transactionErrors.ts`.
 *
 * Three documented contracts are exercised:
 *   1. `createSigningError` — 5 message-pattern branches, each producing a
 *      `SigningError` with the matching `code`. Fall-through is the
 *      `GENERIC_SIGNING_ERROR` arm.
 *   2. `createSimulationError` — 5 message-pattern branches, each producing
 *      a `SigningError` with the matching `code`. Fall-through is the
 *      `SIMULATION_FAILED` arm. The `GAS_LIMIT_EXCEEDED` branch additionally
 *      runs the regex `/exceeded:\s*(\d+)/` against the message and embeds
 *      the captured digits in `context` + `suggestions`.
 *   3. `formatErrorForUser` — string output shape: contains the error
 *      message, contains a `Context:` segment, contains a `Suggestions:`
 *      header, contains at least one numbered list item.
 *
 * Out of scope (per acceptance):
 *   - `logDetailedError` (console side-effect surface).
 *   - `createTimeoutError` (already covered by `tests/timeouts.test.ts`).
 *
 * The factories are pure: input → SigningError instance. No mocking required.
 */

import { describe, it, expect } from "vitest";
import {
  createSigningError,
  createSimulationError,
  formatErrorForUser,
  SigningError,
} from "../src/errors/transactionErrors";

// ── createSigningError — 5 branches ──────────────────────────────────────────

describe("createSigningError — branch coverage", () => {
  it("INVALID_SIGNATURE: classifies messages containing 'Invalid signature'", () => {
    const original = new Error("Invalid signature for payload");
    const err = createSigningError("transfer", original, "extra-ctx");

    expect(err).toBeInstanceOf(SigningError);
    expect(err.code).toBe("INVALID_SIGNATURE");
    expect(err.message).toMatch(/Signing failed: Invalid signature during transfer/);
    expect(err.context).toContain("Operation: transfer");
    expect(err.context).toContain("extra-ctx");
    expect(err.originalError).toBe(original);
    expect(err.suggestions?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("PRIVATE_KEY_ERROR: classifies messages containing 'Private key' or 'secret'", () => {
    const original = { message: "Private key not unlocked" };
    const err = createSigningError("sign", original);

    expect(err.code).toBe("PRIVATE_KEY_ERROR");
    expect(err.message).toMatch(/Signing failed: Private key error during sign/);
    expect(err.suggestions?.length ?? 0).toBeGreaterThanOrEqual(1);

    const errSecret = createSigningError("sign", { message: "missing secret material" });
    expect(errSecret.code).toBe("PRIVATE_KEY_ERROR");
  });

  it("CAPABILITY_ERROR: classifies messages containing 'capability' or 'CAPABILITY'", () => {
    const lower = createSigningError("transfer", { message: "missing capability TRANSFER" });
    expect(lower.code).toBe("CAPABILITY_ERROR");
    expect(lower.message).toMatch(/Signing failed: Missing or invalid capability during transfer/);

    const upper = createSigningError("transfer", { message: "CAPABILITY check failed" });
    expect(upper.code).toBe("CAPABILITY_ERROR");
  });

  it("GAS_ERROR: classifies messages containing 'Gas' or 'gas'", () => {
    const upper = createSigningError("submit", { message: "Gas payer rejected" });
    expect(upper.code).toBe("GAS_ERROR");
    expect(upper.message).toMatch(/Signing failed: Gas-related error during submit/);

    const lower = createSigningError("submit", { message: "out of gas" });
    expect(lower.code).toBe("GAS_ERROR");
  });

  it("GENERIC_SIGNING_ERROR: falls through for unrecognised messages", () => {
    const original = { message: "totally unrecognised" };
    const err = createSigningError("misc", original);

    expect(err.code).toBe("GENERIC_SIGNING_ERROR");
    expect(err.message).toContain("Signing failed during misc:");
    expect(err.message).toContain("totally unrecognised");
    expect(err.originalError).toBe(original);
    expect(err.suggestions?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

// ── createSimulationError — 5 branches ───────────────────────────────────────

describe("createSimulationError — branch coverage", () => {
  it("GAS_LIMIT_EXCEEDED: extracts required gas via the /exceeded:\\s*(\\d+)/ regex", () => {
    const sim = { error: { message: "Gas limit exceeded: 50000" } };
    const err = createSimulationError("transfer", sim);

    expect(err.code).toBe("GAS_LIMIT_EXCEEDED");
    expect(err.message).toMatch(/Simulation failed: Gas limit exceeded during transfer/);
    expect(err.context).toContain("Required gas: 50000");
    // Captured value flows into the suggestions array verbatim.
    expect(err.suggestions?.some((s) => s.includes("50000"))).toBe(true);
  });

  it("ACCOUNT_NOT_FOUND: classifies 'row not found' or 'account does not exist'", () => {
    const a = createSimulationError("read", { error: { message: "row not found in coin-table" } });
    expect(a.code).toBe("ACCOUNT_NOT_FOUND");
    expect(a.message).toMatch(/Simulation failed: Account not found during read/);

    const b = createSimulationError("read", { error: { message: "account does not exist" } });
    expect(b.code).toBe("ACCOUNT_NOT_FOUND");
  });

  it("INSUFFICIENT_FUNDS: classifies 'insufficient funds' or 'balance'", () => {
    const a = createSimulationError("transfer", { error: { message: "insufficient funds for transfer" } });
    expect(a.code).toBe("INSUFFICIENT_FUNDS");
    expect(a.message).toMatch(/Simulation failed: Insufficient funds during transfer/);

    const b = createSimulationError("transfer", { error: { message: "balance below threshold" } });
    expect(b.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("KEYSET_ERROR: classifies 'keyset' or 'guard'", () => {
    const a = createSimulationError("define", { error: { message: "keyset predicate failure" } });
    expect(a.code).toBe("KEYSET_ERROR");
    expect(a.message).toMatch(/Simulation failed: Keyset\/guard error during define/);

    const b = createSimulationError("define", { error: { message: "guard mismatch" } });
    expect(b.code).toBe("KEYSET_ERROR");
  });

  it("SIMULATION_FAILED: falls through for unrecognised messages", () => {
    const sim = { error: { message: "totally unrecognised" } };
    const err = createSimulationError("misc", sim);

    expect(err.code).toBe("SIMULATION_FAILED");
    expect(err.message).toContain("Simulation failed during misc:");
    expect(err.message).toContain("totally unrecognised");
    expect(err.originalError).toBe(sim);
    expect(err.suggestions?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

// ── Gas-extraction regex independent assertion ───────────────────────────────

describe("gas-extraction regex /exceeded:\\s*(\\d+)/", () => {
  const REGEX = /exceeded:\s*(\d+)/;

  it("captures the digit group across representative inputs", () => {
    const a = "Gas limit exceeded: 12345".match(REGEX);
    expect(a?.[1]).toBe("12345");

    const b = "Gas limit exceeded:    99".match(REGEX);
    expect(b?.[1]).toBe("99");

    const c = "exceeded: abc".match(REGEX);
    expect(c).toBeNull();
  });
});

// ── formatErrorForUser — output shape ────────────────────────────────────────

describe("formatErrorForUser — output shape", () => {
  it("includes message, Context segment, Suggestions header, and a numbered list item", () => {
    const err = createSimulationError("transfer", {
      error: { message: "Gas limit exceeded: 7777" },
    });
    const out = formatErrorForUser(err);

    expect(typeof out).toBe("string");
    expect(out).toContain(err.message);
    expect(out).toContain("Context:");
    expect(out).toContain(err.context);
    expect(out).toContain("Suggestions:");
    expect(out).toMatch(/^\d+\./m);
  });
});
