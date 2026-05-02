# Phase 4: Documentation Refresh -- Tasks

<!-- Template semantics:
  [ ] / [x]   = task status (crash recovery reads these)
  requirements = which REQ-IDs from requirements.md this task addresses
  acceptance  = what the implementer must deliver (SubagentStop hook validates)
  context     = exact files/notes the implementing agent receives (~30% context window)
  research    = how to implement (citations to requirements.md M2 Phase 4 + existing files)
  notes       = agent output after completion (inter-wave communication channel)
  needs       = task dependencies (Wave 2+ only, defines wave grouping)
-->

## Goal

Refresh two documentation surfaces to current v2.2.0 reality without touching production code. Phase 4 closes F-CORE-018a (REQ-08) and F-CORE-018b (REQ-09) from the M2 LOW tier of the 2026-04-30 audit. The README change is scoped narrowly to the header version table region — Phase 7 owns broader README maintenance (Status block lead version, version history v2.3.0 paragraph, test-count refresh, new submodule row, optional "What's new in v2.3.0" section). The CONTEXT.md change is scoped to the interactions section only and is documented as a snapshot — `/bee:refresh-context` may redo it wholesale later if invoked.

**Coordination note:** Documentation only, zero code risk. NFR-04 (≥3 new tests per substantive phase) does NOT apply to Phase 4 — docs-only phases produce no test count change. Type-regression lock (NFR-02) is unaffected because no `.ts` files are touched, but T4.3's typecheck gate runs as a sanity check.

## Wave 1 (parallel — file-disjoint, both docs-only)

- [x] T4.1 | Refresh README header version table to v2.2.0 reality (REQ-08, F-CORE-018a) | bee-implementer
  - requirements: [REQ-08]
  - acceptance:
    - The README header region currently presents version baselines anchored at v1.3.0 / v1.4.0 followed by inline per-version paragraphs through v2.2.0. The refresh updates this region so the lead/anchor version lines explicitly cite the current shipped version (v2.2.0) rather than the v1.3.0/v1.4.0 baseline.
    - Per-version paragraphs that already exist (v1.4.0, v1.5.0, v1.6.0, v1.6.1, v1.7.0, v2.0.0, v2.0.1, v2.0.2/3/4, v2.1.0, v2.1.2, v2.2.0) are PRESERVED — the refresh does not delete history; it tightens the anchor and ensures the leading version reference is current.
    - At least one cross-reference to `CHANGELOG.md` is present in the refreshed region directing readers to per-version detail rather than restating it inline (the README must not become a CHANGELOG mirror).
    - Markdown links remain valid (relative link to `CHANGELOG.md` resolves; no broken anchors introduced).
    - Region scope: ONLY the header / Status / version-table region above the body. The Status block lead version stays at `2.2.0` for Phase 4 — Phase 7 owns the eventual `2.3.0` lead bump. Body sections (`## Module layout`, migration guide, common commands, etc.) are NOT touched.
    - File `Z:/OuronetCore/README.md` exists post-task and is well-formed Markdown (no orphan list bullets, no truncated tables).
  - context:
    - File to edit: `Z:/OuronetCore/README.md` (header / Status / version-table region — body untouched).
    - Reference: `Z:/OuronetCore/CHANGELOG.md` (existing per-version entries — the refreshed README points readers HERE for detail).
    - Reference: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` lines 74-77 (REQ-08 wording — "refreshed from the v1.3.0/1.4.0 baseline to current v2.2.0 reality").
    - Reference: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/spec.md` lines 36-37 (M2 Phase 4 scope statement — "header version table is refreshed... cross-references the changelog for per-version detail rather than restating it").
  - research:
    - Pattern: [CITED] `Z:/OuronetCore/README.md:1-120` — current header layout has `## Status` block leading with `**`2.2.0` on public npmjs**` followed by per-version paragraphs anchored on bold version labels (`**v1.4.0** —`, `**v1.5.0** —`, …, `**v2.2.0** —`). The "v1.3.0 / v1.4.0 baseline" called out in REQ-08 refers to the legacy text near the DALOS-integration paragraph (line 27: "Since **v1.3.0**, OuronetCore integrates...") which still anchors as if v1.3.0/v1.4.0 are recent — that anchor is what needs to be reframed against the current v2.2.0 reality.
    - Reuse: [CITED] `Z:/OuronetCore/CHANGELOG.md` already carries per-version detail through v2.2.0. The refresh adds an explicit pointer ("See [`CHANGELOG.md`](CHANGELOG.md) for the full per-version detail") near the version-table anchor, not a restatement.
    - Approach: [CITED requirements.md:121] Tighten the leading anchor (the "Since **v1.3.0**" framing or equivalent baseline language) so the reader understands the current shipping version is v2.2.0 with full history available in CHANGELOG; preserve the per-version paragraphs as compact deltas. Phase 7 will perform the full Status-block lead bump to `2.3.0` and the post-release maintenance-rule pass — Phase 4 is a baseline-anchor correction, not a Status-block rewrite.
    - Approach: [ASSUMED] The exact phrasing of the refreshed anchor is at the implementer's discretion provided the acceptance criteria are met (current version cited, history preserved, CHANGELOG cross-referenced). The audit-spec source did not lock specific anchor text.
  - notes:

