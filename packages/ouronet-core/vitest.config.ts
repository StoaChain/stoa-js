import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// During development the tests reach across the monorepo into
// `@stoachain/stoa-core/*` — but the published exports map points at
// `./dist/...`, which doesn't exist until `npm run build`. These
// aliases mirror the `paths` block in `tsconfig.base.json` so that
// vitest resolves the bare specifiers to TypeScript source files at
// runtime, matching the typecheck behaviour. Subpath order matters:
// the root `@stoachain/stoa-core` entry must come AFTER the
// subpath entries so vitest picks the most-specific match first.
const stoaCoreSrc = resolve(__dirname, "../stoa-core/src");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@stoachain\/stoa-core\/constants$/, replacement: `${stoaCoreSrc}/constants/index.ts` },
      { find: /^@stoachain\/stoa-core\/network$/, replacement: `${stoaCoreSrc}/network/index.ts` },
      { find: /^@stoachain\/stoa-core\/observability$/, replacement: `${stoaCoreSrc}/observability/index.ts` },
      { find: /^@stoachain\/stoa-core\/gas$/, replacement: `${stoaCoreSrc}/gas/index.ts` },
      { find: /^@stoachain\/stoa-core\/guard$/, replacement: `${stoaCoreSrc}/guard/index.ts` },
      { find: /^@stoachain\/stoa-core\/crypto$/, replacement: `${stoaCoreSrc}/crypto/index.ts` },
      { find: /^@stoachain\/stoa-core\/errors$/, replacement: `${stoaCoreSrc}/errors/index.ts` },
      { find: /^@stoachain\/stoa-core\/signing$/, replacement: `${stoaCoreSrc}/signing/index.ts` },
      { find: /^@stoachain\/stoa-core\/wallet$/, replacement: `${stoaCoreSrc}/wallet/index.ts` },
      { find: /^@stoachain\/stoa-core\/reads$/, replacement: `${stoaCoreSrc}/reads/index.ts` },
      { find: /^@stoachain\/stoa-core\/pact$/, replacement: `${stoaCoreSrc}/pact/index.ts` },
      { find: /^@stoachain\/stoa-core\/dalos$/, replacement: `${stoaCoreSrc}/dalos/index.ts` },
      { find: /^@stoachain\/stoa-core$/, replacement: `${stoaCoreSrc}/index.ts` },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    typecheck: {
      enabled: true,
      tsconfig: "tsconfig.json",
      include: ["tests/types.test.ts"],
    },
  },
});
