# Phase 2: Type-Level Regression Lock - Discussion Context

**Generated:** 2026-04-30T00:00:00Z
**Mode:** Infrastructure phase -- auto-skipped discuss

<domain>
Infrastructure phase. Pure test-scaffolding for the Phase 1 IKadenaKeypair consolidation: enable vitest's typecheck mode (narrowed to `tests/types.test.ts` only), create `tests/types.test.ts` with cross-subpath assignability assertions (`Parameters<typeof fn>[N]` idiom), run npm test + typecheck + manual sanity-check gates. No user-facing behavior. All decisions are locked by REQ-13, the spec, requirements.md, 3 iterations of plan review, and 3 iterations of cross-plan consistency review.
</domain>

<decisions>
## Implementation Decisions

### Locked Constraints (already pinned by spec + plan review + cross-plan review)
- vitest.config.ts gets `typecheck: { enabled: true, include: ["tests/types.test.ts"] }` (single-file scope per F-XPHASE-001 fix). [confidence: HIGH]
- tests/types.test.ts uses `import type { IKadenaKeypair } from "../src/signing"` for canonical, and `Parameters<typeof fn>[N]` (or `[0]["fieldName"]` for struct-wrapped) for the 4 interactions subpaths. [confidence: HIGH]
- Real exported functions to anchor: `executeDeployStandardAccount` (activate, struct-nested at `[0]["gasPayerKey"]`), `executeSmartSwapWithSlippage` (dex, struct-nested at `[0]["kadenaKeypair"]`), `kpayBuy` (kpay, direct positional at `[4]`), `coilTokensGeneric` (coil, direct positional at `[1]`). [confidence: HIGH]
- T2.4 manual experiment uses `executeDeployStandardAccount`'s `gasPayerKey` slot for the drift demo. [confidence: HIGH]

### Carried Forward (from Phase 1)
- Phase 1 deleted 4 duplicate IKadenaKeypair declarations + 1 sibling IOuroAccountKeypair, added @deprecated JSDoc to ouroFunctions's Phase-2b copy. Test count baseline: 320 (12 test files).
- Phase 1's iter-1 fix removed the off-spec `tests/wrap-functions-import.test.ts` and reordered `import type` to end of import block in 4 files. Final baseline: 320 tests / 12 files.

### Claude's Discretion
None — every decision is pre-locked.
</decisions>
