/**
 * Phase 0 baseline-snapshot capture script — `@kadena/hd-wallet`.
 *
 * Emits 4 deterministic JSON files under `baseline-snapshots/hd-wallet/`:
 *
 *   1. mnemonic-12-no-pwd.json   — canonical zero-entropy 12-word BIP-39
 *                                  ("abandon...about"), empty password,
 *                                  index 0; SLIP10/koala derivation.
 *   2. mnemonic-12-with-pwd.json — same 12-word mnemonic, NON-empty password
 *                                  ("test-password-123"), index 0; SLIP10/koala.
 *                                  Documents vendor quirk: SLIP10 password is
 *                                  the AES-GCM wrap key only, NOT a BIP-39
 *                                  passphrase, so publicKey + signature equal
 *                                  the no-pwd snapshot. Asserted before write.
 *   3. mnemonic-24-no-pwd.json   — KOALA_MNEMONIC_24 ("abandon...art"),
 *                                  empty password, index 0; SLIP10/koala.
 *                                  Locked publicKey
 *                                  ("cf9d...032c") asserted before write.
 *   4. chainweaver-derivation.json — vendor's locked test vector ("mammal east
 *                                  ...sell"), password "kadena", index 1;
 *                                  chainweaver / BIP32-Ed25519 derivation.
 *                                  Locked publicKey ("83a1...6976") AND locked
 *                                  signature ("bedd...9805") asserted before
 *                                  write.
 *
 * Determinism contract (load-bearing — the whole reason this file is shaped
 * the way it is):
 *
 * - `kadenaMnemonicToSeed`, `kadenaGenKeypairFromSeed`, `kadenaMnemonicToRootKeypair`,
 *   and `kadenaGenKeypair` all return an `EncryptedString` (AES-GCM with a
 *   random IV). Those encrypted blobs CANNOT be byte-snapshotted — every run
 *   produces different ciphertext for the same input. They are therefore
 *   OMITTED from `expected_output`.
 * - The deterministic surface that IS captured: the derived `publicKey` (a
 *   pure function of mnemonic/password/index per BIP-32 / SLIP-10 / Cardano
 *   BIP32-Ed25519) and an Ed25519 signature over the FIXED message "abc"
 *   (deterministic per RFC-8032 §5.1.6 — Ed25519 is nonce-derived from the
 *   secret key + message, NOT from a random source).
 *
 * Sign return-type asymmetry (vendor-quirk; mirror it exactly):
 * - SLIP10  `kadenaSignWithKeyPair(pwd, pub, encSec)(hash)`  → `{ sig: string, ... }` (hex string already)
 * - chainweaver `kadenaSign(pwd, hash, encSec)`              → `Uint8Array` (must Buffer.toString("hex"))
 *
 * Idempotency: re-running this script produces byte-identical `input`,
 * `expected_output`, and `captured_from`. Only `captured_at` changes (set at
 * write time by `writeSnapshot`). Encrypted-blob fields are intentionally
 * absent from `expected_output`, so byte-equality on the load-bearing fields
 * holds across runs.
 *
 * Out-of-scope guardrail: only writes to `baseline-snapshots/hd-wallet/`.
 *
 * The `captured_from` provenance string is computed from the upstream
 * `@kadena/hd-wallet` version resolved by `shared.ts` at module load — never
 * hardcoded in this file.
 */

import { Buffer } from "node:buffer";

import {
  kadenaGenKeypairFromSeed,
  kadenaMnemonicToSeed,
  kadenaSignWithKeyPair,
} from "@kadena/hd-wallet";
import {
  kadenaCheckMnemonic,
  kadenaGenKeypair,
  kadenaMnemonicToRootKeypair,
  kadenaSign,
} from "@kadena/hd-wallet/chainweaver";

import { KADENA_VERSIONS, writeSnapshot } from "./shared.ts";

const DOMAIN = "hd-wallet";
const CAPTURED_FROM = `@kadena/hd-wallet version ${KADENA_VERSIONS.hdWallet}`;

// Fixed message every signature is taken over. Matches the vendor's own
// regression suite (`chainweaver.test.js:5,95,103`) and `wallet-builder.test.ts:43`.
const FIXED_MESSAGE = "abc";

// Canonical BIP-39 zero-entropy 12-word vector. Same first 11 words as
// KOALA_MNEMONIC_24 below, different 12th word ("about" vs "art") because
// each length has its own checksum.
const BIP39_MNEMONIC_12 =
  "abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon about";

// Canonical BIP-39 zero-entropy 24-word vector — same constant as
// `packages/stoa-core/tests/wallet-builder.test.ts:52-55`. The 24th-word
// "art" is the BIP-39 checksum byte for 23 prior `abandon`s.
const BIP39_MNEMONIC_24 =
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon art";

// Vendor's locked test vector — copied from
// `node_modules/@kadena/hd-wallet/lib/esm/chainweaver/tests/chainweaver.test.js:5-6`
// and reused at `wallet-builder.test.ts:41-46`.
const CHAINWEAVER_MNEMONIC_12 =
  "mammal east oxygen romance wheel chimney frequent brain spawn owner announce sell";
