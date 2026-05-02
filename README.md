# @stoachain/ouronet-core

Shared TypeScript core for the OuroNet ecosystem — StoaChain™ / Chainweb /
Pact interactions, Codex signing, guard analysis, encryption. Consumed by
**OuronetUI** (browser SPA) and the **AncientHolder HUB** (Node.js server).

## Status

**`2.3.0` on public npmjs** — MINOR additive release. Closes 13 audit
findings (7 MEDIUM tier + 6 LOW tier from the 2026-04-30 audit cycle)
and introduces 2 new public surfaces: (1) a typed
`UnknownPredicateError` class re-exported from the `./guard` subpath,
and (2) a NEW `./observability` subpath with `Logger` type +
`setLogger` mutator + `getLogger` accessor mirroring the existing
`setPactReader` injection-seam pattern at `src/reads/pactReader.ts`.
Other landings include the `safeCreationTime` DRY refactor (11
inline copies removed), codex shape validation in `deserializeCodex`,
foreign-key resolver pre-flight in `CodexSigningStrategy`, guard
hardening (4-state `SmartAccountAuthPathsAnalysis` JSDoc + optional
`firstSignableButUnsatisfied` field), and a catch-block consistency
sweep that routes every `console.warn` / `console.error` in `src/`
through the new logger seam. See [`CHANGELOG.md`](CHANGELOG.md) for
the full v2.3.0 entry, and the **What's new in v2.3.0** section below
for the public-API additions and copy-paste examples. v2.2.x
consumers upgrade transparently — `instanceof Error`, existing
analysis-flag access, and existing `error.message` access still work;
the new typed-class discrimination and logger-seam injection are
purely opt-in.

Every piece of blockchain logic that used to live in OuronetUI has
landed here: Pact builders, signing pipeline (CodexSigningStrategy +
universalSignTransaction), encryption (V1 + V2 + smartDecrypt), guard
analysis, gas calibration, codex codec, seed-type migration. OuronetUI
is now a pure consumer.

