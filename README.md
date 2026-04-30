# @stoachain/ouronet-core

Shared TypeScript core for the OuroNet ecosystem — StoaChain™ / Chainweb /
Pact interactions, Codex signing, guard analysis, encryption. Consumed by
**OuronetUI** (browser SPA) and the **AncientHolder HUB** (Node.js server).

## Status

**`2.0.1` on public npmjs** — full architectural-cleanup pass: wallet
subpath no longer transitively pulls in `@kadena/client`, `pactRead`
injection seam adopted across every internal pure-read site, and
`KadenaWallet.getBalance()` now propagates errors instead of silently
falling back to `"0"`. See **Migrating to v2.x** below for the consumer
upgrade path.

Every piece of blockchain logic that used to live in OuronetUI has
landed here: Pact builders, signing pipeline (CodexSigningStrategy +
universalSignTransaction), encryption (V1 + V2 + smartDecrypt), guard
analysis, gas calibration, codex codec, seed-type migration. OuronetUI
is now a pure consumer.

Since **v1.3.0**, OuronetCore integrates
**[`@stoachain/dalos-crypto@^1.2.0`](https://www.npmjs.com/package/@stoachain/dalos-crypto)**
via a new `./dalos` subpath — consumers mint Ouronet accounts locally
(all six DALOS input modes: random, bitmap, bitstring, base-10,
base-49, seed words) without touching the retired
`go.ouronetwork.io/api/generate` endpoint.

**v1.4.0** — `AccountSelectorData` now includes `public-key`,
`sovereign`, and `governor` for Smart Ouronet Account display (Σ.
prefix accounts with sovereign + governor authorisation paths).

**v1.5.0** — re-exports `Leto` / `Artemis` / `Apollo` historical-curve
primitives + `createGen1Primitive` factory through the `./dalos`
subpath. NOT registered in `createDefaultRegistry()` — Ouronet stays
Genesis-only; consumers opt in.

**v1.6.0** — Smart Ouronet Account auth-path primitives. `/guard`
gains `classifyGuardKind`, `extractKeysetFromGuard`,
`analyzeSmartAccountAuthPaths` to discriminate the four guard shapes
and resolve the `enforce-one` over (account guard / sovereign /
governor). `buildRotateSovereignPactCode` is the first CFM function
targeting a Smart account's auth path.

**v1.6.1** — every internal `interactions/*` helper now honors the
active failover node (no more `createClient(PACT_URL)` pinned to
node2).

**v1.7.0** — `IKadenaKeypair` consolidated to a single canonical
declaration in `src/signing/types.ts`. The duplicate copies that lived
across `interactions/*` are replaced with `import type` re-exports.
Closes audit finding F-CORE-001 (CRITICAL).

**v2.0.0** — wallet subpath layering restored + `pactRead` injection
seam fully adopted. Closes F-CORE-005 + F-CORE-006 (HIGH). **Two
breaking changes** for consumers — see migration guide below.

**v2.0.1** — documentation/release-process patch. Adds `CHANGELOG.md`
to the npm tarball, auto-creates GitHub Releases on tag push, and
backfills Releases for v1.7.0 and v2.0.0. No runtime change.

**346 tests** pass on every commit. Published to the public npmjs
registry via `.github/workflows/publish.yml` on every `v*` tag (which
also creates a GitHub Release).

```bash
npm install @stoachain/ouronet-core
```

## Migrating to v2.x

Two breaking changes shipped in v2.0.0 — both consumer-side, no
internal call sites in `src/` are affected.

### 1. `KadenaWallet` requires a `balanceResolver` to fetch balances

The `wallet/` subpath no longer imports from `interactions/*` (closes
F-CORE-005). The `KadenaWallet` class now exposes a publicly mutable
`balanceResolver: BalanceResolver` instance property. The default is a
lazy throwing stub — it fires only when `wallet.getBalance()` is
actually called, so wallets used purely for address derivation stay
zero-config.

```ts
import KadenaWallet from "@stoachain/ouronet-core/wallet";
import { getBalance } from "@stoachain/ouronet-core/interactions/kadenaFunctions";

const wallet = new KadenaWallet({
  parentId: 0, index: 0,
  secret: ..., publicKey: ..., derivationPath: "m/44'/...",
  // Wrap interactions.getBalance to match the
  // (address) => Promise<string> contract:
  balanceResolver: (addr) => getBalance(addr).then((r) => r.balance ?? "0"),
});

// Or assign post-construction:
wallet.balanceResolver = (addr) => myIndexer.balanceOf(addr);
```

`wallet.getBalance()` now **propagates errors** — the previous
`?? "0"` silent fallback is gone (mildly breaking behavioural shift).
Wrap the call in `try/catch`, or have your resolver default-on-error
return `"0"`.

### 2. `simulateTransaction(pactCode, chainId)` signature change

`interactions/crossChainFunctions.simulateTransaction` previously
accepted a pre-built `IUnsignedCommand` transaction object. It now
accepts the Pact code string directly:

```ts
// Before (v1.x):
const tx = Pact.builder.execution(code).setMeta(...).createTransaction();
const result = await simulateTransaction(tx, chainId);

// After (v2.x):
const result = await simulateTransaction(code, chainId);
```

The return shape `{ success, result?, error?, gas? }` is unchanged.

## Design docs

The architectural plan, per-phase migration history, HUB handoff, and
decision log live in the **OuronetUI repo** under `docs/`:

- [`EXTRACT_OURONET_CORE_PLAN.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/EXTRACT_OURONET_CORE_PLAN.md) — the 8-phase migration plan (now complete)
- [`ANCIENTHOLDER_HUB_HANDOFF.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/ANCIENTHOLDER_HUB_HANDOFF.md) — what the HUB agent needs to know to integrate
- [`TESTING_STRATEGY.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/TESTING_STRATEGY.md) — 3-tier testing approach + current state + roadmap
- [`CFM_BUILD_GUIDE.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/CFM_BUILD_GUIDE.md) — how a CFM modal uses this package

Don't fork logic — add to core, version-bump, publish, and consumers
upgrade deliberately.

## Submodules

Each is a subpath export of the package: `import { ... } from "@stoachain/ouronet-core/<submodule>"`.

| Path | Contains |
|---|---|
| `@stoachain/ouronet-core/constants` | `KADENA_NAMESPACE`, `KADENA_CHAIN_ID`, `KADENA_NETWORK`, `PACT_URL`, gas-station + liquidpot addresses, every `TOKEN_ID_*` |
| `@stoachain/ouronet-core/network` | Node failover (node2 → node1), URL construction |
| `@stoachain/ouronet-core/gas` | `calculateAutoGasLimit`, ANU/STOA math |
| `@stoachain/ouronet-core/guard` | `analyzeGuard`, `buildCodexPubSet`, `selectCapsSigningKey`, `computeThreshold` (all predicates including `stoa-ns.stoic-predicates.*`); **(v1.6.0+)** `classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths` for the Smart Ouronet Account three-branch auth-path resolution (`enforce-one` over account-guard / sovereign-guard / governor) |
| `@stoachain/ouronet-core/crypto` | V1 + V2 AES-GCM-256 encryption, `smartDecrypt`, pure `smartEncrypt(pt, pw, schemaVersion)` |
| `@stoachain/ouronet-core/signing` | `KeyResolver` / `SigningStrategy` interfaces, `CodexSigningStrategy`, `universalSignTransaction`, signing primitives (`publicKeyFromPrivateKey`, etc.) |
| `@stoachain/ouronet-core/codex` | `PlaintextCodex` generic type, `serializeCodex` / `deserializeCodex` (backup format `"1.2"`), `migrateSeedType` |
| `@stoachain/ouronet-core/reads` | `rawCalibratedDirtyRead` (pure Pact read with node failover; no cache) |
| `@stoachain/ouronet-core/pact` | `formatDecimalForPact`, `safeCreationTime`, `filterFreePositionData`, EU locale formatters, and **14 `buildXxxPactCode` builders** for every CFM function the ecosystem ships |
| `@stoachain/ouronet-core/interactions` | Read helpers (`getXxxInfo`, `getXxxBalance`, `getHibernatedNonces…`) + non-CFM execute helpers (`executeWrapStoa`, `executeWrapUrStoa`, `executeNativeUrStoaTransfer`); **(v2.0.0+)** `simulateTransaction(pactCode, chainId)` (signature change — see Migrating to v2.x) |
| `@stoachain/ouronet-core/dalos` | **(v1.3.0+)** thin re-export of `@stoachain/dalos-crypto/registry` + `createOuronetAccount(registry, options)` convenience helper covering all 6 DALOS input modes. One-stop shop for browser-side key-gen; no need to install `dalos-crypto` as a separate dep. |

## Quick start — `/dalos` subpath

Mint a new Ouronet account locally in one call:

```ts
import {
  createDefaultRegistry,
  createOuronetAccount,
} from "@stoachain/ouronet-core/dalos";

const registry = createDefaultRegistry();

// Random account (simplest — OS randomness)
const a = createOuronetAccount(registry, { mode: "random" });

// From a seed phrase (any array of UTF-8 words, 4–256 entries)
const b = createOuronetAccount(registry, {
  mode: "seedWords",
  data: ["mountain", "whisper", "aurora", "eternal"],
});

// From a 40×40 bitmap (1 = black, 0 = white; row-major TTB-LTR)
import type { Bitmap } from "@stoachain/ouronet-core/dalos";
const bitmap: Bitmap = /* 40 rows × 40 cols */;
const c = createOuronetAccount(registry, { mode: "bitmap", data: bitmap });

console.log(b.standardAddress);    // Ѻ.xxxxx…
console.log(b.keyPair.priv);       // base-49 private key
console.log(b.privateKey.int49);   // same, via `privateKey` object
console.log(b.privateKey.int10);   // base-10 representation
console.log(b.privateKey.bitString); // 1600-bit binary
```

Same API shape as `@stoachain/dalos-crypto/registry` — OuronetCore just
re-exports the types and adds `createOuronetAccount` as a convenience.
See [`@stoachain/dalos-crypto`](https://www.npmjs.com/package/@stoachain/dalos-crypto)
for deeper documentation on the cryptographic primitive itself.

## Local development

```bash
npm install
npm run build        # tsc -p tsconfig.build.json → dist/
npm run typecheck    # tsc --noEmit
npm test             # vitest run — 346 tests across crypto, guard, gas, pact format, signing, strategy, codex, cfmBuilders, dalos integration, wallet, interactions-read-seam
```

To hot-reload changes into OuronetUI (which now depends on the published
registry version), use `npm link`:

```bash
cd OuronetCore && npm link
cd OuronetUI  && npm link @stoachain/ouronet-core
# Edit core, run `npm run build` in OuronetCore, UI picks up the change.
# npm unlink @stoachain/ouronet-core  # restores registry resolution
```

## Publishing

Push a `v*`-prefixed tag and `.github/workflows/publish.yml` handles the
rest — typecheck + build + test + `npm publish` to **public npmjs.org**
under the `@stoachain` scope. Version parity check bakes in protection
against mismatched tag / package.json versions.

```bash
# After bumping package.json + CHANGELOG.md and committing:
git tag v1.3.1 -m "v1.3.1 — ..."
git push origin v1.3.1
# Workflow publishes within ~2 minutes. Consumers run `npm install` to pick up.
```

## Versioning

Strict semver. Breaking changes → major version bump → consumers upgrade
deliberately. Changelog in `CHANGELOG.md`.

## License

UNLICENSED (org-owned package). Public on
[npmjs.com/package/@stoachain/ouronet-core](https://www.npmjs.com/package/@stoachain/ouronet-core);
authoring rights retained by AncientHoldings GmbH.
