/**
 * wallet-builder-stoic.test.ts -- KadenaWalletBuilder.createWalletPairFromDalosBitString
 * coverage: the "stoic" SeedType's bitstring-based Chainweb derivation.
 *
 * The surface under test is the NEW derivation entry point added to
 * `src/wallet/KadenaWalletBuilder.ts` alongside `createWalletPair` and
 * `createWalletPairFromMnemonic`. Unlike those two, "stoic" is not a
 * mnemonic flow: it derives directly from an already-validated 1600-bit
 * DALOS Genesis seed bitstring + an index via
 * `@ouronet/dalos-crypto/chainweb`'s `generateFromBitStringAtIndex`.
 *
 * Frozen test-vector corpus: a cross-language (Go <-> TypeScript) verified
 * corpus exists at `@ouronet/dalos-crypto`'s SOURCE repo,
 * `OuroborosNetwork/_libs/DALOS_Crypto/testvectors/v4_chainweb_ed25519.json`
 * (also exercised by that repo's own
 * `ts/tests/chainweb/chainweb-corpus.test.ts`). That corpus is NOT shipped
 * inside the published `@ouronet/dalos-crypto` npm tarball -- the package's
 * `files` field is `["dist/**\/*.js", "dist/**\/*.d.ts", "README.md",
 * "LICENSE", "CHANGELOG.md"]`, confirmed by inspecting
 * `node_modules/@ouronet/dalos-crypto/package.json` and the installed
 * tree after bumping to 4.5.1 -- no `testvectors/` directory is present
 * there. A handful of vectors are therefore pinned verbatim below (same
 * "lift literal values from a known-good external source into a local
 * constant" discipline this file's sibling `wallet-builder.test.ts` already
 * uses for its Chainweaver vendor vectors), rather than reading the JSON
 * from a path outside this repo's own tree.
 *
 * cw-01/cw-02/cw-03 share ONE seed bitstring at indices 0/1/2 -- the
 * load-bearing proof that indexed generation is genuinely independent per
 * index. cw-04/cw-05 share a second seed at indices 0 and 7 -- proof that a
 * later index is directly reachable without deriving the ones before it.
 */

import { describe, it, expect } from "vitest";
import KadenaWalletBuilder from "../src/wallet/KadenaWalletBuilder";
import { generateFromBitStringAtIndex } from "@ouronet/dalos-crypto/chainweb";
import type { SeedType } from "../src/wallet/types";

// ── Frozen corpus vectors, pinned from
// OuroborosNetwork/_libs/DALOS_Crypto/testvectors/v4_chainweb_ed25519.json
// (schema_version 1, generated_at_utc 2026-09-14T14:11:16Z) ─────────────────

const SEED_A =
  "0111001000100111010100101000001000111011111111110010100001010000111111011111000000110110011100000101011011100111110110101010001101001111110000001111010101110100100100001000111101101101111010100001110100001001001100111111001100111000000001011111001110001010010010101010100100010000011100100000000011000110100010010011001011110000000110100110101010100011110100111011110010001000000010000000110101110000101011001111111000010110010001111001000000110010101001101100110111111001000000101101110010111111000001100101001100000010111111111111101111110100011110011011010111011110111011011100010110100100001011100001011100000010000101010110110111000011001111111011000001010001010101000110101010010010111101011011100011110001111000111101111111101101010001110110010010000010011101110110111011001111010110000000000110000111011010011111001010100110101001101111100101101001111111011010111000011111100001110001110000011001101011011111110011101100001100011000010110101110101111111011101110100011110100011100100110101110110010001111011010111010000100000100101110000101110101100000011000110001110110101010001010001011000111111110110011101101111110110101001000000010011100011111011101100001000101010011111000010010110000010111010101111010101010010001001110001110110111101011001111101011101101111100100100010101101111010010111101010010010101011010100100110010101011101100110110101110101100100000011101100100101111001001001011000001111000110000111010110010011101100110101110110000101101100001001110001001011100010110000000101101010111100001100000011111110100010101011011110110101011110011011111001000011111101000100010111000";

