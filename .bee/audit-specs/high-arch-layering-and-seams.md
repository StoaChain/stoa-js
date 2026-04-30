[ARCH-FIX] Restore subpath layering and adopt the pactRead injection seam

## Problem
Two architectural commitments documented in CLAUDE.md and the README are partially undone in the live code:

1. **Backwards layering: `wallet/` imports from `interactions/`.** `KadenaWallet.getBalance()` reaches into `../interactions/kadenaFunctions`. `wallet` is a leaf module by intent — anything consuming `@stoachain/ouronet-core/wallet` for HD-key derivation should not pull in `@kadena/client`, every constant, and the entire interactions tree. Today it does, defeating the subpath-only consumer pattern.
2. **`pactRead` injection seam bypassed.** `src/reads/pactReader.ts` exists exactly so consumers (OuronetUI in browser, HUB on server) can plug in a single reader with caching/dedup/batching. ~16 PURE READ sites in `interactions/*` still call `createClient(getPactUrl(...)).dirtyRead(tx)` directly, bypassing the seam. (~21 additional `dirtyRead` calls are sim-before-submit and legitimately bypass — keep them out of this fix.) The Smart-Swap-flicker bug the seam was created to fix is partially still present.

## Findings (2)
| ID | Severity | Title |
|---|---|---|
| F-CORE-005 | HIGH | Wallet → interactions backwards layering |
| F-CORE-006 | HIGH | `pactRead` seam bypassed by ~16 pure-read call sites |

## Locations

### Fix 1 — Wallet layering (1 line)
- `src/wallet/KadenaWallet.ts:14` — the offending import

### Fix 2 — `pactRead` seam adoption (16 sites)
| File | Lines |
|---|---|
| `src/interactions/kadenaFunctions.ts` | 16, 36 |
| `src/interactions/wrapFunctions.ts` | 48, 72, 96, 244 |
| `src/interactions/addLiquidityFunctions.ts` | 101, 137, 207, 252, 270, 852, 877, 901, 927 |
| `src/interactions/crossChainFunctions.ts` | 398 |

(Counts confirmed by integration-checker; architecture-auditor's earlier 37-count incorrectly included sim-before-submit sites.)

## Required Fixes

### Fix 1 — Drop the `wallet → interactions` edge
Three options, in increasing order of invasiveness:

A. **Remove `getBalance` from `KadenaWallet`.** Make balance fetching the consumer's responsibility — they call `interactions/kadenaFunctions.getBalance(wallet.address)` directly. Cleanest; smallest blast radius; consumers using `wallet.balance` need updating.

B. **Inject a `getBalance` callback at construction.** `KadenaWallet` accepts a `(address: string) => Promise<string>` resolver. Default to a no-op throw; consumers wire the real resolver. Keeps the method on the class for ergonomics, removes the import.

C. **Move the inline `getBalance` into a small `network/balance.ts` helper** that doesn't pull in the rest of `interactions`. Possible but creates a sibling tree to maintain.

Recommendation: option B. Matches the existing `setPactReader`/`KeyResolver` pluggable-seam pattern in this codebase.

### Fix 2 — Convert the 16 sites to `pactRead`
Each site follows the same pattern:
```ts
// Before (bypasses seam):
const transaction = Pact.builder.execution(pactCode)
  .setNetworkId(KADENA_NETWORK)
  .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: READ_SIM_GAS_LIMIT })
  .createTransaction();
const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));
const response = await dirtyRead(transaction);

// After (uses seam):
const response = await pactRead(pactCode, { tier: "T?" });
```

Pick the tier per the canonical mapping (T1=balance, T2=preview, T7=very-static metadata). Match the tier used by neighbouring reads in the same file. Cross-check against any tier convention OuronetUI's reader applies.

PR-time guard: grep `src/interactions/` for `createClient(getPactUrl` after the change. Every remaining hit must be a sim-before-submit pair (i.e. the same destructure also pulls `submit`). Anything pulling only `dirtyRead` is a regression.

### Coordination note
Fix 2 here interacts with the `[RELIABILITY-FIX]` spec — that spec adds timeouts and `withFailover` wiring across reads. If the reliability fix lands first, the 16 read sites will have to be re-touched here to pass the seam. Sequence: land THIS spec first, then the reliability spec wraps `pactRead` once at the seam level (single edit) instead of touching 16 call sites.

## Acceptance Criteria

### Wallet layering
- [ ] `src/wallet/KadenaWallet.ts:14` no longer imports from `../interactions/*`.
- [ ] `KadenaWallet` either removes `.getBalance()` or accepts a balance resolver via constructor.
- [ ] If a resolver pattern is chosen: a default-throw resolver is used so existing tests fail loudly rather than silently.
- [ ] `npm run typecheck` passes.

### Seam adoption
- [ ] Each of the 16 cited call sites converted to `pactRead(pactCode, { tier: "T?" })`.
- [ ] No new `createClient(getPactUrl(...)).dirtyRead(...)` calls remain in `interactions/*` outside of sim-before-submit pairs.
- [ ] The PR adds a comment-only test (or grep-based CI check) that fails if a future `dirtyRead`-only call sneaks back into `interactions/*`.

### Both
- [ ] `npm test` passes with zero regressions.
- [ ] The bundle-size impact of dropping the `wallet → interactions` edge is verified by building `dist/` and checking `dist/wallet/index.js` no longer transitively requires `dist/interactions/*` files (review the import graph).
