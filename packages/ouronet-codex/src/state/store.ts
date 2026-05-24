import { create } from "zustand";
import type { StoreApi, UseBoundStore } from "zustand";
import type {
  IKadenaSeed,
  IOuroAccount,
  IPureKeypair,
  AddressBookEntry,
  WatchListEntry,
  UiSettings,
  DeviceVariant,
} from "../types/entities";
import { DEFAULT_UI_SETTINGS } from "../types/entities";
import type { CodexAdapter } from "../adapters/types";
import {
  CodexLockedError,
  CodexPrimeProtectedError,
  CodexPasswordError,
} from "../errors/types";

/**
 * Internal Zustand store backing the CodexProvider. Consumers DO NOT
 * import from this module directly — they read state via hooks (which
 * subscribe to slices of this store) and mutate via the actions
 * exposed on those hooks.
 *
 * State shape mirrors §6 of the spec:
 *   - ready / locked     hydration + auth state
 *   - codex content      persisted entities (mirrors adapter state)
 *   - runtime            active wallet, password cache, dirty bit, schema
 *   - actions            namespace of mutators (each touches state + adapter)
 *
 * Why a namespaced actions object instead of flat-mutators-on-state:
 *   The state slice is what consumers subscribe to. Keeping actions in
 *   their own object means a subscriber that depends only on `kadenaSeeds`
 *   doesn't re-render when an unrelated action reference changes.
 *   (Zustand's selector-shallow check handles this either way, but the
 *   convention reads more clearly when state and actions are separated.)
 *
 * Why store the adapter on the store rather than as a hook closure:
 *   The provider injects exactly one adapter for the lifetime of the
 *   app. Storing it on the store means actions can call adapter methods
 *   without prop-drilling. The adapter is set once at `init()` time;
 *   re-mounting the provider with a different adapter requires a reset
 *   (intentional — adapter swap is a destructive operation).
 */

export interface PasswordCacheEntry {
  value: string;
  expiresAt: number; // epoch ms
}

/**
 * A pending request for the user to enter their password — the
 * mechanism by which <PasswordModal> "self-shows" when an operation
 * needs an unlocked codex.
 *
 * Lifecycle:
 *   1. A hook (e.g. useRequestPassword) calls actions.requestPassword().
 *      The store sets `pendingPasswordRequest` to a fresh entry.
 *   2. <PasswordModal> subscribes; when the slice becomes non-null it
 *      renders its form.
 *   3. User submits → actions.submitPasswordRequest(pw):
 *        - calls authenticate(pw, ttl)  (caches password, unlocks codex)
 *        - resolves the request's promise with `pw`
 *        - clears the slice
 *   4. User cancels → actions.cancelPasswordRequest():
 *        - rejects the request's promise with CodexLockedError
 *        - clears the slice
 *
 * Multiple concurrent requestPassword() calls dedup to a single
 * outstanding request (the slice is a single nullable, not a queue).
 * The first call sets the slice; subsequent calls receive a Promise
 * tied to the SAME pending request, so the user only sees one modal
 * regardless of how many places ask for the password simultaneously.
 */
export interface PendingPasswordRequest {
  id: string;
  createdAt: number;
  resolve: (password: string) => void;
  reject: (error: unknown) => void;
}

export interface CodexStoreState {
  // Hydration
  ready: boolean;
  initError: Error | null;

  // Auth
  locked: boolean;
  passwordCache: PasswordCacheEntry | null;

  // Password prompt — single outstanding request at a time. See
  // PendingPasswordRequest JSDoc for the lifecycle.
  pendingPasswordRequest: PendingPasswordRequest | null;

  // Codex content (mirrors adapter)
  kadenaSeeds: IKadenaSeed[];
  pureKeypairs: IPureKeypair[];
  ouroAccounts: IOuroAccount[];
  addressBook: AddressBookEntry[];
  watchList: WatchListEntry[];
  uiSettings: UiSettings;

  // Runtime
  activeKadenaWalletId: string | null;
  activeOuroAccountId: string | null;
  dirty: boolean;
  schemaVersion: number;
  lastUpdatedAt: string | null;
  lastUpdatedDevice: DeviceVariant;

  // Wired at init() time, used by actions for persistence.
  adapter: CodexAdapter | null;
  deviceVariant: DeviceVariant;

  actions: CodexStoreActions;
}

export interface CodexStoreActions {
  // ----- lifecycle -----
  init(adapter: CodexAdapter, deviceVariant?: DeviceVariant): Promise<void>;
  reset(): void;

  // ----- auth -----
  authenticate(password: string, ttlMinutes?: number): void;
  lock(): void;
  getPassword(): string;

