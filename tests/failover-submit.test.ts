/**
 * failover-submit.test.ts — primary-down → fallback retry coverage for
 * `getFailoverClient(...).submit(...)`.
 *
 * Closes the gap left by `failover-client.test.ts`, which intentionally stops
 * at the unit-of-logic boundary (input validation, AbortError emission, factory
 * shape) and does NOT exercise an end-to-end `submit` against a mocked
 * `@kadena/client`. This file pins two load-bearing invariants:
 *
 *   1. REQ-15 — When primary `submit` rejects with a network-class error,
 *      `withFailover` switches to the fallback host and retries exactly once.
 *      The aggregate `getFailoverClient(...).submit(...)` resolves with the
 *      fallback's result; the underlying `client.submit` mock is invoked
 *      exactly twice (once per host).
 *
 *   2. REQ-15 + REQ-01 — Both attempts MUST receive the SAME signed-tx object
 *      reference (===-equality), not a clone, not a re-stringified rebuild,
 *      not a spread copy. This is the request-key dedup contract: chainweb's
 *      mempool dedups a duplicate-key submission as a no-op, which is exactly
 *      the desired transparent-failover behavior. Any future refactor that
 *      interposes object cloning between caller and `client.submit` would
 *      silently defeat dedup; this test catches that.
 *
 * Pre-write verification (mandatory):
 *   `src/network/failoverClient.ts:281-295` — the `submit` factory method
 *   captures `transaction` via its outer arrow's parameter, then passes the
 *   identical reference to `submit(transaction, ...)` inside `runWithTimeout`'s
 *   worker. No `{ ...transaction }` spread, no JSON re-encoding, no rebuild.
 *   The closure is created OUTSIDE `withFailover`, so the same reference is
 *   reused across primary and fallback attempts.
 *
 * Mock approach (LOCKED — FINDING-002):
 *   Project is native ESM (`"type": "module"`). `vi.spyOn` on a named static
 *   import may silently fail under ESM. We use `vi.mock("@kadena/client", ...)`
 *   with `vi.hoisted()` so the mock is installed before the SUT imports the
 *   client factory.
 *
 * Timer policy:
 *   This file tests failover retry, NOT timeout mechanics. Real timers — no
 *   `vi.useFakeTimers()`. Submit timeout is 60s by default; mocked submit
 *   resolves/rejects synchronously, so no real time elapses.
 *
 * State isolation:
 *   `beforeEach` calls `resetNodeFailover()` to restore PRIMARY=node2 /
 *   FALLBACK=node1 / active=primary. Without this, a previous test's
 *   primary-down switch would leak and Test 1 would start ALREADY on the
 *   fallback host — withFailover would not retry (it short-circuits when
 *   already on fallback) and the second mock value would never be consumed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ICommand, ITransactionDescriptor } from "@kadena/client";

// `vi.hoisted` lifts this initializer above the `vi.mock` factory below so the
// mock function reference is available at hoist-time. The two `mock*Once`
// programs the rejection-then-resolution sequence used by Test 1 + Test 2.
const submitMock = vi.hoisted(() =>
  vi
    .fn()
    .mockRejectedValueOnce(new Error("Failed to fetch"))
    .mockResolvedValueOnce({
      requestKey: "abc",
      chainId: "1",
      networkId: "mainnet01",
    } as ITransactionDescriptor),
);

vi.mock("@kadena/client", () => ({
  createClient: vi.fn().mockReturnValue({ submit: submitMock }),
}));

// SUT + state-reset helper imported AFTER the mock declaration. Vitest hoists
// `vi.mock` to the top of the module regardless, but keeping imports below
// keeps reading order match execution order.
import { getFailoverClient, resetNodeFailover } from "../src/network";

beforeEach(() => {
  resetNodeFailover();
  // The hoisted submitMock retains its programmed sequence across tests within
  // a file unless reset. We deliberately DO NOT clear it here — Test 1 consumes
  // both .mockRejectedValueOnce + .mockResolvedValueOnce; Test 2 inspects the
  // same call history. A fresh sequence per test would defeat Test 2's
  // reference-equality check.
});

describe("getFailoverClient.submit — primary-down → fallback retry (REQ-15)", () => {
  // Single shared signed-tx object used by both tests in this describe — Test 2
  // asserts that mock.calls[0][0] === mock.calls[1][0], so the object must
  // survive across both invocations of submit. A plausible ICommand shape:
  // cmd is the stringified JSON payload, hash is the request-key, sigs is the
  // signature array. Field VALUES are inert — the mock does not parse them.
  const signedTx: ICommand = {
    cmd: '{"networkId":"mainnet01","payload":{"exec":{"code":"(+ 1 1)","data":{}}},"signers":[],"meta":{"chainId":"1","sender":"k:abc","gasLimit":1000,"gasPrice":1e-8,"ttl":600,"creationTime":0},"nonce":"test"}',
    hash: "abc",
    sigs: [{ sig: "deadbeef" }],
  };

  it("retries once on primary 'Failed to fetch', resolves from fallback, and passes the SAME signed-tx reference to both attempts (request-key dedup contract)", async () => {
    // F-BUG-003 fix: collapsed previously-separate Test 1 (retry behavior) and
    // Test 2 (reference-equality dedup) into a single it-block. The previous
    // split shared the hoisted `submitMock` programming across two it-blocks
    // in declaration order — order-fragile under `--shuffle`, `--bail`, or
    // `it.only(test 2)`. A single test holds full state ownership and is
    // order-independent.
    const client = getFailoverClient("1");

    const result = await client.submit(signedTx);

    // Behavior: fallback host's resolution surfaces to the caller.
    expect(result).toEqual({
      requestKey: "abc",
      chainId: "1",
      networkId: "mainnet01",
    });
    // Exactly twice: once on primary (rejected), once on fallback (resolved).
    // Any other count means either failover did not trigger or it triggered
    // more than once (double-retry would be a regression of the "do NOT retry
    // if already on fallback" guard in withFailover).
    expect(submitMock).toHaveBeenCalledTimes(2);
    // Dedup contract: both attempts received the SAME `signedTx` object (===),
    // not a clone, not a re-stringified rebuild, not a spread copy. Chainweb's
    // mempool dedups duplicate request-keys, so reference equality preserves
    // the desired transparent-failover semantics.
    expect(submitMock.mock.calls[0][0]).toBe(submitMock.mock.calls[1][0]);
    // Pin: that same reference is also the original signedTx, not an
    // intermediate clone produced by the SUT. (Stronger than the spec
    // requires, but cheap to assert and tightens the dedup contract.)
    expect(submitMock.mock.calls[0][0]).toBe(signedTx);
  });
});
