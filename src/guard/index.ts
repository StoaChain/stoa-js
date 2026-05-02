// @stoachain/ouronet-core/guard

// v2.3.0 — new public surface: `UnknownPredicateError` (typed Error
// class) is re-exported from this barrel via the `export * from
// "./guardUtils"` line below. Thrown by `computeThreshold` on
// unrecognised predicates and folded into `analyzeGuard`'s
// `predicateRecognized: false` bit. Closes F-CORE-017.
export * from "./guardUtils";
// v1.6.0 — Smart Ouronet Account auth-path resolution primitives.
// Used by the UI's AuthPathZone to render the three auth branches
// (account guard / sovereign / governor) of a Smart account as a
// pickable list, and to flag transactions where no branch is signable
// by the codex (fall-through to Execute Code).
export * from "./smartAccountAuth";
