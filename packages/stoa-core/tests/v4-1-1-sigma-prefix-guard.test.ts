/**
 * REQ-11: Σ-prefix smart-account guard at CodexSigningStrategy entry point.
 *
 * Smart account synthesis emits keyset data with Σ. in either the keysetRef
 * name or the key entries themselves. When the strategy detects a Σ. pattern
 * AND no codex-signable path exists (analysis.satisfied === false &&
 * analysis.codexKeys.length === 0), it must throw SmartAccountAuthError so
 * the caller can surface an appropriate "switch to smart-account auth flow"
 * error rather than failing silently deep in the signing pipeline.
 *
 * These tests are RED until T2.5b inserts the detection guard between the
 * codexPubs resolution and the foreign-key pre-flight in codexStrategy.ts.
 */

import { describe, it, expect } from "vitest";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import type { IUnsignedCommand, ICommand } from "@stoachain/kadena-stoic-legacy/types";
import { CodexSigningStrategy } from "../src/signing/codexStrategy";
import { SmartAccountAuthError } from "../src/signing/errors";
import type { IKadenaKeypair, KeyResolver, PactClient } from "../src/signing/types";
import type { IKeyset } from "../src/guard";
import { publicKeyFromPrivateKey } from "../src/signing/primitives";

// ─── Real Ed25519 keypairs (RFC 8032 test vectors) ───────────────────────────
// Safe to hardcode — these are public test vectors, never used on a live chain.

const PRIV_A = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const PUB_A  = publicKeyFromPrivateKey(PRIV_A);

const PRIV_B = "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb";
const PUB_B  = publicKeyFromPrivateKey(PRIV_B);

const KP_A: IKadenaKeypair = { publicKey: PUB_A, privateKey: PRIV_A, seedType: "koala" };
const KP_B: IKadenaKeypair = { publicKey: PUB_B, privateKey: PRIV_B, seedType: "koala" };

// ─── Minimal mock PactClient ─────────────────────────────────────────────────

function mockPactClient(): PactClient {
  return {
    dirtyRead: async (_tx: IUnsignedCommand) => ({
      result: { status: "success", data: "ok" },
      gas: 800,
    }),
    submit: async (_signed: ICommand) => ({
      requestKey: "mock-req-key-sigma-test",
      raw: {},
    }),
  };
}

// ─── Resolver factory ────────────────────────────────────────────────────────
//
// Uses a resolver that DOES implement requestForeignKey to prevent the
// foreign-key pre-flight from firing ahead of the Σ-detection guard.
// The Σ-detection guard (T2.5b) fires between codexPubs resolution and the
// pre-flight; suppressing pre-flight interference lets the tests isolate the
// Σ-guard behavior.

function mockResolver(opts: {
  codexPubs: string[];
  byPub?: Record<string, IKadenaKeypair>;
}): KeyResolver {
  return {
    listCodexPubs: () => new Set(opts.codexPubs),
    getKeyPairByPublicKey: async (pub: string) => {
      const kp = opts.byPub?.[pub];
      if (!kp) throw new Error(`mock resolver: no keypair for ${pub.slice(0, 8)}...`);
      return kp;
    },
    requestForeignKey: async (pub: string) => {
      throw new Error(`mock resolver: requestForeignKey called for ${pub.slice(0, 8)}... — not resolvable`);
    },
  };
}

// ─── Minimal unsigned transaction builder ────────────────────────────────────

