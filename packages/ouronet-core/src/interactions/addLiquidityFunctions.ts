import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";
import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION,
  KADENA_NETWORK,
} from "../constants";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { universalSignTransaction, fromKeypair } from "@stoachain/stoa-core/signing";
import type { IOuroAccountKeypair } from "./dexTypes";
import { mayComeWithDeimal, safeCreationTime } from "@stoachain/stoa-core/pact";
import { pactRead } from "@stoachain/stoa-core/reads";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { getLogger } from "@stoachain/stoa-core/observability";

// ===========================
// ADD LIQUIDITY FUNCTIONS
// ===========================

// Liquidity Data object interface
export interface LiquidityData {
  [key: string]: any; // Will be defined based on actual Pact structure
}

// Deviation validation result
export interface DeviationResult {
  deviation: number;
  maxDeviation: number;
  isValid: boolean;
}

// Add Liquidity parameters
export interface AddLiquidityParams {
  patronKeypair: IOuroAccountKeypair;
  kadenaKeypair: IKadenaKeypair;
  guardKeypair: IKadenaKeypair;
  account: string;
  swpair: string;
  inputAmounts: string[];
}

// LP Type information
export interface LPTypeInfo {
  hasFrozenLP: boolean | null;
  hasSleepingLP: boolean | null;
}

// Special LP Type parameters
export interface SpecialLPParams {
  type: "iced" | "glacial" | "frozen" | "sleeping";
  frozenDptf?: string; // For frozen LP
  sleepingDpmf?: string; // For sleeping LP
  nonce?: number; // For sleeping LP
}

/**
 * Generate LiquidityData object for deviation validation
 */
