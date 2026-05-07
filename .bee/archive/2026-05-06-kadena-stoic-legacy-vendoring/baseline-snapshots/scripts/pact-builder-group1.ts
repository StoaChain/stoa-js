/**
 * Phase 0 baseline-snapshot capture script — pact-builder, group 1 of 2.
 *
 * Emits 5 deterministic JSON files under `baseline-snapshots/pact-builder/`:
 *
 *   1. simple-execution.json       — single signer, coin.GAS, coin.transfer
 *   2. cross-chain.json            — coin.transfer-crosschain with read-keyset
 *   3. multi-signer-with-caps.json — 3 signers, mixed caps, one with 2 caps
 *   4. gas-station.json            — sender = literal stoa gas-station address,
 *                                    addSigner WITHOUT capability callback
 *   5. module-deploy.json          — module deploy with coin.GAS
 *
 * Determinism contract (every snapshot in this file):
 * - .setMeta({ ..., creationTime: 1700000000 }) — fixed; `@kadena/client`
 *   defaults this to `Math.floor(Date.now()/1000)` if omitted.
 * - .setNetworkId("testnet04")                  — fixed via SNAPSHOT_NETWORK_ID
 * - .setNonce("snapshot-nonce-fixed")           — fixed; default is
 *   `"kjs:nonce:" + Date.now()`.
 * All three are present BEFORE `.createTransaction()` on every builder chain.
 *
 * Idempotency: re-running this script produces byte-identical `input`,
 * `expected_output`, and `captured_from`. Only `captured_at` changes (set at
 * write time by `writeSnapshot`).
 *
 * Out-of-scope guardrail: only writes to `baseline-snapshots/pact-builder/`.
 *
 * The `captured_from` provenance string is computed from the upstream
 * `@kadena/client` version resolved by `shared.ts` at module load -- never
 * hardcoded in this file.
 */

import { Pact, createSignWithKeypair } from "@kadena/client";
import type { IUnsignedCommand } from "@kadena/types";

import {
  KADENA_VERSIONS,
  SNAPSHOT_NETWORK_ID,
  KOALA_PUB_A,
  KOALA_PUB_B,
  KOALA_PUB_C,
  writeSnapshot,
} from "./shared.ts";

// `createSignWithKeypair` is imported (per task spec) so this script's import
// surface mirrors group2's; the signing helper itself is exercised by T0.3 /
// T0.6 snapshots, not group1's unsigned-command captures.
void createSignWithKeypair;

const DOMAIN = "pact-builder";
const CAPTURED_FROM = `@kadena/client version ${KADENA_VERSIONS.client}`;
const FIXED_CREATION_TIME = 1700000000;
const FIXED_NONCE = "snapshot-nonce-fixed";

// Standard meta block reused across snapshots that share the chainId-1 / alice
// sender pattern. Spread + override for the cross-chain variant (chainId "0").
const STANDARD_META = {
  chainId: "1" as const,
  sender: "alice",
  gasLimit: 2500,
  gasPrice: 0.0000001,
  ttl: 28800,
  creationTime: FIXED_CREATION_TIME,
};

// Stoa Ouronet gas-station Kadena account (k:-prefixed unscoped principal).
// Hardcoded literal here -- Phase 0 must not depend on any
// `@stoachain/ouronet-core` symbols; the migrated package is what we're
// building the oracle for, so importing from it would be a circular oracle.
// Source of the literal: `packages/ouronet-core/src/constants/ouronet.ts:47`
// (STOA_AUTONOMIC_OURONETGASSTATION).
const STOA_GAS_STATION_ACCOUNT = "c:iQQFWj6gWtpGEzhM_O5ekW1QtnQQy55R8BRPGhj_0FU";

interface SnapshotInput {
  code: string;
  meta: Record<string, unknown>;
  networkId: string;
  nonce: string;
  signers: Array<{
    pubKey: string;
    caps: Array<Array<unknown>>;
  }>;
  data?: Record<string, unknown>;
}

/**
 * Serialise an `IUnsignedCommand` into the exact shape recorded in
 * `expected_output`. The three returned fields (`cmd`, `hash`, `sigs`) are
 * what `@kadena/client` produces from `.createTransaction()` and what the
 * Phase 7 verification gate compares byte-for-byte against the migrated code.
 */
function serializeUnsigned(tx: IUnsignedCommand): { cmd: string; hash: string; sigs: Array<unknown> } {
  return {
    cmd: tx.cmd,
    hash: tx.hash,
    sigs: tx.sigs as Array<unknown>,
  };
}

// ── 1. simple-execution ────────────────────────────────────────────────────

{
  const tx = Pact.builder
    .execution('(coin.transfer "alice" "bob" 1.0)')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
    .setMeta(STANDARD_META)
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  const input: SnapshotInput = {
    code: '(coin.transfer "alice" "bob" 1.0)',
    meta: { ...STANDARD_META },
    networkId: SNAPSHOT_NETWORK_ID,
    nonce: FIXED_NONCE,
    signers: [{ pubKey: KOALA_PUB_A, caps: [["coin.GAS"]] }],
  };

  writeSnapshot(DOMAIN, "simple-execution", input, serializeUnsigned(tx), CAPTURED_FROM);
}