function buildMockTx(args: {
  gasLimit: number;
  capsKeyPub: string;
  guardPubs: string[];
}): IUnsignedCommand {
  let builder = Pact.builder
    .execution("(+ 1 1)")
    .setMeta({
      senderAccount: "test-gas-station",
      chainId: "0",
      gasLimit: args.gasLimit,
      creationTime: 1_700_000_000,
      gasPrice: 0.000001,
      ttl: 600,
    })
    .setNetworkId("testnet04")
    .addSigner(args.capsKeyPub);
  for (const gp of args.guardPubs) {
    builder = (builder as any).addSigner(gp);
  }
  return (builder as any).createTransaction() as IUnsignedCommand;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("REQ-11: Σ-prefix smart-account guard at strategy entry", () => {
  it("path 1: keysetRef contains Σ. and guard.keys empty (no codex path) → throws SmartAccountAuthError", async () => {
    // A guard whose keysetRef string contains the Σ. smart-account marker and
    // whose keys list is empty (synthesis didn't embed inline keys). The
    // strategy cannot sign via codex → must throw SmartAccountAuthError.
    const client = mockPactClient();
    const resolver = mockResolver({
      codexPubs: [PUB_A, PUB_B],
      byPub: { [PUB_A]: KP_A, [PUB_B]: KP_B },
    });
    const strategy = new CodexSigningStrategy(resolver, client);

    const sigmaGuard: IKeyset = {
      keysetRef: "ouronet-ns.Σ.SMART-ACCT-keyset",
      keys: [],
      pred: "keys-all",
    };

    await expect(
      strategy.execute({
        build: buildMockTx,
        guards: [sigmaGuard],
        paymentKey: null,
      }),
    ).rejects.toBeInstanceOf(SmartAccountAuthError);
  });

  it("path 2: a guard.keys[] entry contains Σ. and no codex path → throws SmartAccountAuthError", async () => {
    // Smart-account synthesis emits Σ.account.<keyhash> strings directly into
    // the keys array. None of these are real Ed25519 pubkeys in the codex
    // → codexKeys.length === 0, satisfied === false → Σ-guard must fire.
    const client = mockPactClient();
    const resolver = mockResolver({
      codexPubs: [PUB_A, PUB_B],
      byPub: { [PUB_A]: KP_A, [PUB_B]: KP_B },
    });
    const strategy = new CodexSigningStrategy(resolver, client);

    const sigmaGuard: IKeyset = {
      keysetRef: undefined,
      keys: ["Σ.smart-acct.abc123def456"],
      pred: "keys-all",
    };

    await expect(
      strategy.execute({
        build: buildMockTx,
        guards: [sigmaGuard],
        paymentKey: null,
      }),
    ).rejects.toBeInstanceOf(SmartAccountAuthError);
  });

  it("both paths: keysetRef and keys[] both contain Σ. → throws SmartAccountAuthError exactly once", async () => {
    // Defensive: even when both detection vectors fire for the same guard,
    // the strategy throws one SmartAccountAuthError, not two (no double-throw).
    const client = mockPactClient();
    const resolver = mockResolver({
      codexPubs: [PUB_A, PUB_B],
      byPub: { [PUB_A]: KP_A, [PUB_B]: KP_B },
    });
    const strategy = new CodexSigningStrategy(resolver, client);

    const sigmaGuard: IKeyset = {
      keysetRef: "Σ.smart-acct-keyset",
      keys: ["Σ.smart.xyz789"],
      pred: "keys-all",
    };

    let caughtCount = 0;
    let caughtError: unknown;
    try {
      await strategy.execute({
        build: buildMockTx,
        guards: [sigmaGuard],
        paymentKey: null,
      });
    } catch (e) {
      caughtCount++;
      caughtError = e;
    }

    expect(caughtCount).toBe(1);
    expect(caughtError).toBeInstanceOf(SmartAccountAuthError);
  });

  it("non-Σ guard with no signable path → does NOT throw SmartAccountAuthError (may throw a different error)", async () => {
    // A guard with a normal keysetRef and normal keys that happen to be
    // outside the codex must not be misclassified as a Σ-guard. The strategy
    // may still throw (e.g. foreign-key pre-flight or resolver failure), but
    // it must not throw SmartAccountAuthError.
    const client = mockPactClient();
    const resolver = mockResolver({
      codexPubs: [PUB_A],
      byPub: { [PUB_A]: KP_A },
    });
    const strategy = new CodexSigningStrategy(resolver, client);

    // Regular keyset — not Σ-prefixed — with a key NOT in the codex.
    const regularGuard: IKeyset = {
      keysetRef: "ouronet-ns.regular-keyset",
      keys: [PUB_B],      // PUB_B is NOT in codexPubs
      pred: "keys-all",
    };

    let caught: unknown;
    try {
      await strategy.execute({
        build: buildMockTx,
        guards: [regularGuard],
        paymentKey: null,
      });
    } catch (e) {
      caught = e;
    }

    if (caught !== undefined) {
      expect(caught).not.toBeInstanceOf(SmartAccountAuthError);
    }
  });

  it("Σ. in keysetRef but guard.keys holds a real codex-signable pubkey → does NOT throw (codex can sign)", async () => {
    // The Σ-guard must NOT fire when codex holds at least one key that
    // satisfies the guard threshold. The Σ. in keysetRef is metadata — if the
    // actual keys array contains a codex pub, the strategy can sign normally.
    const client = mockPactClient();
    const resolver = mockResolver({
      codexPubs: [PUB_A, PUB_B],
      byPub: { [PUB_A]: KP_A, [PUB_B]: KP_B },
    });
    const strategy = new CodexSigningStrategy(resolver, client);

    // keysetRef has Σ. BUT keys[0] = PUB_B which IS in the codex.
    // analysis.codexKeys.length > 0 → guard condition does not fire.
    const hybridGuard: IKeyset = {
      keysetRef: "Σ.smart-ns.hybrid-keyset",
      keys: [PUB_B],
      pred: "keys-all",
    };

    const result = await strategy.execute({
      build: buildMockTx,
      guards: [hybridGuard],
      paymentKey: null,
    });

    expect(result).toBeDefined();
    expect(result.requestKey).toBe("mock-req-key-sigma-test");
  });
});
