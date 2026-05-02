# Phase 2: Codex shape validation and foreign-key resolver pre-flight -- Tasks

<!-- Combined Pass 1 + Pass 2 output: tasks decomposed with research notes, then waves assigned with file-disjointness verified. Phase 2 closes F-CORE-013 (REQ-02) + F-CORE-014 (REQ-03) from M1 of the 2026-04-30 audit cycle. -->

## Goal

Tighten two domain contracts at the boundary of the codex backup format and at the entry point of the codex signing strategy:

1. **REQ-02 (F-CORE-013) -- codex shape validation.** `deserializeCodex` at `src/codex/codec.ts:75-93` gains runtime shape checks IMMEDIATELY AFTER the existing `parsed.version !== "1.2"` check and BEFORE the typed cast at line 92. The three array fields (`kadenaWallets`, `ouronetWallets`, `addressBook`) and the one object field (`uiSettings`) are validated. On invalid input, the deserializer throws a domain-prefixed error (`deserializeCodex: ...`) that NAMES the offending field but never echoes its value (an envelope's contents may include encrypted secrets / addresses; echoing them into telemetry would leak a sensitive boundary). Forward-compatibility is preserved: extra unknown top-level fields continue to survive the `parsed as CodexExportV1_2<...>` cast exactly as today (the v1.2 envelope contract is unchanged; the existing `forward-compat pin` test at `tests/codex-codec.test.ts:147-158` continues to pass).

2. **REQ-03 (F-CORE-014) -- foreign-key resolver pre-flight.** `CodexSigningStrategy.execute` at `src/signing/codexStrategy.ts:68-210` gains a pre-flight check: when ANY of the supplied `guards` requires a foreign-key signer (a guard pub that is NOT in `codexPubs` AND is NOT in `resolvedForeignKeys`) AND `this.resolver.requestForeignKey === undefined`, the strategy throws a precise, named error BEFORE any keypair resolution, simulation, or `universalSignTransaction` call. The error names the missing method (`requestForeignKey`) and points the consumer at the configured resolver. Resolvers that DO implement `requestForeignKey` (or transactions that have NO foreign-key signers) are unaffected -- the existing `resolver.requestForeignKey` error-propagation test at `tests/strategy.test.ts:420-453` continues to pass byte-identically (that test uses a resolver that DOES implement `requestForeignKey` and throws from inside it -- the new pre-flight does not fire).

3. **REQ-03 (F-CORE-014 JSDoc) -- contract clarification.** `KeyResolver.requestForeignKey` JSDoc at `src/signing/types.ts:62-69` is rewritten (JSDoc only, no signature change) to state the runtime contract that REQ-03's pre-flight enforces: optional in the interface; required at execute time when any guard requires a foreign key. Server resolvers should either implement-and-throw or omit the method (the strategy fails fast on first foreign-key need).

4. **At least 3 new test cases** (per NFR-04 minimum-3-new-tests-per-substantive-phase) covering: shape validation hit on each of the three array fields + the one object field; name-only-no-value-echo assertion on the validation errors; foreign-key pre-flight error on a resolver that omits `requestForeignKey`. Test files: extend existing `tests/codex-codec.test.ts` for shape-validation cases (matches existing file's scope); extend existing `tests/strategy.test.ts` for the foreign-key pre-flight case (matches existing file's scope -- the file already contains a `requestForeignKey gets called for missing pubs + its error propagates` test at lines 420-453, so the new pre-flight test lives in the same file as a sibling).

5. **Verification gate.** Typecheck exits 0; the new and existing tests pass (`tests/codex-codec.test.ts` + `tests/strategy.test.ts` both green); the phase-scoped grep checks confirm the contract: shape validation runs after the version check (positional); the pre-flight runs before `universalSignTransaction` (positional); JSDoc text matches the locked contract.

Cross-phase note: Phase 2 has ZERO file overlap with Phase 1 (Phase 1 touches `src/interactions/*Functions.ts` + `src/pact/*` only; Phase 2 touches `src/codex/codec.ts` + `src/signing/codexStrategy.ts` + `src/signing/types.ts` only). Phase 2 may land before, after, or in parallel with Phase 1 from a code-conflict standpoint -- the risk-ordered sequencing in `phases.md` places it second, but there is no source-level dependency. NFR-01 (additive-only) holds: the only newly-thrown errors fire on inputs that were previously broken in different, less-clear ways (shape-malformed codex JSON; foreign-key transaction reaching a resolver that omits `requestForeignKey`).

## Wave Dependency Chain

```
W1 (3 tasks, all parallel, file-disjoint)              W2 (1 task)              W3 (1 task)
+---------------------------------------------+        +-----------+            +-------------+
| T2.1  src/codex/codec.ts                    |        |  T2.4     |            |  T2.5       |
|       (shape validation)                    | -----> |  add 4+   | ---------> |  verify     |
+---------------------------------------------+        |  test     |            |  gate       |
| T2.2  src/signing/codexStrategy.ts          |        |  cases    |            +-------------+
|       (foreign-key pre-flight)              | -----> |  (codec   |
+---------------------------------------------+        |   + strat)|
| T2.3  src/signing/types.ts                  |        +-----------+
|       (KeyResolver JSDoc -- JSDoc only)     |
+---------------------------------------------+
```

- **W1 internal parallelism:** T2.1, T2.2, T2.3 modify three disjoint source files. Zero file-ownership conflicts. All three run in parallel within a single wave.
- **W1 -> W2 dependency:** T2.4's test cases assert the contract surface that T2.1 and T2.2 introduce. The shape-validation tests need the new `deserializeCodex` throws on disk; the pre-flight test needs the new `execute` pre-condition on disk. Tests CAN technically be authored against the expected post-state (TDD red phase), but the chosen ordering -- W1 source edits land first, W2 tests land second -- keeps the per-wave validation hook (`auto` post-wave validation per `.bee/config.json`) honest: W1 ends green (typecheck-only on the changed source files; the existing test suite continues to pass because the new throws fire only on inputs that were previously broken-in-different-ways), and W2 ends green with the new tests passing against the W1-landed source. The TDD discipline is preserved by having the implementer of T2.4 author each test case, run it, watch it FAIL by reverting the W1 edit locally (or by stub assertion), then run it again with the W1 edit in place to watch it PASS -- per the core skill's "Watch It Fail" rule. T2.4's notes record both observations.
- **W2 -> W3 dependency:** T2.5 runs the integrated phase-end verification (typecheck + scoped tests on the two affected files + grep checks asserting positional invariants). It MUST observe the post-state of all W1 + W2 edits combined; running it before W2 finishes would show only N-1 of the new tests on disk.

## File-Ownership Matrix

| Task  | Modifies (single file, exclusive)              | Edit shape                                          |
|-------|------------------------------------------------|-----------------------------------------------------|
| T2.1  | `src/codex/codec.ts`                           | Insert validation block after version check (lines 87-91 region); throw 4 domain-prefixed errors. |
| T2.2  | `src/signing/codexStrategy.ts`                 | Insert pre-flight block at top of `execute` method body (after destructure at lines 79-86), before line 87 codex-pubs read. |
| T2.3  | `src/signing/types.ts`                         | Replace JSDoc comment block at lines 62-69 only. No signature change. |
| T2.4  | `tests/codex-codec.test.ts` (extend) + `tests/strategy.test.ts` (extend) | Add 4+ new `it(...)` cases inside existing `describe` blocks. |
| T2.5  | NONE (read-only verification)                  | Runs `npm run typecheck`, `npx vitest run tests/codex-codec.test.ts tests/strategy.test.ts`, scoped grep checks. |

**Conflict scan:** Zero overlap within W1 (three disjoint source files). T2.4's two test files are NOT touched by any W1 task (T2.1 modifies the production codec; T2.4 modifies the test file -- two different files). T2.5 is read-only. Zero cross-wave file conflicts.

---

## Wave 1 (3 tasks, parallel, file-disjoint)

- [x] T2.1 | Add runtime shape validation to `deserializeCodex` at `src/codex/codec.ts:75-93` -- validate `kadenaWallets`, `ouronetWallets`, `addressBook` are arrays AND `uiSettings` is an object, with domain-prefixed name-only-no-value-echo errors, positioned after the existing version check (line 87-91) and before the typed cast (line 92) | bee-implementer
  - requirements: [REQ-02]
  - acceptance:
    - The validation block is inserted INSIDE `deserializeCodex`, AFTER the existing `if (parsed.version !== "1.2")` check at lines 87-91 and BEFORE the `return parsed as CodexExportV1_2<...>` cast at line 92. Position is load-bearing: shape checks must run only on `version === "1.2"` payloads (otherwise we throw shape errors on a v2.0 export that should fail with the version-mismatch error first).
    - The block validates EXACTLY four fields:
      - `kadenaWallets` -- must be an array (`Array.isArray(parsed.kadenaWallets)`).
      - `ouronetWallets` -- must be an array.
      - `addressBook` -- must be an array.
      - `uiSettings` -- must be an object (NOT null, NOT array): `typeof parsed.uiSettings === "object" && parsed.uiSettings !== null && !Array.isArray(parsed.uiSettings)`.
    - On any failure, throws `new Error("deserializeCodex: <field> must be <expected-shape>")` -- domain prefix `deserializeCodex:` matches the existing two throws at lines 85 and 88-90. The error message NAMES the bad field (e.g. `kadenaWallets`) but does NOT echo its value. Specifically:
      - The error message must contain the field name as a literal string segment.
      - The error message must NOT contain `String(parsed.<field>)`, `JSON.stringify(parsed.<field>)`, or any other interpolation of the offending value. A grep for `String(parsed.kadenaWallets)` etc. inside `deserializeCodex` returns zero matches.
    - The four messages are stable strings the test suite can match against:
      - `deserializeCodex: kadenaWallets must be an array`
      - `deserializeCodex: ouronetWallets must be an array`
      - `deserializeCodex: addressBook must be an array`
      - `deserializeCodex: uiSettings must be an object`
    - Forward-compat is preserved: the validation block does NOT touch unknown extra top-level fields. The existing test at `tests/codex-codec.test.ts:147-158` (`preserves unknown extra fields through the parse cast (forward-compat pin)`) continues to pass byte-identically -- the test JSON fixture has all four required fields with the right shape, so none of the new throws fire. Confirmed by reading the test: `'{"version":"1.2","kadenaWallets":[],"ouronetWallets":[],"addressBook":[],"uiSettings":{},"futureFieldX":"x"}'`.
    - Validation order is deterministic and matches the order of the field declarations in `CodexExportV1_2` (kadenaWallets -> ouronetWallets -> addressBook -> uiSettings). When a payload is malformed in multiple fields, the FIRST failure (kadenaWallets first) wins -- this matches the principle of failing fast on the first observable contract break and is what the shape-validation tests will assert against.
    - JSDoc on `deserializeCodex` at lines 60-74 is updated to add a fourth bullet to the `Throws on:` list: `- shape mismatch (kadenaWallets, ouronetWallets, addressBook not arrays; uiSettings not an object)`. The existing three bullets (invalid JSON; missing version field; version mismatch) are unchanged.
    - `npm run typecheck` exits 0 (no broken type resolution -- `parsed` is `any` after `JSON.parse`, so the runtime checks do not require type annotations beyond the existing shape).
    - The existing `tests/codex-codec.test.ts` continues to pass -- the new throws fire ONLY on inputs that were previously broken-in-different-ways (an existing test that exercises a malformed shape WOULD start matching the new error message instead of whatever it matched before; the existing tests at lines 125-145 cover non-JSON, missing version, version mismatch, plain-string, and null inputs -- none of those exercise the new shape-failure paths, so they continue to pass unchanged).
    - File-scoped behavior change: ADDITIVE per NFR-01. The new throws fire on inputs that previously slipped through into a typed cast that lied -- consumers who previously got a runtime crash later (when accessing `.kadenaWallets[0]` on a non-array) now get a clear named error at the deserialize boundary.
    - No other changes to `src/codex/codec.ts` (no edits to `buildCodexExport`, no edits to `serializeCodex`, no formatting changes elsewhere).
  - context:
    - `src/codex/codec.ts` (full file -- the 93-line file, focus on the existing `deserializeCodex` function at lines 75-93 and its JSDoc at lines 60-74)
    - `src/codex/types.ts` (read `CodexExportV1_2` type to confirm the four field names + their declared shapes)
    - `tests/codex-codec.test.ts:147-158` (the forward-compat pin test -- read to confirm the new validation does not break it)
    - `tests/codex-codec.test.ts:125-145` (the existing throws tests -- read to confirm error-message style)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-02 -- shape validation contract; specifically the locked phrasing "throws domain-prefixed errors that name the bad field but do NOT echo its value")
  - research:
    - Pattern: [CITED] Existing throw style at `src/codex/codec.ts:85` (`throw new Error("deserializeCodex: not an object");`) and `src/codex/codec.ts:88-90` (`throw new Error("deserializeCodex: unsupported version ${String(parsed.version)} -- expected \"1.2\"");`). NOTE the version-check throw DOES echo the bad version into the message; this is fine for `version` (a public format identifier) but is the EXACT pattern the new shape-validation throws must NOT follow because the four shape-checked fields can contain encrypted secrets / private addresses. The new throws use the format `deserializeCodex: <field> must be <expected-shape>` -- no value interpolation.
    - Reuse: [CITED] `Array.isArray(...)` is in the TypeScript lib; no new dependency. The `typeof === "object" && !== null && !Array.isArray(...)` triplet is the canonical "is plain object" check and is used elsewhere in this codebase (e.g. the existing `parsed && typeof parsed === "object"` check at `src/codex/codec.ts:84`).
    - Types: [CITED] `CodexExportV1_2<KS, OA, AB, UI>` at `src/codex/types.ts` declares `kadenaWallets: KS[]`, `ouronetWallets: OA[]`, `addressBook: AB[]`, `uiSettings: UI`. The four runtime shape checks correspond directly to these four type declarations.
    - Approach: [CITED] Insert the validation block as four sequential `if (...) throw new Error(...)` checks in declaration order. Avoid combining them into a single check / aggregate error -- per "fail fast on the first contract break" principle and matching the existing single-throw-per-condition pattern at lines 84-91. The four messages are stable strings the tests will lock; do not reword them.
    - Approach: [VERIFIED] No-value-echo is a security boundary, not a style preference. The audit-spec source for F-CORE-013 (`.bee/audit-specs-unified/2026-05-02-comprehensive/_unified.md`, M1) calls this out explicitly; the spec at `spec.md:25` and requirements.md REQ-02 lock it. A future contributor "improving" the error message by adding `${JSON.stringify(parsed.kadenaWallets)}` would silently break the integrity boundary -- the verification gate at T2.5 includes a grep check that catches this regression.
  - notes:

- [x] T2.2 | Add foreign-key resolver pre-flight to `CodexSigningStrategy.execute` at `src/signing/codexStrategy.ts:68-210` -- when ANY guard requires a foreign-key signer AND `this.resolver.requestForeignKey === undefined`, throw a precise named error BEFORE any keypair resolution, simulation, or `universalSignTransaction` call (Option B from the audit-spec source -- minimal API surface change, clear error message) | bee-implementer
  - requirements: [REQ-03]
  - acceptance:
    - The pre-flight block is inserted INSIDE `execute`, AT THE TOP OF THE METHOD BODY, AFTER the destructure at lines 79-86 and BEFORE the existing `// -- B. Codex pub set --` block at line 87. Position is load-bearing: the pre-flight must run before any I/O (the `listCodexPubs()` call at line 88 is the first I/O hop) so a misconfigured resolver fails IMMEDIATELY without spending a network round-trip.
    - The pre-flight logic (Option B per requirements.md REQ-03 lock):
      1. If `this.resolver.requestForeignKey === undefined`, walk the `guards` parameter and check each guard's keys for ANY pub that is NOT in `resolvedForeignKeys` and is NOT in the resolver's codex set.
      2. If `this.resolver.requestForeignKey !== undefined` (resolver implements it), the pre-flight is a no-op -- the existing `requestForeignKey` propagation path at line 234-236 in the `sign(...)` helper continues to handle the actual missing-key prompt.
      3. To check codex membership without a network round trip, the pre-flight calls `await this.resolver.listCodexPubs()` ONCE and stashes the result; the subsequent line 88 read uses the stashed result (variable lift) rather than calling `listCodexPubs()` twice.
    - Detection logic: a foreign-key signer is a guard pub `pub` such that `!codexPubs.has(pub) && !(pub in resolvedForeignKeys)`. If the resolver omits `requestForeignKey` AND any guard contains at least one such pub, the pre-flight throws.
    - Error shape: `throw new Error("[CodexSigningStrategy] Configured resolver does not implement requestForeignKey, but at least one guard requires a foreign-key signer (pub <PUB-PREFIX>...). Implement KeyResolver.requestForeignKey on the resolver, or pre-resolve the key via resolvedForeignKeys.");` -- format mirrors the existing `[CodexSigningStrategy]` prefix at lines 130-133 and 136-139. The PUB-PREFIX is the first 8 characters of the offending pub (matches the resolver-log format at `tests/strategy.test.ts:99` and elsewhere). Naming the prefix gives the consumer a debugging hint without echoing the full pub (consistent style with the rest of the strategy's diagnostics).
    - The error message contains EXACTLY the substring `requestForeignKey` (so tests can `toThrow(/requestForeignKey/)`) and EXACTLY the substring `[CodexSigningStrategy]` (for log-grep parity with the rest of the file).
    - The pre-flight short-circuits on the FIRST offending pub it finds (does not aggregate all bad pubs). Matches the fail-fast pattern of the rest of `execute`.
    - **No regression on existing tests at `tests/strategy.test.ts:420-453`:** the existing test at lines 420-453 (`resolver.requestForeignKey gets called for missing pubs + its error propagates`) constructs a resolver that DOES implement `requestForeignKey`, so the new pre-flight does NOT fire on it. The test continues to pass byte-identically.
    - **No regression on the chain-level rejection test at `tests/strategy.test.ts:378-418`** (`submits a tx with missing sig slot when a guard pub has no resolvedForeignKey`): that test uses a resolver that OMITS `requestForeignKey`, but the test expects `execute` to SUCCEED and submit a tx with a missing sig slot. The new pre-flight WILL fire on this test because the resolver omits `requestForeignKey` AND the guard requires `PUB_C` which is foreign. **DECISION: that test must be updated by T2.4** (mark it as superseded by the new pre-flight contract) -- but T2.4 owns the test file edit, not T2.2. T2.2's notes flag this so T2.4 picks up the breakage. This is the EXPECTED behavior change per REQ-03's spec text "previously slipping through" -- the chain-level rejection path is the previously-broken-in-a-different-way path the new pre-flight intercepts.
    - `npm run typecheck` exits 0.
    - File-scoped behavior change: ADDITIVE per NFR-01. The new throw fires ONLY on inputs that were previously broken (foreign-key tx + resolver-without-method = previously a deep-stack failure during signing; now a precise pre-flight error).
    - No other changes to `src/signing/codexStrategy.ts` (the `sign(...)` helper at lines 217-245 is NOT touched -- the existing `onMissingKey` wiring at line 234-236 stays as-is; that path handles foreign keys at the universalSign layer when the resolver DOES implement the method).
  - context:
    - `src/signing/codexStrategy.ts` (full file -- focus on the `execute` method at lines 68-210 and its destructure at lines 79-86; the existing `requestForeignKey` reference at lines 234-236 in `sign(...)` is read-only context for understanding why the pre-flight handles the OPPOSITE case)
    - `src/signing/types.ts` (`KeyResolver` interface at lines 46-70 -- specifically `requestForeignKey?:` optional method at lines 62-69)
    - `src/guard/index.ts` (the `analyzeGuard` import used at line 21 of codexStrategy.ts; read-only context for understanding how the strategy currently handles the codex-vs-foreign partitioning at line 96)
    - `tests/strategy.test.ts:420-453` (existing `requestForeignKey` propagation test -- read to confirm the new pre-flight does NOT break it because resolver implements the method)
    - `tests/strategy.test.ts:378-418` (existing chain-level-rejection test -- read to confirm this test's expected behavior CHANGES under REQ-03; T2.4 owns the test update)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-03 -- pre-flight contract; locked Option B from the audit-spec source)
  - research:
    - Pattern: [CITED] Existing `[CodexSigningStrategy]`-prefixed throws at `src/signing/codexStrategy.ts:130-133` and `136-139`. The new pre-flight throw uses the same prefix for log-grep parity.
    - Pattern: [CITED] The pub-prefix-only diagnostic style at `tests/strategy.test.ts:99` (`getKeyPairByPublicKey:${pub.slice(0, 8)}`) is the existing convention for surfacing pub identifiers in errors / logs without echoing the full 64-char hex. The new pre-flight follows this convention.
    - Reuse: [CITED] `await this.resolver.listCodexPubs()` returns `Set<string> | Promise<Set<string>>` per `src/signing/types.ts:52`. Stashing the awaited value as a `Set<string>` and reusing it for the line 88 codex-pubs read avoids duplicating the I/O.
    - Types: [CITED] `KeyResolver.requestForeignKey?:` is optional at `src/signing/types.ts:62-69`. `this.resolver.requestForeignKey === undefined` is the canonical TypeScript check for "resolver omits the method" -- consistent with the existing check at `src/signing/codexStrategy.ts:234` (`this.resolver.requestForeignKey ? ... : undefined`). Both checks observe the same boolean.
    - Approach: [CITED] Option B per requirements.md REQ-03 lock: walk the guards, check each pub against `codexPubs` and `resolvedForeignKeys`, throw on the first foreign-needing pub when `requestForeignKey` is omitted. Avoid invoking `analyzeGuard` for the pre-flight -- using `analyzeGuard` would be Option A (defer to existing analysis machinery) and would tie the pre-flight to the analysis output shape; Option B is a self-contained scan that does not couple with `analyzeGuard`'s implementation details. The audit-spec's "Option B" is the locked choice for this reason.
    - Approach: [VERIFIED] The pre-flight reads `guards` directly. It does NOT need to know about `extraSigners` (those come with their keypairs already-resolved by the consumer; they are NOT a foreign-key path) and does NOT need to know about the caps key (the caps key always comes from the codex set). So the scan is `guards x guard.keys` only.
  - notes:

- [x] T2.3 | Update `KeyResolver.requestForeignKey` JSDoc at `src/signing/types.ts:62-69` to state the optional-at-the-interface-but-required-at-execute-time-when-needed contract (JSDoc text only -- no signature change, no other file changes) | bee-implementer
  - requirements: [REQ-03]
  - acceptance:
    - The JSDoc comment block at `src/signing/types.ts:62-69` is rewritten to state the runtime contract that REQ-03's pre-flight (T2.2) enforces. The new text MUST cover three points:
      1. The method is optional in the interface (server resolvers that never sign foreign-key transactions may omit it).
      2. It is required at execute time the moment any guard requires a foreign key.
      3. Server resolvers should either implement-and-throw or omit the method (the strategy fails fast on first foreign-key need; an implement-and-throw resolver gets the throw at the guard-resolution path, an omit resolver gets the new pre-flight throw at the entry point of execute).
    - Suggested JSDoc text (the implementer may polish prose; the three contractual points must be present):
      ```
      /**
       * Optional: resolve a signer pubkey that isn't in the Codex by prompting
       * the user (or equivalent) for a raw 64-char private key. Browser
       * implementations call the ForeignKeySignModal here.
       *
       * **Contract (runtime):** Optional in the interface; required at execute
       * time the moment any guard requires a foreign-key signer. Server
       * resolvers should either implement-and-throw (e.g. consult an
       * allow-list and throw on misses) or omit the method entirely. When the
       * method is omitted AND a transaction reaches `CodexSigningStrategy.
       * execute` with a foreign-key signer, the strategy throws a precise
       * pre-flight error before any I/O (REQ-03 / F-CORE-014). When the
       * method is implemented, the strategy forwards missing-key requests to
       * it via `universalSignTransaction`'s `onMissingKey` callback.
       */
      ```
    - The signature `requestForeignKey?(publicKey: string): Promise<string>;` at line 69 is UNCHANGED. The optional-marker `?` stays. The return type stays.
    - No changes to other interface members (`listCodexPubs`, `getKeyPairByPublicKey`).
    - No changes to other JSDoc blocks in the file.
    - No changes to the imports at lines 14-15.
    - `npm run typecheck` exits 0 (JSDoc-only change cannot break compilation).
  - context:
    - `src/signing/types.ts` (full file -- specifically lines 62-69 JSDoc on `requestForeignKey`)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-03 -- the JSDoc clarification text)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/spec.md:28` (the locked phrasing of the contract)
  - research:
    - Pattern: [CITED] Existing JSDoc style on `KeyResolver.listCodexPubs` (lines 47-52) and `KeyResolver.getKeyPairByPublicKey` (lines 54-60) -- multi-line block, leading description, optional **Contract:** bold sub-section. The new JSDoc follows the same style.
    - Pattern: [CITED] The `**Consumer-level retry contract (load-bearing):**` style sub-heading at `src/signing/codexStrategy.ts:51` is the existing convention for highlighting runtime-contract clauses inside JSDoc. The new JSDoc uses `**Contract (runtime):**` as a parallel marker.
    - Approach: [CITED] JSDoc-only edit; no signature change, no behavior change. The clarification ALIGNS the documented contract with the runtime contract that T2.2's pre-flight enforces. A consumer who reads the JSDoc and writes a server resolver that omits `requestForeignKey` now has a clear expectation that any foreign-key transaction will throw at the strategy boundary.
    - Approach: [VERIFIED] The "implement-and-throw OR omit" guidance is an EXPLICIT contract choice the consumer makes. The two paths are observably different: implement-and-throw produces a domain-specific throw deep in the universalSign machinery (the consumer's own throw text); omit produces the new T2.2 pre-flight throw at the strategy boundary. Both are fail-fast; the consumer chooses based on whether they want their own diagnostic text.
  - notes:

## Wave 2 (1 task)

- [x] T2.4 | Add 4+ new test cases covering REQ-02 + REQ-03: shape validation hits each of the three array fields + the one object field with name-only-no-value-echo assertion (extends `tests/codex-codec.test.ts`); foreign-key pre-flight error on a resolver that omits `requestForeignKey` (extends `tests/strategy.test.ts`); update the existing chain-level-rejection test at `tests/strategy.test.ts:378-418` to reflect the new pre-flight contract per T2.2's flag | bee-implementer
  - requirements: [REQ-02, REQ-03]
  - depends_on: [T2.1, T2.2, T2.3]
  - acceptance:
    - **Test set 1 (REQ-02 / T2.1) -- shape validation in `tests/codex-codec.test.ts`:** add a new `describe("deserializeCodex shape validation (REQ-02)", () => { ... })` block (or extend the existing `describe("deserializeCodex", ...)` block at line 115; implementer's choice) containing AT LEAST four `it(...)` cases:
      1. `it("throws when kadenaWallets is not an array", () => { ... })` -- builds a JSON payload `{ version: "1.2", kadenaWallets: "not-an-array", ouronetWallets: [], addressBook: [], uiSettings: {} }`, expects `deserializeCodex(json)` to throw `/kadenaWallets must be an array/`.
      2. `it("throws when ouronetWallets is not an array", () => { ... })` -- same shape, sets `ouronetWallets: { obj: true }`, expects `/ouronetWallets must be an array/`.
      3. `it("throws when addressBook is not an array", () => { ... })` -- sets `addressBook: 42`, expects `/addressBook must be an array/`.
      4. `it("throws when uiSettings is not an object (string)", () => { ... })` -- sets `uiSettings: "not-an-object"`, expects `/uiSettings must be an object/`.
      5. `it("throws when uiSettings is null (null is not a valid object)", () => { ... })` -- sets `uiSettings: null`, expects `/uiSettings must be an object/`.
      6. `it("throws when uiSettings is an array (array is not a plain object)", () => { ... })` -- sets `uiSettings: []`, expects `/uiSettings must be an object/`.
      7. `it("throws on the FIRST malformed field in declaration order (kadenaWallets wins over uiSettings)", () => { ... })` -- payload has BOTH `kadenaWallets: "x"` AND `uiSettings: "x"`, expects the throw to match `/kadenaWallets must be an array/` (NOT `/uiSettings/`). Locks the determinism of validation order.
      8. **No-value-echo assertion:** `it("does NOT echo the bad field's value into the error message (no info disclosure)", () => { ... })` -- payload has `kadenaWallets: "SECRET-LOOKING-VALUE-12345"`. Catch the thrown error. Assert that the `error.message` does NOT contain the substring `SECRET-LOOKING-VALUE-12345` and does NOT contain the substring `12345`. Asserts the security boundary at the test level. Use `expect(err.message).not.toContain("SECRET-LOOKING-VALUE-12345")`.
    - **Test set 2 (REQ-03 / T2.2) -- foreign-key pre-flight in `tests/strategy.test.ts`:** add a new `describe("CodexSigningStrategy.execute -- foreign-key resolver pre-flight (REQ-03)", () => { ... })` block containing AT LEAST one `it(...)` case:
      1. `it("throws a precise pre-flight error when guards require a foreign key AND resolver omits requestForeignKey", async () => { ... })` -- builds a resolver that OMITS `requestForeignKey` (i.e. `requestForeignKey: undefined` or simply not declared on the resolver object). Builds a guard requiring `PUB_C` which is NOT in `codexPubs` and NOT in `resolvedForeignKeys`. Asserts:
         - `await expect(strategy.execute({ ... })).rejects.toThrow(/requestForeignKey/);`
         - The thrown error message contains `[CodexSigningStrategy]` (log-grep parity).
         - The thrown error message contains the first 8 chars of `PUB_C` (debugging hint).
         - **CRITICAL:** the mock client's `dirtyRead` and `submit` are NEVER called -- assert `client.log` is empty (or does not contain `dirtyRead` or `submit`). This is the no-I/O-on-misconfigured-resolver guarantee.
      2. (Optional but recommended) `it("does NOT fire pre-flight when resolver implements requestForeignKey (sanity check)", async () => { ... })` -- existing `requestForeignKey gets called for missing pubs + its error propagates` test at lines 420-453 already covers this implicitly; the implementer may add an explicit positive case OR cite the existing test in a comment.
      3. (Optional but recommended) `it("does NOT fire pre-flight when no guard requires a foreign key (only-codex-keys path)", async () => { ... })` -- existing happy-path tests at lines 132-189 already cover this; the implementer may add an explicit negative case OR cite the existing tests.
    - **Test set 3 (REQ-03 fallout) -- update existing chain-level-rejection test at `tests/strategy.test.ts:378-418`:** the existing test (`submits a tx with missing sig slot when a guard pub has no resolvedForeignKey`) constructs a resolver that OMITS `requestForeignKey` and a guard that requires `PUB_C` (foreign). Under REQ-03's new pre-flight, this combination THROWS at the pre-flight. The test must be updated:
       - **Option A (preferred):** rewrite the test to assert the new pre-flight throw. Rename the test to reflect the new behavior (e.g. `it("throws pre-flight error when foreign guard pub has no resolvedForeignKey AND resolver omits requestForeignKey (REQ-03)", ...)`). The test now asserts `rejects.toThrow(/requestForeignKey/)`. This makes the test redundant with test 1 above, so DELETE the existing test instead.
       - **Option B:** add `requestForeignKey: async (_pub) => { throw new Error("not allowed"); }` to the resolver. The pre-flight does not fire (resolver implements the method); the throw fires from inside `requestForeignKey` instead, at the universalSign layer. Test name may be updated to reflect the new path, but the original chain-level-rejection-with-missing-sig assertion is no longer reachable through the strategy and the test no longer documents what its name claims.
       - **DECISION:** Use Option A (DELETE the existing test, the new pre-flight test 2.1 above subsumes its scope). Document the deletion in T2.4's notes citing REQ-03's pre-flight contract supersession.
    - **TDD discipline (per "Watch It Fail" rule):** for EACH new `it(...)` case in test sets 1 and 2, the implementer's `notes:` records:
       - The test was authored against the expected contract.
       - The test was run with a stubbed-out OR removed-from-disk version of the relevant T2.1 / T2.2 source change (`git stash` of the W1 edit, or temporarily comment out the new validation block) -- the test FAILS for the right reason (the missing throw -- not a typo, not a fixture error).
       - The test was re-run with the W1 edits in place -- the test PASSES.
       - Both observations (FAIL-then-PASS) are pasted as evidence in T2.4's notes. The conductor's post-wave validation hook reads notes for evidence per R8.
    - **Existing tests preservation:** all OTHER existing tests in `tests/codex-codec.test.ts` (the 18 existing `it(...)` cases at lines 51-268) and `tests/strategy.test.ts` (the existing `describe` blocks for pipeline orchestration at 131-296, sign at 300-343, Tier 2 edge cases at 349-568, and T4.1 timeout enforcement at 579-773) continue to pass byte-identically. The only deletion is the chain-level-rejection test at lines 378-418 per the Option A decision above.
    - The phase-scoped scoped test commands `npx vitest run tests/codex-codec.test.ts` AND `npx vitest run tests/strategy.test.ts` BOTH exit 0 with the expected new test count: `tests/codex-codec.test.ts` gains 8 new `it(...)` cases (plus 0 deletions); `tests/strategy.test.ts` gains 1-3 new `it(...)` cases AND drops 1 (the Option A deletion). Net new tests: at least `8 + 1 = 9` cases, comfortably above NFR-04's minimum of 3.
    - No new "Open handles" warnings appear in the vitest output (NFR-05).
    - No imports beyond what the existing test files already pull (the new tests use `deserializeCodex`, `CodexSigningStrategy`, `mockResolver`, `mockPactClient`, `buildMockTx`, `KP_A`, `KP_B`, `PUB_A`, `PUB_B`, `PUB_C` -- all already present in the two files).
    - File-scoped behavior change: ZERO (test-only edits to `tests/codex-codec.test.ts` and `tests/strategy.test.ts`).
  - context:
    - `tests/codex-codec.test.ts` (full file -- understand existing fixture `makeFixtureCodex` at lines 28-47, existing `describe("deserializeCodex", ...)` block at 115-159, existing forward-compat pin at 147-158)
    - `tests/strategy.test.ts` (full file -- understand existing mocks `mockPactClient` at 55-83 and `mockResolver` at 87-105, RFC 8032 keypair fixtures at 38-49, the existing `requestForeignKey` propagation test at 420-453, the chain-level-rejection test at 378-418 to be DELETED per Option A)
    - `src/codex/codec.ts` (POST-T2.1 state -- the new shape-validation block; the four locked error messages)
    - `src/signing/codexStrategy.ts` (POST-T2.2 state -- the new pre-flight block; the locked error message format)
    - `src/signing/types.ts` (POST-T2.3 state -- the JSDoc clarification; for cross-reference in test comments)
    - T2.1, T2.2, T2.3 notes (the W1 implementers' notes contain the locked error-message strings and the pre-flight detection logic that the tests assert against)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-02 + REQ-03 + NFR-04 minimum-3-new-tests-per-substantive-phase)
  - research:
    - Pattern: [CITED] Existing test style at `tests/codex-codec.test.ts:115-159` (`describe("deserializeCodex", ...)` with multiple `it(...)` cases, JSON-string fixtures, `expect(...).toThrow(/regex/)` style) -- the new shape-validation tests follow the same style.
    - Pattern: [CITED] Existing `expect(err.message).toMatch(...)` and `expect(err).toBeInstanceOf(SigningError)` patterns at `tests/strategy.test.ts:610-651` -- the new pre-flight test follows a similar style for asserting the error class + message + side-effect (no-I/O).
    - Pattern: [CITED] Existing `mockPactClient`'s `log: string[]` recording at `tests/strategy.test.ts:58, 67, 78` -- the new pre-flight test asserts `client.log` is empty as the no-I/O proof.
    - Reuse: [CITED] RFC 8032 fixtures (`PUB_A`, `PUB_B`, `PUB_C`) at `tests/strategy.test.ts:38-49` are public test vectors safe to reuse; the new pre-flight test reuses them rather than introducing new keys.
    - Reuse: [CITED] `makeFixtureCodex` at `tests/codex-codec.test.ts:28-47` is the existing happy-path fixture; the new shape-validation tests use raw JSON-string fixtures (not `makeFixtureCodex`) because the bad-shape inputs cannot be expressed via the typed `PlaintextCodex` interface.
    - Approach: [CITED] One `describe` per concern (shape-validation in codec; pre-flight in strategy) keeps the test file's existing organization. The deletion of the chain-level-rejection test at lines 378-418 is justified by REQ-03's pre-flight superseding it -- the "missing sig slot at the chain level" path is no longer reachable through `CodexSigningStrategy.execute` because the pre-flight intercepts.
    - Approach: [VERIFIED] No-value-echo assertion is a security-boundary test, not a style test. Putting `SECRET-LOOKING-VALUE-12345` in the bad field and asserting it does NOT appear in the error message catches the regression of "future contributor adds `${parsed.kadenaWallets}` to the error message". This is a structural test that survives prose changes to the error message as long as the no-value-echo invariant holds.
    - Approach: [VERIFIED] T2.4's TDD discipline (`git stash` of W1 edit, watch FAIL, restore, watch PASS) is the standard "Watch It Fail" pattern from the core skill. The implementer's notes record both observations as evidence per R8.
  - notes:

## Wave 3 (1 task)

- [x] T2.5 | Verification gate: typecheck + scoped vitest run on the two affected test files + scoped grep checks asserting positional invariants for T2.1's shape-validation block (after version check, before cast) and T2.2's pre-flight block (before any I/O), plus the no-value-echo grep | bee-implementer
  - requirements: [REQ-02, REQ-03]
  - depends_on: [T2.1, T2.2, T2.3, T2.4]
  - acceptance:
    - **Typecheck:** `npm run typecheck` (or `npx tsc --noEmit`) exits 0. Run output captured verbatim in T2.5's notes per R8.
    - **Scoped tests:** `npx vitest run tests/codex-codec.test.ts tests/strategy.test.ts` exits 0 with all tests passing (the new T2.4 cases AND the existing cases). Test count delta is recorded: `tests/codex-codec.test.ts` net `+8` (8 new shape-validation cases, 0 deletions); `tests/strategy.test.ts` net `+0` to `+2` depending on whether T2.4 added the optional positive/negative cases (1 mandatory pre-flight test, optionally 0-2 extra), MINUS 1 for the Option A deletion. Combined phase delta: at least `+8 + 1 - 1 = +8` net new tests, minimum `+9` if optionals included. Test-count baseline is read from CLAUDE.md (`~310 tests`) and the post-phase actual count is recorded.
    - **No "Open handles" warnings** in the scoped vitest output (NFR-05).
    - **Positional invariant grep 1 -- T2.1 shape validation positioned correctly:** verify with the Read tool that in `src/codex/codec.ts`, the shape-validation block appears AFTER the `if (parsed.version !== "1.2")` check (current line 87-91) and BEFORE the `return parsed as CodexExportV1_2<...>` cast (current line 92, will shift down with the new block). Specifically: read the post-T2.1 file and confirm the order: line N: `parsed.version !== "1.2"` check; line N+M: `Array.isArray(parsed.kadenaWallets)` check; line N+M+K: `return parsed as ...`. Record the actual line numbers in notes.
    - **Positional invariant grep 2 -- T2.2 pre-flight positioned correctly:** verify with the Read tool that in `src/signing/codexStrategy.ts`, the new pre-flight block appears AFTER the `const { build, guards, ... } = args;` destructure (currently lines 79-86, will shift down with the new block) and BEFORE the existing `// -- B. Codex pub set --` comment / `await this.resolver.listCodexPubs()` call (currently line 87-88, will shift down). Record the actual line numbers in notes.
    - **No-value-echo grep:** run `grep -nE "(JSON\\.stringify|String)\\(parsed\\.(kadenaWallets|ouronetWallets|addressBook|uiSettings)" src/codex/codec.ts`. Expected: ZERO matches. ANY match is a regression of the security boundary and HALTS the phase. Record the grep output (expected empty) in notes.
    - **Domain-prefix grep:** run `grep -cE "^\\s*throw new Error\\(\"deserializeCodex:" src/codex/codec.ts`. Expected: AT LEAST 6 matches (the existing 2 throws at lines 85 and 88 + the 4 new shape-validation throws from T2.1 = 6 minimum; the line numbers will shift with the inserted block). Confirms the domain-prefix style is used uniformly.
    - **Pre-flight prefix grep:** run `grep -nE "\\[CodexSigningStrategy\\]" src/signing/codexStrategy.ts`. Expected: AT LEAST 3 matches (the existing 2 throws at lines 130-133 and 136-139 + the 1 new pre-flight throw from T2.2 = 3 minimum). Confirms the prefix is used by the new pre-flight throw.
    - **JSDoc-clarification grep:** run `grep -nE "(Contract \\(runtime\\)|required at execute time|fails fast on first foreign-key need)" src/signing/types.ts`. Expected: AT LEAST 1 match (T2.3's new JSDoc text, with at least one of the contractual phrases).
    - **NFR-02 type-regression lock:** the `tests/types.test.ts` v1.7.0 type-regression lock continues to pass -- captured implicitly via the typecheck above. Record the explicit confirmation in notes.
    - **No build run required at this phase boundary:** Phase 2 does NOT touch `package.json` exports, does NOT add new files (uses existing `src/` and `tests/` files only), and does NOT change any compiled artifact shape. The Phase 7 / REQ-17 verification gate runs the full `npm run build`. Phase 2 stops at typecheck + scoped tests.
    - Notes section summarizes ALL checks (typecheck, scoped tests, 5 grep checks) with PASS/FAIL and the captured outputs. Per R8, the actual command output is pasted as evidence; "X tests passing" without the test-runner output is not evidence.
    - File-scoped behavior change: ZERO (T2.5 is read-only verification).
  - context:
    - `Z:/OuronetCore/package.json` (npm scripts: typecheck)
    - `src/codex/codec.ts` (POST-T2.1 state -- read to confirm positional invariant 1)
    - `src/signing/codexStrategy.ts` (POST-T2.2 state -- read to confirm positional invariant 2)
    - `src/signing/types.ts` (POST-T2.3 state -- read to confirm JSDoc-clarification grep)
    - `tests/codex-codec.test.ts` (POST-T2.4 state)
    - `tests/strategy.test.ts` (POST-T2.4 state)
    - `Z:/OuronetCore/CLAUDE.md` (CI test count reference: `~310 tests`; locked Windows-locale test exception cite)
    - `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` (REQ-02 + REQ-03 + NFR-02 + NFR-04 + NFR-05 + REQ-17 verification anchor for Phase 2)
    - T2.1, T2.2, T2.3, T2.4 notes (W1 + W2 implementers' notes contain the locked error-message strings, line shifts, and test-count deltas the gate compares against)
  - research:
    - Pattern: [VERIFIED] Phase-scoped verification gate analogue from Phase 1's T1.13 (`Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/phases/01-safecreationtime-dry-refactor/TASKS.md:303-326`) -- typecheck + scoped tests + grep checks; capture each output verbatim; HALT on any failure.
    - Pattern: [CITED] Scoped vitest invocation `npx vitest run <file>` is the standard scope-locked test command per CLAUDE.md ("Run a single test file: `npx vitest run tests/cfm-builders.test.ts`"). T2.5 runs both Phase 2 test files in a single invocation.
    - Reuse: [CITED] Existing `npm run typecheck` script in `package.json` is the canonical typecheck entry point.
    - Approach: [VERIFIED] Skip `npm run build` at the Phase 2 boundary -- Phase 2 does not change the compiled artifact shape (no new files, no `package.json` exports edits). The Phase 7 verification gate runs the full build sweep. Skipping build at Phase 2 saves wall time and matches the "scoped tests only at per-wave validation" rule from `.bee/config.json` (`phases.post_wave_validation: "auto"`).
    - Approach: [VERIFIED] The five grep checks (positional invariants x 2, no-value-echo, domain-prefix, pre-flight prefix, JSDoc-clarification) are deterministic and survive future prose changes to error messages -- they assert structural invariants, not exact text matches. Future contributors who refactor error messages cannot accidentally break the security-boundary or the positional invariants without one of these greps catching it.
  - notes:

---

## Phase 2 Notes

- 5 tasks total in 3 waves: 3 source edits in W1 (T2.1, T2.2, T2.3 -- file-disjoint, parallel); 1 test edit in W2 (T2.4 -- depends on W1 source landing); 1 verification gate in W3 (T2.5 -- depends on W2).
- File-disjointness invariant (W1): T2.1 owns `src/codex/codec.ts`, T2.2 owns `src/signing/codexStrategy.ts`, T2.3 owns `src/signing/types.ts`. Zero overlap. T2.4 owns `tests/codex-codec.test.ts` + `tests/strategy.test.ts` (test files; not touched by W1). T2.5 is read-only.
- Cross-phase file-disjointness: Phase 1 touches `src/interactions/*Functions.ts` + `src/pact/*` only. Phase 2 touches `src/codex/codec.ts` + `src/signing/codexStrategy.ts` + `src/signing/types.ts` + `tests/codex-codec.test.ts` + `tests/strategy.test.ts` only. ZERO overlap. Phase 1 and Phase 2 may run in any order; the risk-ordered sequencing in `phases.md` is preference, not constraint.
- Wave 1 -> Wave 2 information flow: T2.4 reads T2.1's locked error-message strings (`deserializeCodex: kadenaWallets must be an array`, etc.) and T2.2's locked pre-flight message format (`[CodexSigningStrategy] Configured resolver does not implement requestForeignKey, ...`) from the W1 implementers' notes. The strings are stable contracts the test assertions match against.
- Wave 2 -> Wave 3 information flow: T2.5 consumes T2.4's test-count delta and the post-T2.4 test files for the scoped vitest run.
- TDD discipline preserved (per core skill "Watch It Fail" rule): T2.4 watches each new test FAIL with the W1 edit reverted (or the validation block stub-commented), then watches it PASS with the W1 edit in place. Both observations recorded in T2.4 notes as evidence per R8.
- Test count: existing baseline ~310 (per CLAUDE.md). Phase 2 net new tests: minimum +8 (T2.4 mandatory cases) + 1 (T2.4 mandatory pre-flight) - 1 (Option A deletion) = +8. Comfortable above NFR-04 minimum of 3. The Option A deletion of the chain-level-rejection test at `tests/strategy.test.ts:378-418` is justified because REQ-03's pre-flight intercepts the foreign-key path BEFORE the chain-level missing-sig path is reachable through `execute`.
- NFR-01 (additive-only): the only newly-thrown errors fire on inputs that were previously broken-in-different-ways (shape-malformed codex JSON; foreign-key transaction reaching a resolver that omits `requestForeignKey`). Strict semver minor bump. No public exports removed. No signature changes. JSDoc-only edit at T2.3 cannot affect the type-regression lock at NFR-02.
- NFR-05 (no Open handles): the new tests use the existing mocks and fixtures with no new resources (no fs, no timers, no network). The vitest scoped run cannot introduce new open-handle warnings.
- Risk profile: LOW. Three tightly-scoped contract-tightening edits at well-defined boundaries (codec deserialize entry; strategy execute entry; interface JSDoc). Each boundary has full existing test coverage (codec: 18 existing tests; strategy: 25+ existing tests across pipeline / sign / Tier 2 / T4.1 timeout). The new throws fire only on previously-broken inputs, so the existing test suite continues to pass byte-identically (with the documented exception of the Option A deletion).
- Out-of-scope guardrails: T2.1 must not touch `buildCodexExport` or `serializeCodex` (other functions in the same file); T2.2 must not touch the `sign(...)` helper at lines 217-245 (the existing `requestForeignKey` propagation path stays); T2.3 must not change the signature at line 69; T2.4 must not delete or refactor existing tests beyond the documented Option A deletion; T2.5 is read-only.
- Phase 5's `getLogger().error(...)` routing in `ouroFunctions.ts` is OUT OF SCOPE for Phase 2 -- Phase 2's edits to `src/codex/codec.ts` and `src/signing/codexStrategy.ts` use the existing `throw new Error(...)` pattern, not the logger seam. Logger seam routing applies only to `console.warn` / `console.error` call sites (Phase 6 sweep target), and the new throws in Phase 2 are not console calls.

## Fragmentation Note

W2 and W3 each contain a single task. Both are unavoidable structural gates rather than fragments that could be merged earlier:

- **W2 (T2.4) cannot merge into W1:** T2.4's tests assert against the contract surface that T2.1 and T2.2 introduce. Although tests CAN be written TDD-style against an expected post-state (red phase first), the chosen ordering (W1 source lands first; W2 tests land second) keeps the per-wave validation hook honest: W1 ends with a typecheck-clean state on the changed source files; W2 ends with the new tests passing against the W1-landed source. The TDD "Watch It Fail" discipline is preserved by having T2.4's implementer manually `git stash` the W1 edit per-test to observe the FAIL, then restore. Merging T2.4 into W1 would create file-conflict risk: T2.4 modifies `tests/strategy.test.ts` (deleting the lines 378-418 chain-level-rejection test); T2.2 modifies `src/signing/codexStrategy.ts` (adding pre-flight). They are different files but the test deletion is a CONSEQUENCE of the source change, not independent of it -- doing them in the same wave creates an information-flow problem (T2.4 needs to know T2.2's locked message format before it can author the assertions). W1 -> W2 sequencing makes the information flow explicit through T2.2's notes.
- **W3 (T2.5) cannot merge into W2:** T2.5 runs the integrated phase-end verification (typecheck + scoped tests + 5 grep checks). The grep checks need ALL FOUR W1 + W2 edits on disk to produce the expected counts and positional invariants. Running T2.5 mid-W2 would produce false reds on the test-count delta and the JSDoc-clarification grep. T2.5 is a true end-of-phase gate.

These are genuine sequential dependencies. The dense parallel work is W1 (3 tasks, all parallel, file-disjoint -- the high-parallelism wave that captures the bulk of the source edits). Average per wave is 5 / 3 = 1.67 tasks, BELOW the consolidation target of 2.5 -- this triggers the `fragmentation: warn` signal in the completion line below. The 1-task waves are documented above with genuine sequential dependencies; they cannot be merged without breaking the information-flow invariants. Phase 2 is structurally a small phase (3 source edits + 1 test edit + 1 gate = 5 tasks); the wave shape reflects that.

---

Phase 2: 5 tasks, 3 waves | conflicts: 0 | research: ok | fragmentation: warn
