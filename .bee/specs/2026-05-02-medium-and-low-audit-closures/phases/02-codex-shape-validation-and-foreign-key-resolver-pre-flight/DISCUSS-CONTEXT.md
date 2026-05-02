# Phase 2: Codex shape validation + foreign-key resolver pre-flight - Discussion Context

**Generated:** 2026-05-02T20:30:00Z
**Mode:** Locked decisions inherited from spec/requirements/TASKS.md — auto-skipped discuss

<decisions>
- F-CORE-013 (REQ-02): runtime shape validation in `deserializeCodex` — 4-field check (kadenaWallets/ouronetWallets/addressBook arrays + uiSettings object); domain-prefixed errors that NAME the bad field but do NOT echo its value (no info disclosure); forward-compat preserved.
- F-CORE-014 (REQ-03): Option B pre-flight in CodexSigningStrategy.execute — walks guards, checks `!codexPubs.has(pub) && !(pub in resolvedForeignKeys)`, throws `[CodexSigningStrategy] requestForeignKey not configured (need <8-char-prefix>...)`.
- F-CORE-014 JSDoc: KeyResolver.requestForeignKey contract clarification (3 points: optional-in-interface, required-at-execute-time-when-needed, implement-and-throw OR omit).
- T2.4 deletes `tests/strategy.test.ts:378-418` (chain-level rejection test now unreachable through execute() under pre-flight).
- ≥8 new test cases (NFR-04 floor 3 — overshoots).
</decisions>
