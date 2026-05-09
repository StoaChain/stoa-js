/**
 * dexFunctions.ts
 *
 * Thin re-export shim for backward compat (Phase 1 of v4.2.0).
 *
 * The original 2663-line god file was split along Ouronet's locked seven-entity
 * taxonomy. Real logic now lives in entity-oriented files: dexSwapPair*Functions
 * (calc, execute, smart-swap, dashboard, admin), dexTrueFungibleFunctions,
 * dexOrtoFungibleFunctions, dexCollectablesFunctions, dexAcquisitionPoolFunctions,
 * dexParseFunctions, dexTypes. Every original symbol is reachable via this shim.
 */

export * from "./dexTypes";
export * from "./dexParseFunctions";
export * from "./dexSwapPairCalcFunctions";
export * from "./dexSwapPairExecuteFunctions";
export * from "./dexSwapPairSmartSwapFunctions";
export * from "./dexSwapPairDashboardFunctions";
export * from "./dexSwapPairAdminFunctions";
export * from "./dexTrueFungibleFunctions";
export * from "./dexOrtoFungibleFunctions";
export * from "./dexCollectablesFunctions";
export * from "./dexAcquisitionPoolFunctions";
export * from "./addLiquidityFunctions";
