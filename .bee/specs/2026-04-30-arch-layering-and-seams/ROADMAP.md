# Roadmap: arch-layering-and-seams

## Phase-Requirement Mapping

| Phase | Goal | Requirements | Success Criteria |
|-------|------|-------------|------------------|
| 1. Wallet edge cut | Remove the wallet→interactions backwards layering edge by introducing a balance-resolver injection seam on `KadenaWallet`. The wallet subpath no longer transitively requires `@kadena/client` or the interactions tree. | REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06 | 1. Broadened-pattern grep `grep -rE "(from\s+['\"]\|import\s*\(\s*['\"]\|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` returns zero hits (covers static, dynamic, and side-effect imports). 2. Consumers can construct `KadenaWallet` without a resolver and the default-throw fires only when `getBalance()` is invoked. 3. Consumers who inject a resolver via constructor OR assign `wallet.balanceResolver = fn` get balance fetches successfully. 4. The interactions barrel still exports `getBalance` for its other consumers. 5. `npm run typecheck` and `npm test` pass. |
| 2. Reader seam adoption + regression guard | Migrate all 16 read-only call sites in `src/interactions/*` to `pactRead`, refactor `simulateTransaction` to a read-shaped signature, and add a behavioural regression test that fails if any future read silently bypasses the seam. | REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17 | 1. Every read in `src/interactions/*` calls `pactRead(...)`; zero `createClient(...).dirtyRead(...)` destructures remain outside sim-before-submit pairs. 2. Tier values match the locked mapping (T1/T2/T5/T7 per site). 3. `simulateTransaction(pactCode, chainId)` is the new signature; consumer migration is documented. 4. `tests/interactions-read-seam.test.ts` exercises ~12 migrated functions via a counting stub and passes. 5. `npm run build` emits clean `dist/`; `grep "interactions" dist/wallet/*.js` returns zero hits. 6. `npm run typecheck` and `npm test` pass with no regressions versus baseline. |

## Coverage Validation

- Total requirements: 17
- Mapped: 17
- Unmapped: 0

All requirements are mapped to exactly one phase. REQ-15 and REQ-16 (typecheck and test gates) are scoped exit gates per phase; REQ-17 (build-graph verification) is the joint exit gate that only passes once both phases have landed.

## Phase Details

### Phase 1: Wallet edge cut
**Goal:** Drop the `wallet → interactions` import edge by introducing a balance-resolver injection seam on `KadenaWallet`. After this phase, importing `@stoachain/ouronet-core/wallet` no longer transitively pulls in `@kadena/client` or the interactions tree.
**Requirements:** REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06
**Success Criteria** (what must be TRUE when this phase completes):
1. `src/wallet/KadenaWallet.ts:14` no longer imports from `../interactions/*`; broadened-pattern grep `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` returns zero hits (covers static, dynamic, and side-effect imports).
2. `KadenaWallet` exposes `balanceResolver` as a publicly mutable instance property (constructor optional, post-construction assignable).
3. The default resolver throws a clearly-worded error when invoked, citing the configuration paths consumers can use.
4. `KadenaWallet.getBalance()` delegates to the injected resolver and propagates errors rather than silently returning "0".
5. `KadenaWalletBuilder` propagates the optional `balanceResolver` argument.
6. The interactions barrel still exports `getBalance` for its existing external consumers (no deletion).
7. `npm run typecheck` and `npm test` pass for the wallet-scoped change.

### Phase 2: Reader seam adoption and regression guard
**Goal:** Migrate every pure read in `src/interactions/*` to the `pactRead` injection seam, refactor `simulateTransaction` to a read-shaped signature, and add a behavioural regression test that catches any future seam-bypass.
**Requirements:** REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17
**Success Criteria:**
1. All 16 read-only call sites converted to `pactRead(pactCode, { tier: "T?" })` with the locked tier per site (T1/T2/T5/T7 per the requirements.md Q4 table).
2. `simulateTransaction(pactCode: string, chainId: string)` replaces the old `(transaction, chainId)` signature; body uses `pactRead(pactCode, { pactUrl: getPactUrl(chainId), chainId, tier: "T2" })`; the `{ success, result?, error?, gas? }` return envelope is preserved.
3. Sim-before-submit destructures (`{ dirtyRead, submit }`) and submit/listen/poll-only destructures are NOT touched; ~43 legitimate sites remain on the raw client.
4. `import { pactRead } from "../reads"` added to `kadenaFunctions.ts`, `wrapFunctions.ts`, `addLiquidityFunctions.ts`; pre-existing in `crossChainFunctions.ts`.
5. Unused imports (`Pact`, `createClient`, `getPactUrl`, optionally `KADENA_CHAIN_ID`/`KADENA_NETWORK`) pruned per file based on grep.
6. `tests/interactions-read-seam.test.ts` exists with ~12 it-blocks (one per migrated function), uses `setPactReader` to install a counting stub, and asserts the stub fires for every migrated function.
7. `npm run typecheck` and `npm test` pass with no regressions; the v1.7.0 `tests/types.test.ts` regression-lock continues to fire.
8. `npm run build` emits clean `dist/`; manual `grep "interactions" dist/wallet/*.js` returns zero hits, confirming the wallet subpath drops its transitive dependency on `interactions/*`.