  // ----- password prompt -----
  /** Request the user enters their password. Returns a Promise that
   *  resolves when the user submits (via submitPasswordRequest) or
   *  rejects when cancelled (via cancelPasswordRequest). If a request
   *  is already outstanding, returns a Promise tied to that same
   *  request — multiple callers see the same modal. */
  requestPassword(): Promise<string>;
  /** Called by <PasswordModal> on submit. Authenticates with `pw`,
   *  resolves the outstanding request's promise with `pw`, clears
   *  the slice. */
  submitPasswordRequest(pw: string, ttlMinutes?: number): void;
  /** Called by <PasswordModal> on cancel (Esc, backdrop click, etc.).
   *  Rejects the outstanding request's promise with CodexLockedError. */
  cancelPasswordRequest(): void;

  // ----- kadena seeds -----
  addKadenaSeed(seed: IKadenaSeed): Promise<void>;
  updateKadenaSeed(seed: IKadenaSeed): Promise<void>;
  deleteKadenaSeed(id: string): Promise<void>;

  // ----- pure keypairs -----
  addPureKeypair(keypair: IPureKeypair): Promise<void>;
  deletePureKeypair(id: string): Promise<void>;

  // ----- ouro accounts -----
  addOuroAccount(account: IOuroAccount): Promise<void>;
  updateOuroAccount(account: IOuroAccount): Promise<void>;
  deleteOuroAccount(id: string): Promise<void>;

  // ----- address book -----
  addAddressBookEntry(entry: AddressBookEntry): Promise<void>;
  updateAddressBookEntry(
    id: string,
    updates: Partial<Omit<AddressBookEntry, "id" | "createdAt">>
  ): Promise<void>;
  deleteAddressBookEntry(id: string): Promise<void>;

  // ----- watch list -----
  addWatchListEntry(entry: WatchListEntry): Promise<void>;
  deleteWatchListEntry(id: string): Promise<void>;

  // ----- UI settings -----
  updateUiSettings(patch: Partial<UiSettings>): Promise<void>;

  // ----- active selection -----
  setActiveKadenaWallet(id: string | null): void;
  setActiveOuroAccount(id: string | null): void;

  // ----- meta -----
  markDirty(): void;
  clearDirty(): void;
  setSchemaVersion(v: number): Promise<void>;
}

const initialState: Omit<CodexStoreState, "actions"> = {
  ready: false,
  initError: null,
  locked: true,
  passwordCache: null,
  pendingPasswordRequest: null,
  kadenaSeeds: [],
  pureKeypairs: [],
  ouroAccounts: [],
  addressBook: [],
  watchList: [],
  uiSettings: { ...DEFAULT_UI_SETTINGS },
  activeKadenaWalletId: null,
  activeOuroAccountId: null,
  dirty: false,
  schemaVersion: 0,
  lastUpdatedAt: null,
  lastUpdatedDevice: "dev",
  adapter: null,
  deviceVariant: "dev",
};

/** Factory function for the Zustand store. Exported as a factory rather
 *  than a singleton instance so each `<CodexProvider>` mount creates its
 *  own store. Two providers in the same React tree are nonsensical (one
 *  codex per app) but tests benefit from per-test isolation. */
