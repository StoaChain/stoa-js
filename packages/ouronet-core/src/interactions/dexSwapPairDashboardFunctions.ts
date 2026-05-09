/**
 * dexSwapPairDashboardFunctions.ts
 * Swap pair dashboard reads and pool previews (URC_0003-0005, URC_0010 dashboard surface).
 */

import { KADENA_NAMESPACE } from "../constants";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type {
  SwapPoolData,
  PoolPreviewData,
  SwpairInternalDashboard,
} from "./dexTypes";

/**
 * Fetch all swap pair IDs from the SWP contract
 */
export async function getPoolIds(): Promise<string[] | null> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.SWP.URC_Swpairs)`, { tier: "T7" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve pool IDs from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Pool IDs query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;
    return Array.isArray(data) ? (data as string[]) : null;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Fetch the primordial pool ID
 */
export async function getPrimordialPool(): Promise<string | null> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_PrimordialPool)`, { tier: "T7" });
    if (response?.result?.status === "success") {
      return String(response.result.data);
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getPrimordialPool:", error);
    return null;
  }
}

/**
 * Fetch general information for all swap pairs
 */
export async function getSWPairGeneralInfo(): Promise<any> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.DPL-UR.URC_0003_SWPairGeneralInfo)`, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve general swap pair info from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`General info query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Fetch detailed dashboard information for a specific swap pair
 */
export async function getSWPairDashboardInfo(swpair: string): Promise<SwapPoolData | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0004_SWPairDashboardInfo "${swpair}")`;

    const response = await pactRead(pactCode, { tier: "T2" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve swap pair dashboard info from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Dashboard info query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    // Single pool API returns an object directly, not an array
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as SwapPoolData;
    } else if (Array.isArray(data) && data.length > 0) {
      return data[0] as SwapPoolData;
    } else {
      return null;
    }

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Fetch enhanced pool preview/dashboard data for a specific pool
 * Returns richer data structure with formatted values and weights
 */
export async function getPoolPreviewData(poolId: string): Promise<PoolPreviewData | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0004_SWPairDashboardInfo "${poolId}")`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve pool preview data from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Pool preview query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    // Enhanced pool API returns an object directly with additional formatted fields
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as PoolPreviewData;
    } else if (Array.isArray(data) && data.length > 0) {
      return data[0] as PoolPreviewData;
    } else {
      return null;
    }

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Fetch detailed dashboard information for multiple swap pairs
 */
export async function getSWPairMultiDashboardInfo(swpairs: string[]): Promise<SwapPoolData[] | null> {
  try {
    // Format array for Pact: ["id1" "id2" "id3"]
    const pactArray = `[${swpairs.map(swpair => `"${swpair}"`).join(' ')}]`;

    const response = await pactRead(`(${KADENA_NAMESPACE}.DPL-UR.URC_0005_SWPairMultiDashboardInfo ${pactArray})`, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve multi swap pair dashboard info from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Multi dashboard info query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;
    return Array.isArray(data) ? (data as SwapPoolData[]) : null;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Fetch comprehensive internal dashboard data for a specific swap pair
 * Contains all pool stats including detailed analytics
 */
export async function getSwpairInternalDashboard(swpair: string): Promise<SwpairInternalDashboard | null> {
  try {

    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0010_SwpairInternalDashboard "${swpair}")`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve internal dashboard data from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Internal dashboard query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    return data as SwpairInternalDashboard;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}
