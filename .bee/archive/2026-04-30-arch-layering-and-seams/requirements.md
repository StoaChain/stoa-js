# Requirements: arch-layering-and-seams

## Initial Description

Close audit findings F-CORE-005 (HIGH — wallet → interactions backwards layering) and F-CORE-006 (HIGH — pactRead injection seam bypassed by ~16 pure-read call sites) in `@stoachain/ouronet-core`. Two architectural commitments documented in CLAUDE.md and the README are partially undone in the live code; this spec restores them. Source: `.bee/audit-specs/high-arch-layering-and-seams.md`.

## Requirements Discussion

This spec was generated via `/bee:new-spec --from-discussion .bee/audit-specs/high-arch-layering-and-seams.md`. The audit-spec locks the scope; discovery filled in the implementation-route decisions and tier mappings.

### Source File (authoritative)

- `.bee/audit-specs/high-arch-layering-and-seams.md` — finding-by-finding acceptance criteria for F-CORE-005 and F-CORE-006.

### Questions & Answers (discovery)

**Q1: Use the audit-spec as the starting point?**
A1: Yes — Fix 1 (wallet edge) and Fix 2 (16 sites → pactRead) are locked. Discovery filled in the route choices.

**Q2: Fix 1 — which of the three options (A: remove, B: resolver injection, C: extract to network/balance)?**
A2: **Option B — resolver injection.** `KadenaWallet` accepts a `(address: string) => Promise<string>` balance resolver via constructor; the default throws so existing tests fail loudly rather than silently. Matches the existing `setPactReader` and `KeyResolver` pluggable-seam pattern in this codebase.

**Q3: Fix 2 site #16 (`crossChainFunctions.ts:398`) is structurally different — `simulateTransaction` receives a pre-built transaction object, not a `pactCode` string. How to handle?**
A3: **Refactor `simulateTransaction`'s signature** from `(transaction: any, chainId: string)` to `(pactCode: string, chainId: string)`. This is a public-API break that consumers (OuronetUI / AncientHolder HUB) handle at their call sites — the `simulateTransaction` wrapper was overly generic; making it read-shaped is cleaner. Per strict-semver discipline, this requires a minor or major version bump (will be resolved at release time based on whether other audit-specs in this batch include their own breaking changes).

**Q4: Tier mappings — lock per research's exemplar-grounded suggestions or leave to implementer?**
A4: **Lock per research.** Each of the 16 sites gets a tier choice grounded in a neighbouring exemplar:
- `kadenaFunctions.ts:16` (getBalance) → **T1** (matches `crossChainFunctions.ts:27` `getBalanceOnChain`)
- `kadenaFunctions.ts:36` (accountDescription) → **T5** (matches `dexFunctions.ts:1620` `URD_OwnedSwapPairs`; account-state read)
- `wrapFunctions.ts:48` (INFO_WrapStoa preview) → **T2** (matches `infoOneFunctions.ts` preview pattern)
- `wrapFunctions.ts:72` (UR_AccountKadena lookup) → **T5** (direct match `ouroFunctions.ts:168`)
- `wrapFunctions.ts:96` (coin.get-balance for paymentKey) → **T1** (live balance)
- `wrapFunctions.ts:244` (INFO_WrapUrStoaInfo preview) → **T2** (mirrors line-48 sibling)
- `addLiquidityFunctions.ts:102, 138, 208, 853, 878, 902, 928` (URC_LD / UEV_Liquidity / URC_BalancedLiquidity / URC_SortLiquidity — input-driven preview reads) → **T2** (matches `dexFunctions.ts:289` `URC_*` reads; 7 sites)
- `addLiquidityFunctions.ts:253, 271` (UR_IzFrozenLP, UR_IzSleepingLP — pool-capability flags) → **T7** (very-static module metadata; matches `dexFunctions.ts:1500` describe-module pattern; 2 sites)
- `crossChainFunctions.ts:398` (simulateTransaction post-refactor) → **T2** (preview/simulate semantics)

**Q5: Regression guard for F-CORE-006 — vitest behavioral test, CI grep step, or both?**
A5: **Vitest behavioral test.** `tests/interactions-read-seam.test.ts` uses `setPactReader` to install a counting stub, calls each migrated read function, and asserts the stub was invoked. Behavioral (catches runtime regressions, not source-text drift), runs locally with `npm test`, no `node:fs.readFileSync` + regex pattern (the v1.7.0 attempt at a source-text test was rejected). Avoids the maintenance overhead of dual guards.

**Q6: Implementation mode?**
A6: **Premium** — matches project default (`.bee/config.json:5`). Opus throughout planning + implementation + review.

### Existing Code to Reference

