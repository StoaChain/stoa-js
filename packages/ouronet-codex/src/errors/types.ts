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
