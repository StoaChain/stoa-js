/**
 * Typed errors for wallet operations.
 * Mirrors `WrongPasswordError` shape in `../crypto/errors.ts`.
 *
 * `this.name` is set explicitly so error-name-based branching works
 * regardless of bundler minification of the class identifier.
 */
export class MnemonicMismatchError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MnemonicMismatchError";
  }
}