As of the current **v2.2.0** shipping line (originally introduced in
**v1.3.0**), OuronetCore integrates
**[`@stoachain/dalos-crypto@^1.2.0`](https://www.npmjs.com/package/@stoachain/dalos-crypto)**
via the `./dalos` subpath — consumers mint Ouronet accounts locally
(all six DALOS input modes: random, bitmap, bitstring, base-10,
base-49, seed words) without touching the retired
`go.ouronetwork.io/api/generate` endpoint.

The per-version paragraphs below are compact deltas; for the full
authoritative per-version detail (Added / Changed / Fixed sections,
finding closures, file-level citations) see
[`CHANGELOG.md`](CHANGELOG.md). The README mirrors the headline only
and points readers at the changelog for the rest.

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

**v2.0.2 / v2.0.3 / v2.0.4** — release-pipeline hardening patches. No
runtime change. v2.0.2 added `permissions: contents: write` to
`publish.yml` for the GitHub Releases step. v2.0.3 introduced a
`RELEASE_TOKEN` PAT fallback expression to bypass org-locked
`GITHUB_TOKEN` write permissions. v2.0.4 triggered the workflow with
the secret installed.

**v2.1.0** — reliability hardening release. New `getFailoverClient(chainId, options?)`
factory composes `withFailover` + per-tier timeout into one reusable
surface; all 81 legacy `createClient(getPactUrl(chainId))` invocations
across the 11 interaction files now route through it (primary node
failure on any chain call now triggers automatic fallback retry).
Bounded timeouts on every chain-call tier (read 15s, submit 60s,
listen 180s, pollOne 30s) with `Promise.race` + `AbortController`
defence-in-depth. New `runWithTimeout(operation, fn, timeoutMs)`
helper, new `createTimeoutError(...)` factory returning a
`SigningError { code: "TIMEOUT" }`, new `resetNodeFailover()` export
for test isolation, new `readTimeoutMs?: number` option on
`PactReader` and `rawCalibratedDirtyRead`. MINOR, non-breaking —
existing imports continue to work; the new surface is opt-in.

**v2.1.2** — concurrency-race correction in `withFailover`. PATCH, no
public API change. The retry guard now uses per-invocation captured
base URLs (`attemptedBaseUrl` AND `attemptedPrimaryBaseUrl` captured
at fn-entry as local consts) instead of reading the shared
module-level `currentHost === PRIMARY_HOST` at catch-time. This makes
the catch-block decision robust to concurrent module-state mutation
(sibling `withFailover` flip, mid-flight `setNodeConfig`, mid-flight
`resetNodeFailover`). Closes F-BUG-001. New module-private
`getPrimaryBaseUrl()` helper added to `src/network/nodeFailover.ts`;
not exported.

**v2.2.0** — crypto error-taxonomy + test-coverage hardening release.
MINOR, additive. The `./crypto` subpath gains three typed error
classes — `WrongPasswordError`, `CorruptEnvelopeError`,
`UnsupportedFormatError` — that discriminate decryption failure modes
(closes F-CORE-009). `smartDecrypt` switches to single-path dispatch
via the existing `isEncryptedV2` shape predicate, eliminating the
~1.5s wall-time differential a wrong-password V1 input previously
exhibited (timing-leak fix); the V1 catch path no longer logs to
`console.error` and propagates the original failure via ES2022
`Error.cause`. Existing `instanceof Error` checks and `error.message`
access continue to work — the new typed-class discrimination is
opt-in. Test coverage expands across 4 previously-untested critical
surfaces (closes F-CORE-011, F-CORE-012): four new test files cover
the `pactReader` injection seam (`tests/pact-reader.test.ts`),
`KadenaWalletBuilder` mnemonic dispatch with vendor-vector pinning for
all three seed types (`tests/wallet-builder.test.ts`), every
documented branch of `createSigningError` + `createSimulationError`
(`tests/transaction-errors.test.ts`), and the codex seed-type
migration round-trip (`tests/seed-type-migration.test.ts`). Five
existing test files gain extensions: `tests/encryption.test.ts`,
`tests/encryption-upgrade.test.ts`, `tests/codex-codec.test.ts`,
`tests/cfm-builders.test.ts`, `tests/pact-format.test.ts`. F-CORE-010
(a proposed `pactString` charset/blocklist helper) was reviewed and
explicitly **rejected** — chain-side Pact validation already enforces
identifier rules, so a client-side blocklist would duplicate
authoritative server-side checks and risk silent drift if Pact's
grammar evolves. The decision is logged in `CHANGELOG.md` under a
`### Rejected (decisions log)` section.

**v2.3.0** — medium-and-low audit closures release. MINOR, additive.
Closes 13 audit findings grouped into two milestones: **M1 — 7
MEDIUM tier** (F-CORE-013 codex shape validation; F-CORE-014
foreign-key resolver pre-flight in `CodexSigningStrategy`; F-CORE-015
`safeCreationTime` DRY refactor — 11 inline copies removed across
`src/interactions/*Functions.ts`, all routed through the canonical
declaration in `src/pact/format.ts`; F-CORE-016a tightened
`classifyGuardKind` requiring full minimal shape per kind; F-CORE-016b
new `normalizeKeysetRef` helper at the `resolveGuard` boundary;
F-CORE-016c `SmartAccountAuthPathsAnalysis` JSDoc enumerating 4
reachable states + optional `firstSignableButUnsatisfied` field;
F-CORE-017 typed `UnknownPredicateError` class re-exported from
`./guard` plus `predicateRecognized: false` bit on `analyzeGuard`'s
returned analysis, replacing the previous silent `console.warn`
diagnostic) and **M2 — 6 LOW tier** (F-CORE-018a README header
version table refresh; F-CORE-018b CONTEXT.md interactions section
refresh covering v1.4 / v1.5 / v1.6 additions; F-CORE-019 catch-block
consistency in `ouroFunctions.ts` — all 7 affected catch sites now
route via `getLogger().error(...)` from `../observability`; F-CORE-020
tier-semantics JSDoc on `pactReader.ts` and `rawCalibratedRead.ts`
enumerating the canonical T1=balance / T2=preview / T3=metadata /
T7=very-static mapping; F-CORE-021 dead try/catch wrapping
`getLPTypeInfo`'s `Promise.all` removed (Option A — the
"comment as belt-and-braces" alternative was explicitly rejected);
F-CORE-022 central logger seam at `./observability` with two-file
source layout `src/observability/{index.ts,logger.ts}`, `Logger` type
+ `setLogger` (throws `TypeError("setLogger requires a non-null
Logger")` on null/undefined input) + `getLogger` exports, and a
sweep that reroutes every `console.warn` / `console.error` in `src/`
through the seam — verified by `grep -nE "console\.(warn|error)"
src/` returning ZERO matches outside the seam itself). Two new
public surfaces ship in lockstep: `UnknownPredicateError` on
`./guard` and the `./observability` subpath. All changes additive;
no existing exports change shape.

**500 tests** pass on every commit (up from 458 v2.2.0 baseline;
+42 new tests across the v2.3.0 audit-closure surfaces — codex-codec
shape validation, foreign-key resolver pre-flight, guard
classification + keyset-ref normalization + 4-state analysis +
UnknownPredicateError, observability seam contract, catch-block
routing). Published to the public npmjs registry via
`.github/workflows/publish.yml` on every `v*` tag (which also creates
a GitHub Release).