// ── 2. cross-chain ─────────────────────────────────────────────────────────

{
  const sourceChain = "0";
  const targetChain = "2";
  // Fixed keyset name -- the live builder in
  // `packages/ouronet-core/src/interactions/crossChainFunctions.ts:100` uses
  // `receiver-guard-${Date.now()}`; for snapshot determinism that suffix is
  // pinned to the literal "snapshot" here. The keyset value (`receiverGuard`)
  // is captured under `addData(name, value)` and read back by the Pact code
  // via `(read-keyset "receiver-guard-snapshot")`.
  const receiverKeysetName = "receiver-guard-snapshot";
  const receiverGuard = { keys: [KOALA_PUB_A], pred: "keys-all" };
  const code = `(coin.transfer-crosschain "alice" "bob" (read-keyset "${receiverKeysetName}") "${targetChain}" 1.0)`;

  const meta = { ...STANDARD_META, chainId: sourceChain as "0" };

  const tx = Pact.builder
    .execution(code)
    .addData(receiverKeysetName, receiverGuard)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
    .setMeta(meta)
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  const input: SnapshotInput = {
    code,
    meta: { ...meta },
    networkId: SNAPSHOT_NETWORK_ID,
    nonce: FIXED_NONCE,
    signers: [{ pubKey: KOALA_PUB_A, caps: [["coin.GAS"]] }],
    data: { [receiverKeysetName]: receiverGuard },
  };

  writeSnapshot(DOMAIN, "cross-chain", input, serializeUnsigned(tx), CAPTURED_FROM);
}

// ── 3. multi-signer-with-caps ──────────────────────────────────────────────

{
  const code = '(coin.transfer "alice" "bob" 1.0)';
  const transferAmount = { decimal: "1.0" };

  const tx = Pact.builder
    .execution(code)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_B, (w: any) => [w("coin.TRANSFER", "alice", "bob", transferAmount)])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_C, (w: any) => [
      w("coin.GAS"),
      w("coin.TRANSFER", "alice", "bob", transferAmount),
    ])
    .setMeta(STANDARD_META)
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  const input: SnapshotInput = {
    code,
    meta: { ...STANDARD_META },
    networkId: SNAPSHOT_NETWORK_ID,
    nonce: FIXED_NONCE,
    signers: [
      { pubKey: KOALA_PUB_A, caps: [["coin.GAS"]] },
      { pubKey: KOALA_PUB_B, caps: [["coin.TRANSFER", "alice", "bob", transferAmount]] },
      {
        pubKey: KOALA_PUB_C,
        caps: [
          ["coin.GAS"],
          ["coin.TRANSFER", "alice", "bob", transferAmount],
        ],
      },
    ],
  };

  writeSnapshot(DOMAIN, "multi-signer-with-caps", input, serializeUnsigned(tx), CAPTURED_FROM);
}

// ── 4. gas-station ─────────────────────────────────────────────────────────

{
  const code = `(coin.transfer "${STOA_GAS_STATION_ACCOUNT}" "bob" 1.0)`;
  const meta = { ...STANDARD_META, sender: STOA_GAS_STATION_ACCOUNT };

  const tx = Pact.builder
    .execution(code)
    // No capability callback -- the gas-station pattern grants whatever caps
    // the gas-station's keyset attaches at chain time, NOT what the client
    // declares. `addSigner(pub)` (callback omitted) produces a signer entry
    // with an empty `clist`.
    .addSigner(KOALA_PUB_A)
    .setMeta(meta)
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  const input: SnapshotInput = {
    code,
    meta: { ...meta },
    networkId: SNAPSHOT_NETWORK_ID,
    nonce: FIXED_NONCE,
    signers: [{ pubKey: KOALA_PUB_A, caps: [] }],
  };

  writeSnapshot(DOMAIN, "gas-station", input, serializeUnsigned(tx), CAPTURED_FROM);
}

// ── 5. module-deploy ───────────────────────────────────────────────────────

{
  const code = "(module my-mod GOV (defcap GOV () true))";

  const tx = Pact.builder
    .execution(code)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
    .setMeta(STANDARD_META)
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  const input: SnapshotInput = {
    code,
    meta: { ...STANDARD_META },
    networkId: SNAPSHOT_NETWORK_ID,
    nonce: FIXED_NONCE,
    signers: [{ pubKey: KOALA_PUB_A, caps: [["coin.GAS"]] }],
  };

  writeSnapshot(DOMAIN, "module-deploy", input, serializeUnsigned(tx), CAPTURED_FROM);
}

console.log(`pact-builder-group1: wrote 5 snapshots to baseline-snapshots/${DOMAIN}/`);
