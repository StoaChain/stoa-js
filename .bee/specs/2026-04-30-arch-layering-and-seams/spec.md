# Specification: arch-layering-and-seams

## Goal
Restore two architectural commitments that the current published library partially undoes: the wallet subpath must not transitively pull in the interactions tree (and thereby `@kadena/client`), and every pure on-chain read inside the interactions package must route through the consumer-pluggable reader seam so that downstream apps (browser SPA and Node.js HUB) can install caching, dedup, and failover at a single point. This spec closes audit findings F-CORE-005 (HIGH — wallet to interactions backwards layering) and F-CORE-006 (HIGH — pactRead seam bypassed at sixteen pure-read sites).

## User Stories
- As a downstream consumer of the wallet subpath, I want HD-key derivation and the runtime account class to be free of interactions-package and Kadena-client dependencies so that importing the wallet surface for keypair work does not drag in the entire on-chain interaction tree.
- As a browser application integrator, I want to install one cache-aware reader at boot and have every pure on-chain read in the library route through it so that per-keystroke previews are deduped and the Smart Swap flicker regression does not return.
- As a server-side application integrator, I want the default reader behaviour to remain the uncached raw read so that I get a working library with no boot-time configuration when caching is undesirable.
- As a wallet integrator, I want to inject my own balance-resolution function into the wallet account object so that the library does not dictate which network reader is used and the wallet remains a pure data-and-keys leaf module.
- As a library maintainer, I want a behavioural regression test that fails if any of the migrated read sites silently drifts back to a direct Kadena client call so that the seam is enforceable in CI without source-text grep checks.
- As a release coordinator, I want this refactor to land before the reliability-and-failover work so that wrapping every read with timeouts and node failover becomes a single edit at the seam rather than sixteen edits across four files.
- As a consumer of the cross-chain simulation helper, I want a clear, read-shaped signature that takes a Pact code string and a chain identifier so that the helper composes naturally with the rest of the read surface.

## Specific Requirements

### Wallet edge cut (F-CORE-005)

- **REQ-01:** The wallet subpath no longer imports anything from the interactions subpath. After this change, a search of the wallet directory for imports targeting interactions returns zero matches.
- **REQ-02:** A balance-resolver contract is documented for the wallet subpath. The contract is a single asynchronous function that accepts an account address and returns the balance as a decimal string, with a documented convention that absent accounts resolve to the string "0". The contract is published as part of the wallet subpath's public types so consumers can reference it when wiring their own resolvers.
- **REQ-03:** The runtime wallet account object accepts an optional balance-resolver argument at construction time. When a consumer does not provide one, the default resolver throws a clearly-worded error explaining that no resolver was configured and how to install one. The default-throw pattern is intentional: existing tests and consumer call sites that rely on the old auto-fetch must fail loudly rather than silently returning a fabricated value.
- **REQ-04:** The wallet account object's balance-fetch method is preserved. It returns a Promise that resolves to the balance as a string and updates the object's stored balance field. The method body delegates to the injected resolver. When the resolver throws, the error propagates to the caller without being swallowed and without falling back to a hard-coded zero.
- **REQ-05:** The interactions package continues to export the original balance-fetching function for its existing external consumers. This spec only removes the wallet-to-interactions edge; it does not delete or relocate the underlying interaction function.
- **REQ-06:** The wallet builder, where it is responsible for constructing the runtime wallet account object, propagates the optional balance-resolver argument so that consumers wiring wallets through the builder can inject their resolver in the same way.

### Reader seam adoption in interactions (F-CORE-006)

