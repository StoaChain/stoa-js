# Architecture

## Module Organization
- 14 top-level subpaths under `src/`: `codex/`, `constants/`, `crypto/`, `dalos/`, `errors/`, `gas/`, `guard/`, `interactions/`, `network/`, `pact/`, `reads/`, `signing/`, `wallet/`, plus the root index
- Every subdirectory has its own `index.ts` barrel and a matching entry in `package.json#exports` -- the project is built around the **subpath-export model** (`package.json:8-69`)
- `src/index.ts` is intentionally near-empty (`export {}`) with a comment steering consumers toward subpath imports for tree-shaking (`src/index.ts:1-9`)
- `interactions/` is special: 13 `*Functions.ts` files with overlapping symbol names; the barrel re-exports ONLY `ouroFunctions` (canonical type source), and `package.json:61-64` declares a `./interactions/*` glob export so consumers reach individual files explicitly (`src/interactions/index.ts:1-16`)
- Tests live in top-level `tests/`, NOT co-located -- `tsconfig.build.json` excludes them so they never reach `dist/`

## Design Patterns
- **Pluggable injection seams (no DI framework)** -- two narrow points let core stay environment-agnostic:
  1. `setPactReader(fn)` / `pactRead(...)` global function-pointer in `src/reads/pactReader.ts:44-74`. Default is the uncached `rawCalibratedDirtyRead`; OuronetUI plugs in a cache-aware reader at boot
  2. `KeyResolver` + `PactClient` interfaces in `src/signing/types.ts:46-86`, consumed by `CodexSigningStrategy` (`src/signing/codexStrategy.ts:32-36`). OuronetUI implements `ReduxCodexResolver`; HUB will implement `FileCodexResolver`
- **Strategy pattern with explicit pipeline** -- `SigningStrategy.execute({...})` runs an A-F sequence (build -> simulate -> calibrate gas -> rebuild -> analyze guards -> sign -> submit) (`src/signing/types.ts:97-153`, `src/signing/codexStrategy.ts:38-46`)
- **Module-level mutable global state for failover** -- `src/network/nodeFailover.ts` keeps `currentHost`, `PRIMARY_HOST`, `FALLBACK_HOST`, `retryTimer` as file-scope `let` bindings; `withFailover<T>` wraps fetch calls and switches host on network errors (`nodeFailover.ts:104-125`)
- **Discriminated-union options** -- `CreateAccountOptions` discriminates on `mode: 'random' | 'bitString' | 'integerBase10' | 'integerBase49' | 'seedWords' | 'bitmap'` (`src/dalos/account.ts:47-76`)
- **Pure shape discriminator** -- `classifyGuardKind(g)` in `src/guard/smartAccountAuth.ts:84-106` maps any value to one of `keyset | keyset-ref | capability | user | unknown`; intentionally mirrors OuronetUI `<GuardTree>` 1:1
- **Generic envelope types** -- `PlaintextCodex<KadenaSeed, OuroAccount, PureKeypair, AddressBookEntry, UiSettings>` lets the codec/serializer reason about shape only; consumers supply concrete types (`src/codex/types.ts:20-48`)
- **Custom error class hierarchy with structured fields** -- `SigningError implements TransactionError` carries `code`, `context`, `originalError`, `suggestions`; factory functions like `createSigningError`/`createSimulationError` classify by message-substring matching (`src/errors/transactionErrors.ts:13-50`)
- **CFM Pact-code builders extracted to pure functions** -- 15+ `buildXPactCode(p)` functions in `src/pact/cfmBuilders.ts` produce exact Pact source strings; tested in `tests/cfm-builders.test.ts` so namespace/operator typos surface offline rather than at chain-submit

## Data Flow
- Reads: interaction code calls `pactRead(pactCode, { tier, skipTempWatcher })` -> the configured `PactReader` (default `rawCalibratedDirtyRead`) -> `@kadena/client.dirtyRead` against `PACT_URL` (`src/interactions/ouroFunctions.ts:62-70`)
- Writes: caller builds Pact source -> `Pact.builder.execution(...)` -> `strategy.execute({build, guards, paymentKey})` -> simulate dirty-read -> `calculateAutoGasLimit` -> rebuild -> `analyzeGuard` -> `selectCapsSigningKey` -> `universalSignTransaction` -> `client.submit` -> request key (`src/signing/codexStrategy.ts:39-46`)
- HTTP base URLs are derived through `getActivePactUrl(chainId)` / `getActiveSpvUrl(chainId)` so every call honors the active failover node (`src/constants/kadena.ts:25-31`); the v1.6.1 commit removed the last `createClient(PACT_URL)` calls pinned to node2 from `interactions/*` per `CLAUDE.md:46-48`
- Codex serialization is one-way pure: `PlaintextCodex` -> `buildCodexExport` -> `serializeCodex` (`{version: "1.2", exportedAt, kadenaWallets, ouronetWallets, addressBook, uiSettings}`) -> caller stringifies (`src/codex/codec.ts:31-58`)

## API Patterns
- Library has NO HTTP surface of its own -- it is consumed exclusively by `import { ... } from "@stoachain/ouronet-core/<subpath>"`
- Subpath imports are mandatory in practice: importing from the root barrel only yields whatever `src/index.ts` re-exports (currently nothing) (`CLAUDE.md:33-37`)
- Pact code strings are built with template literals using the canonical `(${KADENA_NAMESPACE}.<MODULE>|<FN> <args>)` shape -- module-and-function joined by `|`, namespace from constants, every string-typed arg double-quoted, decimals run through `formatDecimalForPact` (`src/pact/cfmBuilders.ts:54-56`, `src/interactions/wrapFunctions.ts:42-47`)
- `createDefaultRegistry()` registers DALOS Genesis ONLY -- `Leto` / `Artemis` / `Apollo` / `createGen1Primitive` are exported from `./dalos` but consumers opt in via `registry.register(Leto)` (`src/dalos/index.ts:77-91`, `CLAUDE.md:53-55`)
- Smart Ouronet Account auth runs `enforce-one` over three branches (account guard / sovereign guard / governor); `analyzeSmartAccountAuthPaths` returns a 3-tuple in canonical order with `anyKeyBased` and `firstSatisfied` flags; `CodexSigningStrategy` itself stays AND-of-keysets and the consumer is responsible for picking which branch to feed in (`src/guard/smartAccountAuth.ts:171-179`, `:201-240`)
