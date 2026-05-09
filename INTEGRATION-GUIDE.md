# OuronetCore Integration Guide

A comprehensive cold-start consumer onboarding document for the StoaChain TypeScript stack — `@stoachain/kadena-stoic-legacy`, `@stoachain/stoa-core`, and `@stoachain/ouronet-core` — at version `4.2.0` (atomic-triplet release).

This guide is the canonical reference for any LLM agent or human engineer integrating these packages cold (no prior context on the StoaChain monorepo, the v4.x architecture, the Ouronet protocol, or the audit history). The reader's only inputs are the npm registry, the published packages, and this document. The reader's first task is wiring the three pluggable seams in OuronetUI (browser SPA) or AncientHolder HUB (Node.js server).

For upgrade-flavor specifics (what changed between two adjacent versions), see [MIGRATION-v4.md](./MIGRATION-v4.md), [MIGRATION-v4.1.md](./MIGRATION-v4.1.md), and [MIGRATION-v4.2.md](./MIGRATION-v4.2.md). This integration guide is the cold-start onboarding doc; the MIGRATION docs are the upgrade-flavor diff docs. They complement, they do not duplicate.

---

## 1. Preamble & TL;DR

The StoaChain TypeScript stack is a **3-package npm monorepo** under the `@stoachain` scope. As of v4.2.0 (atomic across the triplet), the three packages are:

- **`@stoachain/kadena-stoic-legacy@4.2.0`** — sovereign, byte-identical vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` at the upstream-pinned versions (`1.18.3 / 0.4.4 / 0.7.0 / 0.6.2`). The supply-chain hardening response to Kadena LLC's dissolution; downstream consumers no longer take an indefinite risk on unmaintained `@kadena/*` upstreams.
- **`@stoachain/stoa-core@4.2.0`** — chain-generic StoaChain TypeScript foundation: signing, wallet, crypto codex encryption, network failover, gas calibration, guard analysis, DALOS integration, observability, error classes, pact-format helpers. Consumed by `@stoachain/ouronet-core` and any other StoaChain consumer (CLI tools, validators, third-party integrations).
- **`@stoachain/ouronet-core@4.2.0`** — Ouronet protocol business logic: codex backup format, the entity-oriented `interactions/*` Pact builders for the `ouronet-ns` modules, the `STOA_AUTONOMIC_*` autonomic accounts, and the cfm Pact-code assembler. Built on top of `@stoachain/stoa-core`.

**These packages ARE:**

- Pact builders (Kadena chain transaction assembly with proper gas calibration and signing capabilities)
- Codex signing strategy (encrypted multi-wallet format, SLIP-10/BIP32-Ed25519 key derivation, partial-sig orchestration)
- Guard analysis (keyset reduction, smart-account auth resolution, predicate semantics)
- Encryption primitives (V2 PBKDF2-SHA256 / 600k iters, V1 legacy decrypt with one-shot security advisory)
- Gas calibration (network-aware gas-limit and gas-price calculation)
- DALOS key-gen (Genesis curve registration; Leto/Artemis/Apollo opt-in via `./dalos`)
- Network failover (Stoa node health-check + automatic switch on RPC failure)

**These packages ARE NOT:**

- A UI framework (no React, no Vue, no DOM)
- A server framework (no Express, no Fastify, no HTTP listener)
- A runtime entry point (`main` is `dist/index.js` but the index barrels are intentionally near-empty — see Section 4)

In short: this is a **library, not an app**. Consumers wire the seams once at boot and call the public API directly.

**Atomic-triplet release pattern.** All 3 packages bump together to a single version on the same `vX.Y.Z` git tag. The `peerDependencies` declarations enforce this: `stoa-core@4.2.0` peers `kadena-stoic-legacy@4.2.0`, `ouronet-core@4.2.0` peers both. Consumers should install all 3 at the same version; mixing versions across the triplet violates the peer-dep declaration and produces npm warnings (and at runtime, may produce subtle shape mismatches if a transitive imports stoa-core internals).

**SLSA provenance.** The publish workflow uses `npm publish --provenance` for SLSA-3 attestations. Consumers can verify a tarball's GitHub Actions origin via `npm audit signatures`.

**Recommended install target:** `4.2.0` (current major.minor at the time of this guide).

---

## 2. Architecture history

The v4.x line is the architectural-closures arc. Four milestones, each with a tight scope and a corresponding migration doc.

### v4.0.0 — Monorepo split (2026-04-21)

**What.** The original single-package `@stoachain/ouronet-core@3.3.8` was split into two atomic-release npm packages under a new GitHub monorepo (`StoaChain/stoa-js`): `@stoachain/stoa-core` (chain-generic foundation) + `@stoachain/ouronet-core` (Ouronet-specific protocol). Both packages release atomically out of the monorepo at the same version — a single `vX.Y.Z` git tag publishes both.

**Why.** v3.3.8 had accumulated chain-generic surface (signing, wallet, crypto, network, gas, guard, DALOS) tangled with Ouronet-protocol-specific surface (codex backup format, the `interactions/*` Pact builders for `ouronet-ns` modules). Other StoaChain consumers (CLI tools, validators) wanted the chain-generic surface without dragging the Ouronet-specific surface along. The split untangles them.

**Consumer impact.**

- Consumers using only the Ouronet-specific surface keep `@stoachain/ouronet-core` and bump the version.
- Consumers using chain-generic surfaces add `@stoachain/stoa-core` and update import paths (the v4.0 migration doc has the full rewrite map).
- The v3.3.8-deprecated aliases were removed: `KADENA_BASE_URL`, `PACT_URL`, `GAS_STATION`, `NATIVE_TOKEN_VAULT`, the duplicate `IKadenaKeypair` interface in `interactions/ouroFunctions.ts`.

**Sample import rewrite (from MIGRATION-v4.md):**

```ts
// v3.3.8 (single package):
import { signTransaction } from "@stoachain/ouronet-core/signing";

// v4.0.0 (chain-generic surface moved to stoa-core):
import { signTransaction } from "@stoachain/stoa-core/signing";
```

See [MIGRATION-v4.md](./MIGRATION-v4.md) for the full v3 → v4 upgrade map (12,125 bytes of move-by-move detail).

### v4.1.0 — Sovereign supply-chain vendoring (2026-05-04)

**What.** The third package — `@stoachain/kadena-stoic-legacy@4.1.0` — was born. It vendors `@kadena/{client,cryptography-utils,types,hd-wallet}` byte-identical to upstream (`1.18.3 / 0.4.4 / 0.7.0 / 0.6.2`) under StoaChain's stewardship. `@stoachain/stoa-core@4.1.0` and `@stoachain/ouronet-core@4.1.0` retarget all internal `@kadena/*` imports onto the new sibling subpaths. Bumps the Node engines floor to `>=22.12` (kadena-stoic-legacy needs `require(esm)` default-on for the `@kadena/client` CJS interop). 5 documented modifications-from-upstream are listed in `packages/kadena-stoic-legacy/LICENSE-attribution.md`; the SHA256 manifest is at `packages/kadena-stoic-legacy/VENDOR-MANIFEST.sha256`.

**Why.** After Kadena LLC's dissolution, the StoaChain ecosystem cannot accept indefinite supply-chain risk on unmaintained upstream npm packages. v4.1.0 is the response: a sovereign, audit-trail-bearing, byte-identical fork.

**Consumer impact.**

- Drop the four `@kadena/*` peer-dep declarations from your project's `package.json`.
- Add `@stoachain/kadena-stoic-legacy: "4.1.0"` as a peer-dep.
- Bump Node engines floor to `>=22.12` (required by kadena-stoic-legacy for `require(esm)` default-on).
- If your project DIRECTLY imports from `@kadena/*` (NOT through stoa-core or ouronet-core), you have a choice — keep importing from upstream OR retarget your imports onto `@stoachain/kadena-stoic-legacy/*` for supply-chain alignment.

**Sample import rewrite:**

```ts
// v4.0 (upstream @kadena/*):
import { Pact } from "@kadena/client";

// v4.1 (vendored under StoaChain's stewardship — supply-chain alignment):
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
```

See [MIGRATION-v4.1.md](./MIGRATION-v4.1.md) for the full v4.0 → v4.1 rewrite map (15,964 bytes, including the SHA256-manifest verification recipe).

### v4.1.1 — Audit-closure patch (2026-05-08)

**What.** A tightly-scoped patch closing seven HIGH-severity audit findings without breaking changes. Five new typed error classes were introduced. The codex codec was frozen at format `"1.2"` with strict-shape enforcement (`CodexUnknownFieldError`). Smart Ouronet Account auth (Σ-prefix) gained a typed error (`SmartAccountAuthError`) for the `enforce-one` over (account guard / sovereign guard / governor) resolution. The `SeedType` discriminator was deduplicated (`UnknownSeedTypeError`). `SigningError` adopted ES2022 `Error.cause` chaining. The `firstSignableButUnsatisfied` field was made required on smart-account auth paths.

**Why.** v3.x → v4.0 → v4.1 was structural; v4.1.1 was hygiene. The audit log surfaced edge cases (fabricated `"0"` fallbacks in `kadenaFunctions`, lax codec parsing) that the structural refactors had not addressed. v4.1.1 closes them with typed errors so consumers can `try/catch` precisely.

**Consumer impact.**

- 5 new typed error classes — `KadenaShapeError`, `MnemonicMismatchError`, `SmartAccountAuthError`, `CodexUnknownFieldError`, `UnknownSeedTypeError`. Section 5 documents each.
- The codex backup format is **frozen at `"1.2"`** — never bump the version string (read `packages/ouronet-core/src/codex/codec.ts` JSDoc before touching the codec).
- `getSublimateInfo` was deduplicated with a deprecation shim (backward-compatible).

**Sample try/catch demonstrating ES2022 `cause` chaining:**

```ts
import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";
import { SigningError } from "@stoachain/stoa-core/errors";

try {
  await strategy.execute(transaction);
} catch (e) {
  if (e instanceof SigningError) {
    console.error("signing failed:", e.message);
    if (e.cause) {
      console.error("underlying:", e.cause);
    }
  } else {
    throw e;
  }
}
```

See the v4.1.1 appendix in [MIGRATION-v4.1.md](./MIGRATION-v4.1.md) for the closure-state matrix.

### v4.2.0 — Architectural closures (2026-05-MM)

**What.** The architectural-closures milestone. Four sub-deliverables:

1. **God-file splits with 7-entity Ouronet taxonomy** (Phases 1+2). The single `dexFunctions.ts` (~1.8k LOC) split into 11 entity files (`dexTypes`, `dexParseFunctions`, 5 `dexSwapPair*Functions`, `dexTrueFungibleFunctions`, `dexOrtoFungibleFunctions`, `dexCollectablesFunctions`, `dexAcquisitionPoolFunctions`). The single `ouroFunctions.ts` split into 12 entity files (`ouroTypes`, `ouroAccountFunctions`, `ouroPrimordialsFunctions`, `ouroSubCompressFunctions`, `ouroWrapFunctions`, `ouroTransferFunctions`, `ouroMovieBoosterFunctions`, `ouroCoilFunctions`, `ouroBalanceFunctions`, `ouroRotateFunctions`, `ouroPriceFunctions`, `ouroUrStoaFunctions`). Both `dexFunctions.ts` and `ouroFunctions.ts` survive as **thin re-export shims** for backward compatibility with the v4.0/v4.1 import surface — all v4.x consumers continue to work without import-path changes.
2. **Parameterized liquidity executor** (Phase 3). The 5 add-liquidity variants collapsed into a single parameterized executor with 5 thin wrappers preserving the public signatures.
3. **Nullable contract** (Phase 4). 12 dashboard/calculation functions in `dexFunctions` (and the entity-oriented descendants) now `return null` on RPC failure instead of throwing — matching their declared `Promise<T | null>` return type. Consumers using `try/catch` continue to work; new code can rely on the truthy-check pattern (`if (result === null) showError()`).
4. **Readonly sweep** (Phase 5). ~85 readonly modifiers added to public types across stoa-core + ouronet-core. TypeScript-only signal; no runtime impact. Consumers that previously mutated fields in place must switch to immutable patterns: `const updated = { ...x, field: newValue };`. Compile-time errors surface any violations under `tsc --noEmit`.

Plus broader test-coverage breadth (110+ new specs across 6 modules covering 37 previously-untested exports), build/type/doc/scripts hardening, and this `INTEGRATION-GUIDE.md` deliverable.

**Why.** v4.0/v4.1 unblocked the supply-chain risk and the architectural split. v4.1.1 closed the typed-error gap. v4.2.0 closes the architectural-clarity gap: the god-files were impossible to navigate, the nullable contract was inconsistently honored, the readonly intent was unenforced, and consumers had no cold-start onboarding doc.

**Consumer impact.**

- **Thin shims preserve backward compat.** `import { calculateDirectSwap } from "@stoachain/ouronet-core/interactions/dexFunctions";` continues to work. New code SHOULD migrate to the entity-oriented subpaths (`@stoachain/ouronet-core/interactions/dexSwapPairCalcFunctions`) for better tree-shaking and clearer intent.
- **Nullable returns are now reliable.** 12 dashboard/calc functions return `null` on RPC failure consistently. Consumers can drop their `try/catch` and use `if (result === null) ...` checks.
- **Readonly is a typecheck-time signal.** Consumers that used to do `analysis.threshold = 2;` now get TS2540. Migrate to `const updated = { ...analysis, threshold: 2 };`. No runtime cost.
- **Cold-start onboarding doc** — this document.

See [MIGRATION-v4.2.md](./MIGRATION-v4.2.md) (Phase 9 deliverable) for the full upgrade-flavor v4.1.x → v4.2.0 transition guide.

---

## 3. Per-package install

The atomic-triplet pattern: install all 3 packages at the same version. Mixing versions violates the peer-dep declaration.

```bash
npm install \
  @stoachain/kadena-stoic-legacy@4.2.0 \
  @stoachain/stoa-core@4.2.0 \
  @stoachain/ouronet-core@4.2.0
```

Or pinned individually (equivalent):

```bash
npm install @stoachain/kadena-stoic-legacy@4.2.0
npm install @stoachain/stoa-core@4.2.0
npm install @stoachain/ouronet-core@4.2.0
```

**Peer-dependencies map (v4.2.0):**

```
@stoachain/kadena-stoic-legacy@4.2.0
  ├─ peerDependencies: (vendored upstream peers — see VENDOR-MANIFEST)
  └─ engines: node >=22.12

@stoachain/stoa-core@4.2.0
  ├─ peerDependencies:
  │   ├─ @stoachain/kadena-stoic-legacy: "4.2.0"
  │   ├─ @noble/curves: "1.9.7"
  │   └─ @scure/bip39: "1.2.1"
  └─ engines: node >=20

@stoachain/ouronet-core@4.2.0
  ├─ peerDependencies:
  │   ├─ @stoachain/kadena-stoic-legacy: "4.2.0"
  │   └─ @stoachain/stoa-core: "4.2.0"
  └─ engines: node >=20
```

**Node engines floor.** `kadena-stoic-legacy` requires Node `>=22.12` because it relies on `require(esm)` default-on for the `@kadena/client` CJS interop. `stoa-core` and `ouronet-core` are pure ESM and require `>=20`. Since the triplet is atomic, the effective floor for any consumer is `>=22.12`.

**Atomic-triplet enforcement at publish time.** The `.github/workflows/publish.yml` workflow gates publish on a tag-vs-package.json version-parity check across all 3 packages — the publish CI will refuse to publish if any package's `package.json` version disagrees with the git tag, or if any peer-dep declaration is inconsistent. Consumers can rely on the published tarballs being version-coherent.

**Sample `package.json` for a consumer (OuronetUI or HUB):**

```json
{
  "dependencies": {
    "@stoachain/kadena-stoic-legacy": "4.2.0",
    "@stoachain/stoa-core": "4.2.0",
    "@stoachain/ouronet-core": "4.2.0"
  },
  "engines": {
    "node": ">=22.12"
  }
}
```

---

## 4. Subpath imports per package

Every directory under `src/` corresponds to a subpath export declared in the package's `package.json`. **Consumers are explicitly steered toward subpath imports for tree-shaking** — the root barrels (`src/index.ts`) are intentionally near-empty (`export {}`):

```ts
// good — subpath import:
import { analyzeGuard } from "@stoachain/stoa-core/guard";

// not supported — barrel is intentionally near-empty:
import { analyzeGuard } from "@stoachain/stoa-core";
```

The TypeScript types travel with the runtime via the `"types"` keyword in the exports map. Consumers do not need separate `@types/*` packages.

### `@stoachain/kadena-stoic-legacy@4.2.0` — 6 subpaths

The vendored `@kadena/*` surface, ESM+CJS dual-mode for downstream interop.

| Subpath | Purpose | Canonical import |
|---|---|---|
| `.` (barrel) | Aggregate barrel — keep for compat | `import * as legacy from "@stoachain/kadena-stoic-legacy";` |
| `./client` | Kadena Pact client (transaction builder + submit) | `import { Pact } from "@stoachain/kadena-stoic-legacy/client";` |
| `./cryptography-utils` | Hashing, signing primitives | `import { hash } from "@stoachain/kadena-stoic-legacy/cryptography-utils";` |
| `./hd-wallet` | HD-wallet (BIP32-Ed25519, koala derivation) | `import { kadenaGenKeypairFromSeed } from "@stoachain/kadena-stoic-legacy/hd-wallet";` |
| `./hd-wallet/chainweaver` | Chainweaver-flavor HD-wallet (12-word mnemonic + WASM) | `import { kadenaGenMnemonic } from "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver";` |
| `./types` | Kadena type re-exports (PactCommand, etc.) | `import type { ICommand } from "@stoachain/kadena-stoic-legacy/types";` |

### `@stoachain/stoa-core@4.2.0` — 13 subpaths

Chain-generic StoaChain TypeScript foundation. ESM-only.

| Subpath | Purpose | Canonical import |
|---|---|---|
| `.` (barrel) | Near-empty (`export {}`) | (do not use; subpaths only) |
| `./constants` | Network/protocol constants | `import { CHAIN_IDS } from "@stoachain/stoa-core/constants";` |
| `./network` | Stoa node failover (`getActivePactUrl`, `getActiveSpvUrl`) | `import { getActivePactUrl } from "@stoachain/stoa-core/network";` |
| `./observability` | Pluggable logger (`setLogger`, `getLogger`, `Logger`) | `import { setLogger, getLogger } from "@stoachain/stoa-core/observability";` |
| `./gas` | Gas calibration | `import { calibrateGas } from "@stoachain/stoa-core/gas";` |
| `./guard` | Keyset analysis, predicate semantics, smart-account auth | `import { analyzeGuard } from "@stoachain/stoa-core/guard";` |
| `./crypto` | Codex encryption (V2 PBKDF2-SHA256, V1 legacy decrypt) | `import { decryptStringV2 } from "@stoachain/stoa-core/crypto";` |
| `./errors` | Error class re-exports (`SigningError`) | `import { SigningError } from "@stoachain/stoa-core/errors";` |
| `./signing` | Signing strategies + interfaces (`KeyResolver`, `PactClient`, `SigningStrategy`, `CodexSigningStrategy`, `IKadenaKeypair`) | `import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";` |
| `./wallet` | HD-keypair derivation (`KadenaWalletBuilder`) + runtime account class (`KadenaWallet`) + `BalanceResolver` seam | `import { KadenaWallet } from "@stoachain/stoa-core/wallet";` |
| `./reads` | Pluggable Pact reader (`setPactReader`, `pactRead`, `rawCalibratedDirtyRead`) | `import { setPactReader } from "@stoachain/stoa-core/reads";` |
| `./pact` | Pact-format helpers (envelope shape, capability composition) | `import { composeCap } from "@stoachain/stoa-core/pact";` |
| `./dalos` | DALOS account creation (Genesis curve registered by default; Leto/Artemis/Apollo opt-in) | `import { createDefaultRegistry } from "@stoachain/stoa-core/dalos";` |

**`./signing` is special.** It carries the 3 Phase-3-introduced abstraction interfaces (`KeyResolver`, `PactClient`, `SigningStrategy`) consumed by `CodexSigningStrategy`, plus the canonical `IKadenaKeypair` shape. Consumers who plug their own Codex backend (Redux-backed UI, file-backed server) implement the `KeyResolver` interface from this subpath.

### `@stoachain/ouronet-core@4.2.0` — 5 explicit + glob `./interactions/*`

Ouronet protocol business logic. ESM-only.

| Subpath | Purpose | Canonical import |
|---|---|---|
| `.` (barrel) | Near-empty (`export {}`) | (do not use; subpaths only) |
| `./constants` | Ouronet protocol constants (token namespaces, autonomic accounts) | `import { OURO_NS } from "@stoachain/ouronet-core/constants";` |
| `./codex` | Codex backup format (frozen at `"1.2"`); typed errors `CodexUnknownFieldError`, `UnknownSeedTypeError` | `import { CodexUnknownFieldError } from "@stoachain/ouronet-core/codex";` |
| `./pact` | Pact assembler for ouronet-ns Pact modules (cfm builder) | `import { buildCfm } from "@stoachain/ouronet-core/pact";` |
| `./interactions` | Barrel — re-exports ONLY `./ouroFunctions` (the canonical type source for `IOuroAccountKeypair`); 13 files have overlapping symbol names so the barrel is intentionally narrow | `import type { IOuroAccountKeypair } from "@stoachain/ouronet-core/interactions";` |
| `./interactions/*` (glob) | Per-file subpath access — auto-publishes new files added under `dist/interactions/*` | `import { ... } from "@stoachain/ouronet-core/interactions/<file>";` |

**The `./interactions/*` glob.** This is the broad public surface. Post-Phase-1+2 (v4.2.0), the glob covers ~22+ entity-oriented files. Each is independently importable for tree-shaking.

**Per-entity subpaths under `./interactions/*` (v4.2.0):**

```ts
// dex split — 11 files (post-Phase-1):
import { parseDecimalValue }            from "@stoachain/ouronet-core/interactions/dexParseFunctions";
import { calculateDirectSwap }          from "@stoachain/ouronet-core/interactions/dexSwapPairCalcFunctions";
import { executeSingleSwapWithSlippage } from "@stoachain/ouronet-core/interactions/dexSwapPairExecuteFunctions";
import { getAllPoolTokens }             from "@stoachain/ouronet-core/interactions/dexSwapPairSmartSwapFunctions";
import { getSWPairDashboardInfo }       from "@stoachain/ouronet-core/interactions/dexSwapPairDashboardFunctions";
import { describeModule }               from "@stoachain/ouronet-core/interactions/dexSwapPairAdminFunctions";
import { getTrueFungibleHeader }        from "@stoachain/ouronet-core/interactions/dexTrueFungibleFunctions";
import { getOrtoFungibleHeader }        from "@stoachain/ouronet-core/interactions/dexOrtoFungibleFunctions";
import { getCollectablesHeader }        from "@stoachain/ouronet-core/interactions/dexCollectablesFunctions";
// + dexAcquisitionPoolFunctions (Pact-pending placeholder)
// + dexTypes (type-only module)

// ouro split — 12 files (post-Phase-2):
import { ... } from "@stoachain/ouronet-core/interactions/ouroAccountFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroPrimordialsFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroSubCompressFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroWrapFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroTransferFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroMovieBoosterFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroCoilFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroBalanceFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroRotateFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroPriceFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroUrStoaFunctions";
// + ouroTypes (type-only module)

// Existing siblings (pre-Phase-1/2):
import { ... } from "@stoachain/ouronet-core/interactions/addLiquidityFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/coilFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/pensionFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/infoOneFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/kpayFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/activateFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/guardFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/wrapFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/urStoaFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/kadenaFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/crossChainFunctions";

// Backward-compat shims (preserved for v4.x):
import { calculateDirectSwap } from "@stoachain/ouronet-core/interactions/dexFunctions";  // shim
import type { IOuroAccountKeypair } from "@stoachain/ouronet-core/interactions/ouroFunctions";  // shim

// Typed errors:
import { KadenaShapeError } from "@stoachain/ouronet-core/interactions/errors";
```

**Anti-pattern.** Do NOT import from the package root barrel. The intentional design is "subpath imports only" — the root barrel re-exports nothing useful (`export {}`).

**Anti-pattern.** Do NOT treat `dexFunctions.ts` or `ouroFunctions.ts` as real modules. They are thin shims that re-export from the entity-oriented files. New code should import from the entity-oriented subpaths directly.

---

## 5. The 5 typed error classes (and the broader consumer-relevant set)

v4.1.1 introduced 5 mandated typed error classes. v4.2.0 preserves them and adds documentation. The broader set (~14 classes) covers all consumer-relevant errors.

### The 5 mandated v4.1.1-introduced classes

#### `KadenaShapeError`

**From:** `@stoachain/ouronet-core/interactions/errors`

**Fires when** an `@kadena/client` response shape diverges from expected (e.g., `coin.details` returns a row but the balance field is missing). Pre-v4.1.1, `kadenaFunctions` fabricated a `"0"` fallback silently — v4.1.1 closes this with a typed throw (`KadenaShapeError`) carrying ES2022 `Error.cause` to the original envelope.

```ts
import { KadenaShapeError } from "@stoachain/ouronet-core/interactions/errors";
import { getBalance } from "@stoachain/ouronet-core/interactions/kadenaFunctions";

try {
  const balance = await getBalance("k:abcd...");
} catch (e) {
  if (e instanceof KadenaShapeError) {
    console.error("Kadena envelope was malformed:", e.message, e.cause);
    return;
  }
  throw e;
}
```

#### `MnemonicMismatchError`

**From:** `@stoachain/stoa-core/wallet`

**Fires when** a derived public key disagrees with the imported one (i.e., the user typed the wrong mnemonic for an existing account, or the mnemonic-to-publicKey derivation produced a different key than the codex stored). The class extends `Error`.

```ts
import { MnemonicMismatchError } from "@stoachain/stoa-core/wallet";
import { KadenaWalletBuilder } from "@stoachain/stoa-core/wallet";

try {
  const wallet = await KadenaWalletBuilder.fromMnemonic(typedMnemonic, expectedPublicKey);
} catch (e) {
  if (e instanceof MnemonicMismatchError) {
    showError("That mnemonic does not match this account.");
    return;
  }
  throw e;
}
```

#### `SmartAccountAuthError`

**From:** `@stoachain/stoa-core/signing`

**Fires when** a Σ-prefix smart account guard analysis fails — i.e., the `enforce-one` over (account guard / sovereign guard / governor) cannot be resolved with the available signers. UI/consumer is responsible for picking the chosen branch BEFORE calling `execute`; if the chosen branch is unsatisfiable, this is the typed signal.

```ts
import { SmartAccountAuthError } from "@stoachain/stoa-core/signing";
import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";

try {
  await strategy.execute(transaction);
} catch (e) {
  if (e instanceof SmartAccountAuthError) {
    showError(`Smart-account auth failed for branch '${e.message}'`);
    return;
  }
  throw e;
}
```

#### `CodexUnknownFieldError`

**From:** `@stoachain/ouronet-core/codex`

**Fires when** a deserialized codex payload has unknown fields (strict-shape enforcement at format `"1.2"`). Pre-v4.1.1 the codec accepted forward-compat extra fields silently; v4.1.1 closes this so that any drift between writer and reader of the codex format is loud.

```ts
import { CodexUnknownFieldError } from "@stoachain/ouronet-core/codex";

try {
  const codex = await deserialize(blob);
} catch (e) {
  if (e instanceof CodexUnknownFieldError) {
    showError(`Codex format mismatch: ${e.message}`);
    return;
  }
  throw e;
}
```

#### `UnknownSeedTypeError`

**From:** `@stoachain/ouronet-core/codex`

**Fires when** a seed-type migration encounters an unrecognized type discriminator. The valid `SeedType` values are `koala | chainweaver | eckowallet`; anything else surfaces this typed error.

```ts
import { UnknownSeedTypeError } from "@stoachain/ouronet-core/codex";

try {
  await migrateSeedType(legacyCodexEntry);
} catch (e) {
  if (e instanceof UnknownSeedTypeError) {
    showError(`Unknown seed type — refusing to migrate: ${e.message}`);
    return;
  }
  throw e;
}
```

### The broader consumer-relevant Error class set

Beyond the v4.1.1 mandated 5, the following error classes are part of the consumer-relevant surface. They predate v4.1.1 but are documented here for completeness.

| Class | Subpath | Purpose |
|---|---|---|
| `WrongPasswordError` | `@stoachain/stoa-core/crypto` | Codex decrypt called with wrong password |
| `CorruptEnvelopeError` | `@stoachain/stoa-core/crypto` | Envelope ciphertext failed integrity check |
| `UnsupportedFormatError` | `@stoachain/stoa-core/crypto` | Codex envelope claims a format the runtime cannot decode |
| `SigningError` | `@stoachain/stoa-core/errors` | Universal-signing failure (carries `cause`) |
| `UnknownPredicateError` | `@stoachain/stoa-core/guard` | Guard predicate not in the supported set (`keys-all`, `keys-any`, `keys-2`, `keys-2-of-N`) |
| `InvalidLoggerError` | `@stoachain/stoa-core/observability` | `setLogger(value)` rejected non-Logger input (extends `TypeError`) |
| `InvalidPactReaderError` | `@stoachain/stoa-core/reads` | `setPactReader(value)` rejected non-function input (extends `TypeError`) |
| `InvalidEnvelopeError` | `@stoachain/stoa-core/signing` | Partial-sig envelope shape was wrong |
| `TamperedHashError` | `@stoachain/stoa-core/signing` | Partial-sig hash differed between rounds |

**Consolidated try/catch demonstrating ES2022 `error.cause` chaining:**

```ts
import {
  WrongPasswordError,
  CorruptEnvelopeError,
  UnsupportedFormatError,
} from "@stoachain/stoa-core/crypto";
import { SigningError } from "@stoachain/stoa-core/errors";
import { SmartAccountAuthError } from "@stoachain/stoa-core/signing";
import { CodexUnknownFieldError, UnknownSeedTypeError } from "@stoachain/ouronet-core/codex";
import { KadenaShapeError } from "@stoachain/ouronet-core/interactions/errors";

try {
  await fullFlow(transaction, password);
} catch (e) {
  // Crypto layer (codex decryption):
  if (e instanceof WrongPasswordError)        return showError("Wrong password.");
  if (e instanceof CorruptEnvelopeError)      return showError("Codex backup is corrupted.");
  if (e instanceof UnsupportedFormatError)    return showError("Codex format too new — upgrade required.");

  // Codex layer (parsing):
  if (e instanceof CodexUnknownFieldError)    return showError(`Codex schema drift: ${e.message}`);
  if (e instanceof UnknownSeedTypeError)      return showError(`Unknown seed type: ${e.message}`);

  // Signing layer:
  if (e instanceof SmartAccountAuthError)     return showError(`Smart-account auth failed: ${e.message}`);
  if (e instanceof SigningError) {
    const detail = e.cause ? ` (caused by: ${String(e.cause)})` : "";
    return showError(`Signing error${detail}: ${e.message}`);
  }

  // Chain layer (envelope shape):
  if (e instanceof KadenaShapeError) {
    return showError(`Kadena envelope mismatch: ${e.message}`);
  }

  // Unknown — propagate.
  throw e;
}
```

The pattern is: **catch the most specific class first, fall through to less specific, throw on unknown.** ES2022 `Error.cause` chaining lets each layer add context without losing the original exception.

---

## 6. Pluggable seam wiring

The 3-package stack stays environment-agnostic via three narrow injection points. Consumers wire each seam once; core stays free of framework dependencies (no DI container, no service locator).

### Seam 1: `setPactReader` (function-shaped, global)

**From:** `@stoachain/stoa-core/reads`

**What.** A single function-shaped seam: consumers call `setPactReader(fn)` once at boot to plug in their preferred Pact reader. Core's interaction code calls `pactRead(...)` (a wrapper), which routes to whatever the consumer configured (or falls back to `rawCalibratedDirtyRead` if nothing was configured).

**Why.** The browser SPA needs a cache-aware reader (per-keystroke deduplication, tier-based TTLs) so that Smart Swap doesn't flicker on every input change. The server has no React lifecycle and no React-flavored cache; it leaves the default uncached reader installed.

**When to wire.** Once at boot — before any code path reaches `pactRead(...)`. Wiring it later is fine but produces a window during which the default reader is active.

**Browser (OuronetUI):**

```ts
import { setPactReader } from "@stoachain/stoa-core/reads";
import { calibratedDirtyRead } from "./pact-query-cache"; // app-internal cache-aware reader

// At boot, before any chain reads:
setPactReader(calibratedDirtyRead);
```

**Server (HUB):**

```ts
import { setPactReader, rawCalibratedDirtyRead } from "@stoachain/stoa-core/reads";

// Either explicitly install the raw reader (clarity)…
setPactReader(rawCalibratedDirtyRead);

// …or skip the call entirely; the default IS rawCalibratedDirtyRead.
```

**Validating the wiring at boot.** `setPactReader` rejects non-function values via `InvalidPactReaderError extends TypeError`:

```ts
import { setPactReader, InvalidPactReaderError } from "@stoachain/stoa-core/reads";

try {
  setPactReader(undefined as any); // simulating a misconfigured boot
} catch (e) {
  if (e instanceof InvalidPactReaderError) {
    console.error("setPactReader misconfigured:", e.message);
    process.exit(1);
  }
}
```

### Seam 2: `KeyResolver` + `PactClient` (interface-shaped, instance-level)

**From:** `@stoachain/stoa-core/signing`

**What.** Two TypeScript interfaces consumed by `CodexSigningStrategy`. Consumers implement the interfaces against their environment's storage and HTTP backend. NEVER import a concrete resolver into core.

- **`KeyResolver`** — given a Codex unlock context, returns the decrypted `IKadenaKeypair` for a given account address.
- **`PactClient`** — given a transaction envelope, submits it to a Pact endpoint. Browser-flavor uses `fetch`; server-flavor uses `node:http`.

**Why.** The browser unlocks the codex through a Redux-backed UI (the user types a password, the codex decrypts, the keys are held in Redux state). The server unlocks the codex from an encrypted file with an environment-supplied password. Different storage, different unlock UX, same interface.

**Browser (OuronetUI) — `ReduxCodexResolver`:**

```ts
import type { KeyResolver, PactClient, IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";

class ReduxCodexResolver implements KeyResolver {
  constructor(private store: ReduxStore) {}
  async resolve(address: string): Promise<IKadenaKeypair> {
    const decrypted = this.store.getState().codex.unlocked[address];
    if (!decrypted) {
      throw new Error(`No unlocked keypair for ${address}; unlock the codex first.`);
    }
    return decrypted;
  }
}

class FetchPactClient implements PactClient {
  async submit(envelope: unknown): Promise<unknown> {
    const response = await fetch(this.endpoint, { method: "POST", body: JSON.stringify(envelope) });
    return response.json();
  }
  constructor(private endpoint: string) {}
}

const strategy = new CodexSigningStrategy({
  keyResolver: new ReduxCodexResolver(reduxStore),
  pactClient: new FetchPactClient(getActivePactUrl(chainId)),
});
```

**Server (HUB) — `FileCodexResolver`:**

```ts
import { readFileSync } from "node:fs";
import type { KeyResolver, IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { decryptStringV2 } from "@stoachain/stoa-core/crypto";

class FileCodexResolver implements KeyResolver {
  constructor(private codexPath: string, private password: string) {}
  async resolve(address: string): Promise<IKadenaKeypair> {
    const blob = readFileSync(this.codexPath, "utf8");
    const codex = JSON.parse(await decryptStringV2(blob, this.password));
    const keypair = codex.accounts[address];
    if (!keypair) {
      throw new Error(`No codex entry for ${address}.`);
    }
    return keypair;
  }
}
```

### Seam 3: `BalanceResolver` (function-shaped type alias, instance-level)

**From:** `@stoachain/stoa-core/wallet`

**What.** A function alias type, NOT an interface — the instance-level analogue of `setPactReader`'s function-shaped seam. Each `KadenaWallet` instance carries its own `balanceResolver` field. Default throws a clearly-worded error if not configured (`getBalance()` propagates the resolver error).

**Why.** v4.x cuts the previous `wallet -> interactions` import edge: `KadenaWallet` no longer reaches into `@stoachain/ouronet-core/interactions/*` to fetch balances; instead the consumer wires whichever reader fits its environment (browser cache-aware read, server raw read, in-memory mock for tests) by assigning a `BalanceResolver`.

**Contract.**

- Resolves to the literal string `"0"` when the account does not yet exist on chain.
- Returns a decimal string (not a number, not a `BigNumber`) so callers keep full Kadena `decimal` precision.
- Asynchronous — implementations typically wrap a `coin.details` Pact read or a cache layered on top of one.

**Browser (OuronetUI) — `getFailoverClient`-based:**

```ts
import { KadenaWallet } from "@stoachain/stoa-core/wallet";
import type { BalanceResolver } from "@stoachain/stoa-core/wallet";
import { getActivePactUrl } from "@stoachain/stoa-core/network";

const browserBalanceResolver: BalanceResolver = async (address) => {
  const result = await fetch(getActivePactUrl("0"), {
    method: "POST",
    body: JSON.stringify({ pactCode: `(coin.details "${address}")` }),
  }).then((r) => r.json());
  return result?.result?.data?.balance ?? "0";
};

const wallet = new KadenaWallet({ publicKey, derivation: "koala" });
wallet.balanceResolver = browserBalanceResolver;

const balance = await wallet.getBalance(); // returns "0" or actual balance string
```

**Server (HUB) — direct chainweb query, no failover:**

```ts
import { KadenaWallet } from "@stoachain/stoa-core/wallet";
import type { BalanceResolver } from "@stoachain/stoa-core/wallet";

const serverBalanceResolver: BalanceResolver = async (address) => {
  const result = await myChainwebPool.dirtyRead(`(coin.details "${address}")`);
  return result?.balance ?? "0";
};

const wallet = new KadenaWallet({ publicKey, derivation: "koala" });
wallet.balanceResolver = serverBalanceResolver;
```

### Auxiliary seam: `setLogger` / `getLogger`

**From:** `@stoachain/stoa-core/observability`

**What.** A pluggable logger. Every `setPactReader` consumer test setup also calls `setLogger(spy)` so that core's call sites (network failover warnings, error catch blocks, debug helpers) can be observed in unit tests.

**Why.** Core's logging needs to route to the consumer's preferred sink (browser console, server file log, structured JSON logger). Default routes to `console.warn` / `console.error`.

```ts
import { setLogger, getLogger, type Logger } from "@stoachain/stoa-core/observability";

class StructuredLogger implements Logger {
  warn(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: "warn", message, ...meta }));
  }
  error(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: "error", message, ...meta }));
  }
}

setLogger(new StructuredLogger());
```

`setLogger` rejects non-Logger inputs via `InvalidLoggerError extends TypeError`. Catch at boot if your project does runtime config validation.

---

## 7. The 7-entity Ouronet taxonomy

Post-Phase-1+2 (v4.2.0), the Ouronet protocol's chain-interaction surface is organized around 7 entities. Each entity has its own file (or set of files) under `@stoachain/ouronet-core/interactions/*`. Every chain-interaction function (read or write) belongs to exactly ONE entity.

| Entity | Description | File home (under `interactions/`) | Canonical import |
|---|---|---|---|
| **TF** (TrueFungibles) | Standard fungible tokens (OURO, IGNIS, AURYN, EAURYN, etc.) | `dexTrueFungibleFunctions.ts` | `import { getTrueFungibleHeader } from "@stoachain/ouronet-core/interactions/dexTrueFungibleFunctions";` |
| **OF** (OrtoFungibles) | Yield-bearing receipt tokens (WSTOA, SSTOA, etc.) | `dexOrtoFungibleFunctions.ts` | `import { getOrtoFungibleHeader } from "@stoachain/ouronet-core/interactions/dexOrtoFungibleFunctions";` |
| **Collectables** | Semi+Non-fungible collectable tokens | `dexCollectablesFunctions.ts` | `import { getCollectablesHeader } from "@stoachain/ouronet-core/interactions/dexCollectablesFunctions";` |
| **ASP** (AutostakePairs) | Automatic-stake pair primordials | `ouroPrimordialsFunctions.ts` (auto-stake-relevant subset) | `import { ... } from "@stoachain/ouronet-core/interactions/ouroPrimordialsFunctions";` |
| **SWP** (SwapPairs) | DEX swap pairs — decomposed into 5 sub-domains: calc, execute, smart-swap, dashboard, admin | 5 files: `dexSwapPairCalcFunctions`, `dexSwapPairExecuteFunctions`, `dexSwapPairSmartSwapFunctions`, `dexSwapPairDashboardFunctions`, `dexSwapPairAdminFunctions` | (see Section 4 imports) |
| **AP** (AcquisitionPools) | Pact-pending placeholder; no chain-call functions yet | `dexAcquisitionPoolFunctions.ts` (placeholder) | (no exports yet) |
| **OURO** core operations | Account, primordials, sub-compress, wrap, transfer, movie-booster, coil, balance, rotate, price, urStoa | 11 files under `ouro*Functions.ts` | (see Section 4 imports) |

**Locked principle (from Phase 2 architecture review):**

> Any function that performs a chain interaction stays in `ouronet-core` regardless of which UI consumes it. Only pure UI decoration extracts to OuronetUI.

This means: a function that reads `getPrimordials()` from chain stays in `ouronet-core` even if its primary consumer is the OuronetUI Wallet view. Only the *display* layer (icon paths, currency symbols, button text) extracts. Section 8 covers the decoration boundary in detail.

**Per-entity 1-line code blocks:**

```ts
// TF — TrueFungibles:
import { getTrueFungibleHeader } from "@stoachain/ouronet-core/interactions/dexTrueFungibleFunctions";

// OF — OrtoFungibles:
import { getOrtoFungibleHeader } from "@stoachain/ouronet-core/interactions/dexOrtoFungibleFunctions";

// Collectables:
import { getCollectablesHeader } from "@stoachain/ouronet-core/interactions/dexCollectablesFunctions";

// SWP — SwapPair (the 5 sub-domains):
import { calculateDirectSwap }          from "@stoachain/ouronet-core/interactions/dexSwapPairCalcFunctions";
import { executeSingleSwapWithSlippage } from "@stoachain/ouronet-core/interactions/dexSwapPairExecuteFunctions";
import { getAllPoolTokens }             from "@stoachain/ouronet-core/interactions/dexSwapPairSmartSwapFunctions";
import { getSWPairDashboardInfo }       from "@stoachain/ouronet-core/interactions/dexSwapPairDashboardFunctions";
import { describeModule }               from "@stoachain/ouronet-core/interactions/dexSwapPairAdminFunctions";

// OURO — sample subset:
import { ... } from "@stoachain/ouronet-core/interactions/ouroAccountFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroPrimordialsFunctions";
import { ... } from "@stoachain/ouronet-core/interactions/ouroBalanceFunctions";
```

---

## 8. UI-decoration responsibilities

Phase 2 of v4.2.0 produced a surgical chain/UI separation contract. Functions that perform chain interactions stay in `ouronet-core`. Pure UI decoration extracts to OuronetUI (or the equivalent layer in any alternative UI consumer).

The decoration layer is **per-token metadata** that the chain does not carry. The chain returns raw amounts and addresses; the UI dresses them up.

### Per-token decoration field-set (the shape OuronetUI must reproduce)

For each Ouronet token (OURO, IGNIS, AURYN, EAURYN, WSTOA, SSTOA, GSTOA, URSTOA), OuronetUI maintains a decoration record approximately of this shape:

```ts
interface TokenDecoration {
  // Visual identity:
  iconPath: string;                    // e.g., "/icons/ouro.svg"
  iconBgColor?: string;                // hex, e.g., "#1a1a1a"
  isGoldIcon?: boolean;                // gold-tier styling
  isStoneIcon?: boolean;               // stone-tier styling
  currencySymbol: string;              // e.g., "OURO"
  currencyColor?: string;              // hex foreground for symbol

  // Action capabilities (what UI buttons to render):
  availableActions: string[];          // e.g., ["transfer", "wrap", "coil"]
  notImplementedActions?: string[];    // grey out these
  forceGoldActions?: boolean;          // gold-tier button styling

  // Display labels:
  displayName: string;                 // e.g., "Ouronet Native"
  keepTransferNames?: boolean;         // override default transfer label
  supplyLabel?: string;                // e.g., "Total Supply"
  supplyRow?: number;                  // grid row index
  balanceLabel?: string;               // e.g., "Your Balance"
  balanceRow?: number;
  virtualLabel?: string;               // for synthetic tokens
  suffix?: string;                     // appended to amount displays
  suffixColor?: string;

  // Layout:
  maxButtonsPerRow?: number;
  hideSupplySeparator?: boolean;
  hideSupplyRow?: boolean;
  leadingBalanceRow?: number;
  postSupplyRow?: number;
  middleBalanceRows?: number[];
  extraBalanceRow?: number;
  customBalanceRows?: Array<{ label: string; row: number }>;
  codexBalance?: boolean;              // pull from codex, not chain
  hidePrice?: boolean;
  textAlignTop?: boolean;
}
```

This shape is illustrative — OuronetUI's actual record may differ slightly. The key is: **anything visual or label-text-related is UI's responsibility; anything chain-call-related stays in ouronet-core**.

### What stays in ouronet-core (chain calls)

`getPrimordials()` returns the RAW chain data (token metadata, supply numbers, balance numbers, account addresses). The function lives in `@stoachain/ouronet-core/interactions/ouroPrimordialsFunctions` (Phase 2 split target). It does NOT include any of the decoration fields above.

```ts
import { getPrimordials } from "@stoachain/ouronet-core/interactions/ouroPrimordialsFunctions";

const raw = await getPrimordials("k:user-public-key");
// raw.tokens[i] = { tokenId: "OURO", balance: "1234.56", supply: "1000000.0", ... }
// — NO iconPath, NO iconBgColor, NO availableActions, etc.
```

The UI consumer joins `raw.tokens[i]` to its `decorations[tokenId]` record at render time:

```ts
function renderToken(raw: PrimordialToken, deco: TokenDecoration) {
  return <TokenCard
    icon={deco.iconPath}
    bg={deco.iconBgColor}
    label={deco.displayName}
    amount={raw.balance}
    suffix={deco.suffix}
    actions={deco.availableActions}
  />;
}
```

### v4.2.0 vs v5.0.0 boundary

v4.2.0 is **physically conservative + documentationally complete**: the decoration data still lives wherever it lived pre-v4.2.0 (typically in OuronetUI), and the `ouroPrimordialsFunctions` chain-call returns just the raw data. The decoration extraction is documented (this section + the Phase 2 sub-deliverable `phases/02-ouro-split-and-chain-ui-separation/primordials-ui-decoration-inventory.md`) so an alternative UI consumer can reproduce the previous behavior.

v5.0.0 is the planned cutover for any decoration data still living in `ouronet-core` to fully extract to consumers.

---

## 9. Code-mod scripts

For consumers upgrading from v3.x → v4.x → v4.1.x → v4.2.0, the following code-mod scripts cover the import-path rewrites and the readonly-compat consumer rewrites.

### Code-mod 1: v3.x → v4.0 import path rewrites (monorepo split)

```bash
# Move chain-generic surfaces from @stoachain/ouronet-core/* to @stoachain/stoa-core/*:
sed -i 's#@stoachain/ouronet-core/signing#@stoachain/stoa-core/signing#g' src/**/*.ts
sed -i 's#@stoachain/ouronet-core/wallet#@stoachain/stoa-core/wallet#g'   src/**/*.ts
sed -i 's#@stoachain/ouronet-core/crypto#@stoachain/stoa-core/crypto#g'   src/**/*.ts
sed -i 's#@stoachain/ouronet-core/network#@stoachain/stoa-core/network#g' src/**/*.ts
sed -i 's#@stoachain/ouronet-core/gas#@stoachain/stoa-core/gas#g'         src/**/*.ts
sed -i 's#@stoachain/ouronet-core/guard#@stoachain/stoa-core/guard#g'     src/**/*.ts
sed -i 's#@stoachain/ouronet-core/dalos#@stoachain/stoa-core/dalos#g'     src/**/*.ts
```

Then `npm run typecheck` to find any imports the sed rewrite missed (uncommon symbol-for-symbol overlaps).

### Code-mod 2: v4.0 → v4.1 import path rewrites (sovereign vendoring)

```bash
# Reroute upstream @kadena/* to the @stoachain/kadena-stoic-legacy/* subpaths:
sed -i 's#@kadena/client#@stoachain/kadena-stoic-legacy/client#g'                   src/**/*.ts
sed -i 's#@kadena/cryptography-utils#@stoachain/kadena-stoic-legacy/cryptography-utils#g' src/**/*.ts
sed -i 's#@kadena/hd-wallet#@stoachain/kadena-stoic-legacy/hd-wallet#g'             src/**/*.ts
sed -i 's#@kadena/types#@stoachain/kadena-stoic-legacy/types#g'                     src/**/*.ts
```

Then update `package.json`: drop the four `@kadena/*` peer-deps, add `"@stoachain/kadena-stoic-legacy": "4.1.0"`, bump engines floor to `>=22.12`.

### Code-mod 3: v4.1 → v4.2 readonly-compat consumer rewrites

The Phase 5 readonly sweep (~85 fields) makes mutation a typecheck error. There is **no automatic sed rewrite** for this (the find/replace is structural — you need to know whether each mutation is correct). Instead, run `tsc --noEmit` and let the compiler surface every TS2540 ("Cannot assign to '<field>' because it is a read-only property") error.

For each TS2540, rewrite the mutation to a spread-copy:

```diff
- analysis.threshold = 2;
+ const next = { ...analysis, threshold: 2 };
```

Or, if the original code mutated within a function:

```diff
- function bumpThreshold(g: Guard) {
-   g.threshold = 2;
- }
+ function bumpThreshold(g: Guard): Guard {
+   return { ...g, threshold: 2 };
+ }
```

There is no runtime cost — readonly is a pure TypeScript-level signal. The spread-copy idiom is the canonical immutable-update pattern.

### Code-mod 4 (optional): v4.2 entity-oriented subpath migration

For new code, prefer the entity-oriented subpaths over the `dexFunctions` / `ouroFunctions` shims. There is no automatic rewrite (the shim is a thin re-export, so the import works either way), but for tree-shaking and clearer intent:

```diff
- import { calculateDirectSwap } from "@stoachain/ouronet-core/interactions/dexFunctions";
+ import { calculateDirectSwap } from "@stoachain/ouronet-core/interactions/dexSwapPairCalcFunctions";
```

The shim continues to work for backward-compat in the v4.x line. v5.0.0 may remove the shims (see Section 13).

---

## 10. Worked example

A complete consumer integration walkthrough in one TypeScript file. Demonstrates: install → seam wiring → sample read → sample write → error catching → readonly compatibility.

### Step 1: Install

```bash
npm install \
  @stoachain/kadena-stoic-legacy@4.2.0 \
  @stoachain/stoa-core@4.2.0 \
  @stoachain/ouronet-core@4.2.0
```

### Step 2: `integration-example.ts`

```ts
// integration-example.ts
//
// A complete consumer walkthrough — server-flavor (HUB-style).
// Adapt for browser by swapping balanceResolver + KeyResolver implementations.

import {
  setPactReader,
  rawCalibratedDirtyRead,
} from "@stoachain/stoa-core/reads";
import {
  setLogger,
  getLogger,
  type Logger,
} from "@stoachain/stoa-core/observability";
import {
  KadenaWallet,
  KadenaWalletBuilder,
  MnemonicMismatchError,
} from "@stoachain/stoa-core/wallet";
import type { BalanceResolver } from "@stoachain/stoa-core/wallet";
import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";
import type { KeyResolver, PactClient, IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { SigningError } from "@stoachain/stoa-core/errors";
import { SmartAccountAuthError } from "@stoachain/stoa-core/signing";
import {
  CodexUnknownFieldError,
  UnknownSeedTypeError,
} from "@stoachain/ouronet-core/codex";
import { KadenaShapeError } from "@stoachain/ouronet-core/interactions/errors";
import {
  calculateDirectSwap,
} from "@stoachain/ouronet-core/interactions/dexSwapPairCalcFunctions";
import { wrapKadena } from "@stoachain/ouronet-core/interactions/wrapFunctions";

// ---------------------------------------------------------------------------
// Step 2a — wire the seams once at boot.

class StructuredLogger implements Logger {
  warn(msg: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: "warn", msg, ...meta }));
  }
  error(msg: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: "error", msg, ...meta }));
  }
}

setLogger(new StructuredLogger());

// Server flavor — leave the default raw reader installed (no cache).
setPactReader(rawCalibratedDirtyRead);

// ---------------------------------------------------------------------------
// Step 2b — provision a wallet with a balance resolver.

const wallet = new KadenaWallet({
  publicKey: "abcd1234...",
  derivation: "koala",
});

const balanceResolver: BalanceResolver = async (address) => {
  // In real HUB code this hits the local chainweb pool directly.
  const result = await rawCalibratedDirtyRead(`(coin.details "${address}")`, { chainId: "0" });
  return (result as { balance?: string })?.balance ?? "0";
};
wallet.balanceResolver = balanceResolver;

// ---------------------------------------------------------------------------
// Step 3 — sample read using a Phase-1 entity-oriented subpath.
// Demonstrates the Phase 4 nullable contract (returns null on RPC failure).

async function previewSwap() {
  const result = await calculateDirectSwap({
    fromToken: "OURO",
    toToken: "IGNIS",
    amountIn: "100.0",
    chainId: "0",
  });

  if (result === null) {
    getLogger().warn("calculateDirectSwap returned null — RPC failure or empty pool");
    return;
  }

  console.log("preview:", result);
}

// ---------------------------------------------------------------------------
// Step 4 — sample write using ouroWrapFunctions.

async function doWrap(keypair: IKadenaKeypair) {
  const result = await wrapKadena({
    keypair,
    chainId: "0",
    amount: "10.0",
  });
  console.log("wrap result:", result);
}

// ---------------------------------------------------------------------------
// Step 5 — catching error classes (the consolidated try/catch from Section 5).

async function fullFlow(keypair: IKadenaKeypair) {
  try {
    await previewSwap();
    await doWrap(keypair);
  } catch (e) {
    if (e instanceof KadenaShapeError)        return console.error("kadena envelope mismatch:", e.message);
    if (e instanceof MnemonicMismatchError)   return console.error("mnemonic mismatch:", e.message);
    if (e instanceof SmartAccountAuthError)   return console.error("smart-account auth:", e.message);
    if (e instanceof CodexUnknownFieldError)  return console.error("codex schema drift:", e.message);
    if (e instanceof UnknownSeedTypeError)    return console.error("unknown seed type:", e.message);
    if (e instanceof SigningError)            return console.error("signing failed:", e.message, e.cause);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Step 6 — demonstrating readonly compatibility (Phase 5 sweep).

interface SwapAnalysis {
  readonly threshold: number;
  readonly slippageBps: number;
}

function adjustThreshold(analysis: SwapAnalysis, newThreshold: number): SwapAnalysis {
  // analysis.threshold = newThreshold;  // ❌ TS2540 — Cannot assign to 'threshold' (readonly)
  return { ...analysis, threshold: newThreshold };  // ✅ spread-copy idiom
}

const a1: SwapAnalysis = { threshold: 1, slippageBps: 50 };
const a2 = adjustThreshold(a1, 2);
console.log(a1.threshold, a2.threshold); // 1, 2

// ---------------------------------------------------------------------------
// Step 7 — provision a CodexSigningStrategy with the resolver interfaces.

class FilesystemKeyResolver implements KeyResolver {
  constructor(private codex: Record<string, IKadenaKeypair>) {}
  async resolve(address: string): Promise<IKadenaKeypair> {
    const k = this.codex[address];
    if (!k) throw new Error(`No codex entry for ${address}`);
    return k;
  }
}

class NodeHttpPactClient implements PactClient {
  constructor(private endpoint: string) {}
  async submit(envelope: unknown): Promise<unknown> {
    // Pseudocode — real implementation uses node:http or fetch.
    return { hash: "...", status: "submitted" };
  }
}

const strategy = new CodexSigningStrategy({
  keyResolver: new FilesystemKeyResolver({}),
  pactClient: new NodeHttpPactClient("https://api.chainweb.com/..."),
});
```

### Output expectations

- Step 3's `previewSwap()` logs the preview object on success, or warns on null.
- Step 4's `doWrap()` returns the chain submission envelope (hash + status).
- Step 5's `fullFlow()` routes each typed error to a specific handler.
- Step 6's `adjustThreshold()` typechecks under bare `tsc --noEmit`; the commented-out line would fail with TS2540.

---

## 11. Verification checklist

After integrating, the consumer confirms wiring with these commands:

- [ ] `npm run typecheck` exits 0 — catches readonly violations + import-path errors.
- [ ] `npm test` passes — your project's tests run, plus any seam-wiring smoke checks.
- [ ] `npm run build` exits 0 — your project's bundle builds without warnings about missing peer-deps.
- [ ] All 3 packages installed at the same `MAJOR.MINOR` version (`4.2.x`). Verify with:

  ```bash
  npm ls @stoachain/kadena-stoic-legacy @stoachain/stoa-core @stoachain/ouronet-core
  ```

  Mismatched versions produce `ERESOLVE` warnings.

- [ ] `setPactReader` wired at boot — verified by reaching a code path that hits `pactRead(...)` and observing your reader's invocation (e.g., a counter your reader increments).
- [ ] `setLogger` wired — your structured logger receives the expected `warn`/`error` calls.
- [ ] At least one `KadenaWallet` instance has `balanceResolver` set — verified via `await wallet.getBalance(...)` returning a string (not throwing the default "balanceResolver not configured" error).
- [ ] Codex round-trip works — encrypt + decrypt via `@stoachain/stoa-core/crypto` returns the original plaintext.
- [ ] Smoke test of one chain read (`getBalance`, `getSWPairDashboardInfo`, etc.) succeeds against your test environment.
- [ ] Smoke test of one chain write (sign + submit a no-op transaction) succeeds.

---

## 12. Browser-vs-server differences

OuronetUI (browser) and AncientHolder HUB (server) implement the seams differently. The interfaces are identical; the implementations differ.

| Seam | Browser (OuronetUI) | Server (HUB) |
|---|---|---|
| `setPactReader` | Cache-aware reader (per-keystroke dedup, tier-based TTLs, often `LocalStorage`/`IndexedDB`-backed) | Default `rawCalibratedDirtyRead` (no cache) |
| `KeyResolver` | `ReduxCodexResolver` (Redux-backed codex unlock; password typed by user) | `FileCodexResolver` (file-system-backed; password from env or process arg) |
| `PactClient` | Browser-`fetch`-based with `getActivePactUrl(chainId)` failover routing | `node:http`-or-`node:https`-based, often direct chainweb pool |
| `BalanceResolver` | `getFailoverClient`-based (cache-aware reader + node failover) | Server's own RPC pool — direct, no failover wrapper |
| `Logger` | Console-based or DevTools-redux-logger | Structured JSON logger to stdout/file |

### Per-environment failover behavior

`@stoachain/stoa-core/network/nodeFailover.ts` is **global state**. Anything making an HTTP call must route through this module; it switches the active Stoa node on health-check failure.

> Historical context: pre-v1.6.1, `interactions/*` had `createClient(PACT_URL)` calls pinned to `node2`. The v1.6.1 fix removed those pinned calls. They should not come back. Every chain HTTP call routes through `getActivePactUrl(chainId)` / `getActiveSpvUrl(chainId)`.

**CRITICAL invariant:** anything making an HTTP call must route through `nodeFailover`. If you discover a call site that doesn't, that's a bug — file an issue or PR.

### Smart Ouronet Account auth (Σ. prefix)

`@stoachain/stoa-core/guard/smartAccountAuth.ts` resolves the `enforce-one` over (account guard / sovereign guard / governor) for Σ-prefix smart accounts. The signing strategy itself still takes a single AND-of-keysets array — UI/consumer is responsible for picking the chosen branch BEFORE calling `execute`.

Standard accounts (Ѻ. prefix) still use a single keyset; no branch choice needed.

### Codex backup format frozen at "1.2"

The codex codec is at format `"1.2"` and **is frozen**. Read `packages/ouronet-core/src/codex/codec.ts` JSDoc before touching the codec — any change to the version string requires a coordinated v5.0.0 cutover.

The strict-shape enforcement (`CodexUnknownFieldError` on unknown fields) means: v4.x consumers writing the codex with unknown fields will fail to read it back. Forward-compat extras are NOT accepted.

### `createDefaultRegistry()` is Genesis-only

`@stoachain/stoa-core/dalos`'s `createDefaultRegistry()` registers DALOS Genesis only. `Leto`/`Artemis`/`Apollo` and `createGen1Primitive` are re-exported from the `./dalos` subpath but deliberately NOT in the default registry. Ouronet itself is Genesis-only by design; consumers who want historical curves opt in:

```ts
import { createDefaultRegistry, Leto, Artemis, Apollo } from "@stoachain/stoa-core/dalos";

const registry = createDefaultRegistry();
registry.register(Leto);     // opt-in (DALOS Gen-1 historical curve)
registry.register(Artemis);  // opt-in (DALOS Gen-1 historical curve)
registry.register(Apollo);   // opt-in (DALOS Gen-1 historical curve)
```

The Gen-1 curves are interface-compatible with Genesis but produce different addresses; do NOT register them globally if your consumer is exclusively Ouronet-flavored. The opt-in is reserved for legacy data-migration consumers.

Both the default registry and the opt-in registrations are shallow: each `registry.register(...)` call is idempotent within a single registry instance. Registering the same curve twice on the same registry is a no-op; registering across separate registry instances is independent.

If your consumer needs to inspect which curves are registered (for diagnostic UI or test fixtures), the registry exposes a `list()` method returning an array of registered curve identifiers.

### Codex storage adapter

`@stoachain/stoa-core/wallet` exports a `CodexStorageAdapter` interface. Each consumer implements it against their own storage backend: browser uses `localStorage`-backed adapter, server uses encrypted-file-backed adapter, tests use in-memory adapter. The interface is narrow — `read(key): Promise<string | null>` + `write(key, value): Promise<void>` + `remove(key): Promise<void>` — and imposes no specific serialization format on the consumer. Codex-format serialization is handled by `@stoachain/ouronet-core/codex`.

---

## 13. Forward to v5.0.0

v4.2.0 is the audit-closure milestone. v5.0.0 starts fresh.

**Removed in v5.0.0:**

- **The thin re-export shims.** `dexFunctions.ts` and `ouroFunctions.ts` (the v4.2.0 backward-compat shims) are scheduled for removal. v5.0.0 forces consumers onto the entity-oriented subpaths. New code today should already use the entity-oriented paths (Section 4).
- **The v4.1.1 `getSublimateInfo` deprecation shim.** Already on a deprecation timer; v5.0.0 finalizes the removal.
- **`GAS_LIMIT_COLORS`.** Deferred from v4.1.1's audit closure (D-001/P-001 override). v5.0.0 removes.
- **Any decoration data still living in `ouronet-core`.** Per the Phase-2 chain/UI separation principle, decoration is UI's responsibility. v4.2.0 documented the boundary (Section 8) but did not physically extract every last decoration field. v5.0.0 finishes the extraction.

**Re-audit.** v5.0.0 will run a fresh comprehensive audit and address whatever surfaces.

**Rationale.** v4.2.0 closes the architectural-clarity backlog. v5.0.0 picks up wherever the next audit pass identifies the highest-value targets — likely some combination of (a) decoration-data cleanup, (b) further god-file decomposition, (c) supply-chain re-verification (vendor manifest re-issuance), and (d) any new typed-error opportunities discovered.

**Migration timeline (estimated).** v5.0.0 is not on a hard date as of this guide's authoring; expect a deprecation window in the v4.x line where the to-be-removed shims log a one-shot `getLogger().warn(...)` advisory on first use. Consumers who already migrated to entity-oriented subpaths will see no advisory; consumers still on the shims will see one warning per process lifetime per shim.

**Pre-v5.0.0 hardening recommendations for consumers:**

1. Migrate all imports from `@stoachain/ouronet-core/interactions/dexFunctions` to the entity-oriented subpaths (`dexSwapPairCalcFunctions`, `dexTrueFungibleFunctions`, etc.). Run `tsc --noEmit` after each rewrite to catch any symbols that don't resolve.
2. Migrate all imports from `@stoachain/ouronet-core/interactions/ouroFunctions` to the entity-oriented subpaths (`ouroAccountFunctions`, `ouroPrimordialsFunctions`, etc.).
3. Replace any `getSublimateInfo` call sites with the canonical replacement (see v4.1.1 deprecation JSDoc).
4. If your project consumes `GAS_LIMIT_COLORS`, plan a replacement — v5.0.0 removes it. The replacement is consumer-side: maintain your own gas-limit-to-color map.
5. If your project still has decoration data threading through `ouronet-core` chain calls, plan to extract per the Section 8 boundary contract.

---

## Appendix: cross-references

- [MIGRATION-v4.md](./MIGRATION-v4.md) — v3 → v4.0 monorepo split (12,125 bytes; full move-by-move detail).
- [MIGRATION-v4.1.md](./MIGRATION-v4.1.md) — v4.0 → v4.1 sovereign vendoring (15,964 bytes; SHA256-manifest verification recipe + v4.1.1 audit-closure appendix).
- [MIGRATION-v4.2.md](./MIGRATION-v4.2.md) — v4.1.x → v4.2.0 architectural closures (Phase 9 deliverable).
- Per-package CHANGELOG.md files at `packages/{kadena-stoic-legacy,stoa-core,ouronet-core}/CHANGELOG.md`.
- Per-package READMEs at `packages/{kadena-stoic-legacy,stoa-core,ouronet-core}/README.md` — Status block + version-history paragraphs are the source of truth for what changed across versions.
- Phase 2 sub-deliverable (UI-decoration inventory): `.bee/specs/2026-05-08-v4-2-0-architectural-closures-and-integration-guide/phases/02-ouro-split-and-chain-ui-separation/primordials-ui-decoration-inventory.md`.

End of guide.
