# Changelog

All notable changes to `@stoachain/kadena-stoic-legacy`.

This package was born at v4.1.0 as a sovereign supply-chain replacement for the upstream `@kadena/*` npm packages following Kadena LLC's dissolution. Released atomically alongside `@stoachain/stoa-core@4.1.0` + `@stoachain/ouronet-core@4.1.0` out of the [`StoaChain/stoa-js`](https://github.com/StoaChain/stoa-js) monorepo — a single `vX.Y.Z` git tag publishes all three packages.

## 4.3.1 — 2026-05-27

**PATCH — atomic-triplet alignment**. No code changes in THIS package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the exact same version). The v4.3.1 release surface lives in [`@stoachain/stoa-core@4.3.1`](https://www.npmjs.com/package/@stoachain/stoa-core) + [`@stoachain/ouronet-core@4.3.1`](https://www.npmjs.com/package/@stoachain/ouronet-core) (ESM extensionless-relative-import fix in their emitted `dist/**/*.js`). This package's CommonJS build (`.cjs` output via separate tsconfig) was never affected by that bug because CommonJS always uses explicit file extensions in `require()`. Functionally identical to v4.3.0.

## 4.3.0 — 2026-05-25

**MINOR — atomic-triplet bump aligned with `@stoachain/ouronet-core@4.3.0` additive surface (2 new account-rotation Pact builders).** No code changes in this package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the same version). Published from the same `v4.3.0` git tag. The v4.3.0 release surface lives entirely in `@stoachain/ouronet-core` (the rotation builders, supporting the new `@stoachain/ouronet-codex@0.1.0` Phase 6b headless rotation modals).

### Compatibility

- Functionally identical to `4.2.2`. Consumers MAY pin to either version interchangeably.

## 4.2.2 — 2026-05-18

**PATCH — atomic-triplet bump aligned with `@stoachain/ouronet-core@4.2.2` additive surface.** No code changes in this package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the same version). Published from the same `v4.2.2` git tag. The v4.2.2 release surface lives entirely in `@stoachain/ouronet-core` (new SWP-pair management builders + INFO readers + UR\_\* reads supporting the OuronetUI v1.0.8 Liquidity-Pools-Management wiring cycle).

### Compatibility

- Functionally identical to `4.2.1` and `4.2.0`. Consumers MAY pin to any of these versions interchangeably.

## 4.2.1 — 2026-05-16

