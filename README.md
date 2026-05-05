# @stoachain/ouronet-core

Shared TypeScript core for the OuroNet ecosystem — StoaChain™ / Chainweb /
Pact interactions, Codex signing, guard analysis, encryption. Consumed by
**OuronetUI** (browser SPA) and the **AncientHolder HUB** (Node.js server).

## Status

**`3.1.0` on public npmjs** — **MINOR, additive** release that
upgrades `@stoachain/dalos-crypto` from `^1.2.0` to `^4.0.3` (covering
the v2.x/v3.x/v4.x line of the upstream package — Schnorr v2 wire
format, cofactor subgroup-membership hardening, generator-precompute
matrix cache, async signing surfaces, the v4.0.0 Elliptic-package
carve-out on the Go side, and the v4.0.3 LOW-band closures), exposes
the previously-internal **Schnorr signature surface** through the
`./dalos` subpath (`schnorrSign` / `schnorrVerify` and the browser-
friendly `schnorrSignAsync` / `schnorrVerifyAsync` async variants
that yield to the event loop on a fixed cadence; plus the typed
`SchnorrSignError` exception and the `SchnorrSignature` shape type),
and ships a small locale-determinism fix in `formatMaxFee` so the
ANU thousands separator is `,` on every host (was host-locale-
dependent — silently passed CI on en-US Linux while failing locally
on a German-locale host). **558/558 tests pass.** No public surface
from prior versions changes shape; all additions are opt-in. Per
the upstream v4.0.0 changelog: TypeScript consumers see no breaking
surface changes across the dalos-crypto v1.2.0 → v4.0.3 jump (the
v4.0.0 major bump was driven entirely by a Go-reference
reorganisation that doesn't affect TS consumers). See
[`CHANGELOG.md`](CHANGELOG.md) for the full v3.1.0 entry.

**`3.0.0`** — **BREAKING** major release closing M3 from the
2026-04-30 audit cycle (F-CORE-007 fabricated-fallback removal +
comprehensive HIGH-risk catalog sweep). This was the FIRST major
bump since **v2.0.0** (2026-05-01) — downstream consumers
(OuronetUI, AncientHolder HUB) MUST update call sites to handle
`null` returns. **16 fabricated-fallback widenings** land across 4
interaction files: 15 functions widen from `Promise<T>` to
`Promise<T | null>` so that consumers see RPC failures instead of
fabricated chain values (`1.0` USD prices, `"0"` balances, sentinel
`"N/A"` strings, fake `false` existence flags), plus 1 mixed-shape
addition for `validateLiquidity` (preserves `valid: boolean` while
adding optional `error?: string` to distinguish RPC failure from
validation rejection). In lockstep, **14 NON-BREAKING logger-routing
additions** across 5 files complete the silent-catch-elimination
sweep started in v2.3.0 — every previously-silent diagnostic catch
in `src/interactions/*` now routes through the
`@stoachain/ouronet-core/observability` `getLogger().error()` seam.
NO public-API removals (NFR-03): all 16 modified functions retain
their names and parameter signatures; only return types widen. See
[`CHANGELOG.md`](CHANGELOG.md) for the full v3.0.0 entry, and the
**Migrating to v3.x** H2 section below for per-cluster `Before:` /
`After:` migration patterns (Option B null-pattern locked decision
per Q3..Q11 of the requirements). The optional **What's new in
v3.0.0** section ships a copy-paste example for adapting to nullable
returns.

Every piece of blockchain logic that used to live in OuronetUI has
landed here: Pact builders, signing pipeline (CodexSigningStrategy +
universalSignTransaction), encryption (V1 + V2 + smartDecrypt), guard
analysis, gas calibration, codex codec, seed-type migration. OuronetUI
is now a pure consumer.

As of the current **v3.1.0** shipping line (originally introduced in
**v1.3.0**, dep range bumped to `^4.0.3` in v3.1.0), OuronetCore
integrates
**[`@stoachain/dalos-crypto@^4.0.3`](https://www.npmjs.com/package/@stoachain/dalos-crypto)**
via the `./dalos` subpath — consumers mint Ouronet accounts locally
(all six DALOS input modes: random, bitmap, bitstring, base-10,
base-49, seed words) without touching the retired
`go.ouronetwork.io/api/generate` endpoint. As of v3.1.0 the `./dalos`
subpath also re-exports the lower-level **Schnorr signature surface**
(`schnorrSign`, `schnorrVerify`, plus browser-friendly
`schnorrSignAsync` / `schnorrVerifyAsync` variants, the typed
`SchnorrSignError` exception, and the `SchnorrSignature` shape type)
for advanced consumers who need direct access without going through
`primitive.sign(...)`.

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

**v3.0.0** — fabricated-fallbacks-removal release. **BREAKING.**
Closes M3 from the 2026-04-30 audit cycle (lead finding F-CORE-007
HIGH plus the comprehensive ~24-site catalog sweep). First major
bump since v2.0.0. **Phase 1 — critical pricing functions (4
BREAKING widenings):** `getStoaPriceUSD`, `getTokenDecimals`,
`getPoolTotalFee`, `getDPTFMinMove` all widen from `Promise<number>`
to `Promise<number | null>`; the previous `1.0` / `0` / `8`
fabrication sentinels are replaced with `null`, and
`Number.isFinite()` guards catch `NaN` from malformed chain data
(e.g. `parseInt("abc", 10)` or `parseFloat(String(undefined))`).
**Phase 2 — catalog sweep + bonus extras + magic-strings (12
BREAKING widenings):** the 4-function string-balance cluster
(`getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`,
`getVirtualOuro`) widens uniformly to `Promise<string | null>`;
`LPTypeInfo` field types widen to `boolean | null` per inner flag
(Approach A — function return type unchanged; chain-failure-status
returns `false`, catch returns `null`, success returns `true`); the
urStoa trio (`getUrStoaBalance`, `getUrStoaGuard`,
`checkCoinAccountExists`) widens to nullable returns and
`getUrStoaGuard` drops its sentinel `empty` shape; `validateLiquidity`
gains an optional `error?: string` field on its mixed shape (preserves
`valid: boolean` — consumers route a populated `error` to the
network-failure banner and a `valid: false` with no `error` to the
validation-failure message); `getMaxBuyMovieBooster` widens to
`Promise<number | null>`; magic-string sentinels disappear from
`getSWPSpawnLimit` and `getSWPInactiveLimit` (now `Promise<string |
null>` — consumers swap `=== "N/A"` for `=== null`). **Phase 3 —
logger parity (14 NON-BREAKING):** `getLogger().error("Error in
<funcName>:", error)` routing lands in 14 previously-silent catches
across 5 files (`dexFunctions.ts`, `ouroFunctions.ts`,
`activateFunctions.ts`, `infoOneFunctions.ts`, and the
`urStoaFunctions.ts` private helpers `verifyEd25519Sig` +
`describeKeyset`) — completes the silent-catch elimination sweep
started in v2.3.0. NO public-API removals (NFR-03): all 16 modified
functions keep their names + parameter signatures; only return types
widen. See the new **Migrating to v3.x** H2 section below for
per-cluster `Before:` / `After:` migration patterns and the locked
Option B / Approach A / mixed-shape / 3-state-preservation /
magic-string-removal decisions (Q3..Q11) embedded verbatim.

**v3.1.0** — dalos-crypto v4.0.3 integration + Schnorr surface
re-exports + locale-determinism fix. **MINOR, additive.** Bumps the
`@stoachain/dalos-crypto` dep from `^1.2.0` to `^4.0.3` (per the
upstream v4.0.0 changelog: TypeScript consumers see no breaking
surface changes across the v1.2.0 → v4.0.3 jump — the v4.0.0 major
bump was driven entirely by a Go-reference reorganisation, not the
TS port). The `./dalos` subpath gains direct re-exports of the
**Schnorr signature surface** for advanced consumers:
`schnorrSign` / `schnorrVerify` for synchronous use; the
browser-friendly `schnorrSignAsync` / `schnorrVerifyAsync` async
variants that yield to the event loop on a fixed data-independent
cadence (the upstream package's REQ-14 yield-count constant-time
test verifies the cadence is data-independent and constant-time);
the typed `SchnorrSignError` exception class for `instanceof` catch
blocks; and the `SchnorrSignature` shape type for parameter typing.
The high-level `primitive.sign(keyPair, message)` path through the
registry is unchanged (it has always been Schnorr internally for
DalosGenesis); the new direct-access surface is opt-in and exists
mainly so OuronetUI's browser path can use the `*Async` variants to
keep INP under the 200 ms budget during signing. Also fixes
`formatMaxFee` in `./gas` to pin its `toLocaleString()` call to
`'en-US'` so the ANU thousands separator is `,` on every host (was
host-locale-dependent — silently passed CI on en-US Linux while
failing locally on a German-locale host); the test suite was already
pinning the en-US shape, so this restores cross-host parity. NO
public-API removals or shape changes; all changes additive. See the
v3.1.0 **CHANGELOG.md** entry for the full per-symbol export list,
the audit-trail of the 18 dalos-crypto symbols verified
shape-compatible at upgrade time, and the verification-gate results
(typecheck + 558/558 tests + build all green).

**558 tests** pass on every commit (unchanged from v3.0.0 — the
v3.1.0 changes are additive re-exports and a 1-line locale fix; no
new test files). Published to the public npmjs registry via
`.github/workflows/publish.yml` on every `v*` tag (which also
creates a GitHub Release).

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

## What's new in v3.0.0

The v3.0.0 fabricated-fallbacks-removal release closes M3 from the
2026-04-30 audit cycle (lead finding F-CORE-007 HIGH plus the
~24-site catalog sweep). The headline change is uniform: every
`src/interactions/*` read helper that previously fabricated a chain
value on RPC failure (`1.0` USD prices, `"0"` balances, sentinel
`"N/A"` strings, fake `false` existence flags) now returns `null`
on failure so consumers can distinguish "RPC failed" from "chain
returned this real value." Sixteen functions widen their return
types in lockstep; consumers add `if (result === null) { ... }`
branches at call sites:

```ts
import { getStoaPriceUSD } from "@stoachain/ouronet-core/interactions/ouroFunctions";

// v3.0.0 — null on RPC failure / chain failure / non-finite parse,
// real number on success.
const price = await getStoaPriceUSD();

if (price === null) {
  // RPC failed or chain returned malformed data — show an error
  // banner instead of computing positions against a fabricated 1.0.
  showRPCErrorBanner("Could not fetch STOA/USD price");
  return;
}

// price is a real Number.isFinite(...) value — safe to use.
renderPriceLabel(`$${price.toFixed(4)}`);
```

`getLPTypeInfo` keeps its function-level return type but widens its
inner field types so consumers can render mixed UI per flag (Frozen
LP succeeded, Sleeping LP RPC-failed):

```ts
import { getLPTypeInfo } from "@stoachain/ouronet-core/interactions/addLiquidityFunctions";

const info = await getLPTypeInfo(swpair); // { hasFrozenLP, hasSleepingLP }

// Three states per flag now: true (chain confirmed exists),
// false (chain confirmed absent OR chain failure-status), null (catch).
if (info.hasFrozenLP === null) {
  renderFrozenSection({ status: "rpc-error" });
} else {
  renderFrozenSection({ status: info.hasFrozenLP ? "present" : "absent" });
}

if (info.hasSleepingLP === null) {
  renderSleepingSection({ status: "rpc-error" });
} else {
  renderSleepingSection({ status: info.hasSleepingLP ? "present" : "absent" });
}
```

In lockstep, **14 NON-BREAKING logger-routing additions** across 5
files complete the silent-catch-elimination sweep started in v2.3.0
— previously-silent diagnostic catches in `dexFunctions.ts`,
`ouroFunctions.ts`, `activateFunctions.ts`, `infoOneFunctions.ts`,
and `urStoaFunctions.ts` private helpers now route via
`getLogger().error("Error in <funcName>:", error)`. Consumers who
called `setLogger(...)` (introduced in v2.3.0) automatically capture
these new error events with no additional wiring.

## Migrating to v3.x

v3.0.0 is the first major bump since v2.0.0 and the deliberate
forcing function for **Option B null-pattern** (locked Q3..Q11):
sixteen `src/interactions/*` read helpers that previously fabricated
chain values on RPC failure now widen their return types so consumers
see RPC failures instead of silently fabricated sentinels (`1.0` USD
prices, `"0"` balances, sentinel `"N/A"` strings, fake `false`
existence flags). Fifteen functions widen from `Promise<T>` to
`Promise<T | null>`; one (`validateLiquidity`) adds an optional
`error?: string` field on its mixed shape to distinguish "RPC failed"
from "validation rejected" without dropping the existing `valid:
boolean` contract.

Every breaking change below stems from the **Option B null-pattern**
locked decision per the 2026-04-30 audit cycle: callers add `if
(result === null) { showRPCErrorBanner(); return; }` branches before
reading the previously-fabricated value. The 14 NON-BREAKING
logger-routing additions across 5 files (Phase 3) require **NO
consumer migration** — they are pure observability and existing call
sites continue to work unchanged.

### 1. Pricing-quartet — `Promise<number>` → `Promise<number | null>`

`getStoaPriceUSD`, `getTokenDecimals`, `getPoolTotalFee`, and
`getDPTFMinMove` (REQ-01..REQ-04) all widen to `Promise<number |
null>`. The previous `1.0` / `0` / `8` fabrication sentinels are
replaced with `null`, and `Number.isFinite()` guards catch `NaN`
from malformed chain data (e.g. `parseInt("abc", 10)` or
`parseFloat(String(undefined))`). All three failure paths — outer
catch (network failure), `status !== "success"` branch (chain
failure), and success-but-not-finite branch — now return `null`.

These are transaction-relevant amounts: silently fabricating `1.0`
for a missing USD price would have produced wildly wrong position
values; silently returning `8` for missing token decimals would have
produced off-by-many-orders-of-magnitude amounts. The **Option B
null-pattern** locked decision makes this failure mode explicit at
the call site.

```ts
// Before (v2.x):
const price = await getStoaPriceUSD();          // number — could be fabricated 1.0
const decimals = await getTokenDecimals(token); // number — could be fabricated 8
renderPosition(price * amount, decimals);

// After (v3.x):
const price = await getStoaPriceUSD();
const decimals = await getTokenDecimals(token);
if (price === null || decimals === null) {
  showRPCErrorBanner("Could not fetch pricing data");
  return;
}
renderPosition(price * amount, decimals);
```

### 2. String-balance cluster — `Promise<string>` → `Promise<string | null>`

`getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`,
and `getVirtualOuro` (REQ-05) all widen to `Promise<string | null>`
as a tightly-coupled cluster — both `return "0"` sentinels in each
function become `return null`. Per the locked decision, "changing
only some risks a UI where some buttons silently misbehave on RPC
failure while others now correctly disable" — these four functions
move together so consumer-side balance-display UI can branch
uniformly on `null`.

Existing v2.3.0 logger routing is preserved; only the type and
sentinel change. Catch paths still route via `getLogger().error()`.

```ts
// Before (v2.x):
const balance = await getIgnisBalance(account); // string — could be fabricated "0"
showBalance(formatToken(balance));

// After (v3.x):
const balance = await getIgnisBalance(account);
if (balance === null) {
  showBalanceUnknown(); // Distinguish RPC failure from a real "0" balance
  return;
}
showBalance(formatToken(balance));
```

### 3. `getLPTypeInfo` field widening (Approach A — function return type unchanged)

`getLPTypeInfo` (REQ-06) widens its inner field types from `{
hasFrozenLP: boolean; hasSleepingLP: boolean }` to `{ hasFrozenLP:
boolean | null; hasSleepingLP: boolean | null }`. Per the locked
**Approach A** decision, the **function-level return type is
UNCHANGED** — only the inner field types widen. Consumers can render
granular per-flag mixed UI (e.g. Frozen LP succeeded but Sleeping LP
RPC-failed). Approach B (function-level null) was rejected because
it loses granularity; Approach C (separate error channel) was
rejected because it is non-breaking and defeats the audit purpose.

Per the Phase 2 P-001 fix, **3-state preservation** is the locked
contract for each flag: chain-failure-status (`response.result.status
!== "success"`) returns `false`, the inner IIFE catch returns `null`,
and a successful chain read returns `true`. Both inner catches route
via `getLogger().error("Error checking Frozen LP:", error)` and
`("Error checking Sleeping LP:", error)`.

```ts
// Before (v2.x):
const info = await getLPTypeInfo(swpair);
// { hasFrozenLP: boolean; hasSleepingLP: boolean }
if (info.hasFrozenLP) renderFrozen();
if (info.hasSleepingLP) renderSleeping();

// After (v3.x):
const info = await getLPTypeInfo(swpair);
// { hasFrozenLP: boolean | null; hasSleepingLP: boolean | null }
if (info.hasFrozenLP === null) renderFrozenRpcError();
else if (info.hasFrozenLP) renderFrozen();
else renderFrozenAbsent();

if (info.hasSleepingLP === null) renderSleepingRpcError();
else if (info.hasSleepingLP) renderSleeping();
else renderSleepingAbsent();
```

### 4. urStoa trio — `Promise<T>` → `Promise<T | null>`

`getUrStoaBalance`, `getUrStoaGuard`, and `checkCoinAccountExists`
(urStoa) (REQ-07) all widen to nullable returns as a tightly-coupled
trio. `getUrStoaBalance` widens `Promise<number>` → `Promise<number
| null>` (both `return 0` sites become `return null`).
`getUrStoaGuard` widens `Promise<UrStoaGuardResult>` →
`Promise<UrStoaGuardResult | null>` and **drops the sentinel** `empty
= { exists: false, isKeyset: false, keys: [], pred: "" }` value;
`null` now means RPC failed, while a real `UrStoaGuardResult` means
the chain answered. **3-state preservation** in `getUrStoaGuard` is
the locked contract: `null` (RPC failed), `{ exists: false, ... }`
(chain confirmed no guard), `{ exists: true, ... }` (chain returned a
real guard). `checkCoinAccountExists` widens `Promise<boolean>` →
`Promise<boolean | null>` and gains `getLogger().error("Error in
checkCoinAccountExists (urStoa):", error)` routing (was silent); JSDoc
gains a cross-reference to the `ouroFunctions.ts:2088` sibling that
already has the same nullable-boolean shape.

```ts
// Before (v2.x):
const guard = await getUrStoaGuard(account);
// guard is always present; "empty" sentinel masks RPC failure
if (!guard.exists) renderCreateGuardForm();
else renderEditGuardForm(guard);

// After (v3.x):
const guard = await getUrStoaGuard(account);
if (guard === null) showRPCError();           // RPC failed
else if (!guard.exists) renderCreateGuardForm(); // chain confirmed no guard
else renderEditGuardForm(guard);              // chain returned a real guard
```

### 5. `validateLiquidity` mixed-shape addition

`validateLiquidity` (REQ-08) **preserves** its existing `valid:
boolean` field but adds an optional `error?: string` field on RPC
failure. This is the **mixed-shape** locked decision: distinguishing
"validation rejected" from "RPC failed" without collapsing both into
`valid: false`. Consumers route a populated `error` to the
network-failure banner and a `valid: false` with no `error` to the
validation-failure message.

The catch path now routes via `getLogger().error("Error in
validateLiquidity:", error)` (preserved from v2.3.0) and sets the
`error` field on the returned object.

```ts
// Before (v2.x):
const result = await validateLiquidity(...);  // { valid: boolean; ... }
if (!result.valid) showValidationFail("Liquidity rejected");

// After (v3.x):
const result = await validateLiquidity(...);  // { valid: boolean; error?: string; ... }
if (result.error) {
  showRPCErrorBanner(result.error);          // RPC failure
} else if (!result.valid) {
  showValidationFail("Liquidity rejected");  // real validation rejection
}
```

### 6. `getMaxBuyMovieBooster` — `Promise<number>` → `Promise<number | null>`

`getMaxBuyMovieBooster` (REQ-08) widens to `Promise<number | null>`,
matching the Phase 1 `getPoolTotalFee` pattern exactly. Both `return
0` sites become `return null`; the success-path falsy-collapse (`||
0`) becomes a `Number.isFinite()` guard. A `0` max-buy is a plausible
chain return (e.g. when a booster is sold out) — collapsing the
fabricated-failure case onto the same `0` made the two states
indistinguishable. Existing v2.3.0 logger routing is preserved.

```ts
// Before (v2.x):
const max = await getMaxBuyMovieBooster(); // number — 0 could mean sold-out OR RPC fail
if (max === 0) showSoldOut();              // ambiguous

// After (v3.x):
const max = await getMaxBuyMovieBooster();
if (max === null) showRPCErrorBanner();    // RPC failed
else if (max === 0) showSoldOut();         // chain confirmed sold-out
else showAvailable(max);                   // chain returned real positive max
```

### 7. Magic-string elimination — `getSWPSpawnLimit` + `getSWPInactiveLimit`

`getSWPSpawnLimit` and `getSWPInactiveLimit` (REQ-09) widen from
`Promise<string>` (sentinel `"N/A"`) to `Promise<string | null>` per
the **magic-string elimination** locked decision. Both `return
"N/A"` sites in each function become `return null`; consumers swap
`=== "N/A"` checks for `=== null` checks. Both functions also gain
`getLogger().error("Error in <funcName>:", error)` routing in their
catch paths (was silent).

```ts
// Before (v2.x):
const spawnLimit = await getSWPSpawnLimit(swpair);
if (spawnLimit === "N/A") showRPCError();
else renderLimit(spawnLimit);

// After (v3.x):
const spawnLimit = await getSWPSpawnLimit(swpair);
if (spawnLimit === null) showRPCError();
else renderLimit(spawnLimit);
```

### Phase 3 logger-routing additions — no consumer migration required

The 14 NON-BREAKING logger-routing additions across 5 files
(`dexFunctions.ts`, `ouroFunctions.ts`, `activateFunctions.ts`,
`infoOneFunctions.ts`, and the `urStoaFunctions.ts` private helpers
`verifyEd25519Sig` + `describeKeyset`) are pure observability —
return types and parameter signatures are unchanged. Consumers who
called `setLogger(...)` (introduced in v2.3.0) automatically capture
the new error events with no additional wiring; consumers who did
not configure a logger continue to see the default `console.error`
output that the seam falls back to. No migration is required for
this set of changes.

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
| `@stoachain/ouronet-core/interactions` | Read helpers (`getXxxInfo`, `getXxxBalance`, `getHibernatedNonces…`) + non-CFM execute helpers (`executeWrapStoa`, `executeWrapUrStoa`, `executeNativeUrStoaTransfer`); **(v2.0.0+)** `simulateTransaction(pactCode, chainId)` (signature change — see Migrating to v2.x); **(v3.0.0+)** 16 fabricated-fallback fabrications widened to `Promise<T \| null>` (BREAKING — see Migrating to v3.x); 14 logger-routing additions across 5 files complete the silent-catch elimination (NON-BREAKING) |
| `@stoachain/ouronet-core/dalos` | **(v1.3.0+)** thin re-export of `@stoachain/dalos-crypto/registry` + `createOuronetAccount(registry, options)` convenience helper covering all 6 DALOS input modes. One-stop shop for browser-side key-gen; no need to install `dalos-crypto` as a separate dep. **(v3.1.0+)** dep range bumped to `@stoachain/dalos-crypto@^4.0.3`; re-exports the lower-level Schnorr signature surface (`schnorrSign`, `schnorrVerify`, `schnorrSignAsync`, `schnorrVerifyAsync`, `SchnorrSignError`, `SchnorrSignature`) for advanced consumers — the `*Async` variants yield to the event loop on a fixed data-independent cadence so browser signing keeps INP < 200ms. |

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
npm test             # vitest run — 558 tests across crypto, guard, gas, pact format, signing, strategy, codex, cfmBuilders, dalos integration, wallet, interactions-read-seam, network, failover-client, timeouts, failover-submit, pact-reader, wallet-builder, transaction-errors, seed-type-migration, crypto-errors, crypto-v2-classification, package-version, observability-logger, phase5-catch-routing, interactions-pricing, interactions-balance-cluster, interactions-logger-parity
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
