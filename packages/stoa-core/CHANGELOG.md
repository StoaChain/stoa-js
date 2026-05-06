# Changelog

All notable changes to `@stoachain/stoa-core`.

This package was born from the v4.0.0 split of `@stoachain/ouronet-core`. Pre-v4 history of the chain-generic surfaces (signing, wallet, crypto, network failover, gas, guard, errors, observability, dalos, reads, pact-format) lives in the [`@stoachain/ouronet-core` CHANGELOG](https://github.com/StoaChain/stoa-js/blob/main/packages/ouronet-core/CHANGELOG.md) v0.x–v3.3.8 entries — every release of `@stoachain/ouronet-core` shipped that infrastructure baked into the same package.

## 4.0.0 — 2026-05-06

**INITIAL RELEASE — born from the monorepo split.** `@stoachain/stoa-core` is the chain-generic StoaChain TypeScript foundation, extracted from `@stoachain/ouronet-core` v3.3.8 as part of the `stoa-js` monorepo restructure.

### What's in this package

Twelve subpath exports, one per chain-generic domain:

| Subpath | Purpose |
|---|---|
| `@stoachain/stoa-core/constants` | `KADENA_NETWORK`, `KADENA_CHAIN_ID`, `STOA_CHAINS`, `STOA_CHAIN_COUNT`, `KADENA_CHAINS`, failover-aware `getPactUrl(chainId)` / `getSpvUrl(chainId)` |
| `@stoachain/stoa-core/network` | `withFailover`, node failover state (`setNodeConfig`, `resetNodeFailover`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl`), `getFailoverClient` factory |
| `@stoachain/stoa-core/observability` | `getLogger()` / `setLogger(logger)` seam, `Logger` type, `InvalidLoggerError` |
| `@stoachain/stoa-core/signing` | `CodexSigningStrategy`, `KeyResolver`, `PactClient`, `IKadenaKeypair`, `IKeyset`, `fromKeypair`, `universalSignTransaction`, `sign`, partial-sig primitives |
| `@stoachain/stoa-core/wallet` | `KadenaWallet`, `KadenaWalletBuilder`, `BalanceResolver` seam, `StorageAdapter` |
| `@stoachain/stoa-core/crypto` | V1/V2 envelope encryption (`decryptStringV2`, `smartDecrypt`, `decryptStringV2WithDetails`, `smartDecryptWithDetails`), V1 fallback security advisory, typed crypto-error taxonomy |
| `@stoachain/stoa-core/errors` | Typed transaction errors (`createSigningError`, `createSimulationError`, `logDetailedError`, `UnknownPredicateError`) |
| `@stoachain/stoa-core/gas` | `calculateAutoGasLimit`, gas-calibration helpers |
| `@stoachain/stoa-core/guard` | Guard analysis (`analyzeGuard`), keyset normalisation (`normalizeKeysetRef`), Smart Ouronet Account `enforce-one` resolver |
| `@stoachain/stoa-core/reads` | `pactRead` + `setPactReader` / `getPactReader` seam, `rawCalibratedDirtyRead` (default uncached reader) |
| `@stoachain/stoa-core/pact` | Chain-generic format helpers: `formatDecimalForPact`, `formatIntegerForPact`, `mayComeWithDeimal`, `filterFreePositionData`, `formatEU`, `safeCreationTime` |
| `@stoachain/stoa-core/dalos` | DALOS account creation, primitive registry (`createDefaultRegistry`, `Leto`, `Artemis`, `Apollo`, `createGen1Primitive`) |

The root entry (`@stoachain/stoa-core`) is intentionally near-empty — consumers MUST reach into a subpath for tree-shaking. See the per-package `README.md` for the consumption pattern.

### What's NOT in this package

Anything Ouronet-specific lives in `@stoachain/ouronet-core`:

  - `KADENA_NAMESPACE = "ouronet-ns"`, `STOA_AUTONOMIC_*` accounts, `MAIN_TOKENS`, `TOKEN_ID_*`
  - The codex backup format (the `"1.2"` JSON envelope)
  - The 13 `interactions/*` Pact builders
  - cfm Pact-code string assembler

### Architecture preserved from `@stoachain/ouronet-core` v3.3.8

Three pluggable seams (DI without a framework):

  1. `setPactReader(fn)` — consumer wires a cache-aware reader at boot. `pactRead(...)` routes through it. Default is the uncached `rawCalibratedDirtyRead`.
  2. `KeyResolver` + `PactClient` interfaces — consumed by `CodexSigningStrategy`. Browser implements `ReduxCodexResolver`; server-side will implement `FileCodexResolver`.
  3. `BalanceResolver` (function-shaped, instance-level) — applied to `KadenaWallet.getBalance()`. Default throws if not configured.

Node failover is global state: `withFailover` switches active StoaChain node on health-check failure. Anything making an HTTP call routes through this — no `createClient(PACT_URL)` calls pinned to a single host.

### Tests

485 specs in `tests/`, covering the major surfaces: cfm-builders' format-helper subset, smart-account-auth, codex round-trip integration (lives in ouronet-core but exercises stoa-core's signing primitives), crypto v1+v2 + upgrade, gas, guard, network failover + nodeFailover state, pact-format, signing strategy + primitives, dalos integration, observability seam, error taxonomy.
