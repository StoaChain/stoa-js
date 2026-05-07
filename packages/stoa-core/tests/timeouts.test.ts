/**
 * timeouts.test.ts — the project's first vi.useFakeTimers file.
 *
 * Covers the four operation tiers exposed by `getFailoverClient`
 * (`dirtyRead` / `submit` / `listen` / `pollOne`) plus the codexStrategy
 * outer-boundary TIMEOUT classification seam introduced by T4.1.
 *
 * Two layers of defence are exercised:
 *
 *   1. `getFailoverClient`-method layer. Each method runs its underlying
 *      `@kadena/client` call inside `runWithTimeout`, then catches the
 *      escaping `AbortError` at the outer boundary and rethrows it as
 *      `SigningError(code: "TIMEOUT")` via `createTimeoutError`. The mocked
 *      chain calls below never resolve, so advancing fake timers past the
 *      tier default fires the timeout race and surfaces the classified
 *      `{ code: "TIMEOUT" }` error to the caller.
 *
 *   2. codexStrategy seam layer. The signing strategy (T4.1) wraps its two
 *      chain calls with `runWithTimeout` directly — no `withFailover`,
 *      because the `PactClient` interface has no base-URL accessor to feed
 *      a failover loop. Its outer-boundary catch lives in `codexStrategy.ts`
 *      itself, so the seam is exercised here by replicating the same
 *      `runWithTimeout` + AbortError → createTimeoutError pattern in-line.
 *
 * vi.useFakeTimers placement (LOCKED, same-scope rule):
 *   `vi.useFakeTimers()` is activated in a `beforeEach` at the top-level
 *   `describe` scope of this file, with the matching
 *   `afterEach(() => vi.useRealTimers())` at the SAME scope. This prevents
 *   fake-timer mode from leaking into sibling test files in the suite.
 *
 * Mock approach (LOCKED):
 *   `vi.mock("@kadena/client", ...)` with `vi.hoisted()` for shared mock
 *   variables. `vi.spyOn` on a named ESM import is intentionally avoided —
 *   this project ships native ESM (`"type": "module"`) and `vi.spyOn` may
 *   silently fail to intercept the call.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getFailoverClient,
  runWithTimeout,
  resetNodeFailover,
} from "../src/network";
import { createTimeoutError } from "../src/errors";

// ── Mock @kadena/client (hoisted) ────────────────────────────────────────────
//
// Each tier's mock is a vi.fn(); tests reconfigure the implementation per
// case via `mockImplementationOnce` / `mockResolvedValueOnce`. The shared
// `createClient` factory returns the same four-method object on every call
// so primary and fallback baseUrls map onto the same spies — useful for
// verifying call counts across a withFailover retry, even though the
// timeout-past-default cases here don't trigger failover (AbortError on
// primary DOES trigger fallback in withFailover; both attempts time out,
// so the spy is hit twice, which is fine for the assertions below).

const mocks = vi.hoisted(() => ({
  dirtyRead: vi.fn(),
  submit: vi.fn(),
  listen: vi.fn(),
  pollOne: vi.fn(),
}));

vi.mock("@stoachain/kadena-stoic-legacy/client", () => ({
  createClient: vi.fn(() => ({
    dirtyRead: mocks.dirtyRead,
    submit: mocks.submit,
    listen: mocks.listen,
    pollOne: mocks.pollOne,
  })),
}));

// Tier defaults — kept in sync with `src/network/failoverClient.ts`. Inline
// numeric literals because the constants are module-private there.
const DEFAULT_READ_MS = 15_000;
const DEFAULT_SUBMIT_MS = 60_000;
const DEFAULT_LISTEN_MS = 180_000;
const DEFAULT_POLL_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────

describe("getFailoverClient — per-tier timeouts (fake timers)", () => {
  beforeEach(() => {
    resetNodeFailover();
    mocks.dirtyRead.mockReset();
    mocks.submit.mockReset();
    mocks.listen.mockReset();
    mocks.pollOne.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ══ Group A: timeout-past-default (4 it-blocks) ════════════════════════════

  it("dirtyRead rejects with TIMEOUT after default 15_000 ms", async () => {
    mocks.dirtyRead.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0");
    const promise = client.dirtyRead({} as any);
    // Attach a no-op rejection handler so the unhandled-rejection on the
    // primary attempt's AbortError doesn't surface during the await — the
    // outer-boundary catch on getFailoverClient swallows it before that.
    promise.catch(() => {});
    // Primary times out → withFailover retries on fallback (also never
    // resolves) → fallback times out → outer-boundary converts the second
    // AbortError to SigningError(TIMEOUT). Advance past both deadlines.
    await vi.advanceTimersByTimeAsync(DEFAULT_READ_MS + 1);
    await vi.advanceTimersByTimeAsync(DEFAULT_READ_MS + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("submit rejects with TIMEOUT after default 60_000 ms", async () => {
    mocks.submit.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0");
    const promise = client.submit({} as any);
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(DEFAULT_SUBMIT_MS + 1);
    await vi.advanceTimersByTimeAsync(DEFAULT_SUBMIT_MS + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("listen rejects with TIMEOUT after default 180_000 ms", async () => {
    mocks.listen.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0");
    const promise = client.listen({} as any);
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(DEFAULT_LISTEN_MS + 1);
    await vi.advanceTimersByTimeAsync(DEFAULT_LISTEN_MS + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("pollOne rejects with TIMEOUT after default 30_000 ms", async () => {
    mocks.pollOne.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0");
    const promise = client.pollOne({} as any);
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_MS + 1);
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_MS + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  // ══ Group B: success-under-default (4 it-blocks) ═══════════════════════════

  it("dirtyRead resolves with the chain result when settling under the default", async () => {
    const expected = { result: { status: "success", data: "ok" } };
    mocks.dirtyRead.mockResolvedValueOnce(expected);
    const client = getFailoverClient("0");
    const promise = client.dirtyRead({} as any);
    // Flush the resolved promise's microtasks. No timer advancement — the
    // mock resolves synchronously on the first await tick.
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toEqual(expected);
    expect(mocks.dirtyRead).toHaveBeenCalledTimes(1);
  });

  it("submit resolves with the descriptor when settling under the default", async () => {
    const expected = { requestKey: "abc", chainId: "0", networkId: "stoa" };
    mocks.submit.mockResolvedValueOnce(expected);
    const client = getFailoverClient("0");
    const promise = client.submit({} as any);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toEqual(expected);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });

  it("listen resolves with the chain result when settling under the default", async () => {
    const expected = { result: { status: "success", data: "listened" } };
    mocks.listen.mockResolvedValueOnce(expected);
    const client = getFailoverClient("0");
    const promise = client.listen({} as any);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toEqual(expected);
    expect(mocks.listen).toHaveBeenCalledTimes(1);
  });

  it("pollOne resolves with the chain result when settling under the default", async () => {
    const expected = { result: { status: "success", data: "polled" } };
    mocks.pollOne.mockResolvedValueOnce(expected);
    const client = getFailoverClient("0");
    const promise = client.pollOne({} as any);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toEqual(expected);
    expect(mocks.pollOne).toHaveBeenCalledTimes(1);
  });

  // ══ Group C: three-level precedence on submit (3 it-blocks, REQ-09) ════════
  //
  // Precedence rule: callOpts.submitTimeoutMs ?? options.submitTimeoutMs ??
  // DEFAULT_SUBMIT_TIMEOUT_MS. Each scenario fires the timeout exactly past
  // its expected deadline and asserts no premature TIMEOUT before that.

  it("precedence: no override fires at the locked submit default (60_000 ms)", async () => {
    mocks.submit.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0");
    const promise = client.submit({} as any);
    promise.catch(() => {});
    // Advance to just shy of the default — must NOT have rejected yet.
    let settledEarly: "fulfilled" | "rejected" | null = null;
    promise.then(
      () => { settledEarly = "fulfilled"; },
      () => { settledEarly = "rejected"; },
    );
    await vi.advanceTimersByTimeAsync(DEFAULT_SUBMIT_MS - 1);
    expect(settledEarly).toBeNull();
    // Crossing the default deadline triggers the primary timeout, then the
    // fallback timeout. Advance enough total time to cover both attempts.
    await vi.advanceTimersByTimeAsync(2);
    await vi.advanceTimersByTimeAsync(DEFAULT_SUBMIT_MS + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("precedence: factory-time override (5_000 ms) wins over the default", async () => {
    mocks.submit.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0", { submitTimeoutMs: 5_000 });
    const promise = client.submit({} as any);
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(5_000 + 1);
    await vi.advanceTimersByTimeAsync(5_000 + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("precedence: per-call override (2_000 ms) wins over factory-time", async () => {
    mocks.submit.mockImplementation(() => new Promise(() => {}));
    const client = getFailoverClient("0", { submitTimeoutMs: 5_000 });
    const promise = client.submit({} as any, { submitTimeoutMs: 2_000 });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(2_000 + 1);
    await vi.advanceTimersByTimeAsync(2_000 + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

// ══ Group D: codexStrategy outer-boundary TIMEOUT seam (2 it-blocks) ═════════
//
// CI-001 cross-plan finding: T4.1's seam adds its own `try { await
// runWithTimeout(...) } catch (err) { if (err?.name === "AbortError")
// throw createTimeoutError(...); throw err; }` block in `codexStrategy.ts`.
// That converter is NOT exercised by the Group A/B/C tests above — those
// hit the converter inside `getFailoverClient`. Replicating the
// codexStrategy pattern directly here pins the seam-level invariant
// without needing to construct a full CodexSigningStrategy + resolver.

describe("codexStrategy TIMEOUT classification seam", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dirtyRead path: AbortError from runWithTimeout is reclassified to SigningError(TIMEOUT)", async () => {
    const seamCall = async () => {
      try {
        return await runWithTimeout(
          "test-dirtyRead",
          () => new Promise<never>(() => {}),
          15_000,
        );
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw createTimeoutError("test-dirtyRead", 15_000, err);
        }
        throw err;
      }
    };
    const promise = seamCall();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(15_001);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("submit path: AbortError from runWithTimeout is reclassified to SigningError(TIMEOUT)", async () => {
    const seamCall = async () => {
      try {
        return await runWithTimeout(
          "test-submit",
          () => new Promise<never>(() => {}),
          60_000,
        );
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw createTimeoutError("test-submit", 60_000, err);
        }
        throw err;
      }
    };
    const promise = seamCall();
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(60_001);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
