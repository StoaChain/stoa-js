# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

`stoa-js` is the **chain-level** half of the StoaChain TypeScript stack — a two-package npm workspace publishing to the public `@stoachain` scope:

- **`@stoachain/kadena-stoic-legacy`** — sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}`, byte-identical to upstream. BSD-3-Clause. Zero `@stoachain/*` peer-deps.
- **`@stoachain/stoa-core`** — chain-generic foundation: signing, wallet, crypto envelope, network failover, gas calibration, guard analysis, DALOS key-gen, observability seam, error taxonomy, on-chain reads, Pact-code format helpers. Peer-deps on `kadena-stoic-legacy`.

Treat this as a library repo, not an app: no UI, no server, no runtime entry point. Every change ripples to consumers via npm publish.

**The Ouronet-level half moved out** in the Phase-4 reorg. `@stoachain/ouronet-core` → `@ouronet/ouronet-core` and `@stoachain/ouronet-codex` → `@ouronet/ouronet-codex` now live in [`OuroborosNetwork/ouronet-libs`](https://github.com/OuroborosNetwork/ouronet-libs), which consumes this repo's packages from npm. The dependency direction is one-way: **ouronet-libs → stoa-js**, never the reverse. Never add an `@ouronet/*` dependency here.

## Common commands

```bash
npm install
npm run typecheck  # tsc --noEmit across both packages
npm run build      # kadena-stoic-legacy → stoa-core (order is significant)
npm test           # vitest across both packages
npm run clean      # rimraf dist/
```

Per-package: `npm run <script> --workspace=@stoachain/stoa-core`.
Single test: `npx vitest run tests/strategy.test.ts --root packages/stoa-core`, or `-t "name fragment"`.

CI (`.github/workflows/ci.yml`) runs typecheck → build → test on every PR/push. Publish (`.github/workflows/publish.yml`) runs the same plus per-package version-parity gates and `npm publish` on any `v*` tag.

## Module layout — subpath exports

Every directory under `packages/stoa-core/src/` corresponds to a subpath export declared in its `package.json`. Consumers are explicitly steered toward subpath imports for tree-shaking — the root barrel is intentionally near-empty:

```ts
import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";   // good
import { CodexSigningStrategy } from "@stoachain/stoa-core";           // not supported
```

## Architectural patterns to preserve

**Pluggable seams, not DI.** Three narrow injection points let core stay environment-agnostic without a framework:

1. `setPactReader(fn)` in `src/reads/pactReader.ts` — consumers call once at boot. Browser plugs in its cache-aware reader; server leaves the default uncached `rawCalibratedDirtyRead`. Calling code uses `pactRead(...)`, never the raw reader.
2. `KeyResolver` + `PactClient` interfaces in `src/signing/types.ts` — consumed by `CodexSigningStrategy`. OuronetUI implements `ReduxCodexResolver`, HUB a `FileCodexResolver`. Never import a concrete resolver into core.
3. `BalanceResolver` in `src/wallet/types.ts` — instance-level analogue of `setPactReader`'s seam (a function alias, NOT an interface), applied to `KadenaWallet.getBalance()`. Default throws a clearly-worded error if unconfigured. This cuts the `wallet → interactions` import edge so the wallet subpath doesn't transitively pull in `@kadena/client`.

**Node failover is global state.** `src/network/nodeFailover.ts` switches the active Stoa node on health-check failure. Anything making an HTTP call must route through it — never `createClient(PACT_URL)` pinned to a single node.

**`createDefaultRegistry()` registers DALOS Genesis only.** `Leto`/`Artemis`/`Apollo` and `createGen1Primitive` are re-exported from `./dalos` but deliberately NOT in the default registry; consumers opt in via `registry.register(...)`.

**The vendored packages are frozen.** `kadena-stoic-legacy` mirrors upstream byte-identically. Do not "improve" vendored source — a divergence defeats the point of the vendoring.

## Test layout

Tests live in each package's `tests/` directory (not co-located). Vitest picks up both `tests/**/*.test.ts` and `src/**/*.test.ts`; `tsconfig.build.json` excludes test files from the published `dist/`.

`packages/stoa-core/vitest.config.ts` deliberately has **no** `resolve.alias` for `kadena-stoic-legacy` — its vendored CJS source layout is incompatible with vitest's transform layer, so those imports resolve through the built `dist/` via the package's `exports` map. That is why **build must precede test** in CI: on a fresh checkout `dist/` doesn't exist and Node throws `ERR_MODULE_NOT_FOUND`.

## Publishing flow

1. Bump the shipping package's `package.json` version + add its `CHANGELOG.md` entry + update its `README.md` Status block and version history.
2. Commit, then `git tag vX.Y.Z -m "..."` (annotated — the message becomes the GitHub Release body) and push both.
3. `publish.yml` typechecks, builds, tests, gates on version-parity, and publishes with `--provenance`. Publishing uses the `NPM_PUBLISHER` secret.

The version-parity gates are load-bearing — never push a tag whose number disagrees with `package.json`.

## Versioning discipline

Strict semver. The two packages here release at the same version; the peer-dep is pinned exactly (`"4.3.6"`, not `"^4.3.6"`), so range tolerance buys nothing and risks cross-version mismatch in consumer trees. Breaking changes → major bump → consumers upgrade deliberately. Never silently change the shape of a public type or barrel export — a stable surface is the whole point of this library. Each `CHANGELOG.md` is the source of truth for that package.

# BeeDev
Stack: typescript-library
Use /bee:new-spec to start a new feature.
Use /bee:progress to see current state.
Always use Context7 MCP for framework documentation lookups.
