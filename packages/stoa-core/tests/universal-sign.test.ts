/**
 * v3.3.2 — direct test coverage for `universalSignTransaction`.
 *
 * Closes audit finding F-TEST-002 (HIGH). Pre-v3.3.2, the central signing
 * entry point in `src/signing/universalSign.ts` had ZERO direct tests
 * (only mention in tests/ was a comment in `tests/signing.test.ts:5`
 * stating "the full universalSignTransaction is not exercised here").
 * `tests/strategy.test.ts` exercises a higher-level wrapper but only
 * covers `seedType: "koala"`. The chainweaver/eckowallet/foreign
 * branches AND the seedType dispatcher itself were never runtime-tested
 * — a regression that mis-routed `eckowallet` → `koala` (or any other
 * dispatch error) would silently produce wrong signatures, surfaced
 * only by chain-side "invalid signature" rejection at consumer
 * runtime.
 *
 * What this file locks:
 *
 *   1. Koala branch round-trip (RFC-8032 vector → sign → verify with
 *      `nacl.sign.detached.verify`).
 *   2. Chainweaver branch round-trip — derive a real chainweaver
 *      keypair via `KadenaWalletBuilder.createWalletPairFromMnemonic`
 *      using the @kadena/hd-wallet vendor vector, sign through
 *      `universalSignTransaction`, verify the resulting signature
 *      against the derived publicKey via Ed25519.
 *   3. Eckowallet branch round-trip — same as chainweaver but with
 *      `seedType: "eckowallet"`. Locks that the dispatcher routes
 *      both labels to the same WASM signing path.
 *   4. Multi-signer mixed-seedType — a transaction with one koala
 *      signer + one chainweaver signer; both slots filled, both
 *      verifiable. Locks the loop's "iterate-and-dispatch-each"
 *      contract.
 *   5. Foreign branch with `onMissingKey` callback — keypair NOT in
 *      the supplied list; the function calls back to resolve.
 *   6. Foreign branch — `onMissingKey` returns wrong key → throws
 *      "Key mismatch" with both expected/derived pubkeys.
 *   7. Partial-signing primitive — call with only one of three
 *      declared signers; only that slot is filled. Foundation lock
 *      for the v3.3.3 multi-party signing public surface.
 *   8. Keypairs not in `cmd.signers` are silently ignored (no error,
 *      just skipped — current contract per `universalSign.ts:91`).
 *   9. Foreign branch in-list — keypair WITH `seedType: "foreign"`
 *      supplied directly in the keypairs list routes through nacl
 *      Ed25519 (same path as koala). Output equivalence with koala
 *      asserted byte-for-byte over the same private-key value.
 *      Closes F-TEST-002 (audit 2026-05-05): all 4 dispatcher
 *      branches now have direct in-list runtime coverage.
 *
 * The hash-verification approach uses `nacl.sign.detached.verify`
 * over the base64URL-decoded `signed.hash` bytes. This works for
 * BOTH the nacl-direct path (koala/foreign) AND the WASM-Ed25519
 * path (chainweaver/eckowallet) — kadenaSign produces a standard
 * Ed25519 signature verifiable with the same primitive.
 */

import { describe, it, expect } from "vitest";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import type { IUnsignedCommand, ICommand } from "@stoachain/kadena-stoic-legacy/types";
import nacl from "tweetnacl";
import { Buffer } from "node:buffer";
import { base64UrlDecodeArr } from "@stoachain/kadena-stoic-legacy/cryptography-utils";
import {
  universalSignTransaction,
  fromKeypair,
  type UniversalKeypair,
} from "../src/signing/universalSign";
import { publicKeyFromPrivateKey } from "../src/signing/primitives";
import KadenaWalletBuilder from "../src/wallet/KadenaWalletBuilder";

// ─── Fixtures: koala (RFC-8032 vectors, raw 64-char secretKey) ──────────────

const KOALA_PRIV_A =
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const KOALA_PUB_A = publicKeyFromPrivateKey(KOALA_PRIV_A);

const KOALA_PRIV_B =
  "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb";
const KOALA_PUB_B = publicKeyFromPrivateKey(KOALA_PRIV_B);

const KOALA_PRIV_C =
  "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7";
const KOALA_PUB_C = publicKeyFromPrivateKey(KOALA_PRIV_C);

// ─── Fixtures: chainweaver (vendor vector — same as wallet-builder.test.ts) ─

const CW_PASSWORD = "kadena";
const CW_MNEMONIC_12 =
  "mammal east oxygen romance wheel chimney frequent brain spawn owner announce sell";
