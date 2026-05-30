/**
 * Typed error classes thrown by codex operations.
 *
 * All extend the base CodexError so consumers can do a catch-all
 * `if (e instanceof CodexError) ...` to distinguish package-thrown errors
 * from arbitrary runtime errors. Each subclass carries structured fields
 * relevant to its specific failure mode so consumers can render specific
 * UX (e.g. "X pure keypairs, Y derived accounts" in CodexKeyMissingError)
 * without parsing strings.
 */

/** Base class for all codex-related errors. */
export class CodexError extends Error {
  public override readonly name: string = "CodexError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    // Maintain prototype chain across transpilation targets (Babel/SWC).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when an operation needs the codex unlocked but the password
 *  cache is empty / expired and the user hasn't re-authenticated. */
export class CodexLockedError extends CodexError {
  public override readonly name = "CodexLockedError";

  constructor(operation: string) {
    super(
      `Codex is locked; operation "${operation}" requires authentication. ` +
        `Call authenticate(password) first.`
    );
  }
}

/** Thrown when `getKeypair(publicKey)` cannot find a matching signing key
 *  in either the pure-keypairs store or any derived kadena account.
 *
 *  Structured fields make this the self-diagnosing error message that
 *  OuronetUI v1.0.9 added — the same wording is generated server-side
 *  here so every consumer gets the same UX. */
export class CodexKeyMissingError extends CodexError {
  public override readonly name = "CodexKeyMissingError";
  public readonly publicKey: string;
  public readonly pureKeypairCount: number;
  public readonly derivedAccountCount: number;

  constructor(
    publicKey: string,
    pureKeypairCount: number,
    derivedAccountCount: number
  ) {
    const shortKey = `${publicKey.slice(0, 8)}…${publicKey.slice(-4)}`;
    super(
      `Signing key ${shortKey} not found in this device's codex ` +
        `(${pureKeypairCount} pure keypair${pureKeypairCount === 1 ? "" : "s"}, ` +
        `${derivedAccountCount} derived account${derivedAccountCount === 1 ? "" : "s"}). ` +
        `If you imported a codex backup, pure keypairs are device-local and ` +
        `do not travel inside the v1.2 codex file — re-import via Google Drive ` +
        `cloud-backup, or re-add the pure keypair on this device.`
    );
    this.publicKey = publicKey;
    this.pureKeypairCount = pureKeypairCount;
    this.derivedAccountCount = derivedAccountCount;
  }
}

/** Thrown when a user attempts to delete the CodexPrime ouro account
 *  (spec §B2). CodexPrime is created automatically on every fresh codex
 *  and is permanent. */
export class CodexPrimeProtectedError extends CodexError {
  public override readonly name = "CodexPrimeProtectedError";
  public readonly ouroAccountId: string;

  constructor(ouroAccountId: string) {
    super(
      `Ouro account ${ouroAccountId} is the CodexPrime account and cannot ` +
        `be deleted. Add another account first if you want it as primary.`
    );
    this.ouroAccountId = ouroAccountId;
  }
}

/** Thrown when a user attempts to delete the Prime Codex Seed — the
 *  IKadenaSeed that kickstarted the codex (spec §B1, v0.2.0+). The
 *  prime seed is structurally tied to the codex's identity; removing it
 *  is equivalent to deleting the codex itself, which is a separate flow
 *  (codex-reset, not seed-delete). See docs/v0.2.0-design.md §5.1. */
export class CodexPrimeSeedProtectedError extends CodexError {
  public override readonly name = "CodexPrimeSeedProtectedError";
  public readonly seedId: string;

  constructor(seedId: string) {
    super(
      `Kadena seed ${seedId} is the Prime Codex Seed and cannot be ` +
        `deleted. Removing the prime seed is equivalent to deleting the ` +
        `codex itself — use the codex-reset flow instead.`
    );
    this.seedId = seedId;
  }
}

/** Thrown by `kickstartCodex` and `recoverCodexFromMnemonic` when the
 *  pre-flight invariants fail (v0.2.0+). The `reason` field discriminates:
 *
 *   - `already-kickstarted`: kickstartCodex called on a codex that
 *     already has a prime seed. Caller should use addKadenaSeed for
 *     additional seeds, or reset the codex first.
 *   - `smart-account-not-allowed`: caller passed an ouro with
 *     `isSmart: true` as the CodexPrime. CodexPrime must be a Standard
 *     Ouronet Account (Ѻ. prefix), never a Smart account (Σ. prefix).
 *   - `id-conflict`: caller tried to install a prime entity whose id
 *     doesn't match the existing prime, or tried to add a seed/ouro with
 *     `isPrime: true` set when a prime already exists.
 *
 *  See docs/v0.2.0-design.md §5.4. */
export class CodexKickstartError extends CodexError {
  public override readonly name = "CodexKickstartError";
  public readonly reason:
    | "already-kickstarted"
    | "smart-account-not-allowed"
    | "id-conflict";