export function createCodexStore(): UseBoundStore<StoreApi<CodexStoreState>> {
  return create<CodexStoreState>((set, get) => {
    // (note: per-action unlock checks are gated at the hook layer via
    // `_internal_requireUnlocked` — kept out of the store internals so the
    // store stays a pure state container. The store's own actions that
    // touch secrets — none today; everything secret-related is in hooks
    // — will gate at their call sites.)

    /** Helper — persist a per-entity slice via the adapter, then update
     *  metadata. Wrapped in try/catch — adapter errors surface as-is
     *  (already CodexAdapterError per the contract). */
    const persistAndTouch = async (
      saver: (a: CodexAdapter) => Promise<void>
    ): Promise<void> => {
      const adapter = get().adapter;
      if (!adapter) {
        throw new Error(
          "Codex store has no adapter wired. Call actions.init(adapter) first."
        );
      }
      await saver(adapter);
      const meta = await adapter.touch(get().deviceVariant);
      set({
        dirty: true,
        lastUpdatedAt: meta.lastUpdatedAt,
        lastUpdatedDevice: meta.lastUpdatedDevice,
      });
    };

    const actions: CodexStoreActions = {
      // ----- lifecycle -----

      async init(adapter: CodexAdapter, deviceVariant: DeviceVariant = "dev") {
        set({ adapter, deviceVariant, initError: null });
        try {
          const snap = await adapter.loadAll();
          set({
            kadenaSeeds: snap.kadenaSeeds,
            pureKeypairs: snap.pureKeypairs,
            ouroAccounts: snap.ouroAccounts,
            addressBook: snap.addressBook,
            watchList: snap.watchList,
            uiSettings: snap.uiSettings,
            schemaVersion: snap.schemaVersion,
            lastUpdatedAt: snap.lastUpdatedAt,
            lastUpdatedDevice: snap.lastUpdatedDevice,
            ready: true,
            dirty: false,
            // First account is the default active. Consumers can override
            // via setActiveOuroAccount() after init.
            activeOuroAccountId: snap.ouroAccounts[0]?.id ?? null,
            activeKadenaWalletId: snap.kadenaSeeds[0]?.id ?? null,
          });
        } catch (e) {
          set({
            ready: false,
            initError: e instanceof Error ? e : new Error(String(e)),
          });
          throw e;
        }
      },

      reset() {
        set({ ...initialState });
      },

      // ----- auth -----

      authenticate(password: string, ttlMinutes?: number) {
        const ttl = ttlMinutes ?? get().uiSettings.passwordCacheMinutes;
        const expiresAt = Date.now() + ttl * 60_000;
        set({
          passwordCache: { value: password, expiresAt },
          locked: false,
        });
      },

      lock() {
        set({ passwordCache: null, locked: true });
      },

      getPassword(): string {
        const cache = get().passwordCache;
        const now = Date.now();
        if (!cache || cache.expiresAt <= now) {
          throw new CodexLockedError("getPassword");
        }
        return cache.value;
      },

      // ----- password prompt -----

      requestPassword(): Promise<string> {
        // If a request is already outstanding, return a Promise tied to
        // the SAME pending request. This is the dedup-to-one-modal
        // contract documented in PendingPasswordRequest's JSDoc — without
        // it, two parallel hooks asking for the password would stack up
        // two modals.
        const existing = get().pendingPasswordRequest;
        if (existing) {
          return new Promise<string>((resolve, reject) => {
            // Wrap the existing handlers: when the existing request
            // resolves/rejects, fan out to this Promise too.
            const prevResolve = existing.resolve;
            const prevReject = existing.reject;
            existing.resolve = (pw) => {
              prevResolve(pw);
              resolve(pw);
            };
            existing.reject = (err) => {
              prevReject(err);
              reject(err);
            };
          });
        }

        return new Promise<string>((resolve, reject) => {
          const req: PendingPasswordRequest = {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `pwd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: Date.now(),
            resolve,
            reject,
          };
          set({ pendingPasswordRequest: req });
        });
      },

      submitPasswordRequest(pw: string, ttlMinutes?: number) {
        const req = get().pendingPasswordRequest;
        if (!req) return; // no-op if no request is outstanding
        // Authenticate (caches pw + unlocks codex), then resolve the
        // promise so the awaiting code gets the password it asked for.
        actions.authenticate(pw, ttlMinutes);
        set({ pendingPasswordRequest: null });
        req.resolve(pw);
      },

      cancelPasswordRequest() {
        const req = get().pendingPasswordRequest;
        if (!req) return;
        set({ pendingPasswordRequest: null });
        req.reject(new CodexLockedError("requestPassword"));
      },

      // ----- kadena seeds -----

      async addKadenaSeed(seed: IKadenaSeed) {
        const next = [...get().kadenaSeeds.filter((s) => s.id !== seed.id), seed];
        set({ kadenaSeeds: next });
        await persistAndTouch((a) => a.saveKadenaSeeds(next));
      },

      async updateKadenaSeed(seed: IKadenaSeed) {
        const next = get().kadenaSeeds.map((s) => (s.id === seed.id ? seed : s));
        set({ kadenaSeeds: next });
        await persistAndTouch((a) => a.saveKadenaSeeds(next));
      },

      async deleteKadenaSeed(id: string) {
        const next = get().kadenaSeeds.filter((s) => s.id !== id);
        set({ kadenaSeeds: next });
        if (get().activeKadenaWalletId === id) {
          set({ activeKadenaWalletId: next[0]?.id ?? null });
        }
        await persistAndTouch((a) => a.saveKadenaSeeds(next));
      },

      // ----- pure keypairs -----

      async addPureKeypair(keypair: IPureKeypair) {
        const next = [
          ...get().pureKeypairs.filter((k) => k.id !== keypair.id),
          keypair,
        ];
        set({ pureKeypairs: next });
        await persistAndTouch((a) => a.savePureKeypairs(next));
      },

      async deletePureKeypair(id: string) {
        const next = get().pureKeypairs.filter((k) => k.id !== id);
        set({ pureKeypairs: next });
        await persistAndTouch((a) => a.savePureKeypairs(next));
      },

      // ----- ouro accounts -----

      async addOuroAccount(account: IOuroAccount) {
        const existing = get().ouroAccounts;
        // Spec §B1: first ouro account on a fresh codex is auto-flagged
        // as CodexPrime. Subsequent adds default isPrime to false unless
        // the caller explicitly sets it.
        const isFirst = existing.length === 0;
        const enriched: IOuroAccount = {
          ...account,
          isPrime: account.isPrime ?? isFirst,
        };
        const next = [...existing.filter((a) => a.id !== enriched.id), enriched];
        set({ ouroAccounts: next });
        // Auto-activate first account if none is selected.
        if (get().activeOuroAccountId === null) {
          set({ activeOuroAccountId: enriched.id });
        }
        await persistAndTouch((a) => a.saveOuroAccounts(next));
      },

      async updateOuroAccount(account: IOuroAccount) {
        const next = get().ouroAccounts.map((a) =>
          a.id === account.id ? { ...a, ...account } : a
        );
        set({ ouroAccounts: next });
        await persistAndTouch((a) => a.saveOuroAccounts(next));
      },

      async deleteOuroAccount(id: string) {
        const target = get().ouroAccounts.find((a) => a.id === id);
        if (target?.isPrime) {
          throw new CodexPrimeProtectedError(id);
        }
        const next = get().ouroAccounts.filter((a) => a.id !== id);
        set({ ouroAccounts: next });
        if (get().activeOuroAccountId === id) {
          set({ activeOuroAccountId: next[0]?.id ?? null });
        }
        await persistAndTouch((a) => a.saveOuroAccounts(next));
      },

      // ----- address book -----

      async addAddressBookEntry(entry: AddressBookEntry) {
        const next = [
          ...get().addressBook.filter((e) => e.id !== entry.id),
          entry,
        ];
        set({ addressBook: next });
        await persistAndTouch((a) => a.saveAddressBook(next));
      },

      async updateAddressBookEntry(
        id: string,
        updates: Partial<Omit<AddressBookEntry, "id" | "createdAt">>
      ) {
        const now = new Date().toISOString();
        const next = get().addressBook.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: now } : e
        );
        set({ addressBook: next });
        await persistAndTouch((a) => a.saveAddressBook(next));
      },

      async deleteAddressBookEntry(id: string) {
        const next = get().addressBook.filter((e) => e.id !== id);
        set({ addressBook: next });
        await persistAndTouch((a) => a.saveAddressBook(next));
      },

      // ----- watch list -----

      async addWatchListEntry(entry: WatchListEntry) {
        const next = [
          ...get().watchList.filter((e) => e.id !== entry.id),
          entry,
        ];
        set({ watchList: next });
        await persistAndTouch((a) => a.saveWatchList(next));
      },

      async deleteWatchListEntry(id: string) {
        const next = get().watchList.filter((e) => e.id !== id);
        set({ watchList: next });
        await persistAndTouch((a) => a.saveWatchList(next));
      },

      // ----- UI settings -----

      async updateUiSettings(patch: Partial<UiSettings>) {
        const next: UiSettings = { ...get().uiSettings, ...patch };
        set({ uiSettings: next });
        await persistAndTouch((a) => a.saveUiSettings(next));
      },

      // ----- active selection (no persistence — runtime only) -----

      setActiveKadenaWallet(id: string | null) {
        set({ activeKadenaWalletId: id });
      },

      setActiveOuroAccount(id: string | null) {
        set({ activeOuroAccountId: id });
      },

      // ----- meta -----

      markDirty() {
        set({ dirty: true });
      },

      clearDirty() {
        set({ dirty: false });
      },

      async setSchemaVersion(v: number) {
        const adapter = get().adapter;
        if (!adapter) {
          throw new Error("Codex store has no adapter wired.");
        }
        await adapter.setSchemaVersion(v);
        set({ schemaVersion: v });
      },
    };

    return {
      ...initialState,
      actions,
    };
  });
}

/** Quiet the lint about unused requireUnlocked — kept available for the
 *  Phase 5 hooks (useSignTransaction, useGetKeypair) which need to gate
 *  on unlock state. Will be referenced from src/hooks/* once Phase 5
 *  lands; exporting from the store makes that wiring clean. */
export function _internal_requireUnlocked(
  store: UseBoundStore<StoreApi<CodexStoreState>>,
  operation: string
): string {
  const cache = store.getState().passwordCache;
  const now = Date.now();
  if (!cache || cache.expiresAt <= now) {
    throw new CodexLockedError(operation);
  }
  return cache.value;
}

/** Helper exported for hooks that need to detect a wrong password — e.g.
 *  useCodexAuth.authenticate may want to attempt decryption of a known
 *  encrypted secret to validate the password before caching it. The store
 *  itself doesn't enforce password correctness (that's a crypto operation
 *  the hooks own); this export ties the error class to the store layer
 *  for consistent imports. */
export { CodexPasswordError };