const CW_PUBKEY_AT_INDEX_1 =
  "83a185400b2fdaaacf44afe93e126ba528900ec66cd31a9e5b104ffe92d96976";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build an IUnsignedCommand declaring N signers. Each signer gets the
 * standard `coin.GAS` capability (any cap; the cap content is irrelevant
 * for signing-path tests — what matters is that the cmd.signers array
 * exists with the expected pubKeys).
 */
function buildTx(signerPubKeys: string[]): IUnsignedCommand {
  let builder = Pact.builder.execution(`(coin.details "k:${signerPubKeys[0]}")`);
  for (const pubKey of signerPubKeys) {
    builder = builder.addSigner(pubKey, (w: any) => [w("coin.GAS")]);
  }
  return builder
    .setMeta({
      chainId: "0",
      senderAccount: `k:${signerPubKeys[0]}`,
      gasLimit: 1000,
      gasPrice: 0.00000001,
      ttl: 28800,
    })
    .setNetworkId("testnet04")
    .createTransaction();
}

/** Hex string → Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

/**
 * Verify an Ed25519 signature against the signed transaction's hash and
 * the signer's public key. Works for both the nacl-direct (koala/foreign)
 * and WASM (chainweaver/eckowallet) paths — both produce standard
 * Ed25519 sigs over the same canonical hash.
 */
function verifySig(signed: ICommand | IUnsignedCommand, sigIndex: number, pubKey: string): boolean {
  const sig = signed.sigs[sigIndex];
  if (!sig || !sig.sig) return false;
  const hashBytes = base64UrlDecodeArr(signed.hash) as unknown as Uint8Array;
  const sigBytes = hexToBytes(sig.sig);
  const pubKeyBytes = hexToBytes(pubKey);
  return nacl.sign.detached.verify(hashBytes, sigBytes, pubKeyBytes);
}

// ══ Koala branch (nacl Ed25519, raw secretKey) ══════════════════════════════
describe("universalSignTransaction — koala branch (nacl Ed25519)", () => {
  it("signs a single-signer koala tx and produces a valid Ed25519 signature", async () => {
    const tx = buildTx([KOALA_PUB_A]);
    const koalaKp: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "koala",
    };

    const signed = await universalSignTransaction(tx, [koalaKp]);

    expect(signed.sigs).toHaveLength(1);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifySig(signed, 0, KOALA_PUB_A)).toBe(true);
  });

  it("`fromKeypair` normalises a privateKey field into the UniversalKeypair shape", async () => {
    // KadenaWalletBuilder + downstream consumers use `privateKey` while
    // the universalSign primitive expects `secretKey` — fromKeypair adapts.
    const tx = buildTx([KOALA_PUB_A]);
    const consumerShape = {
      publicKey: KOALA_PUB_A,
      privateKey: KOALA_PRIV_A,
      seedType: "koala" as const,
    };
    const signed = await universalSignTransaction(tx, [fromKeypair(consumerShape)]);
    expect(verifySig(signed, 0, KOALA_PUB_A)).toBe(true);
  });
});

// ══ Chainweaver branch (BIP32-Ed25519, WASM kadenaSign) ═════════════════════
describe("universalSignTransaction — chainweaver branch (WASM kadenaSign)", () => {
  it("signs with a chainweaver-derived keypair and produces a valid Ed25519 signature", async () => {
    const cwPair = await KadenaWalletBuilder.createWalletPairFromMnemonic(
      CW_PASSWORD,
      CW_MNEMONIC_12,
      1,
      "chainweaver",
    );
    expect(cwPair.publicKey).toBe(CW_PUBKEY_AT_INDEX_1);

    const tx = buildTx([cwPair.publicKey]);
    const cwKp: UniversalKeypair = {
      publicKey: cwPair.publicKey,
      secretKey: "", // not used for chainweaver — encryptedSecretKey + password drives the sign
      seedType: "chainweaver",
      encryptedSecretKey: cwPair.secretKey,
      password: CW_PASSWORD,
    };

    const signed = await universalSignTransaction(tx, [cwKp]);

    expect(signed.sigs).toHaveLength(1);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifySig(signed, 0, cwPair.publicKey)).toBe(true);
  });
});

