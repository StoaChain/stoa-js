# Stack

## Languages and Frameworks
- TypeScript ^5.7.2 with `strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters` (`tsconfig.json:11-15`)
- ES module package (`package.json:5` -- `"type": "module"`); target ES2020, lib ES2023, `moduleResolution: "bundler"` (`tsconfig.json:2-5`)
- Node engine `>=20` (`package.json:73-75`); CI runs on Node 22 (`.github/workflows/ci.yml:22`)
- No UI framework, no server framework -- this is a pure published library (`src/index.ts` is intentionally `export {}`)

## Dependencies
- Runtime: `@stoachain/dalos-crypto ^1.2.0` -- DALOS Genesis cryptography registry, re-exported through `src/dalos/index.ts`
- Peer (consumers must install): `@kadena/client ^1.17.0`, `@kadena/cryptography-utils ^0.4.0`, `@kadena/hd-wallet ^0.6.0`, `@kadena/types ^0.7.0`, `@noble/curves ^1.4.0`, `@scure/bip39 ^1.2.0` (`package.json:87-94`)
- Dev mirrors of the peer set plus `vitest ^4.1.0`, `typescript ^5.7.2`, `rimraf ^6.0.1`, `@types/node ^22.10.0` (`package.json:95-106`)

## Integrations
- StoaChain / Chainweb Pact API -- two well-known nodes hardcoded: `https://node2.stoachain.com` (primary, ASIC, 2M gas) and `https://node1.stoachain.com` (fallback, seed, 2M gas) (`src/network/nodeFailover.ts:13-20`)
- Network id `"stoa"`, chain `"0"`, namespace `"ouronet-ns"` (`src/constants/kadena.ts:10-14`)
- Stoa Autonomic Accounts pinned by `c:` prefix constants -- `STOA_AUTONOMIC_OUROBOROS`, `STOA_AUTONOMIC_LIQUIDPOT`, `STOA_AUTONOMIC_OURONETGASSTATION` (`src/constants/kadena.ts:38-44`)
- npmjs.org public registry, scope `@stoachain` (`package.json:111-114`); published as `@stoachain/ouronet-core`
- Two known downstream consumers documented in source comments: OuronetUI (browser SPA) and AncientHolder/AncientHoldings HUB (Node.js server) (`src/signing/types.ts:38-44`, `src/reads/pactReader.ts:16-21`)

## Build and Test
- `npm run build` -- `tsc -p tsconfig.build.json` emits `dist/` (only directory shipped via `package.json:71`)
- `npm run typecheck` -- `tsc --noEmit` against `tsconfig.json` (which sets `noEmit: true` and `declaration: true`)
- `npm test` -- `vitest run --passWithNoTests`; watch via `npm run test:watch`
- `npm run prepare` runs `npm run build` (publish-time hook)
- Vitest config: node environment, picks up both `tests/**/*.test.ts` and `src/**/*.test.ts`, alias `@` -> `./src` (`vitest.config.ts:5-13`)
- 12 test files under `tests/` -- ~435 `describe`/`it` calls across cfm-builders, codex-codec, dalos-integration, encryption, encryption-upgrade, gas, guard, network, pact-format, signing, smart-account-auth, strategy
- CI: `.github/workflows/ci.yml` runs typecheck -> test -> build on every PR/push to `main`/`master`; uses `npm install` (not `ci`) intentionally per inline note (`ci.yml:27-28`)
- Publish: `.github/workflows/publish.yml` triggers on `v*` tags; runs typecheck + test + build, enforces tag-vs-`package.json` version parity (load-bearing per `CLAUDE.md:67`), then `npm publish --access public`
