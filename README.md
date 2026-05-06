# stoa-js

The StoaChain TypeScript stack — a two-package npm workspace under one GitHub monorepo.

## Packages

| Package | Purpose | Direct link |
|---|---|---|
| [`@stoachain/stoa-core`](./packages/stoa-core) | Chain-generic StoaChain foundation: signing, wallet, crypto envelope, network failover, gas calibration, guard analysis, DALOS key-gen, observability seam, error taxonomy, on-chain read primitives, Pact-code format helpers. | [npm](https://www.npmjs.com/package/@stoachain/stoa-core) · [README](./packages/stoa-core/README.md) · [CHANGELOG](./packages/stoa-core/CHANGELOG.md) |
| [`@stoachain/ouronet-core`](./packages/ouronet-core) | Ouronet protocol business logic: codex backup format, the 13 `interactions/*` Pact builders for the `ouronet-ns` modules, the `STOA_AUTONOMIC_*` autonomic accounts, and the cfm Pact-code assembler. | [npm](https://www.npmjs.com/package/@stoachain/ouronet-core) · [README](./packages/ouronet-core/README.md) · [CHANGELOG](./packages/ouronet-core/CHANGELOG.md) |

`@stoachain/ouronet-core` peer-depends on `@stoachain/stoa-core` at the same exact version. Both packages release atomically out of this monorepo at the same version — a single `vX.Y.Z` git tag publishes both.

## Why split?

The pre-v4 single `@stoachain/ouronet-core` package mixed two concerns: **chain-generic infrastructure** (anything reusable by a non-Ouronet StoaChain consumer — CLI tools, validators, third-party integrations) and **Ouronet protocol logic** (the `ouronet-ns` Pact module callers, the codex backup format, the protocol's autonomic accounts). The split makes that boundary explicit at the import-path level:

```ts
// Chain-generic
import { setLogger }                  from "@stoachain/stoa-core/observability";
import { CodexSigningStrategy }       from "@stoachain/stoa-core/signing";
import { withFailover }               from "@stoachain/stoa-core/network";
import { decryptStringV2 }            from "@stoachain/stoa-core/crypto";

// Ouronet-specific
import { serializeCodex }             from "@stoachain/ouronet-core/codex";
import { executeCoil }                from "@stoachain/ouronet-core/interactions/wrapFunctions";
import { KADENA_NAMESPACE }           from "@stoachain/ouronet-core/constants";
```

Consumers that only needed Ouronet (the codex format, the `interactions/*` callers, the namespace constants) can keep `@stoachain/ouronet-core` and skip `@stoachain/stoa-core` if they prefer — the peer-dep auto-installs the foundation. Consumers that only need chain-generic infrastructure (a future StoaChain validator, a CLI key-gen tool) can install just `@stoachain/stoa-core` and skip the Ouronet protocol layer entirely.

## Repo layout

```
stoa-js/
├── packages/
│   ├── stoa-core/           # @stoachain/stoa-core
│   │   ├── src/
│   │   ├── tests/           # 485 specs
│   │   ├── package.json
│   │   ├── README.md
│   │   └── CHANGELOG.md
│   └── ouronet-core/        # @stoachain/ouronet-core
│       ├── src/
│       ├── tests/           # 218 specs
│       ├── package.json
│       ├── README.md
│       └── CHANGELOG.md
├── .github/workflows/
│   ├── ci.yml               # PR/push: typecheck + test + build
│   └── publish.yml          # tag: dual-package npm publish + release
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
npm test                      # 703 specs (485 stoa-core + 218 ouronet-core)
npm run build                 # stoa-core first, then ouronet-core (dependency order)
npm run clean                 # rimraf dist/ in both packages
```

Per-package work — each `packages/*` directory has the same script names:

```bash
npm run test --workspace=@stoachain/stoa-core
npm run build --workspace=@stoachain/ouronet-core
```

Single-test runs:

```bash
npx vitest run tests/cfm-builders.test.ts        --root packages/ouronet-core
npx vitest run tests/strategy.test.ts            --root packages/stoa-core
npx vitest run -t "name fragment"                --root packages/stoa-core
```

## Development workflow

`tsconfig.base.json` carries dev-time `paths` that resolve `@stoachain/stoa-core/*` to source files (not the unbuilt `dist/`), so typecheck and IDE intellisense work without requiring a build step first. Per-package `tsconfig.build.json` overrides `paths: {}` so emitted declarations resolve through `node_modules` → published `exports` map (the published behaviour). `packages/ouronet-core/vitest.config.ts` mirrors the path mapping with `resolve.alias` so vitest also runs against source.

Build order is significant: `npm run build` always builds `@stoachain/stoa-core` first, then `@stoachain/ouronet-core` (consumer). Lexical workspace ordering would do the wrong thing — the root script makes the order explicit.

## Publishing flow

1. Bump `packages/stoa-core/package.json` AND `packages/ouronet-core/package.json` to the same new version (atomic invariant).
2. Add a `v{X.Y.Z}` entry to BOTH `packages/stoa-core/CHANGELOG.md` AND `packages/ouronet-core/CHANGELOG.md` (each package's npmjs.com page shows its own CHANGELOG).
3. Update each package's `README.md` Status block + version history to reference the new version.
4. Commit the version bump + docs.
5. `git tag vX.Y.Z -m "..."` (annotated; the tag message becomes the GitHub Release body).
6. `git push origin main && git push origin vX.Y.Z`.
7. `.github/workflows/publish.yml` runs typecheck + test + build + per-package version-parity gates + `npm publish` (stoa-core first, then ouronet-core, each with `--provenance` SLSA attestations) + GitHub Release creation.

The version-parity gates fail the workflow before any `npm publish` runs if either package's `package.json` version disagrees with the tag, or if either package's `README.md` Status block / version history doesn't reference the publish version, or if either `CHANGELOG.md`'s first `## ` heading doesn't match. Stale-doc ships are physically impossible.

## Versioning discipline

Strict semver. Both packages always release at the same version — a major/minor/patch bump in either package bumps both. This is intentional: the two packages are co-developed in the same monorepo and the peer-dep on `@stoachain/stoa-core` is pinned to an exact version (`"4.0.0"` not `"^4.0.0"`), so range tolerance buys nothing and risks accidental cross-version mismatch in consumer trees.

Breaking changes → major bump → consumers upgrade deliberately. Never silently change the shape of a public type or barrel export — these packages exist to keep `OuronetUI` and `AncientHolder HUB` from forking logic, and a stable surface is the whole point. Each package's `CHANGELOG.md` is the source of truth for what changed in that package across versions; `MIGRATION-v4.md` documents the v3.x → v4.0.0 upgrade path specifically.

## Status

**v4.0.0 (2026-05-06)** — Initial monorepo release. Both packages at `4.0.0`. **703 tests passing** (485 + 218). See [`MIGRATION-v4.md`](./MIGRATION-v4.md) for the v3.3.8 → v4.0.0 upgrade path.

## License

UNLICENSED — see each package's LICENSE field.
