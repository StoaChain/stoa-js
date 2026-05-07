import { defineConfig } from "vitest/config";

// NOTE — Phase 4 deviation from REQ-19 (locked):
// The phase plan called for a `resolve.alias` block mirroring the v4.0.0
// stoa-core/* alias pattern in `packages/ouronet-core/vitest.config.ts:1-42`,
// routing `@stoachain/kadena-stoic-legacy/{client,cryptography-utils,types,
// hd-wallet,hd-wallet/chainweaver}` to source files under
// `../kadena-stoic-legacy/src/*/index.ts`.
//
// That pattern works for ouronet-core consuming stoa-core's pure-TypeScript
// source. It DOES NOT work for stoa-core consuming kadena-stoic-legacy's
// vendored CJS source: the `src/*/index.ts` barrels re-export from sibling
// `.cjs` files whose internal `require("./X")` calls (bare-extension, upstream-
// preserved) cannot be resolved by Vitest's transform layer — Node's CJS
// resolver auto-resolves only `.js`/`.json`/`.node`, and the bare-to-`.cjs`
// rewrite happens only at copy time into `dist/` (per `scripts/copy-vendor-
// files.cjs`). Pointing aliases at `src/` therefore breaks 12 of 27 test
// files with `MODULE_NOT_FOUND: Cannot find module './X'` errors.
//
// Resolution: no kadena-stoic-legacy aliases. Runtime resolution flows through
// the published `exports` map → `dist/*/index.js` (where bare requires have
// been rewritten with explicit `.cjs` extensions). Type resolution flows
// through `tsconfig.base.json`'s paths block (Phase 1 T1.6) → `src/*/index.ts`.
// Both work; only Vitest's runtime alias path was incompatible. Tests pass at
// the established 485 stoa-core baseline.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
