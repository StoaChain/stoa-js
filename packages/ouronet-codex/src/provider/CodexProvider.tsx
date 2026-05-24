/**
 * <CodexProvider> — Phase 5 minimal stub.
 *
 * Provides a per-mount Zustand store + React Context so hooks can
 * subscribe to codex state. Auto-initialises the store with the supplied
 * adapter on mount.
 *
 * Phase 5 scope (this file): adapter wiring + init lifecycle + context
 * exposure. Phase 7 will add:
 *   - passwordCacheMinutes prop (initial UiSettings override)
 *   - onCodexDirty callback prop
 *   - signingClient prop (override default PactClient construction)
 *   - auto-rendered <PasswordModal> (when Phase 6 components ship)
 *   - initialUiSettings prop
 *   - SSR-safe placeholder shell when running on the server
 *
 * Why per-mount store (not module-level singleton): tests need isolation
 * across cases, and the architectural decision in spec §4 is "one
 * codex per app" — but that "one" lives inside the provider, not the
 * module. Two providers in the same React tree would each get their
 * own store; the hooks subscribe via the nearest context.
 *
 * Why an effect (not synchronous init): adapter.loadAll() is async.
 * Synchronous init would force consumers to gate every hook on a
 * "ready" flag they don't yet have access to. By initialising in an
 * effect we expose the same isReady/isLocked pair through useCodex()
 * — the rendering pattern consumers already know from auth-context
 * (`if (!isReady) return <Spinner />`).
 */

import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { CodexAdapter } from "../adapters/types";
import type { CodexStoreState } from "../state/store";
import { createCodexStore } from "../state/store";
import type { DeviceVariant } from "../types/entities";

export interface CodexProviderProps {
  /** Storage backend for the codex. Required. Pass `new LocalStorageCodexAdapter()`
   *  for browser apps, `new MemoryCodexAdapter()` for tests/SSR. */
  adapter: CodexAdapter;

  /** Device-variant marker stamped on every touch(). Defaults to "dev"
   *  to match the store's initial state — Vite consumers usually pass
   *  `import.meta.env.VITE_APP_VARIANT` here. */
  deviceVariant?: DeviceVariant;

  children: ReactNode;
}

type CodexStore = UseBoundStore<StoreApi<CodexStoreState>>;

const CodexStoreContext = createContext<CodexStore | null>(null);

/**
 * Provider component. Place once at the app root inside your error
 * boundary but outside any code that uses codex hooks.
 *
 * ```tsx
 * <CodexProvider adapter={new LocalStorageCodexAdapter()}>
 *   <App />
 * </CodexProvider>
 * ```
 */
export function CodexProvider({
  adapter,
  deviceVariant = "dev",
  children,
}: CodexProviderProps): React.JSX.Element {
  // Per-mount store. `useRef` keeps the same instance across re-renders
  // while still being unique per provider mount (which a useMemo with
  // [] deps would also do, but useRef is the canonical "lazy singleton
  // per component instance" pattern).
  const storeRef = useRef<CodexStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createCodexStore();
  }
  const store = storeRef.current;

  // Initialise the store with the supplied adapter exactly once.
  // Subsequent changes to `adapter` are intentionally ignored — adapter
  // swap is a destructive operation (different storage = different
  // codex); consumers wanting that should remount the provider.
  useEffect(() => {
    // Fire-and-forget. Errors surface on state.initError, which hooks
    // can read via useCodex().
    void store.getState().actions.init(adapter, deviceVariant);
    // We deliberately only depend on `store` (which never changes) — see
    // comment above re: ignored adapter changes after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // Memoise the context value so children don't re-render on every
  // provider render (storeRef.current is stable but the JSX prop
  // identity would change without useMemo).
  const value = useMemo(() => store, [store]);

  return (
    <CodexStoreContext.Provider value={value}>
      {children}
    </CodexStoreContext.Provider>
  );
}

/**
 * Internal hook — returns the per-mount store. Used by every public
 * hook in this package to read/subscribe to codex state. NOT exported
 * as part of the public API; consumers go through the typed hooks in
 * @stoachain/ouronet-codex/hooks instead.
 *
 * Throws if called outside a <CodexProvider>.
 */
export function useCodexStore(): CodexStore {
  const store = useContext(CodexStoreContext);
  if (store === null) {
    throw new Error(
      "useCodexStore: missing <CodexProvider>. Wrap your app at the root, e.g. " +
        "<CodexProvider adapter={new LocalStorageCodexAdapter()}>{...}</CodexProvider>."
    );
  }
  return store;
}
