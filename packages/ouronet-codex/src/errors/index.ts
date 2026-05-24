// @stoachain/ouronet-codex/errors
//
// Typed error classes thrown by codex operations. Consumers can pattern-match
// on instance type to render specific UX (relock-and-retry on
// CodexLockedError, prompt-import-cloud-backup on CodexKeyMissingError, etc).
//
// All extend the base CodexError so a catch-all `instanceof CodexError`
// distinguishes package-thrown errors from arbitrary runtime errors.
//
// Inventory (per spec §5.5):
//   - CodexError              base class
//   - CodexLockedError        operation requires unlock
//   - CodexKeyMissingError    getKeypair lookup failed
//                             (with publicKey + pureKeypairCount + derivedCount fields)
//   - CodexPrimeProtectedError  attempted delete of CodexPrime (spec §B2)
//   - CodexAdapterError       storage backend failure
//   - CodexImportError        import JSON parse / decrypt failure
//   - CodexPasswordError      authenticate() wrong password
//
// Implementation lands in Phase 3 (alongside adapters that throw them).
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md §5.5
export {};
