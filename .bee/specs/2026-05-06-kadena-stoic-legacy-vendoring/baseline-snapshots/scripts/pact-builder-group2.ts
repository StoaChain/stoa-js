/**
 * Phase 0 baseline-snapshot capture script — pact-builder, group 2 of 2.
 *
 * Emits 5 deterministic JSON files under `baseline-snapshots/pact-builder/`:
 *
 *   1. complex-pact-code.json     — multi-expression Pact code, single signer
 *   2. pact-modules-codegen.json  — Pact.modules.coin.transfer codegen path
 *                                   (`@kadena/pactjs-generated` not installed →
 *                                   captures the unavailability rather than
 *                                   skipping; expected_output records the
 *                                   sentinel { value: null, note: ... }).
 *   3. continuation-payload.json  — defpact continuation, single signer
 *   4. signed-tx-with-sigs.json   — full sign flow over the canonical unsigned
 *                                   command (LOAD-BEARING: shares its
 *                                   `cmd`/`hash` with T0.6's `single-sig.json`
 *                                   via `buildCanonicalUnsignedCmd(KOALA_PUB_A)`).
 *   5. multi-cap-signer.json      — single signer with 3 capability clauses
 *                                   (coin.GAS, coin.TRANSFER, ouronet-ns.DALOS.GAS_PAYER).
 *
 * Determinism contract (every Pact-builder snapshot in this file):
 * - .setMeta({ ..., creationTime: 1700000000 }) — fixed; `@kadena/client`
 *   defaults this to `Math.floor(Date.now()/1000)` if omitted.
 * - .setNetworkId("testnet04")                  — fixed via SNAPSHOT_NETWORK_ID.
 * - .setNonce("snapshot-nonce-fixed")           — fixed; default is
 *   `"kjs:nonce:" + Date.now()`.
 * All three appear BEFORE `.createTransaction()` on every builder chain.
 *
 * Idempotency: re-running this script produces byte-identical `input`,
 * `expected_output`, and `captured_from`. Only `captured_at` changes (set at
 * write time by `writeSnapshot`). For `signed-tx-with-sigs.json` idempotency
 * relies on Ed25519 being deterministic per RFC-8032 §5.1.6 -- the same
 * (private key, message) pair always produces the same 64-byte signature.
 *
 * Out-of-scope guardrail: only writes to `baseline-snapshots/pact-builder/`.
 *
 * Cross-snapshot consistency: `signed-tx-with-sigs.json.expected_output.cmd`
 * MUST equal what `buildCanonicalUnsignedCmd(KOALA_PUB_A).cmd` produces. T0.7
 * verifies this by re-running both helpers and comparing. The shared helper
 * is the single source of truth for the canonical unsigned command.
 */

import { Pact, createSignWithKeypair, addSignatures } from "@kadena/client";
import { restoreKeyPairFromSecretKey } from "@kadena/cryptography-utils";
import type { ICommand, IUnsignedCommand } from "@kadena/types";

import {
  KADENA_VERSIONS,
  SNAPSHOT_NETWORK_ID,
  KOALA_PRIV_A,
  KOALA_PUB_A,
  buildCanonicalUnsignedCmd,
  writeSnapshot,
} from "./shared.ts";

// `addSignatures` is imported per task spec so this script's import surface
// matches the universal-sign / multi-sig combination flow in
// `packages/stoa-core/src/signing/universalSign.ts`. It is NOT exercised by
// any of the 5 snapshots below (the koala branch uses createSignWithKeypair
// directly). Referenced here to keep the import non-dead-code.
void addSignatures;

const DOMAIN = "pact-builder";
const CAPTURED_FROM = `@kadena/client version ${KADENA_VERSIONS.client}`;
const FIXED_CREATION_TIME = 1700000000;
const FIXED_NONCE = "snapshot-nonce-fixed";

// Standard meta block reused across snapshots that share the chainId-1 / alice
// sender pattern. Identical to group1's STANDARD_META so cross-group snapshots
// share the same meta footprint.
const STANDARD_META = {
  chainId: "1" as const,
  sender: "alice",
  gasLimit: 2500,
  gasPrice: 0.0000001,
  ttl: 28800,
  creationTime: FIXED_CREATION_TIME,
};

interface SnapshotInput {
  code?: string;
  meta?: Record<string, unknown>;
  networkId?: string;
  nonce?: string;
  signers?: Array<{
    pubKey: string;
    caps: Array<Array<unknown>>;
  }>;
  data?: Record<string, unknown>;
  continuation?: Record<string, unknown>;
  description?: string;
  keypair?: { publicKey: string; secretKey: string };
}

/**
 * Serialise an `IUnsignedCommand` into the exact shape recorded in
 * `expected_output` for unsigned snapshots. `sigs` is preserved as-is
 * (`[null]` for unsigned, `[{sig: "<hex>"}]` for signed).
 */
function serializeUnsigned(tx: IUnsignedCommand): { cmd: string; hash: string; sigs: Array<unknown> } {
  return {
    cmd: tx.cmd,
    hash: tx.hash,
    sigs: tx.sigs as Array<unknown>,
  };
}

/**
 * Serialise an `ICommand` (signed) into the exact shape recorded in
 * `expected_output`. The sigs array is non-null and contains real
 * Ed25519 signatures.
 */
function serializeSigned(tx: ICommand): { cmd: string; hash: string; sigs: Array<{ sig: string }> } {
  return {
    cmd: tx.cmd,
    hash: tx.hash,
    sigs: tx.sigs as Array<{ sig: string }>,
  };
}

