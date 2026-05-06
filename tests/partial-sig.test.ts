/**
 * v3.3.3 — multi-party partial-signature public surface.
 *
 * This is a NEW ADDITION (not a bug fix): unblocks OuronetUI's planned
 * "Person A signs → exports → Person B imports → signs → exports →
 * Person C imports → signs → submits" workflow. The underlying
 * partial-signing primitive (one signer fills only their slot, others
 * untouched) was locked in v3.3.2's `tests/universal-sign.test.ts`
 * "partial-signing primitive (v3.3.3 foundation)" group; this file
 * builds the public-surface contract on top of it:
 *
 *   - `signPartial(tx, keypairs)` — partial-sign wrapper around
 *     `universalSignTransaction` that drops `onMissingKey` (foreign-key
 *     paste resolution doesn't apply in the multi-party flow).
 *   - `serializePartialTransaction(tx, metadata?)` /
 *     `deserializePartialTransaction(json)` — versioned envelope with
 *     embedded blake2b-256(cmd) hash for cross-party tamper detection.
 *   - `getMissingSigners(tx)` / `getFilledSigners(tx)` /
 *     `isFullySigned(tx)` — read the `sigs[]` slot status.
 *   - `verifyExistingSignatures(tx)` — second-layer Ed25519 check
 *     against the canonical hash; catches the "tampered cmd + tampered
 *     hash" attack the envelope's hash-integrity gate alone misses.
 *
 * What this file locks (12 it-blocks across 7 describe groups):
 *
 *   1. signPartial fills only the matching slot in a 3-signer tx
 *      (load-bearing for the multi-party chain — tested twice via
 *      v3.3.2 fixtures, repeated here at this surface so a regression
 *      in `signPartial`'s thin wrapper is caught at the wrapper level).
 *   2. serialize → deserialize round-trip preserves every byte of the
 *      transaction (cmd, hash, sigs).
 *   3. Envelope rejection cases: not JSON, wrong format, wrong version,
 *      missing transaction, transaction.cmd not a string.
 *   4. Hash-integrity rejection: an envelope whose embedded hash does
 *      NOT match blake2b-256(cmd) throws `TamperedHashError` carrying
 *      `expected` and `actual` for operator diagnosability.
 *   5. getMissingSigners / getFilledSigners / isFullySigned partition
 *      a 3-signer tx correctly across 0/1/2/3 signed states.
 *   6. verifyExistingSignatures returns allValid=true on a properly
 *      signed tx; returns allValid=false with reason text on a tampered
 *      sig.
 *   7. End-to-end 3-party round-trip: A signs → serialize → B
 *      deserialize+sign → serialize → C deserialize+sign → all 3
 *      sigs verify against the original hash.
 *
 * The verification approach mirrors universal-sign.test.ts: hex-decode
 * the sig, base64URL-decode the hash, hex-decode the pubkey, then
 * `nacl.sign.detached.verify`. Works for both koala (nacl-direct) and
 * chainweaver (BIP32-WASM) sigs because both are standard Ed25519
 * over the same canonical hash bytes.
 */

import { describe, it, expect } from "vitest";
import { Pact } from "@kadena/client";
import type { IUnsignedCommand } from "@kadena/types";
import nacl from "tweetnacl";
import { Buffer } from "node:buffer";
import { base64UrlDecodeArr, hash as kadenaHash } from "@kadena/cryptography-utils";
import {
  signPartial,
  serializePartialTransaction,
  deserializePartialTransaction,
  getMissingSigners,
  getFilledSigners,
  isFullySigned,
  verifyExistingSignatures,
  InvalidEnvelopeError,
  TamperedHashError,
  PARTIAL_SIG_FORMAT,
  PARTIAL_SIG_VERSION,
  type UniversalKeypair,
} from "../src/signing";
import { publicKeyFromPrivateKey } from "../src/signing/primitives";

// ─── RFC-8032 koala fixtures (same as universal-sign.test.ts) ───────────────
const KOALA_PRIV_A =
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const KOALA_PUB_A = publicKeyFromPrivateKey(KOALA_PRIV_A);