- `src/wallet/KadenaWallet.ts:14` — the offending `from "../interactions/kadenaFunctions"` import (Fix 1 target).
- `src/wallet/KadenaWallet.ts:48-52` — `getBalance()` method body (Fix 1 refactor target).
- `src/wallet/index.ts` — barrel; impacts surface analysis.
- `src/reads/pactReader.ts:33-74` — `pactRead(pactCode, options)` signature + `setPactReader` API. Exemplar for the resolver-seam pattern Fix 1 mirrors.
- `src/reads/pactReader.ts:52-63` — `setPactReader`/`getPactReader` API for the regression-guard test.
- `src/reads/rawCalibratedRead.ts:33-62` — default pact reader (uses `READ_SIM_GAS_LIMIT = 10_000_000`).
- `src/signing/types.ts:46-70` — `KeyResolver` interface — Option B template (3-method interface, optional method, held on instance, injected via constructor).
- `src/signing/types.ts:83-86` — `PactClient` narrow-shape interface — second seam-pattern exemplar.
- `src/interactions/kadenaFunctions.ts:9-46` — current pre-state for both `getBalance` (line 16) and `accountDescription` (line 36).
- `src/interactions/wrapFunctions.ts:41-108, 237-253` — current pre-state for the 4 wrap-flow reads.
- `src/interactions/addLiquidityFunctions.ts:90-300, 845-935` — current pre-state for the 9 liquidity reads.
- `src/interactions/crossChainFunctions.ts:393-420` — current pre-state for `simulateTransaction` (Fix 2 site 16).
- `src/interactions/crossChainFunctions.ts:20-50` — `getBalanceOnChain` post-state exemplar (T1 with dynamic chainId; pattern for site 16's refactored body).
- `src/interactions/activateFunctions.ts:11, 60-71` — canonical `pactRead` import path and status-success unwrap pattern.
- `src/interactions/dexFunctions.ts:227, 250, 289, 1500, 1620` — tier exemplars (T7 / T2 / T5).
- `src/network/nodeFailover.ts:104` — `withFailover` exists but is NOT yet wired (intentionally — the reliability-fix spec wraps it later).
- `tests/network.test.ts` — vitest pattern reference.
- `vitest.config.ts` — picks up `tests/**/*.test.ts`.
- `.github/workflows/ci.yml` — `npm test` gates merges (vitest regression guard runs here automatically).

## Visual Assets

No visual assets provided. This is a code-only refactor; the library has no UI surface.

## Implementation Mode

`premium` — opus throughout planning + implementation + review. Project default in `.bee/config.json:5`.

## Requirements Summary

### Functional Requirements

#### F-CORE-005 — Wallet → interactions edge cut (Fix 1)
- [x] **REQ-01:** Drop the import at `src/wallet/KadenaWallet.ts:14` (`from "../interactions/kadenaFunctions"`). After this change, `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` returns zero hits — broadened pattern catches static `from "..."`, dynamic `import("...")`, AND bare side-effect `import "..."` forms.
- [x] **REQ-02:** Add a `BalanceResolver` interface to `src/wallet/types.ts` (or `src/wallet/KadenaWallet.ts` if a separate types file is overkill): `(address: string) => Promise<string>`. Document the contract in JSDoc: returns the balance as a decimal string, or "0" when the account does not exist on chain.
- [x] **REQ-03:** `KadenaWallet`'s constructor accepts an optional `balanceResolver?: BalanceResolver` parameter. The resolver is stored as a **publicly mutable instance property** `balanceResolver: BalanceResolver` so consumers can either inject at construction OR assign post-construction (e.g. `wallet.balanceResolver = myResolver`). Default value is a function that throws `Error("KadenaWallet: balanceResolver not configured. Inject one via the constructor or set wallet.balanceResolver before calling getBalance().")` — default-throw pattern so existing tests fail loudly rather than silently returning a fabricated value.
- [x] **REQ-04:** `KadenaWallet.getBalance()` method is preserved (`Promise<string>` return; updates `this.balance`). Body now invokes the injected resolver instead of importing `getBalance` from `interactions/kadenaFunctions`. Failure path: when the resolver throws (the default-throw or a consumer error), propagate the error — do NOT silently fallback to "0".
- [x] **REQ-05:** The `interactions/kadenaFunctions` barrel keeps exporting `getBalance` for its existing external consumers — Fix 1 only stops the wallet from importing it, does NOT delete the function.
- [x] **REQ-06:** `KadenaWalletBuilder` (if it exists in `src/wallet/`) propagates the optional `balanceResolver` parameter so wallet construction through the builder also accepts the resolver.

#### F-CORE-006 — pactRead seam adoption (Fix 2)
- [x] **REQ-07:** Convert `src/interactions/kadenaFunctions.ts` line 16 (`getBalance`) from `createClient(getPactUrl(KADENA_CHAIN_ID)).dirtyRead(...)` to `pactRead(pactCode, { tier: "T1" })`. Preserve the `(coin.get-balance "${address}")` Pact form and the response-shape unwrap (BalanceItem `{ account, balance }`).
- [x] **REQ-08:** Convert `src/interactions/kadenaFunctions.ts` line 36 (`accountDescription`) from `createClient(...).dirtyRead(...)` to `pactRead(pactCode, { tier: "T5" })`. Preserve the `(coin.details ...)` Pact form and the inline-typed object-literal return shape.
- [x] **REQ-09:** Convert `src/interactions/wrapFunctions.ts` 4 sites at lines 48 (`getWrapStoaInfo`, T2), 72 (`getWrapperPaymentKey`, T5), 96 (`getPaymentKeyBalance`, T1), 244 (`getWrapUrStoaInfo`, T2). Preserve every Pact code template literal verbatim (Pact-string injection hardening is a separate audit-spec, not this one). Sim-before-submit destructures at lines 190 and 305 are NOT touched.
- [x] **REQ-10:** Convert `src/interactions/addLiquidityFunctions.ts` 9 sites at lines 102 (URC_LD, T2), 138 (UEV_Liquidity, T2), 208 (URC_BalancedLiquidity, T2), 253 (UR_IzFrozenLP, T7), 271 (UR_IzSleepingLP, T7), 853 (URC_BalancedLiquidity helper, T2), 878 (URC_SortLiquidity, T2), 902 (URC_LD helper, T2), 928 (combined-let UEV_Liquidity, T2). The two LP-capability flags at 253 and 271 sit inside `getLPTypeInfo`'s Promise.all-with-IIFEs structure — preserve the IIFE shape (the dead outer try/catch is a separate audit-spec's deletion target). Submit/listen/poll sites at lines 336, 412, 442, 494, 551, 604, 798, 988, 1060 are NOT touched.
- [x] **REQ-11:** Refactor `src/interactions/crossChainFunctions.ts` `simulateTransaction` from `(transaction: any, chainId: string)` → `(pactCode: string, chainId: string)`. Body becomes `await pactRead(pactCode, { pactUrl: getPactUrl(chainId), chainId, tier: "T2" })`. Preserve the `{ success, result?, error?, gas? }` return envelope shape and the failure-vs-success branching. Submit/listen sites at lines 216, 228, 375, 386 are NOT touched.
- [x] **REQ-12:** Add `import { pactRead } from "../reads"` to the three files that don't yet import it: `kadenaFunctions.ts`, `wrapFunctions.ts`, `addLiquidityFunctions.ts`. (`crossChainFunctions.ts` already imports it at line 4.)
- [x] **REQ-13:** After the conversion, prune unused imports from the four files: drop `Pact` and/or `createClient` from `@kadena/client` imports if they are no longer used; drop `getPactUrl` from `../constants` imports if unused. `KADENA_CHAIN_ID` and `KADENA_NETWORK` may still be needed for other code paths in the file — only drop them if grep shows zero in-file usage.

