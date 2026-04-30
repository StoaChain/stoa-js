# Conventions

## Naming
- **Files**: camelCase TypeScript modules (`pactReader.ts`, `nodeFailover.ts`, `smartAccountAuth.ts`, `cfmBuilders.ts`, `gasUtils.ts`, `transactionErrors.ts`); PascalCase only for class-as-module files (`KadenaWallet.ts`, `KadenaWalletBuilder.ts`)
- **Interactions group**: every file in `src/interactions/` ends with the suffix `Functions.ts` -- `ouroFunctions.ts`, `wrapFunctions.ts`, `coilFunctions.ts`, `dexFunctions.ts`, `kadenaFunctions.ts`, `kpayFunctions.ts`, `pensionFunctions.ts`, `urStoaFunctions.ts`, `crossChainFunctions.ts`, `infoOneFunctions.ts`, `addLiquidityFunctions.ts`, `activateFunctions.ts`, `guardFunctions.ts`
- **Interfaces**: `I` prefix for shape-only types -- `IKeyset` (`src/guard/guardUtils.ts:23`), `IKadenaKeypair` (`src/signing/types.ts:22`), `IOuroAccountKeypair` (referenced from `interactions/ouroFunctions`)
- **Plain interfaces (no prefix)**: `KeyResolver`, `PactClient`, `SigningStrategy`, `UniversalKeypair`, `EncryptedDataV2`, `AccountSelectorData`, `StoaAccountSelectorData`, `PlaintextCodex` -- the `I` prefix is reserved for Pact-mirroring/Kadena-domain shapes
- **Constants**: SCREAMING_SNAKE_CASE -- `KADENA_NETWORK`, `KADENA_CHAIN_ID`, `KADENA_NAMESPACE`, `PACT_URL`, `STOA_AUTONOMIC_OUROBOROS`, `ANU_PER_STOA`, `GAS_LIMIT_MAX`, `TTL_DEFAULT` (`src/constants/kadena.ts`, `src/gas/gasUtils.ts:14-29`)
- **Functions**: camelCase verbs -- `analyzeGuard`, `classifyGuardKind`, `extractKeysetFromGuard`, `setPactReader`, `getPactReader`, `pactRead`, `withFailover`, `getActivePactUrl`, `calculateAutoGasLimit`, `universalSignTransaction`
- **Pact builders**: strict `build<Operation>PactCode` pattern -- `buildTransferPactCode`, `buildCoilPactCode`, `buildRotateSovereignPactCode` (`src/pact/cfmBuilders.ts`, `tests/cfm-builders.test.ts:21-36`); always returns `string`, never has side effects
- **Classes**: PascalCase -- `KadenaWallet`, `KadenaWalletBuilder`, `CodexSigningStrategy`, `SigningError`, `CryptographicRegistry`
- **Type aliases**: PascalCase -- `GuardKind`, `GuardAnalysis`, `PactReader`, `CreateAccountMode`, `CreateAccountOptions`, `SmartAccountAuthBranch`, `SmartAccountAuthPaths`
- **Pact namespace mirror in TS**: when a file maps to a Pact module, comment headers cite the module/function path explicitly (e.g. `(ouronet-ns.TS01-C2.LQD)` in `src/interactions/wrapFunctions.ts:1-4`)

## Imports
- All imports are relative: `from "../constants"`, `from "../guard"`, `from "../signing/primitives"` -- no path alias used in source files (the `@` alias in `vitest.config.ts:11` is for test convenience only)
- Subpath imports of consumer code use the published name: `@stoachain/ouronet-core/guard`, `@stoachain/ouronet-core/interactions/wrapFunctions` (documented in `CLAUDE.md:33-37` and `src/interactions/index.ts:8-10`)
- External package imports come first, then relative imports (no enforced ordering tool -- `linter: "none"` in `.bee/config.json:3`)
- Barrel files re-export everything via `export * from "./<module>"` except `interactions/index.ts` which re-exports only `ouroFunctions` due to symbol overlap
- Type-only imports use `import type {...}` consistently (`src/signing/codexStrategy.ts:20`, `src/signing/types.ts:14`)
- DALOS subpath re-exports preserve original symbol names from `@stoachain/dalos-crypto/registry` so the two import paths are interchangeable (`src/dalos/index.ts:58-91`)

