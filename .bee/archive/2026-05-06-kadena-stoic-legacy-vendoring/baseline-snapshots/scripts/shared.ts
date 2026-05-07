/**
 * Shared helpers and fixtures for Phase 0 baseline-snapshot capture scripts.
 *
 * Every capture script under `baseline-snapshots/scripts/` imports from this
 * module. Centralising the canonical JSON shape, the upstream version
 * resolution, and the RFC-8032 keypair fixtures keeps the per-domain scripts
 * thin and ensures every snapshot is byte-stable across runs.
 *
 * The snapshots produced under `baseline-snapshots/{domain}/*.json` are the
 * gold-standard oracle for Phase 7's byte-identity verification gate.
 * Mutating the canonical shape here cascades to every snapshot file and would
 * invalidate the entire migration's preservation claim.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Pact } from "@kadena/client";
import type { IUnsignedCommand } from "@kadena/types";

// Resolve this file's directory so output paths are robust regardless of the
// caller's CWD (`npx tsx` from the spec directory vs from repo root, etc.).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// `scripts/` lives directly under `baseline-snapshots/`; siblings are the four
// domain output directories.
const BASELINE_SNAPSHOTS_ROOT = resolve(__dirname, "..");

// Repo root is six levels up from this file:
//   .bee/specs/<spec-slug>/baseline-snapshots/scripts/shared.ts
//   ^^^^ ^^^^^ ^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^ ^^^^^^^
//   1    2     3           4                  5        (6th = repo root)
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");

interface KadenaPackageJson {
  version: string;
}

function readKadenaVersion(pkg: string): string {
  const pkgJsonPath = resolve(REPO_ROOT, "node_modules", "@kadena", pkg, "package.json");
  const raw = readFileSync(pkgJsonPath, "utf8");
  const parsed = JSON.parse(raw) as KadenaPackageJson;
  return parsed.version;
}

/**
 * Upstream `@kadena/*` package versions resolved from `node_modules` at
 * module load. Snapshot capture scripts read these to populate each
 * snapshot's `captured_from` field. Reading from disk (rather than
 * hardcoding) means any accidental upstream version drift surfaces
 * immediately as a mismatch in the recorded `captured_from` strings.
 */
export const KADENA_VERSIONS = {
  client: readKadenaVersion("client"),
  cryptographyUtils: readKadenaVersion("cryptography-utils"),
  types: readKadenaVersion("types"),
  hdWallet: readKadenaVersion("hd-wallet"),
} as const;

/**
 * Canonical Chainweb network ID for every Pact-builder snapshot. Matches the
 * convention used in `packages/stoa-core/tests/universal-sign.test.ts`.
 */
export const SNAPSHOT_NETWORK_ID = "testnet04";

/**
 * RFC-8032 Ed25519 test vectors copied from
 * `packages/stoa-core/tests/strategy.test.ts`. These are well-known public
 * test keypairs published in RFC-8032 -- never used to guard any real
 * funds. T0.3's `signed-tx-with-sigs.json` and T0.6's `single-sig.json`
 * MUST share the same keypair (`KOALA_PRIV_A` / `KOALA_PUB_A`) so T0.7's
 * cross-snapshot consistency check has matching inputs to compare.
 */
export const KOALA_PRIV_A = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
export const KOALA_PUB_A = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
export const KOALA_PRIV_B = "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb";
export const KOALA_PUB_B = "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c";
export const KOALA_PRIV_C = "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7";
export const KOALA_PUB_C = "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025";

/**
 * Canonical unsigned-command builder used by both T0.2's
 * `simple-execution.json` and the pre-image of T0.3's `signed-tx-with-sigs.json`
 * / T0.6's `single-sig.json`. Parameterising on the signer public key is the
 * only degree of freedom -- everything else (Pact code, meta, networkId,
 * nonce, creationTime) is fixed at literal values so every run produces the
 * same hash. Pact-builder defaults `creationTime` to `Date.now()/1000` and
 * `nonce` to `"kjs:nonce:" + Date.now()` if not set, both of which would make
 * the snapshot non-deterministic; explicit `.setMeta({creationTime})` and
 * `.setNonce(...)` calls neutralise both sources of drift.
 */
