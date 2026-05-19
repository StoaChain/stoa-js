# @stoachain/kadena-stoic-legacy

Vendored source of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship. Sovereign supply-chain replacement for the upstream `@kadena/*` npm packages, preserved byte-identical at v1.18.3 / 0.4.4 / 0.7.0 / 0.6.2.

Post-Kadena-LLC, the StoaChain ecosystem can no longer accept supply-chain risk on unmaintained upstream npm packages. `@stoachain/kadena-stoic-legacy` is the response: a single, frozen-in-time, byte-attested vendoring of the four `@kadena/*` packages that the StoaChain stack actually consumes — published under StoaChain's npmjs scope and covered by a single canonical BSD-3-Clause license file (`LICENSE-attribution.md`) that preserves Kadena LLC's original copyright verbatim and documents every source-level modification from upstream.

## Status

**`4.2.2` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/stoa-core@4.2.2` + `@stoachain/ouronet-core@4.2.2`).** Released 2026-05-18. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`) — the v4.2.2 surface lives entirely in `@stoachain/ouronet-core` (new SWP-pair management builders + INFO readers + UR\_\* reads supporting the OuronetUI v1.0.8 Liquidity-Pools-Management wiring cycle, shipped mid-cycle at 5-of-11 buttons). Functionally identical to `4.2.1` and `4.2.0`; consumers may pin to any of these interchangeably.

**`4.2.1` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/stoa-core@4.2.1` + `@stoachain/ouronet-core@4.2.1`).** Released 2026-05-16. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`) — the v4.2.1 surface lives entirely in `@stoachain/ouronet-core` (23 new builders + 1 INFO reader supporting the OuronetUI v1.0.7 Phase-3b strategy migration). Functionally identical to `4.2.0`; consumers may pin to either interchangeably.

**`4.2.0` on public npmjs** — **MINOR (atomic with `@stoachain/stoa-core@4.2.0` + `@stoachain/ouronet-core@4.2.0`).** Released 2026-05-09. NO source-code changes — vendor source remains byte-identical to upstream `@kadena/{client,cryptography-utils,types,hd-wallet}` at v1.18.3 / 0.4.4 / 0.7.0 / 0.6.2. NO new test files (Phase 9 did not add tests in `kadena-stoic-legacy`; the v4.2.0 architectural-closures release lands in the sibling packages). Test count: **55 specs pass** (unchanged from v4.1.1). Cross-reference: see [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) and [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) at the monorepo root.

**`4.1.1` on public npmjs** — **PATCH (atomic with `@stoachain/stoa-core@4.1.1` + `@stoachain/ouronet-core@4.1.1`).** Released 2026-05-08. No source changes — vendor source is byte-identical to upstream. Adds vendor-fidelity test surface: 7 new test files covering exports shape, cryptography-utils snapshots, HD-wallet snapshots, signing snapshots, Pact-builder snapshots, cross-subpath import paths, and types shape. **~36 specs pass.**

