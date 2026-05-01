# Bee Project State

## Current Spec
- Name: reliability-failover
- Path: .bee/specs/2026-05-01-reliability-failover/
- Status: IN_PROGRESS

<!-- Valid Status values:
  NO_SPEC       — No active spec; project is idle or between features.
  SPEC_CREATED  — Spec document exists but no phases have been executed yet.
  IN_PROGRESS   — At least one phase has moved past the planned stage.
  COMPLETED     — All phases committed and review-implementation is done.
  ARCHIVED      — Developer ran archive-spec; spec is stored in history.
-->

## Phases
| # | Name | Status | Plan | Plan Review | Executed | Reviewed | Tested | Committed |
|---|------|--------|------|-------------|----------|----------|--------|-----------|
| 1 | State isolation + default URL | REVIEWED | Yes | Yes (2) | Yes | Yes (1) | | |
| 2 | TIMEOUT error code + read-side failover wrap | REVIEWED | Yes | Yes (3) | Yes | Yes (1) | | |
| 3 | getFailoverClient factory + 81-site migration | REVIEWED | Yes | Yes (2) | Yes | Yes (1) | | |
| 4 | codexStrategy wraps + tests + quality gates + ship | REVIEWED | Yes | Yes (3) | Yes | Yes (1) | | |

<!-- Valid Phase Status values:
  PENDING       — Phase exists but planning has not started.
  PLANNED       — Phase has been planned; TASKS.md created with task breakdown and waves.
  PLAN_REVIEWED — Phase plan has been reviewed and approved; ready for execution.
  EXECUTING     — Phase is currently being executed; wave-based task implementation in progress.
  EXECUTED      — All tasks in the phase completed; implementation is done.
  REVIEWING     — Code review is in progress for this phase.
  REVIEWED      — Code review complete; all findings resolved or accepted.
  TESTING       — Manual test scenarios are being verified for this phase.
  TESTED        — All test scenarios passed; phase is ready to commit.
  COMMITTED     — Phase changes have been committed to version control.
-->

## Quick Tasks

| # | Description | Date | Commit |
|---|-------------|------|--------|

## Audit History

| Date | Risk Level | Critical | High | Medium | Low | Specs Generated |
|------|-----------|----------|------|--------|-----|----------------|
| 2026-04-30 | HIGH | 1 | 11 | 14 | 6 | 10 |

## Decisions Log

<!-- Structured decision entry format:
  Each entry records an autonomous decision made during ship or plan-all execution.

  Format:
  - **[WHAT]:** Brief description of the decision made.
  - **Why:** Reasoning behind the choice.
  - **Alternative rejected:** What option was considered but not chosen, and why.
-->

(Decisions for the arch-layering-and-seams spec moved to `.bee/archive/2026-04-30-arch-layering-and-seams/DECISIONS.md` at completion time.)
(Decisions for the consolidate-ikadenakeypair spec moved to `.bee/archive/2026-04-30-consolidate-ikadenakeypair/DECISIONS.md` at completion time.)

