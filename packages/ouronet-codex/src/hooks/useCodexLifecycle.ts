/**
 * useCodexLifecycle — codex-level kickstart / recovery actions (v0.2.0+).
 *
 * The package-owned half of the "first codex creation" flow. Consumers
 * derive keypairs upstream (DALOS via stoa-core for the prime ouro,
 * KadenaWalletBuilder for the prime kadena seed), then call
 * `kickstart(args)` to atomically install both as the codex's prime
 * pair. The package handles isPrime flagging, parentSeedId linkage,
 * activeKadenaWalletId / activeOuroAccountId selection, and persistence.
 *
 * Usage (OuronetUI / AncientHoldings):
 *
 *   const { kickstart } = useCodexLifecycle();
 *   const { seed, primeOuro } = await kickstart({
 *     seed: { id, name, secret, main, accounts, ... },          // pre-formed
 *     primeOuroAccount: { id, address, secret, backup, ... },   // pre-derived
 *   });
 *   // Codex now has exactly one IKadenaSeed (isPrime: true) and one
 *   // IOuroAccount (isPrime: true, parentSeedId: seed.id). Both
 *   // structurally undeletable.
 *
 * Recovery uses the same shape:
 *
 *   const { recover } = useCodexLifecycle();
 *   await recover(args); // idempotent if codex already has the same prime
 *
 * See docs/v0.2.0-design.md §5.2 and §5.3 for the full contract.
 */

import { useCodexStore } from "../provider/index.js";
import type { KickstartArgs, KickstartResult } from "../state/store.js";

export interface CodexLifecycleView {
  /** Atomically install the Prime Codex Seed + CodexPrime ouro account
   *  on an empty codex. Throws `CodexKickstartError` if the codex
   *  already has a prime seed, or if the ouro is a Smart account. */
  kickstart: (args: KickstartArgs) => Promise<KickstartResult>;
  /** Recovery-flow variant — allows re-installing the same prime pair
   *  on a non-empty codex (idempotent), but refuses if the existing
   *  prime has a different id. */
  recover: (args: KickstartArgs) => Promise<KickstartResult>;
}

export function useCodexLifecycle(): CodexLifecycleView {
  const store = useCodexStore();
  const actions = store((s) => s.actions);
  return {
    kickstart: actions.kickstartCodex,
    recover: actions.recoverCodexFromMnemonic,
  };
}
