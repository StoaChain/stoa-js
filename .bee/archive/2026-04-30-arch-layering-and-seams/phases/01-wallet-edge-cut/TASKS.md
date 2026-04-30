# Phase 1: Wallet edge cut -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = which REQ-IDs from ROADMAP.md this task addresses
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (from researcher agent, prevents pattern hallucination)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

Drop the `wallet -> interactions` backwards layering edge by introducing a `BalanceResolver` injection seam on the runtime `KadenaWallet` account object. After this phase, importing `@stoachain/ouronet-core/wallet` no longer transitively pulls in `@kadena/client` or the interactions tree, and consumers wire their own balance resolver via constructor or post-construction assignment. The default resolver throws a clearly-worded error so silent fallback to a fabricated "0" cannot happen.

Locked decisions:
- Option B (resolver injection). NOT Option A (remove `getBalance`) or Option C (extract to `network/balance`).
- Resolver lives as a publicly mutable instance property `balanceResolver: BalanceResolver` on `KadenaWallet`, constructor-injected OR post-construction-assignable.
- Default resolver throws `Error("KadenaWallet: balanceResolver not configured. Inject one via the constructor or set wallet.balanceResolver before calling getBalance().")`.
- `KadenaWallet.getBalance()` propagates resolver errors. NO silent "0" fallback.
- `interactions/kadenaFunctions.getBalance` keeps its export; only the wallet-side import goes away.
- `KadenaWalletBuilder` propagates the optional `balanceResolver` argument **if** a code path in the builder constructs a `KadenaWallet`. Implementer must inspect — current builder is static-only and returns keypair tuples, so this may be a documentation-only acceptance.

## Wave 1 (parallel -- no dependencies)

