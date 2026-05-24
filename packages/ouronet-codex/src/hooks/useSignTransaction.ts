/**
 * useSignTransaction — CFM strategy wrapper.
 *
 * Replaces OuronetUI's useCFMStrategy hook. Composes:
 *   - InternalCodexResolver bound to the per-mount codex store
 *   - PactClient built from kadena-stoic-legacy's createClient(getPactUrl)
 *     — same construction OuronetUI does today, just lifted into the
 *     package so consumers don't reimplement it
 *
 * The composed CodexSigningStrategy is memoised against:
 *   - store identity (rebuilt across provider remounts)
 *   - selectedNode + customNodeUrl (rebuilt when user switches node)
 *
 * Same memo-invalidation rule OuronetUI's useCFMStrategy uses; without
 * it, an open modal would stay pinned to whichever node was active when
 * it mounted.
 */

import { useMemo } from "react";
import { createClient } from "@stoachain/kadena-stoic-legacy/client";
import { CodexSigningStrategy } from "@stoachain/stoa-core/signing";
import { getPactUrl, KADENA_CHAIN_ID } from "@stoachain/stoa-core/constants";

import { useCodexStore } from "../provider";
import { InternalCodexResolver } from "../resolver/InternalCodexResolver";
import type { InternalCodexResolverOptions } from "../resolver/InternalCodexResolver";

export interface UseSignTransactionOptions {
  /** Optional foreign-key resolver — passed to the InternalCodexResolver
   *  constructor. Default (omitted) makes foreign-key signing fail-fast. */
  requestForeignKey?: InternalCodexResolverOptions["requestForeignKey"];
}

export interface SignTransactionView {
  /** The composed CodexSigningStrategy. Exposed for consumers needing
   *  lower-level access (the package's own components use it directly). */
  strategy: CodexSigningStrategy;
  /** Convenience pass-through to strategy.execute. Stable identity. */
  execute: CodexSigningStrategy["execute"];
  /** Convenience pass-through to strategy.sign. Stable identity. */
  sign: CodexSigningStrategy["sign"];
}

export function useSignTransaction(
  options: UseSignTransactionOptions = {}
): SignTransactionView {
  const store = useCodexStore();
  // Subscribe to node-related uiSettings so client rebuilds when user
  // switches node. The actual node URL is resolved at hook-render-time
  // via getPactUrl, which reads stoa-core's network module — that
  // module also reflects the uiSettings via consumer-side glue.
  const selectedNode = store((s) => s.uiSettings.selectedNode);
  const customNodeUrl = store((s) => s.uiSettings.customNodeUrl);
  const requestForeignKey = options.requestForeignKey;

  const strategy = useMemo(() => {
    const resolver = new InternalCodexResolver(store, { requestForeignKey });
    const pactClient = createClient(getPactUrl(KADENA_CHAIN_ID));
    return new CodexSigningStrategy(resolver, pactClient as any);
    // selectedNode + customNodeUrl rebuild the memo so that swapping
    // nodes mid-session takes effect on next execute() call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selectedNode, customNodeUrl, requestForeignKey]);

  // execute/sign are bound to the strategy instance — pre-bind so
  // callers can destructure without losing `this`.
  return useMemo(
    () => ({
      strategy,
      execute: strategy.execute.bind(strategy),
      sign: strategy.sign.bind(strategy),
    }),
    [strategy]
  );
}
