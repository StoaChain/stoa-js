/**
 * REQ-29: stoa-core public type shape preservation.
 * Locks ~10 critical type exports against accidental shape changes.
 * If the type structure changes, these tests fail at typecheck time.
 */
import { describe, it, expectTypeOf } from "vitest";
import type { SeedType, KadenaWallet } from "@stoachain/stoa-core/wallet";
import type { GuardAnalysis, IKeyset } from "@stoachain/stoa-core/guard";
import type { CodexSigningStrategy } from "@stoachain/stoa-core/signing";
import type { PactReader } from "@stoachain/stoa-core/reads";
import { MnemonicMismatchError } from "@stoachain/stoa-core/wallet";
import { SmartAccountAuthError } from "@stoachain/stoa-core/signing";
import { InvalidPactReaderError } from "@stoachain/stoa-core/reads";

describe("REQ-29: stoa-core public type-shape preservation", () => {
  it("SeedType is a string-literal union of {koala, chainweaver, eckowallet}", () => {
    expectTypeOf<SeedType>().toEqualTypeOf<"koala" | "chainweaver" | "eckowallet">();
  });

  it("IKeyset has {keys, pred, keysetRef?}", () => {
    expectTypeOf<IKeyset>().toMatchTypeOf<{
      keys: string[];
      pred: string;
    }>();
  });

  it("GuardAnalysis.signable is a required number field", () => {
    expectTypeOf<GuardAnalysis["signable"]>().toEqualTypeOf<number>();
  });

  it("GuardAnalysis.satisfied is boolean", () => {
    expectTypeOf<GuardAnalysis["satisfied"]>().toEqualTypeOf<boolean>();
  });

  it("PactReader is callable", () => {
    expectTypeOf<PactReader>().toBeFunction();
  });

  it("MnemonicMismatchError extends Error class", () => {
    expectTypeOf<MnemonicMismatchError>().toMatchTypeOf<Error>();
  });

  it("SmartAccountAuthError extends Error class", () => {
    expectTypeOf<SmartAccountAuthError>().toMatchTypeOf<Error>();
  });

  it("InvalidPactReaderError extends TypeError class (input-validation seam family)", () => {
    expectTypeOf<InvalidPactReaderError>().toMatchTypeOf<TypeError>();
  });

  it("KadenaWallet class is a constructor function", () => {
    expectTypeOf<typeof KadenaWallet>().toMatchTypeOf<new (...args: any[]) => unknown>();
  });

  it("CodexSigningStrategy class is a constructor function", () => {
    expectTypeOf<typeof CodexSigningStrategy>().toMatchTypeOf<new (...args: any[]) => unknown>();
  });
});
