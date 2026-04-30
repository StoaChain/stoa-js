# Audit Report — @stoachain/ouronet-core

**Project:** `@stoachain/ouronet-core`
**Date:** 2026-04-30
**Audited by:** BeeDev Audit System
**Stack:** typescript-library
**Audit Scope:** 65 source files (52 src + 12 tests + 1 vitest.config.ts)

---

## Audit Metadata

| Item | Value |
|------|-------|
| Project root | `D:/_Claude/OuronetCore` |
| Stack profile | `typescript-library` |
| Total files in scope | 65 (src 52, tests 12, vitest.config.ts 1) |
| Audit agents run | 7 |
| Audit agents skipped | 3 |
| Raw findings produced | 107 |
| Findings CONFIRMED | 97 |
| Findings FALSE POSITIVE | 5 |
| Findings NEEDS CONTEXT | 5 |
| Validation rate | 95.3% (102/107 conclusive) |
| False-positive rate | 4.7% |

### Agents Run

| Agent | Status | Findings |
|-------|--------|----------|
| security-auditor | run | 17 |
| error-handling-auditor | run | 25 |
| architecture-auditor | run | 13 |
| performance-auditor | run | 11 |
| testing-auditor | run | 12 |
| audit-bug-detector | run | 12 |
| integration-checker | run | 11 |

### Agents Skipped (poor fit for stack)

| Agent | Reason |
|-------|--------|
| frontend-auditor | No UI surface — pure library |
| database-auditor | No DB layer — chain reads only |
| api-auditor | No HTTP API — library exports |

### Validator Reconciliation Notes

- The architecture-auditor's `pactRead` bypass count (37 sites) was reduced by validator + integration-checker reconciliation to **~16 pure-read sites**. The other 21 are sim-before-submit calls in `executeX` paths that legitimately bypass the cache (re-running the seam for each submit would duplicate the network call).
- `IKadenaKeypair` duplication count was raised from architecture-auditor's "5 occurrences" to **6 occurrences** after integration-checker found a non-exported in-file copy in `coilFunctions.ts`.

---

## Executive Summary

| Severity | Total | Confirmed | False Positive | Needs Context |
|----------|-------|-----------|----------------|---------------|
| CRITICAL | 1 | 1 | 0 | 0 |
| HIGH | 11 | 11 | 0 | 0 |
| MEDIUM | 14 | 14 | 3 | 3 |
| LOW | 6 | 6 | 2 | 2 |
| **Total** | **32** | **32** | **5** | **5** |

