/**
 * Phase 0 baseline-snapshot capture script — `@kadena/cryptography-utils`.
 *
 * Emits 4 deterministic JSON files under
 * `baseline-snapshots/cryptography-utils/`:
 *
 *   1. hash-vectors.json           — blake2b256 → unescaped base64url
 *                                    (`hash(str)`)
 *   2. base64-vectors.json         — base64UrlEncodeArr / base64UrlDecodeArr
 *                                    round-trip
 *   3. bin-to-hex-vectors.json     — `binToHex(Uint8Array)`
 *   4. restore-keypair-vectors.json — Ed25519 secret-key seed →
 *                                     deterministic `{publicKey, secretKey}`
 *
 * Determinism contract:
 * - All four cryptography-utils functions exercised here are synchronous and
 *   pure (no random IV, no salting, no time input). The only nondeterminism
 *   in the snapshot is `captured_at`, which is set at write time by
 *   `writeSnapshot` and is intentionally excluded from the idempotency
 *   contract.
 *
 * Multi-vector pattern:
 * - Each file's `input` is an array of N inputs and `expected_output` is a
 *   parallel-indexed array of N outputs (or, for `base64-vectors.json`, an
 *   object whose `encoded` and `decoded` fields are themselves N-element
 *   parallel arrays). Indexing is positional; preserving the array order on
 *   both sides is part of the snapshot's identity.
 *
 * Serialisation rules:
 * - `Uint8Array` is not JSON-native, so every byte buffer that appears in
 *   `expected_output` is converted to a hex string via `binToHex` before
 *   being written. This applies to the round-tripped `decoded` payload of
 *   `base64-vectors.json` and to every entry of `bin-to-hex-vectors.json`'s
 *   output (where hex is the function's own native return type anyway).
 *
 * Idempotency: re-running this script produces byte-identical `input`,
 * `expected_output`, and `captured_from`. Only `captured_at` changes.
 *
 * Out-of-scope guardrail: only writes to
 * `baseline-snapshots/cryptography-utils/`.
 *
 * The `captured_from` provenance string is computed from the upstream
 * `@kadena/cryptography-utils` version resolved by `shared.ts` at module
 * load — never hardcoded in this file.
 */

import {
  hash,
  base64UrlDecodeArr,
  base64UrlEncodeArr,
  binToHex,
  restoreKeyPairFromSecretKey,
} from "@kadena/cryptography-utils";

import {
  KADENA_VERSIONS,
  KOALA_PRIV_A,
  KOALA_PRIV_B,
  KOALA_PRIV_C,
  KOALA_PUB_A,
  KOALA_PUB_B,
  KOALA_PUB_C,
  writeSnapshot,
} from "./shared.ts";

const DOMAIN = "cryptography-utils";
const CAPTURED_FROM = `@kadena/cryptography-utils version ${KADENA_VERSIONS.cryptographyUtils}`;

// ---------------------------------------------------------------------------
// 1. hash-vectors.json
// ---------------------------------------------------------------------------
//
// Five inputs covering: empty / ASCII / unicode / long / single-char edge.
// `hash` returns a blake2b256 digest encoded as unescaped base64url, so each
// expected_output entry is a plain string and needs no further serialisation.

const HASH_INPUTS: string[] = [
  "",
  "hello world",
  "日本語テスト",
  " ".repeat(1024),
  " ",
];

const HASH_OUTPUTS: string[] = HASH_INPUTS.map((s) => hash(s));

writeSnapshot(DOMAIN, "hash-vectors", HASH_INPUTS, HASH_OUTPUTS, CAPTURED_FROM);

// ---------------------------------------------------------------------------
// 2. base64-vectors.json
// ---------------------------------------------------------------------------
//
// Five inputs exercising both directions. For each input string `v`:
//   encoded[i] = base64UrlEncodeArr(TextEncoder().encode(v))
//   decoded[i] = binToHex(base64UrlDecodeArr(encoded[i]))    — round-trip
//
// `decoded` is hex-encoded so it is JSON-serialisable; the round-trip is
// asserted byte-identical against the original UTF-8 hex below before we
// write the snapshot.

const BASE64_INPUTS: string[] = [
  "",
  "hello world",
  "日本語テスト",
  " ".repeat(64),
  "a",
];