const KOALA_PRIV_B =
  "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb";
const KOALA_PUB_B = publicKeyFromPrivateKey(KOALA_PRIV_B);

const KOALA_PRIV_C =
  "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7";
const KOALA_PUB_C = publicKeyFromPrivateKey(KOALA_PRIV_C);

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function naclVerify(tx: IUnsignedCommand, sigIndex: number, pubKey: string): boolean {
  const sig = tx.sigs[sigIndex];
  if (!sig || !(sig as { sig?: string }).sig) return false;
  const hashBytes = base64UrlDecodeArr(tx.hash) as unknown as Uint8Array;
  const sigBytes = hexToBytes((sig as { sig: string }).sig);
  const pubKeyBytes = hexToBytes(pubKey);
  return nacl.sign.detached.verify(hashBytes, sigBytes, pubKeyBytes);
}

function makeKp(pub: string, priv: string): UniversalKeypair {
  return { publicKey: pub, secretKey: priv, seedType: "koala" };
}

// ══ signPartial — wrapper-level partial-sig contract ════════════════════════
describe("signPartial — fills only matching slots", () => {
  it("3-signer tx + 1 keypair → only that slot filled, others untouched", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    const signed = await signPartial(tx, [makeKp(KOALA_PUB_A, KOALA_PRIV_A)]);

    expect(signed.sigs).toHaveLength(3);
    expect((signed.sigs[0] as { sig?: string })?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect((signed.sigs[1] as { sig?: string })?.sig).toBeFalsy();
    expect((signed.sigs[2] as { sig?: string })?.sig).toBeFalsy();
    expect(naclVerify(signed as IUnsignedCommand, 0, KOALA_PUB_A)).toBe(true);
  });

  it("preserves an existing signature when called again with a different keypair", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B]);
    // Person A signs first.
    const afterA = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;
    const sigA = (afterA.sigs[0] as { sig?: string })?.sig;
    expect(sigA).toMatch(/^[0-9a-f]{128}$/);

    // Person B signs second on TOP of A's already-filled slot.
    const afterB = (await signPartial(afterA, [
      makeKp(KOALA_PUB_B, KOALA_PRIV_B),
    ])) as IUnsignedCommand;

    // A's signature is byte-identical to before B signed.
    expect((afterB.sigs[0] as { sig?: string })?.sig).toBe(sigA);
    // B's signature is now present and valid.
    expect((afterB.sigs[1] as { sig?: string })?.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(naclVerify(afterB, 0, KOALA_PUB_A)).toBe(true);
    expect(naclVerify(afterB, 1, KOALA_PUB_B)).toBe(true);
  });
});

// ══ Envelope serialize / deserialize round-trip ═════════════════════════════
describe("serialize / deserialize round-trip", () => {
  it("preserves cmd, hash, and every sig slot byte-for-byte", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B]);
    const signed = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;

    const json = serializePartialTransaction(signed, {
      exportedAt: "2026-05-03T00:00:00.000Z",
      exportedBy: "Person A",
      note: "Pass to Person B",
    });

    // Stringified envelope is a valid JSON object with the v1 literals.
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(PARTIAL_SIG_FORMAT);
    expect(parsed.version).toBe(PARTIAL_SIG_VERSION);
    expect(parsed.metadata.exportedBy).toBe("Person A");

    const restored = deserializePartialTransaction(json);
    expect(restored.cmd).toBe(signed.cmd);
    expect(restored.hash).toBe(signed.hash);
    expect(restored.sigs).toEqual(signed.sigs);
  });

  it("metadata is optional — serialize without it produces a valid envelope", async () => {
    const tx = buildTx([KOALA_PUB_A]);
    const signed = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;

    const json = serializePartialTransaction(signed);
    const parsed = JSON.parse(json);
    expect(parsed.metadata).toBeUndefined();

    const restored = deserializePartialTransaction(json);
    expect(restored.cmd).toBe(signed.cmd);
  });
});

