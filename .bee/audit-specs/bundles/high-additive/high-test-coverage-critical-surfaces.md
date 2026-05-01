[TEST-FIX] Test coverage for critical untested surfaces

## Problem
Five subpaths of the library have zero direct test coverage. Three of them are security-sensitive enough to escalate this gap to HIGH, and two are coverage gaps within already-tested files:

### F-CORE-011 — Three security-sensitive surfaces with zero tests
- **`src/reads/pactReader.ts`** — the `setPactReader`/`pactRead` injection seam. A regression making `setPactReader` no-op silently reverts every consumer's caching layer. The Smart-Swap-flicker bug the seam was added to fix would re-emerge.
- **`src/wallet/KadenaWalletBuilder.ts`** — mnemonic dispatch (Koala 24-word vs Chainweaver 12-word vs eckowallet). 5+ conditional branches; a typo in dispatch routes a Koala 24-word seed through Chainweaver derivation, producing a different pubkey. Users lose access to funds and don't know why.
- **`src/errors/transactionErrors.ts`** — pattern-matching helpers (`createSigningError`, `createSimulationError`) that classify raw error messages into `SigningError`/`SimulationError` codes. The classification drives downstream user-facing remediation hints. A wrong substring or order-swap silently mis-classifies.

### F-CORE-012 — Test-coverage gaps within existing files
- `tests/encryption.test.ts` covers happy-path round-trip but not: V2 envelope tampered to V1 shape; `smartEncrypt` with `schemaVersion` of `null` vs `"0"` vs `"1"`.
- `tests/encryption-upgrade.test.ts` doesn't exercise the symmetric "V2-then-V1 fallback" path through `smartDecrypt` itself (only direct-decrypt paths).
- `tests/codex-codec.test.ts` doesn't exercise unknown-future-field preservation (a v1.3 export consumed by v1.2 deserializer).
- `tests/cfm-builders.test.ts` doesn't exercise input edge cases (empty strings, special chars, scientific-notation amounts).
- `seedTypeMigration` round-trip from a Phase-1 codex isn't tested.
- `formatDecimalForPact` edge cases (scientific notation, leading zeros, EU locale separators) not exercised.

## Findings (2 merged, 5 underlying gaps)
| ID | Severity | Title |
|---|---|---|
| F-CORE-011 | HIGH | Tests missing for `pactReader`, `KadenaWalletBuilder`, `transactionErrors` |
| F-CORE-012 | HIGH | Test coverage gaps — encryption boundary, migration, pact format |

## Required Fixes

### New test file: `tests/pact-reader.test.ts`
- Default reader is `rawCalibratedDirtyRead` when no `setPactReader` call has happened.
- `setPactReader(fn)` swaps the active reader; `pactRead(code, opts)` calls the configured reader with forwarded args.
- `getPactReader()` returns the currently-configured reader.
- Calling `setPactReader` twice replaces (not stacks) the previous reader.
- A `setPactReader(null!)` or non-function input throws (or — if F-ERR-017 is being fixed — a runtime check exists).
- Mock the `rawCalibratedDirtyRead` default via dependency injection (no real network).

### New test file: `tests/wallet-builder.test.ts`
- Round-trip a fixed 24-word BIP39 mnemonic through `createWalletPairFromMnemonic("...", m, 0, "koala")`; assert the derived pub matches a vendor-known vector (use `@kadena/hd-wallet`'s own test vector).
- Same for a 12-word Chainweaver mnemonic.
- Assert that mismatched length throws (12-word with seedType `"koala"` should throw or produce a clearly-labelled error).
- `isValidMnemonic` for valid/invalid/wrong-length cases.
- `generateMnemonic(12)` and `(24)` length assertions; throw for any other length.

### New test file: `tests/transaction-errors.test.ts`
- For each documented branch of `createSigningError`/`createSimulationError`, assert that a known error message containing the trigger substring classifies into the expected code.
- Test the gas-extraction regex with `"exceeded: 12345"` → `12345`.
- Test `formatErrorForUser(err)` includes both the message and at least one suggestion.
- Test the "unknown error" fall-through path produces a generic but classified result.

### Extend `tests/encryption.test.ts`
- Tampered V2 envelope (e.g. flip a byte in `parsed.v` to make `isEncryptedV2` return false) — assert the right error class.
- `smartEncrypt(plaintext, password, "0")` produces V1; `(plaintext, password, "1")` produces V2; `(plaintext, password, null)` matches the documented behaviour.

### Extend `tests/encryption-upgrade.test.ts`
- Direct call to `smartDecrypt(corruptedV1Blob, password)` — assert it does NOT silently succeed (after the security fix in `[SECURITY-FIX]`).

### Extend `tests/codex-codec.test.ts`
- Round-trip with an unknown extra field on the input JSON: hand-craft `{"version":"1.2", "kadenaWallets":[], ..., "futureFieldX": "x"}` and assert either drop-on-deserialize or pass-through (matching project intent — discuss in the spec discovery step).

### Extend `tests/cfm-builders.test.ts`
- Defensive amount-validation tests: `() => buildXPactCode({...valid, amount: "abc"})` throws (because `formatDecimalForPact` throws).
- Three representative builders exercised with: empty-string field, field containing `"`, field containing `(`, scientific-notation amount.

### New test file: `tests/seed-type-migration.test.ts`
- Round-trip a Phase-1 codex (with the legacy seed-type strings) through `migrateSeedType` and back; assert idempotence.
- Edge cases: unknown legacy strings (currently maps to `"koala"` per F-ERR-022 — pin the contract).

### Extend `tests/pact-format.test.ts`
- `formatDecimalForPact` edge cases: scientific notation (`"1e10"`), leading zeros (`"007.5"`), EU separator (`"1,5"`), trailing zeros (`"1.500"`).

## Coordination
- The `pactReader` test will be more useful if the `setPactReader` runtime-validation fix from F-ERR-017 is in place. Land this spec AFTER any `[ARCH-FIX]` work that touches `pactReader.ts`.
- The encryption-test extensions assume `[SECURITY-FIX]` (F-CORE-009) has landed (single-KDF `smartDecrypt`). If `[SECURITY-FIX]` lands first, write the tests against the new behaviour.

## Acceptance Criteria
- [ ] `tests/pact-reader.test.ts` exists with at minimum 5 tests covering: default reader, swap, round-trip, double-swap, getPactReader.
- [ ] `tests/wallet-builder.test.ts` exists with at minimum 6 tests covering: koala-24 vector, chainweaver-12 vector, eckowallet-12, mismatched length throws, isValidMnemonic, generateMnemonic.
- [ ] `tests/transaction-errors.test.ts` exists covering every documented branch of both error-creator helpers.
- [ ] `tests/seed-type-migration.test.ts` exists.
- [ ] Existing test files extended per the lists above.
- [ ] `npm test` passes; total test count grows by ≥30.
- [ ] CI test wall-time stays under 30s on Node 22 / Ubuntu (the existing 15s baseline can grow to ~25s without concern).
