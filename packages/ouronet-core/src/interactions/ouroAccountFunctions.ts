/**
 * ouroAccountFunctions.ts
 * Selector / overview / guard / ledger reads against the ouronet-ns DALOS / DPL-UR / DSP / TFT modules.
 */

import { KADENA_NAMESPACE } from "../constants";
import type { IKeyset } from "@stoachain/stoa-core/guard";
import { normalizeKeysetRef } from "@stoachain/stoa-core/guard";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type { AccountSelectorData, StoaAccountSelectorData, AccountOverviewData } from "./ouroTypes";

export async function getAccountSelectorData(accounts: string[], options?: { skipTempWatcher?: boolean }): Promise<AccountSelectorData[]> {
  const accountsList = accounts.map(a => `"${a}"`).join(" ");
  const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0027_AccountSelectorMapper [${accountsList}])`;
  const response = await pactRead(pactCode, { tier: "T5", skipTempWatcher: options?.skipTempWatcher });

  if (!response?.result || (response.result as any).status === "failure") {
    getLogger().error("AccountSelectorMapper failed:", response);
    return [];
  }

  return ((response.result as any)?.data as AccountSelectorData[]) ?? [];
}

export async function getStoaAccountSelectorData(accounts: string[]): Promise<StoaAccountSelectorData[]> {
  if (accounts.length === 0) return [];
  const accountsList = accounts.map(a => `"${a}"`).join(" ");
  const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0028_StoaAccountSelectorMapper [${accountsList}])`;
  const response = await pactRead(pactCode, { tier: "T5" });

  if (!response?.result || (response.result as any).status === "failure") {
    getLogger().error("StoaAccountSelectorMapper failed:", response);
    return [];
  }

  return ((response.result as any)?.data as StoaAccountSelectorData[]) ?? [];
}

export async function getAccountOverview(account: string): Promise<AccountOverviewData | null> {
  if (!account) return null;
  const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0029_AccountOverview "${account}")`;
  const response = await pactRead(pactCode, { tier: "T7" });

  if (!response?.result || (response.result as any).status === "failure") {
    getLogger().error("AccountOverview failed:", response);
    return null;
  }

  return (response.result as any)?.data as AccountOverviewData ?? null;
}

export async function isAdministrativePause(): Promise<boolean> {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DALOS.UR_GAP)`, { tier: "T7" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any).data;
}

export async function kadenaLedger(address: string): Promise<any> {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DALOS.UR_KadenaLedger "${address}")`, { tier: "T5" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return response.result;
}

export const getKadenaAccountOwner = async (
  address: string,
): Promise<string | null> => {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DALOS.UR_AccountKadena "${address}")`, { tier: "T5" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any)?.data || null;
};

export const readKeyset = async (namespace: string, keysetName: string) => {
  const response = await pactRead(`(describe-keyset "${namespace}.${keysetName}")`, { tier: "T7" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any)?.data || null;
};

/**
 * Resolve a guard value — if it's a keyset ref, fetch the actual keyset.
 * Handles both direct keyset objects and {keysetref: {ns, ksn}} references.
 *
 * Normalises the chain-native lowercase `keysetref` field to camelCase
 * `keysetRef` at this boundary via `normalizeKeysetRef`, so internal code
 * that follows downstream of `resolveGuard` only ever sees the camelCase
 * form. The lowercase field is preserved for backwards-compat with
 * existing reads.
 */
export async function resolveGuard(guardData: any): Promise<any> {
  if (!guardData || guardData === false) return null;
  guardData = normalizeKeysetRef(guardData);
  if (guardData.keysetref) {
    const ks = await readKeyset(guardData.keysetref.ns, guardData.keysetref.ksn);
    if (ks) ks.keysetRef = `${guardData.keysetref.ns}.${guardData.keysetref.ksn}`;
    return ks;
  }
  return guardData;
}

export const getKadenaAccountGuard = async (
  address: string,
): Promise<IKeyset | null> => {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DALOS.UR_AccountGuard "${address}")`, { tier: "T7" });
  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }
  const { data } = response.result as any;
  if (data?.hasOwnProperty("keysetref")) {
    const ks2 = await readKeyset(data.keysetref.ns, data.keysetref.ksn);
    if (ks2) ks2.keysetRef = `${data.keysetref.ns}.${data.keysetref.ksn}`;
    return ks2;
  }

  return data || null;
};

export async function getOuronetKdaDetails(address: string): Promise<any> {
  // v3.3.6 (F-PERF-004): parallelize the two independent reads.
  // `getKadenaAccountOwner` reads `DALOS.UR_AccountKadena` and
  // `getKadenaAccountGuard` reads `DALOS.UR_AccountGuard` — neither
  // depends on the other's result, so `Promise.all` halves the
  // happy-path latency (was ~2 sequential RPC roundtrips, now ~1
  // parallel roundtrip).
  const [owner, guard] = await Promise.all([
    getKadenaAccountOwner(address),
    getKadenaAccountGuard(address),
  ]);

  return {
    isActive: owner !== null,
    owner: owner,
    guard: guard,
  };
}

// (namespace.DSP.URC_PrimordialPrices)

export async function primordialPrices(): Promise<any> {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DSP.URC_PrimordialPrices)`, { tier: "T6" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any)?.data || null;
}

// DALOS.UR_Elite account
export async function eliteAccount(address: string): Promise<any> {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DALOS.UR_Elite "${address}")`, { tier: "T6" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }
  return (response.result as any)?.data || null;
}


export async function filterKeysForInfo(
  address: string,
  table: number = 1,
  mode: boolean = true,
): Promise<any> {
  const pactCode = `(${KADENA_NAMESPACE}.TFT.DPTF-DPMF-ATS|UR_FilterKeysForInfo "${address}" ${table} ${mode})`;

  const response = await pactRead(pactCode, { tier: "T3" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any)?.data || null;
}

// returns the price of the activation
export async function usagePrice(tokenType: string = "standard"): Promise<any> {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DALOS.UR_UsagePrice "${tokenType}")`, { tier: "T7" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any)?.data || null;
}

// (namespace.DPL-UR.URC_0001_Header account) 5000 gas
// Legacy: getHeaderData removed — replaced by URC_0027_AccountSelectorMapper for header.
// HeaderV3 is still used by Dashboard (IndexCardsGrid, OuroAccountCard, FirestarterSection).
export async function getHeaderData(address: string = "", options?: { skipTempWatcher?: boolean }): Promise<any> {
  const response = await pactRead(`(${KADENA_NAMESPACE}.DPL-UR.URC_0001_HeaderV3 "${address}")`, { tier: "T6", skipTempWatcher: options?.skipTempWatcher });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve data from the transaction.");
  }

  return (response.result as any)?.data || null;
}
