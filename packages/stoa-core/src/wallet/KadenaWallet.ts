/**
 * KadenaWallet -- runtime account object with a lazy-fetched balance.
 *
 * Minimal data bag + a `getBalance()` that delegates to an injected
 * `balanceResolver`. When no resolver is wired the default is a stub that
 * throws a clearly-worded error on invocation -- never at construction.
 * Browser and server consume `KadenaWallet` identically; each environment
 * supplies its own resolver (browser: cache-aware reader; server: indexer-
 * backed reader; tests: in-memory stub) at construction or by assigning
 * `wallet.balanceResolver = fn` later.
 *
 * Constructed from an HD-derived publicKey + derivation metadata; `address`
 * is always `k:<publicKey>`.
 *
 * Purity note: the constructor is synchronous and allocation-only -- no
 * network, no cache, no React -- so instantiation works in any environment.
 * The `getBalance()` method is the only side-effect and it's opt-in. Errors
 * from the resolver propagate to the caller; there is no silent fallback to
 * a fabricated "0" balance.
 */

import type { BalanceResolver } from "./types";

const DEFAULT_RESOLVER_ERROR =
  "KadenaWallet: balanceResolver not configured. Inject one via the constructor or set wallet.balanceResolver before calling getBalance().";

/**
 * Lazy default resolver -- constructed eagerly but only throws when called.
 * Letting consumers build a wallet without wiring a resolver is intentional;
 * the error fires only at the first `getBalance()` call so that uses which
 * never need a balance (e.g. address-only flows) stay zero-config.
 */
const throwingDefaultResolver: BalanceResolver = () => {
  throw new Error(DEFAULT_RESOLVER_ERROR);
};

class KadenaWallet {
  public readonly parentId: string;
  public readonly index: number;
  public readonly secret: string;
  public readonly address: string;
  public readonly publicKey: string;
  public readonly derivationPath: string;
  // not readonly: assigned by getBalance() (LC-5-B-rule-2 exception)
  public balance: string;

  /**
   * Consumer-side balance lookup function. Called by `getBalance()` with
   * `this.address`. Mutable so consumers can swap the implementation after
   * construction (e.g. switch from a mock to a live reader at boot).
   *
   * Race semantics: in-flight `getBalance()` calls capture the resolver at
   * invocation time; reassigning `balanceResolver` does NOT cancel pending
   * fetches. The last resolution to settle wins -- `this.balance` reflects
   * whichever invocation completes last (last-write-wins). Mirrors the
   * pre-state semantics where the previous body called the same upstream
   * `getBalance` and assigned its result unconditionally.
   *
   * Default initialiser: a stub that MUST throw with the exact error string
   * `KadenaWallet: balanceResolver not configured. Inject one via the
   * constructor or set wallet.balanceResolver before calling getBalance().`
   * The throw is lazy (fires on call, not at construction), so wallets used
   * for address-only flows never need a resolver.
   */
  public balanceResolver: BalanceResolver;

  constructor({
    parentId,
    index,
    secret,
    publicKey,
    derivationPath,
    balanceResolver,
  }: {
    parentId: string;
    index: number;
    secret: string;
    publicKey: string;
    derivationPath: string;
    balanceResolver?: BalanceResolver;
  }) {
    this.parentId = parentId;
    this.index = index;
    this.secret = secret;
    this.address = `k:${publicKey}`;
    this.publicKey = publicKey;
    this.derivationPath = derivationPath;
    this.balance = "0";
    this.balanceResolver = balanceResolver ?? throwingDefaultResolver;
  }

  /**
   * Fetch the current balance through the injected resolver, cache it on
   * `this.balance`, and return it. Resolver errors (async reject or sync
   * throw) propagate verbatim to the caller -- no fallback to `"0"`.
   */
  async getBalance(): Promise<string> {
    this.balance = await this.balanceResolver(this.address);
    return this.balance;
  }

  toJSON() {
    const { secret, balanceResolver, ...rest } = this;
    return rest;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    const { secret, balanceResolver, ...rest } = this;
    return rest;
  }
}

export default KadenaWallet;