  constructor(
    reason: CodexKickstartError["reason"],
    detail?: string
  ) {
    const messages: Record<CodexKickstartError["reason"], string> = {
      "already-kickstarted":
        "Codex has already been kickstarted (a Prime Codex Seed exists). " +
        "Use addKadenaSeed() to add additional seeds, or reset the codex first.",
      "smart-account-not-allowed":
        "CodexPrime must be a Standard Ouronet Account (isSmart: false). " +
        "Smart accounts (Σ. prefix) cannot be the CodexPrime.",
      "id-conflict":
        "Cannot install a second prime entity. Exactly one prime kadena seed " +
        "and one prime ouro account are allowed per codex.",
    };
    super(detail ? `${messages[reason]} ${detail}` : messages[reason]);
    this.reason = reason;
  }
}

/** Thrown when the storage backend (localStorage, IndexedDB, file system, ...)
 *  fails — quota exceeded, disk full, permission denied, etc. Wraps the
 *  original underlying error in `.cause`. */
export class CodexAdapterError extends CodexError {
  public override readonly name = "CodexAdapterError";
  public readonly operation: string;
  public readonly adapter: string;

  constructor(adapter: string, operation: string, cause: unknown) {
    super(
      `Codex adapter "${adapter}" failed during "${operation}": ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
      { cause }
    );
    this.adapter = adapter;
    this.operation = operation;
  }
}

/** Thrown when codex import fails — JSON parse failure, decryption failure
 *  with the provided password, malformed entity shapes, etc. */
export class CodexImportError extends CodexError {
  public override readonly name = "CodexImportError";
  public readonly stage: "parse" | "decrypt" | "shape" | "migrate";

  constructor(
    stage: "parse" | "decrypt" | "shape" | "migrate",
    detail: string,
    cause?: unknown
  ) {
    super(`Codex import failed at "${stage}" stage: ${detail}`, { cause });
    this.stage = stage;
  }
}

/** Thrown when `authenticate(password)` is called with a password that
 *  doesn't decrypt the codex's encrypted secrets. */
export class CodexPasswordError extends CodexError {
  public override readonly name = "CodexPasswordError";

  constructor() {
    super(
      `Incorrect password. The provided password did not decrypt any of ` +
        `the codex's stored secrets. Check the password and try again.`
    );
  }
}

// ---------------------------------------------------------------------------
// v0.3.0 errors — appended in phase order after the v0.2 errors above.
// ---------------------------------------------------------------------------

/** Thrown by the schema-migration runner (`applyMigrations`) and the store's
 *  `init()` / `migrateToCurrent()` wiring (v0.3.0+). The `reason` field
 *  discriminates:
 *
 *   - `unknown-schema-version`: the loaded codex's schemaVersion is NEWER than
 *     this package's CURRENT_SCHEMA_VERSION, so this consumer is too old to
 *     safely read/write it. `detail` carries "loaded={N}, max={CURRENT}".
 *   - `migration-failed`: a migration's `migrate(...)` threw. The original
 *     error is forwarded in `.cause`; `detail` carries the migration's
 *     description.
 *   - `post-condition-failed`: a migration ran but its output snapshot's
 *     schemaVersion did not equal the migration's declared `toVersion`, OR
 *     the supplied migration registry is malformed (reversed/duplicate
 *     fromVersion). `detail` describes the violated invariant. */
export class CodexMigrationError extends CodexError {
  public override readonly name = "CodexMigrationError";
  public readonly reason:
    | "unknown-schema-version"
    | "migration-failed"
    | "post-condition-failed";

  constructor(
    reason: CodexMigrationError["reason"],
    detail?: string,
    cause?: unknown
  ) {
    const messages: Record<CodexMigrationError["reason"], string> = {
      "unknown-schema-version":
        "Loaded codex schema version is newer than this package can read. " +
        "Upgrade the consumer to a version that understands the newer schema.",
      "migration-failed":
        "A schema migration failed while upgrading the codex to the current " +
        "version.",
      "post-condition-failed":
        "A schema migration produced an invalid result, or the migration " +
        "registry is malformed.",
    };
    super(detail ? `${messages[reason]} ${detail}` : messages[reason], {
      cause,
    });
    this.reason = reason;
  }
}