export function buildCanonicalUnsignedCmd(signerPublicKey: string): IUnsignedCommand {
  return Pact.builder
    .execution('(coin.transfer "alice" "bob" 1.0)')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(signerPublicKey, (w: any) => [w("coin.GAS")])
    .setMeta({
      chainId: "1",
      sender: "alice",
      gasLimit: 2500,
      gasPrice: 0.0000001,
      ttl: 28800,
      creationTime: 1700000000,
    })
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce("snapshot-nonce-fixed")
    .createTransaction();
}

/**
 * Top-level key order for every snapshot file. The payload object is built
 * with these keys assigned in this exact order, and JSON.stringify preserves
 * own-property insertion order for string keys per the ECMAScript spec
 * (OrdinaryOwnPropertyKeys). Insertion-order is used INSTEAD of a
 * replacer-array because the replacer-array filter applies recursively at
 * every nesting level, which would strip out the nested keys (`cmd`, `hash`,
 * `sigs`, etc.) of nested objects too. Insertion order pins the top level
 * without disturbing nested shape.
 */
const SNAPSHOT_KEY_ORDER = ["input", "expected_output", "captured_at", "captured_from"] as const;

interface SnapshotPayload {
  input: unknown;
  expected_output: unknown;
  captured_at: string;
  captured_from: string;
}

/**
 * Writes a snapshot JSON file for the given domain at
 * `<baseline-snapshots>/<domain>/<name>.json` with the canonical shape:
 *
 *     {
 *       "input":           <input-as-json>,
 *       "expected_output": <output-as-json>,
 *       "captured_at":     "<ISO-8601 timestamp set at write time>",
 *       "captured_from":   "<provenance string supplied by the caller>"
 *     }
 *
 * Format invariants:
 * - Top-level keys appear in SNAPSHOT_KEY_ORDER (load-bearing for snapshot
 *   identity; pinned via insertion-order assignment, see comment on
 *   SNAPSHOT_KEY_ORDER above for why insertion-order rather than replacer).
 * - 2-space indentation.
 * - Trailing newline.
 * - `captured_at` is set to `new Date().toISOString()` AT WRITE TIME -- it is
 *   intentionally NOT a sentinel; idempotency checks compare `input`,
 *   `expected_output`, and `captured_from`, never `captured_at`.
 *
 * The output directory is created (recursive) if missing so capture scripts
 * never need to pre-mkdir.
 */
export function writeSnapshot(
  domain: string,
  name: string,
  input: unknown,
  output: unknown,
  capturedFrom: string,
): void {
  const outDir = resolve(BASELINE_SNAPSHOTS_ROOT, domain);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Build with assignments in SNAPSHOT_KEY_ORDER so JSON.stringify emits
  // the keys in that order. Object-literal-with-explicit-keys would work
  // identically here, but the explicit-assignment form makes the
  // dependency on SNAPSHOT_KEY_ORDER's identity discoverable for future
  // readers (and for any future linter/test asserting the order).
  const payload = {} as SnapshotPayload;
  for (const key of SNAPSHOT_KEY_ORDER) {
    if (key === "input") payload.input = input;
    else if (key === "expected_output") payload.expected_output = output;
    else if (key === "captured_at") payload.captured_at = new Date().toISOString();
    else if (key === "captured_from") payload.captured_from = capturedFrom;
  }

  const filename = name.endsWith(".json") ? name : `${name}.json`;
  const outPath = resolve(outDir, filename);

  const json = JSON.stringify(payload, null, 2);

  writeFileSync(outPath, json + "\n", "utf8");
}
