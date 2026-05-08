/**
 * REQ-07: KadenaWallet secret redaction
 *
 * Verifies that `secret` is omitted from all serialization paths
 * (JSON.stringify via toJSON, util.inspect via Symbol.for("nodejs.util.inspect.custom"))
 * while remaining accessible via direct property access.
 *
 * Direct field access must still work — only external serialization is redacted.
 * This prevents accidental secret leakage through logging, JSON APIs,
 * or Node.js REPL/inspect output.
 */

import { describe, it, expect } from "vitest";
import { inspect } from "node:util";
import { KadenaWallet } from "../src/wallet";

const SENTINEL = "SECRET_DO_NOT_LEAK_ABCDEF12345678";

const WALLET_OPTIONS = {
  parentId: "parent-wallet-id",
  index: 0,
  secret: SENTINEL,
  publicKey: "a".repeat(64),
  derivationPath: "m/44'/626'/0'/0/0",
};

describe("REQ-07: KadenaWallet secret redaction", () => {
  it("JSON.stringify(wallet) does NOT contain the secret sentinel", () => {
    const wallet = new KadenaWallet(WALLET_OPTIONS);
    const json = JSON.stringify(wallet);
    expect(json).not.toContain(SENTINEL);
  });

  it("JSON.stringify(wallet) parses back to an object with NO `secret` key", () => {
    const wallet = new KadenaWallet(WALLET_OPTIONS);
    const parsed = JSON.parse(JSON.stringify(wallet));
    expect(parsed).not.toHaveProperty("secret");
  });

  it("util.inspect(wallet) does NOT contain the secret sentinel", () => {
    const wallet = new KadenaWallet(WALLET_OPTIONS);
    expect(inspect(wallet)).not.toContain(SENTINEL);
  });

  it("util.inspect(wallet) does NOT contain the literal 'secret' field name", () => {
    const wallet = new KadenaWallet(WALLET_OPTIONS);
    expect(inspect(wallet)).not.toContain("secret");
  });

  it("wallet.secret is STILL accessible directly (only serialization is redacted)", () => {
    const wallet = new KadenaWallet(WALLET_OPTIONS);
    expect(wallet.secret).toBe(SENTINEL);
  });

  it("toJSON() and inspect.custom return symmetric shape (both omit `secret` consistently)", () => {
    const wallet = new KadenaWallet(WALLET_OPTIONS);
    const jsonKeys = Object.keys(JSON.parse(JSON.stringify(wallet))).sort();
    expect(jsonKeys).not.toContain("secret");
    expect(inspect(wallet)).not.toContain("secret");
  });
});
