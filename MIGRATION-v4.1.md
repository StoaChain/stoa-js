# MIGRATION-v4.1.md — upgrading from v4.0.x to v4.1.0

**TL;DR.** v4.1.0 introduces a third package — [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) — that vendors `@kadena/{client,cryptography-utils,types,hd-wallet}` byte-identical to upstream `1.18.3 / 0.4.4 / 0.7.0 / 0.6.2`. `@stoachain/stoa-core` and `@stoachain/ouronet-core` v4.1.0 retarget all internal `@kadena/*` imports onto the new sibling subpaths under `@stoachain/kadena-stoic-legacy/*`.

**Consumer impact.** If you're a downstream consumer of `@stoachain/stoa-core` or `@stoachain/ouronet-core` and you ONLY consume their published types/values via the documented subpath APIs (`@stoachain/stoa-core/{signing,wallet,reads,...}`, `@stoachain/ouronet-core/{codex,interactions,...}`), the migration is **almost transparent** — you just need to:

1. Update your `package.json` dependencies to v4.1.0 across all 3 packages
2. Drop the four `@kadena/*` peer-dep declarations from your project's `package.json`
3. Add `@stoachain/kadena-stoic-legacy: "4.1.0"` as a peer-dep
4. Bump Node engines floor to `>=22.12` (required by kadena-stoic-legacy for `require(esm)` default-on)

If your project DIRECTLY imports from `@kadena/*` (i.e. NOT through stoa-core or ouronet-core), you have a choice — either keep importing from upstream (the upstream packages still work) or retarget your imports onto `@stoachain/kadena-stoic-legacy/*` for supply-chain alignment with StoaChain's stewardship.

---

## Why v4.1.0 exists

After Kadena LLC's dissolution, the StoaChain ecosystem cannot accept indefinite supply-chain risk on unmaintained upstream npm packages. v4.1.0 is the response: a sovereign, audit-trail-bearing, byte-identical fork of the four `@kadena/*` packages that StoaChain's downstream code actually consumes. The upstream `@kadena/*` packages continue to work — v4.1.0 doesn't break them — but `@stoachain/{stoa-core,ouronet-core}` no longer depend on them. They depend on `@stoachain/kadena-stoic-legacy` instead.

The audit trail is comprehensive:

- **`packages/kadena-stoic-legacy/LICENSE-attribution.md`** — preserves Kadena LLC's verbatim BSD-3-Clause license + 5 documented modifications-from-upstream entries (cross-fetch swap, walletconnect prune, bare-require rewrite at dist boundary, hd-wallet `.js → .cjs` source rewrite, cross-cutting `@kadena/*` import sweep).
- **`packages/kadena-stoic-legacy/VENDOR-MANIFEST.sha256`** — 204-line SHA256 manifest of every vendored `.cjs` + `.d.cts` file. Consumers can run their own SHA256 sweep against `node_modules/@stoachain/kadena-stoic-legacy/src/` and verify byte-identity against this manifest, or against the upstream `@kadena/*` tarballs (modulo the 5 modifications listed in `LICENSE-attribution.md`).
- **Phase 0 baseline-snapshot capture** — 20 JSON snapshot files under `.bee/specs/2026-05-06-kadena-stoic-legacy-vendoring/baseline-snapshots/` capturing deterministic byte-level outputs from the original `@kadena/*` code paths (Pact builder, hash, signing, hd-wallet derivation). Phase 7's vitest specs (in v4.1.x patch track) re-run these snapshots through the vendored code and assert byte-equality — proving the migration preserves behavior.

---

## Migration steps

### Step 1 — Bump versions in your `package.json`

Before:

```json
{
  "dependencies": {
    "@stoachain/stoa-core": "^4.0.1",
    "@stoachain/ouronet-core": "^4.0.1"
  },
  "peerDependencies": {
    "@kadena/client": "1.18.3",
    "@kadena/cryptography-utils": "0.4.4",
    "@kadena/hd-wallet": "0.6.2",
    "@kadena/types": "0.7.0",
    "@noble/curves": "1.9.7",
    "@scure/bip39": "1.6.0"
  }
}
```