const CHAINWEAVER_PASSWORD = "kadena";
const CHAINWEAVER_INDEX = 1;

// Locked vendor outputs. Mismatches throw before any file is written so a
// stale snapshot can never be emitted silently.
const KOALA_PUBKEY_24_INDEX_0 =
  "cf9d5ec84d2d6c8b762a168018b7387790b0db53c3e7e21b9881777f4726032c";
const CHAINWEAVER_PUBKEY_INDEX_1 =
  "83a185400b2fdaaacf44afe93e126ba528900ec66cd31a9e5b104ffe92d96976";
const CHAINWEAVER_SIGNATURE_HEX =
  "bedd0722d330f063266b4b72b2987856c9c7bc0f5f894eb490541441c59bf4c2" +
  "1dba3d35e5214050c90e727b16617c885cb74b2d3fbcd0ebb723f524c8679805";

// `kadenaCheckMnemonic` (chainweaver namespace) wraps `bip39.validateMnemonic`
// internally — accepts both 12-word and 24-word valid BIP-39 phrases. Used as
// a pre-flight guard; if it ever returns false on a known-good vector, the
// vendor library is misbehaving and we should NOT write a snapshot.
function assertMnemonic(label: string, mnemonic: string): void {
  if (!kadenaCheckMnemonic(mnemonic)) {
    throw new Error(
      `kadenaCheckMnemonic rejected ${label} mnemonic — refusing to capture stale snapshot`,
    );
  }
}

interface HdWalletInput {
  mnemonic: string;
  password: string;
  index: number;
}

interface HdWalletOutput {
  publicKey: string;
  signatureOverFixedMessage_hex: string;
  derivationPath: string;
}

// SLIP10/koala derivation helper. Used for snapshots 1–3. Deliberately throws
// away the encrypted seed and encrypted secret-key blobs (random-IV AES-GCM
// ciphertext, non-deterministic).
async function deriveKoala(input: HdWalletInput): Promise<HdWalletOutput> {
  const encryptedSeed = await kadenaMnemonicToSeed(input.password, input.mnemonic);
  const [publicKey, encryptedSecretKey] = await kadenaGenKeypairFromSeed(
    input.password,
    encryptedSeed,
    input.index,
  );
  const sigResult = await kadenaSignWithKeyPair(
    input.password,
    publicKey,
    encryptedSecretKey,
  )(FIXED_MESSAGE);
  return {
    publicKey,
    signatureOverFixedMessage_hex: sigResult.sig,
    derivationPath: "SLIP10/koala",
  };
}

// Chainweaver / BIP32-Ed25519 derivation helper. Used for snapshot 4.
// `kadenaSign` here returns Uint8Array (vendor asymmetry vs SLIP10's hex
// `{sig}`); hex-encode via Buffer for parity with the locked vendor vector.
async function deriveChainweaver(input: HdWalletInput): Promise<HdWalletOutput> {
  const encryptedRootKey = await kadenaMnemonicToRootKeypair(
    input.password,
    input.mnemonic,
  );
  const { publicKey, secretKey: encryptedSecretKey } = await kadenaGenKeypair(
    input.password,
    encryptedRootKey,
    input.index,
  );
  const sigBytes = await kadenaSign(input.password, FIXED_MESSAGE, encryptedSecretKey);
  return {
    publicKey,
    signatureOverFixedMessage_hex: Buffer.from(sigBytes).toString("hex"),
    derivationPath: "chainweaver",
  };
}

// ---------------------------------------------------------------------------
// 1. mnemonic-12-no-pwd.json — koala, 12-word "abandon...about", empty password
// ---------------------------------------------------------------------------

assertMnemonic("BIP39_MNEMONIC_12", BIP39_MNEMONIC_12);

const INPUT_12_NO_PWD: HdWalletInput = {
  mnemonic: BIP39_MNEMONIC_12,
  password: "",
  index: 0,
};
const OUTPUT_12_NO_PWD = await deriveKoala(INPUT_12_NO_PWD);

writeSnapshot(DOMAIN, "mnemonic-12-no-pwd", INPUT_12_NO_PWD, OUTPUT_12_NO_PWD, CAPTURED_FROM);

// ---------------------------------------------------------------------------
// 2. mnemonic-12-with-pwd.json — same 12-word mnemonic, password set
// ---------------------------------------------------------------------------

const INPUT_12_WITH_PWD: HdWalletInput = {
  mnemonic: BIP39_MNEMONIC_12,
  password: "test-password-123",
  index: 0,
};
const OUTPUT_12_WITH_PWD = await deriveKoala(INPUT_12_WITH_PWD);

