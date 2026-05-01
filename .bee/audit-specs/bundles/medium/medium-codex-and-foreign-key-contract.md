[TECH-DEBT] Codex import + foreign-key resolver contract hardening

## Problem
Two contract gaps in adjacent layers:

### F-CORE-013 — `deserializeCodex` accepts any object that carries `version: "1.2"`
`deserializeCodex` validates the version field but does NOT validate the shape of `kadenaWallets`, `ouronetWallets`, `addressBook`, or `uiSettings`. Anything passing the version check is cast to `CodexExportV1_2<...>`. A malformed codex JSON flows downstream as a typed-but-broken payload, with the actual failure surfacing several layers later (typically when the UI tries to render `kadenaWallets[i].secret` and crashes).

A minimum-shape `{ "version": "1.2" }` payload passes today and produces a bare object that pretends to be a fully-shaped codex. A user importing a corrupted backup file sees the failure at the next consumer (typically a `TypeError` deep in render), not at the import boundary. Recovery UX is degraded.

### F-CORE-014 — `KeyResolver.requestForeignKey` is optional but treated as recoverable
The `KeyResolver` interface declares `requestForeignKey` as optional. `CodexSigningStrategy` checks `this.resolver.requestForeignKey ? ... : undefined` and falls back to `undefined` when not implemented. If the transaction demands a foreign-key signer and the resolver doesn't implement the method, failure surfaces several layers down: `universalSignTransaction` complains about a missing private key with an opaque message — not "your resolver doesn't support foreign keys; configure one".

Server-side resolvers (HUB) that intentionally omit `requestForeignKey` produce a confusing error path when a transaction contains a foreign key. The contract doesn't say "throwing here is the explicit signal" — it just lets the call proceed and fail downstream.

## Findings (2)
| ID | Severity | Title |
|---|---|---|
| F-CORE-013 | MEDIUM | `deserializeCodex` accepts any object that carries `version: "1.2"` |
| F-CORE-014 | MEDIUM | `KeyResolver.requestForeignKey` is optional but treated as recoverable |

## Locations
- `src/codex/codec.ts:75-93` — deserializeCodex
- `src/signing/types.ts:62-69` — KeyResolver interface
- `src/signing/codexStrategy.ts:180-182` — silent fall-through

## Required Fixes

### Fix 1 — Shape-validate at the import boundary
Add a runtime shape check after the version check in `deserializeCodex`:

```ts
export function deserializeCodex<...>(json: string): CodexExportV1_2<...> {
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new Error("deserializeCodex: invalid JSON"); }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("deserializeCodex: not an object");
  }
  const p = parsed as Record<string, unknown>;
  if (p.version !== "1.2") {
    throw new Error(`deserializeCodex: unsupported version ${String(p.version)} — expected "1.2"`);
  }
  // NEW: shape validation
  if (!Array.isArray(p.kadenaWallets)) throw new Error("deserializeCodex: 'kadenaWallets' must be an array");
  if (!Array.isArray(p.ouronetWallets)) throw new Error("deserializeCodex: 'ouronetWallets' must be an array");
  if (!Array.isArray(p.addressBook)) throw new Error("deserializeCodex: 'addressBook' must be an array");
  if (!p.uiSettings || typeof p.uiSettings !== "object") throw new Error("deserializeCodex: 'uiSettings' must be an object");

  return parsed as CodexExportV1_2<...>;
}
```

This wraps the `JSON.parse` (also addresses F-ERR-009 leak of raw `SyntaxError`) and adds field-presence validation. Throw messages name WHICH field is bad without leaking codex internals.

Forward-compat: unknown extra fields on the parsed object survive the cast (TypeScript erases at runtime — the extra fields stay on the object). Document this explicitly: `deserializeCodex` rejects malformed-known fields but does NOT strip unknown future fields. (Pin via test — see `[TEST-FIX]` cross-reference for the round-trip-with-unknown-field test.)

### Fix 2 — Make foreign-key resolver contract explicit
Three options:

**A. Make `requestForeignKey` required.** Document that server resolvers throw with a clear message. Highest clarity; breaking change for any existing resolver implementation that doesn't have it. Mark with a major version bump.

**B. Short-circuit in the strategy with a precise error.** Before reaching `universalSignTransaction`, the strategy detects "foreign key needed AND resolver lacks `requestForeignKey`" and throws:
```ts
throw new Error(
  "CodexSigningStrategy: this transaction requires foreign key " + pub +
  ", but the configured KeyResolver does not implement requestForeignKey. " +
  "Either pass it in resolvedForeignKeys or implement requestForeignKey on your resolver."
);
```

**C. Add a sibling type discriminator.** Introduce `BrowserKeyResolver extends KeyResolver` (with required `requestForeignKey`) and `ServerKeyResolver` (with explicit `requestForeignKey: never`). Strategies typed against the union can branch at construction.

Recommendation: **B** — minimal API surface change, clear error message, doesn't break existing resolvers. Keep `requestForeignKey` optional in the interface so existing typed resolvers compile, but enforce the contract at strategy execute time.

### Coordination
Fix 1 (codec validation) extends naturally with `[TEST-FIX]`'s codex-codec test additions — pin the contract there.

Fix 2 (resolver contract) interacts with `[SECURITY-FIX]`'s F-SEC-009 angle (which sees the same call site through a different lens — info-disclosure on key mismatch rather than confusing error). Sequence either order; fixes don't conflict.

## Acceptance Criteria

### Codec
- [ ] `deserializeCodex` validates the four required fields' shapes after the version check.
- [ ] `JSON.parse` failure now throws a domain-prefixed error, not raw `SyntaxError`.
- [ ] Field-presence error messages name the bad field but do NOT echo the field's value (no info disclosure).
- [ ] Test: `deserializeCodex('{"version":"1.2"}')` throws "kadenaWallets must be an array".
- [ ] Test: `deserializeCodex('{"version":"1.2", "kadenaWallets": "not array", ...}')` throws.
- [ ] Test (forward-compat): `deserializeCodex('{"version":"1.2", "kadenaWallets":[], ..., "futureField":"x"}')` succeeds; the parsed result preserves `futureField` as an unknown extra (or strips it — pick and pin per project intent).

### Resolver contract
- [ ] `CodexSigningStrategy.execute` detects "foreign key required AND resolver lacks requestForeignKey" and throws with a precise message before calling `universalSignTransaction`.
- [ ] `KeyResolver.requestForeignKey` JSDoc updated to state: "Optional in the interface; required at execute time when any guard requires a foreign key. Server resolvers should either implement-and-throw or omit this method (the strategy fails fast on first foreign-key need)."
- [ ] New test in `tests/strategy.test.ts`: a transaction with a guard requiring a foreign-key signer + a resolver lacking `requestForeignKey` throws the specific pre-flight error.
- [ ] Existing `tests/strategy.test.ts` tests covering the foreign-key-modal path continue to pass.
