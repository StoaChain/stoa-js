/**
 * wallet.test.ts -- KadenaWallet injection-seam contract.
 *
 * Pins the four behavioural paths added by the Phase 1 wallet edge cut:
 *
 *   1. default-throw            -- no resolver wired => getBalance() rejects
 *                                  with the locked, exact error string.
 *   2. constructor-injected     -- a resolver passed via the options object
 *                                  is invoked with `wallet.address`, its
 *                                  return value is stored in `wallet.balance`
 *                                  and returned.
 *   3. post-construction assign -- swapping `wallet.balanceResolver = fn`
 *                                  after construction makes a subsequent
 *                                  getBalance() delegate to that fn.
 *   4. error propagation        -- both async-reject and sync-throw paths
 *                                  surface to the caller. No `?? "0"`
 *                                  swallow, no silent fallback.
 *
 * The contract enforces REQ-01, REQ-03, REQ-04 of the arch-layering-and-seams
 * spec: importing the wallet subpath no longer pulls the interactions tree;
 * consumers are responsible for wiring the resolver; absent resolver fails
 * loudly rather than fabricating a "0" balance.
 */

import { describe, it, expect, vi } from "vitest";
import { KadenaWallet } from "../src/wallet";
import type { BalanceResolver } from "../src/wallet";

const DEFAULT_THROW_MESSAGE =
  "KadenaWallet: balanceResolver not configured. Inject one via the constructor or set wallet.balanceResolver before calling getBalance().";

const PUBLIC_KEY = "a".repeat(64);
const SECRET = "b".repeat(64);
const BASE_OPTIONS = {
  parentId: "parent-id",
  index: 0,
  secret: SECRET,
  publicKey: PUBLIC_KEY,
  derivationPath: "m/44'/626'/0'/0/0",
};

describe("KadenaWallet -- balanceResolver injection seam", () => {
  describe("default-throw (no resolver wired)", () => {
    it("constructs synchronously without invoking the default resolver", () => {
      // Construction must not throw -- the default initialiser is lazy.
      const wallet = new KadenaWallet(BASE_OPTIONS);
      expect(wallet.address).toBe(`k:${PUBLIC_KEY}`);
      expect(wallet.balance).toBe("0");
    });

    it("rejects with the exact locked error string when getBalance() is called", async () => {
      const wallet = new KadenaWallet(BASE_OPTIONS);
      await expect(wallet.getBalance()).rejects.toThrow(DEFAULT_THROW_MESSAGE);
    });
  });

  describe("constructor-injected resolver", () => {
    it("invokes the injected resolver with `wallet.address`", async () => {
      const stub: BalanceResolver = vi.fn().mockResolvedValue("123.456");
      const wallet = new KadenaWallet({ ...BASE_OPTIONS, balanceResolver: stub });

      const result = await wallet.getBalance();

      expect(stub).toHaveBeenCalledTimes(1);
      expect(stub).toHaveBeenCalledWith(`k:${PUBLIC_KEY}`);
      expect(result).toBe("123.456");
      expect(wallet.balance).toBe("123.456");
    });

    it("propagates the resolver's return value verbatim (no `?? \"0\"` rewriting)", async () => {
      // Locked: getBalance() must NOT swallow the resolver's value or coerce
      // empty strings to "0". The pre-state body did `?? "0"` -- gone.
      const stub: BalanceResolver = vi.fn().mockResolvedValue("");
      const wallet = new KadenaWallet({ ...BASE_OPTIONS, balanceResolver: stub });

      const result = await wallet.getBalance();

      expect(result).toBe("");
      expect(wallet.balance).toBe("");
    });
  });

  describe("post-construction assignment", () => {
    it("delegates to a resolver assigned after construction", async () => {
      const wallet = new KadenaWallet(BASE_OPTIONS);
      const stub: BalanceResolver = vi.fn().mockResolvedValue("42.0");

      wallet.balanceResolver = stub;
      const result = await wallet.getBalance();

      expect(stub).toHaveBeenCalledTimes(1);
      expect(stub).toHaveBeenCalledWith(`k:${PUBLIC_KEY}`);
      expect(result).toBe("42.0");
      expect(wallet.balance).toBe("42.0");
    });

    it("uses the most recently assigned resolver (last-write-wins for new calls)", async () => {
      const stubA: BalanceResolver = vi.fn().mockResolvedValue("first");
      const stubB: BalanceResolver = vi.fn().mockResolvedValue("second");
      const wallet = new KadenaWallet({ ...BASE_OPTIONS, balanceResolver: stubA });

      await wallet.getBalance();
      wallet.balanceResolver = stubB;
      const second = await wallet.getBalance();

      expect(stubA).toHaveBeenCalledTimes(1);
      expect(stubB).toHaveBeenCalledTimes(1);
      expect(second).toBe("second");
      expect(wallet.balance).toBe("second");
    });
  });

  describe("error propagation", () => {
    it("surfaces async rejection from the resolver to the caller", async () => {
      const failure = new Error("indexer down");
      const stub: BalanceResolver = vi.fn().mockRejectedValue(failure);
      const wallet = new KadenaWallet({ ...BASE_OPTIONS, balanceResolver: stub });

      await expect(wallet.getBalance()).rejects.toThrow("indexer down");
      // Locked: no silent "0" fallback -- balance must NOT be mutated.
      expect(wallet.balance).toBe("0");
    });

    it("surfaces a synchronous throw from the resolver to the caller", async () => {
      // A resolver that throws synchronously instead of returning a rejected
      // promise must still surface through the async getBalance() boundary.
      const stub: BalanceResolver = (() => {
        throw new Error("sync boom");
      }) as BalanceResolver;
      const wallet = new KadenaWallet({ ...BASE_OPTIONS, balanceResolver: stub });

      await expect(wallet.getBalance()).rejects.toThrow("sync boom");
      expect(wallet.balance).toBe("0");
    });

    it("preserves stale balance on rejection after a successful fetch (no-mutate-on-error invariant)", async () => {
      // This test pins the *real* no-mutate-on-error contract: after a
      // successful fetch, wallet.balance is the fetched value; if a
      // subsequent fetch rejects, the balance must remain at that fetched
      // value (NOT silently reset to "0"). A regression that adds
      // `this.balance = "0"` in a catch block would fail this test even
      // though the simpler "construct + reject" tests above would still
      // pass.
      const successStub = vi.fn().mockResolvedValueOnce("123.456");
      const wallet = new KadenaWallet({
        ...BASE_OPTIONS,
        balanceResolver: successStub as BalanceResolver,
      });

      const fetched = await wallet.getBalance();
      expect(fetched).toBe("123.456");
      expect(wallet.balance).toBe("123.456");

      // Swap in a rejecting resolver and call again.
      wallet.balanceResolver = vi.fn().mockRejectedValue(new Error("indexer down")) as BalanceResolver;
      await expect(wallet.getBalance()).rejects.toThrow("indexer down");
      // Critical: balance must remain "123.456" (stale-but-not-overwritten).
      expect(wallet.balance).toBe("123.456");
    });
  });
});