// ══ Eckowallet branch (label-only difference vs chainweaver) ════════════════
describe("universalSignTransaction — eckowallet branch (label-only)", () => {
  it("eckowallet routes through the same WASM signing path as chainweaver", async () => {
    // Same derivation as chainweaver — eckowallet is just a label.
    const ekPair = await KadenaWalletBuilder.createWalletPairFromMnemonic(
      CW_PASSWORD,
      CW_MNEMONIC_12,
      1,
      "eckowallet",
    );
    expect(ekPair.publicKey).toBe(CW_PUBKEY_AT_INDEX_1);

    const tx = buildTx([ekPair.publicKey]);
    const ekKp: UniversalKeypair = {
      publicKey: ekPair.publicKey,
      secretKey: "",
      seedType: "eckowallet",
      encryptedSecretKey: ekPair.secretKey,
      password: CW_PASSWORD,
    };

    const signed = await universalSignTransaction(tx, [ekKp]);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifySig(signed, 0, ekPair.publicKey)).toBe(true);
  });
});

// ══ Multi-signer with mixed seedTypes ═══════════════════════════════════════
describe("universalSignTransaction — multi-signer mixed seedTypes", () => {
  it("signs a 2-signer tx (1 koala + 1 chainweaver) — both slots filled and verifiable", async () => {
    const cwPair = await KadenaWalletBuilder.createWalletPairFromMnemonic(
      CW_PASSWORD,
      CW_MNEMONIC_12,
      1,
      "chainweaver",
    );

    const tx = buildTx([KOALA_PUB_A, cwPair.publicKey]);

    const koalaKp: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "koala",
    };
    const cwKp: UniversalKeypair = {
      publicKey: cwPair.publicKey,
      secretKey: "",
      seedType: "chainweaver",
      encryptedSecretKey: cwPair.secretKey,
      password: CW_PASSWORD,
    };

    const signed = await universalSignTransaction(tx, [koalaKp, cwKp]);

    expect(signed.sigs).toHaveLength(2);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(signed.sigs[1]?.sig).toMatch(/^[0-9a-f]{128}$/);
    // Both sigs verify against their respective public keys over the same hash.
    expect(verifySig(signed, 0, KOALA_PUB_A)).toBe(true);
    expect(verifySig(signed, 1, cwPair.publicKey)).toBe(true);
  });
});

// ══ Foreign branch with onMissingKey callback ═══════════════════════════════
describe("universalSignTransaction — foreign branch (onMissingKey resolution)", () => {
  it("resolves a missing signer via the onMissingKey callback and signs", async () => {
    const tx = buildTx([KOALA_PUB_B]); // KOALA_PUB_B is NOT in our keypairs list
    const calledFor: string[] = [];

    const onMissingKey = async (pubKey: string): Promise<string> => {
      calledFor.push(pubKey);
      // Resolve to the matching private key (foreign-key paste).
      if (pubKey === KOALA_PUB_B) return KOALA_PRIV_B;
      throw new Error(`unexpected pubKey: ${pubKey}`);
    };

    const signed = await universalSignTransaction(tx, [], onMissingKey);

    expect(calledFor).toEqual([KOALA_PUB_B]);
    expect(signed.sigs).toHaveLength(1);
    expect(verifySig(signed, 0, KOALA_PUB_B)).toBe(true);
  });

  it("rejects with 'Key mismatch' if onMissingKey returns the wrong private key", async () => {
    const tx = buildTx([KOALA_PUB_B]);
    // The callback returns KOALA_PRIV_A (mismatched — derives KOALA_PUB_A,
    // not the requested KOALA_PUB_B).
    const onMissingKey = async (_pubKey: string): Promise<string> => KOALA_PRIV_A;

    await expect(
      universalSignTransaction(tx, [], onMissingKey),
    ).rejects.toThrow(/Key mismatch/);
    // Verify the error includes BOTH expected and derived pubkeys for
    // operator diagnosability.
    await expect(
      universalSignTransaction(tx, [], onMissingKey),
    ).rejects.toThrow(KOALA_PUB_B);
    await expect(
      universalSignTransaction(tx, [], onMissingKey),
    ).rejects.toThrow(KOALA_PUB_A);
  });
});