// Vendor-quirk regression guard (NOT a "different output" assertion).
//
// Empirically (verified against `node_modules/@kadena/hd-wallet/lib/esm/SLIP10/
// kadenaMnemonic.js:23-28`): the `password` argument to `kadenaMnemonicToSeed`
// is used ONLY as the AES-GCM wrap key for the encrypted seed blob — it is
// NOT passed to `bip39.mnemonicToSeed`, which is called without a passphrase.
// Consequence: for SLIP10/koala derivation, the underlying seed bytes (and
// therefore the derived publicKey AND the deterministic Ed25519 signature)
// are IDENTICAL for any `password`; only the encrypted at-rest blob ciphertext
// differs (and that blob is intentionally not in `expected_output`).
//
// This snapshot pair therefore documents the vendor behaviour: same mnemonic
// + same index → same publicKey + same signature regardless of SLIP10 password.
// If this invariant ever flips (vendor starts honouring the password as a
// BIP-39 passphrase), this throw catches it BEFORE we write a stale "with-pwd"
// snapshot whose contents would silently differ from a previous "no-pwd"
// capture and break Phase 7's byte-identity gate.
if (OUTPUT_12_NO_PWD.publicKey !== OUTPUT_12_WITH_PWD.publicKey) {
  throw new Error(
    "SLIP10/koala vendor quirk regression: mnemonic-12 no-pwd and with-pwd " +
      "produced DIFFERENT publicKeys. The vendor library appears to have started " +
      "honouring the password as a BIP-39 passphrase; this snapshot pair documents " +
      "the prior 'password = AES-GCM wrap key only' behaviour and must be re-derived. " +
      `no-pwd=${OUTPUT_12_NO_PWD.publicKey} with-pwd=${OUTPUT_12_WITH_PWD.publicKey}`,
  );
}
if (
  OUTPUT_12_NO_PWD.signatureOverFixedMessage_hex !==
  OUTPUT_12_WITH_PWD.signatureOverFixedMessage_hex
) {
  throw new Error(
    "SLIP10/koala vendor quirk regression: mnemonic-12 no-pwd and with-pwd " +
      "produced DIFFERENT signatures. Same publicKey but divergent signature " +
      "would mean the SLIP10 sign helper is now password-sensitive in a way it " +
      "wasn't at v0.6.2 capture time. Refusing to write stale snapshots.",
  );
}

writeSnapshot(
  DOMAIN,
  "mnemonic-12-with-pwd",
  INPUT_12_WITH_PWD,
  OUTPUT_12_WITH_PWD,
  CAPTURED_FROM,
);

// ---------------------------------------------------------------------------
// 3. mnemonic-24-no-pwd.json — koala, 24-word "abandon...art", empty password
// ---------------------------------------------------------------------------

assertMnemonic("BIP39_MNEMONIC_24", BIP39_MNEMONIC_24);

const INPUT_24_NO_PWD: HdWalletInput = {
  mnemonic: BIP39_MNEMONIC_24,
  password: "",
  index: 0,
};
const OUTPUT_24_NO_PWD = await deriveKoala(INPUT_24_NO_PWD);

// Vendor-locked publicKey assertion (cross-checked against
// `wallet-builder.test.ts:56-57`). If derivation drifts, fail loud BEFORE
// writing the snapshot — never silently capture a stale value.
if (OUTPUT_24_NO_PWD.publicKey !== KOALA_PUBKEY_24_INDEX_0) {
  throw new Error(
    `KOALA_MNEMONIC_24 derivation drift at index 0: expected ` +
      `publicKey=${KOALA_PUBKEY_24_INDEX_0} got=${OUTPUT_24_NO_PWD.publicKey}`,
  );
}

writeSnapshot(DOMAIN, "mnemonic-24-no-pwd", INPUT_24_NO_PWD, OUTPUT_24_NO_PWD, CAPTURED_FROM);

// ---------------------------------------------------------------------------
// 4. chainweaver-derivation.json — vendor's locked test vector
// ---------------------------------------------------------------------------

assertMnemonic("CHAINWEAVER_MNEMONIC_12", CHAINWEAVER_MNEMONIC_12);

const INPUT_CHAINWEAVER: HdWalletInput = {
  mnemonic: CHAINWEAVER_MNEMONIC_12,
  password: CHAINWEAVER_PASSWORD,
  index: CHAINWEAVER_INDEX,
};
const OUTPUT_CHAINWEAVER = await deriveChainweaver(INPUT_CHAINWEAVER);

// Vendor regression: both publicKey and signature are locked across
// upstream's own test suite (chainweaver.test.js:95,103) AND
// wallet-builder.test.ts:65-66,104-127. If either drifts the snapshot is
// stale; throw before writing.
if (OUTPUT_CHAINWEAVER.publicKey !== CHAINWEAVER_PUBKEY_INDEX_1) {
  throw new Error(
    `Chainweaver publicKey drift: expected=${CHAINWEAVER_PUBKEY_INDEX_1} ` +
      `got=${OUTPUT_CHAINWEAVER.publicKey}`,
  );
}
if (OUTPUT_CHAINWEAVER.signatureOverFixedMessage_hex !== CHAINWEAVER_SIGNATURE_HEX) {
  throw new Error(
    `Chainweaver signature drift: expected=${CHAINWEAVER_SIGNATURE_HEX} ` +
      `got=${OUTPUT_CHAINWEAVER.signatureOverFixedMessage_hex}`,
  );
}

writeSnapshot(
  DOMAIN,
  "chainweaver-derivation",
  INPUT_CHAINWEAVER,
  OUTPUT_CHAINWEAVER,
  CAPTURED_FROM,
);
