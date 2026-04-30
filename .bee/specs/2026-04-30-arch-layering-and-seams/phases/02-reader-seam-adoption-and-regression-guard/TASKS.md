# Phase 2: Reader seam adoption and regression guard -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = which REQ-IDs from ROADMAP.md this task addresses
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (from researcher agent, prevents pattern hallucination)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

Migrate every pure on-chain read inside `src/interactions/*` to route through the configured `pactRead` injection seam, refactor `simulateTransaction` to a read-shaped signature, and add a behavioural regression test that fails if any migrated site silently drifts back to a direct Kadena client call. Sim-before-submit destructures (`{ dirtyRead, submit }`) and submit/listen/poll-only destructures are deliberately untouched. After this phase lands, downstream apps (browser SPA and Node.js HUB) can install caching, dedup, and failover at a single point — the seam — without touching any interaction call site.

Locked decisions:
- 16 sites with locked tier mappings (per requirements.md Q4):
  - `kadenaFunctions.ts:16` → T1 (getBalance, live balance)
  - `kadenaFunctions.ts:36` → T5 (accountDescription, account-state)
  - `wrapFunctions.ts:48` → T2 (getWrapStoaInfo preview)
  - `wrapFunctions.ts:72` → T5 (getWrapperPaymentKey, account-state)
  - `wrapFunctions.ts:96` → T1 (getPaymentKeyBalance, live balance)
  - `wrapFunctions.ts:244` → T2 (getWrapUrStoaInfo preview)
  - `addLiquidityFunctions.ts:102, 138, 208, 853, 878, 902, 928` → T2 (URC_LD / UEV_Liquidity / URC_BalancedLiquidity / URC_SortLiquidity preview reads)
  - `addLiquidityFunctions.ts:253, 271` → T7 (UR_IzFrozenLP / UR_IzSleepingLP, very-static module metadata)
  - `crossChainFunctions.ts:398` → T2 (simulateTransaction post-refactor)
- `simulateTransaction` signature changes from `(transaction: any, chainId: string)` → `(pactCode: string, chainId: string)`. Body uses `pactRead(pactCode, { pactUrl: getPactUrl(chainId), chainId, tier: "T2" })`. This is a documented public-API break.
- Sim-before-submit destructures and submit/listen/poll-only destructures are NOT touched; ~43 legitimate sites remain on the raw client.
- `import { pactRead } from "../reads"` is added to `kadenaFunctions.ts`, `wrapFunctions.ts`, `addLiquidityFunctions.ts`. `crossChainFunctions.ts` already imports it.
- Per-file unused-import prune is grep-driven (`Pact`, `createClient`, `getPactUrl`, optionally `KADENA_CHAIN_ID`/`KADENA_NETWORK`). Constants stay only when other code paths in the file still reference them.
- The behavioural regression test at `tests/interactions-read-seam.test.ts` uses `setPactReader` to install a counting stub and asserts the stub fires for each migrated function. It does NOT use `node:fs.readFileSync` + regex on source text (that pattern was rejected in v1.7.0 review). One `it()` block per migrated FUNCTION (not per site) — minimum 15 it-blocks (2 from kadenaFunctions + 4 from wrapFunctions + 8 from addLiquidityFunctions + 1 from crossChainFunctions; `getLPTypeInfo` counts as one block but asserts the stub was invoked at least twice for that block since it covers both T7 sites in one Promise.all call).
- Manual build-graph verification: post-`npm run build`, `grep "interactions" dist/wallet/*.js` returns zero hits — closes the loop on Phase 1's edge cut.
- This phase carries the public-API break (`simulateTransaction`); CHANGELOG entry documents both Phase 1's wallet edge cut and Phase 2's seam adoption + simulateTransaction signature change. Version number left as a placeholder for the release coordinator.

## Wave 1 (parallel — disjoint files in `src/interactions/*`)

