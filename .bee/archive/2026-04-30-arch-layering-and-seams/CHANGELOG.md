# Changelog: arch-layering-and-seams

## arch-layering-and-seams (2026-04-30)

Closes audit findings F-CORE-005 (HIGH — wallet → interactions backwards layering) and F-CORE-006 (HIGH — pactRead injection seam bypassed by ~16 pure-read call sites). Two architectural commitments documented in CLAUDE.md and the README — partially undone in the live code — are now restored.

### Added

- **REQ-02 / REQ-14:** `BalanceResolver` type alias on the wallet subpath public surface (`@stoachain/ouronet-core/wallet`) — `(address: string) => Promise<string>` with JSDoc covering the `"0"` sentinel, the edge-cut framing, and a one-line wiring example.
- **REQ-03:** Optional `balanceResolver?: BalanceResolver` constructor parameter on `KadenaWallet`, plus a publicly mutable `balanceResolver` instance property so consumers can inject at construction OR assign post-construction. Default value is a lazy throwing stub with an exact-locked error message.
- **REQ-14:** Behavioural regression-guard test at `tests/interactions-read-seam.test.ts` (15 it-blocks, one per migrated function) that uses `setPactReader` to install a counting stub and asserts each migrated function invokes the seam at the locked tier (T1/T2/T5/T7).
- **Phase 1 coverage:** `tests/wallet.test.ts` (9 it-blocks) covering default-throw, constructor injection, post-construction assignment, error propagation (async + sync), and stale-balance preservation on rejection-after-success.

### Changed

- **REQ-01:** Wallet subpath no longer imports from `interactions/*`. After this change `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` returns zero hits across static, dynamic, and side-effect import forms. Importing `@stoachain/ouronet-core/wallet` no longer transitively pulls in `@kadena/client` or the interactions tree (verified post-build via import-graph regex against `dist/wallet/*.js`).
- **REQ-04:** `KadenaWallet.getBalance()` now delegates to the injected resolver and propagates errors. Removed the previous `?? "0"` silent fallback (mildly breaking — see Migration Notes below).
- **REQ-07 / REQ-08:** `kadenaFunctions.ts` `getBalance` (T1) and `accountDescription` (T5) routed through `pactRead`. Imports collapsed to `import { pactRead } from "../reads"` only; `BalanceItem` interface preserved verbatim.
- **REQ-09:** Four `wrapFunctions.ts` reads migrated to `pactRead` at locked tiers — `getWrapStoaInfo` T2, `getWrapperPaymentKey` T5, `getPaymentKeyBalance` T1, `getWrapUrStoaInfo` T2. Sim-before-submit destructures untouched.
- **REQ-10:** Nine `addLiquidityFunctions.ts` reads migrated to `pactRead` at locked tiers (7×T2 preview reads + 2×T7 LP-capability flags). Promise.all + IIFE structure inside `getLPTypeInfo` preserved exactly.
- **REQ-11 (BREAKING):** `simulateTransaction` signature refactored from `(transaction: any, chainId: string)` to `(pactCode: string, chainId: string)`. Body now uses `pactRead(pactCode, { pactUrl: getPactUrl(chainId), chainId, tier: "T2" })`. Return envelope `{ success, result?, error?, gas? }` preserved.
- **REQ-12:** `import { pactRead } from "../reads"` added to three previously-missing files (kadenaFunctions, wrapFunctions, addLiquidityFunctions); pre-existing in crossChainFunctions.
- **REQ-13:** Per-file unused-import prune driven by grep; kadenaFunctions collapsed to single import; other three files retain `Pact`/`createClient`/`getPactUrl` because submit/listen/poll paths still use them.
- **CLAUDE.md:** "Pluggable seams, not DI" section flipped from "Two narrow injection points" to "Three" (deferred from Phase 1 T1.5 to Phase 2 T2.6 once full adoption landed). Third bullet names `BalanceResolver` as the instance-level analogue of `setPactReader`.

### Fixed

