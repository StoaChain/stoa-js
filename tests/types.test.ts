/**
 * IKadenaKeypair cross-subpath type-level regression lock.
 *
 * This file is the compile-time guard that the canonical IKadenaKeypair
 * declaration at `src/signing/types.ts` remains the SOLE source of truth
 * across every subpath that previously declared a duplicate. After the
 * Phase-1 consolidation, the four `interactions/*` subpaths
 * (activateFunctions, dexFunctions, kpayFunctions, coilFunctions) consume
 * the canonical type via a type-only import from "../signing" — they do
 * NOT re-export the type. A direct type-only import from any of those
 * subpaths therefore fails with `TS2305: has no exported member`.
 *
 * Resolution: assert assignability against the call surface using a
 * function-parameter slot extracted from each exported function — direct
 * positional for kpayBuy/coilTokensGeneric, struct-nested (named field)
 * for executeDeployStandardAccount/executeSmartSwapWithSlippage. This
 * exercises the public API end-to-end and is a STRONGER assertion than
 * a direct type-alias import.
 *
 * Assertions are compile-time only and fire under vitest's
 * `test.typecheck` mode (enabled in `vitest.config.ts`). The 5 typed-const
 * assignment sites verify that a fixture with `seedType: "foreign"` and
 * `encryptedSecretKey: unknown` assigns cleanly to each subpath's
 * `IKadenaKeypair` slot.
 *
 * Reintroducing a drifted local `interface IKadenaKeypair` on any of the
 * four interactions subpaths that OMITS `"foreign"` from the `seedType`
 * literal-union will cause this file to fail to typecheck (TS2322:
 * `"foreign"` not assignable to `"koala" | "chainweaver" | "eckowallet"`)
 * and `npm test` to exit non-zero. That is the regression lock.
 *
 * Coverage caveat (intentional, documented): this file does NOT lock the
 * `encryptedSecretKey: unknown` typing. A drifted local declaration that
 * weakens `encryptedSecretKey` to `any` would silently pass — TypeScript
 * accepts assignment of `unknown` into an `any` slot. The `seedType`
 * literal is the load-bearing canonical-vs-drifted discriminator; the
 * `encryptedSecretKey` width is not. If `unknown` enforcement is later
 * needed, switch to `expectTypeOf<...>().not.toEqualTypeOf<any>()` from
 * vitest's type-tests, or add an `IsAny<T>` conditional-type guard.
 */

import { describe, it } from "vitest";
import type { IKadenaKeypair } from "../src/signing";
import { executeDeployStandardAccount } from "../src/interactions/activateFunctions";
import { executeSmartSwapWithSlippage } from "../src/interactions/dexFunctions";
import { kpayBuy } from "../src/interactions/kpayFunctions";
import { coilTokensGeneric } from "../src/interactions/coilFunctions";

describe("IKadenaKeypair regression lock", () => {
  it("compile-time assignability across all 5 subpaths", () => {
    const FIXTURE: {
      publicKey:          string;
      privateKey:         string;
      seedType:           "foreign";
      encryptedSecretKey: unknown;
    } = {
      publicKey: "deadbeef",
      privateKey: "00ff",
      seedType: "foreign" as const,
      encryptedSecretKey: undefined as unknown,
    };

    // Canonical site — direct type import resolves via `signing/index.ts`
    // re-export of `./types`.
    const _check_signing:  IKadenaKeypair                                                          = FIXTURE;

    // Struct-nested: activateFunctions.executeDeployStandardAccount takes a
    // single `DeployStandardAccountParams` struct; IKadenaKeypair lives at
    // the `gasPayerKey` field.
    const _check_activate: Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]       = FIXTURE;

    // Struct-nested: dexFunctions.executeSmartSwapWithSlippage takes a
    // single `SmartSwapExecutionParams` struct; IKadenaKeypair lives at
    // the `kadenaKeypair` field.
    const _check_dex:      Parameters<typeof executeSmartSwapWithSlippage>[0]["kadenaKeypair"]     = FIXTURE;

    // Direct-positional: kpayFunctions.kpayBuy takes IKadenaKeypair as
    // its 5th positional parameter (index 4) — `kadenaAccount`.
    const _check_kpay:     Parameters<typeof kpayBuy>[4]                                           = FIXTURE;

    // Direct-positional: coilFunctions.coilTokensGeneric takes
    // IKadenaKeypair as its 2nd positional parameter (index 1) —
    // `kadenaAccount`.
    const _check_coil:     Parameters<typeof coilTokensGeneric>[1]                                 = FIXTURE;

    // Reference the locals so `noUnusedLocals` (tsconfig.json:14) cannot
    // flag them even if a future refactor moves them to module scope.
    void _check_signing;
    void _check_activate;
    void _check_dex;
    void _check_kpay;
    void _check_coil;
  });
});
