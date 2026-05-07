/**
 * Phase 0 baseline-snapshot capture script — signing primitives.
 *
 * Emits 2 deterministic JSON files under `baseline-snapshots/signing/`:
 *
 *   1. single-sig.json              — raw-hash sign via `signHash`. LOAD-BEARING:
 *                                     the recorded signature MUST byte-equal
 *                                     T0.3's `pact-builder/signed-tx-with-sigs.json`
 *                                     `expected_output.sigs[0].sig` because both
 *                                     scripts feed the same canonical unsigned
 *                                     cmd (via `buildCanonicalUnsignedCmd(KOALA_PUB_A)`)
 *                                     to the same private key (`KOALA_PRIV_A`).
 *                                     T0.7 asserts this byte-equality.
 *   2. multi-sig-combination.json   — 3-keypair multi-sig combination via the
 *                                     per-keypair `addSignatures` loop. Mirrors
 *                                     the canonical multi-sig flow used in
 *                                     `packages/stoa-core/src/signing/universalSign.ts`.
 *
 * Determinism contract:
 * - Ed25519 is deterministic per RFC-8032 §5.1.6 — same (secretKey, message)
 *   always yields the same 64-byte signature. Both snapshots are therefore
 *   byte-stable across re-runs.
 * - The unsigned cmd hash in `single-sig.json` comes from
 *   `buildCanonicalUnsignedCmd`, whose meta/networkId/nonce/creationTime are
 *   all pinned to fixed literals (see `shared.ts`).
 * - The 3-signer transaction in `multi-sig-combination.json` pins the same
 *   determinism levers (creationTime=1700000000, nonce="snapshot-nonce-fixed",
 *   networkId=SNAPSHOT_NETWORK_ID).
 *
 * Idempotency: re-running this script produces byte-identical `input`,
 * `expected_output`, and `captured_from`. Only `captured_at` changes (set at
 * write time by `writeSnapshot`).
 *
 * Out-of-scope guardrail: only writes to `baseline-snapshots/signing/`.
 *
 * Cross-snapshot consistency (asserted at the end of this script and again at
 * T0.7): `single-sig.json.expected_output.signature` MUST equal
 * `signed-tx-with-sigs.json.expected_output.sigs[0].sig`.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Pact, createSignWithKeypair, addSignatures } from "@kadena/client";
import { signHash, restoreKeyPairFromSecretKey } from "@kadena/cryptography-utils";
import type { ICommand, IUnsignedCommand } from "@kadena/types";

import {
  KADENA_VERSIONS,
  SNAPSHOT_NETWORK_ID,
  KOALA_PRIV_A,
  KOALA_PRIV_B,
  KOALA_PRIV_C,
  KOALA_PUB_A,
  KOALA_PUB_B,
  KOALA_PUB_C,
  buildCanonicalUnsignedCmd,
  writeSnapshot,
} from "./shared.ts";

// `createSignWithKeypair` is imported per task spec so this script's import
// surface mirrors `universalSign.ts` (the canonical multi-sig flow consumer).
// Neither snapshot exercises it directly: single-sig uses `signHash` for the
// raw-hash entry-point and multi-sig uses the per-keypair `addSignatures` loop.
// Referenced here to keep the import non-dead-code.
void createSignWithKeypair;

const DOMAIN = "signing";
const FIXED_CREATION_TIME = 1700000000;
const FIXED_NONCE = "snapshot-nonce-fixed";

// ── 1. single-sig ──────────────────────────────────────────────────────────
//
// Raw-hash sign via `signHash`. The hash returned by Pact-builder's
// `createTransaction()` is already base64URL-encoded (see
// `node_modules/@kadena/cryptography-utils/lib/hash.js:11-13`); `signHash`
// internally base64UrlDecodeArr's it before passing to tweetnacl
// (`signHash.js:16-19`). So we pass `unsignedCmd.hash` straight through —
// no hex conversion, no manual decoding.
//
// LOAD-BEARING for cross-snapshot consistency: the `signature` recorded here
// must byte-equal T0.3's `signed-tx-with-sigs.json.expected_output.sigs[0].sig`.
// Asserted programmatically below before the next snapshot is emitted.

const SINGLE_SIG_CAPTURED_FROM = `@kadena/cryptography-utils version ${KADENA_VERSIONS.cryptographyUtils}`;

const unsignedCmd: IUnsignedCommand = buildCanonicalUnsignedCmd(KOALA_PUB_A);

const sigResult = signHash(unsignedCmd.hash, restoreKeyPairFromSecretKey(KOALA_PRIV_A));
const singleSigSignature: string = sigResult.sig;

{
  const input = {
    keypair: {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
    },
    message: unsignedCmd.hash,
  };

  const expectedOutput = {
    signature: singleSigSignature,
    hashInput_b64Url: unsignedCmd.hash,
  };

  writeSnapshot(DOMAIN, "single-sig", input, expectedOutput, SINGLE_SIG_CAPTURED_FROM);
}

// ── 2. multi-sig-combination ───────────────────────────────────────────────
//
// 3-keypair combination via the per-keypair `addSignatures` loop. Each
// iteration calls `signHash(signed.hash, kp)` against the SAME hash (Pact
// transaction hash is fixed by the cmd, not by sigs) and feeds the result
// back into `addSignatures` as `{sig, pubKey}`. After 3 iterations the
// transaction transitions from `IUnsignedCommand` (sigs all null) to
// `ICommand` (sigs fully populated).
//
// `addSignatures` is typed `(IUnsignedCommand, ...{sig, pubKey?}[]) =>
// IUnsignedCommand | ICommand` — once all signer slots are filled it returns
// the `ICommand` narrowing.

const MULTI_SIG_CAPTURED_FROM = `@kadena/client version ${KADENA_VERSIONS.client}`;

{
  const tx = Pact.builder
    .execution('(coin.transfer-create "alice" "bob" (read-keyset "ks") 1.0)')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_B, (w: any) => [
      w("coin.TRANSFER", "alice", "bob", { decimal: "1.0" }),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_C, (w: any) => [w("coin.GAS")])
    .addData("ks", { keys: [KOALA_PUB_A], pred: "keys-all" })
    .setMeta({
      chainId: "1",
      sender: "alice",
      gasLimit: 2500,
      gasPrice: 0.0000001,
      ttl: 28800,
      creationTime: FIXED_CREATION_TIME,
    })
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  let signed: IUnsignedCommand | ICommand = tx;
  const signerPairs: Array<[string, string]> = [
    [KOALA_PRIV_A, KOALA_PUB_A],
    [KOALA_PRIV_B, KOALA_PUB_B],
    [KOALA_PRIV_C, KOALA_PUB_C],
  ];
  for (const [priv, pub] of signerPairs) {
    const kp = restoreKeyPairFromSecretKey(priv);
    const r = signHash(signed.hash, kp);
    signed = addSignatures(signed as IUnsignedCommand, { sig: r.sig, pubKey: pub });
  }

  const finalSigned = signed as ICommand;

  const input = {
    description: "3-keypair multi-sig via per-keypair addSignatures loop",
    keypairs: [
      { publicKey: KOALA_PUB_A, secretKey: KOALA_PRIV_A },
      { publicKey: KOALA_PUB_B, secretKey: KOALA_PRIV_B },
      { publicKey: KOALA_PUB_C, secretKey: KOALA_PRIV_C },
    ],
    unsignedCmd_hash: tx.hash,
  };

  const expectedOutput = {
    cmd: finalSigned.cmd,
    hash: finalSigned.hash,
    sigs: finalSigned.sigs,
  };

  writeSnapshot(
    DOMAIN,
    "multi-sig-combination",
    input,
    expectedOutput,
    MULTI_SIG_CAPTURED_FROM,
  );
}

// ── Cross-snapshot consistency check ───────────────────────────────────────
//
// T0.7 will run a canonical verifier that asserts byte-identity across all
// snapshots; this in-script check exists to surface mismatches at capture
// time so we never emit a divergent pair into the spec directory in the
// first place. The check is a hard error — if T0.3's signature ever drifts
// from T0.6's, neither the unsigned-cmd builder nor the keypair fixtures are
// invariant any more, and T0.7's gate would be set up to fail downstream.

{
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const t0_3Path = resolve(
    __dirname,
    "..",
    "pact-builder",
    "signed-tx-with-sigs.json",
  );

  const t0_3Raw = readFileSync(t0_3Path, "utf8");
  const t0_3 = JSON.parse(t0_3Raw) as {
    expected_output: {
      sigs: Array<{ sig: string; pubKey: string }>;
    };
  };
  const t0_3Sig = t0_3.expected_output.sigs[0]?.sig;

  const matches = t0_3Sig === singleSigSignature;
  console.log(
    `cross-snapshot consistency: single-sig.signature === T0.3.signed-tx-with-sigs.sigs[0].sig: ${matches}`,
  );
  if (!matches) {
    throw new Error(
      `Cross-snapshot consistency failure: T0.6 single-sig.signature (${singleSigSignature}) ` +
        `does not match T0.3 signed-tx-with-sigs.sigs[0].sig (${t0_3Sig}). ` +
        `Same canonical unsigned cmd (KOALA_PUB_A) and same keypair (KOALA_PRIV_A) ` +
        `must produce a byte-identical Ed25519 signature per RFC-8032 §5.1.6. ` +
        `Investigate: did buildCanonicalUnsignedCmd or KOALA_PRIV_A/PUB_A change? ` +
        `Did the Pact-builder default for an unset field shift?`,
    );
  }
}

console.log(`signing: wrote 2 snapshots to baseline-snapshots/${DOMAIN}/`);
