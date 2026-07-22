# stoa-js

The StoaChain TypeScript stack — a two-package npm workspace under one GitHub monorepo.

## Packages

| Package | Purpose | Direct link |
|---|---|---|
| [`@stoachain/kadena-stoic-legacy`](./packages/kadena-stoic-legacy) | Sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship. Five subpath exports preserved byte-identical to upstream at `1.18.3 / 0.4.4 / 0.7.0 / 0.6.2`. Born at v4.1.0 in response to upstream supply-chain risk. BSD-3-Clause. | [npm](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) · [README](./packages/kadena-stoic-legacy/README.md) · [CHANGELOG](./packages/kadena-stoic-legacy/CHANGELOG.md) |
| [`@stoachain/stoa-core`](./packages/stoa-core) | Chain-generic StoaChain foundation: signing, wallet, crypto envelope, network failover, gas calibration, guard analysis, DALOS key-gen, observability seam, error taxonomy, on-chain read primitives, Pact-code format helpers. | [npm](https://www.npmjs.com/package/@stoachain/stoa-core) · [README](./packages/stoa-core/README.md) · [CHANGELOG](./packages/stoa-core/CHANGELOG.md) |

Build / publish order: `kadena-stoic-legacy → stoa-core`. `@stoachain/stoa-core` peer-depends on `@stoachain/kadena-stoic-legacy`. Both packages release atomically at the same version — a single `vX.Y.Z` git tag publishes both (or whichever one's `package.json` version matches the tag, via the smart per-package CI workflow).

## What lives here, and what moved

This repo is the **chain-level** half of the stack. The **Ouronet-level** half moved out in the Phase-4 reorganisation so that package identity matches org ownership:

| Was | Now | Repo |
|---|---|---|
| `@stoachain/ouronet-core` | `@ouronet/ouronet-core` | [OuroborosNetwork/ouronet-libs](https://github.com/OuroborosNetwork/ouronet-libs) |
| `@stoachain/ouronet-codex` | `@ouronet/ouronet-codex` | [OuroborosNetwork/ouronet-libs](https://github.com/OuroborosNetwork/ouronet-libs) |

`ouronet-libs` consumes the two packages here from npm as ordinary dependencies — nothing is vendored or duplicated, and the dependency direction is one-way: **ouronet-libs → stoa-js**, never the reverse. The old `@stoachain/ouronet-*` names are deprecated on npm and point at the new ones.

## The boundary

**Chain-generic infrastructure** (reusable by any StoaChain consumer — CLI tools, validators, third-party integrations) stays here. **Ouronet protocol logic** (the `ouronet-ns` Pact module callers, the codex backup format, the protocol's autonomic accounts) lives in `ouronet-libs`. The boundary is explicit at the import-path level:

```ts
// Chain-generic — this repo
import { setLogger }                  from "@stoachain/stoa-core/observability";
import { CodexSigningStrategy }       from "@stoachain/stoa-core/signing";
import { withFailover }               from "@stoachain/stoa-core/network";
import { decryptStringV2 }            from "@stoachain/stoa-core/crypto";

// Ouronet-specific — ouronet-libs
import { serializeCodex }             from "@ouronet/ouronet-core/codex";
import { executeCoil }                from "@ouronet/ouronet-core/interactions/wrapFunctions";
import { KADENA_NAMESPACE }           from "@ouronet/ouronet-core/constants";
```

A consumer that only needs chain-generic infrastructure (a StoaChain validator, a CLI key-gen tool) installs just `@stoachain/stoa-core` and never pulls in the Ouronet protocol layer.

## Repo layout

```
stoa-js/
├── packages/
│   ├── kadena-stoic-legacy/ # @stoachain/kadena-stoic-legacy
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── README.md
│   │   └── CHANGELOG.md
│   └── stoa-core/           # @stoachain/stoa-core
│       ├── src/
│       ├── tests/
│       ├── package.json
│       ├── README.md
│       └── CHANGELOG.md
├── .github/workflows/
│   ├── ci.yml               # PR/push: typecheck + test + build
│   └── publish.yml          # tag: per-package npm publish + release
├── tsconfig.base.json       # shared TS config + dev-time path mapping
├── tsconfig.json            # workspace IDE config
├── package.json             # workspace root (private)
├── README.md                # this file
└── MIGRATION-v4.md          # upgrade path from v3.x
```

## Common commands

Run from the monorepo root — npm workspaces iterate both packages:

```bash
npm install                   # one install for both packages (deduped)
npm run typecheck             # tsc --noEmit across both
npm test                      # kadena-stoic-legacy + stoa-core specs
npm run build                 # kadena-stoic-legacy → stoa-core (dependency order)
npm run clean                 # rimraf dist/ across both packages
```

Per-package work — each `packages/*` directory has the same script names:

```bash
npm run test --workspace=@stoachain/stoa-core
npm run build --workspace=@stoachain/kadena-stoic-legacy
```

Single-test runs:

```bash
npx vitest run tests/strategy.test.ts            --root packages/stoa-core
npx vitest run -t "name fragment"                --root packages/stoa-core
```

## Development workflow

`tsconfig.base.json` carries dev-time `paths` that resolve `@stoachain/stoa-core/*` to source files (not the unbuilt `dist/`), so typecheck and IDE intellisense work without requiring a build step first. Per-package `tsconfig.build.json` overrides `paths: {}` so emitted declarations resolve through `node_modules` → published `exports` map (the published behaviour).

Build order is significant: `npm run build` always builds `@stoachain/kadena-stoic-legacy` first, then `@stoachain/stoa-core` (consumer). Lexical workspace ordering would do the wrong thing — the root script makes the order explicit.

## Publishing flow

1. Bump the shipping package's `package.json` to the new version (both, when releasing atomically).
2. Add a `v{X.Y.Z}` entry to that package's `CHANGELOG.md` (each package's npmjs.com page shows its own CHANGELOG).
3. Update the package's `README.md` Status block + version history to reference the new version.
4. Commit the version bump + docs.
5. `git tag vX.Y.Z -m "..."` (annotated; the tag message becomes the GitHub Release body).
6. `git push origin main && git push origin vX.Y.Z`.
7. `.github/workflows/publish.yml` runs typecheck + test + build + per-package version-parity gates + `npm publish` (kadena-stoic-legacy first, then stoa-core, each with `--provenance` SLSA attestations) + GitHub Release creation.

The version-parity gates fail the workflow before any `npm publish` runs if a queued package's `package.json` version disagrees with the tag, or if its `README.md` Status block / version history doesn't reference the publish version, or if its `CHANGELOG.md`'s first `## ` heading doesn't match. Stale-doc ships are physically impossible.

## Versioning discipline

Strict semver. The two packages here release at the same version — a bump in either bumps both. This is intentional: they are co-developed in the same monorepo and the peer-dep on `@stoachain/kadena-stoic-legacy` is pinned to an exact version (`"4.3.6"` not `"^4.3.6"`), so range tolerance buys nothing and risks accidental cross-version mismatch in consumer trees. The `@ouronet/*` packages in `ouronet-libs` carry their own independent version lines.

Breaking changes → major bump → consumers upgrade deliberately. Never silently change the shape of a public type or barrel export — these packages exist to keep `OuronetUI` and `AncientHolder HUB` from forking logic, and a stable surface is the whole point. Each package's `CHANGELOG.md` is the source of truth for what changed in that package across versions; `MIGRATION-v4.md` documents the v3.x → v4.0.0 upgrade path specifically.

## Status

**v4.1.0 (2026-05-07)** — Sovereign vendoring of `@kadena/*` upstream packages under StoaChain stewardship. New third package [`@stoachain/kadena-stoic-legacy`](./packages/kadena-stoic-legacy) ships `@kadena/{client,cryptography-utils,types,hd-wallet}` byte-identical to upstream at `1.18.3 / 0.4.4 / 0.7.0 / 0.6.2`. `stoa-core` and `ouronet-core` retargeted: 27 internal `@kadena/*` imports rewired onto the new sibling subpaths. All 3 packages atomically at `4.1.0`. **819 tests passing** (7 + 551 + 261). See [`MIGRATION-v4.1.md`](./MIGRATION-v4.1.md) for the v4.0.x → v4.1.0 consumer upgrade path. The v3.3.8 → v4.0.0 monorepo-split upgrade is [`MIGRATION-v4.md`](./MIGRATION-v4.md).

**v4.0.0 (2026-05-06)** — Initial monorepo release. Both v4.0.x packages at `4.0.0` / `4.0.1`. **703 tests passing** (485 + 218). See [`MIGRATION-v4.md`](./MIGRATION-v4.md) for the v3.3.8 → v4.0.0 upgrade path.

## License

UNLICENSED — see each package's LICENSE field.