#### Both fixes — quality gates and regression guard
- [x] **REQ-14:** Add a vitest behavioral regression-guard test at `tests/interactions-read-seam.test.ts`. The test uses `setPactReader` to install a counting stub; it imports each of the 12 migrated FUNCTIONS (not files): `getBalance` and `accountDescription` from `kadenaFunctions`; `getWrapStoaInfo`, `getWrapperPaymentKey`, `getPaymentKeyBalance`, `getWrapUrStoaInfo` from `wrapFunctions`; `generateLiquidityData`, `validateLiquidityDeviation`, `getLPTypeInfo`, `getBalancedLiquidity`, `getSortLiquidity`, `getLiquidityData`/`validateLiquidity` (whichever is the public surface for the 9 sites) from `addLiquidityFunctions`; `simulateTransaction` from `crossChainFunctions`. Each function gets its own `it()` block that calls the function with stub-friendly arguments and asserts the counting stub was invoked at least once. **One it-block per migrated function** — minimum ~12 it-blocks total (the exact count depends on the addLiquidity public surface, which the implementer determines from the file's exports). The test does NOT use `node:fs.readFileSync` + regex on source text (that pattern was rejected in v1.7.0 review). The test is documented with a one-paragraph JSDoc explaining what regression it protects against (F-CORE-006) with file:line references for each of the 16 sites.
- [x] **REQ-15:** `npm run typecheck` passes after both fixes.
- [x] **REQ-16:** `npm test` passes with zero regressions versus baseline (the v1.7.0 `tests/types.test.ts` regression-lock continues to fire).
- [x] **REQ-17:** `npm run build` emits a clean `dist/`. Manual verification: `grep "interactions" dist/wallet/*.js` returns zero hits — `dist/wallet/index.js` no longer transitively requires `dist/interactions/*` files.

### Non-Functional Requirements

- **Backward-compat delta documented.** Fix 1 changes `KadenaWallet`'s constructor signature (adds optional `balanceResolver` parameter) — non-breaking widening since the parameter is optional. Fix 2 site 16 (`simulateTransaction`) IS a public-API break (signature change from `(transaction, chainId)` → `(pactCode, chainId)`). The release ceremony documents both in the CHANGELOG; the version bump (minor or major) is determined at release time based on whether any other audit-spec in the v1.7.0+ batch is also breaking.
- **Sequencing constraint (locked).** This spec MUST land before the reliability-fix spec (`.bee/audit-specs/high-reliability-failover.md`). The reliability spec wraps `pactRead` once at the seam level — landing this spec first means the failover wrap is a single edit instead of touching 16 call sites.
- **Pact-string injection NOT in scope.** Fix 2 preserves every Pact code template literal verbatim. Hardening user-controlled strings (the `pactString` validator) is `.bee/audit-specs/high-security-crypto-and-injection.md` — explicitly out of scope here.
- **`withFailover` NOT wired here.** Only `pactRead` adoption — failover wrapping is the next spec.
- **Bundle-size verification.** Manual `grep "interactions" dist/wallet/*.js` post-build confirms the wallet subpath no longer transitively requires `interactions`.
- **Test count delta.** Current ~322 tests grow by one new test file (`interactions-read-seam.test.ts`) with at least 4 it-blocks (one per migrated file). New test count: ~326+. The v1.7.0 regression-lock continues to fire.

### Reusability Opportunities

- `setPactReader`/`pactRead` injection-seam pattern (`src/reads/pactReader.ts:33-74`) is the exemplar for Fix 1's `BalanceResolver` injection.
- `KeyResolver`/`PactClient` interfaces (`src/signing/types.ts:46-86`) are the exemplar for the `BalanceResolver` interface shape.
- `getBalanceOnChain` (`src/interactions/crossChainFunctions.ts:20-50`) is the post-state exemplar for the `simulateTransaction` refactor body (dynamic chainId via `pactUrl: getPactUrl(chainId), chainId, tier`).
- `activateFunctions.ts:64-71` (status-success unwrap) is the canonical pattern reused across all 16 conversions.

### Scope Boundaries

**In scope:**
- F-CORE-005 (wallet → interactions edge cut, Option B resolver injection).
- F-CORE-006 (16 read-only call sites converted to `pactRead`).
- 1 vitest behavioral regression-guard test.
- 4 file edits in `src/interactions/*` plus 1 in `src/wallet/`.
- 1 manual build-graph verification.

**Out of scope:**
- F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-008 (reliability — separate spec, lands AFTER this one).
- F-CORE-007 (fabricated-fallback BREAKING — separate spec).
- F-CORE-009, F-CORE-010 (security/Pact-string injection — separate spec).
- F-CORE-011, F-CORE-012 (test coverage critical surfaces — separate spec).
- F-CORE-013 onward (codex/guard/medium/low — separate specs).
- Changes to submit/listen/poll call sites (they remain on raw client; reliability spec wraps them later).
- Tier-conventions JSDoc for `pactReader.ts` (that's a low-improvements task; this spec just uses the conventions).
- `safeCreationTime` consolidation (separate medium-spec).
- New behavioral tests beyond the regression guard (broader behavioral coverage is `.bee/audit-specs/high-test-coverage-critical-surfaces.md`).

### Technical Considerations

- **Constraint #1 (locked):** Sequencing — this spec lands before the reliability-fix spec. Confirmed by audit-spec coordination note.
- **Constraint #2 (locked):** Fix 1 uses Option B (resolver injection), not Option A (remove) or Option C (extract).
- **Constraint #3 (locked):** Fix 2 site 16 (`simulateTransaction`) refactors the signature.
- **Constraint #4 (locked):** Tier mappings are pinned per research.
- **Constraint #5 (locked):** Regression guard is a vitest behavioral test, not source-text regex.
- **Public-API impact:** REQ-03 widens (optional constructor param, non-breaking). REQ-11 breaks (`simulateTransaction` signature). Both ride the next version release; CHANGELOG documents both.
- **Bundle impact:** The wallet subpath drops its transitive dependency on `interactions/*` (which pulls `@kadena/client` and the constants tree). Verified manually post-build.
- **No new dependencies.** Every requirement is satisfiable with what's already in `package.json`.