- [x] T4.2 | Refresh `.bee/CONTEXT.md` interactions section to cover v1.4 / v1.5 / v1.6 additions (REQ-09, F-CORE-018b) | bee-implementer
  - requirements: [REQ-09]
  - acceptance:
    - The interactions-related coverage in `.bee/CONTEXT.md` describes the v1.4 addition: `AccountSelectorData` gained the `public-key`, `sovereign`, and `governor` fields for Smart Ouronet Account display.
    - The interactions-related coverage describes the v1.5 addition: `Leto` / `Artemis` / `Apollo` re-exports through the `./dalos` subpath, the `createGen1Primitive` factory, and the `AddressPrefixPair` type.
    - The interactions-related coverage describes the v1.6 addition: Smart Ouronet Account auth-path resolution primitives (`classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths`) AND the `buildRotateSovereignPactCode` builder.
    - A snapshot/coordination note is present in the file — either inline at the section header or as a short footer comment — stating that this section is a snapshot and may be redone wholesale by `/bee:refresh-context` if invoked after subsequent code changes.
    - Region scope: ONLY the interactions / architecture coverage relevant to v1.4-v1.6 surface. The existing CONTEXT.md sections (Stack, Architecture, Conventions, Concerns) remain readable and cohesive. The "## Architecture" section is the natural insertion point for the auth-path primitives bullet; the v1.4 `AccountSelectorData` addition fits the conventions/architecture surface; v1.5 DALOS re-exports fit the architecture surface (already references `createDefaultRegistry()`).
    - File `Z:/OuronetCore/.bee/CONTEXT.md` exists post-task and is well-formed Markdown.
  - context:
    - File to edit: `Z:/OuronetCore/.bee/CONTEXT.md` (interactions-relevant coverage — currently 33 lines covering Stack / Architecture / Conventions / Concerns).
    - Reference: `Z:/OuronetCore/README.md:34-48` (already documents the v1.4 / v1.5 / v1.6 additions in user-facing prose — CONTEXT.md should mirror the SAME factual content in agent-facing summary form).
    - Reference: `Z:/OuronetCore/src/guard/smartAccountAuth.ts` (source of truth for auth-path primitives — for citation paths only; do NOT inline code).
    - Reference: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` lines 75-77 (REQ-09 wording — explicit list of fields/exports to cover).
    - Reference: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/spec.md` line 38 (M2 Phase 4 scope statement — "this section may be redone wholesale by the `/bee:refresh-context` command... the manual refresh in this phase is acceptable as a snapshot").
  - research:
    - Pattern: [CITED] `Z:/OuronetCore/.bee/CONTEXT.md:12-19` — existing `## Architecture` section uses tight bullet form with `path:line` citations and bold-ed concept anchors (e.g., `**Pluggable seams instead of DI**`). The refresh follows the SAME bullet-and-citation pattern, NOT prose paragraphs.
    - Reuse: [CITED] `Z:/OuronetCore/README.md:34-48` carries the canonical v1.4 / v1.5 / v1.6 prose. The CONTEXT.md refresh expresses the same facts in summary bullet form sized for agent injection (~10-30 tokens per bullet).
    - Reuse: [CITED] CONTEXT.md line 16 already mentions Smart Account auth ("**Three-branch Smart Account auth (Σ. prefix)**...`analyzeSmartAccountAuthPaths`...`src/guard/smartAccountAuth.ts`"). The refresh ENHANCES this bullet — the v1.6 primitive list is partially present but the v1.4 `AccountSelectorData` field gain and the v1.5 DALOS re-export details are missing entirely. Treat existing line 16 as a partial baseline; do not duplicate.
    - Reuse: [CITED] CONTEXT.md line 18 already mentions DALOS Genesis-only registry posture and the `Leto`/`Artemis`/`Apollo`/`createGen1Primitive` re-exports through `./dalos`. The v1.5 coverage required by REQ-09 is largely already present here — verify it explicitly cites `createGen1Primitive` factory AND `AddressPrefixPair` type; if `AddressPrefixPair` is missing, add it.
    - Approach: [CITED requirements.md:122] The implementer's task is a delta refresh — identify which of the three version surfaces (v1.4 fields, v1.5 re-exports/types, v1.6 primitives + builder) are missing or incomplete in CONTEXT.md, and fill them with the same bullet-and-citation pattern. Add the snapshot/coordination note ("this section may be redone wholesale by `/bee:refresh-context`") inline near the affected bullets or as a section footer comment.
    - Approach: [ASSUMED] The exact placement of the snapshot note is at the implementer's discretion (header banner, inline parenthetical, or footer block-quote) provided it is visible to a future reader of CONTEXT.md.
  - notes:

## Wave 2 (verification gate)

