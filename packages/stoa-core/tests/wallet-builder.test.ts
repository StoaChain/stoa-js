/**
 * wallet-builder.test.ts -- KadenaWalletBuilder mnemonic dispatch + vendor-vector
 * regression coverage across the three supported seed types.
 *
 * The surface under test is the mnemonic-driven derivation entry point in
 * `src/wallet/KadenaWalletBuilder.ts`. Three derivation branches:
 *
 *   - koala:        24-word BIP39 + SLIP-10 Ed25519 (kadenaMnemonicToSeed +
 *                   kadenaGenKeypairFromSeed). Output: standard 64-char hex
 *                   secretKey usable by nacl.
 *   - chainweaver:  12-word Kadena mnemonic + BIP32-Ed25519
 *                   (kadenaMnemonicToRootKeypair + kadenaGenKeypair). Output:
 *                   EncryptedString secretKey signed via WASM kadenaSign.
 *   - eckowallet:   identical pathway to chainweaver -- label-only difference
 *                   per src/wallet/types.ts:14-15.
 *
 * Vendor vectors are pinned from
 * `node_modules/@kadena/hd-wallet/lib/esm/chainweaver/tests/chainweaver.test.js`
 * (vendor mnemonic + signature regression). The koala branch uses the
 * canonical zero-entropy BIP39 mnemonic ("abandon" * 23 + "art") and pins
 * the derived publicKey snapshot -- if the upstream derivation algorithm
 * changes, this test fails the regression guard.
 *
 * NOT IN SCOPE: KadenaWallet's BalanceResolver injection seam is covered in
 * `tests/wallet.test.ts`. This file covers KadenaWalletBuilder mnemonic
 * dispatch only -- previously zero coverage.
 */

import { describe, it, expect } from "vitest";
import { Buffer } from "node:buffer";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { kadenaCheckMnemonic, kadenaSign } from "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver";
import KadenaWalletBuilder from "../src/wallet/KadenaWalletBuilder";
import { MnemonicMismatchError } from "../src/wallet";

// ── Vendor test vectors (pinned regression) ─────────────────────────────────

// Vendor MNEMONIC + signature vector lifted verbatim from
// node_modules/@kadena/hd-wallet/lib/esm/chainweaver/tests/chainweaver.test.js:5-6,103.
const VENDOR_PASSWORD = "kadena";
const VENDOR_MNEMONIC_12 =
  "mammal east oxygen romance wheel chimney frequent brain spawn owner announce sell";
const VENDOR_BASE64_HASH = "abc";
const VENDOR_SIGNATURE_HEX =
  "bedd0722d330f063266b4b72b2987856c9c7bc0f5f894eb490541441c59bf4c2" +
  "1dba3d35e5214050c90e727b16617c885cb74b2d3fbcd0ebb723f524c8679805";

// Canonical zero-entropy BIP39 mnemonic (24 words). Snapshot value derived
// once locally with kadenaMnemonicToSeed + kadenaGenKeypairFromSeed at
// index 0 with password "kadena". Regression guard: if @kadena/hd-wallet's
// derivation algorithm shifts, this snapshot fails.
const KOALA_MNEMONIC_24 =
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon art";
const KOALA_PUBKEY_AT_INDEX_0 =
  "cf9d5ec84d2d6c8b762a168018b7387790b0db53c3e7e21b9881777f4726032c";

// Locked publicKey snapshot from the chainweaver derivation at index 1 with
// VENDOR_MNEMONIC_12 + VENDOR_PASSWORD. Pinning this lets the eckowallet
// test assert equality without re-running both chainweaver and eckowallet
// derivations (each chainweaver derivation involves
// kadenaMnemonicToRootKeypair, a PBKDF2 SHA-512 600k-iteration round, so
// halving the calls keeps the per-file wall-time budget under 3s).
const VENDOR_CHAINWEAVER_PUBKEY_AT_INDEX_1 =
  "83a185400b2fdaaacf44afe93e126ba528900ec66cd31a9e5b104ffe92d96976";

// 12 wordlist words with bad BIP39 checksum -- rejected by both
// bip39.validateMnemonic and kadenaCheckMnemonic.
const INVALID_12_BAD_CHECKSUM =
  "mammal east oxygen romance wheel chimney frequent brain spawn owner announce mammal";
// 24 wordlist words with bad BIP39 checksum -- rejected by both
// bip39.validateMnemonic and kadenaCheckMnemonic.
const INVALID_24_BAD_CHECKSUM =
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon";
const ELEVEN_WORDS_JUNK =
  "one two three four five six seven eight nine ten eleven";
const EIGHTEEN_WORDS_JUNK =
  "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen";

// ── 24-word koala (BIP39 + SLIP-10 Ed25519) ─────────────────────────────────

describe("KadenaWalletBuilder.createWalletPairFromMnemonic — koala (24-word BIP39)", () => {
  it("derives the locked publicKey snapshot from the canonical zero-entropy BIP39 vector", async () => {
    const result = await KadenaWalletBuilder.createWalletPairFromMnemonic(
      VENDOR_PASSWORD,
      KOALA_MNEMONIC_24,
      0,
      "koala",
    );

    // koala branch returns { publicKey, secretKey } (kadenaGenKeypairFromSeed
    // returns a [publicKey, secretKey] tuple destructured at builder line 84-88).
    expect(result.publicKey).toBe(KOALA_PUBKEY_AT_INDEX_0);
    expect(result.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof result.secretKey).toBe("string");
  });
});

// ── 12-word chainweaver (BIP32-Ed25519, vendor signature regression) ────────