## Code Style
- 2-space indentation, double-quoted strings (matches `src/signing/types.ts`, `src/network/nodeFailover.ts`, `src/pact/cfmBuilders.ts` consistently)
- Trailing commas in multi-line literals (`src/dalos/account.ts:47-76`, `src/signing/types.ts:121-141`)
- `readonly` on object/tuple fields when the value is treated as immutable -- `SmartAccountAuthBranch` and `SmartAccountAuthPaths` use `readonly` extensively (`src/guard/smartAccountAuth.ts:128-179`)
- JSDoc block comments at the top of every module describe purpose, environment portability, and Phase/version provenance -- e.g. `src/reads/pactReader.ts:1-24`, `src/codex/codec.ts:1-17`, `src/network/nodeFailover.ts:1-9`
- Public types and interfaces have JSDoc with paragraph-length explanations including consumer-side context (browser vs HUB) -- `src/signing/types.ts:32-70`
- ASCII section dividers used to group related declarations: `// ─── Section ──────────`  (`src/pact/cfmBuilders.ts:35`, `src/constants/kadena.ts:33`)
- Error handling: try/catch with structured `createSigningError` / `createSimulationError` factories that match on `originalError.message` substrings (`src/errors/transactionErrors.ts:38-50`); short `} catch {` blocks used in defensive `isHealthy` and recovery-on-bad-input paths only (`src/network/nodeFailover.ts:43`, `src/crypto/v2.ts:127,146,183`)
- `: any` is in active use across interaction files (~169 occurrences) for raw Pact responses where the chain shape is heterogeneous; `AccountSelectorData` fields like `"ouronet-account-guard": any` document this explicitly with a comment (`src/interactions/ouroFunctions.ts:19,26`)
- Logging: ~103 `console.*` calls live in source -- mostly `console.error`/`console.warn` for failed reads and `console.info` for failover transitions (`src/network/nodeFailover.ts:51,59`); the library does not bundle a logger abstraction
- TypeScript strict mode is on; `noUnusedLocals` and `noUnusedParameters` enforce no dead names (`tsconfig.json:14-15`)

## Domain Vocabulary
- **OURO / Ouronet / OuroNet** -- the project's name and protocol family; capitalized variants reflect prose vs identifier context
- **StoaChain / Stoa** -- the chainweb network name; `KADENA_NETWORK = "stoa"` (`src/constants/kadena.ts:10`)
- **Pact** -- Kadena's smart-contract language; this library builds Pact code strings and reads/submits them
- **Codex** -- the user's encrypted-at-rest wallet bundle (kadenaWallets + ouronetWallets + pureKeypairs + addressBook + uiSettings); shape lives in `src/codex/types.ts`; portable export format frozen at `version: "1.2"` (`src/codex/codec.ts:8-13`)
- **CFM modal / handleExecute** -- the OuronetUI 23-modal "execute on-chain action" surface; the A-F pipeline replicated in `CodexSigningStrategy.execute` was originally inlined in each modal (`src/signing/codexStrategy.ts:39-46`)
- **DALOS** -- the cryptographic primitive system (registry of `CryptographicPrimitive` singletons); `DalosGenesis` is the only one in the default registry; `Leto`/`Artemis`/`Apollo` are historical-curve opt-ins (`src/dalos/index.ts:77-91`)
- **Standard vs Smart Ouronet Account** -- Standard accounts use the `Ѻ.` prefix and a single keyset guard; Smart accounts use the `Σ.` prefix and run `enforce-one` over three guards: account / sovereign / governor (`src/guard/smartAccountAuth.ts:5-25`)
- **Sovereign / Governor** -- Smart-account auth-path concepts; sovereign is the `Ѻ.` Standard account that owns the Smart account; governor is a polymorphic Pact guard (`src/interactions/ouroFunctions.ts:42-57`)
- **Patron / Resident** -- recurring CFM-modal arg names representing the gas-paying party and the account being acted upon (`src/pact/cfmBuilders.ts:54-56`, fixtures in `tests/cfm-builders.test.ts:40-43`)
- **ANU / STOA** -- atomic gas units; `1 STOA = 10^12 ANU` (`src/gas/gasUtils.ts:13-14`)
- **Stoa Autonomic Accounts** -- protocol-level `c:`-prefixed accounts: Ouroboros (staking), LiquidPot (native vault), OuronetGasStation (gas payer) (`src/constants/kadena.ts:36-44`)
- **AURYN / ELITEAURYN / SSTOA / OURO / VST** -- the canonical main token ids stamped with the `-8Nh-JO8JO4F5` salt (`src/constants/kadena.ts:63-81`)
- **Stoic predicates** -- extended Pact keyset predicates beyond keys-all/any/2: `keys-1/3/4`, `keys-M-of-N`, `at-least-N%`, all-but-one/two (`src/guard/guardUtils.ts:31-50`)
- **Koala / Chainweaver / Ecko / Foreign** -- the four signing-key seed types; routing differs (nacl Ed25519 vs `@kadena/hd-wallet` `kadenaSign` WASM) (`src/signing/universalSign.ts:10-20`, `src/signing/types.ts:25`)
- **Pact-code module path** -- `<namespace>.<contract-block>.<module>|<function>` joined by `|` between module and function (`src/pact/cfmBuilders.ts:42-44`)
- **Tier (e.g. T5)** -- `pactRead` option used by OuronetUI's cache layer to dedupe (`src/interactions/ouroFunctions.ts:63`, `src/reads/pactReader.ts:36`)
- **ZBOM** -- bill-of-materials for transaction signing scope; mentioned in `smartAccountAuth.ts` JSDoc as the "what the codex can sign" surface (`src/guard/smartAccountAuth.ts:18-21`)