```bash
npm install @stoachain/ouronet-core
```

## What's new in v2.1.0

The chain-RPC surface used to be 81 ad-hoc `createClient(getPactUrl(chainId))`
calls scattered across 11 interaction files, each pinned to whatever
URL `getPactUrl` returned at the moment of construction and each with
no timeout. v2.1.0 collapses that into one reusable factory:

```ts
import { getFailoverClient } from "@stoachain/ouronet-core/network";

// All four standard chain operations, each wrapped in withFailover +
// per-tier timeout. The factory's submit captures the same signed-tx
// reference across primary + fallback attempts (REQ-01 dedup contract).
const { dirtyRead, submit, listen, pollOne } = getFailoverClient(chainId);

const txDescriptor = await submit(signedTx);          // 60s default, auto-failover
const result        = await listen(txDescriptor);     // 180s default (~6 Kadena blocks), auto-failover
```

### Timeouts

Per-tier defaults: **read 15s**, **submit 60s**, **listen 180s**
(~6 Kadena blocks for inclusion long-polling), **pollOne 30s**.
Two-tier override precedence — per-call wins over factory-time wins
over locked default:

```ts
// Factory-time override
const client = getFailoverClient(chainId, { submitTimeoutMs: 30_000 });

// Per-call override
await client.submit(signedTx, { submitTimeoutMs: 5_000 });
```

A primary-side timeout rejects with `Error.name === "AbortError"`
inside `withFailover`, which classifier-matches the existing fallback
contract — so a primary timeout transparently triggers the fallback
retry. Only if **both** primary and fallback time out does the consumer
see a `SigningError { code: "TIMEOUT" }` surfaced via the factory's
outer-boundary catch.

### Lower-level helpers