**PATCH — atomic-triplet bump aligned with `@stoachain/ouronet-core@4.2.1` additive surface.** No code changes in this package; version bumped solely to maintain the atomic-triplet invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts` (all 3 packages share the same version). Published from the same `v4.2.1` git tag.

### Compatibility

- Functionally identical to `4.2.0`. Consumers MAY pin to either version interchangeably.

## 4.2.0 — 2026-05-09

**MINOR — atomic-triplet bump (atomic with `@stoachain/stoa-core@4.2.0` + `@stoachain/ouronet-core@4.2.0`).** Released 2026-05-09. NO source-code changes to the vendored upstream files — vendor-fidelity preserved byte-identical to upstream `@kadena/{client,cryptography-utils,types,hd-wallet}` at v1.18.3 / 0.4.4 / 0.7.0 / 0.6.2. NO peer-dep additions or removals; the existing 9-entry peer-dep block is unchanged.

### Changed
- Version bump 4.1.1 → 4.2.0 (atomic-triplet alongside `@stoachain/stoa-core` and `@stoachain/ouronet-core`).
- The v4.2.0 architectural-closures release lands in the sibling packages (`@stoachain/stoa-core` + `@stoachain/ouronet-core`); this package rides the atomic-triplet invariant. See those packages' CHANGELOGs for closure-state details.

### Test surface
- 0 new tests in this package (Phase 9 did not add tests in `kadena-stoic-legacy`; previous v4.2.0 phases added tests only in `stoa-core` + `ouronet-core`).
- Test count: 55 specs pass (unchanged from v4.1.1).

### Migration
- Consumer impact: none. See [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) at the monorepo root for the v4.1.x → v4.2.0 transition guide and [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) for comprehensive cold-start onboarding across all 3 packages.

## 4.1.1 — 2026-05-08

### Added
- 7 new vendor-fidelity test files validate the vendored `@kadena/*` source surface remains intact:
  - `exports.test.ts` — 5 subpath exports resolve with named exports
  - `pact-builder-snapshot.test.ts` — 10 baseline pact-builder snapshots round-trip
  - `cryptography-utils-snapshots.test.ts` — 4 baseline crypto-utils snapshots round-trip (URL-safe base64 + restoreKeyPairFromSecretKey)
  - `hd-wallet-snapshots.test.ts` — 4 baseline koala+chainweaver derivation snapshots
  - `signing-snapshots.test.ts` — 2 baseline single-sig+multi-sig snapshots; cross-snapshot keypair-reuse invariant locked
  - `cross-subpath-imports.test.ts` — each subpath imports in isolation
  - `types-shape.test.ts` — type-only ./types subpath compiles
- 3 new build-artifact tests: `v4-1-1-dist-structure.test.ts`, `v4-1-1-esm-roundtrip.test.ts`, `v4-1-1-no-side-effects.test.ts`.
- 2 new package-metadata + peer-dep coverage tests assert atomic-triplet invariants.

### Changed
- Version bump 4.1.0 → 4.1.1 (atomic-triplet alongside `@stoachain/stoa-core` and `@stoachain/ouronet-core`).
- Vendor source: NO changes (byte-identical to upstream `@kadena/{client,cryptography-utils,types,hd-wallet}` at v1.18.3 / 0.4.4 / 0.7.0 / 0.6.2).

## 4.1.0 — 2026-05-07

**INITIAL RELEASE — sovereign vendoring of the @kadena/* upstream supply chain.**

### Why

Post-Kadena-LLC, the StoaChain ecosystem cannot accept supply-chain risk on unmaintained upstream npm packages. The four `@kadena/*` packages that StoaChain consumes (`client`, `cryptography-utils`, `types`, `hd-wallet`) are foundational — every signed transaction, every mnemonic-derived key, every Pact-builder call site routes through them. v4.1.0 vendors them under StoaChain stewardship at a single canonical version-pin, with a SHA256 manifest providing byte-identity attestation against the upstream snapshots taken on 2026-05-07.

### Vendored upstream packages

  - `@kadena/client@1.18.3` (96 files) — Pact builder, signing pipeline, RPC adapter
  - `@kadena/cryptography-utils@0.4.4` (40 files) — hashing, hex/bin conversion, key-pair primitives
  - `@kadena/types@0.7.0` (16 files) — `ICommand`, `IUnsignedCommand`, `ChainId`, `KeyPair`, `IKeyset`, etc.
  - `@kadena/hd-wallet@0.6.2` (52 files including `chainweaver/` subtree) — BIP-32/39 derivation, chainweaver mnemonic key-gen

Total: **204 vendored `.cjs` + `.d.cts` files**, preserved byte-identical to upstream modulo three documented modifications (see below). Byte-identity attested by `VENDOR-MANIFEST.sha256` (a 204-line SHA256 manifest shipped alongside the package — consumers can re-derive and verify against their own snapshot of the upstream tarballs).

### Modifications from upstream

Three source-level modifications are documented in `LICENSE-attribution.md` "## Modifications from upstream":

  1. **`cross-fetch` → `globalThis.fetch`** in `chainweaver/signWithChainweaver`. Node 18+ (well below our `>=22.12` engine floor) ships a global `fetch` per the WHATWG Fetch spec; `cross-fetch` is no longer needed and was a 2-line transitive dep chain that we'd otherwise need to vendor or peer-depend.
  2. **Dead WalletConnect re-export pruned** from `client/signing/index`. The upstream module re-exported a removed sub-path that errored on import-time evaluation under Node 22's stricter ESM resolution; the re-export was already unreachable at runtime, so pruning it is behavior-preserving.
  3. **`.js → .cjs` extension rewrite** in hd-wallet's explicit-extension `require(...)` calls at the dist boundary. Required so the CJS-conditioned subpath resolves correctly under Node 22.12+'s sync `require(esm)` default-on; preserves runtime semantics byte-identically.

Each modification is recorded in `LICENSE-attribution.md` with the exact file path, the diff, the rationale, and the date applied. The SHA256 attestation in `VENDOR-MANIFEST.sha256` is computed POST-modification — consumers verifying byte-identity should compare against the manifest, not against fresh upstream tarballs.

### Subpath exports

Five subpath exports — every directory under `dist/` corresponds to a subpath declared in `package.json`. Each subpath declares all three conditions (`types`, `import`, `require`) for full ESM + CJS interop:

  - `@stoachain/kadena-stoic-legacy/client`
  - `@stoachain/kadena-stoic-legacy/cryptography-utils`
  - `@stoachain/kadena-stoic-legacy/types`
  - `@stoachain/kadena-stoic-legacy/hd-wallet`
  - `@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver`

The root entry (`@stoachain/kadena-stoic-legacy`) is intentionally near-empty — consumers MUST reach into a subpath, mirroring `stoa-core` / `ouronet-core`'s subpath-only philosophy.

### Peer dependencies

9-entry peer-dep block preserves the upstream peer-dep contract verbatim. NOT vendored (these remain upstream; small, stable, maintained):

  - `@kadena/chainweb-node-client@0.9.5` — exact pin
  - `@kadena/pactjs@0.6.0` — exact pin

Vendored-internal nested-copy compatibility pins:

  - `@scure/bip39@1.2.1` — EXACT pin. The hd-wallet's nested copy is 1.2.1, NOT the more common 1.6.0; mismatching here breaks chainweaver mnemonic-derivation tests against the seed-vector fixtures shipped with hd-wallet.

Runtime primitives (exact-pinned to match upstream lock unless noted):

  - `blakejs@^1.2.1` (range pin permitted; API frozen)
  - `buffer@6.0.3` — exact pin (cryptography-utils embeds compile-time-resolved Buffer references)
  - `buffer-from@1.1.2` — exact pin
  - `debug@4.3.4` — exact pin
  - `ed25519-keygen@0.4.8` — exact pin
  - `tweetnacl@^1.0.3` (range pin permitted; API frozen)

### Engines

Node `>=22.12`. Required for `require(esm)` default-on (the 5 subpath exports route CJS imports to ESM `index.js` via Node 22.12+'s synchronous require-of-ESM resolver).

### Tests

**7 build-system regression specs pass** in `tests/`:

  1. `subpath-resolution-esm.test.ts` — verifies all 5 subpath exports resolve under ESM `import` condition and the imported symbol set matches the upstream surface.
  2. `subpath-resolution-cjs.test.ts` — verifies all 5 subpath exports resolve under CJS `require` condition (the require-of-ESM path under Node 22.12+).
  3. `vendor-manifest-attestation.test.ts` — re-computes SHA256 over every file in `dist/` and compares against `VENDOR-MANIFEST.sha256`; fails the build if any file drifts post-vendor.
  4. `engines-node-floor.test.ts` — asserts `package.json` `engines.node` is exactly `>=22.12` (the require-of-ESM floor).
  5. `subpath-exports-keys.test.ts` — asserts the `exports` map has exactly the 5 subpath keys + the root entry; fails the build if a stray export is added without intent.
  6. `cjs-extension-rewrite.test.ts` — asserts the `.js → .cjs` rewrite from modification #3 is present in every hd-wallet dist file with explicit-extension requires.
  7. `modifications-from-upstream-presence.test.ts` — reads `LICENSE-attribution.md` and asserts the "## Modifications from upstream" section exists with the three documented modifications; fails if a modification is silently added without its audit-trail entry.

### Atomic release

This package's v4.1.0 is the new third leg of the `StoaChain/stoa-js` monorepo's atomic-release contract. A single `vX.Y.Z` git tag now publishes three packages via `.github/workflows/publish.yml` in dependency order:

  1. `@stoachain/kadena-stoic-legacy` (no internal deps)
  2. `@stoachain/stoa-core` (peer-deps `@stoachain/kadena-stoic-legacy@X.Y.Z`)
  3. `@stoachain/ouronet-core` (peer-deps `@stoachain/stoa-core@X.Y.Z` + `@stoachain/kadena-stoic-legacy@X.Y.Z`)

Each package gets its own `--provenance` SLSA attestation. Per-package version-parity gates (README + CHANGELOG must reference the publish version on EACH package independently) preserve the v2.1.x staleness lessons.

### License

BSD-3-Clause. Preserves Kadena LLC's original copyright (`Copyright (c) 2018 - 2024 Kadena LLC`) verbatim and unmodified. StoaChain's stewardship continues under the same BSD-3-Clause license. Per-modification audit trail in `LICENSE-attribution.md`. See the package README for the full legal/license summary.