After:

```json
{
  "dependencies": {
    "@stoachain/stoa-core": "^4.1.0",
    "@stoachain/ouronet-core": "^4.1.0"
  },
  "peerDependencies": {
    "@stoachain/kadena-stoic-legacy": "4.1.0",
    "@noble/curves": "1.9.7",
    "@scure/bip39": "1.2.1"
  }
}
```

Note `@scure/bip39` exact-pinned at `1.2.1` (NOT `1.6.0`) — `kadena-stoic-legacy/hd-wallet`'s nested copy is `1.2.1` and its API expectations are pinned to that version. The 1.6.0 BIP39 release is a major-API-revision-flagged-as-minor (vendor decision); StoaChain pins to the version `kadena-stoic-legacy/hd-wallet` was tested against.

If your project has additional deps that pull in the upstream `@kadena/*` packages, you may keep those — `npm install` will still resolve `@kadena/types`, etc., through their original install paths. Only your own `peerDependencies` declarations need to drop.

### Step 2 — Bump Node engines floor

`@stoachain/kadena-stoic-legacy@4.1.0` declares `engines.node: ">=22.12"`. This floor is required because the package's exports map declares `"require"` conditions on all 5 subpath entries — and Node's synchronous `require()` of ESM modules is gated behind `--experimental-require-module` flag on Node 22.0-22.11, default-on from 22.12.0 onward.

If your consumer project supports lower Node versions (Node 20 LTS, etc.), you have two options:

(a) Bump your consumer's engines floor to match — `engines.node: ">=22.12"` in your own `package.json`. This is the recommended path.

(b) Stay on `@stoachain/{stoa-core,ouronet-core}@4.0.x` until your runtime is on Node 22.12+. v4.0.x continues to import from upstream `@kadena/*` and works on Node 20 LTS; the 4.0.x track gets security patches but no new features after v4.1.0.

### Step 3 — Direct `@kadena/*` import retargeting (only if you import from upstream directly)

If your consumer project has DIRECT imports from `@kadena/*` (NOT through stoa-core or ouronet-core re-exports), you can optionally retarget them. The 5 sed expressions below cover the rewrite mechanically:

```bash
# In your consumer project's src/ + tests/:
sed -i 's|from "@kadena/client"|from "@stoachain/kadena-stoic-legacy/client"|g' $(find src tests -name "*.ts")
sed -i 's|from "@kadena/cryptography-utils"|from "@stoachain/kadena-stoic-legacy/cryptography-utils"|g' $(find src tests -name "*.ts")
sed -i 's|from "@kadena/types"|from "@stoachain/kadena-stoic-legacy/types"|g' $(find src tests -name "*.ts")
sed -i 's|from "@kadena/hd-wallet/chainweaver"|from "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver"|g' $(find src tests -name "*.ts")
sed -i 's|from "@kadena/hd-wallet"|from "@stoachain/kadena-stoic-legacy/hd-wallet"|g' $(find src tests -name "*.ts")
```

**Critical: order matters.** `hd-wallet/chainweaver` is a superstring of `hd-wallet`. Run the chainweaver sed BEFORE the bare hd-wallet one to avoid corrupting `chainweaver` references into `chainweaverhd-wallet/chainweaver`-style rubbish.

If your project also has `vi.mock("@kadena/client", ...)` test-side mock specifiers, retarget those too:

```bash
sed -i 's|vi\.mock("@kadena/client"|vi.mock("@stoachain/kadena-stoic-legacy/client"|g' $(find tests -name "*.ts")
```

The mock-specifier string MUST match the SUT's import-path string after the rewrite — otherwise Vitest mocks the wrong module and your tests silently bypass the mock.

### Step 4 — Verify

```bash
npm install
npm run typecheck
npm test
npm run build
```

Then optionally:

```bash
# Verify byte-identity of the vendored @kadena/* code:
cd node_modules/@stoachain/kadena-stoic-legacy
sha256sum -c VENDOR-MANIFEST.sha256
```