const SEED_B =
  "1100110010010111001001010001010011111011100100010100101111000100010111010110100101101100000010100100010010011011111101010101000011011000010101110101001111001101001010001110011000101111110011010001101011101011011110010101110101100110101010010001000100111011100101000111110011100001101011101001100111011100000011010001110000001000010111000001101110101111110011101111111000111110110100110111011110100001000010001000100011011111110100111111010001101001011000010100001100110011100111011000100000110000111111111100111010011111000110110111011100001110111111101101011000010110000001001011011010000100111011101000011011000001111001010010111111001110010100111011000010110111011110010111111110010101100000010110011010000001000001110101001111000000001111111110100010100111000000100011101110110001110100101001000011011001010000010001100000110001111101011100010110010110111110111001000110011000000001001010111010011010011010000001000101110010001010100111010111011111111011110000110011111101011000111001111100101001001111111101111111111100";

interface FrozenVector {
  readonly seed: string;
  readonly index: number;
  readonly privateKeyHex: string;
  readonly publicKeyHex: string;
  readonly address: string;
}

// cw-01, cw-02, cw-03 (SEED_A, indices 0/1/2)
const CW_01: FrozenVector = {
  seed: SEED_A,
  index: 0,
  privateKeyHex: "84bc6882ea28ce71b1254b9f6dd70a323a2d2e6a5dd9e47012fa06d4b8ebe6eb",
  publicKeyHex: "571bf148910b25556e3a12970fd561cb3c79e1a407403dcdbec482a86df1e8eb",
  address: "k:571bf148910b25556e3a12970fd561cb3c79e1a407403dcdbec482a86df1e8eb",
};
const CW_02: FrozenVector = {
  seed: SEED_A,
  index: 1,
  privateKeyHex: "7463ca4d332d6ec960d3e8f820cbfab4529a856f50d865186be9e0908d49639a",
  publicKeyHex: "7f9e904fd74b17916724989f1bd7b355fce29b032185dfc54fb3f54028805d54",
  address: "k:7f9e904fd74b17916724989f1bd7b355fce29b032185dfc54fb3f54028805d54",
};
const CW_03: FrozenVector = {
  seed: SEED_A,
  index: 2,
  privateKeyHex: "21d6265428d3a60fb89dca0b7b351958f1f55070128e06592a3cd8cc4bbd6707",
  publicKeyHex: "ca892be96ab9668c4d9ffe3769bcc75452c933d451c0a3cfd3ed884b060163ae",
  address: "k:ca892be96ab9668c4d9ffe3769bcc75452c933d451c0a3cfd3ed884b060163ae",
};

// cw-04, cw-05 (SEED_B, indices 0/7 -- index 7 reachable without deriving 1-6)
const CW_04: FrozenVector = {
  seed: SEED_B,
  index: 0,
  privateKeyHex: "22b82e5197fa8a5474c39adc9f0e712f4e605eaaac1351633584e5d747d18e09",
  publicKeyHex: "1c959d84648c4edec953c6a2bb2689340cb2c9ffdb2c8fa39572cefc938cb7bc",
  address: "k:1c959d84648c4edec953c6a2bb2689340cb2c9ffdb2c8fa39572cefc938cb7bc",
};
const CW_05: FrozenVector = {
  seed: SEED_B,
  index: 7,
  privateKeyHex: "7118173e3d18a4eac882cc8570e7a5628b5d23555ba4d60d52883f83aceac290",
  publicKeyHex: "6db56b36b4996a8545fe8e63f66b8ffd147775001dfa5933e5e13f9cbf97328a",
  address: "k:6db56b36b4996a8545fe8e63f66b8ffd147775001dfa5933e5e13f9cbf97328a",
};

