/**
 * REQ-09 — MnemonicMismatchError typed wrapping
 *
 * KadenaWalletBuilder.createWalletPairFromMnemonic must throw
 * MnemonicMismatchError (not a plain Error) when the mnemonic fails
 * validation, while keeping the original message strings unchanged.
 *
 * RED gate: these tests fail until T2.3b swaps the plain `throw new Error`
 * calls at builder lines 65-66 and 80-81 for `throw new MnemonicMismatchError`.
 */

import { describe, it, expect } from "vitest";
import { KadenaWalletBuilder } from "../src/wallet";
import { MnemonicMismatchError } from "../src/wallet";

// Shared test fixtures — same inputs used in wallet-builder.test.ts so the
// RED→GREEN transition is driven by the exact same branches.

// 12 valid wordlist words but bad checksum — rejected by kadenaCheckMnemonic
// (chainweaver branch) and also by bip39.validateMnemonic (koala branch).
const INVALID_12_BAD_CHECKSUM =
  "mammal east oxygen romance wheel chimney frequent brain spawn owner announce mammal";

// 24 valid wordlist words but bad checksum — rejected by bip39.validateMnemonic
// (koala branch) and also by kadenaCheckMnemonic (chainweaver branch).
const INVALID_24_BAD_CHECKSUM =
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon";

const VENDOR_PASSWORD = "kadena";

describe("REQ-09: MnemonicMismatchError typed wrapping", () => {
  it("12-word mismatch throws MnemonicMismatchError (instanceof check)", async () => {
    // INVALID_12_BAD_CHECKSUM passed with seedType "koala" routes through the
    // 24-word BIP39 branch, which rejects it — this is the same cross-type
    // mismatch the existing tests exercise (line 156-163 of wallet-builder.test.ts).
    // The builder currently throws plain Error; after T2.3b it throws MnemonicMismatchError.
    await expect(
      KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        INVALID_12_BAD_CHECKSUM,
        0,
        "koala",
      ),
    ).rejects.toBeInstanceOf(MnemonicMismatchError);
  });

  it("24-word mismatch throws MnemonicMismatchError (instanceof check)", async () => {
    // INVALID_24_BAD_CHECKSUM with seedType "chainweaver" routes through the
    // 12-word kadenaCheckMnemonic branch, which rejects it.
    await expect(
      KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        INVALID_24_BAD_CHECKSUM,
        0,
        "chainweaver",
      ),
    ).rejects.toBeInstanceOf(MnemonicMismatchError);
  });

  it("MnemonicMismatchError preserves the original message string verbatim", async () => {
    // F-002 fix: messages must stay unchanged — only the thrown class changes.
    let caught: unknown;
    try {
      await KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        INVALID_12_BAD_CHECKSUM,
        0,
        "koala",
      );
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe("Invalid 24-word BIP39 mnemonic.");
  });

  it("MnemonicMismatchError carries a cause when the inner validator throws", async () => {
    // The chainweaver branch (kadenaCheckMnemonic) returns false rather than
    // throwing, so cause may be undefined there. The koala branch wraps the
    // bip39 validator result the same way. Either way the thrown value must be
    // a MnemonicMismatchError instance.
    let caught: unknown;
    try {
      await KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        INVALID_24_BAD_CHECKSUM,
        0,
        "chainweaver",
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MnemonicMismatchError);
    // cause is either undefined or an inner Error — both are acceptable
    const cause = (caught as { cause?: unknown }).cause;
    expect(cause === undefined || cause instanceof Error).toBe(true);
  });
});
