import type {
  IKadenaSeed,
  IOuroAccount,
  IPureKeypair,
  AddressBookEntry,
  UiSettings,
  DeviceVariant,
  WatchListEntry,
} from "../types/entities";

/**
 * Codex snapshot — the full persisted state of a codex at one point in
 * time. Adapters round-trip this verbatim via `loadAll()` / `saveAll()`.
 *
 * The shape is deliberately flat (no nested namespaces) so the wire
 * format remains the v1.2 codex JSON. The schema-version + last-updated
 * metadata travels alongside the entity arrays.
 */
export interface CodexSnapshot {
  kadenaSeeds: IKadenaSeed[];
  ouroAccounts: IOuroAccount[];
  pureKeypairs: IPureKeypair[];
  addressBook: AddressBookEntry[];
  watchList: WatchListEntry[];
  uiSettings: UiSettings;
  schemaVersion: number;
  lastUpdatedAt: string | null;
  lastUpdatedDevice: DeviceVariant;
}

/**
 * CodexAdapter — pluggable storage backend contract.
 *
 * Adapters own ONLY persistence — they read and write the codex snapshot
 * to/from their backing store (localStorage, IndexedDB, file system, KMS,
 * etc.). They do NOT:
 *   - Trigger browser file downloads (that's a hook concern — `useCodexBackup`).
 *   - Open OAuth flows (that's the `/google-drive` sub-export).
 *   - Encrypt/decrypt secrets (the snapshot's `kadenaSeeds[].secret`,
 *     `pureKeypairs[].encryptedPrivateKey`, etc. are already encrypted
 *     when the snapshot is passed to `saveAll()` — the hooks handle the
 *     encryption boundary via `@stoachain/stoa-core/crypto`).
 *   - Validate entity shapes (consumers' state-store actions normalize
 *     inputs before passing them through).
 *
 * Two reference implementations ship with v0.1.0:
 *   - LocalStorageCodexAdapter — browser default (window.localStorage).
 *   - MemoryCodexAdapter       — in-memory only (SSR / Next.js server / tests).
 *
 * Consumers wanting different backends (IndexedDB for larger codices,
 * Tauri secure storage for native shells, etc.) implement this interface
 * and pass to `<CodexProvider adapter={...}>`.
 *
 * All methods are async to accommodate adapters whose backend isn't
 * synchronous (file system, network-backed KMS). LocalStorage is sync
 * under the hood but its adapter wraps in `Promise.resolve()` to match
 * the interface — keeps consumer code uniform.
 *
 * Errors: throw `CodexAdapterError` (from `@stoachain/ouronet-codex/errors`)
 * with the operation name + the original cause when storage fails.
 */
export interface CodexAdapter {
  /** Stable name for the adapter (used in error messages). */
  readonly name: string;

  // ----- snapshot read/write -----

  /** Load the full codex snapshot from backing storage. If nothing is
   *  persisted yet, returns a sentinel empty snapshot with
   *  `schemaVersion: 0` and the `DEFAULT_UI_SETTINGS`. */
  loadAll(): Promise<CodexSnapshot>;

  /** Persist the full codex snapshot atomically. Updates `lastUpdatedAt`
   *  and `lastUpdatedDevice` from the snapshot's own fields — adapters
   *  do NOT auto-touch (call `touch()` explicitly for that). */
  saveAll(snapshot: CodexSnapshot): Promise<void>;

  // ----- per-entity convenience writes -----
  //
  // Avoid full-snapshot rewrite churn when only one slice changes. Each
  // call updates only its target slice in the backing store; the next
  // `loadAll()` returns the merged state. Adapters MAY implement these
  // as wrappers around `saveAll()` if their backend doesn't support
  // partial writes — semantics are equivalent.

  saveKadenaSeeds(seeds: IKadenaSeed[]): Promise<void>;
  saveOuroAccounts(accounts: IOuroAccount[]): Promise<void>;
  savePureKeypairs(keypairs: IPureKeypair[]): Promise<void>;
  saveAddressBook(entries: AddressBookEntry[]): Promise<void>;
  saveWatchList(entries: WatchListEntry[]): Promise<void>;
  saveUiSettings(settings: UiSettings): Promise<void>;

  // ----- metadata -----

  /** Mark the codex as just-updated; returns the new metadata values so
   *  callers can update in-memory state without a re-read. */
  touch(
    deviceVariant: DeviceVariant
  ): Promise<{ lastUpdatedAt: string; lastUpdatedDevice: DeviceVariant }>;

  /** Current schema version (in-band, not the v1.2 file format version —
   *  this is a CODEX-local upgrade counter for in-place migrations
   *  performed by hooks at boot). */
  getSchemaVersion(): Promise<number>;
  setSchemaVersion(v: number): Promise<void>;

  // ----- encrypted UI settings sidecar -----
  //
  // UI settings live as plain JSON in the main snapshot for backwards-
  // compat with existing OuronetUI codices. The encrypted variant is an
  // optional sidecar — populated by `useCodexAuth` after the user
  // authenticates, so settings can include private prefs without leaking.
  // Adapters that don't support encryption can throw `CodexAdapterError`
  // on these methods; the hook layer handles the absence gracefully.

  loadUiSettingsEncrypted(password: string): Promise<UiSettings | null>;
  saveUiSettingsEncrypted(
    settings: UiSettings,
    password: string
  ): Promise<void>;

  // ----- destructive -----

  /** Wipe ALL codex data from the backing store. Used by "reset codex"
   *  flows + by tests for cleanup between cases. */
  clearAll(): Promise<void>;
}

/** Sentinel empty snapshot. Adapters return this from `loadAll()` when
 *  nothing has been persisted yet. */
import { DEFAULT_UI_SETTINGS } from "../types/entities";

export function emptySnapshot(deviceVariant: DeviceVariant): CodexSnapshot {
  return {
    kadenaSeeds: [],
    ouroAccounts: [],
    pureKeypairs: [],
    addressBook: [],
    watchList: [],
    uiSettings: { ...DEFAULT_UI_SETTINGS },
    schemaVersion: 0,
    lastUpdatedAt: null,
    lastUpdatedDevice: deviceVariant,
  };
}
