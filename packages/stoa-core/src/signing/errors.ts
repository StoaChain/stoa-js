/**
 * Typed errors for signing operations. Best-effort Σ-prefix detection at the
 * CodexSigningStrategy boundary. Mirrors the constructor shape of
 * WrongPasswordError in ../crypto/errors.ts so callers can use standard
 * instanceof checks and Error.cause chaining.
 */
export class SmartAccountAuthError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SmartAccountAuthError";
  }
}
