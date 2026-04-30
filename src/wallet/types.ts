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
 *
 * Note this is a DERIVATION marker, not a delegation marker — OuronetUI has
 * no `window.ecko`/`window.chainweaver` extension integration today. The
 * seed's private key lives in the Codex either way; only the math that
 * turns a mnemonic into that key differs between these three labels.
 */
export type SeedType = "koala" | "chainweaver" | "eckowallet";

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
 * `@stoachain/ouronet-core/interactions/*` to fetch balances; instead the
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