- [x] T2.1 | Migrate the two read sites in `src/interactions/kadenaFunctions.ts` (`getBalance`, `accountDescription`) to `pactRead` and prune unused imports | bee-implementer
  - requirements: [REQ-07, REQ-08, REQ-12, REQ-13]
  - acceptance:
    - `import { pactRead } from "../reads"` is added to `src/interactions/kadenaFunctions.ts`.
    - `getBalance(account: string)` (line 9-27 pre-state) routes through `pactRead(pactCode, { tier: "T1" })`. The Pact code form `(coin.get-balance "${account}")` is preserved verbatim. The response unwrap branches the same way the pre-state does — Kadena's `{ decimal: ... }` envelope is handled, the return shape is the existing `BalanceItem` `{ account, balance }` interface, and absent-balance still resolves to the literal string `"0"`.
    - `accountDescription(address: string)` (line 29-46 pre-state) routes through `pactRead(pactCode, { tier: "T5" })`. The Pact code form `(coin.details ...)` is preserved verbatim. The inline-typed return shape `{ isNewAccount, balance, account, guard }` is preserved exactly, including the failure-vs-success branching (`isNewAccount: result?.status === "failure"`).
    - Unused imports pruned per grep: `Pact` and `createClient` from `@kadena/client` are removed if no remaining code path in the file references them. `getPactUrl` from `../constants` is removed when the seam fully replaces it. `KADENA_CHAIN_ID` / `KADENA_NETWORK` are dropped only if grep shows zero in-file usage; otherwise retained.
    - The `export interface BalanceItem { account: string; balance: string }` declaration block at pre-state lines 4-7 is **preserved verbatim** in the post-state file (the export remains; downstream consumers still depend on it). This is a public-API preservation contract that the post-state's "imports collapse to `import { pactRead } from "../reads"` only" phrasing in the research notes refers to ONLY — the imports collapse, but the `export interface BalanceItem` block stays.
    - Implementer pastes the literal output of `grep -nE "createClient\(|Pact\.builder|getPactUrl\(" src/interactions/kadenaFunctions.ts` into the task notes; output must show zero matches (or only matches inside comments/JSDoc, called out explicitly).
    - Implementer pastes the literal output of `grep -n "export interface BalanceItem" src/interactions/kadenaFunctions.ts` into the task notes; output must show line ~4 (the preserved `export interface BalanceItem` declaration).
    - `npm run typecheck` passes.
    - `npx vitest run tests/types.test.ts` passes (scoped run for the v1.7.0 type regression-lock; behavioural coverage for the migrated `getBalance` and `accountDescription` is delivered by `tests/interactions-read-seam.test.ts` in T2.5; the full suite runs in T2.7).
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-07, REQ-08, REQ-12, REQ-13 (reader seam adoption block).
    - `D:\_Claude\OuronetCore\src\interactions\kadenaFunctions.ts` -- pre-state file (47 lines total). Both migration sites at lines 16 and 36; imports at lines 1-2; constants used at lines 12, 13, 32, 33.
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- `pactRead` API and `PactReader` type alias; the function signature and `tier`/`pactUrl`/`chainId` option keys.
    - `D:\_Claude\OuronetCore\src\interactions\activateFunctions.ts` -- canonical post-`pactRead` status-success unwrap pattern (lines 11, 60-71). `pactRead` import path matches what this task adds.
    - `D:\_Claude\OuronetCore\src\interactions\dexFunctions.ts` -- T2/T5 tier exemplars (lines 227, 250, 289, 1620). T1 exemplar in the next file.
    - `D:\_Claude\OuronetCore\src\interactions\crossChainFunctions.ts` -- `getBalanceOnChain` (lines 20-50) is the T1 + dynamic-chainId exemplar; though `accountDescription` and `getBalance` use the global default chain (no dynamic chainId here), the unwrap shape transfers.
  - research:
    - Pattern: [CITED] Pre-state body of `getBalance` at `src/interactions/kadenaFunctions.ts:9-27` — verbatim:
      ```ts
      export async function getBalance(account: string): Promise<BalanceItem> {
        const transaction = Pact.builder
          .execution((Pact.modules as any).coin["get-balance"](account))
          .setMeta({ senderAccount: account, chainId: KADENA_CHAIN_ID })
          .setNetworkId(KADENA_NETWORK)
          .createTransaction();

        const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));

        const response = await dirtyRead(transaction);

        const raw = (response.result as any).data;
        // Kadena may return { decimal: "..." } — unwrap to plain string
        const balance = raw && typeof raw === "object" && "decimal" in raw
          ? String(raw.decimal)
          : String(raw ?? "0");

        return { account, balance };
      }
      ```
      Note: pre-state uses `Pact.modules.coin["get-balance"](account)` (the JS-DSL form). Post-state must switch to a Pact-code STRING `(coin.get-balance "${account}")` because `pactRead` accepts a string, not a builder. The unwrap (`raw.decimal` vs `raw ?? "0"`) and `BalanceItem` return shape are preserved verbatim.
    - Pattern: [CITED] Pre-state body of `accountDescription` at `src/interactions/kadenaFunctions.ts:29-46` — verbatim:
      ```ts
      export async function accountDescription(address: string) {
        const transaction = Pact.builder
          .execution((Pact.modules as any).coin.details(address))
          .setMeta({ senderAccount: address, chainId: KADENA_CHAIN_ID })
          .setNetworkId(KADENA_NETWORK)
          .createTransaction();

        const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));

        const { result }: any = await dirtyRead(transaction);

        return {
          isNewAccount: result?.status === "failure",
          balance: result?.data?.balance || "0",
          account: result?.data?.account || address,
          guard: result?.data?.guard || null,
        };
      }
      ```
      Same JS-DSL → string conversion: `(coin.details "${address}")`. The `result?.status === "failure"` → `isNewAccount: true` branching MUST be preserved — `pactRead` returns the same `response.result` envelope as the raw client.
    - Pattern: [CITED] Canonical post-state pactRead+status-success unwrap at `src/interactions/activateFunctions.ts:64-71`:
      ```ts
      const pactCode = `(${KADENA_NAMESPACE}.INFO-ZERO.DALOS-INFO|URC_DeployStandardAccount "${account}")`;
      const response = await pactRead(pactCode, { tier: "T5" });
      if (response?.result?.status === "success") return (response.result as any).data;
      return null;
      ```
      This is the cleanest exemplar in the codebase for the post-state shape: build a pact-code string, await `pactRead(pactCode, { tier })`, branch on `response?.result?.status`. For T2.1's two sites: `getBalance` returns `{ account, balance: <unwrapped> }` instead of `null` on failure (preserves pre-state); `accountDescription` keeps its inline-typed object.
    - Reuse: [CITED] `src/reads/pactReader.ts:33-42` — `PactReader` type alias confirms `tier?: string` is accepted in options; `src/reads/pactReader.ts:69-74` — `pactRead(pactCode, options?)` signature.
    - Types: [CITED] `BalanceItem` interface at `src/interactions/kadenaFunctions.ts:4-7` — `{ account: string; balance: string }`. MUST stay exported (downstream consumers depend on it; Phase 1's `BalanceResolver` flattens to just the string but `getBalance` keeps the wrapped form).
    - File-level imports to prune: [CITED] Verified via `grep -nE "Pact|createClient|getPactUrl" src/interactions/kadenaFunctions.ts` — all current usages are at lines 1-2 (imports) + 10-11 (Pact.builder + Pact.modules in getBalance) + 16 (createClient + getPactUrl in getBalance) + 30-31 (Pact.builder + Pact.modules in accountDescription) + 36 (createClient + getPactUrl in accountDescription). After migration, ZERO non-import usages remain → all three of `Pact`, `createClient`, `getPactUrl` can be pruned. `KADENA_CHAIN_ID` and `KADENA_NETWORK` (lines 12-13, 32-33 in pre-state) become unused once `setMeta`/`setNetworkId` go away → prune both. Net result: imports collapse to `import { pactRead } from "../reads";` only.
    - Approach: [LOCKED] Per locked tier mappings: `getBalance` → tier T1, `accountDescription` → tier T5. No `pactUrl`/`chainId` options needed (uses global default chain — both functions did so in pre-state via `KADENA_CHAIN_ID` constant).
    - Context7: skip — `@kadena/client` API is stable and the migration target is the in-repo `pactRead` seam, not an external library.
  - notes:

- [x] T2.2 | Migrate the four read sites in `src/interactions/wrapFunctions.ts` (`getWrapStoaInfo`, `getWrapperPaymentKey`, `getPaymentKeyBalance`, `getWrapUrStoaInfo`) to `pactRead` and prune unused imports | bee-implementer
  - requirements: [REQ-09, REQ-12, REQ-13]
  - acceptance:
    - `import { pactRead } from "../reads"` is added to `src/interactions/wrapFunctions.ts`.
    - The four read sites at lines 48, 72, 96, 244 (pre-state) route through `pactRead` at the locked tiers:
      - `getWrapStoaInfo` (line 48 site) → tier T2.
      - `getWrapperPaymentKey` (line 72 site) → tier T5.
      - `getPaymentKeyBalance` (line 96 site) → tier T1.
      - `getWrapUrStoaInfo` (line 244 site) → tier T2.
    - Every Pact code template literal is preserved verbatim — no whitespace, namespace, or string-interpolation drift. The `formatDecimalForPact(amount)` calls and the `${KADENA_NAMESPACE}.INFO-ONE.LIQUID|...` / `${KADENA_NAMESPACE}.DALOS.UR_AccountKadena` / `(try 0.0 (coin.get-balance "${paymentKeyAddress}"))` shapes survive exactly.
    - Each function's return contract is preserved: `getWrapStoaInfo` and `getWrapUrStoaInfo` return `(response.result as any).data` on success and `null` on failure (caught by the function's outer try/catch, which is preserved); `getWrapperPaymentKey` returns `String(...data)` or `null`; `getPaymentKeyBalance` keeps its number-vs-decimal-vs-string branching and returns `null` on failure.
    - Sim-before-submit pairs are NOT touched: the destructure at line 190 (inside `executeWrapStoa`'s `dirtyRead, submit` pair) and the destructure at line 305 (inside `executeWrapUrStoa`'s `dirtyRead, submit` pair) remain on the raw client.
    - Unused imports pruned per grep: `Pact` and `createClient` from `@kadena/client` are removed only if no remaining code path in the file references them — note that `executeWrapStoa` and `executeWrapUrStoa` still build transactions and use `createClient`, so these imports are retained. `getPactUrl` is similarly retained because the sim-before-submit pairs still use it. `KADENA_CHAIN_ID`, `KADENA_NETWORK`, `KADENA_NAMESPACE`, `STOA_AUTONOMIC_OURONETGASSTATION`, `STOA_AUTONOMIC_LIQUIDPOT` all stay (used elsewhere in file).
    - Implementer pastes the literal output of `grep -nE "dirtyRead" src/interactions/wrapFunctions.ts` into the task notes; output must show only the two sim-before-submit sites (around lines 190 and 305). The four migrated sites no longer reference `dirtyRead`.
    - `npm run typecheck` passes.
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-09, REQ-12, REQ-13 (reader seam adoption block).
    - `D:\_Claude\OuronetCore\src\interactions\wrapFunctions.ts` -- pre-state file. Migration sites at lines 48, 72, 96, 244; sim-before-submit pairs at lines 190 and 305 (NOT touched). Imports block at lines 6-19.
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- `pactRead` API and option keys.
    - `D:\_Claude\OuronetCore\src\interactions\activateFunctions.ts` -- status-success unwrap pattern reused at every migrated site (lines 60-71).
    - `D:\_Claude\OuronetCore\src\interactions\dexFunctions.ts` -- T2 / T5 tier exemplars (lines 227, 250, 289, 1620).
    - `D:\_Claude\OuronetCore\src\interactions\infoOneFunctions.ts` -- T2 preview-pattern exemplar referenced in requirements.md Q4 for line-48 migration.
    - `D:\_Claude\OuronetCore\src\interactions\ouroFunctions.ts` -- T5 exemplar at line 168 (`UR_AccountKadena` lookup) — direct match for the line-72 migration.
  - research:
    - Pattern: [CITED] Pre-state shape #1 — `getWrapStoaInfo` at `src/interactions/wrapFunctions.ts:35-58` (read site lines 41-49):
      ```ts
      const decimalAmount = formatDecimalForPact(amount);
      const pactCode = `(${KADENA_NAMESPACE}.INFO-ONE.LIQUID|INFO_WrapStoa "${patron}" "${wrapper}" ${decimalAmount})`;
      const transaction = Pact.builder
        .execution(pactCode)
        .setNetworkId(KADENA_NETWORK)
        .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 100_000 })
        .createTransaction();
      const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
      const response = await dirtyRead(transaction);
      if (response?.result?.status === "success") {
        return (response.result as any).data;
      }
      return null;
      ```
      Wrapped in outer `try { ... } catch (error) { console.error(...); return null; }` (lines 40-57). Post-state collapses to `const pactCode = ...; const response = await pactRead(pactCode, { tier: "T2" }); if (response?.result?.status === "success") return (response.result as any).data; return null;` — outer try/catch preserved verbatim.
    - Pattern: [CITED] Pre-state shape #2 — `getWrapperPaymentKey` at `src/interactions/wrapFunctions.ts:64-82` (read site lines 66-77):
      ```ts
      const pactCode = `(${KADENA_NAMESPACE}.DALOS.UR_AccountKadena "${wrapper}")`;
      const transaction = Pact.builder
        .execution(pactCode)
        .setNetworkId(KADENA_NETWORK)
        .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 50_000 })
        .createTransaction();
      const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
      const response = await dirtyRead(transaction);
      if (response?.result?.status === "success") {
        return String((response.result as any).data);
      }
      return null;
      ```
      Direct match to `src/interactions/ouroFunctions.ts:165-175` (`getKadenaAccountOwner`) which already uses `pactRead(..., { tier: "T5" })` for the SAME `${KADENA_NAMESPACE}.DALOS.UR_AccountKadena` Pact code. Mirror that exemplar exactly — same tier (T5).
    - Pattern: [CITED] Pre-state shape #3 — `getPaymentKeyBalance` at `src/interactions/wrapFunctions.ts:88-108` (read site lines 90-104):
      ```ts
      const pactCode = `(try 0.0 (coin.get-balance "${paymentKeyAddress}"))`;
      const transaction = Pact.builder
        .execution(pactCode)
        .setNetworkId(KADENA_NETWORK)
        .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 50_000 })
        .createTransaction();
      const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
      const response = await dirtyRead(transaction);
      if (response?.result?.status === "success") {
        const data = (response.result as any).data;
        if (typeof data === "number") return data;
        if (data?.decimal !== undefined) return parseFloat(data.decimal);
        return parseFloat(String(data));
      }
      return null;
      ```
      Three-way data branch (number → decimal-object → fallback string parse) MUST be preserved verbatim. Tier T1 (live balance).
    - Pattern: [CITED] Pre-state shape #4 — `getWrapUrStoaInfo` at `src/interactions/wrapFunctions.ts:231-254` (read site lines 237-249) — structurally identical to `getWrapStoaInfo` but invokes `INFO_WrapUrStoa` instead of `INFO_WrapStoa`. Same outer try/catch + same tier T2.
    - Sim-before-submit pairs (NOT touched): [CITED] `src/interactions/wrapFunctions.ts:190` — `const { dirtyRead, submit } = createClient(getPactUrl(KADENA_CHAIN_ID));` inside `executeWrapStoa` (lines 125-224). Pre-state lines 192-208 destructure both `dirtyRead` (used for sim) and `submit` (used after gas calibration). Line 305 — same shape inside `executeWrapUrStoa` (lines 269-end-of-function). These two destructures MUST remain — they are legitimate sim-before-submit pairs per requirements.md REQ-09 NOT-touched list.
    - Reuse: [CITED] `src/interactions/activateFunctions.ts:60-71` is the canonical T5 unwrap pattern — direct match for `getWrapperPaymentKey`. `src/interactions/dexFunctions.ts:289` (`getSWPairDashboardInfo`) uses tier T2 with the `if (response?.result?.status === "success") ... else return null;` shape — direct match for `getWrapStoaInfo` and `getWrapUrStoaInfo`.
    - Imports that stay (verified): [CITED] `src/interactions/wrapFunctions.ts:6` `import { Pact, createClient } from "@kadena/client"` — RETAINED. Both still referenced by `executeWrapStoa`'s `Pact.builder` (lines 133-188) and `executeWrapUrStoa`'s `Pact.builder` (lines 276-303) and the two `createClient(getPactUrl(...))` calls at lines 190 and 305. `src/interactions/wrapFunctions.ts:8-15` `import { ..., getPactUrl, ... } from "../constants"` — RETAINED for the same two sim-before-submit sites. `KADENA_CHAIN_ID`, `KADENA_NETWORK`, `KADENA_NAMESPACE`, `STOA_AUTONOMIC_OURONETGASSTATION`, `STOA_AUTONOMIC_LIQUIDPOT` all retained (used by execute-paths). NET CHANGE: only ADD `import { pactRead } from "../reads";` — no prunes.
    - Types: [CITED] `WrapStoaParams` (lines 113-123), `WrapUrStoaParams` (lines 258-267), `IKadenaKeypair` (line 19, type-only re-export from `../signing`) all preserved.
    - Approach: [LOCKED] Tier mappings per locked decisions: getWrapStoaInfo → T2, getWrapperPaymentKey → T5, getPaymentKeyBalance → T1, getWrapUrStoaInfo → T2. No `pactUrl`/`chainId` options (uses global default chain).
    - Context7: skip — same rationale as T2.1.
  - notes:

- [x] T2.3 | Migrate the nine read sites in `src/interactions/addLiquidityFunctions.ts` (URC_LD / UEV_Liquidity / URC_BalancedLiquidity / URC_SortLiquidity / UR_IzFrozenLP / UR_IzSleepingLP) to `pactRead` and prune unused imports | bee-implementer
  - requirements: [REQ-10, REQ-12, REQ-13]
  - acceptance:
    - `import { pactRead } from "../reads"` is added to `src/interactions/addLiquidityFunctions.ts`.
    - The nine read sites at lines 102, 138, 208, 253, 271, 853, 878, 902, 928 (pre-state) route through `pactRead` at the locked tiers:
      - Line 102 (`generateLiquidityData` — URC_LD) → tier T2.
      - Line 138 (`validateLiquidityDeviation` — UEV_Liquidity) → tier T2.
      - Line 208 (`calculateBalancedLiquidity` — URC_BalancedLiquidity) → tier T2.
      - Line 253 (`getLPTypeInfo` Promise.all IIFE #1 — UR_IzFrozenLP) → tier T7.
      - Line 271 (`getLPTypeInfo` Promise.all IIFE #2 — UR_IzSleepingLP) → tier T7.
      - Line 853 (`getBalancedLiquidity` — URC_BalancedLiquidity helper) → tier T2.
      - Line 878 (`getSortLiquidity` — URC_SortLiquidity) → tier T2.
      - Line 902 (`getLiquidityData` — URC_LD helper) → tier T2.
      - Line 928 (`validateLiquidity` — combined-let UEV_Liquidity) → tier T2.
    - The `Promise.all` IIFE structure inside `getLPTypeInfo` is preserved exactly. Each IIFE retains its inner try/catch and the `response?.result?.status === "success" ? response.result.data === true : false` evaluation. The dead outer try/catch around `getLPTypeInfo`'s `Promise.all` is NOT touched (separate audit-spec).
    - Every Pact code template literal is preserved verbatim — `${KADENA_NAMESPACE}.SWPL.URC_LD ...`, `${KADENA_NAMESPACE}.SWPL.UEV_Liquidity ...`, `${KADENA_NAMESPACE}.SWPL.URC_BalancedLiquidity ...`, `${KADENA_NAMESPACE}.SWP.UR_IzFrozenLP ...`, `${KADENA_NAMESPACE}.SWP.UR_IzSleepingLP ...`, `${KADENA_NAMESPACE}.SWPL.URC_SortLiquidity ...`, and the multi-line `let` form at line 924. `JSON.stringify(liquidityData)` interpolation, the decimal-suffix logic (`amountStr.includes('.') ? amountStr : ${amountStr}.0`), and the `withValidation` boolean interpolation all survive.
    - Each function's return contract is preserved: success and failure paths unwrap exactly the way the pre-state does (success-status unwrap, failure-throw, `null`-return, `{ valid: false }` short-circuit, deviation-regex-match, etc.).
    - Submit, listen, and poll sites are NOT touched: lines 336, 412, 442, 494, 551, 604, 798, 988, 1060 (per requirements.md REQ-10) remain on the raw client.
    - Unused imports pruned per grep: `Pact` and `createClient` from `@kadena/client` and `getPactUrl` from `../constants` are retained — the file's many `executeAddLiquidity*` / `executeFuel` / etc. submit paths still use them. The reads-only prune is therefore a no-op for this file's import block; implementer documents this in notes.
    - Implementer pastes the literal output of `grep -nE "dirtyRead" src/interactions/addLiquidityFunctions.ts` into the task notes; output must show only the submit-site `{ dirtyRead, submit }` destructures from REQ-10's NOT-touched list.
    - `npm run typecheck` passes.
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-10, REQ-12, REQ-13 (reader seam adoption block).
    - `D:\_Claude\OuronetCore\src\interactions\addLiquidityFunctions.ts` -- pre-state file. Migration sites at lines 102, 138, 208, 253, 271, 853, 878, 902, 928. Submit/listen/poll sites at 336, 412, 442, 494, 551, 604, 798, 988, 1060 (NOT touched). Imports block at lines 1-12.
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- `pactRead` API and option keys.
    - `D:\_Claude\OuronetCore\src\interactions\activateFunctions.ts` -- status-success unwrap pattern reused at every migrated site.
    - `D:\_Claude\OuronetCore\src\interactions\dexFunctions.ts` -- T2 / T7 tier exemplars (lines 289 for T2 URC_*, line 1500 for T7 describe-module pattern referenced in requirements.md Q4 for the LP-flag migrations).
  - research:
    - Line-number verification (HEAD): [CITED] All 9 read-site `dirtyRead` destructures verified at `src/interactions/addLiquidityFunctions.ts` lines 102, 138, 208, 253, 271, 853, 878, 902, 928. All 9 NOT-touched submit/listen/poll sites verified at lines 336, 412, 442, 494, 551, 604, 798, 988, 1060.
    - Pattern: [CITED] Site 1 — `generateLiquidityData` at `addLiquidityFunctions.ts:82-119` (read at 93-113):
      ```ts
      const transaction = Pact.builder
        .execution(`(${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" "${input}" ${pactAmounts})`)
        .setNetworkId(KADENA_NETWORK)
        .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 150_000 })
        .createTransaction();
      const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
      const response = await dirtyRead(transaction);
      if (!response || !response.result) throw new Error("Failed to generate liquidity data...");
      if (response.result.status === "failure") throw new Error(...);
      return response.result.data as LiquidityData;
      ```
      Pact-code template: `(${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" "${input}" ${pactAmounts})`. Tier T2. The throw-on-failure branching MUST be preserved.
    - Pattern: [CITED] Site 2 — `validateLiquidityDeviation` at `addLiquidityFunctions.ts:124-180` (read at 129-139). Pact-code: `(${KADENA_NAMESPACE}.SWPL.UEV_Liquidity "${swpair}" ${JSON.stringify(liquidityData)})`. Tier T2. Failure branch parses error message via `errorMessage.match(/(\d+\.?\d*)\s*deviation.*maximum.*?(\d+\.?\d*)/)` regex — preserve.
    - Pattern: [CITED] Site 3 — `calculateBalancedLiquidity` at `addLiquidityFunctions.ts:185-236` (read at 199-209). Pact-code: `(${KADENA_NAMESPACE}.SWPL.URC_BalancedLiquidity "${swpair}" "${inputTokenId}" ${pactAmount} ${withValidation})`. Tier T2. Throws on `!response || !response.result` and on `response.result.status === "failure"` — preserve. Success path uses `mayComeWithDeimal` to parse array data.
    - Pattern: [CITED] Sites 4 + 5 — `getLPTypeInfo` IIFE structure at `addLiquidityFunctions.ts:241-289` (verbatim — KEEP this scaffold including the dead outer try/catch):
      ```ts
      export async function getLPTypeInfo(swpair: string): Promise<LPTypeInfo> {
        try {
          const [frozenCheck, sleepingCheck] = await Promise.all([
            // Check for Frozen LP support
            (async () => {
              try {
                const transaction = Pact.builder
                  .execution(`(${KADENA_NAMESPACE}.SWP.UR_IzFrozenLP "${swpair}")`)
                  .setNetworkId(KADENA_NETWORK)
                  .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 50_000 })
                  .createTransaction();

                const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
                const response = await dirtyRead(transaction);

                return response?.result?.status === "success" ? response.result.data === true : false;
              } catch {
                return false;
              }
            })(),

            // Check for Sleeping LP support
            (async () => {
              try {
                const transaction = Pact.builder
                  .execution(`(${KADENA_NAMESPACE}.SWP.UR_IzSleepingLP "${swpair}")`)
                  .setNetworkId(KADENA_NETWORK)
                  .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 50_000 })
                  .createTransaction();

                const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
                const response = await dirtyRead(transaction);

                return response?.result?.status === "success" ? response.result.data === true : false;
              } catch {
                return false;
              }
            })()
          ]);

          return { hasFrozenLP: frozenCheck, hasSleepingLP: sleepingCheck };
        } catch (error) {
          return { hasFrozenLP: false, hasSleepingLP: false };
        }
      }
      ```
      Inside each IIFE, the body `Pact.builder...createTransaction(); const { dirtyRead } = createClient(...); const response = await dirtyRead(transaction);` collapses to `const response = await pactRead(pactCode, { tier: "T7" });`. The IIFE wrapper, inner try/catch, `Promise.all` destructure, and outer try/catch all stay. Pact-code: site #1 → `(${KADENA_NAMESPACE}.SWP.UR_IzFrozenLP "${swpair}")`; site #2 → `(${KADENA_NAMESPACE}.SWP.UR_IzSleepingLP "${swpair}")`. Both tier T7. The dead outer try/catch (lines 242-243 + 286-288) is Phase 8's deletion target — DO NOT touch in Phase 2.
    - Pattern: [CITED] Site 6 — `getBalancedLiquidity` at `addLiquidityFunctions.ts:844-863` (read at 850-854). Pact-code: `(${KADENA_NAMESPACE}.SWPL.URC_BalancedLiquidity "${swpair}" "${inputId}" ${amt} ${withValidation})`. Tier T2. Returns `null` on failure (no throw). Compact arrow-style function — keep return-array map intact.
    - Pattern: [CITED] Site 7 — `getSortLiquidity` at `addLiquidityFunctions.ts:869-888` (read at 875-879). Pact-code: `(${KADENA_NAMESPACE}.SWPL.URC_SortLiquidity "${swpair}" ${pactAmounts})`. Tier T2. Returns `{ balanced, asymmetric }` object on success, `null` on failure.
    - Pattern: [CITED] Site 8 — `getLiquidityData` at `addLiquidityFunctions.ts:893-907` (read at 899-903). Pact-code: `(${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" ${pactAmounts})`. Tier T2. Compact arrow style.
    - Pattern: [CITED] Site 9 — `validateLiquidity` at `addLiquidityFunctions.ts:918-941` (read at 925-929). Pact-code is the multi-line `let` form: `(let ((ld (${KADENA_NAMESPACE}.SWPL.URC_LD "${swpair}" ${pactAmounts}))) (try [false false] (${KADENA_NAMESPACE}.SWPL.UEV_Liquidity "${swpair}" ld)))` — preserve verbatim. Tier T2. Returns `{ valid: boolean, computed?, max? }` short-circuit object.
    - Sim-before-submit + submit + listen + poll sites NOT touched (verified): [CITED]
      - `addLiquidityFunctions.ts:336` — `executeAddLiquiditySingle` `{ dirtyRead, submit }` (sim-before-submit pair).
      - `addLiquidityFunctions.ts:412` — `executeAddLiquidityMultiStep1` `{ dirtyRead, submit }` (sim-before-submit pair).
      - `addLiquidityFunctions.ts:442` — `executeAddLiquidityMultiStep1` `{ listen }` (post-submit listen).
      - `addLiquidityFunctions.ts:494` — `executeAddLiquidityMultiStep2` `{ submit }` (continuation).
      - `addLiquidityFunctions.ts:551` — `executeAddLiquidityMultiStep3` `{ submit }` (continuation).
      - `addLiquidityFunctions.ts:604` — `executeAddLiquidityMultiStepComplete` `{ listen }` (step1 confirm).
      - `addLiquidityFunctions.ts:798` — `executeSpecialAddLiquidity` `{ dirtyRead, submit }` (sim-before-submit pair).
      - `addLiquidityFunctions.ts:988` — `executeFuel` `{ dirtyRead, submit }` (sim-before-submit pair).
      - `addLiquidityFunctions.ts:1060` — `executeRemoveLiquidity` `{ dirtyRead, submit }` (sim-before-submit pair).
      All nine remain on the raw `createClient(getPactUrl(KADENA_CHAIN_ID))` per REQ-10's locked NOT-touched list.
    - Reuse: [CITED] T2 tier exemplar at `src/interactions/dexFunctions.ts:289` (`getSWPairDashboardInfo`); T7 tier exemplar at `src/interactions/dexFunctions.ts:227` (`getPoolIds` — `URC_Swpairs` static module read) and line 250 (`getPrimordialPool`). Both T7 exemplars use the compact `if (response?.result?.status === "success") return ...; return null;` pattern that the post-state IIFE bodies should mirror.
    - Imports retention: [CITED] `src/interactions/addLiquidityFunctions.ts:1-12` — `Pact, createClient` (line 8) and `getPactUrl` (line 6) all RETAINED — extensive use across 9 untouched submit-site builders. Adding `import { pactRead } from "../reads"` is the ONLY import change. Implementer documents the no-prune outcome in notes.
    - Approach: [LOCKED] Tier mappings: T2 for the 7 SWPL.URC_*/UEV_* preview reads; T7 for the 2 SWP.UR_Iz* module-flag reads. No dynamic `chainId` (all reads use the global default chain).
    - Context7: skip — same rationale as T2.1.
  - notes:

- [x] T2.4 | Refactor `simulateTransaction` in `src/interactions/crossChainFunctions.ts` to a read-shaped signature using `pactRead` with dynamic chainId | bee-implementer
  - requirements: [REQ-11, REQ-13]
  - acceptance:
    - `simulateTransaction`'s signature changes from `(transaction: any, chainId: string)` to `(pactCode: string, chainId: string)`. The function continues to return `Promise<{ success: boolean; result?: any; error?: string; gas?: number }>`.
    - The body uses `await pactRead(pactCode, { pactUrl: getPactUrl(chainId), chainId, tier: "T2" })` — threading the caller-supplied chainId through to the reader options so the call honours the requested chain rather than the global default. This mirrors the post-state of `getBalanceOnChain` at lines 20-50 of the same file (the exemplar named in the spec).
    - The `{ success, result?, error?, gas? }` return envelope is preserved exactly:
      - On `result.result.status === "failure"`: returns `{ success: false, error: result.result.error?.message || "Simulation failed", result }`.
      - On success: returns `{ success: true, result, gas: result.gas }`.
      - On thrown error inside the function body: returns `{ success: false, error: <message> | "Simulation failed" }`.
    - The success-vs-failure branching matches the pre-state at lines 401-419 — only the read mechanism changes, not the envelope shape or branching.
    - The `pactRead` import already exists at the top of the file (line 4 per requirements.md REQ-12); no import changes needed for the seam itself.
    - Submit and listen sites are NOT touched: lines 216, 228, 375, 386 remain on the raw client.
    - Unused imports prune (per grep): `Pact` / `createClient` / `getPactUrl` are retained — they're used by the untouched submit and listen sites in the same file. Document this in the task notes.
    - This is a documented public-API break. The change is recorded in CHANGELOG.md (handled by T2.6) so consumers (OuronetUI, AncientHolder HUB) can update their call sites at upgrade time. Note in the task notes that consumers previously called `simulateTransaction(builtTx, chainId)` and now call `simulateTransaction(pactCodeString, chainId)`.
    - Implementer pastes the literal output of `grep -nE "simulateTransaction" src/interactions/crossChainFunctions.ts` and `grep -nE "dirtyRead" src/interactions/crossChainFunctions.ts` into the task notes — confirming the migrated site no longer destructures `dirtyRead` and the function signature is the new shape.
    - `npm run typecheck` passes.
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-11, REQ-13 (reader seam adoption block).
    - `D:\_Claude\OuronetCore\src\interactions\crossChainFunctions.ts` -- pre-state file. `simulateTransaction` at lines 393-420; `getBalanceOnChain` exemplar at lines 20-50; submit/listen sites at 216, 228, 375, 386 (NOT touched). `pactRead` already imported at line 4.
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- `pactRead` API; `PactReadOptions` type with `pactUrl` / `chainId` / `tier` / `gasLimit` keys.
    - `D:\_Claude\OuronetCore\src\interactions\activateFunctions.ts` -- canonical status-success unwrap (lines 60-71) — confirms the `result.result.status` branching shape after `pactRead`.
  - research:
    - Pattern: [CITED] Pre-state body of `simulateTransaction` at `src/interactions/crossChainFunctions.ts:393-420` — verbatim:
      ```ts
      export async function simulateTransaction(
        transaction: any,
        chainId: string
      ): Promise<{ success: boolean; result?: any; error?: string; gas?: number }> {
        try {
          const { dirtyRead } = createClient(getPactUrl(chainId));
          const result = await dirtyRead(transaction);

          if (result.result.status === "failure") {
            return {
              success: false,
              error: result.result.error?.message || "Simulation failed",
              result,
            };
          }

          return {
            success: true,
            result,
            gas: result.gas,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Simulation failed",
          };
        }
      }
      ```
      The signature, envelope, and branching are unchanged in post-state EXCEPT:
      1. First parameter renamed `transaction: any` → `pactCode: string` (the locked public-API break).
      2. The two lines `const { dirtyRead } = createClient(getPactUrl(chainId)); const result = await dirtyRead(transaction);` collapse to `const result = await pactRead(pactCode, { pactUrl: getPactUrl(chainId), chainId, tier: "T2" });`.
      All `result.result.status === "failure"` branching, the success/`gas` return shape, the outer try/catch, and the return-envelope type all preserve verbatim.
    - Pattern: [CITED] Post-state model — `getBalanceOnChain` at `src/interactions/crossChainFunctions.ts:20-50`:
      ```ts
      export async function getBalanceOnChain(
        account: string,
        chainId: string,
        tier: "T1" | "T2" | "T3" = "T1"
      ): Promise<{ balance: string; exists: boolean; error?: string }> {
        try {
          const pactCode = `(coin.get-balance "${account}")`;
          const response = await pactRead(pactCode, {
            pactUrl: getPactUrl(chainId),
            chainId,
            tier,
          });
          // ...
        }
      }
      ```
      This is the dynamic-chainId exemplar: caller-supplied `chainId` flows through `pactUrl: getPactUrl(chainId), chainId, tier` into the reader. `simulateTransaction` post-state mirrors lines 27-31 exactly with hardcoded `tier: "T2"`.
    - Reuse: [CITED] `pactRead` already imported at `crossChainFunctions.ts:4` — `import { pactRead } from "../reads";`. ZERO import changes for this task.
    - Submit/listen sites NOT touched (verified): [CITED]
      - `crossChainFunctions.ts:216` — `submitCrossChainTransfer` `{ submit } = createClient(getPactUrl(sourceChain))`.
      - `crossChainFunctions.ts:228` — `pollTransactionStatus` `{ pollOne } = createClient(getPactUrl(chainId))`.
      - `crossChainFunctions.ts:375` — `submitContinuation` `{ submit } = createClient(getPactUrl(targetChain))`.
      - `crossChainFunctions.ts:386` — `listenForCompletion` `{ listen } = createClient(getPactUrl(chainId))`.
      All four MUST remain unchanged per REQ-11 NOT-touched list.
    - Imports retention: [CITED] `crossChainFunctions.ts:1-5` — `Pact, createClient, ITransactionDescriptor` (line 1) and `getPactUrl, getSpvUrl, GAS_STATION, KADENA_NAMESPACE, KADENA_NETWORK` (line 2) all RETAINED. `Pact.builder` is used in `buildCrossChainTransfer` (lines 88+) and `buildContinuationTransaction` (lines 346+). `createClient` is used by the four NOT-touched submit/listen/poll sites. `getPactUrl` is used by both `simulateTransaction`'s post-state (passes through to options) and the NOT-touched sites. NO import changes.
    - Consumer call sites of `simulateTransaction`: [CITED] `grep -rn "simulateTransaction" src/` returns ONE hit — the export declaration itself at `src/interactions/crossChainFunctions.ts:393`. ZERO in-tree consumers in `src/`. All consumers are downstream: OuronetUI (browser SPA) and AncientHolder HUB (Node.js server). The public-API break therefore has zero internal blast radius — only the CHANGELOG documentation matters for consumer migration. Note in T2.4's task notes: "Consumers previously called `simulateTransaction(builtTx, chainId)`; now call `simulateTransaction(pactCodeString, chainId)`. The pact-code string was already constructed earlier in their flow (it's the `.execution(...)` argument); they just hold onto it instead of building a transaction."
    - Approach: [LOCKED] Tier T2 (preview/simulate semantics) per locked decision. The dynamic `chainId` thread-through is the key behavioural difference from T2.1/T2.2/T2.3 (which all use the global default chain).
    - Context7: skip — same rationale as T2.1; the post-state pattern is already in the same file at line 20.
  - notes:

## Wave 2 (depends on Wave 1 — regression test imports the migrated functions)

- [x] T2.5 | Add the behavioural regression test at `tests/interactions-read-seam.test.ts` that exercises every migrated function via a counting stub installed through `setPactReader` | bee-implementer | needs: T2.1, T2.2, T2.3, T2.4
  - requirements: [REQ-14]
  - acceptance:
    - `tests/interactions-read-seam.test.ts` is created at the top-level `tests/` directory, picked up automatically by the existing `vitest.config.ts` glob.
    - The test file's top-level JSDoc names audit finding F-CORE-006 and lists the 16 original site references (file:line for each). It explains that the test exists to catch silent drift back to a direct Kadena client call at any of those sites.
    - The test imports `setPactReader` and `getPactReader` from the `../src/reads` BARREL (matching the convention of all 13 existing test files — e.g. `tests/network.test.ts:9` uses `from "../src/network"` not `from "../src/network/nodeFailover"`). Do NOT import via the deep-path `../src/reads/pactReader` form. The migrated functions are imported from their per-file paths (no barrel for `src/interactions/*`):
      - From `src/interactions/kadenaFunctions`: `getBalance`, `accountDescription`.
      - From `src/interactions/wrapFunctions`: `getWrapStoaInfo`, `getWrapperPaymentKey`, `getPaymentKeyBalance`, `getWrapUrStoaInfo`.
      - From `src/interactions/addLiquidityFunctions`: `generateLiquidityData`, `validateLiquidityDeviation`, `calculateBalancedLiquidity`, `getLPTypeInfo`, `getBalancedLiquidity`, `getSortLiquidity`, `getLiquidityData`, `validateLiquidity`.
      - From `src/interactions/crossChainFunctions`: `simulateTransaction`.
    - The test installs a counting stub via `setPactReader((pactCode, options) => { calls.push({ pactCode, options }); return Promise.resolve({ result: { status: "success", data: <stub-shape> }, gas: 0, ... }); })` in a `beforeEach` block, restoring the original reader in `afterEach`. The stub returns a response shape compatible with each migrated function's unwrap path (e.g. `{ result: { status: "success", data: "0" } }` for `coin.get-balance`-shaped reads, `{ result: { status: "success", data: { ... } } }` for object-shaped reads, etc.).
    - Each migrated function gets its own `it()` block that:
      - Calls the function with stub-friendly arguments (e.g. a placeholder address, a placeholder swpair, a placeholder `pactCodeString` for `simulateTransaction`).
      - Asserts the counting stub was invoked at least once during the call.
      - Asserts the call recorded a `tier` option matching the locked tier mapping for that function (T1 / T2 / T5 / T7). **Tier values MUST be hardcoded in the test file directly from the Phase Goal block's locked tier mapping (lines 18-27 of this TASKS.md), NOT read from the Wave-1 task `notes:` blocks.** The Goal block is the authoritative source of truth; reading from notes risks propagating an implementer's mistake at a Wave-1 site through to a self-consistent green test that masks the regression.
    - Minimum 15 it-blocks total (one per migrated FUNCTION listed above; `getLPTypeInfo` exercises both T7 sites in one call, so it counts as one block but the test asserts the stub was invoked **exactly twice** for that block — using `expect(stubFn).toHaveBeenCalledTimes(2)` (vi.fn) OR `expect(calls.length).toBe(2)` (hand-rolled array). The exact-count assertion is required because each IIFE inside `getLPTypeInfo`'s `Promise.all` wraps its body in a `try { ... } catch { return false; }` block — a `>= 2` assertion would mask a missing call if one IIFE throws before reaching `pactRead` and is silently caught by its inner `try/catch`.).
    - The test does NOT use `node:fs.readFileSync` + regex on source text. The v1.7.0 source-text approach was rejected and is forbidden.
    - Each test's stub-input shape is documented inline so future maintainers understand what response envelope the migrated function expects.
    - `npx vitest run tests/interactions-read-seam.test.ts` passes (scoped run for this file).
    - `npm run typecheck` passes.
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-14 (quality gates and regression guard block).
    - Wave 1 dependency notes: read T2.1 / T2.2 / T2.3 / T2.4 `notes:` blocks before authoring assertions — confirm the exact tier passed at each call site (the test's tier-assertion step depends on this). Locked tier mappings per the phase Goal: T2.1 → T1+T5; T2.2 → T2/T5/T1/T2; T2.3 → 7×T2 + 2×T7; T2.4 → T2 (with dynamic chainId + pactUrl options).
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- `setPactReader` / `getPactReader` API the test uses to install the counting stub.
    - `D:\_Claude\OuronetCore\src\reads\rawCalibratedRead.ts` -- the default reader the `afterEach` restoration must reset to.
    - `D:\_Claude\OuronetCore\tests\network.test.ts` -- vitest convention reference (top-level `tests/`, `describe`/`it`, `beforeEach`/`afterEach`, `vi.fn()`, async assertions).
    - `D:\_Claude\OuronetCore\vitest.config.ts` -- glob configuration; confirms the new file is auto-picked up.
  - research:
    - File existence: [CITED] `tests/interactions-read-seam.test.ts` does NOT exist — `Glob tests/interactions-read-seam.test.ts` returns "No files found". Existing test files in `tests/`: cfm-builders, codex-codec, dalos-integration, encryption, encryption-upgrade, gas, guard, network, pact-format, signing, smart-account-auth, strategy, types — 13 total. The new file is the 14th and adds a single new `describe` block by contract.
    - API pattern: [CITED] `setPactReader` / `getPactReader` API at `src/reads/pactReader.ts:52-63`:
      ```ts
      export function setPactReader(reader: PactReader): void {
        _reader = reader;
      }

      export function getPactReader(): PactReader {
        return _reader;
      }
      ```
      `PactReader` shape at `src/reads/pactReader.ts:33-42` — `(pactCode: string, options?: { pactUrl?: string; chainId?: string; tier?: string; skipTempWatcher?: boolean; [key: string]: unknown }) => Promise<any>`. Default reader is `rawCalibratedDirtyRead` (line 44). Test's `afterEach` restores by calling `setPactReader(rawCalibratedDirtyRead)` or by saving `getPactReader()` in `beforeAll` and restoring it.
    - Vitest stub patterns: [CITED] `tests/network.test.ts:7-9` — imports `import { describe, it, expect, beforeEach, vi } from "vitest";`. `tests/network.test.ts:147-153` — counting-stub example: `const fn = vi.fn().mockResolvedValue("ok"); ... expect(fn).toHaveBeenCalledTimes(1); expect(fn).toHaveBeenCalledWith(...);`. `tests/network.test.ts:27-29` — `beforeEach(() => { setNodeConfig("node2"); });` (state-reset pattern). For T2.5, the equivalent is `beforeEach(() => { calls = []; setPactReader(stub); }); afterEach(() => { setPactReader(rawCalibratedDirtyRead); });`. Use either `vi.fn()` for built-in spy/call recording OR a hand-rolled `const calls: Array<{pactCode, options}> = []` array — the latter is more readable for this multi-call assertion.
    - The 15 migrated functions to test: [CITED]
      - `kadenaFunctions.ts` exports: `getBalance` (line 9, tier T1), `accountDescription` (line 29, tier T5). Stub data: `getBalance` expects `{ result: { status: "success", data: "0" } }` (or `{ decimal: "0" }` to exercise the decimal-unwrap branch); `accountDescription` expects `{ result: { status: "success", data: { balance, account, guard } } }`.
      - `wrapFunctions.ts` exports: `getWrapStoaInfo` (line 35, tier T2), `getWrapperPaymentKey` (line 64, tier T5), `getPaymentKeyBalance` (line 88, tier T1), `getWrapUrStoaInfo` (line 231, tier T2). Stub data: `getWrapperPaymentKey` expects string data; `getPaymentKeyBalance` expects number/decimal; the two `*Info` expect arbitrary `data` object.
      - `addLiquidityFunctions.ts` exports: `generateLiquidityData` (line 82, tier T2), `validateLiquidityDeviation` (line 124, tier T2), `calculateBalancedLiquidity` (line 185, tier T2), `getLPTypeInfo` (line 241, tiers T7+T7 — 2 calls), `getBalancedLiquidity` (line 844, tier T2), `getSortLiquidity` (line 869, tier T2), `getLiquidityData` (line 893, tier T2), `validateLiquidity` (line 918, tier T2). `getLPTypeInfo` is the special block that asserts `calls.length >= 2` because of `Promise.all`.
      - `crossChainFunctions.ts` exports: `simulateTransaction` (line 393, tier T2 + dynamic chainId). Test asserts both `tier === "T2"` AND `options.chainId === <provided-chain>` AND `options.pactUrl === getPactUrl(<provided-chain>)`.
    - Reuse: [CITED] Stub-shape catalog by function (from acceptance + pre-state code):
      - `coin.get-balance` shape (`getBalance`, `getPaymentKeyBalance`): `{ result: { status: "success", data: "0" } }` (or `{ decimal: "0" }` for the decimal-object branch).
      - `coin.details` shape (`accountDescription`): `{ result: { status: "success", data: { balance: "0", account: "k:abc", guard: { keys: ["pub"], pred: "keys-all" } } } }`.
      - `UR_AccountKadena` shape (`getWrapperPaymentKey`): `{ result: { status: "success", data: "k:abc" } }`.
      - `URC_LD` (`generateLiquidityData`, `getLiquidityData`): `{ result: { status: "success", data: { /* arbitrary LiquidityData */ } } }`.
      - `UEV_Liquidity` (`validateLiquidityDeviation`, `validateLiquidity`): `{ result: { status: "success", data: ["0.01", "0.05"] } }` (the `[deviation, max]` array form).
      - `URC_BalancedLiquidity` (`calculateBalancedLiquidity`, `getBalancedLiquidity`): `{ result: { status: "success", data: ["1.0", "2.0"] } }`.
      - `URC_SortLiquidity` (`getSortLiquidity`): `{ result: { status: "success", data: { balanced: ["1.0"], asymmetric: ["0.5"] } } }`.
      - `UR_IzFrozenLP` / `UR_IzSleepingLP` (`getLPTypeInfo`): `{ result: { status: "success", data: false } }`.
      - `simulateTransaction`: `{ result: { status: "success", data: { /* arbitrary simulation result */ } }, gas: 100 }` (mirrors the two-level envelope of all other stubs — the post-state body reads `result.result.status` AND `result.result.data` per the locked T2.4 body, so the stub must include `data` alongside `status`).
    - Forbidden pattern: [CITED] Per phase locked-decision and v1.7.0 review precedent — the test does NOT use `import { readFileSync } from "node:fs"; const src = readFileSync(...); expect(src).toMatch(/createClient/);`. Behavioural assertion via the seam stub is the only acceptable approach.
    - Approach: [LOCKED] Tier-assertion step is mandatory (catches drift in the tier value, which downstream caching depends on). Test must use real exported function references — never re-implement migrated logic for assertion.
    - Context7: skip — vitest patterns are unambiguous and the in-repo exemplars cover all needed conventions.
  - notes:

## Wave 3 (depends on Wave 2 — documentation + final exit gate)

- [x] T2.6 | Document the public-API break and the wallet edge-cut closure in CHANGELOG.md, and capture build-graph verification evidence | bee-implementer | needs: T2.1, T2.2, T2.3, T2.4, T2.5
  - requirements: [REQ-13, REQ-17]
  - acceptance:
    - `CHANGELOG.md` gains a new entry at the top following the file's existing version-heading convention. The entry documents:
      - **Phase 1 carry-over (from prior CHANGELOG draft):** the wallet → interactions edge cut, the new `BalanceResolver` injection seam on `KadenaWallet`, and the behavioural impact (mildly breaking) note about the removed `?? "0"` silent fallback in `getBalance()`. **If T1.5 from Phase 1 already left a placeholder entry at the top of `CHANGELOG.md`, T2.6 EDITS THAT ENTRY IN PLACE — do NOT insert a second top-of-file entry.** The Phase 2 changes (sixteen-site reader-seam adoption + simulateTransaction signature break) APPEND to the existing entry's narrative body and `### Public API impact` bullet list. The result is exactly ONE placeholder/version section above `## 1.7.0 — 2026-04-30`.
      - **Phase 2 changes:** sixteen pure-read sites in `src/interactions/*` migrated to the `pactRead` injection seam at locked tiers (T1 / T2 / T5 / T7); `simulateTransaction`'s signature changes from `(transaction, chainId)` to `(pactCode, chainId)` — **this is a breaking public-API change**; consumer migration steps are spelled out (replace the pre-built transaction object argument with the Pact code string used to build it).
      - A `### Public API impact` subsection mirroring the v1.7.0 voice — bullet list of "Type widening", "Behavioural impact", "Breaking change", with the specific symbol affected.
    - Version number left as a placeholder — release coordinator decides minor vs major when tagging. Both Phase 1 (non-breaking widening + mildly-breaking behavioural shift) and Phase 2 (breaking signature change on `simulateTransaction`) are noted so the coordinator can pick the appropriate bump.
    - `npm run build` is executed and emits a clean `dist/`. Implementer pastes the tail of `npm run build` output into the task notes (the `tsc -p tsconfig.build.json` line followed by a clean exit).
    - Manual build-graph verification: implementer runs the **import-graph-only regex** `grep -nE "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/*.js` (or its ripgrep equivalent `rg -E "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/`) and pastes the literal output. Output must show **zero hits** — confirming the wallet subpath of the published distribution no longer transitively requires `dist/interactions/*` files. The narrow regex is required because TypeScript preserves JSDoc by default (no `removeComments: true` in `tsconfig.build.json`), and Phase 1 T1.1's `BalanceResolver` JSDoc deliberately mentions "interactions" to document what the seam replaces — a substring grep would produce a false positive on the JSDoc text. This implicitly closes the loop on Phase 1's edge cut (REQ-17 is the joint exit gate).
    - The verification command is added to a "Release ceremony" note in CHANGELOG.md (or a comment in `package.json`'s scripts section) so the next release coordinator knows to re-run it on each tag.
    - **CLAUDE.md count flip:** Now that Phase 2's reader-seam adoption sweeps all 16 sites onto the `pactRead` seam, T2.6 also flips the architectural-pattern subsection of `CLAUDE.md` from "Two narrow injection points" to "Three narrow injection points" (the count Phase 1 T1.5 deferred to this point). The third bullet (added additively in T1.5) was already in place; T2.6 only updates the narrative count text on `CLAUDE.md:43` so the count agrees with the bullet list. This is the orphaned follow-up that completes the doc-accuracy contract spanning both phases.
    - `npm run typecheck` passes.
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-13, REQ-17 (quality gates block).
    - Wave 1 + Wave 2 dependency notes: T2.1, T2.2, T2.3, T2.4 (the changelog describes their post-state — read each task's `notes:` block for the actual prune-vs-retain outcome per file). T2.5 (the regression guard is mentioned in the changelog as the new safety net).
    - `D:\_Claude\OuronetCore\CHANGELOG.md` -- existing entry style at lines 1-50 is the formatting reference. If Phase 1's T1.5 left a placeholder draft entry, edit in place.
    - `D:\_Claude\OuronetCore\package.json` -- `scripts` section; `npm run build` runs `tsc -p tsconfig.build.json`.
    - `D:\_Claude\OuronetCore\.github\workflows\publish.yml` -- the existing release ceremony reference; the build-graph grep is documented as a manual addition that runs before tagging.
    - Phase 1 dependency: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\phases\01-wallet-edge-cut\TASKS.md` -- read T1.5's `notes:` block to confirm whether a Phase 1 changelog draft already exists; consolidate if so.
  - research:
    - Pattern: [CITED] CHANGELOG.md current top entry at `CHANGELOG.md:1-58` — header is `# Changelog\n\nAll notable changes to \`@stoachain/ouronet-core\`.` (lines 1-3) followed by version sections starting `## X.Y.Z — YYYY-MM-DD` at line 5. The most recent FINALISED entry is `## 1.7.0 — 2026-04-30` (the IKadenaKeypair consolidation). Per Phase 1's T1.5 plan, the implementer was instructed to "insert new entry directly under line 3 (above the most recent `## 1.7.0` at line 5)" — confirm at execute time whether that entry already landed by reading the current `CHANGELOG.md:5-X` (Phase 1 status not yet visible in this research pass).
    - Pattern: [CITED] CHANGELOG entry shape at `CHANGELOG.md:5-58` (the v1.7.0 entry — voice reference for T2.6):
      - Line 5: `## 1.7.0 — 2026-04-30` (version-date heading).
      - Line 7: bold one-line summary — `**Consolidate \`IKadenaKeypair\` to a single canonical declaration.**`.
      - Lines 9-39: multi-paragraph narrative body — explains the WHY (audit finding closure, behaviour preserved, blast radius).
      - Line 41: `### Public API impact` subsection.
      - Lines 43-57: bullet list with bold-prefixed labels — `**Type widening (intentional):**`, `**Type tightening (intentional, mildly breaking):**`, `**No runtime behaviour change.**`, `**Deprecated copy preserved.**`.
      - Line 59: `### Changed` (file-level diff list).
      - Line 78: `### Added` (new files).
      - Line 89: `### Process notes`.
      Mirror this voice EXACTLY for the new entry. T2.6 needs `### Public API impact` with FOUR bullets (1× wallet-edge type widening, 1× wallet-edge behavioural shift, 1× simulateTransaction signature break, 1× reader-seam-adoption non-breaking).
    - Phase 1 carry-over: [CITED] Phase 1's T1.5 (`phases/01-wallet-edge-cut/TASKS.md:158`) is titled "Update CLAUDE.md and CHANGELOG.md to record the new wallet injection seam" and its research note (line 178-182) explicitly says: "insert new entry directly under line 3 (above the most recent `## 1.7.0 — 2026-04-30` at line 5). Use a bold-summary-first / multi-paragraph-narrative / `### Public API impact` body shape." T2.6 either consolidates with the T1.5 draft (if it landed) or creates a single combined entry covering both phases (if T1.5 was deferred). The "Approach: [LOCKED]" note at T1.5 line 182 — "do NOT bump `package.json` version in this phase" — applies to T2.6 too.
    - Reuse: [CITED] `package.json:3` — current version is `"version": "1.7.0"`. `package.json:76-83` — `scripts.build` is `tsc -p tsconfig.build.json`; `scripts.typecheck` is `tsc --noEmit`; no separate verification script exists (the build-graph grep is a manual command added in T2.6's "Release ceremony" note).
    - Approach: [LOCKED] Per phase locked decision: "Version number left as a placeholder for the release coordinator." Use `## Unreleased — TBD` or `## X.Y.Z — YYYY-MM-DD` as the heading. The release coordinator picks the version (likely a major bump because of `simulateTransaction`'s breaking signature change).
    - Context7: skip — markdown CHANGELOG conventions are stable and the in-repo style guide is unambiguous.
  - notes:

- [x] T2.7 | Final exit-gate validation: full typecheck + full test suite + build emit a clean distribution | bee-implementer | needs: T2.1, T2.2, T2.3, T2.4, T2.5, T2.6
  - requirements: [REQ-15, REQ-16, REQ-17]
  - acceptance:
    - `npm run typecheck` passes with zero errors. Implementer pastes the tail of the output (the `tsc --noEmit` line followed by a clean exit) into the task notes.
    - `npm test` passes the full vitest suite. Implementer pastes the test runner's summary line (e.g. `Test Files  N passed (N) | Tests  M passed (M)`) into the task notes. The standing v1.7.0 `tests/types.test.ts` regression-lock continues to fire with the expected pass count (no regressions vs baseline).
    - The new test count delta is ~+15 it-blocks from `tests/interactions-read-seam.test.ts` (one per migrated function); baseline ~322 → new ~337+ matches the requirements.md non-functional note (which says "~352+" but only when combined with the broader behavioural-test surface in the high-test-coverage spec — this phase contributes only the ~+15 from the regression guard).
    - `npm run build` emits a clean `dist/` (re-run after T2.6's verification or relied on T2.6's evidence; document which).
    - Verification: implementer runs the **import-graph-only grep** `grep -nE "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/*.js` and confirms zero hits. Note: a substring grep `grep "interactions" dist/wallet/*.js` is INCORRECT here because TypeScript preserves JSDoc comments by default in `tsconfig.build.json` (no `removeComments: true`), and Phase 1's T1.1 deliberately includes the word "interactions" in `BalanceResolver`'s JSDoc to document what the seam replaces. The narrow regex matches only `from "..."` and `require("...")` import-graph references — precisely what REQ-17's "no transitive dependency" invariant requires.
    - Any failures here trigger a fix cycle on the offending migrated file's task (T2.1–T2.5) — this gate must be green before phase completion is claimed.
  - context:
    - Spec section: `D:\_Claude\OuronetCore\.bee\specs\2026-04-30-arch-layering-and-seams\spec.md` -- REQ-15, REQ-16, REQ-17 (quality gates block).
    - All Wave 1 + Wave 2 + T2.6 notes: read each prior task's `notes:` block to know what was actually changed. T2.7 is read/run-only — no source edits.
    - `D:\_Claude\OuronetCore\package.json` -- `scripts` section; the four commands invoked.
    - `D:\_Claude\OuronetCore\tests\types.test.ts` -- v1.7.0 regression-lock; must continue firing.
    - `D:\_Claude\OuronetCore\.github\workflows\ci.yml` -- mirrors the same gate sequence (typecheck → test → build); local pass implies CI pass.
  - research:
    - Build emit shape: [CITED] `npm run build` runs `tsc -p tsconfig.build.json` (per `package.json:77`). Existing `dist/` (verified via `ls dist/`) contains 13 subdirectories matching `src/` layout: `codex/`, `constants/`, `crypto/`, `dalos/`, `errors/`, `gas/`, `guard/`, `interactions/`, `network/`, `pact/`, `reads/`, `signing/`, `wallet/`, plus root-level `index.js` (341 bytes — confirms the near-empty barrel) and `index.d.ts` (11 bytes). After T2.6's edits + T2.1-T2.4's source changes, a clean `dist/` rebuild should produce the same shape with updated `dist/interactions/*.js` content (the migrated functions) and unchanged `dist/wallet/*.js` content (Phase 1 already cut the edge in T1.2).
    - Build-graph verification: [CITED] Manual command — **import-graph-only regex** `grep -nE "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/*.js`. The narrow regex matches only `from "..."` and `require("...")` import statements, NOT JSDoc comments. This is required because TypeScript preserves JSDoc by default (verified at `dist/wallet/KadenaWallet.js:5` — current build retains the JSDoc text), and Phase 1 T1.1's `BalanceResolver` JSDoc deliberately mentions "interactions" to document what the seam replaces. After Phase 1's T1.2 edge cut, `dist/wallet/KadenaWallet.js` should no longer contain any `import "../interactions/..."` line. The grep returns zero hits. Phase 2's reader-seam adoption does NOT change wallet's import graph (Phase 1 already cut it); T2.7's grep is therefore a re-confirmation of Phase 1's exit gate AFTER Phase 2's rebuild — joint REQ-17 check. Equivalent ripgrep: `rg -E "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/`. Empty stdout + exit code 1 (grep) or 0/no-results (rg) is the success signal.
    - Test count baseline: [CITED] `tests/` directory contains 13 files pre-Phase-2 (verified via `Glob tests/*.test.ts`). T2.5 adds the 14th file with ~15 it-blocks (one per migrated function). The phase locked decision says `~322 → ~337+` total tests; the +15 delta is the test-count signal.
    - v1.7.0 regression lock: [CITED] `tests/types.test.ts` is the type-level regression lock added in v1.7.0 (per `CHANGELOG.md:80-87`); `vitest.config.ts:9` includes it via `typecheck: { enabled: true, tsconfig: "tsconfig.tests.json", include: ["tests/types.test.ts"] }`. T2.7 must confirm the lock continues to fire — visible as part of the standard `npm test` summary line.
    - Reuse: [CITED] `.github/workflows/ci.yml` mirrors the local exit gate (typecheck → test → build, per CLAUDE.md "Common commands"). A green local run implies CI green.
    - Approach: [LOCKED] T2.7 is read/run-only — no source edits. Failures cascade back to the offending T2.x for a fix cycle (per the acceptance criterion "Any failures here trigger a fix cycle on the offending migrated file's task"). The grep can use either GNU `grep` or `rg` — both are documented as acceptable in the spec.
    - Context7: skip — `tsc` and `vitest` CLI behaviour is stable and version-pinned in `package.json`.
  - notes:

## Requirement Coverage

| REQ-ID | Description | Tasks |
|--------|-------------|-------|
| REQ-07 | `kadenaFunctions.getBalance` migrated to `pactRead` at tier T1 | T2.1 |
| REQ-08 | `kadenaFunctions.accountDescription` migrated to `pactRead` at tier T5 | T2.1 |
| REQ-09 | Four `wrapFunctions` reads migrated at locked tiers; sim-before-submit untouched | T2.2 |
| REQ-10 | Nine `addLiquidityFunctions` reads migrated at locked tiers; IIFE shape preserved; submit/listen/poll untouched | T2.3 |
| REQ-11 | `simulateTransaction` refactored to read-shaped signature with dynamic chainId | T2.4 |
| REQ-12 | `pactRead` import added to the three files that lacked it | T2.1, T2.2, T2.3 |
| REQ-13 | Unused imports pruned per file based on grep | T2.1, T2.2, T2.3, T2.4, T2.6 |
| REQ-14 | Behavioural regression-guard test exercising every migrated function via counting stub | T2.5 |
| REQ-15 | TypeScript typecheck passes | T2.7 (final gate); also folded into per-task acceptance |
| REQ-16 | Full test suite passes; v1.7.0 types-shape regression-lock continues to fire | T2.7 |
| REQ-17 | Build emits a clean dist; manual `grep "interactions" dist/wallet/*.js` returns zero hits | T2.6, T2.7 |

All eleven requirements scoped to Phase 2 are covered. REQ-15 / REQ-16 fire as exit gates per the phases.md description; per-task acceptance criteria also include scoped typecheck/test runs so individual tasks fail fast rather than only at the final gate.

## File Ownership Map (Pass 2 conflict-detection record)

| Wave | Task | Writes | Conflict? |
|------|------|--------|-----------|
| 1 | T2.1 | `src/interactions/kadenaFunctions.ts` | none |
| 1 | T2.2 | `src/interactions/wrapFunctions.ts` | none |
| 1 | T2.3 | `src/interactions/addLiquidityFunctions.ts` | none |
| 1 | T2.4 | `src/interactions/crossChainFunctions.ts` | none |
| 2 | T2.5 | new `tests/interactions-read-seam.test.ts` | none (new file) |
| 3 | T2.6 | `CHANGELOG.md` (read-only on `dist/wallet/*.js`) | none |
| 3 | T2.7 | (no writes — runs commands, pastes evidence) | none |

Zero file conflicts detected. Wave 1 is fully parallel across four disjoint `src/interactions/*` files. Wave 3 pairs T2.6 (CHANGELOG.md write) with T2.7 (read/run-only) — disjoint footprints.

## Fragmentation Note

7 tasks across 3 waves yields an average of 2.33 tasks/wave (below the 2.5 consolidation target → `warn`). The single-task Wave 2 (T2.5) cannot be merged into Wave 1: T2.5 imports the migrated functions from all four Wave 1 files and asserts the seam stub fires per call site — it has a genuine sequential dependency on T2.1, T2.2, T2.3, T2.4 landing first. T2.5 also cannot be merged into Wave 3 because T2.6's CHANGELOG narrative references the regression-guard test as the new safety net (forward dependency on T2.5 existing). The 1-task wave is therefore a deliberate sequencing artefact, not a fragmentation defect.
