/**
 * @stoachain/ouronet-core/crypto — typed error taxonomy.
 *
 * Three error classes raised by the crypto subpath so consumers can branch
 * on intent rather than parsing message strings:
 *
 *   `WrongPasswordError` — KDF derived a key but AES-GCM authentication
 *     tag verification failed. Almost always a wrong password; rarely a
 *     truncated ciphertext.
 *   `CorruptEnvelopeError` — the ciphertext envelope itself is malformed
 *     (missing fields, wrong base64, impossible IV/salt lengths, schema
 *     shape doesn't match V1 or V2). Distinguished from `WrongPassword`
 *     because no amount of password retry will fix it.
 *   `UnsupportedFormatError` — envelope shape parses but the schema
 *     version is one this build does not know how to decrypt.
 *
 * Each class follows the standard ES2022 `Error.cause` pattern:
 * `new WrongPasswordError(message, { cause: underlyingErr })`. The base
 * `Error` constructor attaches `options.cause` as `this.cause`
 * automatically — no manual assignment needed. `target: "ES2020"` with
 * `lib: ["ES2023"]` provides the `ErrorOptions` interface transitively.
 *
 * `this.name` is set explicitly so error-name-based branching (e.g.
 * `switch (err.name)`) works regardless of bundler minification of the
 * class identifier.
 */

export class WrongPasswordError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WrongPasswordError";
  }
}

export class CorruptEnvelopeError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CorruptEnvelopeError";
  }
}

export class UnsupportedFormatError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnsupportedFormatError";
  }
}
