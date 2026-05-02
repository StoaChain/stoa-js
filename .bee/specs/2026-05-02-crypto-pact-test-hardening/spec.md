# Specification: crypto-pact-test-hardening

## Goal
Ship `@stoachain/ouronet-core` v2.2.0 — an additive minor release that hardens the crypto subpath with a typed error taxonomy and a timing-leak fix in the smart-decrypt dispatch, and closes critical test-coverage gaps on the pact-reader injection seam, the wallet builder, the transaction-error helpers, and the codex seed-type migration. The release closes audit findings F-CORE-009, F-CORE-011, and F-CORE-012; F-CORE-010 is reviewed and explicitly rejected.

## User Stories
- As a downstream consumer of the crypto subpath, I want to discriminate decryption failures by class so that I can show "wrong password" UI without inspecting brittle error message strings.
- As a downstream consumer, I want `smartDecrypt` to fail in constant-shape time on a wrong password so that wall-clock observation cannot be used to infer the envelope version of a target blob.
- As a security reviewer, I want corrupted-envelope failures to be surfaced as a distinct class so that telemetry can separate "user typed the wrong password" from "blob has been tampered with or truncated."
- As a downstream consumer using the existing `decryptStringV2` direct entry point, I want my V1-fallback behavior preserved so that upgrading to v2.2.0 is a transparent install with no behavior regressions on the legacy path I rely on.
- As a maintainer of the OuroNet ecosystem, I want the pact-reader injection seam covered by tests so that browser cache integration and server raw-read defaults are both verified against the documented contract.
- As a consumer of `KadenaWalletBuilder`, I want vendor-vector regression tests across the three supported seed types so that an upstream `@kadena/hd-wallet` change cannot silently shift derived public keys without CI catching it.
- As an integrator constructing transactions, I want every documented branch of the signing-error and simulation-error helpers covered by tests so that error classification stays trustworthy as the helper code evolves.
- As a maintainer applying the locked README maintenance rule, I want the v2.2.0 release to update the Status block, version history, test count, and submodule table in a single atomic commit so that the publish workflow gate cannot reject the tag.

## Specific Requirements

### Crypto error taxonomy (additive public exports)
- The crypto barrel exposes three new public error classes corresponding to the three observable failure modes of decryption: a wrong-password class, a corrupt-envelope class, and an unsupported-format class. Each class is a real `Error` subclass with a distinct name so that `instanceof` and `error.name` both work.
- The new classes are exported from the same barrel that already exposes the v1 and v2 decrypt functions. They are observable in the published distribution after build, alongside the existing exports.
- Existing consumers who currently catch a generic `Error` and read its message continue to work without code changes. The new classes are additive — they extend `Error`, so existing `instanceof Error` checks succeed and existing message-based logic still functions for the duration of any consumer migration window.

### Decryption error classification
- The v1 decrypt path classifies failures by which decode step failed. A JSON-parse failure on the envelope produces a corrupt-envelope error. An AES-GCM authentication-tag failure (the operation-error signal that the derived key did not match) produces a wrong-password error. Any other unexpected failure is wrapped in a generic error that carries the original cause.
- The v2 decrypt path classifies failures using the same three-way mapping as v1.
- Diagnostic console output that previously fired from v1 catch-alls is removed. Errors are thrown with the structured cause attached; consumers (or a future logger seam) decide whether to log.
- The internal v1-fallback branch inside the direct v2 decrypt entry point is preserved unchanged. Consumers who call the v2 decrypt entry point directly with a v1 blob continue to receive the legacy belt-and-suspenders behavior.

### Smart-decrypt timing-leak fix
- The smart-decrypt dispatcher replaces its prior v1-then-v2 fallback chain with a single deterministic shape-based branch. The dispatcher inspects envelope shape and routes to exactly one decryption path. There is no second attempt on failure.
- On a wrong-password input, the dispatcher returns failure on the same wall-clock budget regardless of envelope version. The previous ~1.5-second differential between v1-first-fail-then-v2 and direct-v2 paths no longer exists.
- The smart-encrypt write path is untouched. Consumers who write v1 envelopes (legacy interop) keep that capability.