- [x] T1.1 | Define and publish the `BalanceResolver` type contract on the wallet subpath | bee-implementer
  - requirements: [REQ-02]
  - acceptance:
    - A `BalanceResolver` type alias is exported from the wallet subpath's public surface (`@stoachain/ouronet-core/wallet`).
    - The type is `(address: string) => Promise<string>` -- a single asynchronous function from a Kadena account address to a decimal balance string.
    - JSDoc on the type documents: (a) the return contract that absent accounts resolve to the literal string `"0"`; (b) that the resolver is the consumer-side seam that replaces the previous wallet -> interactions import; (c) a one-line example showing how a consumer wires one (constructor or `wallet.balanceResolver = fn`).
    - The wallet barrel (`src/wallet/index.ts`) re-exports the new type so `import { BalanceResolver } from "@stoachain/ouronet-core/wallet"` resolves.
    - `npm run typecheck` passes.
  - context:
    - Spec section: `.bee/specs/2026-04-30-arch-layering-and-seams/spec.md` -- REQ-02 (wallet edge cut block).
    - `D:\_Claude\OuronetCore\src\wallet\types.ts` -- existing type-only file; current home of `SeedType`. Append `BalanceResolver` here; barrel edit not required because `src/wallet/index.ts:8` already does `export * from "./types"`.
    - `D:\_Claude\OuronetCore\src\wallet\index.ts` -- barrel; verify the new type lands on the public surface without a barrel edit (read-only reference).
    - `D:\_Claude\OuronetCore\src\signing\types.ts` -- exemplar for narrow consumer-side resolver interfaces (`KeyResolver` shape at lines 46-70, JSDoc style at lines 32-45). Mirror the "consumers implement this against whatever storage backs their X" voice.
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- exemplar of single-function injection seam type alias (`PactReader` at lines 33-42); reuse the "narrow, deliberate injection seam — NOT a full DI framework" framing from line 21.
  - research:
    - Pattern: [CITED] `src/wallet/types.ts:1-23` is the existing home — file currently exports only `SeedType` with a top-level JSDoc framing it as "Shared wallet types — consumed by ... the eventual PlaintextCodex codec (Phase 4)". Append `BalanceResolver` here; barrel edit not required because `src/wallet/index.ts:8` already does `export * from "./types"`.
    - Pattern: [CITED] `src/signing/types.ts:46-70` (`KeyResolver` interface) is the exemplar for "consumer-side resolver" framing — note the comment style at lines 32-45 ("'Give me keys' abstraction. Consumers implement this against whatever storage backs their Codex"). Mirror that voice for `BalanceResolver`.
    - Pattern: [CITED] `src/reads/pactReader.ts:33-42` (`PactReader` type alias) is the closest shape match — single-function resolver type alias, JSDoc explains "this is a narrow, deliberate injection seam — NOT a full DI framework" (line 21). For `BalanceResolver` reuse this "narrow seam" framing.
    - Reuse: [CITED] No reusable type to extend — `BalanceItem` at `src/interactions/kadenaFunctions.ts:4-7` (`{ account: string; balance: string }`) is the upstream raw shape, but per the locked decision the resolver returns just the decimal string, not the wrapped object. Caller flattens.
    - Types: [CITED] Existing barrel `src/wallet/index.ts:1-17` — `export * from "./types"` (line 8) is the only edit-free path. Confirm new type lives in `types.ts`, not a new file.
    - Approach: [LOCKED] Type signature is `(address: string) => Promise<string>` per the spec's locked decisions. JSDoc must document (a) absent-account → `"0"`, (b) replaces the wallet→interactions import edge, (c) include a `wallet.balanceResolver = fn` example.
    - Context7: skip — TypeScript stdlib type alias declaration is unambiguous and not version-sensitive.

  - notes:
    - T1.1 OK | files: src/wallet/types.ts | tests: 0/0 type-only, typecheck exit 0 | blocker: none
    - File modified: `src/wallet/types.ts` — added `BalanceResolver` type alias (lines 24-51) with JSDoc covering (a) `"0"` sentinel for absent accounts, (b) explicit mention that it replaces the previous wallet → interactions import (the word "interactions" appears in JSDoc — INTENTIONAL per spec; T2.7's import-graph-only grep will not flag JSDoc), and (c) one-line wiring example.
    - Type alias signature: `export type BalanceResolver = (address: string) => Promise<string>;` (function-shape, mirrors PactReader exemplar; NOT an interface).
    - Confirmed `src/wallet/index.ts:8` (`export * from "./types"`) auto-re-exports `BalanceResolver`.
    - TDD skipped: type-only change, no runtime branching. Validation = `tsc --noEmit` exit 0.

## Wave 2 (depends on Wave 1)

- [x] T1.2 | Refactor `KadenaWallet` to drop the interactions import and delegate `getBalance()` to the injected resolver | bee-implementer | needs: T1.1
  - requirements: [REQ-01, REQ-03, REQ-04]
  - acceptance:
    - The `import { getBalance } from "../interactions/kadenaFunctions"` line at `src/wallet/KadenaWallet.ts` is removed. Running `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` returns zero hits — broadened pattern catches static `from "..."`, dynamic `import("...")`, AND bare side-effect `import "..."` forms.
    - `KadenaWallet` exposes a publicly mutable instance property `balanceResolver: BalanceResolver` typed against the contract from T1.1. **Field position locked:** `balanceResolver` is appended at the end of the constructor's options-object type literal, after `derivationPath`, preserving the existing semantic ordering (identity → key material → derivation path → seam).
    - The constructor accepts an optional `balanceResolver?: BalanceResolver` parameter. When provided, the property is initialised to that value. When omitted, the property is initialised to a default function that throws `Error("KadenaWallet: balanceResolver not configured. Inject one via the constructor or set wallet.balanceResolver before calling getBalance().")` -- exact error text required.
    - **Deviation from `setPactReader` exemplar (intentional, locked by REQ-03):** the default is a throwing stub, not a working fallback. `setPactReader` defaults to a working raw read because HUB needs zero-config behaviour; `balanceResolver` defaults to throw because no library-side default exists that wouldn't reintroduce the wallet→interactions edge being cut by this phase.
    - The default function does NOT throw at construction time; it only throws when invoked. Consumers can construct a wallet without a resolver and only see the error when `getBalance()` is called.
    - `KadenaWallet.getBalance()` retains its `Promise<string>` signature. Body invokes `this.balanceResolver(this.address)`, assigns the result to `this.balance`, and returns `this.balance`. When the resolver rejects or throws synchronously, the error propagates to the caller -- the method MUST NOT catch it and MUST NOT fall back to `"0"`.
    - The class JSDoc is updated to reflect the new injection-seam reality (no longer "hits the chain via interactions/kadenaFunctions.getBalance"; instead "delegates to an injected `balanceResolver`, defaulting to a throwing stub when not configured"). JSDoc on the `balanceResolver` property documents the race-semantics contract: in-flight `getBalance()` calls capture the resolver at invocation time; swapping the resolver does NOT cancel pending fetches; the last resolution to settle determines the final value of `this.balance` (last-write-wins, same as the pre-state semantics).
    - Behavioral tests for the four contract paths land in `tests/wallet.test.ts` and pass:
      - default-throw: constructing with no resolver and calling `getBalance()` rejects with the exact error message.
      - constructor-injected: a stub resolver passed via the constructor is called with `wallet.address`, its return value is stored in `wallet.balance`, and is returned.
      - post-construction assignment: assigning `wallet.balanceResolver = stub` after construction makes a subsequent `getBalance()` call delegate to that stub.
      - error propagation: a resolver that rejects (and one that throws synchronously) surfaces the error to the `getBalance()` caller -- no swallow, no `"0"` fallback.
    - Each test follows the watch-it-fail TDD cycle: implementer pastes the failing-test output before implementing, then the passing-test output after.
    - `npm run typecheck` and `npm test` pass.
  - context:
    - Spec section: `.bee/specs/2026-04-30-arch-layering-and-seams/spec.md` -- REQ-01, REQ-03, REQ-04 (wallet edge cut block).
    - Dependency notes: T1.1 publishes `BalanceResolver` in `src/wallet/types.ts`. Read T1.1's `notes:` block in this TASKS.md before starting to confirm the exact exported name and signature.
    - `D:\_Claude\OuronetCore\src\wallet\KadenaWallet.ts` -- pre-state file; line 14 holds the offending edge `import { getBalance } from "../interactions/kadenaFunctions";`. Lines 47-52 are the `getBalance()` body to refactor. Constructor at lines 25-37 widens with the optional argument. Class fields at lines 17-23 gain a `public balanceResolver: BalanceResolver` declaration.
    - `D:\_Claude\OuronetCore\src\wallet\types.ts` -- new `BalanceResolver` type lives here after T1.1; this task `import type`s it.
    - `D:\_Claude\OuronetCore\src\reads\pactReader.ts` -- seam-pattern exemplar (single-function resolver, default-with-fallback). The JSDoc tone of `setPactReader` / `getPactReader` translates well; differs in that T1.2 lives on the instance, not module-level, and the default throws rather than working.
    - `D:\_Claude\OuronetCore\src\signing\types.ts` -- line 60's `MUST throw if the pubkey is unknown` is the canonical "throwing stub" voice; reuse the `MUST` phrasing in the default-resolver's JSDoc.
    - `D:\_Claude\OuronetCore\tests\network.test.ts`, `D:\_Claude\OuronetCore\tests\strategy.test.ts`, `D:\_Claude\OuronetCore\tests\smart-account-auth.test.ts` -- vitest convention reference for the new wallet test file (top-level `tests/`, `describe`/`it`, async assertions on Promise rejections via `await expect(p).rejects.toThrow(msg)`).
  - research:
    - Pattern: [CITED] `src/wallet/KadenaWallet.ts:14` is the offending edge: `import { getBalance } from "../interactions/kadenaFunctions";` — delete this line. Replace with `import type { BalanceResolver } from "./types";` (type-only so emit stays clean).
    - Pattern: [CITED] Current `getBalance()` body verbatim at `src/wallet/KadenaWallet.ts:47-52`:
      ```
      /** Fetch the current balance from chain and update this.balance. */
      async getBalance(): Promise<string> {
        const balance = await getBalance(this.address);
        this.balance = balance.balance ?? "0";
        return this.balance;
      }
      ```
      Note the `?? "0"` swallow — the locked spec forbids this fallback in the new body. Per locked decision the new body must propagate errors and assign the resolver's raw return.
    - Pattern: [CITED] Current constructor signature at `src/wallet/KadenaWallet.ts:25-37` takes a single options-object arg with `parentId / index / secret / publicKey / derivationPath`. T1.2 widens it with optional `balanceResolver?: BalanceResolver`. Class fields declared at lines 17-23 — add `public balanceResolver: BalanceResolver` to that block.
    - Pattern: [CITED] `src/reads/pactReader.ts:44` (`let _reader: PactReader = rawCalibratedDirtyRead;`) shows the "module-level mutable with a default" pattern. T1.2 differs: state lives on the **instance**, not module-level, and the default is a throwing stub, not a working fallback. Same JSDoc tone applies — see line 21: "narrow, deliberate injection seam — NOT a full DI framework".
    - Pattern: [CITED] `src/signing/types.ts:60` (`MUST throw if the pubkey is unknown to this resolver`) is the canonical "throwing stub" voice — re-use the `MUST` phrasing in the default-resolver's JSDoc so the contract reads consistently across the two seams.
    - Reuse: [CITED] No code reuse across the seam — `interactions/kadenaFunctions.getBalance` (`src/interactions/kadenaFunctions.ts:9-27`) stays exactly as-is for other consumers (REQ-05). The wallet just stops importing it.
    - Types: [CITED] `BalanceResolver` from `src/wallet/types.ts` (defined in T1.1) — type-only import keeps the wallet barrel free of any value-position dependency on interactions.
    - Approach: [LOCKED] Exact error string per spec: `"KadenaWallet: balanceResolver not configured. Inject one via the constructor or set wallet.balanceResolver before calling getBalance()."`. Default initializer must be a function that throws when CALLED (lazy), not at construction.
    - Approach: [CITED] Test file: `tests/wallet.test.ts` does NOT exist yet. Project convention is `tests/{kebab-name}.test.ts` at top level — see `tests/smart-account-auth.test.ts:16-21`, `tests/network.test.ts:8-22` for vitest import + `describe`/`it` style. Use `await expect(promise).rejects.toThrow(exactMessage)` for default-throw; use a vi.fn() stub for constructor-injected and post-construction paths. Async error propagation (rejecting promise + sync throw inside async fn) both surface via `rejects` matcher.
    - Context7: skip — vitest async rejection matchers are stable and codebase examples are sufficient.
  - notes:
    - T1.2 OK | files: src/wallet/KadenaWallet.ts, tests/wallet.test.ts | tests: 8/8 | blocker: none
    - Files modified: `src/wallet/KadenaWallet.ts` (refactor — dropped `from "../interactions/kadenaFunctions"` import; added `import type { BalanceResolver } from "./types"`; added publicly mutable `balanceResolver: BalanceResolver` instance property; constructor accepts optional `balanceResolver?` appended after `derivationPath`; default initialiser is module-level `throwingDefaultResolver` that throws lazily on call; `getBalance()` body assigns `await this.balanceResolver(this.address)` to `this.balance` — NO `?? "0"` swallow; class JSDoc + property JSDoc updated with race-semantics last-write-wins note) + new `tests/wallet.test.ts` (8 it-blocks covering the 4 contract paths plus construction sanity check).
    - TDD evidence:
      - RED phase: 7 of 8 tests failed before implementation. Sample failures: `default-throw rejects with exact locked error string` → `AssertionError: promise resolved "'0'" instead of rejecting`; `constructor-injected` → `expected vi.fn() to be called 1 times, but got 0`; `error propagation surfaces async rejection` → `promise resolved "'0'" instead of rejecting`.
      - GREEN phase: `Tests 8 passed (8)` after implementation. Type Errors none. Duration 573 ms.
    - Grep evidence: `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` → exit 1 (zero matches). Broadened pattern catches static / dynamic / side-effect import forms.
    - Verification: `npm run typecheck` exit 0; `npm test` 15 files, 330 tests passed, 0 failures (was 322 baseline; +8 new wallet tests).

## Wave 3 (depends on Wave 2)

- [x] T1.3 | Propagate the optional `balanceResolver` argument through `KadenaWalletBuilder` (or document why no propagation is needed) | bee-implementer | needs: T1.1, T1.2
  - requirements: [REQ-06]
  - acceptance:
    - The implementer inspects `src/wallet/KadenaWalletBuilder.ts` and determines whether any builder method constructs a `KadenaWallet` instance (as opposed to merely returning keypair material).
    - **If a wallet-constructing path exists:** the relevant method's options object accepts an optional `balanceResolver?: BalanceResolver` field, and the method forwards that argument into the `KadenaWallet` constructor. Consumers wiring wallets through the builder can inject their resolver in the same way they would via the direct `KadenaWallet` constructor. Behavioral test: calling the builder method with a stub resolver produces a wallet whose `getBalance()` delegates to the stub (added to `tests/wallet.test.ts` next to T1.2's tests).
    - **If no wallet-constructing path exists** (current builder is static-only with `createWalletPair`, `createWalletPairFromMnemonic`, `encrypt`, `decrypt`, `generateMnemonic`, `isValidMnemonic` -- all returning keypair tuples or primitives, none returning a `KadenaWallet`): the task's notes record this finding with **literal grep evidence** (mirroring T1.4's pattern). Implementer pastes the literal output of: (a) `grep -n "new KadenaWallet" src/wallet/KadenaWalletBuilder.ts` (must show zero matches), (b) `grep -n "import.*KadenaWallet" src/wallet/KadenaWalletBuilder.ts` (must show zero matches), (c) `grep -nE "from\s+['\"]\./KadenaWallet" src/wallet/KadenaWalletBuilder.ts` (must show zero matches). Acceptance is met without code changes; REQ-06 is satisfied vacuously with auditable evidence.
    - In either branch, no NEW transitive import edge from `wallet` to `interactions` is introduced. `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` continues to return zero hits — broadened pattern matches T1.2 / T1.4 acceptance criteria.
    - `npm run typecheck` and `npm test` pass.
  - context:
    - Spec section: `.bee/specs/2026-04-30-arch-layering-and-seams/spec.md` -- REQ-06 (wallet edge cut block).
    - Dependency notes: T1.1 publishes `BalanceResolver`; T1.2 establishes the post-state `KadenaWallet` constructor signature. Read both `notes:` blocks before starting to confirm the constructor-arg shape that any builder propagation would forward to.
    - `D:\_Claude\OuronetCore\src\wallet\KadenaWalletBuilder.ts` -- the file to inspect; current API is static-method-only. Specifically check whether `createWalletPair` / `createWalletPairFromMnemonic` (or any sibling) returns or instantiates a `KadenaWallet`. Per Pass 1 research, all five static methods return keypair tuples or primitives; verify in-place after T1.2's edits land.
    - `D:\_Claude\OuronetCore\src\wallet\KadenaWallet.ts` -- the post-T1.2 constructor signature is the propagation target if any builder path constructs a wallet.
    - `D:\_Claude\OuronetCore\src\wallet\types.ts` -- `BalanceResolver` type from T1.1.
  - research:
    - Pattern: [CITED] `src/wallet/KadenaWalletBuilder.ts:39-148` — the planner's claim is **confirmed**. The class is `class KadenaWalletBuilder { ... }` with FIVE static methods, NONE of which instantiate `KadenaWallet`:
      - `createWalletPair(password, seed, index)` at line 41-48 — returns `kadenaGenKeypairFromSeed(...)` result (a keypair tuple/object from `@kadena/hd-wallet`), NOT a `KadenaWallet`.
      - `createWalletPairFromMnemonic(password, mnemonic, index, seedType)` at line 56-92 — returns `{ publicKey, secretKey }` shape in both branches (line 73-76, line 89), NOT a `KadenaWallet`.
      - `encrypt(password, data)` at line 95-100 — returns `EncryptedString` from `@kadena/hd-wallet`.
      - `decrypt(password, encryptedData)` at line 102-107 — returns `Uint8Array`.
      - `generateMnemonic(length)` at line 110-118 — returns `string`.
      - `isValidMnemonic(mnemonic, seedType?)` at line 125-147 — returns `boolean`.
    - Pattern: [CITED] The class has NO `import` of `./KadenaWallet` (verified by reading `src/wallet/KadenaWalletBuilder.ts:22-37` import block — only `@kadena/hd-wallet`, `@scure/bip39`, `@kadena/hd-wallet/chainweaver`, and `./types` for `SeedType`). REQ-06 is therefore **vacuously satisfied** — there is no builder→KadenaWallet construction call site to propagate through.
    - Reuse: [CITED] Default export pattern: file ends with `export default KadenaWalletBuilder;` at line 150 — same shape as `KadenaWallet.ts:55`. Both are re-exported as named via `src/wallet/index.ts:15-16`.
    - Types: [CITED] No type changes required. `BalanceResolver` from `src/wallet/types.ts` is not referenced because the builder produces no `KadenaWallet` instance.
    - Approach: [LOCKED] Per the spec's locked decisions, this task is documentation-only. Implementer's `notes:` block must paste the literal output of e.g. `grep -n "new KadenaWallet" src/wallet/KadenaWalletBuilder.ts` (zero matches) and `grep -n "import.*KadenaWallet" src/wallet/KadenaWalletBuilder.ts` (zero matches) as the citation that satisfies REQ-06 vacuously.
    - Approach: [ASSUMED] If a future builder method is added that DOES construct a `KadenaWallet`, the propagation pattern would be: accept `balanceResolver?: BalanceResolver` in the options object and forward it as the second arg / property of the `KadenaWallet` constructor's options object. Out of scope for Phase 1 since no such method exists.
  - notes:

- [x] T1.4 | Confirm REQ-05 (interactions barrel still exports `getBalance`) and produce the edge-cut grep evidence | bee-implementer | needs: T1.2
  - requirements: [REQ-01, REQ-05]
  - acceptance:
    - The implementer confirms by inspection that `src/interactions/kadenaFunctions.ts` still exports `getBalance` and that the per-file subpath export `interactions/kadenaFunctions` continues to make it reachable for downstream consumers. No deletion or relocation occurs in this phase.
    - The implementer pastes the literal output of `grep -rE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` (or its ripgrep equivalent) into the task notes. Output must show zero matches. The broadened pattern catches static `from "..."`, dynamic `import("...")`, AND bare side-effect `import "..."` forms — matches T1.2's edge-cut acceptance criterion.
    - The implementer pastes the literal output of a search confirming `getBalance` is still exported from `src/interactions/kadenaFunctions.ts` (e.g. `grep -n "export .*getBalance" src/interactions/kadenaFunctions.ts`).
    - `npm run typecheck` and `npm test` pass on the final state.
  - context:
    - Spec section: `.bee/specs/2026-04-30-arch-layering-and-seams/spec.md` -- REQ-01, REQ-05 (wallet edge cut block).
    - Dependency notes: T1.2 removes the offending wallet→interactions import edge. This task captures the post-state grep evidence; read T1.2's `notes:` block before running greps to confirm the import is gone.
    - `D:\_Claude\OuronetCore\src\interactions\kadenaFunctions.ts` -- file to verify continues to export `getBalance` (line 9) and `accountDescription` (line 29).
    - `D:\_Claude\OuronetCore\src\wallet\` -- directory to grep for residual interactions edges.
    - `D:\_Claude\OuronetCore\package.json` -- `exports` map at lines 60-63; per-file glob `"./interactions/*"` confirms the subpath export is still present.
  - research:
    - Pattern: [CITED] `src/interactions/kadenaFunctions.ts:9-27` — `getBalance` is declared as `export async function getBalance(account: string): Promise<BalanceItem>` and returns `{ account, balance }`. Function body at lines 10-26 builds a Pact `coin.get-balance` tx, dirty-reads, and unwraps `{ decimal: ... }`. Verbatim shape preserved post-phase.
    - Pattern: [CITED] `src/interactions/index.ts:16` — barrel is `export * from "./ouroFunctions";` ONLY. Per the file's header comment (lines 1-15), this barrel intentionally only re-exports `ouroFunctions` because the directory's 13 files share overlapping symbol names. **`getBalance` is NOT reachable from the top-level `./interactions` subpath import.** Consumers must import from the per-file subpath `./interactions/kadenaFunctions`.
    - Reuse: [CITED] `package.json` lines 60-63 declare the per-file glob: `"./interactions/*": { "types": "./dist/interactions/*.d.ts", "import": "./dist/interactions/*.js" }`. So `import { getBalance } from "@stoachain/ouronet-core/interactions/kadenaFunctions"` resolves correctly. This is the export path REQ-05 must preserve.
    - Reuse: [CITED] `src/interactions/kadenaFunctions.ts` exports two functions visible in head: `getBalance` (line 9) and `accountDescription` (line 29). Both stay untouched in this phase.
    - Types: [CITED] `BalanceItem` interface at `src/interactions/kadenaFunctions.ts:4-7` — preserved as-is for any current external caller of `getBalance`.
    - Approach: [LOCKED] No code changes. Task is grep-evidence-only:
      1. `grep -rnE "(from\s+['\"]|import\s*\(\s*['\"]|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` → must return zero matches (post T1.2 state). Broadened pattern catches static `from`, dynamic `import(...)`, and bare side-effect `import "..."` forms.
      2. `grep -n "export .*getBalance" src/interactions/kadenaFunctions.ts` → must show line 9 hit `export async function getBalance(...)`.
      3. `grep -n "interactions/\\*" package.json` (or check exports map manually) → confirms the glob subpath is still wired.
      Paste literal outputs into the task `notes:` block.
  - notes:

- [x] T1.5 | Update CLAUDE.md and CHANGELOG.md to record the new wallet injection seam | bee-implementer | needs: T1.1, T1.2
  - requirements: [REQ-02, REQ-03]
  - acceptance:
    - `CLAUDE.md`'s "Architectural patterns to preserve" section gains an additive third bullet under the existing **Pluggable seams, not DI** subsection naming `BalanceResolver` as a narrow injection seam, with a one-line description of the consumer-side default-throw contract. The CLAUDE.md edit framing aligns with T1.1's chosen exemplar: `BalanceResolver` is the **instance-level analogue of `setPactReader`'s function-shaped seam** (function alias, not interface) — phrase the comparison against `PactReader`, NOT `KeyResolver`/`PactClient` (the latter are interface-shaped). **Do NOT flip the existing "Two narrow injection points" count to "Three"** in this phase — the existing `setPactReader` text is aspirational until F-CORE-006 is closed in Phase 2; restructuring the count now would compound an existing accuracy gap. Append the new bullet additively; the count flip happens in Phase 2 (or later) when full adoption is documented across both seams.
    - `CHANGELOG.md` gains a new entry at the top following the file's existing version-heading convention. The entry documents: (a) the new optional `balanceResolver` constructor argument and instance property on `KadenaWallet`; (b) the default-throw error and its remediation steps for consumers; (c) the wallet -> interactions edge cut (importing the wallet subpath no longer transitively pulls in `@kadena/client`); (d) that this is non-breaking widening of the constructor signature; **(e) Behavioural impact (mildly breaking): the previous `?? "0"` silent fallback in `getBalance()` is removed — error paths now propagate to the caller. Consumers that today rely on `getBalance()` always returning a string must wrap their call sites in try/catch or supply a resolver whose default-on-error returns "0".** Use a `### Behavioural impact (mildly breaking)` subsection mirroring v1.7.0's `### Public API impact` block. Version number is left as a placeholder for the release coordinator -- this phase does NOT bump `package.json`.
    - No code changes outside the two markdown files.
    - `npm run typecheck` and `npm test` pass (no behavioral change from doc edits, but run as a sanity gate).
  - context:
    - Spec section: `.bee/specs/2026-04-30-arch-layering-and-seams/spec.md` -- REQ-02, REQ-03 (wallet edge cut block).
    - Dependency notes: T1.1 publishes `BalanceResolver` (named in CLAUDE.md and CHANGELOG.md); T1.2 establishes the post-state constructor signature, instance property, and exact default-throw error string the changelog describes. Read both `notes:` blocks before drafting prose to ensure exact symbol names and error text match the implemented code.
    - `D:\_Claude\OuronetCore\CLAUDE.md` -- the architectural pattern note lives at lines 43-46 ("**Pluggable seams, not DI.** Two narrow injection points..."); keep the existing "Two narrow injection points" count text and append a third numbered item ADDITIVELY (the count flip is deferred to Phase 2 — see acceptance and research blocks for rationale).
    - `D:\_Claude\OuronetCore\CHANGELOG.md` -- existing entry style at lines 1-50 is the formatting reference; insert new entry directly under line 3 (above the most recent `## 1.7.0 — 2026-04-30` at line 5). Use a bold-summary-first / multi-paragraph-narrative / `### Public API impact` body shape.
    - `D:\_Claude\OuronetCore\src\wallet\KadenaWallet.ts` -- post-T1.2 shape is what the changelog describes (new constructor optional arg, new instance property, exact default-throw error string).
  - research:
    - Pattern: [CITED] `CLAUDE.md:43-46` — the **Pluggable seams, not DI** subsection. Verbatim:
      > **Pluggable seams, not DI.** Two narrow injection points let core stay environment-agnostic without a framework:
      > 1. `setPactReader(fn)` in `src/reads/pactReader.ts` — consumers call once at boot. ...
      > 2. `KeyResolver` + `PactClient` interfaces in `src/signing/types.ts` — consumed by `CodexSigningStrategy`. ...

      T1.5 must append a third numbered item to the existing list (do NOT flip "Two narrow injection points" → "Three" — keep the count text additive until Phase 2's full adoption catches up): `3. \`BalanceResolver\` type in \`src/wallet/types.ts\` — instance-level analogue of \`setPactReader\`'s function-shaped seam (function alias, NOT an interface), applied to \`KadenaWallet.getBalance()\`. Default throws clearly-worded error if not configured; \`getBalance()\` propagates resolver errors. Cuts the previous \`wallet -> interactions\` import edge so the wallet subpath no longer transitively pulls in \`@kadena/client\`.`
    - Pattern: [CITED] `CHANGELOG.md:1-5` — header is `# Changelog\n\nAll notable changes to \`@stoachain/ouronet-core\`.` followed by version sections starting `## X.Y.Z — YYYY-MM-DD` (the most recent is `## 1.7.0 — 2026-04-30` at line 5). Insert the new entry directly under line 3 (above 1.7.0).
    - Pattern: [CITED] CHANGELOG entry style at `CHANGELOG.md:5-50` — bold one-line summary first (line 7: `**Consolidate \`IKadenaKeypair\` to a single canonical declaration.**`), then a multi-paragraph narrative body, then a `### Public API impact` subsection (line 41) with bullet points using `**Type widening (intentional):**` / `**Type tightening (intentional, mildly breaking):**` framing. Mirror this voice.
    - Reuse: [CITED] The post-state `KadenaWallet` shape that the changelog describes is finalized in T1.2 against `src/wallet/KadenaWallet.ts`. Reference the new constructor optional arg, the new instance property, and the exact default-throw error string from the locked decision.
    - Types: [CITED] `BalanceResolver` type alias from `src/wallet/types.ts` (added in T1.1) — name-drop in both files. The `@stoachain/ouronet-core/wallet` subpath is the consumer-visible import target.
    - Approach: [LOCKED] Per spec: do NOT bump `package.json` version in this phase. Use a placeholder header like `## Unreleased` or `## X.Y.Z — YYYY-MM-DD` at the top of `CHANGELOG.md` so the release coordinator fills in the version on tag day. Mention non-breaking widening explicitly so consumers know `npm install` of the new minor is safe.
    - Approach: [ASSUMED] The user-facing remediation steps for the default-throw error should read: "either pass `balanceResolver` to the `KadenaWallet` constructor, or set `wallet.balanceResolver = fn` before calling `wallet.getBalance()`. The browser consumer (OuronetUI) wires `interactions/kadenaFunctions.getBalance`; a server consumer (HUB) wires its own indexer-backed resolver." This mirrors the existing `setPactReader` consumer guidance at `src/reads/pactReader.ts:16-19`.
  - notes:

## Requirement Coverage

| REQ-ID | Description | Tasks |
|--------|-------------|-------|
| REQ-01 | Wallet subpath no longer imports from interactions; broadened-pattern grep `grep -rE "(from\s+['\"]\|import\s*\(\s*['\"]\|^\s*import\s+['\"])[^'\"]*interactions" src/wallet/` returns zero hits (covers static, dynamic, and side-effect imports) | T1.2, T1.4 |
| REQ-02 | `BalanceResolver` contract published as part of the wallet subpath's public types | T1.1, T1.5 |
| REQ-03 | `KadenaWallet` accepts optional `balanceResolver` at construction; default throws clearly-worded error | T1.2, T1.5 |
| REQ-04 | `getBalance()` delegates to the injected resolver and propagates errors | T1.2 |
| REQ-05 | `interactions` package keeps exporting `getBalance` for other consumers | T1.4 |
| REQ-06 | `KadenaWalletBuilder` propagates the optional `balanceResolver` (or vacuously satisfied if no construction path) | T1.3 |

All six requirements scoped to Phase 1 are covered. REQ-15 / REQ-16 (typecheck + test gates) are folded into the per-task acceptance criteria rather than carrying their own tasks; they fire as exit gates per the phases.md description.

## File Ownership Map (planner's conflict-detection record)

| Task | Writes |
|------|--------|
| T1.1 | `src/wallet/types.ts` (append `BalanceResolver` type alias) |
| T1.2 | `src/wallet/KadenaWallet.ts` (refactor) + new `tests/wallet.test.ts` |
| T1.3 | (none — documentation-only; KadenaWalletBuilder vacuously satisfied) |
| T1.4 | (none — grep-evidence-only) |
| T1.5 | `CLAUDE.md`, `CHANGELOG.md` |

Conflicts detected during wave assignment: 0. T1.3 and T1.4 produce notes-only deliverables; T1.5's two markdown files are not touched by any other task in any wave.

## Fragmentation Note

Wave 1 (T1.1 alone) and Wave 2 (T1.2 alone) are 1-task waves and could not be merged into a denser wave. Genuine sequential dependencies prevent consolidation:

- **Wave 1 → Wave 2:** T1.2 imports `BalanceResolver` from T1.1's output. The type must exist on disk before T1.2's `import type { BalanceResolver } from "./types"` will typecheck. No other Phase 1 task is independent enough to share Wave 1.
- **Wave 2 → Wave 3:** T1.4 captures the post-T1.2 grep evidence (the wallet→interactions edge being gone is what it documents). T1.5 describes the post-T1.2 constructor signature and exact default-throw error string. T1.3 inspects whether the post-T1.2 builder paths construct a `KadenaWallet`. All three are downstream of T1.2 by content, not just by ordering convention.

Wave 3 (T1.3, T1.4, T1.5 in parallel) is the only dense wave and is the maximum parallelism the dependency graph permits. Phase 1's small task count (5) combined with the strict T1.1 → T1.2 → {T1.3, T1.4, T1.5} dependency chain makes the 5/3 fragmentation ratio (1.67 avg tasks/wave) unavoidable.