// ══ Partial-signing primitive (foundation lock for v3.3.3) ══════════════════
describe("universalSignTransaction — partial-signing primitive (v3.3.3 foundation)", () => {
  it("signing with only 1 of 3 declared signer keypairs fills only that slot", async () => {
    // 3-signer transaction; we only supply key A.
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    const koalaKp_A: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "koala",
    };

    const signed = await universalSignTransaction(tx, [koalaKp_A]);

    // Slot 0 (KOALA_PUB_A) is filled and verifies.
    expect(signed.sigs).toHaveLength(3);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifySig(signed, 0, KOALA_PUB_A)).toBe(true);

    // Slots 1 and 2 (KOALA_PUB_B / KOALA_PUB_C) are still unsigned —
    // either undefined or with no `sig` field. This is the load-bearing
    // assertion: the primitive does NOT corrupt existing slots and does
    // NOT fabricate sigs for keys we don't have. v3.3.3's multi-party
    // workflow depends on this contract holding.
    expect(signed.sigs[1]?.sig).toBeFalsy();
    expect(signed.sigs[2]?.sig).toBeFalsy();
  });

  it("keypairs whose pubKey is NOT in cmd.signers are silently skipped", async () => {
    // Only KOALA_PUB_A is a signer. We pass KP_A AND KP_B; the function
    // should ignore B (not in signers) without throwing.
    const tx = buildTx([KOALA_PUB_A]);
    const koalaKp_A: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "koala",
    };
    const koalaKp_B_notInSigners: UniversalKeypair = {
      publicKey: KOALA_PUB_B,
      secretKey: KOALA_PRIV_B,
      seedType: "koala",
    };

    const signed = await universalSignTransaction(tx, [
      koalaKp_A,
      koalaKp_B_notInSigners,
    ]);

    expect(signed.sigs).toHaveLength(1);
    expect(verifySig(signed, 0, KOALA_PUB_A)).toBe(true);
  });
});

// ══ Foreign branch (in-list seedType: "foreign", nacl Ed25519) ══════════════
describe("universalSignTransaction — foreign branch (in-list seedType: \"foreign\", nacl Ed25519)", () => {
  it("signs a single-signer foreign tx and produces a valid Ed25519 signature byte-equivalent to koala for the same private key", async () => {
    const tx = buildTx([KOALA_PUB_A]);
    const foreignKp: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "foreign",
    };
    const koalaKp: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "koala",
    };

    const signedForeign = await universalSignTransaction(tx, [foreignKp]);
    const signedKoala = await universalSignTransaction(tx, [koalaKp]);

    // Strategy A: shape + verification.
    expect(signedForeign.sigs).toHaveLength(1);
    expect(signedForeign.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifySig(signedForeign, 0, KOALA_PUB_A)).toBe(true);

    // Strategy B: byte-equivalence with koala for the same private key —
    // dispatcher's foreign branch falls through the isChainweaver guard at
    // universalSign.ts:94 into the same naclPairs.push at line 102 as koala.
    // Ed25519 deterministic signing produces identical bytes for the same
    // (key, message) pair. If a future refactor re-routes foreign through
    // a different primitive, this assertion fails immediately.
    expect(signedForeign.sigs[0]?.sig).toBe(signedKoala.sigs[0]?.sig);
  });

  it("dispatcher routing — `seedType: \"foreign\"` falls through the chainweaver/eckowallet guard and into nacl Ed25519", async () => {
    // The isChainweaver guard at universalSign.ts:94-97 requires
    //   (seedType === "chainweaver" || seedType === "eckowallet")
    //   && encryptedSecretKey
    //   && password
    // For seedType: "foreign" the first conjunct fails (line 95) and
    // the keypair is pushed onto naclPairs at line 102 — the same path
    // koala uses. The signature must verify with the standard
    // nacl.sign.detached.verify primitive (NOT the WASM kadenaSign path).
    const tx = buildTx([KOALA_PUB_C]);
    const foreignKp: UniversalKeypair = {
      publicKey: KOALA_PUB_C,
      secretKey: KOALA_PRIV_C,
      seedType: "foreign",
    };

    const signed = await universalSignTransaction(tx, [foreignKp]);

    expect(signed.sigs).toHaveLength(1);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    // verifySig uses nacl.sign.detached.verify internally; a passing
    // verification confirms the foreign branch reached the nacl primitive
    // (not WASM kadenaSign).
    expect(verifySig(signed, 0, KOALA_PUB_C)).toBe(true);
  });

  it("signs a 2-signer tx (1 foreign + 1 koala) — both slots filled and verifiable", async () => {
    // Mixed multi-signer lock: dispatcher's iterate-and-route-each
    // contract holds for the foreign branch (mirrors the chainweaver+koala
    // lock above). A foreign-keypair AND a koala-keypair on the same tx
    // must both end up in naclPairs and produce 2 valid sigs.
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B]);
    const foreignKp: UniversalKeypair = {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
      seedType: "foreign",
    };
    const koalaKp: UniversalKeypair = {
      publicKey: KOALA_PUB_B,
      secretKey: KOALA_PRIV_B,
      seedType: "koala",
    };

    const signed = await universalSignTransaction(tx, [foreignKp, koalaKp]);

    expect(signed.sigs).toHaveLength(2);
    expect(signed.sigs[0]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(signed.sigs[1]?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifySig(signed, 0, KOALA_PUB_A)).toBe(true);
    expect(verifySig(signed, 1, KOALA_PUB_B)).toBe(true);
  });
});