### Pact-reader seam coverage
- A new test surface verifies the documented contract of the pact-reader injection seam: the default reader is the raw calibrated dirty-read function when no setter has been called; calling the setter swaps the active reader; the read function forwards its arguments to the configured reader; calling the setter twice replaces (does not stack); the getter returns the currently-configured reader.
- All assertions use stub readers via the existing injection seam pattern. No real network calls are made.

### Wallet-builder vendor-vector coverage
- A new test surface verifies that `KadenaWalletBuilder` produces public keys matching vendor test vectors from the `@kadena/hd-wallet` peer dependency across all three supported seed types: the 24-word koala seed, the 12-word Chainweaver seed, and the 12-word eckowallet seed.
- The same surface verifies that mnemonic-length / seed-type mismatches are rejected, that the validity check returns the correct boolean for valid, invalid, and wrong-length inputs, and that mnemonic generation produces the requested length while rejecting unsupported lengths.

### Transaction-errors branch coverage
- A new test surface exercises every documented branch of the signing-error helper and every documented branch of the simulation-error helper. Each branch is asserted to produce the correct error code, message shape, and (where applicable) extracted gas value.
- The gas-extraction regex is asserted independently against a representative simulation-failure string so that future regex tweaks cannot silently break the captured group.
- The user-facing error formatter is asserted to produce output that includes the message and at least one suggestion, matching the documented shape.

### Codex seed-type migration round-trip
- A new test surface verifies that legacy seed-type strings survive a serialize-then-deserialize cycle through the codex codec, that the migration helper's locked unknown-input fallback (any unrecognized input maps to the koala seed type) holds, and that all five enumerated input strings produce their expected outputs in a parameterized check.
- This new surface does not duplicate the existing migration unit tests already present in the codex-codec test file. The new file scopes itself to integration round-trip plus the unknown-input invariant.

### Existing-test extensions
- The encryption test file gains coverage for: a structurally-malformed envelope (a valid-base64 JSON envelope missing the ciphertext field) routed through smart-decrypt produces a corrupt-envelope error via the inner base64-decode of the missing field; the smart-encrypt version selector across its documented inputs; a wrong-password v1 input thrown as the new wrong-password class. Note: an earlier draft proposed a "flip a byte in the version field" tamper for the corrupt-envelope assertion — this was re-specified during plan review iter 2 because flipping the version byte routes to v1 which decodes successfully and produces a wrong-password error from the auth-tag mismatch (per the locked AES-GCM scope), not a corrupt-envelope error. The structurally-malformed-envelope tamper makes the corrupt-envelope path reliably reachable.
- The encryption-upgrade test file gains coverage for: a corrupted-v1 blob passed directly to smart-decrypt does not silently fall through to a v2 key derivation under the new single-path dispatch.
- The codex-codec test file gains coverage for: a hand-crafted v1.2 codex with an unknown extra field round-trips through deserialization with the unknown field preserved (forward-compat pin).
- The cfm-builders test file gains coverage for: defensive amount validation on two representative builders, asserting that a non-numeric amount input causes the build call to throw via the existing decimal-format helper.
- The pact-format test file gains coverage for: leading-zeros input, EU-decimal-separator input, trailing-zeros input, and confirms the existing scientific-notation rejection. The behavior under each input is pinned (accepted or thrown) per the current regex.

### Test-suite growth and runtime
- The test count grows by at least 29 new test cases relative to the v2.1.2 baseline of 386. The combined wall-time of the project test suite stays under 30 seconds on Node 22 / Ubuntu in CI.
- All new tests are deterministic and use mocking. No real network calls are made by any new test.

### Release artifacts
- The package version field is bumped from the previous patch (2.1.2) to 2.2.0.
- The changelog gains a new leading entry dated for the release. The entry describes the additive nature of the release, lists the three new error classes under an "added (public surface)" section, cites the three closed audit findings under a "fixed" section, includes a "rejected (decisions log)" section recording that F-CORE-010 was reviewed and intentionally not implemented with the chain-side-validation rationale, and concludes with a stats block citing the new test count and the no-public-API-removal note.
- The README is updated per the locked maintenance rule. The Status block leads with the new version and a one-line summary of the additive changes. The version history is extended with a new paragraph describing the F-CORE-009 closure, the four new test files, and the F-CORE-010 rejection rationale. Test-count references throughout the README are refreshed to the new total. The submodule table row for the crypto subpath cites the three new error classes. An optional "what's new" section may include a copy-paste usage example similar to prior minor releases.
- The publish workflow's three-check version-parity gate (Status block, version-history paragraph, changelog first heading) is satisfied by the README and changelog updates so that the publish step does not block the tag.
- All deliverables — Phase 1 production code, Phase 2 tests, version bump, changelog, README — ship in a single commit and a single annotated tag, matching the atomic-ship contract used for prior releases.

