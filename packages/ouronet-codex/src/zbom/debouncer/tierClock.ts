/**
 * tierClock — minimal singleton visual tier clock for the ZbomDebouncer bar.
 *
 * OuronetUI drives the 7 tier circles from `pactQueryCache.getTierState(tier)`.
 * The package deliberately does NOT own that global cache subsystem (the D3
 * decision — see `useZbomInfoRead.ts`), so this is a faithful VISUAL shim:
 * each tier's ring counts down from its interval and resets, ticking a
 * subscription so the bar animates identically to My Codex. Tier T1 (interval
 * 0) is event-driven — `triggerPostTx()` flashes T4 (post-tx propagation),
 * matching the cache's behaviour without the real fetch machinery.
 */

import { getTierInterval, type PactQueryTier } from "./pactQueryTiers.js";

export interface TierClockState {
  /** Seconds until this tier's next cycle boundary (0 for interval-0 tiers). */
  remaining: number;
  /** True briefly after a post-tx trigger (T4 flash). */
  isFetching: boolean;
  /** >0 marks the tier as "active" so its ring renders colored. */
  queryCount: number;
}

let _listeners: Array<() => void> = [];
let _interval: ReturnType<typeof setInterval> | null = null;
let _t4FlashUntil = 0;

function _notify() {
  for (const fn of _listeners) fn();
}

function _start() {
  if (_interval) return;
  _interval = setInterval(_notify, 200);
}

function _stop() {
  if (_interval && _listeners.length === 0) {
    clearInterval(_interval);
    _interval = null;
  }
}

export const tierClock = {
  subscribe(fn: () => void): () => void {
    _listeners.push(fn);
    _start();
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
      _stop();
    };
  },

  getTierState(tier: PactQueryTier): TierClockState {
    const interval = getTierInterval(tier);
    const remaining =
      interval <= 0 ? 0 : interval - ((Date.now() / 1000) % interval);
    const isFetching = tier === "T4" && Date.now() < _t4FlashUntil;
    return { remaining, isFetching, queryCount: 1 };
  },

  /** Post-tx propagation flash — mirrors `pactQueryCache.triggerPostTx()`. */
  triggerPostTx(): void {
    _t4FlashUntil = Date.now() + 800;
    _notify();
  },
};