const textEncoder = new TextEncoder();

const BASE64_ENCODED: string[] = BASE64_INPUTS.map((v) =>
  base64UrlEncodeArr(textEncoder.encode(v)),
);

const BASE64_DECODED_HEX: string[] = BASE64_ENCODED.map((enc) =>
  binToHex(base64UrlDecodeArr(enc)),
);

// Sanity: each decoded-hex must match the hex of the original UTF-8 bytes.
// If this ever fails, base64UrlEncodeArr / base64UrlDecodeArr are no longer
// inverses for one of the inputs and the whole vector set is suspect.
for (let i = 0; i < BASE64_INPUTS.length; i++) {
  const expectedHex = binToHex(textEncoder.encode(BASE64_INPUTS[i]!));
  const actualHex = BASE64_DECODED_HEX[i]!;
  if (expectedHex !== actualHex) {
    throw new Error(
      `base64 round-trip mismatch at index ${i}: input=${JSON.stringify(BASE64_INPUTS[i])} ` +
        `expectedHex=${expectedHex} actualHex=${actualHex}`,
    );
  }
}

writeSnapshot(
  DOMAIN,
  "base64-vectors",
  BASE64_INPUTS,
  { encoded: BASE64_ENCODED, decoded: BASE64_DECODED_HEX },
  CAPTURED_FROM,
);

// ---------------------------------------------------------------------------
// 3. bin-to-hex-vectors.json
// ---------------------------------------------------------------------------
//
// Five Uint8Array inputs. Inputs are stored as plain number-arrays in the
// JSON (since Uint8Array isn't JSON-native); the script reconstructs the
// Uint8Array at hashing time. Outputs are the native hex strings returned by
// `binToHex`, which need no further serialisation.

const BIN_TO_HEX_INPUTS: number[][] = [
  [],
  [0xff],
  [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
  Array.from(new Uint8Array(32)),
  Array.from(new Uint8Array(256).fill(0xaa)),
];

const BIN_TO_HEX_OUTPUTS: string[] = BIN_TO_HEX_INPUTS.map((arr) =>
  binToHex(new Uint8Array(arr)),
);

writeSnapshot(
  DOMAIN,
  "bin-to-hex-vectors",
  BIN_TO_HEX_INPUTS,
  BIN_TO_HEX_OUTPUTS,
  CAPTURED_FROM,
);

// ---------------------------------------------------------------------------
// 4. restore-keypair-vectors.json
// ---------------------------------------------------------------------------
//
// Three RFC-8032 Ed25519 secret-key seeds → three deterministic
// `{publicKey, secretKey}` outputs. Cross-checked programmatically below
// against the KOALA_PUB_A/B/C constants in `shared.ts` — if upstream ever
// changes its derivation, this assertion catches it before we write a stale
// snapshot.

const RESTORE_INPUTS: string[] = [KOALA_PRIV_A, KOALA_PRIV_B, KOALA_PRIV_C];

const RESTORE_OUTPUTS = RESTORE_INPUTS.map((priv) =>
  restoreKeyPairFromSecretKey(priv),
);

const EXPECTED_PUBS = [KOALA_PUB_A, KOALA_PUB_B, KOALA_PUB_C];
for (let i = 0; i < RESTORE_INPUTS.length; i++) {
  const got = RESTORE_OUTPUTS[i]!;
  const expectedPub = EXPECTED_PUBS[i]!;
  const expectedPriv = RESTORE_INPUTS[i]!;
  if (got.publicKey !== expectedPub) {
    throw new Error(
      `restoreKeyPairFromSecretKey publicKey mismatch at index ${i}: ` +
        `expected=${expectedPub} got=${got.publicKey}`,
    );
  }
  if (got.secretKey !== expectedPriv) {
    throw new Error(
      `restoreKeyPairFromSecretKey secretKey mismatch at index ${i}: ` +
        `expected=${expectedPriv} got=${got.secretKey}`,
    );
  }
}

writeSnapshot(
  DOMAIN,
  "restore-keypair-vectors",
  RESTORE_INPUTS,
  RESTORE_OUTPUTS,
  CAPTURED_FROM,
);