## Visual Design
No visual assets provided. This is a backend library spec with no UI surface. Implementation follows existing test-file patterns and README conventions already established in the repository.

## Existing Code to Leverage
- The crypto v1 source file already isolates the JSON-parse boundary, the AES-GCM call sites, and the catch-all that produces the current generic error. The new classification logic plugs into these existing boundaries.
- The crypto v2 source file already exposes a deterministic shape predicate that returns false on any throw. This predicate is the sole branch used by the new smart-decrypt dispatcher. The internal v1-fallback path inside the direct v2 decrypt entry point already exists and is preserved unchanged.
- The crypto barrel file is the canonical location for adding the three new error class exports.
- The pact-reader source already exposes the setter, the read function, and the getter as a documented seam — `tests/interactions-read-seam.test.ts` already demonstrates the stub-reader pattern with `beforeEach` / `afterEach` reset that the new pact-reader test file mirrors.
- The wallet-builder source already exposes mnemonic-length-aware dispatch, validity check, and length-bounded generation. The signing test file at `tests/signing.test.ts` demonstrates the RFC 8032 vendor-vector style that the new wallet-builder test file mirrors.
- The transaction-errors source already encodes every documented branch as a separate code path. The new test file enumerates these branches one-to-one.
- The codex codec source already preserves unknown future fields via its parsed-as-typed cast. The seed-type migration source is already partly tested at `tests/codex-codec.test.ts:202-232`; the new migration test file scopes itself to non-overlapping coverage (integration round-trip plus unknown-input invariant).
- The encryption test file's existing `parseEnvelope` helper at line 36 is reused for the new tampered-envelope tests. The existing tampering pattern at lines 75-83 is the template for the corrupted-v1 blob case in the encryption-upgrade extension.
- The cfm-builders test file's existing `it.each` cross-cutting block at lines 293-317 is the template for parameterized cases in the new test files.
- The vitest 4.x mocking patterns already established across the project are reused throughout. The `@kadena/hd-wallet` peer dependency provides the vendor mnemonic vectors for the wallet-builder tests as dev-only fixtures.

## Out of Scope
- F-CORE-010 (Pact-code injection escaping) is reviewed and explicitly rejected. Rationale: chain-side Pact compilation and simulation already validate account format, token-ID format, and DALOS charset at submission time. Mirroring that validation in this consumer-side library would (a) duplicate logic, (b) drift from chain reality whenever DALOS adds characters, and (c) impose a maintenance burden for theoretical-only defense-in-depth. A narrower blocklist variant (throw on quote, backslash, newline) was considered as a middle ground and also rejected on the same theoretical-only argument. Future audit-specs may revisit only if a non-chain-validated context emerges. The audit-spec source remains under `bundles/high-additive/` with a "rejected" note.
- No `AUDIT.md` artifact is created. The changelog is the canonical record of closed findings; an additional audit-trail file would duplicate state.
- No changes to the cfm-builders source or to the would-be `pactString` helper. Both belong to the rejected F-CORE-010 scope.
- No changes from the medium audit bundle (deferred to v2.3.0), the low-improvements bundle (deferred to v2.3.1), or the error-fabricated-fallbacks bundle (deferred to v3.0.0 as a major release because it is breaking).
- No unit-level coverage of the seed-type migration helper itself — that already exists in the codex-codec test file. The new migration test file deliberately avoids duplication.
- No DALOS charset enforcement, account-shape validation, or token-ID-shape validation. All three are chain-side concerns.
- No new runtime dependencies. All work uses existing imports. Vendor mnemonic test fixtures are dev-only via the existing peer dependency.

---
IMPORTANT: This spec contains descriptions and behavior only. NO code examples, NO pseudocode, NO file paths for new files to create. Implementation details are determined during phase planning.