// ── 1. complex-pact-code ───────────────────────────────────────────────────

{
  const code = '(let ((x 1)) (+ x 2)) (coin.details "alice")';

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

  writeSnapshot(DOMAIN, "complex-pact-code", input, serializeUnsigned(tx), CAPTURED_FROM);
}

// ── 2. pact-modules-codegen ────────────────────────────────────────────────
//
// `Pact.modules` is augmented by `@kadena/pactjs-generated` (declaration
// merging into the empty `IPactModules` interface). When the codegen package
// is not installed, `Pact.modules.coin` is `undefined`, so calling
// `Pact.modules.coin.transfer(...)` throws a TypeError. The snapshot captures
// the unavailability so the migrated code's behaviour matches: if the host
// project hasn't installed pactjs-generated, the codegen path is dead.
//
// The intended-call description is recorded as a STRING in the input so
// re-runs are byte-identical (we never invoke the codegen call directly here
// in the success branch — we only attempt the import resolution). On the
// success branch we call the generated function and capture the resulting
// unsigned tx the same way every other Pact-builder snapshot does.

{
  const intendedCode = "Pact.modules.coin.transfer('alice','bob',1.0)";

  const input: SnapshotInput = {
    description: "Pact.modules.coin.transfer codegen",
    code: intendedCode,
  };

  let captured: unknown;
  try {
    // Dynamic import — bypasses the static import that would fail at TS
    // compile time / module-resolution time. The codegen package augments
    // Pact.modules via side effect; if it loads, Pact.modules.coin becomes
    // typed and callable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await import("@kadena/pactjs-generated" as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PactWithModules = Pact as any;
    const pactCode = PactWithModules.modules.coin.transfer("alice", "bob", { decimal: "1.0" });

    const tx = Pact.builder
      .execution(pactCode)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
      .setMeta(STANDARD_META)
      .setNetworkId(SNAPSHOT_NETWORK_ID)
      .setNonce(FIXED_NONCE)
      .createTransaction();

    captured = serializeUnsigned(tx);
  } catch {
    captured = {
      value: null,
      note: "@kadena/pactjs-generated not installed; codegen path unavailable",
    };
  }

  writeSnapshot(DOMAIN, "pact-modules-codegen", input, captured, CAPTURED_FROM);
}

// ── 3. continuation-payload ────────────────────────────────────────────────

{
  const continuation = {
    pactId: "deadbeef-pactid-fixed",
    step: 1,
    rollback: false,
    proof: null,
    data: {},
  };

  const tx = Pact.builder
    .continuation(continuation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [w("coin.GAS")])
    .setMeta(STANDARD_META)
    .setNetworkId(SNAPSHOT_NETWORK_ID)
    .setNonce(FIXED_NONCE)
    .createTransaction();

  const input: SnapshotInput = {
    continuation: { ...continuation },
    meta: { ...STANDARD_META },
    networkId: SNAPSHOT_NETWORK_ID,
    nonce: FIXED_NONCE,
    signers: [{ pubKey: KOALA_PUB_A, caps: [["coin.GAS"]] }],
  };

  writeSnapshot(DOMAIN, "continuation-payload", input, serializeUnsigned(tx), CAPTURED_FROM);
}

// ── 4. signed-tx-with-sigs ─────────────────────────────────────────────────
//
// Load-bearing for cross-snapshot consistency at T0.7. The unsigned cmd MUST
// come from `buildCanonicalUnsignedCmd(KOALA_PUB_A)` (the same helper T0.6
// will use for `single-sig.json`) -- T0.7 compares the cmd/hash bytes to
// confirm the canonical builder is invariant across capture sites.
//
// Ed25519 is deterministic per RFC-8032 §5.1.6: signing the same message with
// the same private key always produces the same 64-byte signature, so this
// snapshot is byte-stable across re-runs of the script.

{
  const unsignedCmd = buildCanonicalUnsignedCmd(KOALA_PUB_A);

  const keypair = restoreKeyPairFromSecretKey(KOALA_PRIV_A);
  const signWithKp = createSignWithKeypair([keypair]);
  const signed = (await signWithKp(unsignedCmd)) as ICommand;

  const input: SnapshotInput = {
    description: "Full sign flow over canonical unsigned cmd",
    keypair: {
      publicKey: KOALA_PUB_A,
      secretKey: KOALA_PRIV_A,
    },
  };

  writeSnapshot(DOMAIN, "signed-tx-with-sigs", input, serializeSigned(signed), CAPTURED_FROM);
}

// ── 5. multi-cap-signer ────────────────────────────────────────────────────

{
  const code = '(coin.transfer "alice" "bob" 10.0)';
  const transferAmount = { decimal: "10.0" };

  const tx = Pact.builder
    .execution(code)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .addSigner(KOALA_PUB_A, (w: any) => [
      w("coin.GAS"),
      w("coin.TRANSFER", "alice", "bob", transferAmount),
      w("ouronet-ns.DALOS.GAS_PAYER", "", { int: 0 }, { decimal: "0.0" }),
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
      {
        pubKey: KOALA_PUB_A,
        caps: [
          ["coin.GAS"],
          ["coin.TRANSFER", "alice", "bob", transferAmount],
          ["ouronet-ns.DALOS.GAS_PAYER", "", { int: 0 }, { decimal: "0.0" }],
        ],
      },
    ],
  };

  writeSnapshot(DOMAIN, "multi-cap-signer", input, serializeUnsigned(tx), CAPTURED_FROM);
}

console.log(`pact-builder-group2: wrote 5 snapshots to baseline-snapshots/${DOMAIN}/`);