const FROZEN_VECTORS = [CW_01, CW_02, CW_03, CW_04, CW_05];

// ── Frozen corpus byte-identity ──────────────────────────────────────────────

describe("KadenaWalletBuilder.createWalletPairFromDalosBitString -- frozen corpus", () => {
  it.each(FROZEN_VECTORS.map((v) => [v.index, v] as const))(
    "reproduces the frozen corpus's private key, public key, and address exactly at index %i",
    (_index, vector) => {
      const result = KadenaWalletBuilder.createWalletPairFromDalosBitString(
        vector.seed,
        vector.index,
      );

      expect(result.secretKey).toBe(vector.privateKeyHex);
      expect(result.publicKey).toBe(vector.publicKeyHex);
      expect(result.address).toBe(vector.address);
      expect(result.address).toMatch(/^k:[0-9a-f]{64}$/);
    },
  );

  it("wraps generateFromBitStringAtIndex byte-identically (re-derived independently in this test)", () => {
    const direct = generateFromBitStringAtIndex(SEED_A, 0);
    const wrapped = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_A, 0);

    const directPublicHex = Array.from(direct.publicKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const directPrivateHex = Array.from(direct.privateKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(wrapped.publicKey).toBe(directPublicHex);
    expect(wrapped.secretKey).toBe(directPrivateHex);
    expect(wrapped.address).toBe(direct.address);
  });
});

// ── index=0 vs index=1 on the same bitstring: different, independent accounts ─

describe("KadenaWalletBuilder.createWalletPairFromDalosBitString -- index independence", () => {
  it("index 0 and index 1 on the SAME bitstring produce different, independently-valid accounts", () => {
    const at0 = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_A, 0);
    const at1 = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_A, 1);

    expect(at0.address).not.toBe(at1.address);
    expect(at0.publicKey).not.toBe(at1.publicKey);
    expect(at0.secretKey).not.toBe(at1.secretKey);

    // Both independently well-formed k: accounts.
    expect(at0.address).toMatch(/^k:[0-9a-f]{64}$/);
    expect(at1.address).toMatch(/^k:[0-9a-f]{64}$/);

    // And both match the frozen corpus (cw-01 / cw-02), so "different" here
    // is a real derivation difference, not an accidental collision miss.
    expect(at0).toMatchObject({ publicKey: CW_01.publicKeyHex, address: CW_01.address });
    expect(at1).toMatchObject({ publicKey: CW_02.publicKeyHex, address: CW_02.address });
  });

  it("a later index (7) is directly reachable without deriving earlier indices first", () => {
    const at0 = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_B, 0);
    const at7 = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_B, 7);

    expect(at0.address).toBe(CW_04.address);
    expect(at7.address).toBe(CW_05.address);
    expect(at0.address).not.toBe(at7.address);
  });
});

// ── Determinism ──────────────────────────────────────────────────────────────

describe("KadenaWalletBuilder.createWalletPairFromDalosBitString -- determinism", () => {
  it("the same (bitString, index) pair produces byte-identical output on every call", () => {
    const first = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_A, 2);
    const second = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_A, 2);
    const third = KadenaWalletBuilder.createWalletPairFromDalosBitString(SEED_A, 2);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(first.address).toBe(CW_03.address);
  });
});

// ── "stoic" SeedType acceptance ──────────────────────────────────────────────

describe('SeedType accepts "stoic"', () => {
  it("a function typed to accept SeedType accepts the literal \"stoic\" without a type error", () => {
    function acceptsSeedType(seedType: SeedType): SeedType {
      return seedType;
    }

    const result = acceptsSeedType("stoic");
    expect(result).toBe("stoic");
  });

  it("KadenaWalletBuilder.isValidMnemonic(mnemonic, \"stoic\") returns false -- stoic has no mnemonic to validate", async () => {
    const out = await KadenaWalletBuilder.isValidMnemonic("anything at all", "stoic");
    expect(out).toBe(false);
  });
});
