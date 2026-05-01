# Changelog

All notable changes to `@stoachain/ouronet-core`.

## 2.1.2 — 2026-05-01

**Concurrency-race correction in `withFailover`. No public API change.**

Closes audit finding **F-BUG-001** documented in `.bee/audit-specs/high-withfailover-concurrency-race.md` (will move to `.bee/audit-specs-done/2026-05-01-high-withfailover-concurrency-race.md` post-archive per the project's audit-specs lifecycle). The bug surfaced during the v2.1.0 reliability-failover spec's final implementation review by the audit-bug-detector agent: under concurrent chain calls during a primary-node failover event, sibling `withFailover` invocations could surface spurious TIMEOUT errors even though the fallback host was healthy. v2.1.0's `getFailoverClient` adoption widened the blast radius — every chain call now routes through `withFailover`, making concurrent flows the norm. v2.1.2 is a behavior correction toward the documented "retry once on the fallback if the primary attempt errors with a network-class failure" contract; it is patch-version-eligible per strict semver.

### Fixed

- **F-BUG-001 — `withFailover` retry guard now uses per-invocation captured base URLs.** The catch-block guard at `src/network/nodeFailover.ts:120` previously read the shared module-level `currentHost === PRIMARY_HOST`, which a sibling concurrent call could have already flipped, causing the second invocation's catch to incorrectly skip the fallback retry. The rewrite captures BOTH `attemptedBaseUrl` (current active host at fn-entry) AND `attemptedPrimaryBaseUrl` (current primary host at fn-entry) into local `const`s before invoking the wrapped function, then compares the two captured locals at catch-time. This makes the decision robust to ANY concurrent module-state mutation (sibling `withFailover` flip, mid-flight `setNodeConfig`, mid-flight `resetNodeFailover`). The retry path now calls `switchToFallback()` unconditionally — its pre-existing line-50 idempotency (`if (currentHost === FALLBACK_HOST) return;`) handles the concurrent-flip case correctly without an additional guard. The retry call uses `await fn(getActiveBaseUrl())` (with `await`) for symmetry with the initial call. New module-private helper `getPrimaryBaseUrl()` added to `src/network/nodeFailover.ts:82-85`; not exported (semver-clean).

### Stats

- Files changed: 5 (`src/network/nodeFailover.ts`, `tests/network.test.ts`, `package.json`, `CHANGELOG.md`, `README.md`).
- Lines added: ~30; lines removed: ~6.
- Test count: **386** passing (up from `385` at v2.1.1; +1 from the new concurrent-failover regression test in `tests/network.test.ts`).
- New regression test: `describe("withFailover — concurrent retry race", ...)` added to `tests/network.test.ts` (one new it-block exercising `Promise.all([withFailover(fn1), withFailover(fn2)])` during a primary-down event; pins the request-key dedup-equivalent semantic for concurrent failover).
- No new public exports. The new `getPrimaryBaseUrl()` helper is module-private.

## 2.1.1 — 2026-05-01

**README documentation patch. No runtime change.**

The v2.1.0 release published the runtime fixes (4 closed audit findings,
new `getFailoverClient` / `runWithTimeout` / `resetNodeFailover` /
`createTimeoutError` / `readTimeoutMs` surface, 385 tests) but the
README's `## Status` block was still pinned to `2.0.1` and the version
history hadn't been updated past v2.0.1. Without this patch, the npm
package page (https://www.npmjs.com/package/@stoachain/ouronet-core)
showed stale documentation that didn't describe the v2.1.0 reliability
hardening work — making the new public surface invisible to consumers
who land on the npm listing first.

### Fixed

- **README `## Status` block** updated to lead with `2.1.0`, summarise
  the reliability hardening release, and mention the 4 closed audit
  findings (F-CORE-002 / F-CORE-003 / F-CORE-004 / F-CORE-008).
- **Version history extended** with entries for v2.0.2, v2.0.3, v2.0.4
  (release-pipeline hardening patches that previously had no README
  mention) and v2.1.0 (full reliability hardening summary).
- **Test count updated** from `346` to `385` in two places (the
  `## Status` paragraph and the `npm test` block under
  `## Local development`).
- **Submodule table** rows for `./network` and `./reads` updated to
  cite the v2.1.0+ additions (`getFailoverClient`, `runWithTimeout`,
  `FailoverClientOptions`, `resetNodeFailover`, `readTimeoutMs?`).
- **New section: "What's new in v2.1.0"** added between the
  `npm install` snippet and the `## Migrating to v2.x` block, with
  copy-paste examples covering the factory, the timeout precedence
  contract, the lower-level `runWithTimeout` helper, and a
  no-migration-required note for v2.0.x consumers.

### Stats

- Files changed: 3 (`README.md`, `package.json`, `CHANGELOG.md`).
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 385.

## 2.1.0 — 2026-05-01

**Reliability hardening release. MINOR, non-breaking.**

Closes four HIGH-severity audit findings (F-CORE-002, F-CORE-003, F-CORE-004,
F-CORE-008) by wiring automatic node failover, bounded timeouts with
`TIMEOUT` classification, and Node event-loop hygiene through every chain
RPC surface in the library. All public-API additions are additive — no
existing exports change shape, no breaking changes for downstream consumers
(`OuronetUI` and `AncientHolder HUB`).

### Fixed

- **F-CORE-002 — Automatic failover wired into every submit and read.** New
  `getFailoverClient(chainId, options?)` factory in `src/network/failoverClient.ts`
  returns `{ dirtyRead, submit, listen, pollOne }` methods that compose
  `withFailover` + per-tier timeout into one reusable surface. All 81
  legacy `createClient(getPactUrl(chainId))` invocations across the 11
  interaction files (activate, addLiquidity, coil, crossChain, dex, guard,
  kpay, ouro, pension, urStoa, wrap) now route through the factory. Primary
  node failure on any chain call now triggers automatic fallback retry.
- **F-CORE-003 — Default reader URL is now per-call, not module-init.**
  `rawCalibratedDirtyRead`'s default Pact URL now resolves from
  `getActivePactUrl(chainId)` per invocation instead of capturing the
  static `PACT_URL` constant at module load. This propagates failover
  coverage to all 16 already-`pactRead`-routed read sites without touching
  any of them. The static `PACT_URL` constant is preserved (semver) but
  marked `@deprecated` with a pointer to `getActivePactUrl(chainId)`.
- **F-CORE-008 — Bounded timeouts on all four chain-call tiers.** New
  `runWithTimeout(operation, fn, timeoutMs)` helper applies
  `Promise.race` + `AbortController` + `try/finally clearTimeout`
  defence-in-depth. Per-tier defaults: read 15 s, submit 60 s,
  listen 180 s (~6 Kadena blocks), pollOne 30 s. Two-tier override
  precedence: per-call > factory-time > locked default. Timeouts are
  classified as `SigningError { code: "TIMEOUT" }` via the new
  `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)`
  factory. The `codexStrategy.ts` simulate-and-submit pair gets
  timeout-only enforcement (failover stays the consumer's `PactClient`
  responsibility — adding a base-URL accessor would be a breaking change).
- **F-CORE-004 — State isolation and Node event-loop hygiene.**
  `resetNodeFailover()` exported for test isolation (returns all five
  module-level state slots to initial values). `retryTimer.unref?.()`
  attached inside `startRetryLoop()` so Node consumers no longer pin the
  event loop on the failover health-check timer. Browser consumers
  (numeric setInterval handle) unaffected via the optional-call form.

### Added (public surface)

- `getFailoverClient(chainId, options?)` — `@stoachain/ouronet-core/network`
- `runWithTimeout(operation, fn, timeoutMs)` — `@stoachain/ouronet-core/network`
- `FailoverClientOptions` type — `@stoachain/ouronet-core/network`
- `resetNodeFailover()` — `@stoachain/ouronet-core/network`
- `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)` —
  `@stoachain/ouronet-core/errors`
- `readTimeoutMs?: number` field — added to the `PactReader` options bag and to
  `rawCalibratedDirtyRead`'s options (default 15000 ms when omitted)

### Stats

- Files changed: ~16 (1 new module `src/network/failoverClient.ts`,
  11 interaction files, 4 supporting files: `nodeFailover.ts`,
  `transactionErrors.ts`, `pactReader.ts`, `rawCalibratedRead.ts`,
  `kadena.ts`, `codexStrategy.ts`).
- New tests: 4 files. `tests/failover-client.test.ts` (18 it-blocks),
  `tests/timeouts.test.ts` (13 it-blocks), `tests/failover-submit.test.ts`
  (2 it-blocks), and `tests/network.test.ts` extended (+2 it-blocks for
  `resetNodeFailover` + `retryTimer.unref` spy). Plus `tests/strategy.test.ts`
  extended (+6 it-blocks for the codexStrategy timeout seam).
- Test count: ~386 passing (from 346 baseline). v1.7.0 type-regression
  lock continues to fire.
- 81 `createClient(getPactUrl(...))` call sites migrated to
  `getFailoverClient(...)` across 11 interaction files (44 invocations,
  averaging ~1.8 chain operations per createClient destructure).

## 2.0.4 — 2026-05-01

**Triggers the v2.0.3 PAT-fallback workflow with the now-installed
`RELEASE_TOKEN` repo secret. No runtime change.**

The v2.0.3 workflow change (token fallback expression
`${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`) was correct,
but its workflow run still failed because the user hadn't yet added
the `RELEASE_TOKEN` secret to the repository. The secret is now in
place. v2.0.4 is pushed solely to trigger a fresh workflow run that
exercises the PAT-bearing branch of the fallback expression.

### Fixed

- **Backfill loop extended to v2.0.3.** Previous backfill ran
  `for PRIOR_TAG in v1.7.0 v2.0.0 v2.0.1 v2.0.2` — now adds v2.0.3 so
  the v2.0.4 workflow run creates Releases retroactively for ALL six
  prior tags whose Release-creation step had failed in earlier runs.

### Stats

- Files changed: 3 (`package.json`, `CHANGELOG.md`, `.github/workflows/publish.yml`).
- Lines added: ~15; lines removed: ~3.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.3 — 2026-05-01

**Final release-process hotfix. No runtime change.**

The v2.0.2 attempted fix (adding `permissions: contents: write` to
publish.yml) failed because the StoaChain organization has the
"Workflow permissions" setting locked at the org level, which caps
the auto-provided `GITHUB_TOKEN` to read-only regardless of what the
workflow YAML requests.

### Fixed

- **`.github/workflows/publish.yml` now uses a fallback token
  expression:** `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`.
  When the user-supplied `RELEASE_TOKEN` PAT secret is present (with
  Contents: Read and write scope on this repo), it bypasses the
  org-level workflow-permissions cap. When the secret is not set, the
  expression falls back to the auto-provided `GITHUB_TOKEN` — which
  works in orgs that allow write at the workflow level.
- **Backfill list extended to v2.0.2.** The v2.0.3 workflow run
  creates Releases retroactively for v1.7.0, v2.0.0, v2.0.1, and
  v2.0.2 — all the tags whose Release-creation step had previously
  failed or not yet existed.

### Stats

- Files changed: 3 (`package.json`, `CHANGELOG.md`, `.github/workflows/publish.yml`).
- Lines added: ~25; lines removed: ~3.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.2 — 2026-05-01

**Permissions hotfix for the v2.0.1 release-process patch. No runtime change.**

The v2.0.1 publish-workflow run published the package to npm
successfully but failed at the new "Create GitHub Release for the
pushed tag" step with HTTP 403. Root cause: the default
`GITHUB_TOKEN` ships with read-only `contents` scope, and
`gh release create` requires `contents: write`. Because the failure
happened mid-run, the subsequent backfill step was skipped, so v1.7.0
and v2.0.0 Releases also remained un-created.

### Fixed

- **`.github/workflows/publish.yml` now declares `permissions:
  contents: write`** at the job level. This grants the auto-provided
  `GITHUB_TOKEN` the minimum scope needed for `gh release create` to
  succeed. Verified via the failed v2.0.1 workflow-run job log.
- **Backfill list extended to include v2.0.1** alongside v1.7.0 and
  v2.0.0. The v2.0.2 workflow run will create Releases retroactively
  for all three previously-shipped tags whose Release-creation step
  was not yet possible. Idempotent — becomes a no-op once complete.

### Stats

- Files changed: 3 (`package.json`, `CHANGELOG.md`,
  `.github/workflows/publish.yml`).
- Lines added: ~30; lines removed: ~3.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.1 — 2026-05-01

**Documentation + release-process patch. No runtime behaviour change.**

The v2.0.0 release shipped with two documentation-discoverability gaps
that this patch closes. Consumers on v2.0.0 do NOT need to upgrade for
any code reason; v2.0.1 is functionally identical except for the
shipping artefacts.

### Fixed

- **`CHANGELOG.md` is now bundled with the npm tarball.** v2.0.0 had
  `package.json:files: ["dist"]` which excluded the changelog.
  Consumers running `npm view @stoachain/ouronet-core@2.0.0` saw only
  the README and had to visit the GitHub repo for migration guidance.
  v2.0.1 ships `CHANGELOG.md` alongside `dist/` so the migration
  guidance is reachable from the registry.
- **GitHub Releases now created automatically on every `v*` tag
  push.** Previously `publish.yml` only published to npm; the
  Releases page on GitHub stayed empty. The new workflow step uses
  the `gh` CLI (pre-installed on `ubuntu-latest` runners) with the
  auto-provided `GITHUB_TOKEN` to call `gh release create
  --notes-from-tag` on every push. Idempotent — safe to re-run.
- **Backfill for v1.7.0 and v2.0.0 GitHub Releases.** This v2.0.1
  workflow run also creates Releases retroactively for the two
  previously-shipped tags using their existing annotated-tag
  messages. After this run, `https://github.com/StoaChain/OuronetCore/releases`
  shows all three versions; the backfill step becomes a no-op on
  subsequent runs.

### Changed

- **`README.md` refreshed** to reflect v2.0.x state: status section
  now shows v2.0.1, v1.7.0/v2.0.0/v2.0.1 entries added; new
  "Migrating to v2.x" section documents the `BalanceResolver` wiring
  pattern and the `simulateTransaction(pactCode, chainId)` signature
  change with before/after code samples; test count updated from 295
  → 346; interactions submodule description flags the v2.0.0 signature
  change.

### Internal

- `package.json:files` extended from `["dist"]` to `["dist", "CHANGELOG.md"]`.
- `.github/workflows/publish.yml` gains two steps after `npm publish`:
  one to create a GitHub Release for the pushed tag, one to backfill
  Releases for `v1.7.0` and `v2.0.0` (idempotent — guarded by
  `gh release view`).

### Stats

- Files changed: 4 (`package.json`, `CHANGELOG.md`, `README.md`,
  `.github/workflows/publish.yml`).
- Lines added: ~120; lines removed: ~50.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.0 — 2026-05-01

**Cut the `wallet -> interactions` import edge with a `BalanceResolver` seam, and adopt the `pactRead` injection seam across all sixteen pure-read sites in `interactions/*`.**

Two architectural-layering passes ship together. The first (Phase 1)
closes the wallet-subpath edge by injecting a per-instance
`BalanceResolver` seam onto `KadenaWallet`. The second (Phase 2) sweeps
the remaining direct `createClient(...).local(...)` and
`Pact.builder...createTransaction()`-then-`.dirtyRead()` call sites in
`src/interactions/*` onto the existing `pactRead` injection point, so
every internal pure read now honours the consumer-configured reader
(cache-aware in OuronetUI, raw in HUB) and the dynamic node-failover
machinery uniformly.

### Phase 1 — Wallet edge cut

Closes the wallet-subpath half of the architectural-layering audit pass:
the runtime `KadenaWallet` account class previously reached into
`@stoachain/ouronet-core/interactions/kadenaFunctions` to fetch on-chain
balances, which meant any consumer importing
`@stoachain/ouronet-core/wallet` transitively pulled in the entire
`interactions/*` tree (and through it, `@kadena/client`, the Pact builders,
and the failover machinery). For browser SPAs that only wanted the HD
keypair builder this was dead weight; for server consumers wiring their
own indexer it was a forced dependency on the Pact-client read path they
intended to bypass.

Post-edit: `KadenaWallet.getBalance()` delegates to a new instance-level
`balanceResolver: BalanceResolver` seam (`(address: string) => Promise<string>`).
The wallet file no longer imports from `interactions/*`; importing the
wallet subpath no longer transitively pulls in `@kadena/client`. Each
consumer wires its own resolver. Note: `interactions/kadenaFunctions.getBalance`
returns `Promise<BalanceItem>` (`{ account, balance }`), so consumers wrap it
in a one-line adapter to match the `BalanceResolver` contract:

```ts
import KadenaWallet from "@stoachain/ouronet-core/wallet";
import { getBalance } from "@stoachain/ouronet-core/interactions/kadenaFunctions";

const wallet = new KadenaWallet({
  ...,
  balanceResolver: (address) => getBalance(address).then((r) => r.balance ?? "0"),
});
```

A server consumer (HUB) plugs in its own indexer-backed reader; tests plug
in an in-memory stub. The wrapping adapter is the same pattern shown in
the `BalanceResolver` JSDoc at `src/wallet/types.ts`.

The seam mirrors the existing `setPactReader` / `KeyResolver` patterns
documented in `CLAUDE.md` under "Pluggable seams, not DI" — narrow,
function-shaped, opt-in. The `BalanceResolver` alias is published from
`src/wallet/types.ts` and is reachable as
`import type { BalanceResolver } from "@stoachain/ouronet-core/wallet"`.

`KadenaWalletBuilder` is unaffected: its five static methods all return
keypair tuples or primitives and never instantiate a `KadenaWallet`, so
there is no construction path through the builder that needs to forward
the resolver. REQ-06 (builder propagation) is satisfied vacuously with
grep evidence in the phase TASKS.md.

### Phase 2 — Reader seam adoption across `interactions/*`

Every pure-read call inside `src/interactions/*` now flows through the
`pactRead(pactCode, { tier, pactUrl?, chainId? })` injection seam (set
once at boot via `setPactReader(fn)`). Sixteen call sites across four
files were migrated:

- `kadenaFunctions.ts` — `getBalance` (T1) and `accountDescription` (T5).
- `wrapFunctions.ts` — `getWrapStoaInfo` (T2), `getWrapperPaymentKey` (T5),
  `getPaymentKeyBalance` (T1), `getWrapUrStoaInfo` (T2).
- `addLiquidityFunctions.ts` — nine reads in the URC_LD / UEV_Liquidity /
  URC_BalancedLiquidity / URC_SortLiquidity / UR_IzFrozenLP /
  UR_IzSleepingLP family (T2 / T5 / T7 per call).
- `crossChainFunctions.ts` — `simulateTransaction` reshaped to the
  read signature (`pactCode`, `chainId`) so it routes through the same
  reader as the rest. **Public-API break** — see "Breaking change" below.

Each site preserves its existing response-unwrap branching (the
`{ result: { status, data } }` two-level envelope) and its existing
return shape, so behavioural equivalence to the prior
`createClient(...).local(...)` path holds for callers that don't rely
on cache semantics. Consumers that DO want caching gain it transparently
once they call `setPactReader(...)` at boot — that path was already
configured in OuronetUI and HUB, but until this release only a subset of
internal reads honoured it.

Submit / listen / poll / cross-chain SPV continuation paths (the
non-read paths inside `crossChainFunctions.ts`,
`activateFunctions.ts`, `coilFunctions.ts`, etc.) are
**unchanged** — they still build through `Pact.builder` and submit via
`createClient(getPactUrl(chainId)).submit(...)` because they need the
full transaction-descriptor return shape, not a dirty-read result.

A new `tests/interactions-read-seam.test.ts` regression guard
exercises every migrated function against a counting stub installed via
`setPactReader(...)` and asserts both the call count and the locked
`tier` value per site, so future drift back to direct
`createClient(...).local(...)` is caught at test time.

### Public API impact

- **Constructor signature widened (non-breaking):** `KadenaWallet`'s
  options object now accepts an optional `balanceResolver?: BalanceResolver`
  field appended after `derivationPath`. Existing callers that omit it
  compile and run unchanged — the field defaults to a throwing stub that
  fires only when `getBalance()` is invoked, so wallets used for
  address-only flows stay zero-config.
- **New instance property:** `wallet.balanceResolver` is publicly
  mutable. Consumers can either inject via the constructor or assign
  post-construction (`wallet.balanceResolver = fn`) before calling
  `getBalance()`. Both paths are equivalent.
- **New exported type:** `BalanceResolver` from
  `@stoachain/ouronet-core/wallet` —
  `(address: string) => Promise<string>`. JSDoc documents the `"0"`
  sentinel for absent accounts and the narrow-seam framing.
- **Edge cut:** importing `@stoachain/ouronet-core/wallet` no longer
  transitively pulls in `@kadena/client`, the `interactions/*` tree, or
  the Pact-client failover machinery. Bundle-size win for browser
  consumers that only use `KadenaWalletBuilder`.
- **Default resolver remediation:** if a consumer calls `getBalance()`
  on a wallet constructed without a resolver, the call rejects with
  `"KadenaWallet: balanceResolver not configured. Inject one via the
  constructor or set wallet.balanceResolver before calling getBalance()."`
  Remediation: either pass `balanceResolver` to the `KadenaWallet`
  constructor, or set `wallet.balanceResolver = fn` before calling
  `wallet.getBalance()`. The browser consumer (OuronetUI) wraps
  `interactions/kadenaFunctions.getBalance` in a one-line adapter
  (`(addr) => getBalance(addr).then(r => r.balance ?? "0")`) because
  the interactions function returns the wrapped `BalanceItem` shape
  `{ account, balance }` while `BalanceResolver` expects a bare
  decimal string. A server consumer (HUB) wires its own indexer-backed
  resolver. Mirrors the existing `setPactReader` consumer-wiring
  guidance in `src/reads/pactReader.ts`.
- **Breaking change — `simulateTransaction` signature
  (`@stoachain/ouronet-core/interactions/crossChainFunctions`):** the
  first parameter changed from a pre-built
  `IUnsignedCommand` / transaction object to the raw Pact code string
  the simulation should evaluate. The full new signature is
  `simulateTransaction(pactCode: string, chainId: string)`; the return
  shape (`{ success: boolean; result?: any; error?: string; gas?: number }`)
  is unchanged. Migration: callers that previously did
  `const tx = Pact.builder.execution(code).…createTransaction();
  await simulateTransaction(tx, chainId);` should now pass `code`
  directly — `await simulateTransaction(code, chainId);` — and drop
  the local `Pact.builder` plumbing. This routes the simulation through
  the same `pactRead` seam every other read uses, so the consumer-
  configured reader (e.g. OuronetUI's cache-aware wrapper) governs it
  uniformly.
- **Reader seam now adopted (no consumer-facing change for already-
  configured readers):** sixteen pure-read sites in `interactions/*`
  that previously bypassed `setPactReader(...)` by calling
  `createClient(...).local(...)` directly now flow through `pactRead`.
  Consumers that were already calling `setPactReader(...)` at boot
  (OuronetUI does; HUB leaves the default) see no API change — the
  seam was already there; this just makes every internal read honour
  it. Consumers that were NOT calling `setPactReader(...)` continue to
  hit the default `rawCalibratedDirtyRead`, identical pre-state behaviour.

### Behavioural impact (mildly breaking)

- **Removed silent `?? "0"` fallback in `getBalance()`.** The previous
  body was:

  ```ts
  const balance = await getBalance(this.address);
  this.balance = balance.balance ?? "0";
  return this.balance;
  ```

  The `?? "0"` swallowed any case where the upstream returned an
  envelope without a `balance` field, fabricating a "0" balance that
  could not be distinguished from a genuinely-zero on-chain account.
  The new body assigns the resolver's raw return value and propagates
  any error verbatim:

  ```ts
  this.balance = await this.balanceResolver(this.address);
  return this.balance;
  ```

  Consumers that today rely on `getBalance()` always returning a string
  (never throwing) must either (a) wrap their call sites in `try/catch`,
  or (b) supply a resolver whose own error path returns `"0"` to
  preserve the old behaviour. The `BalanceResolver` JSDoc still
  documents `"0"` as the stable sentinel for "absent on chain" — the
  contract for absent accounts is unchanged; only the silent-on-error
  swallow is gone.

### Changed

- `src/wallet/KadenaWallet.ts` — removed the `import { getBalance }
  from "../interactions/kadenaFunctions"` edge; added
  `import type { BalanceResolver } from "./types"`; added
  `public balanceResolver: BalanceResolver` instance field; constructor
  options-object widened with optional `balanceResolver?` argument;
  `getBalance()` body delegates to `this.balanceResolver(this.address)`
  with no `?? "0"` swallow; class JSDoc and property JSDoc updated to
  describe the new injection-seam reality and the last-write-wins
  race semantics.
- `src/interactions/kadenaFunctions.ts` — `getBalance` (T1) and
  `accountDescription` (T5) routed through `pactRead`. Direct
  `createClient(getPactUrl(...))` + `Pact.builder` plumbing removed;
  `import { pactRead } from "../reads"` added; unused
  `Pact` / `createClient` / `getPactUrl` / `KADENA_NETWORK` /
  `KADENA_CHAIN_ID` imports pruned (where no remaining call sites
  reference them). The `export interface BalanceItem` declaration is
  preserved verbatim — it's a public-API contract for downstream
  consumers.
- `src/interactions/wrapFunctions.ts` — four reads migrated:
  `getWrapStoaInfo` (T2), `getWrapperPaymentKey` (T5),
  `getPaymentKeyBalance` (T1), `getWrapUrStoaInfo` (T2). The eight
  submit/listen/poll wrap helpers
  (`executeFirestarter`/`executeWrap*`/etc.) keep their existing
  `Pact.builder` + `createClient(...).submit(...)` paths — those need
  the full transaction-descriptor return shape and are not reads.
- `src/interactions/addLiquidityFunctions.ts` — nine reads migrated
  across the URC_LD / UEV_Liquidity / URC_BalancedLiquidity /
  URC_SortLiquidity / UR_IzFrozenLP / UR_IzSleepingLP families at
  locked tiers (T2 / T5 / T7 per call). The IIFE wrapper shape used
  for the URC_0027-style batched selector is preserved; the submit /
  listen / poll paths in the same file are untouched.
- `src/interactions/crossChainFunctions.ts` — `simulateTransaction`
  reshaped from `(transaction, chainId)` to `(pactCode, chainId)` and
  routed through `pactRead`. **Public-API break — see "Breaking
  change" above.** `getBalanceOnChain` (already on `pactRead` since
  v1.6.1) is unchanged. The cross-chain transfer build / submit / SPV /
  finish paths are untouched.

### Added

- `src/wallet/types.ts` — new `BalanceResolver` type alias with full
  JSDoc (the `"0"` sentinel, the narrow-seam framing, the
  `wallet.balanceResolver = fn` wiring example).
- `tests/wallet.test.ts` — 8 behavioural tests covering: default-throw
  on call (exact error string), constructor-injected resolver delegation,
  post-construction assignment, async rejection propagation, sync throw
  propagation, plus construction-sanity checks.
- `tests/interactions-read-seam.test.ts` — behavioural regression guard
  with one it-block per migrated function. Each test installs a
  counting `pactRead` stub via `setPactReader(...)`, invokes the real
  exported function, and asserts both the call count (the stub fired
  exactly once per call site) and the `tier` value the stub received
  (so future drift back to direct `createClient(...).local(...)` or to
  a wrong tier is caught at test time). Total: ~15 it-blocks across
  the four migrated files. Combined with the existing
  `tests/wallet.test.ts` coverage, this is the new safety net the
  reader-seam adoption rests on.

### Unchanged

- `src/interactions/kadenaFunctions.ts` — `getBalance` (and
  `accountDescription`) still exported. The per-file subpath
  `@stoachain/ouronet-core/interactions/kadenaFunctions` continues to
  resolve. Only the wallet-side import is gone; downstream consumers
  that imported `getBalance` directly from interactions are unaffected.
- `KadenaWalletBuilder` — no API changes. The class's five static
  methods return keypair tuples or primitives; none constructs a
  `KadenaWallet` instance, so there is no propagation path to add.
- `package.json` `exports` map — unchanged.
- All submit / listen / poll / SPV / finish paths in
  `interactions/*` — unchanged. Only pure reads were touched;
  transaction-submitting helpers continue to build through
  `Pact.builder` and submit via
  `createClient(getPactUrl(chainId)).submit(...)` because they need
  the full `ITransactionDescriptor` return shape, not a dirty-read
  result.

### Process notes

This release was produced via the BeeDev workflow. Phase 1 of the
`arch-layering-and-seams` spec (REQ-01 through REQ-06) addresses the
wallet edge cut. Phase 2 (REQ-07 through REQ-17) adopts the existing
`pactRead` seam across the remaining sixteen pure-read sites in
`interactions/*` and reshapes `simulateTransaction`'s signature. The
`CLAUDE.md` "Pluggable seams" header is updated in this release from
"Two narrow injection points" to "Three narrow injection points" — the
new third bullet (`BalanceResolver`) was added additively in Phase 1;
the count text was deferred to Phase 2 (this entry) so it would land
together with the full adoption proof. The version number is left as
`Unreleased — TBD` in this entry; the release coordinator fills it in
at tag time per the `Publishing flow` ceremony, picking the
appropriate semver bump (Phase 2's `simulateTransaction` signature
change is breaking, so a major bump is the expected outcome unless
the coordinator rules it out).

### Release ceremony — pre-tag verification

Before tagging this release, the release coordinator MUST re-run the
import-graph regression grep to confirm Phase 1's wallet edge cut still
holds in the freshly-built `dist/`. The check is:

```sh
npm run build
grep -nE "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/*.js
# (or, with ripgrep)
rg -E "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/
```

Expected output: **zero hits** (grep exits 1, rg exits with no
results). The narrow regex matches only `from "..."` and
`require("...")` import-graph references — a substring grep of
"interactions" would produce a false positive on the JSDoc text in
`BalanceResolver` (TypeScript preserves JSDoc by default in
`tsconfig.build.json`). Any hit means the wallet subpath has
re-acquired a transitive dependency on `interactions/*` and the tag
should NOT proceed until the import is restored to a seam injection.

## 1.7.0 — 2026-04-30

**Consolidate `IKadenaKeypair` to a single canonical declaration.**

Closes audit finding **F-CORE-001 (CRITICAL)** from the v1.6.1 audit pass.
The signing-ready keypair shape was declared SIX times across the
codebase: once canonically in `src/signing/types.ts:22-30`, once with
documented Phase-2b backwards-compat in `src/interactions/ouroFunctions.ts`,
and four undocumented duplicates (in `activateFunctions`, `dexFunctions`,
`kpayFunctions`, `coilFunctions` — the last one non-exported). The
duplicates were not byte-identical: each omitted `"foreign"` from the
`seedType` literal-union and used `encryptedSecretKey?: any` instead of
`unknown`.

Post-consolidation: only TWO declarations remain. The four undocumented
duplicates are deleted and re-routed to the canonical via type-only
imports through the `../signing` barrel; each subpath also gets an
`export type { IKadenaKeypair } from "../signing"` re-export to preserve
its public API surface (consumers that imported `IKadenaKeypair` from
those subpaths still resolve cleanly). The Phase-2b copy in
`ouroFunctions.ts` stays in place but gains an `@deprecated` JSDoc tag.

The `IKadenaKeypair` half of the F-INT-001 circular dependency between
`addLiquidityFunctions` and `dexFunctions` is broken as a side effect:
`addLiquidityFunctions.ts:10` is split — `IOuroAccountKeypair` keeps its
value-position import from `./dexFunctions` (deferred consolidation),
`IKadenaKeypair` moves to a type-only import from `../signing`.

A new `tests/types.test.ts` regression-lock test asserts cross-subpath
assignability of `IKadenaKeypair` via `Parameters<typeof fn>` slots
against real exported functions in each subpath. Combined with a new
`tsconfig.tests.json` and `vitest.config.ts` `typecheck.tsconfig`
pointer, the lock fires under `npm test`: any future change that
reintroduces a drifted local `IKadenaKeypair` (omitting `"foreign"`)
breaks CI.

### Public API impact

- **Type widening (intentional):** the `IKadenaKeypair` resolved through
  `@stoachain/ouronet-core/interactions/{activate,dex,kpay,coil}Functions`
  now includes `seedType: "foreign"` in its literal-union (it didn't
  before — those subpaths' duplicates had a narrower `seedType`).
- **Type tightening (intentional, mildly breaking):** the resolved type
  now uses `encryptedSecretKey?: unknown` instead of `?: any`. Consumer
  code that did `kp.encryptedSecretKey.someField` (relying on `any`'s
  permissive structural access) needs a narrowing cast. The canonical
  declaration in `src/signing/types.ts` already used `unknown` since
  earlier versions; consumers importing from there are unaffected.
- **No runtime behaviour change.** All edits are type-position only.
- **Deprecated copy preserved.** `src/interactions/ouroFunctions.ts:816`
  retains its `IKadenaKeypair` declaration with `encryptedSecretKey?: any`
  for root-barrel consumers. The new `@deprecated` JSDoc surfaces in IDEs
  as strikethrough on import sites.

### Changed

- `src/interactions/activateFunctions.ts` — duplicate deleted; canonical
  imported and re-exported via `export type`
- `src/interactions/dexFunctions.ts` — same
- `src/interactions/kpayFunctions.ts` — same
- `src/interactions/coilFunctions.ts` — same; sibling non-exported
  `IOuroAccountKeypair` duplicate also deleted (routed to
  `./ouroFunctions`); imports reordered into a single contiguous block
- `src/interactions/addLiquidityFunctions.ts` — line 10's combined import
  split (F-INT-001 cycle break for `IKadenaKeypair`)
- `src/interactions/guardFunctions.ts:13` — value-position import from
  `./ouroFunctions` switched to type-only from `../signing`
- `src/interactions/wrapFunctions.ts:18` — same
- `src/interactions/ouroFunctions.ts:812-818` — `@deprecated` JSDoc added;
  declaration body byte-equivalent (preserves `any` for backwards-compat)
- `vitest.config.ts` — added `test.typecheck = { enabled: true,
  tsconfig: "tsconfig.tests.json", include: ["tests/types.test.ts"] }`

### Added

- `tests/types.test.ts` — type-level regression lock with 5 assignability
  assertion sites (1 canonical via direct type import + 4
  `Parameters<typeof fn>[N]` extractions covering both struct-nested and
  direct-positional shapes)
- `tsconfig.tests.json` — narrow tsconfig that includes only
  `tests/types.test.ts` alongside `src/**/*.ts`, used exclusively by
  vitest's typecheck pass to make the regression lock fire under
  `npm test`

### Process notes

This release was produced via the BeeDev workflow (`/bee:init` →
`/bee:audit` → `/bee:audit-to-spec` → `/bee:new-spec` → `/bee:plan-all` →
`/bee:ship`). The audit pass produced 32 confirmed findings; this
release closes one of them (the CRITICAL). Specs for the remaining 9
are stored in `.bee/audit-specs/` for future releases. The plan went
through 3 rounds of plan-review per phase plus 3 rounds of cross-plan
consistency review, surfacing several real planning errors before
implementation began (see `.bee/STATE.md` Decisions Log for the full
audit trail). Final implementation review caught a public-API
regression (deletion of `export interface` without re-export) and a
critical regression-lock failure (vitest 4.1.5's typecheck mode does
not auto-add test files to its tsc program); both were auto-fixed.

## 1.6.1 — 2026-04-27

**Fix: every internal `interactions/*` helper now honors the active node.**

`PACT_URL` was a static module-level constant frozen at import time —
`https://node2.stoachain.com/.../pact`. Code inside `interactions/*.ts`
called `createClient(PACT_URL)` directly, which created Pact clients
pinned to node2 forever, completely bypassing the failover machinery
in `network/nodeFailover` (which `withFailover` and `pactRead` honor
correctly). Symptom: when a consumer flipped the primary to node1
via `setNodeConfig("node1")`, batched read/write helpers in core's
interactions still hit node2 and timed out / returned stale data.

55 occurrences across 11 files swapped from `createClient(PACT_URL)`
to `createClient(getPactUrl(KADENA_CHAIN_ID))`. The `getPactUrl`
helper (which itself wraps `getActivePactUrl` from nodeFailover) was
already exported from `constants/kadena.ts` since v1.5.0 — this
release just makes everything inside core actually use it.

### Changed

- `src/interactions/activateFunctions.ts` — 1 site
- `src/interactions/addLiquidityFunctions.ts` — 18 sites
- `src/interactions/coilFunctions.ts` — 1 site
- `src/interactions/dexFunctions.ts` — 6 sites
- `src/interactions/guardFunctions.ts` — 1 site
- `src/interactions/kadenaFunctions.ts` — 2 sites
- `src/interactions/kpayFunctions.ts` — 1 site
- `src/interactions/ouroFunctions.ts` — 13 sites
- `src/interactions/pensionFunctions.ts` — 2 sites
- `src/interactions/urStoaFunctions.ts` — 4 sites
- `src/interactions/wrapFunctions.ts` — 6 sites

Each file's `import` from `../constants` swapped `PACT_URL` for
`getPactUrl`. No other behaviour change in any helper.

### Unchanged

- `PACT_URL` still exported from `constants/kadena` for backwards
  compatibility (consumers may still depend on it). New code should
  use `getPactUrl(chainId)` instead.
- `getActivePactUrl` / `getActiveSpvUrl` / `setNodeConfig` /
  `getCurrentNodeStatus` / `withFailover` from `network` —
  unchanged.
- All 320 tests pass; no test changes required.

### Why this matters for consumers

Before 1.6.1: a UI calling `setNodeConfig("node1")` got correct
failover for any read using `pactRead` (URC_0027 batched account
selector, balance fetches, guard fetches), but broken behaviour for
every transaction-submitting modal — those built their `Pact.builder`
through a `createClient(PACT_URL)` instance still pointing at node2.

After 1.6.1: the entire core resolves the Pact endpoint through the
same dynamic getter, so a single `setNodeConfig` flip routes every
internal call (reads + simulates + submits) to the chosen node.

UI consumers (OuronetUI specifically) should ALSO replace any
direct `import { PACT_URL }` + `createClient(PACT_URL)` pattern in
their own source — the OuronetUI v0.30.13b bump does this
alongside the core upgrade.

## 1.6.0 — 2026-04-25

**Smart Ouronet Account auth-path resolution + Rotate Sovereign builder.**

Smart accounts (Σ. prefix) authorise mutations via `enforce-one` over
three branches: the account's own guard, the current sovereign
account's guard, and the account's governor. Any one branch
satisfying its predicate authorises the transaction. This release
adds the primitives that let downstream consumers (OuronetUI's
AuthPathZone, the future HUB, custom tooling) discriminate the four
Pact guard shapes (keyset / keyset-ref / capability / user) and
produce a ready-to-render summary of which branches the codex can
sign for, plus the first CFM builder that targets a Smart account's
auth path (`C_RotateSovereign`).

`CodexSigningStrategy` is **unchanged**: it still takes
`guards: IKeyset[]` (AND-required). The UI resolves the OR-of-3 to a
single chosen keyset before calling `strategy.execute`. This keeps
the strategy small and pushes the auth-path picker UX where it
belongs (the consumer).

### Added

- `src/guard/smartAccountAuth.ts` — three new primitives, all pure
  (no I/O, no `@kadena/client`):
  - `classifyGuardKind(g: unknown): 'keyset' | 'keyset-ref' | 'capability' | 'user' | 'unknown'`
    — pure shape discriminator. Mirrors OuronetUI's `<GuardTree>`
    detection 1:1; both stay in lockstep across releases.
  - `extractKeysetFromGuard(g: unknown): IKeyset | null` — returns
    the keyset payload for inline keysets and resolved keyset-refs;
    null for unresolved refs / capabilities / user-guards.
    Caller resolves keyset-refs upstream via existing `resolveGuard`.
  - `analyzeSmartAccountAuthPaths({ accountGuard, sovereignGuard, governor }, codexPubs, manualKeys)`
    — composes the classifier + extractor + `analyzeGuard` for each
    of the three branches and returns a `SmartAccountAuthPaths`
    summary: per-branch kind / keyBased / GuardAnalysis / rawGuard,
    plus derived `anyKeyBased` and `firstSatisfied` flags.
- `src/pact/cfmBuilders.ts` — `buildRotateSovereignPactCode({ patron, account, newSovereign })`.
  Emits `(ouronet-ns.TS01-C1.DALOS|C_RotateSovereign "<patron>" "<account>" "<new-sovereign>")`.
- `src/guard/index.ts` re-exports the new module via the existing
  `/guard` subpath. No package.json `exports` change required.
- Tests: `tests/smart-account-auth.test.ts` (full truth-tables for all
  three primitives) + `tests/cfm-builders.test.ts` extended with
  `buildRotateSovereignPactCode` cases.

### Public-API surface (semver minor — additive only)

```ts
// New from "@stoachain/ouronet-core/guard"
export type GuardKind = "keyset" | "keyset-ref" | "capability" | "user" | "unknown";
export function classifyGuardKind(g: unknown): GuardKind;
export function extractKeysetFromGuard(g: unknown): IKeyset | null;
export interface SmartAccountAuthBranch {
  readonly which: "guard" | "sovereign" | "governor";
  readonly kind: GuardKind;
  readonly keyBased: boolean;
  readonly analysis: GuardAnalysis | null;
  readonly rawGuard: unknown;
}
export interface SmartAccountAuthPaths {
  readonly branches: readonly [SmartAccountAuthBranch, SmartAccountAuthBranch, SmartAccountAuthBranch];
  readonly anyKeyBased: boolean;
  readonly firstSatisfied: number; // 0 | 1 | 2 | -1
}
export function analyzeSmartAccountAuthPaths(
  guards: { accountGuard: unknown; sovereignGuard: unknown; governor: unknown },
  codexPubs: Set<string>,
  resolvedManualKeys?: Record<string, string>,
): SmartAccountAuthPaths;

// New from "@stoachain/ouronet-core/pact"
export function buildRotateSovereignPactCode(p: {
  patron: string;
  account: string;
  newSovereign: string;
}): string;
```

No breaking changes — every existing symbol stays at its v1.5.0
signature. Consumers can upgrade with a `^1.6.0` range bump and
`npm install`.

### Unchanged

- `CodexSigningStrategy.execute` signature.
- `analyzeGuard` / `GuardAnalysis` — the new module composes them,
  doesn't replace them.
- `createDefaultRegistry()`, `createOuronetAccount`, encryption,
  codex codec, gas helpers, all 14 pre-existing CFM builders.

## 1.5.0 — 2026-04-24

**Historical-curve primitives surfaced via the `/dalos` subpath.**
Pairs with `@stoachain/dalos-crypto@1.2.0`, which promotes LETO /
ARTEMIS / APOLLO from low-level `Ellipse` constants to full
`CryptographicPrimitive` singletons with their own address prefixes,
Schnorr v2 sign + verify, and registry detection.

OuronetCore re-exports the new symbols through its `/dalos` subpath so
downstream consumers (OuronetUI, AncientHoldings HUB, custom tools)
can reach them without adding a direct dependency on dalos-crypto.

### Added (re-exports from `@stoachain/dalos-crypto/registry`)

- `Leto`, `Artemis`, `Apollo` — the three historical-curve primitive
  singletons. Each implements `CryptographicPrimitive` (5 input paths
  + Schnorr v2 + detect-by-prefix). **NOT registered in the default
  registry** — opt-in via `registry.register(Leto)`.
- `createGen1Primitive(config)` — factory for building custom
  Gen-1-family primitives from any `Ellipse` + prefix-pair config.
- `AddressPrefixPair` type + `DALOS_PREFIXES` constant — for
  consumers needing to construct primitives with their own prefix
  conventions.

### Changed

- `package.json` dependency range on `@stoachain/dalos-crypto` tightened
  to `^1.2.0` (was `^1.0.0`) — the new symbols require that version
  floor.

### Unchanged (Ouronet behaviour preserved)

- `createDefaultRegistry()` still returns a registry with only
  `DalosGenesis`. Ouronet continues to use DALOS Genesis exclusively.
- `createOuronetAccount` / Pact builders / signing / codex — no
  changes.
- Full 295/295 test suite still passes.

## 1.4.0 — 2026-04-24

**Smart Ouronet Account fields in batched selector.** Extends the
on-chain `URC_0027_AccountSelectorMapper` response type (the Pact-side
change already landed on-chain) so the TypeScript consumers can type
and display the three new fields that the mapper now returns:
`public-key`, `sovereign`, and `governor`.

### Added

- `AccountSelectorData.public-key: string` — on-chain source-of-truth
  public key (DALOS `{prefixLenBase49}.{xyBase49}` format). Populated
  for both Standard and Smart accounts; expected to match the
  codex-stored `publicKey` for any account created through the normal
  flow. A mismatch indicates either an admin-level chain-side rotation
  (last-resort correction tool) or a corrupted codex entry.
- `AccountSelectorData.sovereign: string | false` — only populated for
  Smart (Σ.) accounts. Pact returns the Ѻ. address of the sovereign
  Standard account that controls the Smart account's sovereign
  authorization path. Standard accounts and unactivated accounts
  return `false`.
- `AccountSelectorData.governor: any | false` — only populated for
  Smart accounts. The Pact guard used for complex custom authorization
  (capability / module / user guards, alternative keysets). For Smart
  accounts where no custom governor has been set, this matches the
  account's own `ouronet-account-guard`. Standard accounts and
  unactivated accounts return `false`.

### Notes

No other changes to the interaction surface; `getAccountSelectorData`
itself is unchanged (it already returns whatever the Pact mapper
sends, just with an extended TS type now). The three new fields flow
through the existing T5 read → 80-second sync cycle in OuronetUI.

Future Smart-account management operations (spawn on-chain,
rotate-governor, etc.) will be added in a subsequent release as typed
Pact builders.

## 1.3.0 — 2026-04-23

**DALOS Cryptography integration.** OuronetCore now exposes the full DALOS cryptographic stack through a new `./dalos` subpath. Consumers (OuronetUI, AncientHoldings hub, CLI tools) can mint Ouronet accounts locally, sign with Schnorr v2, and verify addresses via a single, stable API without depending on the remote `go.ouronetwork.io/api/generate` service.

### Added

- **Dependency**: `@stoachain/dalos-crypto@^1.0.0` (byte-identical TypeScript port of the Go DALOS reference — all 85 Go test vectors reproduced byte-for-byte, all 20 Schnorr signatures match).
- **Subpath**: `@stoachain/ouronet-core/dalos` — re-exports the full `CryptographicPrimitive` + `CryptographicRegistry` surface plus a `createOuronetAccount` convenience helper.
- **`src/dalos/index.ts`** — re-exports:
  - Types: `KeyPair`, `PrivateKeyForms`, `FullKey`, `PrimitiveMetadata`, `CryptographicPrimitive`, `DalosGenesisPrimitive`, `Bitmap`
  - Values: `DalosGenesis`, `CryptographicRegistry`, `createDefaultRegistry`, `isDalosGenesisPrimitive`, bitmap utilities
- **`src/dalos/account.ts`** — `createOuronetAccount(registry, options)`:
  - Discriminated-union `CreateAccountOptions` covering all 6 input modes (`random`, `bitString`, `integerBase10`, `integerBase49`, `seedWords`, `bitmap`)
  - Dispatches to the right primitive method
  - Returns a fully-materialised `FullKey` (keyPair + all 3 private-key forms + both Ѻ./Σ. addresses)
  - Throws descriptive errors on unregistered primitives or unsupported modes
- **`tests/dalos-integration.test.ts`** — 9 integration tests (all 6 modes + registry detect/sign/verify end-to-end + error paths).

### Usage example

```typescript
import {
  createDefaultRegistry,
  createOuronetAccount,
} from '@stoachain/ouronet-core/dalos';

const registry = createDefaultRegistry();

// Mint an account from seed words:
const account = createOuronetAccount(registry, {
  mode: 'seedWords',
  data: ['hello', 'world', 'dalos', 'genesis'],
});
console.log(account.standardAddress); // Ѻ.xxxxx...

// Sign + verify:
const primitive = registry.detect(account.standardAddress);
const sig = primitive!.sign!(account.keyPair, 'approve tx 123');
const valid = primitive!.verify!(sig, 'approve tx 123', account.keyPair.publ);
```

### Verified

- All existing **286 OuronetCore tests still pass** (no regressions).
- **9 new integration tests all pass**.
- **Total: 295/295 tests pass in ~14 s**.
- Build clean (`tsc -p tsconfig.build.json`).

### Dependency resolution

`@stoachain/dalos-crypto@^1.0.0` is resolved from the public npmjs registry
(`https://registry.npmjs.org/@stoachain/dalos-crypto/-/dalos-crypto-1.0.0.tgz`).
The earlier `file:../DALOS_Crypto/ts` placeholder was cleared in this same
version — the published tarball now ships with a registry-ranged dep, so
downstream consumers (OuronetUI, AncientHoldings hub) don't need a sibling
checkout to install.

### Migration notes for consumers

This release is purely additive — no existing OuronetCore API changed. Consumers that don't import from `./dalos` see zero behavioural difference. The OuronetUI migration to the local-generation path lands separately as Phase 9 of the DALOS TypeScript port.

---

## 1.2.2 — 2026-04-23

**Secret name fix.** v1.2.1 still failed ENEEDAUTH because the workflow referenced `secrets.NPM_TOKEN` but the actual GitHub repo secret is named `NPMPUSHER`. Updated the workflow to use the correct secret name. The secret itself (content-wise) is correct — just a name mismatch between what the workflow expected and what was registered. No source changes.

## 1.2.1 — 2026-04-23

**Publish fix.** v1.2.0's publish workflow failed with `ENEEDAUTH` because `setup-node`'s scope-based `.npmrc` generation didn't reliably propagate `NODE_AUTH_TOKEN` to `npm publish`. Rewrote the workflow to write `.npmrc` itself with an explicit `_authToken` line, plus added an `npm whoami` verify step so future auth failures surface earlier. Pure infrastructure fix — source code identical to v1.2.0.

## 1.2.0 — 2026-04-22

**Registry switch: GitHub Packages → npmjs.org.** Pure distribution change, zero source code changes. Everything that made v1.1.0 work still works identically; consumers just pull from a different registry.

### Changed

- `.github/workflows/publish.yml` rewired to publish to `https://registry.npmjs.org` instead of `https://npm.pkg.github.com`. Uses the `NPM_TOKEN` repo secret (granular npmjs token, 90-day expiry, scoped to `@stoachain` read+write with bypass-2FA enabled for CI automation).
- `package.json` `publishConfig` → `{ registry: https://registry.npmjs.org, access: public }`. Scoped packages default to "restricted" on npmjs.org; explicit `access: public` makes them installable anonymously.

### Why the switch

GitHub Packages for npm requires any consumer to authenticate with a GitHub PAT even for packages marked "public" at the package level — the StoaChain org doesn't have the legacy "allow anonymous access" toggle, so every install site (Ploi, local dev, team laptops, CI) needed `NPM_TOKEN` configured. npmjs.org is the standard public JS registry — `npm install @stoachain/ouronet-core` just works anywhere with zero auth setup. Switch has no tradeoff: the package is already public in source form on github.com/StoaChain/OuronetCore, so making it installable without friction is pure upside.

### For consumers (OuronetUI, future HUB, team laptops)

- Delete any `.npmrc` entries or `NPM_TOKEN` env vars that pointed at GitHub Packages.
- Run `npm install` — everything resolves from the default registry.
- No credentials needed. No `@stoachain:registry=...` lines needed.

### For contributors publishing new versions

Same workflow as before: bump version, update changelog, `git tag v$VERSION && git push --tags`. The `publish.yml` workflow handles the rest. The `NPM_TOKEN` secret in the repo needs to be rotated every 90 days (granular npm tokens' max lifetime).

## 1.1.0 — 2026-04-22

**Tier 2 testing pass.** 18 new tests across 2 files (one extension + one new). 286 total pass (was 268). No source changes — tests exercise existing code paths that weren't previously covered. See `OuronetUI/docs/TESTING_STRATEGY.md` §Tier 2.

### Added

- **`tests/strategy.test.ts` extended** — 6 new edge-case tests:
  - Foreign key synthesis via `resolvedForeignKeys` (ForeignKeySignModal flow)
  - Tx with unsigned slot for a foreign pub when no resolvedForeignKeys supplied — documents that strategy doesn't police guard satisfaction; chain-level rejection is the user-visible failure mode
  - `resolver.requestForeignKey` invocation path + error propagation
  - Impossible case: only codex key is also payment key AND guard key → throw
  - Resolver throw (HD derivation fail, password cancelled) propagates up execute()
  - Multi-guard: 2-of-3 patron + 1-of-1 resident → caps correctly picks the one free codex key
  - Keyset-ref guards flow through without surprise
- **`tests/encryption-upgrade.test.ts`** NEW — 12 tests for the V1 → V2 upgrade-on-unlock flow:
  - Happy path: V1 blob decrypts → re-encrypt with schemaVersion=1 → V2 blob → decrypts back to same plaintext
  - Idempotent: re-running upgrade on a V2 blob leaves it V2
  - schemaVersion-null/0 → V1 blob (fail-safe pre-upgrade behaviour)
  - Mixed-codex state: some V1 + some V2 blobs all decrypt via `smartDecrypt`
  - Wrong-password rejection for both V1 and V2 (no silent V2-fallback slip)
  - `isCodexUpgraded` ↔ `smartEncrypt` contract across null/0/1/2/99/garbage inputs
  - Password-change-during-upgrade: new password decrypts, old password fails
  - `decryptStringV2` V1-fallback path (belt-and-suspenders)
  - Full-codex simulation: 5 entries (wallet + account + pure keypair fields), all round-trip through the upgrade pipeline

### No changes

- Source. These are pure test additions.

## 1.0.0 — 2026-04-22

**Extraction complete.** Symbolic bump to 1.0.0 to mark the end of the OuronetUI → OuronetCore migration. Every piece of blockchain logic that used to live in OuronetUI (Pact builders, signing pipeline, encryption, guard analysis, gas calibration, codex codec, seed-type migration) now lives here. OuronetUI is a pure consumer. No API changes from 0.11.0 — strict semver would call this 0.11.1, but the bump signals "this is the public surface we commit to and will semver against going forward."

### Documentation

- `README.md` — rewritten. Status now "extraction complete", not "skeleton only". Submodule table reflects current exports (including the 14 `buildXxxPactCode` builders added in 0.11.0). Cross-links to OuronetUI's TESTING_STRATEGY + CFM_BUILD_GUIDE. Documents the `npm link` local-dev flow and the tag-push publish workflow.

### What 1.0.0 commits to

- Public API: the 10 subpath exports listed in `package.json` (`/constants`, `/network`, `/gas`, `/guard`, `/crypto`, `/signing`, `/codex`, `/reads`, `/pact`, `/interactions`). Removing or renaming anything exported at the top level of any of these = major version bump.
- Codex export format: `"version": "1.2"` is stable — existing `OuronetCodex_*.json` files users have on disk must stay importable forever.
- Signing strategy contract: `CodexSigningStrategy.execute({ build, guards, paymentKey?, resolvedForeignKeys?, extraSigners? })` is the stable shape.

## 0.11.0 — 2026-04-22

**Tier 1 testing pass.** Extracts the per-modal Pact-code builders into a pure module and adds 75 tests across 4 new/extended test files. All 268 tests pass (was 193). See `OuronetUI/docs/TESTING_STRATEGY.md` for the testing strategy rationale.

### Added

- **`@stoachain/ouronet-core/pact/cfmBuilders`** — 14 pure Pact-code string builders, one per CFM function the ecosystem ships: `buildTransferPactCode`, `buildClearDispoPactCode`, `buildSublimatePactCode`, `buildCompressPactCode`, `buildCoilPactCode`, `buildCurlPactCode`, `buildBrumatePactCode`, `buildConstrictPactCode`, `buildColdRecoveryPactCode`, `buildDirectRecoveryPactCode`, `buildCullPactCode`, `buildAwakePactCode`, `buildSlumberPactCode`, `buildFirestarterPactCode`. Replaces the inline template literals that used to live in OuronetUI's 23 CFM modals. Each builder takes a typed params object and returns the canonical Pact-code string.
- **`tests/cfm-builders.test.ts`** — 35 tests. One per builder + argument-order preservation + decimal formatting + edge cases (empty nonce list, single-item list, dayz as integer not decimal, etc). Cross-cutting "every builder produces `(ouronet-ns...)` shape" test for forward-compat.
- **`tests/codex-codec.test.ts`** — 31 tests covering `buildCodexExport` / `serializeCodex` / `deserializeCodex` / `migrateSeedType`. Round-trip + version-mismatch rejection + unicode preservation + idempotent seed-type migration.
- **`tests/strategy.test.ts`** — 9 tests for `CodexSigningStrategy.execute()` + `sign()`. Uses mock `PactClient` + mock `KeyResolver` with real Ed25519 nacl signing (RFC 8032 test vectors for keypairs). Verifies call-order (simulate → submit), gas calibration flows through, sim-failure halts pipeline, guard keypair dedup, `extraSigners` folded into sign step.

### Changed

- `tests/guard.test.ts` — extended with multi-guard scenarios (patron+resident cooperating) and keyset-ref guard edge cases. The pattern every CFM modal runs internally but that wasn't directly covered before.

### Migration notes

- `@stoachain/ouronet-core/pact` now also exports the 14 `buildXPactCode` functions. Existing imports of `formatDecimalForPact`, `safeCreationTime`, `filterFreePositionData`, `mayComeWithDeimal`, `parseEU`, `formatEU` all still work.
- No breaking change — pure additions.

## 0.10.0 — 2026-04-22

**Phase 4 of the OuronetUI → OuronetCore extraction.** Moves encryption primitives + introduces portable Codex types + the backup-JSON codec. Pure additions — no existing export changes.

### Added

- **`@stoachain/ouronet-core/crypto`** — migrated wholesale from OuronetUI's `src/lib/encryptor.ts` + `src/lib/encryptorV2.ts`. Both V1 (PBKDF2-SHA256 10k) and V2 (PBKDF2-SHA512 600k) primitives, plus `smartDecrypt` auto-format-detection + `smartEncrypt` (now pure — takes `schemaVersion: string | null` as an argument instead of reading `localStorage.codex_schema_version`). Works in browser + Node.js.
- **`@stoachain/ouronet-core/codex`** — portable Codex shape + codec:
  - `PlaintextCodex<KS, OA, PK, AB, UI>` — generic in-memory shape. Default type params are `unknown`; consumers (OuronetUI, future HUB) plug in their own wallet/account/keypair types. Fields: kadenaWallets, ouronetWallets, addressBook, pureKeypairs, uiSettings, schemaVersion, lastUpdatedAt, lastUpdatedDevice.
  - `CodexExportV1_2<KS, OA, AB, UI>` — the `"version": "1.2"` backup-JSON shape OuronetUI has been writing since early 2025. Intentionally preserved byte-for-byte: existing `OuronetCodex_*.json` files stay valid.
  - `buildCodexExport(codex)` + `serializeCodex(codex)` (stringify with 2-space indent) + `deserializeCodex(json)` (throws on version mismatch — fail-fast before mis-decoding a hypothetical future V2).
  - `migrateSeedType(rawType)` + `SeedType`/`RawSeedType` types — the historical `legacy → chainweaver`, `new → koala` mapping. Was inlined in OuronetUI's WalletStorage; lives here now so HUB doesn't rediscover it. Idempotent.
- 31 new encryption tests moved to `tests/encryption.test.ts` (from OuronetUI's `src/lib/__tests__/encryption.test.ts`). Covers V1/V2 round-trips, wrong-password, envelope shape, smartDecrypt mixed-format, isCodexUpgraded predicate, smartEncrypt schema-version dispatch. **193 tests total pass** (was 162).

### Migration notes

- `smartEncrypt` API changed: now `smartEncrypt(plaintext, password, schemaVersion)` instead of the browser-only `smartEncrypt(plaintext, password)`. OuronetUI keeps a tiny `src/lib/smart-encrypt-browser.ts` wrapper that reads `localStorage.codex_schema_version` and delegates here — no behaviour change for UI consumers.
- Existing codex blobs decrypt identically — no on-disk format change.

## 0.9.1 — 2026-04-22

**Phase 3b cleanup.** Deletes 15 now-unused `executeX` helpers from `interactions/wrapFunctions.ts` and re-tightens `tsconfig.json` (`noUnusedLocals` + `noUnusedParameters` back on, were relaxed during the 3a/3b scaffolding).

### Removed

- `executeFirestarter`, `executeSublimate`, `executeCompress`, `executeTransferToken`, `executeCoil`, `executeCurl`, `executeBrumate`, `executeConstrict`, `executeColdRecovery`, `executeDirectRecovery`, `executeCull`, `buildNativeTransferTx`, `executeAwake`, `executeSlumber`, `executeClearDispo` — every last CFM modal in OuronetUI (v0.29.7c) moved to `strategy.execute()`, so these direct-path helpers have no remaining callers. Kept: `executeWrapStoa` + `executeWrapUrStoa` (still used by the two Wrap* modals, which aren't CFM modals).

### Changed

- `tsconfig.json`: `noUnusedLocals: true`, `noUnusedParameters: true` — both were off during 3a/3b to let scaffolding compile with in-flight unused symbols. Back on, with a handful of leftover unused imports (`NATIVE_TOKEN_VAULT`, `IKeyset`, a couple of dev-local variables) cleaned up.

### Migration

Consumers that still imported these helpers will fail to resolve — if you're one of those, switch to `CodexSigningStrategy` via `new CodexSigningStrategy(resolver, client)` + `strategy.execute({...})` (see codexStrategy.ts docstring).

## 0.9.0 — 2026-04-22

**Phase 3b.2 Wave 4 support.** Small SigningStrategy API addition — adds `extraSigners?: IKadenaKeypair[]` to `execute()` so flows with more than two signer roles (like Firestarter, which needs GAS_PAYER + payment-key with `coin.TRANSFER` cap + account guards) can plug in. No breaking change: existing consumers pass nothing and behave exactly as before.

### Added

- `SigningStrategy.execute({ extraSigners? })` — optional array of pre-resolved `IKadenaKeypair`s. The strategy folds them into the sign step alongside the guard keypairs (deduplicated by pubkey). Used by OuronetUI's `FirestarterCFMModal` to supply the payment-key signer whose `coin.TRANSFER` cap the build closure wires explicitly via `addSigner`.

## 0.8.0 — 2026-04-22

**Phase 3b.2 Wave 1 support.** Pure addition — exposes `safeCreationTime()` from `@stoachain/ouronet-core/pact` so CFM modals in OuronetUI can mint `creationTime` values the same way every core `execute*` helper already does (Pact `setMeta`'s creationTime − 30s to sidestep node clock-skew rejections). No behavior changes to existing exports.

### Added

- `safeCreationTime(): number` — shared `Math.floor(Date.now()/1000) - 30` helper. Used by the CFM modals' `strategy.execute({ build })` closures so their `setMeta({creationTime})` matches what the A-F pipeline has always done. Keeps sim + submit consistent across every modal.

## 0.7.0 — 2026-04-22

**Phase 3b.1 of the OuronetUI → OuronetCore extraction.** Ships `CodexSigningStrategy` — the first real `SigningStrategy` implementation. The 23 CFM modals in OuronetUI can now delete their ~43-line `handleExecute` A-F pipeline in favor of a ~30-line `strategy.execute({...})` call. Done one modal at a time with smoke-testing between each; `CompressCFMModal` is the first consumer (see OuronetUI v0.29.6).

### Added

- **`@stoachain/ouronet-core/signing/CodexSigningStrategy`** — implements the full pipeline:
  1. Get codex pub set from resolver
  2. `analyzeGuard` each guard (with any caller-provided resolvedForeignKeys)
  3. Resolve keypairs via `resolver.getKeyPairByPublicKey` (or synthesize inline for resolved-foreign keys)
  4. `selectCapsSigningKey` for GAS_PAYER avoiding pure-signer overlap
  5. Build via caller closure (given the resolved pubkeys)
  6. `client.dirtyRead` to simulate → fail-fast
  7. `calculateAutoGasLimit` on measured gas
  8. Rebuild with real gas
  9. `universalSignTransaction` with deduped keypairs
  10. `client.submit` → return `{requestKey, raw}`
- `.execute(...)` for the full pipeline; `.sign(...)` as a lower-level primitive for callers that own their simulation flow.

### Changed

- `SigningStrategy.execute`'s `build` closure signature widened: now receives `{gasLimit, capsKeyPub, guardPubs}` instead of just `gasLimit`. Necessary because Pact.builder's `addSigner` calls need the pubkeys at simulation time (cap-requiring modules reject sims with missing capability signers).

### Migration semantics

Resolved-foreign-keys handling: when a guard-signer pubkey is in the caller's `resolvedForeignKeys` map (user pasted a raw priv via `ForeignKeySignModal` or equivalent), the strategy synthesizes `{publicKey: pub, privateKey, seedType: "foreign"}` inline rather than asking the resolver — the resolver never knew about it. Codex keys still go through the resolver which handles password prompts + HD derivation.

## 0.6.0 — 2026-04-22

**Phase 3a of the OuronetUI → OuronetCore extraction.** Pure scaffolding release — introduces the signing abstractions Phase 3b will wire up and collapse the 23 CFM `handleExecute` duplicates against.

### Added

- **`@stoachain/ouronet-core/signing/types`** — three interfaces grounded in the research pass (`docs/EXTRACT_OURONET_CORE_PLAN.md §2.2` in the OuronetUI repo):
  - **`IKadenaKeypair`** — canonical home for the keypair shape. Same structure ouroFunctions has been exporting since Phase 2b; this version is the authoritative one going forward. Both paths compile because the shape is identical.
  - **`KeyResolver`** — the three-method contract (`listCodexPubs`, `getKeyPairByPublicKey`, optional `requestForeignKey`) each consumer implements against their own Codex backend. OuronetUI: `ReduxCodexResolver` (Redux + wallet-context). HUB: future `FileCodexResolver` (disk file + env/KMS passphrase). CLI: `readline`. Etc.
  - **`PactClient`** — minimal `dirtyRead` + `submit` subset of `@kadena/client`'s `createClient` return. Strategies accept one so the URL isn't baked into core (browser needs the CF-worker proxy; server hits Stoa directly).
  - **`SigningStrategy`** — the `execute(...)` + `sign(...)` pipeline interface. Still unimplemented in this release; `CodexSigningStrategy` lands in Phase 3b.

### Changed

Nothing — this is additive scaffolding. Every existing import path keeps working unchanged; every runtime behavior is identical to v0.5.0.

### Tests

Still 162 — the new interfaces are compile-time only and have no runtime until Phase 3b wires an implementation. On-chain acceptance for the whole signing surface runs at the end of 3b (9-item real-wallet matrix).

## 0.5.0 — 2026-04-22

**Phase 2c of the OuronetUI → OuronetCore extraction.** HD keypair derivation + runtime wallet class move to core; `CodexStorageAdapter` interface defined so browser + server consumers each implement their own storage backend.

### Added

- **`@stoachain/ouronet-core/wallet/KadenaWalletBuilder`** — HD keypair derivation + mnemonic generation/validation. Two paths: `koala` (24-word BIP39 + SLIP-10 Ed25519) and `chainweaver`/`eckowallet` (12-word Kadena mnemonic + BIP32-Ed25519). Plus `encrypt`/`decrypt` wrapping `@kadena/hd-wallet`'s AES-GCM primitive (distinct from core/crypto's Codex-level encryption — this is the inner per-seed wrapper).
- **`@stoachain/ouronet-core/wallet/KadenaWallet`** — runtime account class with `address`, `publicKey`, `derivationPath`, and lazy `getBalance()`. Pure data holder + one async chain read.
- **`@stoachain/ouronet-core/wallet/SeedType`** — `"koala" | "chainweaver" | "eckowallet"`. Picks the derivation algorithm; NOT a delegation marker (no browser-wallet integration is wired).
- **`@stoachain/ouronet-core/wallet/CodexStorageAdapter`** — interface only. Two methods: `load()`, `save(codex)`, `clear()`. Concrete implementations live in each consumer: OuronetUI ships `LocalStorageCodexAdapter` (backed by localStorage + redux-persist); the HUB will ship `EncryptedFileCodexAdapter` (AES-GCM file on disk). Core intentionally provides no default — each runtime brings its own.

### Why no default adapter in core

Different runtimes have fundamentally different idioms: Redux action-dispatch (browser) vs direct-mutation-then-write (server) vs async-backend (future). Trying to force them through one shared state machine gains nothing; the interface is the minimal contract. Phase 4's `PlaintextCodex` type will concrete-type the payload both adapters persist.

### Tests

Still 162 — the wallet code is integration-level (needs real @kadena/hd-wallet WASM + a mnemonic); unit-testing would mostly exercise the library. Phase 3b's on-chain checklist covers HD-derivation end-to-end.

## 0.4.1 — 2026-04-22

**Phase 2b refinement.** Adds a pluggable Pact reader so consumers can wire their own cache-aware implementation, restoring the read behavior OuronetUI had before Phase 2b. Caught via a Smart Swap UI flicker bug: after v0.4.0, every dex read inside `interactions/*` went through `rawCalibratedDirtyRead` — no cache, no dedup — so a widget that fires reads per-keystroke (Smart Swap's token selector) flickered and couldn't finalize a selection.

### Added

- **`@stoachain/ouronet-core/reads`** — new `setPactReader(reader)` + `getPactReader()` + `pactRead(pactCode, options)`. Interactions now call `pactRead` instead of `rawCalibratedDirtyRead` directly; the default is `rawCalibratedDirtyRead` (so HUB / server consumers see no change), but OuronetUI calls `setPactReader(calibratedDirtyRead)` at boot and its cache-aware wrapper takes over.

### Changed

- Every `rawCalibratedDirtyRead(...)` call inside `src/interactions/*` rewritten to `pactRead(...)`. Behavior identical when no reader is configured (default is still raw); behavior cache-aware when a consumer configures one.

### Why

Phase 2b's sed swapped `calibratedDirtyRead` → `rawCalibratedDirtyRead` blanket across all moved interactions. That was too aggressive — the intent was "simulations shouldn't be cached" (one-shot reads before signing), but the same swap also touched routine display reads inside `interactions/*` (`getPoolTotalFee`, `getSwpairs`, `getSWPairGeneralInfo`, etc.). These need cache dedup because UI widgets call them repeatedly as users interact. Pluggable reader keeps both worlds clean: raw by default, cached on request.

## 0.4.0 — 2026-04-22

**Phase 2b of the OuronetUI → OuronetCore extraction.** The largest single phase so far — all Pact builders + error helpers + signing core move into the package. Both consumers (OuronetUI today, HUB in future) now get every on-chain action OuronetUI performs by importing from `@stoachain/ouronet-core/interactions/*`.

### Added

- **`@stoachain/ouronet-core/interactions/*`** — 13 files from OuronetUI's `src/kadena/interactions/`:
  `activateFunctions`, `addLiquidityFunctions`, `coilFunctions`, `crossChainFunctions`, `dexFunctions` (swap + pool reads), `guardFunctions` (guard rotation), `infoOneFunctions` (INFO_* cost-estimate reads), `kadenaFunctions` (native coin + account reads), `kpayFunctions`, `ouroFunctions` (OURO token family, ignis, virtual-OURO, activation flow), `pensionFunctions` (brumate / hibernate), `urStoaFunctions` (stake / unstake / collect), `wrapFunctions` (Coil / Curl / Compress / Sublimate / Awake / Slumber / Transfer / Firestater). Sub-path-importable as `@stoachain/ouronet-core/interactions/ouroFunctions` etc. — the package now declares a wildcard subpath so every file is its own entry.
- **`@stoachain/ouronet-core/errors`** — `TransactionError`, `SigningError` + `createSigningError` / `createSimulationError` / `formatErrorForUser` / `logDetailedError`. Moved wholesale from OuronetUI's `src/lib/transaction-errors.ts`; 100% pure, no browser deps.
- **`@stoachain/ouronet-core/signing/universalSign.ts`** — `universalSignTransaction`, `UniversalKeypair`, `fromKeypair`. Phase-3 will collapse with OuronetUI's local copy (which still exists — interactions in core use core's version, the rest of UI uses its own until signing's full refactor lands).
- **`@stoachain/ouronet-core/guard`** adds `IKeyset` type (was in OuronetUI's `src/ouro.d.ts`).

### Changed

- `rawCalibratedDirtyRead` gained accepted-and-ignored `tier?: string` + `skipTempWatcher?: boolean` options — source-compatibility shim for the 20+ call sites that previously hit OuronetUI's cache-aware wrapper with these options.
- Barrel `src/interactions/index.ts` now re-exports only `ouroFunctions` (the canonical source of shared types). Cross-file collisions on `IKadenaKeypair` / `IOuroAccountKeypair` / etc. surface if consumers import from the root barrel; use sub-path imports (`./interactions/<filename>`) when in doubt.

### Internal

- Relaxed `tsconfig.json`: removed `noUnusedLocals` + `noUnusedParameters` (OuronetUI's cached typecheck was silently tolerating these; re-tighten in a later cleanup phase).
- ~12 surgical `as any` casts inside the moved interactions where stricter `@kadena/types` in TS 5.9 rejected access patterns that worked under the OuronetUI cache. All casts are boundary-level (narrowing response bodies, slippage-bounds addData args, BIP32 WASM hashBytes). No behaviour change.

### Tests

Still 162 tests / 5 files on the core side — the moved interaction code has no tests yet (interactions are integration-level; Phase 3b's on-chain acceptance checklist is the real verification). Phase 3 / 4 add more.

## 0.3.0 — 2026-04-22

**Phase 2a of the OuronetUI → OuronetCore extraction.** Adds raw on-chain read + Pact-format helpers.

### Added

- **`@stoachain/ouronet-core/reads`** — `rawCalibratedDirtyRead(pactCode, options?)`. Uncached Pact dirty-read with a read-friendly 10M gas ceiling. Pure, no React lifecycle. OuronetUI layers its PactQueryCache on top; the HUB will call this directly.
- **`@stoachain/ouronet-core/pact`** — three helpers moved from OuronetUI's `src/lib/utils.ts`:
  - `formatDecimalForPact(amount, maxDecimals?)` — canonicalize a decimal string for Pact code literals (adds `.0` to integers, truncates overlong fractional parts, validates shape).
  - `mayComeWithDeimal(data)` — unwrap Pact's `{ decimal: "…" }` envelope to the underlying string (typo preserved from original to keep name compatibility).
  - `filterFreePositionData(raw)` — normalise the `[{ "reward-tokens": [0] }]` sentinel the chain returns for "no positions" to an empty array.
- **`@stoachain/ouronet-core/signing`** — `toHexString(byteArray)` added alongside `publicKeyFromPrivateKey` + `publicKeyFromExtendedKey`. Used wherever raw bytes cross into strings (derived private keys, signed-tx hashes).

### Tests

+52 tests across `pact-format.test.ts` (29: formatDecimalForPact, mayComeWithDeimal, filterFreePositionData, Pact code template snapshots) and `signing.test.ts` (signing-primitives test moved from OuronetUI, plus 7 new tests for toHexString). Total suite: 162 tests across 5 files (was 110).

### `exports` map

Added `./pact` subpath to `package.json` exports. Existing `./reads` and `./signing` subpaths gain new symbols; consumers don't need to change import style.

## 0.2.0 — 2026-04-22

**Phase 1 of the OuronetUI → OuronetCore extraction.** First real code move.

### Added

- **`@stoachain/ouronet-core/constants`** — full StoaChain / Chainweb / Pact constants:
  - `KADENA_NETWORK`, `KADENA_CHAIN_ID`, `KADENA_NAMESPACE`, `KADENA_BASE_URL`, `PACT_URL`, `KADENA_CHAINS`, `STOA_CHAINS`, `STOA_CHAIN_COUNT`
  - Stoa autonomic account addresses: `STOA_AUTONOMIC_OUROBOROS`, `STOA_AUTONOMIC_LIQUIDPOT`, `STOA_AUTONOMIC_OURONETGASSTATION`, legacy aliases `GAS_STATION` + `NATIVE_TOKEN_VAULT`
  - `MAIN_TOKENS` list
  - Token IDs: `TOKEN_ID_OURO`, `TOKEN_ID_IGNIS`, `TOKEN_ID_AURYN`, `TOKEN_ID_ELITEAURYN`, `TOKEN_ID_WSTOA`, `TOKEN_ID_SSTOA`, `TOKEN_ID_GSTOA`, `ALL_TOKEN_IDS`
  - Helper accessors `getPactUrl(chainId)` + `getSpvUrl(chainId)` that route through node-failover
- **`@stoachain/ouronet-core/network`** — Stoa node failover:
  - Primary node2 → fallback node1, with health check + 30s retry loop
  - `getActiveBaseUrl`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl`
  - `setNodeConfig` (node2 / node1 / custom), `getNodeConfig`, `getCurrentNodeStatus`, `getNodeGasLimit`, `getActiveGasLimit`, `CHAINWEB_DEFAULT_GAS_LIMIT`
  - `withFailover(fn)` — wrapper that retries once on fallback for network errors
  - `initNodeFailover()` — optional startup health check
- **`@stoachain/ouronet-core/gas`** — gas + ANU/STOA math:
  - `ANU_PER_STOA` (10^12), `GAS_LIMIT_MAX` (2M), `GAS_PRICE_MIN_ANU`, TTL constants
  - `anuToStoa`, `stoaToAnu`, `formatAnuAsStoa`
  - `getGasLimitStatus` (safe/warning/danger bands) + `GAS_LIMIT_COLORS`
  - `formatMaxFee`, `calculateAutoGasLimit` (5-bucket buffer with node-cap)
- **`@stoachain/ouronet-core/guard`** — full guard analysis surface:
  - `computeThreshold` for 14 predicates: standard (keys-all/keys-any/keys-2), stoic fixed (keys-1/3/4), M-of-N (2-of-3 through 5-of-9), percentage (51/60/66/75/90pct), tolerance (all-but-one/two)
  - `predicateLabel`, `analyzeGuard`, `buildCodexPubSet`, `classifyPaymentKey`, `tryDerivePublicKey`, `selectCapsSigningKey` — all pure
- **`@stoachain/ouronet-core/signing`** — phase-1 temp copy of pure public-key primitives:
  - `publicKeyFromPrivateKey` (standard Ed25519 from 64-char seed)
  - `publicKeyFromExtendedKey` (BIP32-Ed25519 from kL half of extended key)
  - Full signing surface (universalSignTransaction, KeyResolver, SigningStrategy) lands in Phase 3

### Tests

110 tests across 3 files (`guard.test.ts` 54, `gas.test.ts` 31, `network.test.ts` 25), all green in Node environment.

### Peer dependencies added

- `@kadena/cryptography-utils ^0.4.0` (public-key derivation)
- `@noble/curves ^1.4.0` (BIP32-Ed25519 math)

## 0.1.0 — 2026-04-21

Initial scaffold commit. Empty-barrel skeleton. See
[`docs/EXTRACT_OURONET_CORE_PLAN.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/EXTRACT_OURONET_CORE_PLAN.md) in the OuronetUI repo for the multi-phase plan driving this package's development.