- [x] T4.3 | Verification gate — typecheck sanity, grep-confirm version-table content, scoped manual review of CONTEXT.md interactions section | bee-implementer | needs: T4.1, T4.2
  - requirements: [REQ-08, REQ-09]
  - acceptance:
    - `npm run typecheck` exits zero (sanity check — no `.ts` files were modified, but the gate confirms the docs-only phase did not accidentally introduce a TypeScript breakage via stray edits or encoding issues).
    - `grep -nE "v2\.2\.0|2\.2\.0" Z:/OuronetCore/README.md` returns at least one hit in the header region (post-T4.1 the version anchor MUST cite v2.2.0 — verifies REQ-08 surface).
    - `grep -nE "CHANGELOG\.md" Z:/OuronetCore/README.md` returns at least one hit in the header region (verifies the cross-reference per REQ-08).
    - `grep -nE "AccountSelectorData|createGen1Primitive|AddressPrefixPair|analyzeSmartAccountAuthPaths|buildRotateSovereignPactCode" Z:/OuronetCore/.bee/CONTEXT.md` returns at least 4 distinct hits across the listed terms (verifies REQ-09 coverage of v1.4 / v1.5 / v1.6 surface).
    - `grep -nE "refresh-context|snapshot" Z:/OuronetCore/.bee/CONTEXT.md` returns at least one hit (verifies the coordination/snapshot note required by spec.md:38).
    - Manual scoped review confirms: README header version-table region reads coherently and points to CHANGELOG for detail; CONTEXT.md interactions/architecture coverage flows naturally and the snapshot note is visible.
    - NO new test files added (NFR-04 explicitly does not apply to docs-only phases — test count change is zero by design).
    - NO production source files (`src/**/*.ts`) modified by Phase 4. `git status` (or equivalent diff inspection) shows changes only in `Z:/OuronetCore/README.md` and `Z:/OuronetCore/.bee/CONTEXT.md`.
  - context:
    - File to inspect (read-only): `Z:/OuronetCore/README.md` (post T4.1).
    - File to inspect (read-only): `Z:/OuronetCore/.bee/CONTEXT.md` (post T4.2).
    - Notes from T4.1 and T4.2 (inter-wave channel — describes what was changed and any deviations from acceptance criteria).
    - Reference: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/requirements.md` REQ-08 + REQ-09 acceptance lines.
    - Reference: `Z:/OuronetCore/.bee/specs/2026-05-02-medium-and-low-audit-closures/spec.md` lines 36-38 (M2 Phase 4 scope).
  - research:
    - Pattern: [CITED] Phase verification gates in this spec follow the pattern "typecheck + targeted grep + manual scoped review" (see Phase 1 verification at requirements.md:148 — `grep -r "function safeCreationTime" src/` expects exactly one hit). T4.3 mirrors this pattern with grep targets specific to documentation surface rather than source surface.
    - Reuse: [CITED] `npm run typecheck` is the standard sanity check across all phase boundaries (NFR-02 type-regression lock). Even though Phase 4 touches zero `.ts` files, running typecheck confirms no incidental damage.
    - Approach: [CITED requirements.md:121-122] Verification reads from disk only — the verifier does NOT re-edit the documents. Failures of any acceptance line escalate to a fixer pass on T4.1 or T4.2 as appropriate.
    - Approach: [ASSUMED] On Windows + bash, `grep` is available via Git for Windows / MSYS2 shell. If `grep` is not on PATH for any reason, the implementer may substitute equivalent ripgrep (`rg`) or PowerShell `Select-String` invocations — the assertion contract is on the substring presence, not on a specific tool.
  - notes:

## Wave Dependency Chain

```
Wave 1 (parallel, file-disjoint):
  T4.1 (README header)  ──┐
                          ├──► Wave 2: T4.3 (verification gate)
  T4.2 (CONTEXT.md)     ──┘
```

**File ownership matrix (zero conflicts within Wave 1):**

| Task | Files Modified |
|------|----------------|
| T4.1 | `Z:/OuronetCore/README.md` |
| T4.2 | `Z:/OuronetCore/.bee/CONTEXT.md` |
| T4.3 | None (read-only verification) |

T4.1 and T4.2 touch disjoint files and have no symbol-level dependencies on each other — they parallelize cleanly. T4.3 has a hard dependency on both Wave 1 outputs because it asserts post-state on both files.

## Fragmentation Note

Phase 4 produces 3 tasks across 2 waves. Average = 1.5 tasks/wave, which is below the 2.5 tasks/wave consolidation target and triggers `fragmentation: warn`. The fragmentation is **unavoidable and structurally justified**:

- Wave 1 has 2 tasks (T4.1 + T4.2) which is the maximum natural parallelism — only two documentation files are in scope for the entire phase per the LOCKED Phase 4 scope (README header version-table region + CONTEXT.md interactions section). There is no third docs-only task that could join Wave 1 without expanding scope into Phase 7's territory.
- Wave 2 has 1 task (T4.3) which is a genuine sequential dependency: the verification gate must read the post-state of both T4.1 and T4.2, so it cannot start until Wave 1 completes. T4.3 cannot be merged into Wave 1 without violating the dependency contract (it would attempt to verify files that have not yet been written).

The single-task Wave 2 is therefore a legitimate sequential gate, not orchestration overhead. This matches the audit-driven nature of the phase: docs-only, two surfaces, one verifier.