For the codex signing strategy seam (where failover is intentionally
the consumer's `PactClient` responsibility), v2.1.0 also exports a
plain timeout helper:

```ts
import { runWithTimeout } from "@stoachain/ouronet-core/network";

await runWithTimeout("operation-name", (controller) =>
  fetch("https://...", { signal: controller.signal }), 15_000);
// Rejects with Error.name === "AbortError" on timeout. Caller is
// responsible for converting to SigningError { code: "TIMEOUT" }.
```

Plus `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)`
from `@stoachain/ouronet-core/errors` for that conversion, and
`resetNodeFailover()` from `@stoachain/ouronet-core/network` for test
isolation.

### Migration

**No migration required.** All existing imports continue to work
unchanged. The new surface is purely opt-in. Internal calls have
already been migrated — your existing reads and submits now get
failover and timeouts automatically.

## What's new in v2.2.0

The `./crypto` subpath previously surfaced every decryption failure as
a generic `Error` — wrong password, structurally damaged envelope, and
unsupported schema version all collapsed to a string-message check.
v2.2.0 adds three typed error classes that discriminate the failure
modes, plus a single-path `smartDecrypt` dispatch that closes a
wall-time timing differential observed on V1 wrong-password inputs:

```ts
import {
  smartDecrypt,
  WrongPasswordError,
  CorruptEnvelopeError,
} from "@stoachain/ouronet-core/crypto";

try {
  const plaintext = await smartDecrypt(blob, password);
} catch (err) {
  if (err instanceof WrongPasswordError) {
    // most common case — show "wrong password" UI
  } else if (err instanceof CorruptEnvelopeError) {
    // blob is structurally damaged — recovery / re-import path
  } else {
    // unexpected (UnsupportedFormatError, or anything else) — log and
    // surface to user as a generic decrypt failure
    throw err;
  }
}
```

Existing consumers that only check `instanceof Error` or read
`error.message` continue to work unchanged — the typed classes extend
`Error`, so the new discrimination is purely opt-in.

## What's new in v2.3.0

The v2.3.0 audit-closure release introduces a central logger seam at
`@stoachain/ouronet-core/observability` mirroring the existing
`setPactReader` injection-seam pattern. Every diagnostic
`console.warn` / `console.error` call inside `src/` now routes through
this seam, so consumers can capture, redirect, or suppress library
log events without monkey-patching the global `console`:

```ts
import { setLogger, getLogger, type Logger } from "@stoachain/ouronet-core/observability";

// Option 1: Forward to your existing app logger (Pino, Winston, Sentry, …).
const myLogger: Logger = {
  warn: (msg, ...args) => myApp.warn(msg, args),
  error: (msg, ...args) => myApp.error(msg, args),
};
setLogger(myLogger);

// Option 2: Capture for telemetry without losing console output.
const original = getLogger();
setLogger({
  warn: (msg, ...args) => { telemetry.warn(msg, args); original.warn(msg, ...args); },
  error: (msg, ...args) => { telemetry.error(msg, args); original.error(msg, ...args); },
});

// Or do nothing — the default routes to console.warn / console.error so
// existing v2.2.x behavior is preserved exactly.
```

The mutator rejects null/undefined input with a clear `TypeError`:

```ts
setLogger(null);
// throws TypeError: setLogger requires a non-null Logger
```

The companion addition is a typed `UnknownPredicateError` class
re-exported from the `./guard` subpath. `computeThreshold` throws it
when it encounters an unrecognized predicate; the general-purpose
`analyzeGuard` catches it and folds it into a structured
`predicateRecognized: false` bit on the returned analysis. Consumers
that want to discriminate this failure mode can branch on the typed
class:

```ts
import { computeThreshold, UnknownPredicateError } from "@stoachain/ouronet-core/guard";

try {
  const threshold = computeThreshold(guard);
} catch (err) {
  if (err instanceof UnknownPredicateError) {
    // Surface a recognizable "unknown predicate" diagnostic to the user.
  } else {
    throw err;
  }
}
```

Existing `instanceof Error` checks and existing analysis-flag access
continue to work unchanged — the typed-class discrimination from
`./guard` and the logger-seam injection from `./observability` are
both purely opt-in.

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
| `@stoachain/ouronet-core/network` | Node failover (node2 → node1), URL construction; **(v2.1.0+)** `getFailoverClient(chainId, options?)` factory returning `{ dirtyRead, submit, listen, pollOne }` with `withFailover` + per-tier timeout baked in, `runWithTimeout(operation, fn, timeoutMs)` helper, `FailoverClientOptions` type, `resetNodeFailover()` for test isolation |
| `@stoachain/ouronet-core/gas` | `calculateAutoGasLimit`, ANU/STOA math |
| `@stoachain/ouronet-core/guard` | `analyzeGuard`, `buildCodexPubSet`, `selectCapsSigningKey`, `computeThreshold` (all predicates including `stoa-ns.stoic-predicates.*`); **(v1.6.0+)** `classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths` for the Smart Ouronet Account three-branch auth-path resolution (`enforce-one` over account-guard / sovereign-guard / governor) |
| `@stoachain/ouronet-core/crypto` | V1 + V2 AES-GCM-256 encryption, `smartDecrypt`, pure `smartEncrypt(pt, pw, schemaVersion)`; **(v2.2.0+)** typed error classes `WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError` discriminate decryption failure modes; `smartDecrypt` single-path dispatch eliminates v1-then-v2 timing-leak |
| `@stoachain/ouronet-core/signing` | `KeyResolver` / `SigningStrategy` interfaces, `CodexSigningStrategy`, `universalSignTransaction`, signing primitives (`publicKeyFromPrivateKey`, etc.) |
| `@stoachain/ouronet-core/codex` | `PlaintextCodex` generic type, `serializeCodex` / `deserializeCodex` (backup format `"1.2"`), `migrateSeedType` |
| `@stoachain/ouronet-core/reads` | `rawCalibratedDirtyRead` (pure Pact read with node failover + 15s timeout; no cache); **(v2.1.0+)** accepts a `readTimeoutMs?: number` option for per-call timeout override; **(v2.3.0+)** JSDoc enumerates the canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static) and documents that the default reader accepts and ignores the `tier` argument — see `setPactReader` for cache-aware consumers |
| `@stoachain/ouronet-core/observability` | **(v2.3.0+)** central logger seam mirroring `setPactReader`. Exports `Logger` type (`{ warn(msg, ...args), error(msg, ...args) }`), `setLogger(logger)` mutator (throws `TypeError("setLogger requires a non-null Logger")` on null/undefined), `getLogger()` accessor. Default routes `warn` to `console.warn` and `error` to `console.error` — consumers who do nothing observe identical behavior to direct `console.*` calls. |
| `@stoachain/ouronet-core/guard` | **(v2.3.0+)** `UnknownPredicateError` typed class — thrown by `computeThreshold` on unrecognized predicates; `analyzeGuard` catches it and folds it into a `predicateRecognized: false` bit on the returned analysis. Also adds optional `firstSignableButUnsatisfied: number` field on `SmartAccountAuthPathsAnalysis`. |
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
npm test             # vitest run — 500 tests across crypto, guard, gas, pact format, signing, strategy, codex, cfmBuilders, dalos integration, wallet, interactions-read-seam, network, failover-client, timeouts, failover-submit, pact-reader, wallet-builder, transaction-errors, seed-type-migration, crypto-errors, crypto-v2-classification, package-version, observability-logger, phase5-catch-routing
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