- **REQ-07:** The balance read in the Kadena-functions module is migrated to route through the configured reader at tier T1 (live balance). The Pact code form and the response unwrap shape (an object with `account` and `balance` fields, with the standard handling of Kadena's `{ decimal: ... }` envelope) are preserved exactly.
- **REQ-08:** The account-description read in the Kadena-functions module is migrated to route through the configured reader at tier T5 (account-state read). The Pact code form and the inline-typed return shape (new-account flag, balance, account, guard) are preserved exactly.
- **REQ-09:** The four read sites in the wrap-functions module are migrated. The wrap-info preview and the ur-stoa-info preview adopt tier T2 (input-driven preview). The wrapper payment-key lookup adopts tier T5 (account-state read). The payment-key balance lookup adopts tier T1 (live balance). Every Pact code template literal is preserved verbatim. The sim-before-submit pairs in this file are not touched and remain on the raw client.
- **REQ-10:** The nine read sites in the add-liquidity-functions module are migrated. Seven input-driven preview reads (the URC and UEV liquidity validators across both occurrences) adopt tier T2. The two pool-capability flag reads (the frozen and sleeping LP module flags) adopt tier T7 (very-static module metadata). The IIFE-inside-Promise-all structure that hosts the two T7 reads is preserved exactly; the dead outer try-catch in that vicinity is not touched here. The submit, listen, and poll sites in this file are not touched.
- **REQ-11:** The cross-chain-functions simulation helper is refactored. Its signature changes from accepting a pre-built transaction object plus a chain identifier to accepting a Pact code string plus a chain identifier. The body uses the configured reader at tier T2, threading the chain identifier through to the reader options so that the call honours the requested chain rather than the global default. The success and failure envelope (success flag, optional result, optional error message, optional gas) is preserved, including the failure-vs-success branching. This is a deliberate, documented public-API break; consumers update their call sites at upgrade time. The submit and listen sites in this file are not touched.
- **REQ-12:** The three migrated files that did not previously import the configured reader gain the import. The cross-chain-functions file already has it and is not modified for this requirement.
- **REQ-13:** Imports in the four migrated files are pruned to remove anything no longer used. Specifically, the Kadena-client builder symbols and the Pact-URL helper are removed when no remaining code path in the file references them. Constants such as the default chain identifier and the default network identifier remain only when other code paths in the file still need them; the prune is grep-driven on a per-file basis.

### Quality gates and regression guard

- **REQ-14:** A new behavioural regression test is added to the test suite. The test installs a counting stub through the reader-injection seam, calls each migrated function across the four files at least once with arguments that exercise the read path, and asserts that the stub is invoked at least once per migrated function. The test does not read source files and grep them — the prior source-text approach was reviewed and rejected. The test file documents in a JSDoc block the regression it protects against, naming the audit finding identifier and the file-and-line references for the original sites.
- **REQ-15:** The TypeScript type check passes after both fixes are applied.
- **REQ-16:** The full test suite passes with no regressions against the prior baseline. The standing types-shape regression-lock test from a recent prior version continues to fire as before.
- **REQ-17:** The build emits a clean distribution. A manual post-build verification on the distributed wallet subpath confirms that no transitive reference to the distributed interactions subpath remains. The verification step is documented as part of the release ceremony for this change.

## Visual Design
No visual assets provided. This is a code-only refactor of a TypeScript library with no UI surface.

## Existing Code to Leverage

- **Reader injection seam.** `src/reads/pactReader.ts` already implements the `setPactReader` and `pactRead` injection pattern this spec adopts at sixteen call sites. The same module is the exemplar for the wallet-resolver injection in REQ-02 and REQ-03 — narrow seam, single-function shape, default that works without consumer configuration.
- **Resolver interface exemplar.** The `KeyResolver` and `PactClient` interfaces in `src/signing/types.ts` are the shape template for the wallet's balance-resolver contract: a small, behaviour-only interface published from the consuming subpath, with a default that throws when not wired.
- **Default raw read.** `src/reads/rawCalibratedRead.ts` continues to be the default reader; consumers that do not call `setPactReader` (such as the server HUB) keep their current behaviour after this spec lands.
- **Tier exemplars in interactions.** `src/interactions/dexFunctions.ts` already demonstrates the T2, T5, and T7 tier conventions on neighbouring reads. The migrations in this spec match those established choices rather than introducing new tier semantics.
- **Cross-chain dynamic-chain post-state exemplar.** `getBalanceOnChain` in `src/interactions/crossChainFunctions.ts` shows the pattern for routing the configured reader against a caller-supplied chain identifier rather than the global default, and is the template for the simulation helper's refactored body.
- **Status-success unwrap pattern.** `src/interactions/activateFunctions.ts` shows the canonical post-`pactRead` unwrap that checks for `result.status === "success"` and returns the inner data. This pattern is reused at every migration site.
- **Wallet subpath surface.** The wallet barrel (`src/wallet/index.ts`) already publishes the wallet account object, the wallet builder, the storage-adapter interface, and the seed-type aliases — REQ-02 extends this surface with the new resolver type without restructuring the barrel.
- **Test scaffolding.** Tests live in the top-level `tests/` directory and are picked up by the existing Vitest configuration. The new regression-guard test in REQ-14 follows the conventions of the existing test files (for example `tests/network.test.ts` and `tests/strategy.test.ts`).
- **CI gating.** The continuous-integration workflow already runs the type check, the test suite, and the build on every push. The regression guard added in REQ-14 runs as part of that workflow with no additional configuration.

## Out of Scope

- **Reliability work.** Adding timeouts and wiring node failover into the read path is the next spec in this series. This spec deliberately lands first so that the failover wrap can be a single edit at the seam.
- **Pact-string injection hardening.** Every Pact code template literal in the migrated sites is preserved verbatim. Validation of user-controlled fragments in Pact strings is a separate security audit-spec and is explicitly not addressed here.
- **Sim-before-submit call sites.** The roughly twenty-one read calls inside the interactions tree that legitimately pair `dirtyRead` with `submit` for pre-flight gas and validity simulation remain on the raw client. They are documented as such and are not migrated by this spec.
- **Submit, listen, and poll sites.** None of the transaction-lifecycle sites (the various submit, listen-for-completion, and continuation-poll calls in cross-chain-functions, add-liquidity-functions, and elsewhere) are touched.
- **Fabricated-fallback removal.** The broader cleanup of silent zero-fallback patterns across the library is a separate audit-spec and is not addressed here, beyond REQ-04's requirement that the wallet's resolver path propagate errors.
- **Other audit findings.** Findings F-CORE-002, F-CORE-003, F-CORE-004, F-CORE-007, F-CORE-008, F-CORE-009, F-CORE-010, F-CORE-011, F-CORE-012, and the medium and low items beyond F-CORE-013 are tracked in their own spec folders and are not addressed here.
- **Tier-conventions documentation.** Adding a JSDoc block to the reader module that catalogues the tier conventions is a low-priority improvement task. This spec consumes the conventions but does not add the catalogue.
- **Broader behavioural test coverage.** New behavioural tests beyond the single regression guard are out of scope; the wider test-coverage push is its own audit-spec.
- **`safeCreationTime` consolidation.** Several interaction modules carry a duplicated `safeCreationTime` helper. Consolidating it is tracked separately and is not part of this refactor.