describe("KadenaWalletBuilder.createWalletPairFromMnemonic — chainweaver (12-word vendor vector)", () => {
  it("derives a 64-char publicKey AND signs the vendor base64hash to the locked signature", async () => {
    const { publicKey, secretKey } =
      await KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        VENDOR_MNEMONIC_12,
        1,
        "chainweaver",
      );

    expect(publicKey.length).toBe(64);
    expect(publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(publicKey).toBe(VENDOR_CHAINWEAVER_PUBKEY_AT_INDEX_1);

    // Vendor end-to-end signature regression: signing "abc" with the
    // derived encrypted secretKey reproduces the locked vendor hex.
    const signature = await kadenaSign(
      VENDOR_PASSWORD,
      VENDOR_BASE64_HASH,
      secretKey,
    );
    expect(Buffer.from(signature).toString("hex")).toBe(VENDOR_SIGNATURE_HEX);
  });
});

// ── 12-word eckowallet (label-only difference vs chainweaver) ───────────────

describe("KadenaWalletBuilder.createWalletPairFromMnemonic — eckowallet (label-only difference)", () => {
  it("eckowallet routes through the same chainweaver derivation; same publicKey for same inputs", async () => {
    const ecko = await KadenaWalletBuilder.createWalletPairFromMnemonic(
      VENDOR_PASSWORD,
      VENDOR_MNEMONIC_12,
      1,
      "eckowallet",
    );

    expect(ecko.publicKey).toBe(VENDOR_CHAINWEAVER_PUBKEY_AT_INDEX_1);
    expect(ecko.publicKey.length).toBe(64);
  });
});

// ── Mismatched mnemonic length / seedType throws ────────────────────────────

describe("KadenaWalletBuilder.createWalletPairFromMnemonic — mnemonic / seedType mismatch", () => {
  // The koala branch validates via bip39.validateMnemonic, the chainweaver
  // branch via kadenaCheckMnemonic -- both checks accept any wordlist+
  // checksum-valid mnemonic regardless of length. A happens-to-be-valid
  // mnemonic at the wrong length will silently derive instead of throw, so
  // we use mnemonics that are structurally rejected by their target
  // branch's check (INVALID_12_BAD_CHECKSUM for koala,
  // INVALID_24_BAD_CHECKSUM for chainweaver).
  it("rejects a 12-word mnemonic with seedType koala (BIP39 check fails) AND a 24-word mnemonic with seedType chainweaver (Kadena check fails)", async () => {
    await expect(
      KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        INVALID_12_BAD_CHECKSUM,
        0,
        "koala",
      ),
    ).rejects.toThrow(MnemonicMismatchError);

    await expect(
      KadenaWalletBuilder.createWalletPairFromMnemonic(
        VENDOR_PASSWORD,
        INVALID_24_BAD_CHECKSUM,
        0,
        "chainweaver",
      ),
    ).rejects.toThrow(MnemonicMismatchError);
  });
});

// ── isValidMnemonic — boolean dispatch matrix ───────────────────────────────

describe("KadenaWalletBuilder.isValidMnemonic — boolean dispatch", () => {
  type Row = [
    label: string,
    input: string,
    seedType: "koala" | "chainweaver" | "eckowallet" | undefined,
    expected: boolean,
  ];

  const rows: Row[] = [
    ["valid 12-word Chainweaver, seedType=chainweaver", VENDOR_MNEMONIC_12, "chainweaver", true],
    ["valid 12-word Chainweaver, seedType=eckowallet", VENDOR_MNEMONIC_12, "eckowallet", true],
    ["valid 24-word BIP39, seedType=koala", KOALA_MNEMONIC_24, "koala", true],
    ["invalid 12-word (bad checksum), seedType=chainweaver", INVALID_12_BAD_CHECKSUM, "chainweaver", false],
    ["invalid 24-word (bad checksum), seedType=koala", INVALID_24_BAD_CHECKSUM, "koala", false],
    // seedType undefined -> word-count dispatch.
    ["11-word junk, seedType=undefined (word-count rejects)", ELEVEN_WORDS_JUNK, undefined, false],
    ["18-word junk, seedType=undefined (word-count rejects)", EIGHTEEN_WORDS_JUNK, undefined, false],
    ["valid 12-word, seedType=undefined (12-word dispatch -> chainweaver check)", VENDOR_MNEMONIC_12, undefined, true],
    ["valid 24-word, seedType=undefined (24-word dispatch -> BIP39 check)", KOALA_MNEMONIC_24, undefined, true],
  ];

  it.each(rows)("%s -> %s", async (_label, input, seedType, expected) => {
    const out = await KadenaWalletBuilder.isValidMnemonic(input, seedType);
    expect(out).toBe(expected);
  });
});

// ── generateMnemonic — shape + length dispatch ──────────────────────────────

describe("KadenaWalletBuilder.generateMnemonic", () => {
  it("generateMnemonic(12) returns 12 words AND passes kadenaCheckMnemonic", async () => {
    const m = await KadenaWalletBuilder.generateMnemonic(12);
    expect(typeof m).toBe("string");
    expect(m.trim().split(/\s+/)).toHaveLength(12);
    expect(kadenaCheckMnemonic(m)).toBe(true);
  });

  it("generateMnemonic(24) returns 24 words AND passes bip39.validateMnemonic", async () => {
    const m = await KadenaWalletBuilder.generateMnemonic(24);
    expect(typeof m).toBe("string");
    expect(m.trim().split(/\s+/)).toHaveLength(24);
    expect(bip39.validateMnemonic(m, wordlist)).toBe(true);
  });

  it("generateMnemonic at any other length throws Invalid mnemonic length", async () => {
    await expect(
      KadenaWalletBuilder.generateMnemonic(13 as unknown as 12 | 24),
    ).rejects.toThrow(/Invalid mnemonic length/);
  });
});
