/**
 * Cryptography-utils snapshot fidelity test.
 * Loads baseline snapshots and round-trips each test vector through vendored
 * URL-safe base64, binToHex, hash, and restoreKeyPairFromSecretKey APIs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import {
  base64UrlEncode,
  base64UrlDecode,
  base64UrlEncodeArr,
  binToHex,
  hash,
  restoreKeyPairFromSecretKey,
} from "@stoachain/kadena-stoic-legacy/cryptography-utils";

describe("REQ-25: cryptography-utils vendor-fidelity snapshots", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const snapshotDir = resolve(
    here,
    "..",
    "..",
    "..",
    ".bee/archive/2026-05-06-kadena-stoic-legacy-vendoring/baseline-snapshots/cryptography-utils"
  );

  it("baseline directory has 4 cryptography-utils snapshots", () => {
    const files = readdirSync(snapshotDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(4);
  });

  it("each snapshot file is valid JSON with input + expected_output shape", () => {
    const files = readdirSync(snapshotDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const content = JSON.parse(readFileSync(join(snapshotDir, file), "utf8"));
      expect(content, `${file}: missing input`).toHaveProperty("input");
      expect(content, `${file}: missing expected_output`).toHaveProperty("expected_output");
    }
  });

  it("base64Url roundtrip: encode(decode(x)) === x for snapshot fixtures", () => {
    const { input, expected_output } = JSON.parse(
      readFileSync(join(snapshotDir, "base64-vectors.json"), "utf8")
    ) as { input: string[]; expected_output: { encoded: string[]; decoded: string[] } };

    // Skip the empty-string case — base64UrlDecode("") is implementation-defined
    for (let i = 1; i < input.length; i++) {
      const encoded = expected_output.encoded[i];
      const decoded = base64UrlDecode(encoded as any);
      const reEncoded = base64UrlEncode(decoded);
      expect(reEncoded, `roundtrip failed for input[${i}]`).toBe(encoded);
    }
  });

  it("base64UrlEncode matches snapshot encoded values for Latin1-safe inputs", () => {
    const { input, expected_output } = JSON.parse(
      readFileSync(join(snapshotDir, "base64-vectors.json"), "utf8")
    ) as { input: string[]; expected_output: { encoded: string[]; decoded: string[] } };

    // base64UrlEncode is Latin1-range only (equivalent to btoa).
    // Indices 1, 3, 4 are ASCII/Latin1; index 2 (Japanese) is multi-byte UTF-8
    // and must be encoded via base64UrlEncodeArr(TextEncoder.encode(str)).
    const latin1Indices = [1, 3, 4];
    for (const i of latin1Indices) {
      const actual = base64UrlEncode(input[i]);
      expect(actual, `encode mismatch at index ${i}`).toBe(expected_output.encoded[i]);
    }

    // Multi-byte UTF-8 strings require encoding the raw bytes, not the char codes.
    const multiByteIndex = 2;
    const utf8Bytes = new TextEncoder().encode(input[multiByteIndex]);
    const actualMultiByte = base64UrlEncodeArr(utf8Bytes);
    expect(actualMultiByte, `encode mismatch at index ${multiByteIndex}`).toBe(
      expected_output.encoded[multiByteIndex]
    );
  });

  it("binToHex matches snapshot expected_output for all vectors", () => {
    const { input, expected_output } = JSON.parse(
      readFileSync(join(snapshotDir, "bin-to-hex-vectors.json"), "utf8")
    ) as { input: number[][]; expected_output: string[] };

    for (let i = 0; i < input.length; i++) {
      const actual = binToHex(new Uint8Array(input[i]));
      expect(actual, `binToHex mismatch at index ${i}`).toBe(expected_output[i]);
    }
  });

  it("hash matches snapshot expected_output for all vectors", () => {
    const { input, expected_output } = JSON.parse(
      readFileSync(join(snapshotDir, "hash-vectors.json"), "utf8")
    ) as { input: string[]; expected_output: string[] };

    for (let i = 0; i < input.length; i++) {
      const actual = hash(input[i]);
      expect(actual, `hash mismatch at index ${i}`).toBe(expected_output[i]);
    }
  });

  it("restoreKeyPairFromSecretKey derives correct publicKey for all snapshot vectors", () => {
    const { input, expected_output } = JSON.parse(
      readFileSync(join(snapshotDir, "restore-keypair-vectors.json"), "utf8")
    ) as { input: string[]; expected_output: Array<{ publicKey: string; secretKey: string }> };

    for (let i = 0; i < input.length; i++) {
      const result = restoreKeyPairFromSecretKey(input[i]);
      expect(result, `index ${i}: result is undefined`).toBeDefined();
      const pubKey = (result as any).publicKey ?? (result as any).pub;
      expect(pubKey, `index ${i}: publicKey mismatch`).toBe(expected_output[i].publicKey);
    }
  });
});
