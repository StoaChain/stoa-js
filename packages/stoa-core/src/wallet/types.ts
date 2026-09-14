/**
 * Shared wallet types — consumed by the HD builder, the storage adapter
 * interface, and the eventual PlaintextCodex codec (Phase 4).
 */

/**
 * Derivation algorithm for an HD seed in the Codex.
 *
 *   koala       — standard BIP39 24-word mnemonic + SLIP-10 Ed25519.
 *                 Produces 64-char private keys; signs via nacl.
 *   chainweaver — Kadena 12-word mnemonic + BIP32-Ed25519 via
 *                 @kadena/hd-wallet/chainweaver. Signs via WASM with an
 *                 EncryptedString secretKey + password.
 *   eckowallet  — same 12-word + BIP32-Ed25519 pathway as chainweaver;
 *                 only the label differs.
 *   stoic       — NOT mnemonic-based. Derived from an already-validated
 *                 1600-bit DALOS Genesis seed bitstring + an index via
 *                 `@ouronet/dalos-crypto/chainweb`'s
 *                 `generateFromBitStringAtIndex`. Produces a real RFC 8032
 *                 Ed25519 keypair and a Chainweb `k:` account name directly
 *                 — there is no mnemonic to check, so this label never flows
 *                 through `createWalletPairFromMnemonic` or
 *                 `isValidMnemonic`. See
 *                 `KadenaWalletBuilder.createWalletPairFromDalosBitString`.
 *
 * Note "koala"/"chainweaver"/"eckowallet" are DERIVATION markers, not
 * delegation markers — OuronetUI has no `window.ecko`/`window.chainweaver`
 * extension integration today. The seed's private key lives in the Codex
 * either way; only the math that turns a mnemonic into that key differs
 * between those three labels. "stoic" is a genuinely different derivation
 * family (bitstring, not mnemonic) grouped into the same union because it is
 * still a Codex-seed provenance marker like the other three.
 */
export type SeedType = "koala" | "chainweaver" | "eckowallet" | "stoic";

/**
 * Consumer-side balance lookup seam — resolves a Kadena account address to
 * its decimal `coin` balance as a string.
 *
 * Contract:
 *   - Resolves to the literal string `"0"` when the account does not yet
 *     exist on chain (i.e. `coin.details` returns a row-not-found error).
 *     Callers may rely on `"0"` as a stable sentinel for "absent" without
 *     parsing error shapes.
 *   - Returns a decimal string (not a number, not a `BigNumber`) so callers
 *     keep full Kadena `decimal` precision; downstream code parses with
 *     `BigNumber` as needed.
 *   - Asynchronous — implementations typically wrap a `coin.details` Pact
 *     read or a cache layered on top of one.
 *
 * This is the consumer-side resolver that replaces the previous
 * `wallet → interactions` import edge: `KadenaWallet` no longer reaches into
 * `@ouronet/ouronet-core/interactions/*` to fetch balances; instead the
 * consumer wires whichever reader fits its environment (browser cache-aware
 * read, server raw read, in-memory mock for tests) by assigning a
 * `BalanceResolver`. Same narrow-seam approach used by `PactReader`
 * (`src/reads/pactReader.ts`) and `KeyResolver` (`src/signing/types.ts`).
 *
 * Example — wiring at boot or per-instance:
 *
 *   wallet.balanceResolver = (address) => coinDetails(address).then(r => r.balance ?? "0");
 */
export type BalanceResolver = (address: string) => Promise<string>;