**`4.1.0` on public npmjs** — **INITIAL RELEASE.** Vendors `@kadena/client@1.18.3` (96 files), `@kadena/cryptography-utils@0.4.4` (40 files), `@kadena/types@0.7.0` (16 files), `@kadena/hd-wallet@0.6.2` including `chainweaver/` subtree (52 files). Total: 204 vendored `.cjs` + `.d.cts` files preserved byte-identical to upstream (modulo 3 documented modifications: cross-fetch → globalThis.fetch in `chainweaver/signWithChainweaver`, dead walletconnect re-export prune in `signing/index`, `.js → .cjs` extension rewrite in hd-wallet's explicit-extension requires). Audit trail: see `LICENSE-attribution.md` "## Modifications from upstream" section + the published `VENDOR-MANIFEST.sha256` (204-line SHA256 manifest). Five subpath exports (`./client`, `./cryptography-utils`, `./types`, `./hd-wallet`, `./hd-wallet/chainweaver`) — each declares all three conditions (`types`, `import`, `require`) for ESM + CJS interop. **7 build-system regression tests pass.**

**v4.2.2** — atomic-triplet patch bump aligned with `@stoachain/ouronet-core@4.2.2`. **PATCH (atomic with `@stoachain/stoa-core@4.2.2` + `@stoachain/ouronet-core@4.2.2`).** Released 2026-05-18. NO code changes in this package; bumped solely to maintain the atomic-triplet invariant. The v4.2.2 release surface lives entirely in `@stoachain/ouronet-core` (SWP-pair management builders for the OuronetUI v1.0.8 Liquidity-Pools-Management wiring cycle). **55 specs pass.** Functionally identical to v4.2.1 and v4.2.0.

**v4.2.1** — atomic-triplet patch bump aligned with `@stoachain/ouronet-core@4.2.1`. **PATCH (atomic with `@stoachain/stoa-core@4.2.1` + `@stoachain/ouronet-core@4.2.1`).** Released 2026-05-16. NO code changes in this package; bumped solely to maintain the atomic-triplet invariant. The v4.2.1 release surface lives entirely in `@stoachain/ouronet-core`. **55 specs pass.** Functionally identical to v4.2.0.

**v4.2.0** — atomic-triplet minor bump (architectural closures land in sibling packages). **MINOR (atomic with `@stoachain/stoa-core@4.2.0` + `@stoachain/ouronet-core@4.2.0`).** Released 2026-05-09. NO source-code changes — vendor source remains byte-identical to upstream `@kadena/{client,cryptography-utils,types,hd-wallet}` at v1.18.3 / 0.4.4 / 0.7.0 / 0.6.2. NO new test files (the v4.2.0 architectural-closures release lands in `@stoachain/stoa-core` and `@stoachain/ouronet-core` only — F-API-018 readonly sweep, F-TEST-002 foreign-key fixture, F-ARCH-001/002/003 god-file splits, F-API-002 nullable contract, F-TEST-006 +127 specs across 6 modules, plus the new `INTEGRATION-GUIDE.md` deliverable at repo root). The 9-entry peer-dep block is unchanged. **55 specs pass.** Cross-reference: see [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) for the v4.1.x → v4.2.0 transition guide and [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) for comprehensive cold-start onboarding across all 3 packages.

**v4.1.1** — audit-closure patch. **PATCH (atomic with `@stoachain/stoa-core@4.1.1` + `@stoachain/ouronet-core@4.1.1`).** No source changes — vendor source remains byte-identical to upstream. Test surface grows by 7 new vendor-fidelity files (exports.test.ts, pact-builder-snapshot.test.ts, cryptography-utils-snapshots.test.ts, hd-wallet-snapshots.test.ts, signing-snapshots.test.ts, cross-subpath-imports.test.ts, types-shape.test.ts) plus dist-structure / esm-roundtrip / no-side-effects / package-metadata / peer-dep-coverage tests. **~36 specs pass.**

**v4.1.0** — **INITIAL RELEASE — sovereign vendoring of the @kadena/* upstream supply chain.** Vendors four upstream npm packages (`@kadena/client@1.18.3`, `@kadena/cryptography-utils@0.4.4`, `@kadena/types@0.7.0`, `@kadena/hd-wallet@0.6.2` including the `chainweaver/` subtree) into a single StoaChain-stewarded sibling at `packages/kadena-stoic-legacy/` in the [`StoaChain/stoa-js`](https://github.com/StoaChain/stoa-js) monorepo. Three documented modifications from upstream — (1) `cross-fetch` swapped for `globalThis.fetch` in `chainweaver/signWithChainweaver` (Node 18+ ships native fetch; drops a 2-line transitive dep chain), (2) dead WalletConnect re-export pruned from `client/signing/index` (the upstream module re-exported a removed sub-path that errored on import-time evaluation), (3) `.js → .cjs` extension rewrite at the dist boundary so the CJS-conditioned subpath resolves correctly under Node 22.12+'s sync `require(esm)`. Five subpath exports — `./client`, `./cryptography-utils`, `./types`, `./hd-wallet`, `./hd-wallet/chainweaver` — each carrying `types` + `import` + `require` conditions for full ESM + CJS interop. Engines floor: Node `>=22.12` (required for the synchronous `require(esm)` default-on; the 5 subpath exports route CJS imports to ESM `index.js` via the new resolver). 9-entry peer-dep block preserves the upstream peer-dep contract verbatim (chainweb-node-client + pactjs at their pinned 0.9.5 / 0.6.0; the `@scure/bip39@1.2.1` exact-pin matches the nested copy under hd-wallet, NOT the more common 1.6.0; `blakejs`, `buffer`, `buffer-from`, `debug`, `ed25519-keygen`, `tweetnacl` carry their original ranges). **7 build-system regression specs pass** (subpath resolution under both ESM and CJS conditions; SHA256 attestation against `VENDOR-MANIFEST.sha256`; `engines.node` floor; subpath-exports key-set; .cjs extension rewrite presence; modifications-from-upstream presence; root entry near-empty invariant). Consumed atomically by `@stoachain/stoa-core@4.1.0` + `@stoachain/ouronet-core@4.1.0` (both at the same version per the monorepo's atomic-release invariant).

## Install

```bash
npm install @stoachain/kadena-stoic-legacy
```

Peer dependencies (must be present in consumer's tree):

  - `@kadena/chainweb-node-client` `0.9.5` — NOT vendored, remains upstream (used only by `client/`'s thin RPC adapter; small, stable, maintained against the chainweb HTTP API which is itself stable)
  - `@kadena/pactjs` `0.6.0` — NOT vendored, remains upstream (Pact-language types; equally small + stable)
  - `@scure/bip39` `1.2.1` — EXACT pin (hd-wallet's nested copy is 1.2.1, NOT the more common 1.6.0; mismatching here breaks the chainweaver mnemonic-derivation tests against the seed-vector fixtures shipped with hd-wallet)
  - `blakejs` `^1.2.1` — Blake2b for hd-wallet's BIP-32 derivation
  - `buffer` `6.0.3` — browser shim, exact-pinned because cryptography-utils embeds compile-time-resolved Buffer references
  - `buffer-from` `1.1.2` — same rationale
  - `debug` `4.3.4` — runtime debug logger; exact-pin matches the upstream lock
  - `ed25519-keygen` `0.4.8` — keypair generation; exact-pin
  - `tweetnacl` `^1.0.3` — signing primitives; range pin permitted because the API surface is frozen

Engines: Node `>=22.12` (required for `require(esm)` default-on; the 5 subpath exports route CJS imports to ESM `index.js` via Node 22.12+'s synchronous require-of-ESM).

## Subpath exports

```ts
import { Pact, createClient } from "@stoachain/kadena-stoic-legacy/client";
import { hash, binToHex } from "@stoachain/kadena-stoic-legacy/cryptography-utils";
import type { ICommand, IUnsignedCommand, ChainId } from "@stoachain/kadena-stoic-legacy/types";
import { kadenaMnemonicToSeed } from "@stoachain/kadena-stoic-legacy/hd-wallet";
import { kadenaCheckMnemonic, kadenaGenMnemonic, kadenaSign } from "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver";
```

The root entry `@stoachain/kadena-stoic-legacy` is intentionally near-empty — consumers MUST reach into a subpath, mirroring stoa-core / ouronet-core's subpath-only philosophy.

| Subpath | Replaces | Surface (verbatim from upstream) |
|---|---|---|
| `@stoachain/kadena-stoic-legacy/client` | `@kadena/client@1.18.3` | `Pact`, `createClient`, `Pact.builder.*`, command construction, signing pipeline (incl. signWithChainweaver), submit/listen/poll RPC adapter |
| `@stoachain/kadena-stoic-legacy/cryptography-utils` | `@kadena/cryptography-utils@0.4.4` | `hash`, `binToHex`, `hexToBin`, `restoreKeyPairFromSecretKey`, `genKeyPair`, all base64url helpers |
| `@stoachain/kadena-stoic-legacy/types` | `@kadena/types@0.7.0` | `ICommand`, `IUnsignedCommand`, `ChainId`, `KeyPair`, `IPactCapability`, `IKeyset`, every type alias upstream exports |
| `@stoachain/kadena-stoic-legacy/hd-wallet` | `@kadena/hd-wallet@0.6.2` | `kadenaMnemonicToSeed`, BIP-32 derivation primitives |
| `@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver` | `@kadena/hd-wallet/chainweaver` (subpath) | `kadenaCheckMnemonic`, `kadenaGenMnemonic`, `kadenaSign`, chainweaver-key-derivation surface |

## License

The vendored sources are BSD-3-Clause (Kadena LLC's original license, preserved verbatim in `LICENSE-attribution.md`). StoaChain's stewardship continues under the same BSD-3-Clause license. The 3 documented modifications from upstream (cross-fetch swap, walletconnect prune, `.js → .cjs` rewrite at the dist boundary) are recorded under `## Modifications from upstream` in `LICENSE-attribution.md` for full audit-trail fidelity. Original copyright `Copyright (c) 2018 - 2024 Kadena LLC` is preserved verbatim and unmodified.

**No warranty.** This is a vendored, frozen-in-time copy. StoaChain MAY apply security patches but does NOT guarantee feature parity with any future upstream release of `@kadena/*`. Consumers are encouraged to audit `VENDOR-MANIFEST.sha256` to verify byte-identity against their own checks.
