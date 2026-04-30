[TECH-DEBT] Guard / Smart Account auth-path layer hardening

## Problem
Four findings cluster around `src/guard/smartAccountAuth.ts` and `src/guard/guardUtils.ts` — the layer that classifies guard shapes (keyset / keyset-ref / capability / user) and analyzes the three branches of a Smart Ouronet Account's `enforce-one` (account / sovereign / governor) for signability. The current implementation has shape-discrimination weaknesses, casing inconsistencies, and a defensive-default that hides chain divergence:

1. **Shape discrimination is too lax.** `classifyGuardKind` returns `"capability"` if the object has a string-typed `cgName` field, regardless of whether the rest of the capability-guard shape (`cgArgs`, `cgPactId`) is present and valid. A malformed `{ cgName: "", cgArgs: null }` classifies as a capability and short-circuits further analysis.
2. **Casing inconsistency between `keysetref` (lowercase, on-chain native) and `keysetRef` (camelCase, IKeyset shape).** `classifyGuardKind` checks `"keysetref"` (lowercase, line 91); `extractKeysetFromGuard` reads `o.keysetRef` (camelCase, line 124) when forwarding to the `IKeyset` shape. Whichever resolver hydrates the field decides which casing wins; the other half drops.
3. **Underdocumented state combinations.** `firstSatisfied === -1` AND `anyKeyBased === true` is a valid state: a key-based branch exists but no codex key signs it. Callers reading `anyKeyBased = true` may assume they can prompt for keys; without `firstSatisfied`, they may default to an unsignable branch and silently fail.
4. **Predicate fallback to `keys-all` for unknown predicates.** `computeThreshold` returns `keyCount` for any unknown predicate string (with a `console.warn`). Intent (fail-closed) is correct. But: the warning never propagates to the caller; users with typo'd predicates get silent enforcement of `keys-all`; codex-side analysis can diverge from on-chain truth without any signal.

## Findings (4)
| ID | Severity | Title |
|---|---|---|
| F-CORE-016a | MEDIUM | `classifyGuardKind` discriminates on string presence, not value validity |
| F-CORE-016b | MEDIUM | `extractKeysetFromGuard` ignores `keysetRef` post-resolution shape inconsistency |
| F-CORE-016c | MEDIUM | `analyzeSmartAccountAuthPaths` state combinations not documented |
| F-CORE-017 | MEDIUM | Predicate fallback to `keys-all` on unknown predicates |

## Locations
| File | Lines | Concern |
|---|---|---|
| `src/guard/smartAccountAuth.ts` | 84-106 | Lax classifyGuardKind |
| `src/guard/smartAccountAuth.ts` | 118-126 | keysetref/keysetRef casing |
| `src/guard/smartAccountAuth.ts` | 209-240 | Underdocumented state combinations |
| `src/guard/guardUtils.ts` | 76-79 | Silent keys-all fallback |

## Required Fixes

### Fix 1 — Tighten guard classification
Update `classifyGuardKind` to require the full minimal shape per kind:

```ts
function classifyGuardKind(g: unknown): GuardKind {
  if (!g || typeof g !== "object") return "unknown";
  const o = g as Record<string, unknown>;
  // Capability: requires all three shape fields
  if (
    typeof o.cgName === "string" &&
    Array.isArray(o.cgArgs) &&
    typeof o.cgPactId === "string"
  ) return "capability";
  // User: requires .fun (string) and .args (array)
  if (typeof o.fun === "string" && Array.isArray(o.args)) return "user";
  // Keyset (inline): requires .pred and .keys
  if (typeof o.pred === "string" && Array.isArray(o.keys)) return "keyset";
  // Keyset-ref (unresolved): requires either casing of the ref field
  if ("keysetref" in o || "keysetRef" in o) return "keyset-ref";
  return "unknown";
}
```

### Fix 2 — Normalize the casing at the boundary
Decide canonical casing (recommend camelCase `keysetRef` for JS-side; map at the chain-IO boundary). Add a normalizing helper:
```ts
function normalizeKeysetRef(g: any): any {
  if (g && typeof g === "object" && "keysetref" in g && !("keysetRef" in g)) {
    return { ...g, keysetRef: g.keysetref };
  }
  return g;
}
```
Apply at the `resolveGuard` boundary (or wherever raw chain data first enters `smartAccountAuth.ts`). After this, internal code only sees `keysetRef`.

### Fix 3 — Document state combinations + add a precise field
Add JSDoc to `SmartAccountAuthPathsAnalysis` enumerating the 4 reachable states:
- `(firstSatisfied >= 0)` — a branch is signable now; UI can call `execute` with that branch.
- `(firstSatisfied === -1, anyKeyBased === true)` — a key-based branch exists but the codex doesn't have the keys; UI prompts for foreign-key add.
- `(firstSatisfied === -1, anyKeyBased === false, anyKnownKind)` — only capability/user/non-key branches; UI directs to Execute Code page.
- `(firstSatisfied === -1, every kind === "unknown")` — unsupported guard shapes; UI shows "this account uses guards this client doesn't understand; please update".

Optionally add `firstSignableButUnsatisfied: number` for the prompt-the-user path so consumers don't need to recompute.

### Fix 4 — Surface unknown predicates
Change `computeThreshold` to either:
- (a) Return a marker tuple `{ threshold: keyCount, isUnknownPredicate: true }`, OR
- (b) Throw a typed `UnknownPredicateError` that the analyzer catches and folds into a `predicateRecognized: false` field on the returned analysis.

Recommendation: (b) — keeps `computeThreshold` return-type stable for the common case; the catch-and-fold pattern lets `analyzeGuard` enrich its result with the recognition bit. UI can then show "predicate not recognized — please update OuronetCore" rather than silently treating it as `keys-all`.

## Side effects
- All four fixes are additive on the analysis result. Existing consumers branching on `firstSatisfied`/`anyKeyBased` keep working. New consumers can opt into the richer info.
- Test fixtures may need updating where they pass under-specified guard shapes that currently classify as one of the four kinds. Those tests should be updated to use realistic shapes.

## Acceptance Criteria
- [ ] `classifyGuardKind` rejects malformed shapes per fix 1; new tests cover each "almost-but-not-quite" shape per kind.
- [ ] `keysetref` (lowercase) and `keysetRef` (camelCase) round-trip correctly through `analyzeSmartAccountAuthPaths`; new test fixtures include both casings.
- [ ] `SmartAccountAuthPathsAnalysis` JSDoc documents the four reachable states; optional `firstSignableButUnsatisfied` added if useful.
- [ ] `analyzeGuard` returns `predicateRecognized: boolean` (or equivalent) so callers can distinguish a real `keys-all` from a guessed-strict fallback.
- [ ] `computeThreshold` no longer silently logs to `console.warn` (or routes via the future logger seam from `[IMPROVEMENT]`).
- [ ] `npm test` passes; `tests/smart-account-auth.test.ts` and `tests/guard.test.ts` extended with at minimum 6 new test cases covering the above.
- [ ] Existing happy-path tests continue to pass without modification.