The "Total" row reflects post-merge finding count. **97 raw findings** were consolidated into **32 distinct issues** because many auditors reported the same root cause from different angles (see Merges section in this report's appendix).

## Risk Assessment

**Risk Level: HIGH**

The library is functionally correct in the happy path but carries structural risks that compound under multi-tenant or concurrent use:

1. **Type duplication** — `IKadenaKeypair` is declared 6 times across `signing/` and `interactions/*`, with 4 undocumented exported duplicates. Drift between copies is now a runtime hazard, not a hypothetical one.
2. **Failover wiring is incomplete** — the `withFailover` wrapper exists but isn't called from any submit path; `rawCalibratedDirtyRead` defaults to a static `PACT_URL` constant, ignoring the active failover host entirely.
3. **Error-handling consistency** — fabricated fallback values (1.0 USD, 0% fee, 8 decimals) are swallowed silently on read failure; V1 decrypt collapses every failure into the same string regardless of cause.
4. **Test coverage gaps** — the most security-sensitive surfaces (`pactReader` injection seam, `KadenaWalletBuilder` mnemonic dispatch, `transactionErrors` classifier) are not exercised in `tests/`.

No CRITICAL exploitation path is open today, but a single CRITICAL is escalated by sheer drift surface: any future edit to one `IKadenaKeypair` won't propagate to the other five.

---

## Top 5 Priorities

| # | Finding | Severity | One-line action |
|---|---------|----------|-----------------|
| 1 | `IKadenaKeypair` declared 6× across the codebase | CRITICAL | Re-export the canonical `signing/types.ts` definition from every interactions file; delete the local copies. |
| 2 | `withFailover` is dead code; submit paths ignore it | HIGH | Wire `withFailover` around every `createClient(...).submit(...)` call site, OR document the omission and remove the export. |
| 3 | `rawCalibratedDirtyRead` defaults to static `PACT_URL` | HIGH | Replace `options?.pactUrl ?? PACT_URL` with `options?.pactUrl ?? getActivePactUrl(chainId)`. |
| 4 | Empty catches return fabricated values (1.0 USD, 0% fee, 8 decimals) | HIGH | Surface failures with a discriminated `{ ok: false, reason }` result, or accept the default + log telemetry. |
| 5 | `tests/` lacks coverage for `pactReader`, `KadenaWalletBuilder`, `transactionErrors` | HIGH | Add three test files; minimum bar is one happy + one error path each. |

---

## Critical Findings

### F-CORE-001: IKadenaKeypair declared 6 times across signing/ + interactions/*

- **Severity:** CRITICAL
- **Category:** Architecture / Type duplication
- **File:** `src/signing/types.ts` (canonical) + 5 duplicates
- **Lines:** signing/types.ts:22-30 (canonical); see "Evidence" for duplicates
- **Agent:** architecture-auditor + integration-checker (merged: F-ARCH-001 + F-INT-007 + F-INT-011)
- **Evidence Strength:** [CITED]
- **Citation:** `src/signing/types.ts:22-30`, `src/interactions/activateFunctions.ts:27-33`, `src/interactions/dexFunctions.ts:31`, `src/interactions/coilFunctions.ts:15-21`, `src/interactions/ouroFunctions.ts` (Phase-2b documented exemption), `src/interactions/guardFunctions.ts:13` (re-imports from ouroFunctions — OK).

**Description:**
The signing-ready keypair shape has six independent declarations. Only one (`signing/types.ts`) is canonical. One (`ouroFunctions.ts`) is a documented Phase-2b backwards-compat export. The other four — in `activateFunctions.ts`, `dexFunctions.ts`, `kpayFunctions.ts`, and a non-exported in-file copy inside `coilFunctions.ts` — are undocumented duplicates that consumers can import as if they were the same type.

**Evidence:**
```ts
// src/signing/types.ts:22-30 (canonical)
export interface IKadenaKeypair {
  publicKey:          string;
  privateKey:         string;
  seedType?:          "koala" | "chainweaver" | "eckowallet" | "foreign";
  encryptedSecretKey?: unknown;
  password?:          string;
}

// src/interactions/activateFunctions.ts:27-33 (drift: missing "foreign" seedType, encryptedSecretKey: any)
export interface IKadenaKeypair {
  publicKey: string;
  privateKey: string;
  seedType?: "koala" | "chainweaver" | "eckowallet";   // ← no "foreign"
  encryptedSecretKey?: any;                            // ← any, not unknown
  password?: string;
}

// src/interactions/coilFunctions.ts:15-21 (NOT exported — same drift)
interface IKadenaKeypair { ... }
```

**Impact:**
TypeScript treats the duplicates as structurally compatible today (they all share `{publicKey, privateKey}`), but the moment any one copy adds a required field — or any consumer narrows on `seedType === "foreign"` — the drift becomes a runtime / compile error that can land silently on a partial migration. The `coilFunctions.ts` non-exported copy is the most dangerous: it's invisible to "find all references" tools so editors of `signing/types.ts` won't see it.

**Suggested Fix:**
1. Delete the local declarations in `activateFunctions.ts`, `dexFunctions.ts`, `kpayFunctions.ts`, `coilFunctions.ts`.
2. Replace with `import type { IKadenaKeypair } from "../signing/types";` (or `from "../signing"` once the barrel exports it).
3. Keep the `ouroFunctions.ts` copy if Phase-2b consumers still import it from there, but add a `@deprecated — re-export from signing/types` JSDoc and a TODO to land the cleanup in v2.

---

## High Findings

### F-CORE-002: withFailover is dead code — submit paths bypass it entirely

- **Severity:** HIGH
- **Category:** Reliability / Failover wiring
- **File:** `src/network/nodeFailover.ts`
- **Lines:** 104-125 (definition); 0 callers in src/
- **Agent:** error-handling + audit-bug-detector + performance + integration (merged: F-ERR-002 + F-BUG-002 + F-PERF-011 + F-ERR-018)
- **Evidence Strength:** [CITED]
- **Citation:** `src/network/nodeFailover.ts:104`, `grep "withFailover" src/` returns 1 hit (the definition). Submit sites: `src/interactions/activateFunctions.ts:182`, `src/interactions/addLiquidityFunctions.ts:335,411,797,1059`, `src/interactions/coilFunctions.ts:212`, etc.

**Description:**
`withFailover<T>(fn)` wraps a fetch/submit closure with primary→fallback retry on network errors. It is exported but never imported. Every `createClient(getPactUrl(...))` site goes through `getPactUrl`, which returns a string fixed at module init — node failover takes effect only because `getActivePactUrl` is called via `getPactUrl`'s indirection, but the `submit()` Promise itself has no retry. A primary-node 503 at submit-time fails the whole transaction with no retry on fallback.

**Evidence:**
```ts
// src/network/nodeFailover.ts:104-125 (defined, never imported)
export async function withFailover<T>(
  fn: (baseUrl: string) => Promise<T>
): Promise<T> {
  try { return await fn(getActiveBaseUrl()); }
  catch (err: any) {
    const isNetworkError = err?.message?.includes("Failed to fetch") || ...;
    if (isNetworkError && currentHost === PRIMARY_HOST) {
      switchToFallback();
      return fn(getActiveBaseUrl());  // ← retry once
    }
    throw err;
  }
}
```

**Impact:**
A primary-node hiccup during submit causes a user-visible "transaction failed" even though the fallback host is healthy. The library advertises automatic failover (see file header at `nodeFailover.ts:1-9`) but only the read-side host resolution is wired in. Submit-side failover is effectively absent.

**Suggested Fix:**
Wrap every `submit(...)` and `dirtyRead(...)` call site with `withFailover`. Two patterns work:

```ts
// Pattern A: per-call wrap (lower blast radius)
const requestKey = await withFailover((baseUrl) => {
  const { submit } = createClient(`${baseUrl}/chain/${chainId}/pact`);
  return submit(signed);
});

// Pattern B: client factory (cleaner)
function getFailoverClient(chainId: string) {
  return {
    submit:    (tx) => withFailover((b) => createClient(`${b}/chain/${chainId}/pact`).submit(tx)),
    dirtyRead: (tx) => withFailover((b) => createClient(`${b}/chain/${chainId}/pact`).dirtyRead(tx)),
  };
}
```

Note the **idempotency hazard**: blind `submit` retry can submit the same tx twice if the first attempt actually reached the chain but the response failed in transit. Guard the retry with a request-key dedup or restrict `withFailover` to read-side use only.

---

### F-CORE-003: rawCalibratedDirtyRead bypasses node failover via static PACT_URL default

- **Severity:** HIGH
- **Category:** Reliability / Failover wiring
- **File:** `src/reads/rawCalibratedRead.ts`
- **Lines:** 17, 49
- **Agent:** error-handling + integration + performance (merged: F-ERR-001 + F-INT-004 + F-PERF-005 timeout aspect)
- **Evidence Strength:** [CITED]
- **Citation:** `src/reads/rawCalibratedRead.ts:49` (`options?.pactUrl ?? PACT_URL`), `src/network/nodeFailover.ts:91-93` (`getActivePactUrl` exists and returns the failover-aware URL).

**Description:**
The default Pact URL is the static `PACT_URL` constant from `../constants`, not `getActivePactUrl(chainId)`. Result: every read that doesn't explicitly pass `pactUrl` ignores node failover entirely. The failover module's `getActivePactUrl` is the API designed exactly to plug in here, but it isn't called.

**Evidence:**
```ts
// src/reads/rawCalibratedRead.ts:17,49
import { KADENA_CHAIN_ID, KADENA_NETWORK, PACT_URL } from "../constants";
// ...
const pactUrl = options?.pactUrl ?? PACT_URL;   // ← static default
```

**Impact:**
- Reads continue hitting node1 even after failover switched the active host to node2.
- No request timeout: `dirtyRead(transaction)` is unbounded — a hung node can pin a UI tab indefinitely.

**Suggested Fix:**
```ts
import { getActivePactUrl } from "../network/nodeFailover";
// ...
const pactUrl = options?.pactUrl ?? getActivePactUrl(chainId);
```
Add a request-side timeout (e.g. `Promise.race([dirtyRead(tx), rejectAfter(15_000)])`) to bound the call.

---

### F-CORE-004: nodeFailover module-global state leaks across consumers

- **Severity:** HIGH
- **Category:** Architecture / Module-level mutable state
- **File:** `src/network/nodeFailover.ts`
- **Lines:** 25-33, 128-151
- **Agent:** audit-bug-detector + security (merged: F-BUG-001 + F-SEC-012)
- **Evidence Strength:** [CITED]
- **Citation:** `src/network/nodeFailover.ts:25-33` (module-let bindings), `:128-151` (`setNodeConfig` mutates them).

**Description:**
`PRIMARY_HOST`, `FALLBACK_HOST`, `currentHost`, `customGasLimit`, `retryTimer` are module-level `let` bindings. `setNodeConfig(...)` mutates them. In any environment where the library is loaded once and shared (Node SSR, multi-tenant HUB process, jsdom test runner), one tenant calling `setNodeConfig("node1")` flips the active host for every other tenant.

**Evidence:**
```ts
// src/network/nodeFailover.ts:25-33
let PRIMARY_HOST = NODE2_HOST;
let FALLBACK_HOST = NODE1_HOST;
let customGasLimit = DEFAULT_GAS_LIMIT;
// ...
let currentHost = PRIMARY_HOST;
let retryTimer: ReturnType<typeof setInterval> | null = null;
```

**Impact:**
- Multi-tenant SSR: tenant A's node choice contaminates tenant B's reads.
- Tests: a `setNodeConfig` call in one test leaks into the next unless explicitly reset.
- Race: two concurrent `setNodeConfig` calls interleave and `retryTimer` can leak.

**Suggested Fix:**
Two options:
1. **Quick fix:** export a `resetNodeFailover()` helper for tests + document the global-state caveat in the module header.
2. **Proper fix:** convert the module to a class (`NodeFailover`) that the consumer instantiates and passes around; deprecate the module-level functions in favour of an `instanceof`-aware default singleton.

---

### F-CORE-005: Wallet → interactions backwards layering creates a circular import path

- **Severity:** HIGH
- **Category:** Architecture / Layer violation
- **File:** `src/wallet/KadenaWallet.ts`
- **Lines:** 14
- **Agent:** architecture + integration (merged: F-ARCH-006 + F-INT-002)
- **Evidence Strength:** [CITED]
- **Citation:** `src/wallet/KadenaWallet.ts:14` — `import { getBalance } from "../interactions/kadenaFunctions";`

**Description:**
`wallet/` is the lower-level module (key derivation, mnemonic, in-memory keypair). `interactions/` is higher-level (chain calls). Yet `KadenaWallet.getBalance()` imports from `interactions/kadenaFunctions`, inverting the dependency direction. Today this compiles because `interactions/kadenaFunctions` doesn't import from `wallet/`, but any future cross-import lands an ESM circular and a partially-initialised module.

**Evidence:**
```ts
// src/wallet/KadenaWallet.ts:14
import { getBalance } from "../interactions/kadenaFunctions";
```

**Impact:**
Layering is the only reason `wallet/` is independently usable. Once it imports `interactions/`, anyone consuming `@stoachain/ouronet-core/wallet` pulls in the entire interactions tree (including `@kadena/client`, `pactRead`, every constant). That defeats the subpath-only-consumer pattern documented in `interactions/index.ts:1-14`.

**Suggested Fix:**
1. Move `getBalance` into a small `network/` helper or accept a balance-resolver callback in `KadenaWallet`'s constructor.
2. Or: drop `getBalance()` from `KadenaWallet` and make balance fetching the consumer's responsibility (the class is a data bag — keep it that way).

---

### F-CORE-006: pactRead seam bypassed by ~16 pure-read call sites

- **Severity:** HIGH
- **Category:** Architecture / Injection seam not honoured
- **File:** `src/interactions/*.ts` (multiple)
- **Lines:** see Evidence — 16 sites confirmed by integration-checker
- **Agent:** performance + integration (merged: F-PERF-001 + F-INT-003)
- **Evidence Strength:** [CITED]
- **Citation:** `src/interactions/addLiquidityFunctions.ts:101,137,207,252,270,852,877,901,927`, `src/interactions/dexFunctions.ts:1598-1605`, etc. — `createClient(getPactUrl(...))` used directly instead of `pactRead`.

**Description:**
`src/reads/pactReader.ts` exists exactly so consumers (OuronetUI's cache-aware reader, HUB's batch reader) can plug in a single reader implementation that all interaction code respects. But ~16 read sites still call `createClient(getPactUrl(...)).dirtyRead(tx)` directly, bypassing the seam.

The sim-before-submit calls (~21 more sites) legitimately bypass the seam because they're paired with a submit and a cache hit would corrupt gas calibration. The 16 PURE-READ sites have no such excuse.

**Evidence:**
```ts
// src/interactions/addLiquidityFunctions.ts:252-258 (one of 16)
const transaction = Pact.builder
  .execution(`(${KADENA_NAMESPACE}.SWP.UR_IzFrozenLP "${swpair}")`)
  .setNetworkId(KADENA_NETWORK)
  .setMeta({ chainId: KADENA_CHAIN_ID, gasLimit: 50_000 })
  .createTransaction();
const { dirtyRead } = createClient(getPactUrl(KADENA_CHAIN_ID));   // ← should be pactRead
const response = await dirtyRead(transaction);
```

**Impact:**
- OuronetUI's cache-aware reader misses these calls — every keystroke re-fetches.
- Smart Swap flickering (the very bug `pactReader` was created to fix) reappears at the bypassed sites.
- HUB's batch reader cannot collapse them either.

**Suggested Fix:**
Replace the 16 sites with `pactRead(pactCode, { tier: "T?" })`. Audit the PR with `git diff` for `createClient(getPactUrl` to make sure no PURE read site is missed.

---

### F-CORE-007: Empty catches fabricate fallback values (1.0 USD, 0% fee, 8 decimals)

- **Severity:** HIGH
- **Category:** Error handling / Silent failure
- **File:** `src/interactions/dexFunctions.ts`, `src/interactions/ouroFunctions.ts`
- **Lines:** dexFunctions.ts:1308, 1317-1320, 1346-1349; ouroFunctions.ts:2050-2053
- **Agent:** error-handling-auditor (F-ERR-005)
- **Evidence Strength:** [CITED]
- **Citation:** `src/interactions/dexFunctions.ts:1303-1321` (`getTokenDecimals` returns 8 on every failure), `:1340-1350` (`getPoolTotalFee` returns 0 on every failure), `src/interactions/ouroFunctions.ts:2042-2054` (`getStoaPriceUSD` returns 1.0 on every failure).

**Description:**
Three read functions return fabricated values when the chain call fails or returns a `failure` status. The values look plausible but are never marked as fallbacks — callers can't distinguish "the chain said 8" from "the read crashed". This is especially dangerous for `getStoaPriceUSD` because 1.0 is a believable price that could feed into a swap-quote calculation.

**Evidence:**
```ts
// src/interactions/ouroFunctions.ts:2042-2054
export async function getStoaPriceUSD(...): Promise<number> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.U|CT.UR|KDA-PID)`;
    const response = await pactRead(pactCode, { tier: "T6", ... });
    if (response?.result?.status === "success") {
      return Number(mayComeWithDeimal(...)) || 1.0;     // ← also masks NaN
    }
    return 1.0;                                          // ← masks failure status
  } catch {
    return 1.0;                                          // ← masks crash
  }
}
```

**Impact:**
A network failure at the price oracle is now indistinguishable from "the price is 1.0". A swap quote built on this fabricated 1.0 could under- or over-pay by orders of magnitude.

**Suggested Fix:**
1. Return a discriminated union: `Promise<{ ok: true; value: number } | { ok: false; reason: "network" | "no-data" }>`.
2. Or: return `null` and force the caller to handle the absence explicitly.
3. Log the failure (telemetry, not just `console.error`) so production failures are observable.

---

### F-CORE-008: No timeout on chain submit / dirtyRead calls

- **Severity:** HIGH
- **Category:** Reliability / Resource bound
- **File:** all `src/interactions/*.ts` submit sites + `src/reads/rawCalibratedRead.ts`
- **Lines:** multiple
- **Agent:** error-handling + performance (merged: F-ERR-015 + F-PERF-005 timeout aspect)
- **Evidence Strength:** [CITED]
- **Citation:** `grep -n "createClient" src/interactions/` returns 30+ sites; none wrap the result in a timeout. `src/reads/rawCalibratedRead.ts:58-59` has no timeout either.

**Description:**
`@kadena/client`'s `submit` and `dirtyRead` Promises are unbounded. A primary-node hang causes a user-visible spinner that never resolves. Failover doesn't help here because failover triggers on network errors — a slow-but-not-failing response simply hangs.

**Evidence:**
```ts
// src/reads/rawCalibratedRead.ts:58-59 (no timeout)
const { dirtyRead } = createClient(pactUrl);
const response = await dirtyRead(transaction);
```

**Impact:**
- UI: spinner pinned indefinitely; user clicks again → double submit.
- HUB: a single tenant's slow request blocks an event loop slot until GC.

**Suggested Fix:**
Add a configurable timeout — sensible defaults: 15s for `dirtyRead`, 60s for `submit`:
```ts
const timeoutMs = options?.timeoutMs ?? 15_000;
const response = await Promise.race([
  dirtyRead(transaction),
  new Promise<never>((_, rj) =>
    setTimeout(() => rj(new Error(`pact dirtyRead timed out after ${timeoutMs}ms`)), timeoutMs)),
]);
```

---

### F-CORE-009: V1 decrypt error swallowing — KDF leak + UX confusion + info disclosure

- **Severity:** HIGH
- **Category:** Security / Cryptographic error handling
- **File:** `src/crypto/v1.ts`, `src/crypto/v2.ts`
- **Lines:** v1.ts:67-70, 122-127; v2.ts:177-187
- **Agent:** security + audit-bug-detector + error-handling (merged: F-SEC-002 + F-SEC-003 + F-BUG-011 + F-ERR-007)
- **Evidence Strength:** [CITED]
- **Citation:** `src/crypto/v1.ts:122-127`, `src/crypto/v2.ts:177-187`.

**Description:**
Three concerns reinforce each other:

1. **Catch-all collapses every failure.** V1's `decryptString` wraps the entire decrypt in a try/catch that maps every error — wrong password, corrupted base64, malformed envelope, JSON.parse failure — to the same `"Failed to decrypt data. Invalid password or corrupted data."` (`v1.ts:124-126`).
2. **smartDecrypt double-tries V1, then V2.** On a wrong-password V1 envelope, `smartDecrypt` first burns 10k SHA-256 PBKDF2 iterations (~50ms), then re-tries with V2's 600k SHA-512 (~1.5s) before failing — leaking ~1.5s of user time and (more importantly) showing a longer "wrong password" delay that is correlated with the envelope version. A timing oracle, not catastrophic but observable.
3. **Console.error leaks crypto errors.** `console.error("Decryption error:", error)` at `v1.ts:123` writes the underlying crypto error message to the browser console. In a hostile-page scenario (a malicious extension reading the console) this is observable.

**Evidence:**
```ts
// src/crypto/v1.ts:122-127
} catch (error) {
  console.error("Decryption error:", error);          // ← leaks the underlying error
  throw new Error(
    "Failed to decrypt data. Invalid password or corrupted data.",
  );
}

// src/crypto/v2.ts:177-187 (smartDecrypt — V1 first, V2 fallback)
export async function smartDecrypt(encrypted: string, password: string) {
  if (isEncryptedV2(encrypted)) return decryptStringV2(encrypted, password);
  try {
    const { decryptString } = await import("./v1");
    return await decryptString(encrypted, password);
  } catch {
    return decryptStringV2(encrypted, password);     // ← second KDF burn
  }
}
```

**Impact:**
- UX: a corrupt envelope reads "wrong password" — users go in circles trying their correct password.
- Side channel: the wrong-password attempt for a V1 envelope takes ~1.5s longer than for a V2 envelope (observable from a malicious page).
- Console disclosure: the underlying crypto error (which can include implementation hints) is logged.

**Suggested Fix:**
1. Distinguish error types: throw `new InvalidEnvelopeError()` vs `WrongPasswordError()` so callers (and humans) know which.
2. Drop `console.error` in production paths — let the caller handle telemetry.
3. In `smartDecrypt`, use `isEncryptedV2` only as the discriminator; never attempt V1 KDF on a V2 envelope and vice-versa. The current double-try shape exists for legacy edge cases but should be measured and dropped if the catch never fires in practice.

---

### F-CORE-010: CFM-builders use unescaped string interpolation into Pact code

- **Severity:** HIGH
- **Category:** Security / Pact-code injection
- **File:** `src/pact/cfmBuilders.ts`
- **Lines:** every builder; e.g. 47-57, 65-70, 82-88
- **Agent:** security-auditor (F-SEC-008)
- **Evidence Strength:** [CITED]
- **Citation:** `src/pact/cfmBuilders.ts:55-57` etc.

**Description:**
Every `buildXPactCode` builder produces a Pact-code string by interpolating untrusted-shaped fields directly into the template:
```ts
return `(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_Transfer "${p.patron}" ...)`;
```
Patron / sender / receiver / token-id arrive from UI inputs. None are validated; none are escaped against the embedded `"` quote. A field containing `"` would close the string early and inject Pact tokens.

**Evidence:**
```ts
// src/pact/cfmBuilders.ts:47-57
export function buildTransferPactCode(p: {
  patron: string; tokenId: string; sender: string; receiver: string;
  amount: string; method: boolean;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_Transfer "${p.patron}" "${p.tokenId}" "${p.sender}" "${p.receiver}" ${dec} ${p.method})`;
  //                                              ↑↑↑↑                                 ← unescaped " injection
}
```

**Impact:**
The chain rejects malformed Pact code, so this isn't a route to an unauthorised tx. But:
- A user pasting an account address that contains an embedded quote (very rare but possible from a clipboard quirk) will get an opaque "chain error" rather than a UI-side validation failure.
- Future builders for richer fields (Pact strings with backslashes, JSON values) inherit the same gap.
- The builder is the public seam where any caller — including a future HUB-side flow with less-trusted inputs — passes strings through.

**Suggested Fix:**
1. Add a `pactString(s: string)` helper that asserts `s` matches `^[a-zA-Z0-9._\-:|]+$` (or whatever the actual character class for accounts/token-ids is) and throws on mismatch. Wrap every interpolated field with it.
2. Or: produce a structured Pact-builder object and let `@kadena/client`'s native escaping handle quotes — but the latter is a bigger refactor.
3. Add a test in `tests/cfm-builders.test.ts` for each builder that asserts a quote-containing input is rejected.

---

### F-CORE-011: Tests missing for pactReader, KadenaWalletBuilder, transactionErrors

- **Severity:** HIGH
- **Category:** Test coverage
- **File:** `tests/`
- **Lines:** these test files do not exist
- **Agent:** testing-auditor (F-TEST-001 + F-TEST-002 + F-TEST-003)
- **Evidence Strength:** [CITED]
- **Citation:** `ls tests/` shows 12 files — none for `pactReader`, `walletBuilder`, `transactionErrors`. `src/reads/pactReader.ts:52-54` (`setPactReader`) is the injection seam; `src/wallet/KadenaWalletBuilder.ts` mnemonic dispatch (BIP39 vs Chainweaver) is unverified; `src/errors/` (transactionError classifier) drives error UX everywhere.

**Description:**
Three security-sensitive surfaces have zero test coverage:

1. **`pactReader.ts`** — the `setPactReader` / `pactRead` injection seam. A regression here silently breaks every read in the library.
2. **`KadenaWalletBuilder.createWalletPairFromMnemonic`** — dispatches between BIP39 (24-word) and Chainweaver (12-word) derivation. A bad branch either produces wrong keys (locked funds) or accepts an invalid mnemonic.
3. **`transactionErrors`** — the error classifier that the UI surfaces back to users. Missing tests means every error message is unverified.

**Evidence:** `ls tests/` enumerates 12 files; none match these patterns.

**Impact:**
- A future refactor of `setPactReader` could revert the file to a no-op without any test failing.
- Mnemonic dispatch error → user passes Koala 24-word seed, gets Chainweaver-derived (different) keys, loses access.

**Suggested Fix:**
Add three test files. Bare-minimum scope per file:
- `tests/pact-reader.test.ts` — happy path through the default reader; `setPactReader(custom)` round-trip; reset.
- `tests/wallet-builder.test.ts` — koala-24 derivation produces the expected fixture pubkey; chainweaver-12 derivation produces a different pubkey; mismatched mnemonic length throws.
- `tests/transaction-errors.test.ts` — known error strings classify into known categories; unknown strings fall through to a default category.

---

### F-CORE-012: Test coverage gaps — encryption boundary, migration, pact format

- **Severity:** HIGH (cluster)
- **Category:** Test coverage
- **File:** `tests/encryption.test.ts`, `tests/encryption-upgrade.test.ts`, `tests/codex-codec.test.ts`
- **Lines:** see Evidence
- **Agent:** testing-auditor + integration-checker + architecture (F-TEST-011 + F-TEST-012 + F-INT-009)
- **Evidence Strength:** [CITED]
- **Citation:** `tests/encryption.test.ts` lacks cross-version tests; `tests/codex-codec.test.ts` lacks the seedTypeMigration round-trip.

**Description:**
Existing encryption tests cover happy-path round-trip but not:
- V2 envelope tampered to V1 shape (the `v: 2` discriminator bypass).
- `smartEncrypt` with `schemaVersion: null` vs `"0"` vs `"1"`.
- `seedTypeMigration` round-trip from a Phase-1 codex.
- `formatDecimalForPact` edge cases: scientific notation, leading zeros, locale separators.

**Impact:**
A regression in any of these paths slips through the test suite silently. The codex-export test only verifies the happy-path round-trip; tampered envelopes are not exercised.

**Suggested Fix:**
Extend `tests/encryption.test.ts` with the cross-version cases, add a `seed-type-migration.test.ts`, extend `tests/pact-format.test.ts` with the edge cases.

---

## Medium Findings

### F-CORE-013: deserializeCodex accepts any object that carries `version: "1.2"`

- **Severity:** MEDIUM
- **Category:** Input validation
- **File:** `src/codex/codec.ts`
- **Lines:** 75-93
- **Agent:** security + audit-bug-detector + error-handling (merged: F-SEC-004 + F-BUG-005 + F-ERR-009)
- **Evidence Strength:** [CITED]
- **Citation:** `src/codex/codec.ts:83-93`.

**Description:**
`deserializeCodex` validates the `version` field but does NOT validate the shape of `kadenaWallets`, `ouronetWallets`, `addressBook`, or `uiSettings`. Anything passing the version check is cast to `CodexExportV1_2<...>`. A malformed codex JSON (missing fields, wrong types, arrays where objects expected) flows downstream as a typed-but-broken payload.

**Evidence:**
```ts
// src/codex/codec.ts:83-93
const parsed = JSON.parse(json);
if (!parsed || typeof parsed !== "object") {
  throw new Error("deserializeCodex: not an object");
}
if (parsed.version !== "1.2") {
  throw new Error(`deserializeCodex: unsupported version ...`);
}
return parsed as CodexExportV1_2<KS, OA, AB, UI>;       // ← no further shape check
```

**Impact:**
A user who imports a corrupted backup file sees the failure at the next consumer — typically when the UI tries to render `kadenaWallets[i].secret` and crashes — rather than at the import boundary. Degrades the recovery UX.

**Suggested Fix:**
Add a minimal shape check after the version check:
```ts
if (!Array.isArray(parsed.kadenaWallets)) throw new Error("deserializeCodex: kadenaWallets is not an array");
if (!Array.isArray(parsed.ouronetWallets)) throw new Error("...");
// etc.
```
Or pull in a runtime validator (zod) for the full shape if the project ever adds one.

---

### F-CORE-014: KeyResolver.requestForeignKey is optional but treated as recoverable

- **Severity:** MEDIUM
- **Category:** API contract
- **File:** `src/signing/types.ts`, `src/signing/codexStrategy.ts`
- **Lines:** types.ts:62-69; codexStrategy.ts:180-182
- **Agent:** security + audit-bug-detector (merged: F-SEC-009 + F-BUG-006)
- **Evidence Strength:** [CITED]
- **Citation:** `src/signing/types.ts:62-69` (the `?` makes it optional), `src/signing/codexStrategy.ts:180-182` (the strategy gates the forward).

**Description:**
The `KeyResolver.requestForeignKey` method is optional. `CodexSigningStrategy` checks `this.resolver.requestForeignKey ? ... : undefined` and falls back to `undefined`. If the tx demands a foreign-key signer and the resolver doesn't implement the method, the failure surfaces as `universalSignTransaction` complaining about a missing private key for pubkey X — opaque and several layers deep.

**Evidence:**
```ts
// src/signing/codexStrategy.ts:180-182
const onMissingKey = this.resolver.requestForeignKey
  ? (pub: string) => this.resolver.requestForeignKey!(pub)
  : undefined;                                              // ← silent fall-through
```

**Impact:**
Server-side resolvers (HUB) that intentionally omit `requestForeignKey` produce a confusing error path when a tx contains a foreign key. The contract doesn't say "throwing here is the explicit signal" — it just lets the call proceed and fail downstream.

**Suggested Fix:**
1. Make `requestForeignKey` required and document that server-side resolvers throw with a clear message.
2. Or: short-circuit in the strategy with a precise error before reaching `universalSignTransaction`:
   ```ts
   if (!onMissingKey && txHasForeignSigner(tx)) {
     throw new Error("[CodexSigningStrategy] this resolver cannot prompt for foreign keys");
   }
   ```

---

### F-CORE-015: safeCreationTime is duplicated in 7 interactions/* files

- **Severity:** MEDIUM
- **Category:** Architecture / Duplication
- **File:** `src/interactions/activateFunctions.ts:20-22`, `addLiquidityFunctions.ts:17-19`, `coilFunctions.ts:30-32`, `crossChainFunctions.ts:11-13`, `dexFunctions.ts:16-18`, `guardFunctions.ts:19-21`, others
- **Lines:** see file list
- **Agent:** architecture + performance + error-handling (merged: F-ARCH-002 + F-PERF-007 + F-ERR-024)
- **Evidence Strength:** [CITED]
- **Citation:** `grep "function safeCreationTime" src/` returns 7 hits, all identical bodies.

**Description:**
The same 3-line helper is copy-pasted into 7 files:
```ts
function safeCreationTime(): number {
  return Math.floor(Date.now() / 1000) - 30;
}
```
The `-30` value is the "safety margin" that prevents Pact's "creation time too far in the future" error. Changing it (or fixing a bug like signed-int overflow on 32-bit systems) requires editing 7 files.

**Impact:**
- Any future drift between copies — e.g. one file uses `-60` while six others stay at `-30` — is invisible until a chain rejection.
- The hardcoded `-30` is undocumented as a tuning knob.

**Suggested Fix:**
Move it to `src/pact/index.ts` (next to `formatDecimalForPact` which already lives there):
```ts
export function safeCreationTime(): number {
  return Math.floor(Date.now() / 1000) - 30;
}
```
Update the 7 imports.

---

### F-CORE-016: Smart Account auth analyzer — three independent concerns

These three findings target `src/guard/smartAccountAuth.ts` but each has a distinct failure mode. They share a file, not a root cause, so they remain separate per audit-skill conventions.

#### F-CORE-016a: classifyGuardKind discriminates on string presence, not value validity

- **Severity:** MEDIUM
- **Category:** Input validation
- **File:** `src/guard/smartAccountAuth.ts`
- **Lines:** 84-106
- **Agent:** security-auditor (F-SEC-016)
- **Evidence Strength:** [CITED]

**Description:** `classifyGuardKind` returns `"capability"` if the object has a string-typed `cgName` field, regardless of whether the rest of the capability-guard shape (`cgArgs`, `cgPactId`) is present and valid. A malformed guard with `{ cgName: "", cgArgs: null }` classifies as a capability and short-circuits further analysis.

**Suggested Fix:** Tighten the discriminator: require the full minimal shape per kind, fall through to `"unknown"` otherwise.

#### F-CORE-016b: extractKeysetFromGuard ignores the `keysetRef` post-resolution shape

- **Severity:** MEDIUM
- **Category:** Bug
- **File:** `src/guard/smartAccountAuth.ts`
- **Lines:** 118-126
- **Agent:** error-handling-auditor (F-ERR-012)
- **Evidence Strength:** [CITED]

**Description:** `extractKeysetFromGuard` checks `classifyGuardKind(g) !== "keyset"` and returns null. But a `keyset-ref` that was resolved upstream (via `resolveGuard`) and now has `{ pred, keys, keysetRef }` shape passes the keyset check — and the code preserves `keysetRef` only if `o.keysetRef` is truthy. The casing inconsistency (`keysetref` in the type-ref form, `keysetRef` in the resolved form) means a resolved ref's `keysetRef` field can land at the wrong key.

**Suggested Fix:** Normalize the case: pick one of `keysetRef` / `keysetref` and convert at the boundary (the upstream `resolveGuard`).

#### F-CORE-016c: analyzeSmartAccountAuthPaths returns -1 for "no satisfied branch" but anyKeyBased may still be true

- **Severity:** MEDIUM
- **Category:** API contract
- **File:** `src/guard/smartAccountAuth.ts`
- **Lines:** 209-240
- **Agent:** audit-bug-detector (F-BUG-012)
- **Evidence Strength:** [CITED]

**Description:** `firstSatisfied === -1` AND `anyKeyBased === true` is a valid state: there's a key-based branch but no codex key signs it. Callers reading "anyKeyBased = true" assume they can prompt for keys; without `firstSatisfied`, they may default to an unsignable branch and silently fail.

**Suggested Fix:** Document the state combinations in the JSDoc. Consider adding a `firstSignableButUnsatisfied: number` field for the "we can prompt the user" path.

---

### F-CORE-017: Predicate fallback to keys-all on unknown predicates

- **Severity:** MEDIUM
- **Category:** Security / Defensive default
- **File:** `src/guard/guardUtils.ts`
- **Lines:** 76-79
- **Agent:** security + error-handling (merged: F-SEC-017 + F-ERR-023)
- **Evidence Strength:** [CITED]
- **Citation:** `src/guard/guardUtils.ts:76-79`.

**Description:**
On an unknown predicate, `computeThreshold` returns `keyCount` (the equivalent of `keys-all`) and writes a `console.warn`. The intent — fail closed — is correct, but:
1. The warning never propagates to the caller; it only surfaces in the browser console.
2. A user creating a guard with a typo'd predicate (e.g. `"keys-aall"`) gets silent enforcement of `keys-all`, which may be a stricter requirement than intended and locks them out of their own account if not all keys are accessible.
3. Returning `keyCount` is conservative for ON-CHAIN ENFORCEMENT (the chain still uses the actual predicate), but for codex-side analysis it overstates the threshold.

**Evidence:**
```ts
// src/guard/guardUtils.ts:76-79
console.warn(`[guardUtils] Unknown predicate: "${pred}" — defaulting to keys-all`);
return keyCount;
```

**Impact:**
- UI shows "needs N signatures" when the real on-chain requirement is unknown.
- Diverges from on-chain truth — codex side may report unsatisfiable when the chain would accept fewer signatures (or vice-versa).

**Suggested Fix:**
Return a marker value (e.g. throw a typed `UnknownPredicateError` or return `{ threshold: keyCount, unknown: true }`) so the analyzer can flag the guard as "predicate not understood by this codex" rather than silently treating it as keys-all.

---

### F-CORE-018: README and CONTEXT docs lag behind v1.6.x — Smart-account fields not documented

- **Severity:** LOW (group)
- **Category:** Documentation drift
- **File:** `README.md`, `.bee/CONTEXT.md`
- **Lines:** README header version table; CONTEXT.md interactions section
- **Agent:** integration-checker (F-INT-005 + F-INT-006)
- **Evidence Strength:** [CITED]
- **Citation:** Recent git log shows `feat(interactions): AccountSelectorData gains public-key / sovereign / governor (v1.4.0)` and `Smart Ouronet Account auth-path resolution + Rotate Sovereign builder (v1.6.0)` — README still references the pre-v1.4 surface.

**Description:**
`README.md`'s status table reads `1.3.0 → 1.4.0` per commit `25c054d`, but the codebase is at v1.6.1. The Smart-account additions (`buildRotateSovereignPactCode`, `analyzeSmartAccountAuthPaths`) aren't documented in the README's "Public API" section. Both findings are LOW severity (no runtime impact) but compound on consumer onboarding.

**Suggested Fix:** Update the README to reflect v1.6.1 and add a v1.6.0 section listing the new Smart-account primitives.

---

### F-CORE-019: getStoaPriceUSD `console.error` inconsistency vs sibling read functions

- **Severity:** LOW
- **Category:** Code quality / Logging consistency
- **File:** `src/interactions/ouroFunctions.ts`
- **Lines:** multiple — see Evidence
- **Agent:** error-handling-auditor (subset of cluster, kept LOW)
- **Evidence Strength:** [CITED]
- **Citation:** `ouroFunctions.ts` has both `} catch { return null; }` (silent) and `} catch (error) { console.error(...); return null; }` (logged) patterns within the same file.

**Description:**
Within a single file, some catch blocks log, others don't. No documented convention picks which.

**Suggested Fix:** Pick one (log everything to a project-wide `logger` helper, or log nothing and let consumers wrap) and apply consistently.

---

### F-CORE-020: Multiple unused `tier` argument paths in `pactRead` calls

- **Severity:** LOW
- **Category:** Dead code / Consumer contract
- **File:** `src/interactions/*.ts`
- **Lines:** every `pactRead(..., { tier: "T?" })` call
- **Agent:** architecture + performance (clustered LOW)
- **Evidence Strength:** [CITED]
- **Citation:** `src/reads/rawCalibratedRead.ts:40-46` documents `tier` as accepted-and-ignored.

**Description:**
The default reader ignores `tier`. Only OuronetUI's cache-aware reader honours it. New contributors don't know which tier is correct and copy whatever the neighbouring call uses.

**Suggested Fix:** Document the tier semantics in `pactReader.ts` JSDoc with the canonical mapping (T1=balance, T2=preview, T3=metadata, etc.). Add a runtime warning in dev mode if `tier` is missing.

---

### F-CORE-021: `getLPTypeInfo` outer try/catch is dead code

- **Severity:** LOW
- **Category:** Dead code
- **File:** `src/interactions/addLiquidityFunctions.ts`
- **Lines:** 240-288
- **Agent:** error-handling-auditor (F-ERR-013, partial — outer catch dead, Promise.all wording issue is "needs context")
- **Evidence Strength:** [CITED]
- **Citation:** `src/interactions/addLiquidityFunctions.ts:240-288` — both inner async IIFEs already swallow into `false`, so `Promise.all` cannot reject; the outer `catch (error) { return { hasFrozenLP: false, hasSleepingLP: false }; }` is unreachable.

**Description:**
The outer try/catch in `getLPTypeInfo` is unreachable because both branches of the `Promise.all` self-recover into `false`. The defensive shape is harmless but confusing.

**Suggested Fix:** Drop the outer try/catch, or — if the intent is "future-proof in case someone removes the inner catches" — comment it as such.

---

### F-CORE-022: `console.warn`/`console.error` calls scattered across modules with no common logger

- **Severity:** LOW
- **Category:** Code quality / Observability
- **File:** multiple — `src/network/nodeFailover.ts:51,59`, `src/crypto/v1.ts:68,123`, `src/guard/guardUtils.ts:78`, `src/interactions/ouroFunctions.ts:66,87,106,...` etc.
- **Lines:** see file list
- **Agent:** architecture-auditor (clustered LOW)
- **Evidence Strength:** [CITED]
- **Citation:** `grep -n "console.error\\|console.warn" src/` shows ~25 hits across 8 files.

**Description:**
No central logger; every module decides whether to emit and at what level. Consumers can't reroute (e.g. to Sentry) without monkey-patching `console`.

**Suggested Fix:** Introduce `src/observability/logger.ts` with a `setLogger(fn)` injection point, mirror what `setPactReader` does. Replace `console.error/warn` calls with `logger.error/warn`.

---

## Needs Context

| ID | Title | What's needed |
|----|-------|---------------|
| F-ARCH-005 | `primitives.ts toHexString` may have drifted from the OuronetUI original | Read access to OuronetUI's `src/lib/universalSign.ts` to confirm whether `toHexString` is in the originals (the file header allows additions IF in originals). Without that, we can't tell if this is drift or a documented Phase-1 addition. |
| F-ERR-013 | `getLPTypeInfo` Promise.all rejection wording | The outer dead catch is confirmed (see F-CORE-021). Whether the dead catch is intentional defensive or a copy-paste artifact depends on author intent — flag for human review. |
| F-ARCH-013 | Inconsistent indentation across `interactions/*` | No specific file:line cited by the auditor. Needs a follow-up scan with a formatter (Prettier) to enumerate exact sites. |
| F-TEST-010 | `cfm-builders.test.ts` edge-case coverage | Auditor flagged "not enough lines reviewed to fully judge coverage gap". Re-run testing-auditor with the test file as primary input to enumerate which builders have inputs but no negative-path test. |
| F-ERR-025 | `getRotateKadenaInfo` console.error inconsistency | The pattern is consistent within `ouroFunctions.ts`; conflict only with sentinel-returning siblings elsewhere (cf. F-CORE-019). Needs an explicit project-wide convention before this can be flagged definitively. |

---

## False Positives Log

The following findings were dropped after validator review. They are listed for transparency and to demonstrate the validation step is doing real work.

| ID | Title | Reason for dropping |
|----|-------|---------------------|
| F-SEC-015 | `getRandomValues().slice()` pattern theoretical fragility | Currently safe (TextEncoder + WebCrypto contract holds); fragility is theoretical-only and not observable in any reachable code path. |
| F-BUG-007 | `smartEncrypt` claimed V2→V1 downgrade | Auditor misread the documented intentional behaviour in `tests/encryption-upgrade.test.ts:68-78`. The dispatch is correct: `schemaVersion >= 1` writes V2; lower writes V1. |
| F-ERR-004 | `setTimeout` orphan in `isHealthy` | `clearTimeout(timeout)` IS present at `src/network/nodeFailover.ts:41`, and the AbortController self-clears on response. No leak. |
| F-ARCH-012 | `src/index.ts` empty | Intentional design (subpath-only consumer pattern). Documented at `src/interactions/index.ts:1-14`. |
| F-TEST-007 | `strategy.test.ts` order assertion | Auditor misread the file — assertion IS present at the cited lines. |

---

## Recommendations

### Immediate Actions (CRITICAL)

1. **Consolidate `IKadenaKeypair` (F-CORE-001)** — mechanical refactor: delete 4 duplicate declarations, add 4 `import type` lines. ~30 minutes of work, zero behaviour change. Worth doing before any further interactions/* edits to prevent further drift.

### Short-term Actions (HIGH — current sprint)

2. **Wire failover into submit + read paths (F-CORE-002, F-CORE-003)** — moderate refactor. Two patterns to choose from (per-call vs client factory). Add the idempotency guard before retrying submits.
3. **Bound chain calls with timeouts (F-CORE-008)** — simple fix; touches every `createClient(...).submit / dirtyRead` call site (~30). Default timeouts: 15s read, 60s submit.
4. **Surface fabricated-fallback failures (F-CORE-007)** — moderate refactor. Discriminated-union return shape OR explicit `null` + caller awareness. Three call sites, plus consumers.
5. **Make nodeFailover state injectable (F-CORE-004)** — moderate refactor. Convert module to class; keep a default singleton for backwards-compat.
6. **Decouple wallet from interactions (F-CORE-005)** — simple fix. Either drop `getBalance()` from `KadenaWallet` or accept a balance-resolver in the constructor.
7. **Replace 16 `createClient`-based pure reads with `pactRead` (F-CORE-006)** — mechanical, trace `git diff` for completeness.
8. **Add escape helper to CFM builders (F-CORE-010)** — simple fix. Add `pactString(s)` helper, wrap every interpolated field, add a quote-injection test per builder.
9. **Tighten V1 decrypt error types and drop `console.error` (F-CORE-009)** — simple fix. Two new error subclasses, remove two `console.error` calls.
10. **Add the three missing test files (F-CORE-011)** — significant effort (~1 day) but high leverage. Bare-minimum scope per file is documented in the finding.
11. **Extend test coverage at the encryption boundary (F-CORE-012)** — moderate effort. Cross-version, migration round-trip, format edge cases.

### Technical Debt (MEDIUM + LOW)

Group these into a single `[TECH-DEBT]` cleanup spec after the HIGH items land:

**Theme: Validation hardening**
- F-CORE-013 (codex shape validation)
- F-CORE-014 (KeyResolver foreign-key contract)
- F-CORE-016a/b/c (Smart-account analyzer edge cases)
- F-CORE-017 (predicate fallback)

**Theme: Code consolidation**
- F-CORE-015 (`safeCreationTime` duplication — move to `src/pact/index.ts`)
- F-CORE-022 (central logger)

**Theme: Documentation + dead code**
- F-CORE-018 (README + CONTEXT drift)
- F-CORE-019 (`console.error` inconsistency)
- F-CORE-020 (`tier` parameter semantics)
- F-CORE-021 (`getLPTypeInfo` dead catch)

---

## Audit Methodology Notes

This audit ran 7 of 10 agents. The 3 skipped agents (`frontend-auditor`, `database-auditor`, `api-auditor`) were filtered out at the orchestrator level because the project has no UI surface, no database, and no HTTP API — running them would have produced findings that misclassify pure-library code as if it were a backend service.

All 107 raw findings were validated by 3 `audit-finding-validator` passes against the actual source files. The validator dropped 5 false positives (4.7%) and flagged 5 needs-context findings for human review. The remaining 97 confirmed findings were consolidated into 32 distinct issues by merging cross-agent overlaps (e.g. four agents independently reported the V1 decrypt error-handling cluster — they all describe the same code, so they merge into one HIGH finding).

The merge step is conservative: distinct findings about the same file were kept separate when they targeted different lines or root causes (see F-CORE-016a/b/c for an example).

Generated by BeeDev `/bee:audit` on 2026-04-30 for `bica.mihai.g@gmail.com`.
