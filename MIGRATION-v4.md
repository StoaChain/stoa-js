# Migrating from `@stoachain/ouronet-core@^3.3.8` to v4.0.0

v4.0.0 is the structural refactor that v3.3.8 set up. The single `@stoachain/ouronet-core` package was split into a two-package npm workspace under the new [`StoaChain/stoa-js`](https://github.com/StoaChain/stoa-js) GitHub monorepo:

  - **[`@stoachain/stoa-core`](https://www.npmjs.com/package/@stoachain/stoa-core)** — chain-generic StoaChain foundation (signing, wallet, crypto, network failover, gas, guard, errors, observability, dalos, reads, pact-format).
  - **[`@stoachain/ouronet-core`](https://www.npmjs.com/package/@stoachain/ouronet-core)** — Ouronet protocol business logic (codex codec, interactions/* function library, `KADENA_NAMESPACE`, `STOA_AUTONOMIC_*` accounts, cfm Pact builders).

Both packages release atomically at the same version — a single `vX.Y.Z` git tag publishes both.

## TL;DR

If you imported _only_ Ouronet-specific surfaces (codex, interactions, the `ouronet-ns` namespace), you can keep `@stoachain/ouronet-core` and just bump the version to `4.0.0`. The chain-generic infrastructure your imports depend on transitively is still installed (via the `peerDependencies` declaration), and the `@stoachain/ouronet-core/constants` subpath re-exports the chain-generic constants for source-level back-compat.

If you imported chain-generic surfaces directly (`@stoachain/ouronet-core/signing`, `@stoachain/ouronet-core/wallet`, `@stoachain/ouronet-core/crypto`, etc.), those subpaths no longer exist on `@stoachain/ouronet-core` — they're now on `@stoachain/stoa-core`. You need to:

1. Add `@stoachain/stoa-core` to your dependencies.
2. Rewrite the import paths.
3. Address the breaking removals listed in §3.

## 1. Install

Two packages now:

```bash
npm install @stoachain/stoa-core@4.0.0 @stoachain/ouronet-core@4.0.0
```

(Pinned to exact versions — both packages release atomically.)

If you only need chain-generic surfaces (you're building a CLI tool, validator, third-party StoaChain integration with no Ouronet-specific code), install just `@stoachain/stoa-core`:

```bash
npm install @stoachain/stoa-core@4.0.0
```

If you only need Ouronet (you don't import any chain-generic surface directly — you only call codex APIs and `interactions/*`), `@stoachain/stoa-core` is a peer dependency that npm will install transitively:

```bash
npm install @stoachain/ouronet-core@4.0.0
```

## 2. Import-path rewrites

The split moved chain-generic subpaths from `@stoachain/ouronet-core/X` to `@stoachain/stoa-core/X`. Find-and-replace these subpath strings:

| Pre-v4 | v4.0.0 |
|---|---|
| `@stoachain/ouronet-core/signing` | `@stoachain/stoa-core/signing` |
| `@stoachain/ouronet-core/wallet` | `@stoachain/stoa-core/wallet` |
| `@stoachain/ouronet-core/crypto` | `@stoachain/stoa-core/crypto` |
| `@stoachain/ouronet-core/network` | `@stoachain/stoa-core/network` |
| `@stoachain/ouronet-core/gas` | `@stoachain/stoa-core/gas` |
| `@stoachain/ouronet-core/guard` | `@stoachain/stoa-core/guard` |
| `@stoachain/ouronet-core/errors` | `@stoachain/stoa-core/errors` |
| `@stoachain/ouronet-core/observability` | `@stoachain/stoa-core/observability` |
| `@stoachain/ouronet-core/reads` | `@stoachain/stoa-core/reads` |
| `@stoachain/ouronet-core/dalos` | `@stoachain/stoa-core/dalos` |

The Ouronet-specific subpaths are unchanged:

| Subpath | Surface | Notes |
|---|---|---|
| `@stoachain/ouronet-core/codex` | `serializeCodex`, `deserializeCodex`, `migrateSeedType`, codex format types | Codex format frozen at `"1.2"` |
| `@stoachain/ouronet-core/interactions` | barrel re-exporting `ouroFunctions` only | Most callers use the deep glob below |
| `@stoachain/ouronet-core/interactions/*` | one entry per `interactions/*` file (13 files) | e.g. `@stoachain/ouronet-core/interactions/wrapFunctions` |
| `@stoachain/ouronet-core/constants` | `KADENA_NAMESPACE`, `STOA_AUTONOMIC_*`, `MAIN_TOKENS` + chain-generic re-exports | See §4 |
| `@stoachain/ouronet-core/pact` | cfm Pact-code assembler (`buildCFM*` builders) | The chain-generic format helpers moved to `@stoachain/stoa-core/pact` |

### `@stoachain/ouronet-core/pact` — split surface

Pre-v4 this subpath bundled BOTH chain-generic format helpers (`formatDecimalForPact`, `formatIntegerForPact`, `mayComeWithDeimal`, `filterFreePositionData`, `formatEU`, `safeCreationTime`) AND the Ouronet-specific cfm Pact-code assembler. v4.0.0 split them:

  - Chain-generic helpers → `@stoachain/stoa-core/pact`
  - Ouronet-specific cfm assembler → `@stoachain/ouronet-core/pact`

If your imports were:

```ts
// pre-v4
import { formatDecimalForPact, buildCFM_C_Coil } from "@stoachain/ouronet-core/pact";
```

Rewrite to:

```ts
// v4.0.0
import { formatDecimalForPact } from "@stoachain/stoa-core/pact";
import { buildCFM_C_Coil }      from "@stoachain/ouronet-core/pact";
```

## 3. Breaking removals

Five v3.3.8-deprecated surfaces were removed. Migrate as follows.

### `KADENA_BASE_URL`

```ts
// pre-v4
import { KADENA_BASE_URL } from "@stoachain/ouronet-core/constants";
fetch(`${KADENA_BASE_URL}/chain/0/pact/api/v1/listen`, ...);
```

`KADENA_BASE_URL` was pinned to `node2.stoachain.com` and bypassed the v2.1.0 failover layer. Direct consumers reading this constant lost the node-recovery + node-degradation handling.

```ts
// v4.0.0
import { getPactUrl } from "@stoachain/stoa-core/constants";
fetch(`${getPactUrl("0")}/api/v1/listen`, ...);
```

`getPactUrl(chainId)` returns the failover-aware base URL for the given chain.

### `PACT_URL`

Same reasoning as `KADENA_BASE_URL`. Migration:

```ts
// pre-v4
import { PACT_URL } from "@stoachain/ouronet-core/constants";

// v4.0.0
import { getPactUrl } from "@stoachain/stoa-core/constants";
const pactUrl = getPactUrl("0");
```

### `GAS_STATION`

```ts
// pre-v4
import { GAS_STATION } from "@stoachain/ouronet-core/constants";

// v4.0.0
import { STOA_AUTONOMIC_OURONETGASSTATION } from "@stoachain/ouronet-core/constants";
```

The constant value is unchanged (`c:iQQFWj6gWtpGEzhM_O5ekW1QtnQQy55R8BRPGhj_0FU`) — only the name changed to the canonical form.

### `NATIVE_TOKEN_VAULT`

```ts
// pre-v4
import { NATIVE_TOKEN_VAULT } from "@stoachain/ouronet-core/constants";

// v4.0.0
import { STOA_AUTONOMIC_LIQUIDPOT } from "@stoachain/ouronet-core/constants";
```

Same value (`c:ZNfuj3iZI83n7MUSKGuoXoSxFg1cyMxCzB3szUHVvrI`), canonical name.

### `IKadenaKeypair` re-declaration in `interactions/ouroFunctions`

A Phase-2b backwards-compat copy of the canonical type lived in `@stoachain/ouronet-core/interactions/ouroFunctions.ts`. v4.0.0 removed it.

```ts
// pre-v4 (still works in v4.0.0 too — but the import path changed packages)
import type { IKadenaKeypair } from "@stoachain/ouronet-core/interactions/ouroFunctions";

// v4.0.0 (canonical)
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
```

The canonical interface is the one declared in `@stoachain/stoa-core/signing` — that's where the type has lived since v1.7.0; the `interactions/ouroFunctions` re-declaration was a backwards-compat artifact that finally retires here.

## 4. `@stoachain/ouronet-core/constants` re-exports (back-compat)

Internal `@stoachain/ouronet-core` source still imports chain-generic constants from `../constants`, so the `@stoachain/ouronet-core/constants` subpath re-exports them from `@stoachain/stoa-core/constants` for source-level back-compat. The following imports continue to work unchanged in v4.0.0:

```ts
// works in v4.0.0 — re-exported for back-compat
import {
  KADENA_NETWORK,
  KADENA_CHAIN_ID,
  STOA_CHAINS,
  STOA_CHAIN_COUNT,
  KADENA_CHAINS,
  getPactUrl,
  getSpvUrl,
} from "@stoachain/ouronet-core/constants";
```

New code SHOULD import them from `@stoachain/stoa-core/constants` directly to make the chain-generic vs Ouronet-specific boundary explicit:

```ts
// preferred for new code
import {
  KADENA_NETWORK,
  KADENA_CHAIN_ID,
  STOA_CHAINS,
  STOA_CHAIN_COUNT,
  KADENA_CHAINS,
  getPactUrl,
  getSpvUrl,
} from "@stoachain/stoa-core/constants";

// keep on @stoachain/ouronet-core/constants — Ouronet-specific
import {
  KADENA_NAMESPACE,
  STOA_AUTONOMIC_OUROBOROS,
  STOA_AUTONOMIC_LIQUIDPOT,
  STOA_AUTONOMIC_OURONETGASSTATION,
  MAIN_TOKENS,
} from "@stoachain/ouronet-core/constants";
```

## 5. Peer-dep version pinning

All `@kadena/*` + `@noble/curves` + `@scure/bip39` + `@stoachain/dalos-crypto` peer/dev deps moved from `^X.Y.Z` ranges to exact pins:

```diff
-    "@kadena/client": "^1.17.0",
+    "@kadena/client": "1.18.3",
-    "@kadena/cryptography-utils": "^0.4.0",
+    "@kadena/cryptography-utils": "0.4.4",
-    "@kadena/hd-wallet": "^0.6.0",
+    "@kadena/hd-wallet": "0.6.2",
-    "@kadena/types": "^0.7.0",
+    "@kadena/types": "0.7.0",
-    "@noble/curves": "^1.4.0",
+    "@noble/curves": "1.9.7",
-    "@scure/bip39": "^1.2.0",
+    "@scure/bip39": "1.6.0",
```

Consumer side: ensure your own `package.json` lists these `@kadena/*` peer deps at versions compatible with the exact pins above. The most common case is consumers carrying older `^1.17.x` `@kadena/client` — bump to `1.18.3`. If you're already on the same versions, the lockfile diff is the only visible change.

This is the prep work for v4.1.0's selective `@kadena/client` vendoring (supply-chain hardening after Kadena LLC's dissolution). Pinning first means we can audit the exact bytes consumers will pull in across the v4.0.0 → v4.1.0 cycle.

## 6. The `@stoachain/stoa-core` peer-dep on `@stoachain/ouronet-core`

`@stoachain/ouronet-core` peer-depends on `@stoachain/stoa-core` at exact version `4.0.0` (not `^4.0.0`). Both packages release atomically out of the monorepo at the same version, so range tolerance buys nothing and risks accidental cross-version mismatch in consumer trees. The exact pin makes the intent explicit.

If your consumer carries pinned versions of both packages:

```json
{
  "dependencies": {
    "@stoachain/stoa-core":    "4.0.0",
    "@stoachain/ouronet-core": "4.0.0"
  }
}
```

…npm/pnpm/yarn dedupe both consumers down to a single `node_modules/@stoachain/stoa-core/` install — no doubling.

## 7. Tests, types, build behaviour

For consumers running their own type-check / test gates against the upgrade:

  - **Types**: surfaces moved to `@stoachain/stoa-core` carry the same exported types they had on `@stoachain/ouronet-core` v3.3.8. `IKadenaKeypair`, `IKeyset`, `Logger`, `KeyResolver`, `PactClient`, `BalanceResolver`, `StorageAdapter`, etc. are all structurally unchanged.
  - **Tests**: stoa-core's regression-lock test files retain the same `it`-block names and assertions; ouronet-core's regression-lock test files retain the same. Total coverage went from 698 (v3.3.8) → 703 (v4.0.0) because the v3.3.8 `tests/v3-3-8-doc-cleanup.test.ts` regression-lock file split — F-ARCH-011/F-ARCH-012 locks now live in `@stoachain/stoa-core/tests/v3-3-8-doc-cleanup.test.ts` (where their SUTs live), F-API-016 lock stays in `@stoachain/ouronet-core/tests/v3-3-8-doc-cleanup.test.ts`. No test was deleted.
  - **Build behaviour**: subpath imports like `@stoachain/stoa-core/signing` resolve through the package's `exports` field at consumer-build time, mapped to `dist/signing/index.js` + `dist/signing/index.d.ts`. The dev-time `paths` mapping in this monorepo's `tsconfig.base.json` is internal — consumers don't see it.

## 8. Going forward

  - **v4.1.0** — selective vendoring of `@kadena/client` (supply-chain hardening). Consumers will see the `@kadena/client` peer-dep range narrow further or drop entirely (replaced by an internal vendored copy with audited bytes). The exact pinning in v4.0.0 is the audit floor.
  - **v4.2.0+** — internal architecture cleanup (god-file decomposition in `interactions/ouroFunctions.ts`, type consolidation, perf hot-path tuning).
  - **v5.0.0** — `readonly` modifiers across the public type surface (immutability sweep). Consumer mutation patterns will surface as type errors at the upgrade — read v5.0.0's MIGRATION-v5.md when it ships.

The next major version is when API shape changes; minor versions stay additive within the v4.x line.