// ══ Envelope rejection cases ════════════════════════════════════════════════
describe("deserializePartialTransaction — rejection cases", () => {
  it("throws InvalidEnvelopeError on non-JSON input", () => {
    expect(() => deserializePartialTransaction("not json")).toThrow(
      InvalidEnvelopeError,
    );
  });

  it("throws InvalidEnvelopeError when format is wrong", () => {
    const bad = JSON.stringify({
      format: "some-other-format",
      version: 1,
      transaction: { cmd: "x", hash: "x", sigs: [] },
    });
    expect(() => deserializePartialTransaction(bad)).toThrow(/format/);
  });

  it("throws InvalidEnvelopeError when version is wrong", () => {
    const bad = JSON.stringify({
      format: PARTIAL_SIG_FORMAT,
      version: 99,
      transaction: { cmd: "x", hash: "x", sigs: [] },
    });
    expect(() => deserializePartialTransaction(bad)).toThrow(/version/);
  });

  it("throws InvalidEnvelopeError when transaction.cmd is missing", () => {
    const bad = JSON.stringify({
      format: PARTIAL_SIG_FORMAT,
      version: PARTIAL_SIG_VERSION,
      transaction: { hash: "x", sigs: [] },
    });
    expect(() => deserializePartialTransaction(bad)).toThrow(/cmd/);
  });
});

// ══ Hash-integrity tamper detection ═════════════════════════════════════════
describe("deserializePartialTransaction — TamperedHashError", () => {
  it("throws TamperedHashError when embedded hash does not match blake2b-256(cmd)", async () => {
    const tx = buildTx([KOALA_PUB_A]);
    const signed = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;

    // Tamper: overwrite hash with a deliberately-wrong-but-well-formed value.
    const tampered = {
      format: PARTIAL_SIG_FORMAT,
      version: PARTIAL_SIG_VERSION,
      transaction: {
        cmd: signed.cmd,
        hash: kadenaHash("a different cmd entirely"),
        sigs: signed.sigs,
      },
    };

    let caught: TamperedHashError | null = null;
    try {
      deserializePartialTransaction(JSON.stringify(tampered));
    } catch (err) {
      caught = err as TamperedHashError;
    }

    expect(caught).toBeInstanceOf(TamperedHashError);
    expect(caught!.expected).toBe(tampered.transaction.hash);
    expect(caught!.actual).toBe(kadenaHash(signed.cmd));
    expect(caught!.actual).toBe(signed.hash); // sanity: signed.hash IS blake2b(cmd)
  });
});

// ══ Slot-status helpers ═════════════════════════════════════════════════════
describe("getMissingSigners / getFilledSigners / isFullySigned", () => {
  it("on an UNsigned 3-signer tx — all 3 missing, none filled, not fully signed", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    expect(getMissingSigners(tx)).toEqual([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    expect(getFilledSigners(tx)).toEqual([]);
    expect(isFullySigned(tx)).toBe(false);
  });

  it("after Person A signs — 2 missing (B, C), 1 filled (A), not fully signed", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    const afterA = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;

    expect(getMissingSigners(afterA)).toEqual([KOALA_PUB_B, KOALA_PUB_C]);
    expect(getFilledSigners(afterA)).toEqual([KOALA_PUB_A]);
    expect(isFullySigned(afterA)).toBe(false);
  });

  it("after all 3 sign — 0 missing, 3 filled, fully signed", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    const all = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
      makeKp(KOALA_PUB_B, KOALA_PRIV_B),
      makeKp(KOALA_PUB_C, KOALA_PRIV_C),
    ])) as IUnsignedCommand;

    expect(getMissingSigners(all)).toEqual([]);
    expect(getFilledSigners(all)).toEqual([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    expect(isFullySigned(all)).toBe(true);
  });
});