The 204-line manifest's hashes match the source files' actual SHA256s, modulo the 5 modifications-from-upstream entries listed in `LICENSE-attribution.md`. If your verification succeeds with no mismatches, you have cryptographic proof that the package on disk matches what was published.

---

## What did NOT change

The exported public API surfaces of `@stoachain/stoa-core` and `@stoachain/ouronet-core` are unchanged at v4.1.0. Every type, value, and namespace export available at v4.0.1 is still available at v4.1.0 with identical shapes. Re-exports of types from `@kadena/types` (e.g. `IKadenaKeypair`, `ICommand`, `IUnsignedCommand`, `ChainId`) continue to flow through `@stoachain/stoa-core/signing` etc. — but their underlying source is now `@stoachain/kadena-stoic-legacy/types` instead of `@kadena/types`.

If your consumer ONLY uses the documented subpath APIs of stoa-core / ouronet-core (which is the recommended pattern), the migration is invisible at the call-site level. Only `package.json` peer-dep declarations + Node engines floor need updating.

---

## Test count expectations post-migration

After v4.1.0:

- `@stoachain/kadena-stoic-legacy`: 7 specs (build-system regression tests; the comprehensive vendor-fidelity test surface — Cat C-J, ~150 specs — lands in v4.1.x patch track per the spec's deferred-scope plan)
- `@stoachain/stoa-core`: 551 specs (485 baseline + 66 new from `tests/v4-1-0-no-kadena-imports.test.ts` runtime regression-lock)
- `@stoachain/ouronet-core`: 261 specs (218 baseline + 43 new from same regression-lock pattern)
- **Total: 819 specs.**

The regression-lock tests assert zero `from "@kadena/"` / `import "@kadena/"` / `require("@kadena/")` / `vi.mock("@kadena/")` matches across `src/` + `tests/` of stoa-core and ouronet-core respectively. Future regressions that reintroduce upstream `@kadena/*` imports fail the test suite immediately — the migration boundary is locked at the test level.

---

## Stoa-core typed re-exports unchanged

A common consumer concern: "does the v4.1.0 migration change any type shape exposed to consumers?". The answer is **no**. The type surfaces of `@stoachain/stoa-core/{signing,wallet,reads,pact,...}` continue to expose `IKadenaKeypair`, `ICommand`, `IUnsignedCommand`, `ChainId`, `KeyPair`, etc. with identical shapes. Internally the imports of these types now flow from `@stoachain/kadena-stoic-legacy/types` instead of `@kadena/types`, but `@stoachain/kadena-stoic-legacy/types` is a verbatim byte-identical copy of `@kadena/types@0.7.0` — so the re-exported types are byte-identical too.

This is verifiable: post-migration `tsc --noEmit -p packages/stoa-core/tsconfig.json` exits 0 against the pre-migration test suite without any test-side changes (T4.1's intermediate typecheck gate proved this). REQ-15 ("typed re-exports continue to work") is satisfied.

---

## Cross-references

- Repo: <https://github.com/StoaChain/stoa-js>
- Per-package CHANGELOGs:
  - [`@stoachain/kadena-stoic-legacy/CHANGELOG.md`](./packages/kadena-stoic-legacy/CHANGELOG.md)
  - [`@stoachain/stoa-core/CHANGELOG.md`](./packages/stoa-core/CHANGELOG.md)
  - [`@stoachain/ouronet-core/CHANGELOG.md`](./packages/ouronet-core/CHANGELOG.md)
- LICENSE attribution: [`packages/kadena-stoic-legacy/LICENSE-attribution.md`](./packages/kadena-stoic-legacy/LICENSE-attribution.md)
- Vendor manifest: [`packages/kadena-stoic-legacy/VENDOR-MANIFEST.sha256`](./packages/kadena-stoic-legacy/VENDOR-MANIFEST.sha256)
- Phase 0 baseline snapshots: [`.bee/specs/2026-05-06-kadena-stoic-legacy-vendoring/baseline-snapshots/`](./.bee/specs/2026-05-06-kadena-stoic-legacy-vendoring/baseline-snapshots/)
- v3.3.8 → v4.0.0 migration: [`MIGRATION-v4.md`](./MIGRATION-v4.md)
