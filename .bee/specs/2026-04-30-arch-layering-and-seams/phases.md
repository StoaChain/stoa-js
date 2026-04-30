# Phases: arch-layering-and-seams

## Overview

This refactor closes two HIGH-severity audit findings that, while related in spirit (both restore architectural commitments that the live code partially undoes), touch disjoint files and address distinct concerns. The wallet edge cut (F-CORE-005) is a single-file surgical change that introduces a new injection seam on the wallet account object. The reader-seam adoption (F-CORE-006) is a sweep across four interaction-module files plus a new behavioural regression test.

Splitting this work into two phases is justified despite the modest total size, for three reasons. First, the two phases protect against different regressions and benefit from independent reviews — the wallet phase's review focuses on the new injection-seam shape and consumer-facing API delta, while the seam-adoption phase's review focuses on tier correctness and verbatim Pact-code preservation across sixteen sites. Second, the public-API delta differs in kind (REQ-03 widens an optional constructor argument, REQ-11 breaks a function signature) and reviewing them together would muddy the changelog narrative. Third, the seam-adoption phase carries the regression guard and the build-graph verification, and pairing those gates with the wallet edge cut would give a single phase three distinct quality-gate concerns rather than two focused ones.

The two phases must be executed in order: Phase 1 first (smallest, most contained), then Phase 2 (broader sweep with the regression guard). Both phases must land before the reliability-and-failover spec — that downstream spec wraps the configured reader once at the seam, which is only valuable after every read site routes through it.

## Phase 1: Wallet edge cut

**Description:** Remove the backwards layering edge from the wallet subpath to the interactions subpath by introducing a balance-resolver injection seam on the runtime wallet account object. The subpath continues to expose the same surface it does today; only the import graph changes (no transitive `@kadena/client` dependency for wallet consumers) and the constructor signature widens with one optional argument.

**Deliverables:**
- The wallet subpath no longer imports from the interactions subpath (REQ-01).
- A balance-resolver contract is published as part of the wallet subpath's public types (REQ-02).
- The runtime wallet account object accepts an optional balance-resolver argument at construction, with a default that throws a clearly-worded error when not configured (REQ-03).
- The wallet's balance-fetch method delegates to the injected resolver, propagating errors rather than swallowing them (REQ-04).
- The interactions package's original balance-fetching function is preserved for its other consumers (REQ-05).
- The wallet builder propagates the optional balance-resolver argument when it is responsible for constructing the runtime wallet account object (REQ-06).
- The TypeScript type check passes (REQ-15, scoped to the wallet change).
- The full test suite passes with no regressions (REQ-16, scoped to the wallet change).

**Dependencies:** None (first phase).

## Phase 2: Reader seam adoption and regression guard

**Description:** Migrate every pure on-chain read in the interactions tree to route through the configured reader seam, refactor the cross-chain simulation helper to a read-shaped signature, and add a behavioural regression test that fails if any migrated site silently drifts back to a direct Kadena client call. Sim-before-submit pairs and transaction-lifecycle call sites are deliberately untouched.

**Deliverables:**
- Two read sites in the Kadena-functions module migrated to the configured reader at the locked tiers (REQ-07, REQ-08).
- Four read sites in the wrap-functions module migrated to the configured reader at the locked tiers, with every Pact code template literal preserved verbatim (REQ-09).
- Nine read sites in the add-liquidity-functions module migrated to the configured reader at the locked tiers, with the IIFE-inside-Promise-all structure preserved for the two pool-capability flag reads (REQ-10).
- The cross-chain simulation helper refactored to a read-shaped signature, threading the chain identifier through to the reader so that the call honours the requested chain (REQ-11). This is a documented public-API break.
- The configured-reader import added to the three migrated files that lacked it (REQ-12).
- Imports pruned in the four migrated files where the Kadena-client builder symbols and the Pact-URL helper are no longer referenced (REQ-13).
- A new behavioural regression test in the test suite that uses the reader-injection seam to install a counting stub, calls each migrated function, and asserts the stub was invoked. The test documents the regression it protects against in a JSDoc block (REQ-14).
- The TypeScript type check passes after the sweep (REQ-15).
- The full test suite passes with no regressions, and the standing types-shape regression-lock test continues to fire (REQ-16).
- The build emits a clean distribution and a documented post-build verification confirms the wallet subpath of the distribution no longer transitively references the interactions subpath (REQ-17). This verification implicitly closes the loop on Phase 1's edge cut by confirming it survives the bundler.

**Dependencies:** Phase 1 (the build-graph verification in REQ-17 only succeeds once the wallet edge has been cut; REQ-17 is the joint exit gate for both phases).