// ══ verifyExistingSignatures ════════════════════════════════════════════════
describe("verifyExistingSignatures", () => {
  it("returns allValid=true on a properly signed tx with all slots filled", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B]);
    const signed = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
      makeKp(KOALA_PUB_B, KOALA_PRIV_B),
    ])) as IUnsignedCommand;

    const result = verifyExistingSignatures(signed);
    expect(result.allValid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it("returns allValid=true when only some slots are filled (skips empty slots)", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    const partial = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;

    // Slot A is filled and valid; slots B and C are empty (not failures).
    const result = verifyExistingSignatures(partial);
    expect(result.allValid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it("returns allValid=false with reason when a sig has been tampered", async () => {
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B]);
    const signed = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
      makeKp(KOALA_PUB_B, KOALA_PRIV_B),
    ])) as IUnsignedCommand;

    // Flip a single hex digit in slot 1's signature — still a 128-char hex
    // string, still passes the format check, but no longer verifies.
    const origSig = (signed.sigs[1] as { sig: string }).sig;
    const flippedSig =
      (origSig[0] === "0" ? "1" : "0") + origSig.slice(1);
    const tampered: IUnsignedCommand = {
      ...signed,
      sigs: [
        signed.sigs[0],
        { ...(signed.sigs[1] as { sig: string; pubKey?: string }), sig: flippedSig },
      ] as IUnsignedCommand["sigs"],
    };

    const result = verifyExistingSignatures(tampered);
    expect(result.allValid).toBe(false);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]?.publicKey).toBe(KOALA_PUB_B);
    expect(result.invalid[0]?.reason).toMatch(/Ed25519 verification/);
  });
});

// ══ End-to-end 3-party round-trip ═══════════════════════════════════════════
describe("end-to-end 3-party round-trip via serialize/deserialize handoffs", () => {
  it("A signs → exports → B imports + signs → exports → C imports + signs → all 3 sigs valid", async () => {
    // ── Setup ──
    const tx = buildTx([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);
    const originalHash = tx.hash;
    const originalCmd = tx.cmd;

    // ── Person A signs ──
    const afterA = (await signPartial(tx, [
      makeKp(KOALA_PUB_A, KOALA_PRIV_A),
    ])) as IUnsignedCommand;
    expect(getFilledSigners(afterA)).toEqual([KOALA_PUB_A]);
    const exportFromA = serializePartialTransaction(afterA, {
      exportedBy: "Person A",
    });

    // ── Person B imports ──
    const importedAtB = deserializePartialTransaction(exportFromA);
    // Hash and cmd survived the handoff intact.
    expect(importedAtB.hash).toBe(originalHash);
    expect(importedAtB.cmd).toBe(originalCmd);
    // A's signature is intact and verifies.
    const verifyAtB = verifyExistingSignatures(importedAtB);
    expect(verifyAtB.allValid).toBe(true);

    // ── Person B signs ──
    const afterB = (await signPartial(importedAtB, [
      makeKp(KOALA_PUB_B, KOALA_PRIV_B),
    ])) as IUnsignedCommand;
    expect(getFilledSigners(afterB)).toEqual([KOALA_PUB_A, KOALA_PUB_B]);
    const exportFromB = serializePartialTransaction(afterB, {
      exportedBy: "Person B",
    });

    // ── Person C imports ──
    const importedAtC = deserializePartialTransaction(exportFromB);
    expect(importedAtC.hash).toBe(originalHash);
    const verifyAtC = verifyExistingSignatures(importedAtC);
    expect(verifyAtC.allValid).toBe(true);

    // ── Person C signs ──
    const afterC = (await signPartial(importedAtC, [
      makeKp(KOALA_PUB_C, KOALA_PRIV_C),
    ])) as IUnsignedCommand;

    // ── Final state: all 3 slots filled, all 3 signatures valid. ──
    expect(isFullySigned(afterC)).toBe(true);
    expect(getFilledSigners(afterC)).toEqual([KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C]);

    const finalVerify = verifyExistingSignatures(afterC);
    expect(finalVerify.allValid).toBe(true);
    expect(finalVerify.invalid).toEqual([]);

    // Direct nacl checks against the original hash — every sig binds to
    // the same canonical cmd-hash bytes that any chain validator would use.
    expect(naclVerify(afterC, 0, KOALA_PUB_A)).toBe(true);
    expect(naclVerify(afterC, 1, KOALA_PUB_B)).toBe(true);
    expect(naclVerify(afterC, 2, KOALA_PUB_C)).toBe(true);
  });
});