export async function generateLiquidityData(
  swpair: string,
  input: string,
  amounts: number[]
): Promise<LiquidityData | null> {
  try {
    const pactAmounts = `[${amounts.map(amount => {
      const amountStr = amount.toString();
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;
    
    const response = await pactRead(
      `(${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" "${input}" ${pactAmounts})`,
      { tier: "T2" },
    );

    if (!response || !response.result) {
      throw new Error("Failed to generate liquidity data from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Liquidity data generation failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data as LiquidityData;
    
  } catch (error) {
    getLogger().error("Generate liquidity data failed:", error);
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Validate liquidity deviation
 */
export async function validateLiquidityDeviation(
  swpair: string,
  liquidityData: LiquidityData
): Promise<DeviationResult | null> {
  try {
    const response = await pactRead(
      `(${KADENA_NAMESPACE}.SWPL.UEV_Liquidity "${swpair}" ${JSON.stringify(liquidityData)})`,
      { tier: "T2" },
    );

    if (!response || !response.result) {
      throw new Error("Failed to validate liquidity deviation from the transaction.");
    }

    if (response.result.status === "failure") {
      // This might fail if deviation exceeds max - capture the error for UI
      const errorMessage = response.result.error?.message || "";
      const deviationMatch = errorMessage.match(/(\d+\.?\d*)\s*deviation.*maximum.*?(\d+\.?\d*)/);
      
      if (deviationMatch) {
        return {
          deviation: parseFloat(deviationMatch[1]),
          maxDeviation: parseFloat(deviationMatch[2]),
          isValid: false
        };
      }
      
      throw new Error(`Liquidity deviation validation failed: ${errorMessage}`);
    }

    const data = response.result.data;
    
    // Data should be [dev, max-dev]
    if (Array.isArray(data) && data.length >= 2) {
      const deviation = typeof data[0] === 'object' ? parseFloat(data[0].decimal) : parseFloat(data[0]);
      const maxDeviation = typeof data[1] === 'object' ? parseFloat(data[1].decimal) : parseFloat(data[1]);
      
      return {
        deviation,
        maxDeviation,
        isValid: deviation <= maxDeviation
      };
    }
    
    return null;
    
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Calculate balanced liquidity amounts based on one input token
 */
export async function calculateBalancedLiquidity(
  swpair: string,
  inputTokenId: string,
  inputAmount: string,
  withValidation: boolean = true
): Promise<string[]> {
  try {
    // Format amount for Pact (ensure decimal format)
    const pactAmount = inputAmount.includes('.') 
      ? inputAmount 
      : `${inputAmount}.0`;
    
    const pactCode = `(${KADENA_NAMESPACE}.SWPL.URC_BalancedLiquidity "${swpair}" "${inputTokenId}" ${pactAmount} ${withValidation})`;

    const response = await pactRead(pactCode, { tier: "T2" });

    if (!response || !response.result) {
      throw new Error("Failed to calculate balanced liquidity from the transaction.");
    }

    if (response.result.status === "failure") {
      const errorMessage = response.result.error?.message || "Unknown error";
      throw new Error(`Balanced liquidity calculation failed: ${errorMessage}`);
    }

    const data = response.result.data;
    
    // Parse the result array using mayComeWithDeimal for consistent handling
    let balancedAmounts: string[] = [];
    
    if (Array.isArray(data)) {
      balancedAmounts = data.map(item => mayComeWithDeimal(item));
    } else {
      throw new Error("Expected array result from balanced liquidity calculation");
    }
    
    return balancedAmounts;
    
  } catch (error) {
    throw error instanceof Error ? error : new Error("Balanced liquidity calculation failed");
  }
}

/**
 * Check if pool supports special LP types
 */
export async function getLPTypeInfo(swpair: string): Promise<LPTypeInfo> {
  const [frozenCheck, sleepingCheck] = await Promise.all([
    // Check for Frozen LP support
    (async () => {
      try {
        const response = await pactRead(
          `(${KADENA_NAMESPACE}.SWP.UR_IzFrozenLP "${swpair}")`,
          { tier: "T7" },
        );

        return response?.result?.status === "success" ? response.result.data === true : false;
      } catch (error) {
        getLogger().error("Error checking Frozen LP:", error);
        return null;
      }
    })(),

    // Check for Sleeping LP support
    (async () => {
      try {
        const response = await pactRead(
          `(${KADENA_NAMESPACE}.SWP.UR_IzSleepingLP "${swpair}")`,
          { tier: "T7" },
        );

        return response?.result?.status === "success" ? response.result.data === true : false;
      } catch (error) {
        getLogger().error("Error checking Sleeping LP:", error);
        return null;
      }
    })()
  ]);

  return {
    hasFrozenLP: frozenCheck,
    hasSleepingLP: sleepingCheck
  };
}

/**
 * Execute single-step add liquidity (TS01-C3 module)
 */
export async function executeAddLiquiditySingle(
  params: AddLiquidityParams
): Promise<any> {
  try {
    const pactInputAmounts = `[${params.inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : String(amount);
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;
    
    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_AddLiquidity "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${pactInputAmounts})`;
  
    const keysetName = `ks`;
    // Scale gas limit based on pool token count: 60k per token
    const tokenCount = params.inputAmounts.length;
    const defaultGasLimit = tokenCount * 100_000;
    
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride ?? defaultGasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);
    
    // Simulate to estimate gas
    const simTransaction = buildTransaction(defaultGasLimit);
    const simulation = await dirtyRead(simTransaction);

    // Check if simulation failed
    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Add liquidity simulation failed: ${errorMessage}`);
    }

    // Set actual gas limit = simulation gas + 5K buffer
    const actualGasLimit = (simulation.gas || defaultGasLimit) + 5_000;
    const transaction = buildTransaction(actualGasLimit);

    // Sign the transaction
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(params.kadenaKeypair),
    fromKeypair(params.guardKeypair),
  ]);

    // Submit the signed transaction
    const result = await submit(signedTransaction);
    
    return result;
    
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Main add liquidity function — single-step with gas simulation.
 *
 * REMOVED IN v3.2.2: the four multi-step execute functions
 * (`executeAddLiquidityMultiStep1`, `executeAddLiquidityMultiStep2`,
 * `executeAddLiquidityMultiStep3`, `executeAddLiquidityMultiStepComplete`)
 * and the `MultiStepAddLiquidityResult` type they returned. The
 * multi-step pipeline existed because the historical Kadena chainweb
 * gas limit (150k per block) couldn't fit a single-block add-liquidity
 * transaction; the consumer had to split into a defpact with two
 * continuation steps. StoaChain's chainweb runs at 2M gas per block
 * (13×), which fits the entire add-liquidity flow in one transaction —
 * so the multi-step path has been dead code in OuronetUI since the
 * gas-limit increase. Removing it closes audit findings F-ERR-005
 * (`error.message.includes` on possibly-undefined retry-loop crashes),
 * F-ERR-014 (listen timeout vs submit failure double-pay risk),
 * F-PERF-014 (4× hardcoded 3-second sleeps), F-PERF-015 (retry-with-
 * fixed-sleep against string-matched error messages), and F-API-026
 * (the `_strategy` parameter on `executeAddLiquidity` was always
 * `"auto"` → single-step path; dead public surface).
 *
 * The Pact-side multi-step contract still exists on chain
 * (`TS01-CP.SWP|C_AddStandardLiquidity` defpact with continuation
 * steps) — preserved for historical interoperability. This package
 * just stops exposing the TypeScript wrappers around it because no
 * consumer needs them any more.
 */
export async function executeAddLiquidity(
  params: AddLiquidityParams,
): Promise<any> {
  try {
    return await executeAddLiquiditySingle(params);
  } catch (error) {
    getLogger().error("Add Liquidity Error:", error);
    throw error instanceof Error ? error : new Error("Add liquidity execution failed");
  }
}

/**
 * Execute special LP type add liquidity (Iced, Glacial, Frozen, Sleeping)
 */
export async function executeSpecialAddLiquidity(
  params: AddLiquidityParams,
  specialParams: SpecialLPParams
): Promise<any> {
  try {
    let pactCode: string;

    const pactInputAmounts = `[${params.inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : String(amount);
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;
    
    switch (specialParams.type) {
      case "iced":
        pactCode = `(${KADENA_NAMESPACE}.TS01-CP.SWP|C_AddIcedLiquidity "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${pactInputAmounts})`;
        break;
      case "glacial":
        pactCode = `(${KADENA_NAMESPACE}.TS01-CP.SWP|C_AddGlacialLiquidity "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${pactInputAmounts})`;
        break;
      case "frozen":
        if (!specialParams.frozenDptf) {
          throw new Error("frozenDptf parameter required for frozen liquidity");
        }
        // Note: Frozen liquidity uses single input amount, not array
        const frozenAmount = params.inputAmounts[0] || 0;
        const frozenAmountStr = frozenAmount.toString().includes('.') ? frozenAmount.toString() : `${frozenAmount}.0`;
        pactCode = `(${KADENA_NAMESPACE}.TS01-CP.SWP|C_AddFrozenLiquidity "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" "${specialParams.frozenDptf}" ${frozenAmountStr})`;
        break;
      case "sleeping":
        if (!specialParams.sleepingDpmf || specialParams.nonce === undefined) {
          throw new Error("sleepingDpmf and nonce parameters required for sleeping liquidity");
        }
        pactCode = `(${KADENA_NAMESPACE}.TS01-CP.SWP|C_AddSleepingLiquidity "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" "${specialParams.sleepingDpmf}" ${specialParams.nonce})`;
        break;
      default:
        throw new Error(`Unsupported special LP type: ${specialParams.type}`);
    }
    
    const keysetName = `ks`;
    let gasLimit = 2_000_000;
    
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride || gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);
    
    // First do a simulation to check gas
    let transaction = buildTransaction();
    const simulation = await dirtyRead(transaction);
    

    
    // Check if simulation failed
    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Add ${specialParams.type} liquidity simulation failed: ${errorMessage}`);
    }

    // Check if we need to adjust gas limit
    const requiredGas = simulation.gas;
    if (requiredGas && requiredGas > gasLimit) {
      gasLimit = calculateAutoGasLimit(requiredGas);
      transaction = buildTransaction(gasLimit);
    }

    // Sign the transaction
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(params.kadenaKeypair),
    fromKeypair(params.guardKeypair),
  ]);

    // Submit the transaction
    const result = await submit(signedTransaction);
    
    
    return result;
    
  } catch (error) {
    getLogger().error(`Add ${specialParams.type} Liquidity Error:`, error);
    throw error instanceof Error ? error : new Error("Special add liquidity execution failed");
  }
}

// ── Balanced & Asymmetric Liquidity Functions ─────────────────────────────────


/**
 * URC_BalancedLiquidity — compute balanced amounts for all tokens given one input.
 * Returns decimal[] with balanced values for each pool token.
 */
export async function getBalancedLiquidity(
  swpair: string, inputId: string, inputAmount: string, withValidation: boolean = false
): Promise<string[] | null> {
  try {
    const amt = inputAmount.includes(".") ? inputAmount : inputAmount + ".0";
    const pactCode = `(${KADENA_NAMESPACE}.SWPL.URC_BalancedLiquidity "${swpair}" "${inputId}" ${amt} ${withValidation})`;
    const res = await pactRead(pactCode, { tier: "T2" });
    if (!res?.result || res.result.status === "failure") return null;
    const data = res.result.data as any;
    if (!Array.isArray(data)) return null;
    return data.map((v: any) => {
      if (typeof v === "object" && v?.decimal) return String(v.decimal);
      return String(v);
    });
  } catch (e) { getLogger().error("getBalancedLiquidity error:", e); return null; }
}

/**
 * URC_SortLiquidity — split input amounts into balanced + asymmetric portions.
 * Returns { balanced: string[], asymmetric: string[] }
 */
export async function getSortLiquidity(
  swpair: string, inputAmounts: string[]
): Promise<{ balanced: string[]; asymmetric: string[] } | null> {
  try {
    const pactAmounts = `[${inputAmounts.map(a => { const s = String(a); return s.includes(".") ? s : s + ".0"; }).join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.SWPL.URC_SortLiquidity "${swpair}" ${pactAmounts})`;
    const res = await pactRead(pactCode, { tier: "T2" });
    if (!res?.result || res.result.status === "failure") return null;
    const data = res.result.data as any;
    const parseArr = (arr: any[]) => arr.map((v: any) => typeof v === "object" && v?.decimal ? String(v.decimal) : String(v));
    return {
      balanced: parseArr(data?.balanced ?? []),
      asymmetric: parseArr(data?.asymmetric ?? []),
    };
  } catch (e) { getLogger().error("getSortLiquidity error:", e); return null; }
}

/**
 * URC_LD — build LiquidityData object from input amounts.
 */
export async function getLiquidityData(
  swpair: string, inputAmounts: string[]
): Promise<any | null> {
  try {
    const pactAmounts = `[${inputAmounts.map(a => { const s = String(a); return s.includes(".") ? s : s + ".0"; }).join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" ${pactAmounts})`;
    const res = await pactRead(pactCode, { tier: "T2" });
    if (!res?.result || res.result.status === "failure") return null;
    return res.result.data;
  } catch (e) { getLogger().error("getLiquidityData error:", e); return null; }
}

/**
 * UEV_Liquidity — validate asymmetric liquidity doesn't exceed max deviation.
 * Returns true if valid, false if deviation too high.
 */
/**
 * Validate asymmetric liquidity deviation.
 * Returns { valid: true, computed: string, max: string } on success,
 * { valid: false } when deviation exceeds limit (chain rejection / validation failure),
 * or { valid: false, error: string } when the read itself throws (RPC failure).
 * Consumers distinguish RPC failure from validation rejection by checking the optional `error` field.
 */
export async function validateLiquidity(
  swpair: string, inputAmounts: string[]
): Promise<{ valid: boolean; computed?: string; max?: string; error?: string }> {
  try {
    const pactAmounts = `[${inputAmounts.map(a => { const s = String(a || "0"); return s.includes(".") ? s : s + ".0"; }).join(" ")}]`;
    // Try to run UEV_Liquidity — returns [computed_deviation, max_deviation] on success, throws on exceed
    const pactCode = `(let ((ld (${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" ${pactAmounts}))) (try [false false] (${KADENA_NAMESPACE}.SWPL.UEV_Liquidity "${swpair}" ld)))`;
    const res = await pactRead(pactCode, { tier: "T2" });
    if (!res?.result || res.result.status === "failure") return { valid: false };
    const data = res.result.data as any;
    // If try caught the error, data = [false, false]
    if (Array.isArray(data) && data[0] === false) return { valid: false };
    // Success: data = [computed_deviation, max_deviation]
    if (Array.isArray(data) && data.length >= 2) {
      const parseVal = (v: any) => typeof v === "object" && v?.decimal ? String(v.decimal) : String(v);
      return { valid: true, computed: parseVal(data[0]), max: parseVal(data[1]) };
    }
    return { valid: true };
  } catch (error) {
    getLogger().error("Error in validateLiquidity:", error);
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Execute Fuel — transfer tokens into pool without receiving LP.
 * (ouronet-ns.TS01-C3.SWP|C_Fuel patron account swpair input-amounts)
 */
export async function executeFuel(
  params: AddLiquidityParams
): Promise<any> {
  try {
    const pactInputAmounts = `[${params.inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : String(amount);
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;
    
    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_Fuel "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${pactInputAmounts})`;
  
    const keysetName = `ks`;
    const tokenCount = params.inputAmounts.length;
    const defaultGasLimit = tokenCount * 100_000;
    
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride ?? defaultGasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);
    
    const simTransaction = buildTransaction(defaultGasLimit);
    const simulation = await dirtyRead(simTransaction);

    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Fuel simulation failed: ${errorMessage}`);
    }

    const actualGasLimit = (simulation.gas || defaultGasLimit) + 5_000;
    const transaction = buildTransaction(actualGasLimit);

    const signedTransaction: any = await universalSignTransaction(transaction, [
      fromKeypair(params.kadenaKeypair),
      fromKeypair(params.guardKeypair),
    ]);

    const result = await submit(signedTransaction);
    return result;
    
  } catch (error) {
    throw error instanceof Error ? error : new Error("Fuel execution failed");
  }
}

/**
 * Execute Remove Liquidity (Unfold) — burn LP tokens to recover underlying pool tokens.
 * (ouronet-ns.TS01-C3.SWP|C_RemoveLiquidity patron account swpair lp-amount)
 */
export async function executeRemoveLiquidity(
  params: {
    patronKeypair: { address: string; publicKey: string };
    kadenaKeypair: { publicKey: string; secretKey: string };
    guardKeypair: { publicKey: string; secretKey: string };
    account: string;
    swpair: string;
    lpAmount: string;
  }
): Promise<any> {
  try {
    const decLpAmount = params.lpAmount.includes(".") ? params.lpAmount : params.lpAmount + ".0";
    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_RemoveLiquidity "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${decLpAmount})`;
    const keysetName = `ks`;
    const defaultGasLimit = 200_000;
    
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride ?? defaultGasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);
    
    const simTransaction = buildTransaction(defaultGasLimit);
    const simulation = await dirtyRead(simTransaction);

    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Remove liquidity simulation failed: ${errorMessage}`);
    }

    const actualGasLimit = (simulation.gas || defaultGasLimit) + 5_000;
    const transaction = buildTransaction(actualGasLimit);

    const signedTransaction: any = await universalSignTransaction(transaction, [
      fromKeypair(params.kadenaKeypair),
      fromKeypair(params.guardKeypair),
    ]);

    const result = await submit(signedTransaction);
    return result;
    
  } catch (error) {
    throw error instanceof Error ? error : new Error("Remove liquidity execution failed");
  }
}
