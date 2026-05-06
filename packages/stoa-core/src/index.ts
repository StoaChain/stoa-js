/**
 * `@stoachain/stoa-core` — chain-generic foundation for the StoaChain
 * TypeScript stack.
 *
 * This root entry is intentionally near-empty. Consumers MUST reach
 * the domain layers through subpath exports, which the package.json
 * `exports` field enumerates:
 *
 *   import { ... } from "@stoachain/stoa-core/signing";
 *   import { ... } from "@stoachain/stoa-core/wallet";
 *   import { ... } from "@stoachain/stoa-core/guard";
 *   // ... etc.
 *
 * Tree-shaking + the explicit subpath surface are the contract — adding
 * re-exports here would couple every consumer to the union of all
 * domains. See `packages/stoa-core/package.json` for the full subpath
 * map.
 */
export {};
