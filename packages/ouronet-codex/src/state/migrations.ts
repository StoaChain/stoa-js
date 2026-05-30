/**
 * Schema migration framework for the codex snapshot.
 *
 * Phase 1 (v0.3.0) ships the framework only: an empty registry plus the pure
 * `applyMigrations` runner and the `canConsumerWrite` boundary helper. The
 * real v0.2 -> v0.3 migration entry is added later — until then the runner is
 * a no-op for already-current codices.
 *
 * The runner is pure (no I/O, no side effects). Persistence + state wiring
 * lives in the store's `init()` / `migrateToCurrent()` actions, which call
 * this module and then save the result through the adapter.
 */

import type { CodexSnapshot } from "../adapters/types.js";
import { CodexMigrationError } from "../errors/index.js";

export interface SchemaMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  /** Pure function — no I/O, no side effects. MUST set the output snapshot's
   *  `schemaVersion` to its own `toVersion` (the runner enforces this as a
   *  post-condition). */
  migrate: (snapshot: CodexSnapshot) => CodexSnapshot;
}

/** Current schema version this package writes. v0.3 writes 2. Bumped per
 *  migration. */
export const CURRENT_SCHEMA_VERSION = 2 as const;

/** Registry of all schema migrations, applied in chain order on load when the
 *  stored codex is older than CURRENT_SCHEMA_VERSION. Never delete past
 *  entries — old codices still need them. Empty until the v0.2 -> v0.3
 *  migration lands. */
export const SCHEMA_MIGRATIONS: SchemaMigration[] = [];

/** Returns true if this package version can safely WRITE a codex loaded at the
 *  given schema version. False when the loaded codex is at a NEWER schema —
 *  writing could silently drop fields this package doesn't understand. */
export function canConsumerWrite(loadedSchemaVersion: number): boolean {
  return loadedSchemaVersion <= CURRENT_SCHEMA_VERSION;
}

/**
 * Pure migration runner. Upgrades `snapshot` toward `targetVersion` by walking
 * the migration chain with a rolling cursor.
 *
 * Semantics:
 *   - If `snapshot.schemaVersion === targetVersion`: returns it unchanged.
 *   - If `snapshot.schemaVersion > targetVersion`: throws
 *     `unknown-schema-version` (this consumer is too old to read the codex).
 *   - Otherwise walks migrations whose `fromVersion === current` (strict, NOT
 *     `>=`), advancing `current = toVersion` after each step, until it reaches
 *     `targetVersion` or finds no applicable next migration (a chain gap — the
 *     snapshot is returned at the highest version reached).
 *
 * Validates the supplied registry on entry: a reversed entry
 * (`fromVersion >= toVersion`) or a duplicate `fromVersion` throws
 * `post-condition-failed`. A migration that throws is wrapped in
 * `migration-failed` (cause = original). A migration whose output schemaVersion
 * doesn't equal its declared `toVersion` throws `post-condition-failed`.
 */
export function applyMigrations(
  snapshot: CodexSnapshot,
  migrations: SchemaMigration[],
  targetVersion: number
): CodexSnapshot {
  if (snapshot.schemaVersion === targetVersion) {
    return snapshot;
  }
  if (snapshot.schemaVersion > targetVersion) {
    throw new CodexMigrationError(
      "unknown-schema-version",
      `loaded=${snapshot.schemaVersion}, max=${targetVersion}`
    );
  }

  validateRegistry(migrations);

  const sorted = [...migrations].sort((a, b) => a.fromVersion - b.fromVersion);

  let result = snapshot;
  let current = snapshot.schemaVersion;

  while (current < targetVersion) {
    const next = sorted.find((m) => m.fromVersion === current);
    if (!next) {
      // Chain gap: no migration starts at the current version. Leave the
      // snapshot at the highest version reached; the caller decides whether
      // that is acceptable for its target.
      break;
    }

    let migrated: CodexSnapshot;
    try {
      migrated = next.migrate(result);
    } catch (cause) {
      throw new CodexMigrationError(
        "migration-failed",
        next.description,
        cause
      );
    }

    if (migrated.schemaVersion !== next.toVersion) {
      throw new CodexMigrationError(
        "post-condition-failed",
        `migration "${next.description}" expected schemaVersion=${next.toVersion}, got ${migrated.schemaVersion}`
      );
    }

    result = migrated;
    current = next.toVersion;
  }

  return result;
}

function validateRegistry(migrations: SchemaMigration[]): void {
  const seenFrom = new Set<number>();
  for (const m of migrations) {
    if (m.fromVersion >= m.toVersion) {
      throw new CodexMigrationError(
        "post-condition-failed",
        `malformed migration "${m.description}": fromVersion=${m.fromVersion} must be < toVersion=${m.toVersion}`
      );
    }
    if (seenFrom.has(m.fromVersion)) {
      throw new CodexMigrationError(
        "post-condition-failed",
        `duplicate migration fromVersion=${m.fromVersion}`
      );
    }
    seenFrom.add(m.fromVersion);
  }
}
