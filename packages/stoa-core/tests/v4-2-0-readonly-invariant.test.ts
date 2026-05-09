/**
 * REQ-21 / REQ-22 / REQ-23: aggressive readonly sweep regression-lock for stoa-core.
 * Locks ~15 representative public-type fields against accidental mutation via
 * `// @ts-expect-error TS2540` assertions and `expectTypeOf.toMatchTypeOf<{readonly ...}>()`
 * shape checks.
 *
 * Pattern matches `tests/v4-1-1-type-preservation.test.ts` precedent.
 * Strategy A: shape assertions via `toMatchTypeOf<{readonly ...}>()` (covariant — passes
 *   pre-readonly via mutable-as-subtype-of-readonly; remains as a positive shape lock).
 * Strategy B: mutation-rejection via `// @ts-expect-error TS2540` — fails pre-readonly
 *   (mutation would compile, voiding the suppression as TS2578); passes post-readonly.
 */
import { describe, it, expectTypeOf } from "vitest";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import type { GuardAnalysis, IKeyset, PaymentKeyInfo } from "@stoachain/stoa-core/guard";
import type { TransactionError } from "@stoachain/stoa-core/errors";
import { SigningError } from "@stoachain/stoa-core/errors";
import type { UniversalKeypair, PartialSigEnvelope } from "@stoachain/stoa-core/signing";
import { KadenaWallet } from "@stoachain/stoa-core/wallet";

describe("REQ-21/22: stoa-core readonly invariant regression-lock", () => {
  // ── Strategy A: shape locks via toMatchTypeOf<{readonly ...}>() ────────────

  it("IKadenaKeypair.publicKey is readonly", () => {
    expectTypeOf<IKadenaKeypair>().toMatchTypeOf<{ readonly publicKey: string }>();
  });

  it("IKadenaKeypair.privateKey is readonly", () => {
    expectTypeOf<IKadenaKeypair>().toMatchTypeOf<{ readonly privateKey: string }>();
  });

  it("IKadenaKeypair.seedType is readonly (optional)", () => {
    expectTypeOf<IKadenaKeypair>().toMatchTypeOf<{
      readonly seedType?: "koala" | "chainweaver" | "eckowallet" | "foreign";
    }>();
  });

  it("GuardAnalysis.threshold is readonly", () => {
    expectTypeOf<GuardAnalysis>().toMatchTypeOf<{ readonly threshold: number }>();
  });

  it("GuardAnalysis.satisfied is readonly", () => {
    expectTypeOf<GuardAnalysis>().toMatchTypeOf<{ readonly satisfied: boolean }>();
  });

  it("GuardAnalysis.predicateRecognized is readonly", () => {
    expectTypeOf<GuardAnalysis>().toMatchTypeOf<{ readonly predicateRecognized: boolean }>();
  });

  it("IKeyset.keys is readonly", () => {
    expectTypeOf<IKeyset>().toMatchTypeOf<{ readonly keys: readonly string[] }>();
  });

  it("PaymentKeyInfo.address is readonly", () => {
    expectTypeOf<PaymentKeyInfo>().toMatchTypeOf<{ readonly address: string }>();
  });

  it("TransactionError.code is readonly", () => {
    expectTypeOf<TransactionError>().toMatchTypeOf<{ readonly code: string }>();
  });

  it("SigningError.code is readonly (instance field)", () => {
    expectTypeOf<SigningError>().toMatchTypeOf<{ readonly code: string }>();
  });

  it("SigningError.suggestions is readonly (instance field, optional)", () => {
    expectTypeOf<SigningError>().toMatchTypeOf<{ readonly suggestions?: string[] }>();
  });

  it("UniversalKeypair.secretKey is readonly", () => {
    expectTypeOf<UniversalKeypair>().toMatchTypeOf<{ readonly secretKey: string }>();
  });

  it("PartialSigEnvelope.format is readonly", () => {
    expectTypeOf<PartialSigEnvelope>().toMatchTypeOf<{ readonly format: "ouronet-partial-sig" }>();
  });

  it("KadenaWallet.parentId is readonly (class instance field)", () => {
    expectTypeOf<KadenaWallet>().toMatchTypeOf<{ readonly parentId: string }>();
  });

  it("KadenaWallet.publicKey is readonly (class instance field)", () => {
    expectTypeOf<KadenaWallet>().toMatchTypeOf<{ readonly publicKey: string }>();
  });

  // ── Strategy B: mutation-rejection compile-time locks ────────────────────

  it("rejects mutation of IKadenaKeypair.publicKey at compile time", () => {
    const kp: IKadenaKeypair = { publicKey: "abc", privateKey: "def" };
    // @ts-expect-error TS2540: Cannot assign to 'publicKey' because it is a read-only property.
    kp.publicKey = "xyz";
    void kp;
  });

  it("rejects mutation of GuardAnalysis.threshold at compile time", () => {
    const ga: GuardAnalysis = {
      keys: [],
      pred: "keys-all",
      threshold: 0,
      predicateRecognized: true,
      codexKeys: [],
      foreignKeys: [],
      resolvedForeignKeys: [],
      signable: 0,
      satisfied: true,
      neededMore: 0,
      predLabel: "—",
    };
    // @ts-expect-error TS2540: Cannot assign to 'threshold' because it is a read-only property.
    ga.threshold = 99;
    void ga;
  });

  it("rejects mutation of SigningError.code at compile time", () => {
    const err = new SigningError("msg", "CODE", "ctx");
    // @ts-expect-error TS2540: Cannot assign to 'code' because it is a read-only property.
    err.code = "OTHER";
    void err;
  });

  it("rejects mutation of KadenaWallet.parentId at compile time", () => {
    const wallet = new KadenaWallet({
      parentId: "p",
      index: 0,
      secret: "s",
      publicKey: "pk",
      derivationPath: "m/44'/626'/0'/0/0",
    });
    // @ts-expect-error TS2540: Cannot assign to 'parentId' because it is a read-only property.
    wallet.parentId = "other";
    void wallet;
  });
});