- **[Plan review auto-fix]:** Phase 3 plan-review iter 1: 2 HIGH + 3 MED (bug-detector); pattern-reviewer + plan-compliance CLEAN; stack-reviewer skipped (no stack skill loaded). F-001 (HIGH) — listen 30s default vs Kadena ~30s block time would cause routine false TIMEOUT on cross-chain (1 listen + 1 pollOne) and addLiquidity (2 listen sites) flows. Bumped listen default 30s → 180s (~6 blocks) at spec/REQ-09 + phases.md + ROADMAP.md + Phase 3 TASKS.md (FailoverClientOptions defaults + DEFAULT_LISTEN_TIMEOUT_MS module constant + per-call-overrides note). F-002 (HIGH) — Goal section "44 createClient invocations" inconsistent with per-file row sum (43 if ouro=12, 44 if ouro=13); fixed Goal to "43-44 invocations" with explicit reconciliation rule reference. F-003 (MED) — submit array-overload narrowing now documented in JSDoc (single-tx form only; consumers needing batch fall back to direct createClient). F-004 (MED) — runWithTimeout now validates `Number.isFinite(timeoutMs) && timeoutMs > 0` and throws synchronous Error on misconfiguration; protects against `submitTimeoutMs: 0` foot-gun (?? doesn't short-circuit on 0). F-005 (MED) — caller-side immutability warning added to submit JSDoc (callers MUST NOT mutate transaction reference between submit() and promise settling — would break dedup contract on fallback retry).
- **Why:** F-001 was a real regression hazard (Kadena block time is the same magnitude as the proposed listen timeout); single-spec-level fix prevents implementer surprise. F-002 was planning hygiene. F-003/F-004/F-005 are defensive lockdowns of contracts that consumer-side mistakes could otherwise quietly violate.
- **Alternative rejected:** Threading per-call `{ listenTimeoutMs: 180000 }` overrides through every migrated listen site in T3.4/T3.6 — larger blast radius, easier for future call sites to forget, and obscures the spec-level rationale. Single default-bump is the cleaner fix.

- **[Plan review auto-fix]:** Phase 2 plan-review iter 1: 4 HIGH + 5 MED across bug-detector + pattern-reviewer (plan-compliance CLEAN, stack-reviewer skipped). Most critical: F-001 — Promise.race rejecting with SigningError(TIMEOUT) does NOT trigger withFailover retry (classifier matches AbortError/network errors only); restructured T2.2 to throw AbortError-shaped Error on timeout (matches classifier → fallback retry fires), then convert to SigningError(TIMEOUT) at outer try/catch boundary if BOTH sides time out. Other fixes: F-002 explicit-pactUrl branch now also enforces timeout via local helper; F-003 createTimeoutError empty-string guard locked; PAT-001 createTimeoutError now accepts originalError parameter (passes through caught AbortError); PAT-002 additionalContext type aligned to string (matches sibling factories); PAT-004 branching shape locked to outer if/else; PAT-005 readTimeoutMs field position locked to "after skipTempWatcher, before [key:string]:unknown" in both files; PAT-006 T2.4 test count tightened from `>=346` to `==346`. PAT-003 (clearTimeout cleanup pattern) acknowledged as deliberate stricter convention.

- **[Plan review auto-fix]:** Phase 1 plan-review iteration 1 surfaced 3 findings: 2 HIGH (TDD deferral — resetNodeFailover + retryTimer.unref ship without tests in Phase 1; tests live in Phase 4 REQ-16) + 1 MEDIUM (JSDoc contradiction in constants/kadena.ts:21 vs the new @deprecated tag). Pattern-reviewer + plan-compliance + stack-reviewer all CLEAN. All 3 auto-fixed.
- **Why:** The TDD findings are a real workflow concern IF Phase 1 ships standalone — but the reliability-failover spec ships as ONE atomic v2.1.0 release after Phase 4 (test coverage lands BEFORE the tag). Locked the atomic-ship contract in TASKS.md notes. JSDoc fix prevents two contradictory migration pointers in the same JSDoc block.
- **Alternative rejected:** Moving Phase 4's REQ-16 tests forward into Phase 1 — would undo the deliberate phase split (tests consolidated for cross-phase test-file authoring efficiency); spec-ship-time TDD invariant satisfaction is the locked design.

- **[Plan review auto-fix]:** Phase 4 plan-review iter 1: 9 HIGH + 3 MEDIUM across bug-detector (F-001–F-005), pattern-reviewer (PAT-001–PAT-002), stack-reviewer (FINDING-001–FINDING-005); plan-compliance CLEAN. Root cause of most findings: T4.1 and T4.2 had incorrect error shape — `AbortError` instead of `SigningError { code: "TIMEOUT" }` as required by REQ-07/REQ-10. Additional fixes: vi.useFakeTimers same-scope pairing rule (F-001); T4.3 prerequisite read of Phase 3 factory to verify reference not cloned before writing dedup assertion (F-002); lock T4.3 stub to `vi.mock` not `vi.spyOn` for native ESM safety (FINDING-002); T4.4 customGasLimit independent verification via setNodeConfig-custom post-reset sequence (F-005); T4.5 programmatic count extraction + baseline note (F-003/FINDING-003); T4.6 local CHANGELOG/version parity grep check + atomicity rule (F-004/FINDING-004); T4.1 concise-arrow-form mandate (FINDING-005).
- **Why:** The AbortError/SigningError mismatch was critical — T4.2 tests would fail at runtime if implemented as written; T4.4's customGasLimit gap would silently pass even if resetNodeFailover() had a reset bug. All fixes propagate spec-correct contracts into acceptance criteria before the implementer agent sees them.
- **Alternative rejected:** Leaving AbortError assertion and adding a note — would require the implementer to resolve the contradiction; auto-fixing ensures consistent acceptance criteria.

- **[Plan review auto-fix]:** Phase 4 plan-review iter 2: 1 HIGH + 1 MED (deduplicated). HIGH: T4.3 research note had `submitMock` referenced inside hoisted `vi.mock` factory — temporal dead zone; added `vi.hoisted()` pattern so variable is initialized before factory executes. MED: T4.2 research note said "top-level afterEach" unconditionally, contradicting the same-scope rule already in acceptance; qualified to clarify option (a) vs (b) placement. Plan-compliance and stack-reviewer CLEAN.
- **Why:** vi.mock hoisting is a known vitest gotcha — without vi.hoisted(), the submitMock reference would be undefined inside the factory, making the reference-equality dedup assertion vacuous (tests/failover-submit.test.ts would pass vacuously or throw). The research note contradiction was a lower-severity issue but could trap an implementer using option (b) timer activation.
- **Alternative rejected:** Not fixing the hoisting issue and leaving it for the implementer to discover — the reference-equality assertion is the core REQ-15 contract guarantee; a silently-vacuous test would be worse than no test.

- **[Plan review auto-fix — iter 3, max iterations reached]:** Phase 4 plan-review iter 3: 1 HIGH + 1 MED. Both auto-fixed before max-iterations cutoff — no unresolved findings remain. HIGH: T4.1/T4.2 had a cross-phase contradiction with Phase 3 T3.1 — `runWithTimeout` emits `AbortError` (not `SigningError(TIMEOUT)`) per Phase 3 design so `withFailover`'s line-116 AbortError classifier can trigger fallback retry; the outer `getFailoverClient` methods do the AbortError→SigningError(TIMEOUT) conversion. At the codexStrategy seam (no `withFailover`), T4.1 must add its own outer-boundary try/catch to convert AbortError → `createTimeoutError(...)`. T4.2 tests must exercise `getFailoverClient` methods (which include the converter), not bare `runWithTimeout`. MED: T4.4 customGasLimit independent verification step was circular — the intermediate `setNodeConfig` call overwrote `customGasLimit` before the assertion, proving nothing. Replaced with an honest testability note: `customGasLimit` is not independently observable via the public API after `resetNodeFailover()` (NODE_GAS_LIMITS map short-circuits the fallback); test verifies 4 observable slots and the implementer must verify the 5th by reading the source.
- **Why:** The AbortError→TIMEOUT boundary design is load-bearing — Phase 3's withFailover retry depends on receiving AbortError (not SigningError). T4.1 codexStrategy seam needs its own conversion; this was missed in iter 1 when the AbortError/SigningError mismatch was "fixed" in the wrong direction. The customGasLimit testability limitation is a genuine API gap — the honest fix is to document the limitation rather than add a circular verification.
- **Alternative rejected:** Having T4.1 produce SigningError(TIMEOUT) directly from runWithTimeout — would break Phase 3's withFailover classifier since it expects AbortError to trigger retry.

- **[Cross-plan auto-fix]:** Cross-plan consistency review iter 1: 2 HIGH + 2 MEDIUM across plan-compliance-reviewer (CI-001, CI-002, CI-003) and bug-detector (Phase 3 T3.2 delegation bug). All fixed in one pass. CI-001 (HIGH) — no test task claimed ownership of the `codexStrategy.execute()` TIMEOUT classification path; T4.2 extended with 2 mandatory codexStrategy seam it-blocks (dirtyRead and submit timeout via fake timers), raising T4.2 minimum from ≥11 to ≥13 and total suite minimum from ≥361 to ≥363. Bug-detector HIGH (Phase 3 T3.2) — explicit-pactUrl bypass branch conditionally delegated outer-boundary TIMEOUT conversion to "whatever T2.2 shipped"; replaced with a definitive mandate: BOTH branches MUST apply the same outer-boundary catch, re-asserting Phase 2 T2.2's LOCKED F-002 requirement. CI-002 (MEDIUM) — Phase 2 T2.2 research note cited `createTimeoutError` with 2 args but acceptance mandates 3 (with the caught AbortError); research note updated to 3-arg form for consistency. CI-003 (MEDIUM, from plan-compliance) — no additional TASKS.md changes required beyond CI-001 and CI-002 (covered by fixes above).
- **Why:** CI-001 was a genuine gap — T4.1 adds a NEW outer-boundary converter in `codexStrategy.ts` that is orthogonal to `getFailoverClient`'s converter; without a dedicated test the converter could be missing, wrong, or silently swallowing AbortErrors without ever reaching `createTimeoutError`. T3.2's delegation bug was a maintainability risk: if T2.2's notes described a deficient implementation, T3.2 would silently propagate the deficiency. The createTimeoutError arity mismatch was documentation hygiene.
- **Alternative rejected:** Adding a fifth test file (codexStrategy-timeout.test.ts) instead of extending T4.2 — adding to T4.2 keeps all fake-timer tests co-located in one file and avoids a wave-ordering problem (the codexStrategy seam depends on T4.1 completing, same as the rest of T4.2).

- **[Auto-fix]:** Phase 2 review iter 1: 1 MEDIUM finding (F-001, stack-reviewer) — `Promise.race` widened `rawCalibratedDirtyRead`'s public return type from `Promise<ICommandResult>` to `Promise<unknown>`. Fixed by annotating both timeout-reject promises as `new Promise<never>(...)` (lines 74 and 107). Typecheck verified exit 0 post-fix.
- **Why:** Silent public-API type regression would violate CLAUDE.md's strict-semver discipline in v2.1.0 (a MINOR bump). Direct consumers of `rawCalibratedDirtyRead` would lose `ICommandResult` typing.
- **Alternative rejected:** Adding an explicit `Promise<ICommandResult>` return-type annotation to the function — works but is less idiomatic than typing the never-resolving rejection-only promise as `Promise<never>`.

- **[Optimistic-continuation]:** Phase 3 review iter 1: 3 of 4 agents CLEAN; 1 over-scope MEDIUM (OS-001) — `tests/failover-client.test.ts` adds 18 it-blocks despite Phase 3's "no new tests" lock. Accepted as beneficial deviation: tests cover REQ-01 dedup contract + REQ-09 precedence + REQ-10 timeout via factory; Phase 4 implementers will design `tests/timeouts.test.ts` and `tests/failover-submit.test.ts` to avoid duplication. New baseline: 363 tests pass instead of 346.
- **Why:** The 18 tests provide genuine coverage of locked invariants from this phase's acceptance criteria. Reverting them would lose useful regression coverage; reorganizing them to Phase 4 would be churn for no gain.
- **Alternative rejected:** Removing the test file — would lose coverage already proven and locked.

- **[Auto-fix]:** Final implementation review iter 1: 5 audit-bug-detector findings (F-BUG-001/002/003/004 HIGH + F-BUG-005 MED) and 2 over-scope MEDIUM findings (OS-001/002) from full-spec plan-compliance review. Fixed 3 of 5 audit findings: F-BUG-002 (added `expect(getNodeGasLimit("custom")).toBe(CHAINWEB_DEFAULT_GAS_LIMIT)` to resetNodeFailover test for true 5-slot coverage); F-BUG-003 (collapsed failover-submit.test.ts 2 it-blocks → 1 to remove order-fragility); F-BUG-004 (added JSDoc warning to codexStrategy.execute about consumer-level TIMEOUT-retry → request-key-mismatch double-spend window). False-positive: F-BUG-005 (spec REQ-02 explicitly authorizes `runWithTimeout` as a public export). Out-of-scope: F-BUG-001 (withFailover concurrency race in pre-existing code from earlier spec — should be filed as a separate audit-spec for the next ship cycle). OS-001 + OS-002 accepted as net-positive coverage deviations. Final test count: 385 tests passing (well above REQ-19's ≥363 minimum). Typecheck clean, build clean, all 20 requirements covered.
- **Why:** F-BUG-002/003/004 fixes are all minimal (1 test assertion + 1 test collapse + 1 JSDoc block); they tighten the dedup-contract surface without touching production logic. F-BUG-001 is a real bug but in pre-existing code that this spec only exposed; fixing it would change `withFailover` retry semantics broadly (across all callers), exceeding this spec's scope.
- **Alternative rejected:** Fixing F-BUG-001 in this ship — would change pre-existing semantics and add unbounded blast radius (every withFailover call site affected). Better surfaced as a follow-up audit-spec.

## Last Action
- Command: /bee:ship
- Timestamp: 2026-05-01T16:30:00Z
- Result: Ship COMPLETE. 4 phases shipped, all 20 requirements covered, final review found 5 issues (3 fixed, 1 false positive, 1 out-of-scope). 385 tests pass, typecheck/build clean, v2.1.0 in package.json + CHANGELOG.

## Previous Last Action
- Command: /bee:ship
- Timestamp: 2026-05-01T16:00:00Z
- Result: Phase 3 reviewed (1 iteration, 0 fixes needed; over-scope test file accepted) -- shipping clean. Starting Phase 4 execution.

## Previous Last Action
- Command: /bee:plan-all
- Timestamp: 2026-05-01T14:00:00Z
- Result: All 4 phases planned and reviewed. Cross-plan consistency review completed (1 iteration, 4 issues fixed). plan-all COMPLETE.
