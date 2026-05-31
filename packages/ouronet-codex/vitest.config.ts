import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Same monorepo-source-resolution pattern as packages/ouronet-core/vitest.config.ts —
// aliases let test files import from `@stoachain/{stoa-core,ouronet-core}/<subpath>`
// without depending on built dist artifacts. Subpath aliases come BEFORE root
// aliases so vitest picks the most-specific match first.
//
// NOTE on kadena-stoic-legacy: no aliases for it (same reason documented in
// packages/{stoa-core,ouronet-core}/vitest.config.ts — vendored .cjs source's
// internal `require("./X")` calls can't be resolved by vitest's transform layer
// against `src/`; they only work after the build-time .cjs extension rewrite
// lands files in `dist/`). Use the published `exports` map for runtime
// resolution; `tsconfig.base.json`'s paths block handles type resolution.
const stoaCoreSrc = resolve(__dirname, "../stoa-core/src");
const ouronetCoreSrc = resolve(__dirname, "../ouronet-core/src");
const ouronetCodexSrc = resolve(__dirname, "src");

export default defineConfig({
  resolve: {
    alias: [
      // Self-referencing subpath aliases for tests inside ouronet-codex.
      // Includes "/state" which is NOT in package.json's `exports` map
      // (intentionally private — see src/state/index.ts comment). Tests
      // get access via this alias; external consumers don't.
      { find: /^@stoachain\/ouronet-codex\/adapters$/, replacement: `${ouronetCodexSrc}/adapters/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/provider$/, replacement: `${ouronetCodexSrc}/provider/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/hooks$/, replacement: `${ouronetCodexSrc}/hooks/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/components$/, replacement: `${ouronetCodexSrc}/components/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/resolver$/, replacement: `${ouronetCodexSrc}/resolver/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/errors$/, replacement: `${ouronetCodexSrc}/errors/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/types$/, replacement: `${ouronetCodexSrc}/types/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/google-drive$/, replacement: `${ouronetCodexSrc}/google-drive/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/state$/, replacement: `${ouronetCodexSrc}/state/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/codex-identity$/, replacement: `${ouronetCodexSrc}/codex-identity/index.ts` },
      { find: /^@stoachain\/ouronet-codex\/ui$/, replacement: `${ouronetCodexSrc}/ui/index.ts` },
      { find: /^@stoachain\/ouronet-codex$/, replacement: `${ouronetCodexSrc}/index.ts` },
      // Cross-package aliases — ouronet-core
      { find: /^@stoachain\/ouronet-core\/interactions\/(.+)$/, replacement: `${ouronetCoreSrc}/interactions/$1.ts` },
      { find: /^@stoachain\/ouronet-core\/interactions$/, replacement: `${ouronetCoreSrc}/interactions/index.ts` },
      { find: /^@stoachain\/ouronet-core\/constants$/, replacement: `${ouronetCoreSrc}/constants/index.ts` },
      { find: /^@stoachain\/ouronet-core\/codex$/, replacement: `${ouronetCoreSrc}/codex/index.ts` },
      { find: /^@stoachain\/ouronet-core\/pact$/, replacement: `${ouronetCoreSrc}/pact/index.ts` },
      { find: /^@stoachain\/ouronet-core$/, replacement: `${ouronetCoreSrc}/index.ts` },
      // Cross-package aliases — stoa-core
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
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