- **[Plan review auto-fix]** Phase 1 plan-review converged in 3 iterations after fixing 11 total findings: 1 HIGH grep-pattern propagation (broadened to catch static + dynamic + side-effect imports), 7 MEDIUM (default-throw deviation rationale anchor, field-position lock, CLAUDE.md count-flip deferral, vacuous-satisfaction grep evidence, type-alias-vs-interface alignment, etc.), plus 3 same-class propagation fixes across requirements.md, ROADMAP.md, and TASKS.md.
- **[Plan review auto-fix]** Phase 2 plan-review converged in 3 iterations after fixing 6 total findings: 1 HIGH non-existent-test-file reference, 3 MEDIUM (it-block count drift, import path lock, BalanceItem export survival), plus 2 arithmetic stragglers.
- **[Cross-plan auto-fix]** 7 cross-phase issues fixed in 1 iteration: 1 CRITICAL grep-vs-JSDoc collision (T2.7 substring grep would catch JSDoc text from T1.1; switched to import-graph-only regex), 2 HIGH (orphaned CLAUDE.md count-flip; simulateTransaction stub envelope shallow), 4 MEDIUM (CHANGELOG insertion ambiguity, tier source-of-truth lock, getLPTypeInfo IIFE-aware exact-count assertion, error-string drift acknowledged).
- **[Final-review auto-fix]** 4 cross-phase findings fixed: 1 HIGH (CHANGELOG migration guidance was type-incompatible — said "OuronetUI plugs in `interactions/kadenaFunctions.getBalance`" but that returns `BalanceItem` not `string`; spelled out wrap adapter), 2 MEDIUM (added stale-balance-after-success test pinning no-mutate-on-error invariant; removed unused `beforeEach` import), 1 LOW (regression-guard JSDoc downgraded to honest scope statement).

### Internal

- 2 new behavioural test files added: `tests/wallet.test.ts` (Phase 1, 9 it-blocks) and `tests/interactions-read-seam.test.ts` (Phase 2, 15 it-blocks).
- Test count grew from 322 baseline to 346 (+24 new tests).
- 4 implementation files (`kadenaFunctions.ts`, `wrapFunctions.ts`, `addLiquidityFunctions.ts`, `crossChainFunctions.ts`) refactored across 16 read-only call sites without disturbing the ~43 sim-before-submit / submit / listen / poll sites.
- `KadenaWallet` constructor widened with non-breaking optional argument; default-throw stub installed lazily.

### Migration Notes (for downstream consumers)

This spec ships as a single MAJOR or MINOR-with-flagged-break version (release coordinator to decide):

1. **`KadenaWallet` constructor (NON-BREAKING widening):** existing call sites compile unchanged. The new optional `balanceResolver` parameter defaults to a lazy throwing stub that fires only when `wallet.getBalance()` is actually invoked.
2. **`KadenaWallet.getBalance()` behavioural shift (MILDLY BREAKING):** consumers MUST inject a resolver before invoking `getBalance()`. The previous `?? "0"` silent fallback is gone — error paths now propagate. Wrap your existing balance-fetcher to match the contract:
   ```ts
   import { getBalance } from "@stoachain/ouronet-core/interactions/kadenaFunctions";
   const wallet = new KadenaWallet({
     ...,
     balanceResolver: (addr) => getBalance(addr).then((r) => r.balance ?? "0"),
   });
   ```
3. **`simulateTransaction(pactCode, chainId)` (BREAKING signature):** consumers previously passed a pre-built transaction object; they must now pass the Pact code string directly. Replace `simulateTransaction(builtTx, chainId)` with `simulateTransaction(pactCodeString, chainId)`. Internal callers (none in `src/`) verified zero — blast radius is consumer-only (OuronetUI / AncientHolder HUB).

### Stats

- Files changed (since v1.7.0 baseline `e7bdcb4`): 10 files
- Lines added: 937
- Lines removed: 137
- Phases: 2 (Wallet edge cut; Reader seam adoption + regression guard)
- Tasks: 12 across 6 waves
- Test count delta: 322 → 346 (+24 behavioural tests)
- Build verification: `dist/wallet/*.js` has zero import-graph references to `interactions/*`
- Audit traceability: 17/17 requirements satisfied (100%)
- Audit findings closed: F-CORE-005 (HIGH), F-CORE-006 (HIGH)
