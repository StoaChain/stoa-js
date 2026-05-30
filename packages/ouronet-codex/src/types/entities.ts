/**
 * Codex entity types — single source of truth for the package.
 *
 * Ported verbatim from OuronetUI's `src/ouro.d.ts` so OuronetUI can migrate
 * to importing from here without changing semantics. Field shapes match
 * what's already persisted in every existing user's localStorage; no
 * runtime migration needed when OuronetUI swaps the import paths in
 * Phase 9.
 *
 * Future evolution policy:
 *   - Additive fields only at minor bumps (consumer can ignore unknown fields).
 *   - Breaking shape changes only at major bumps with explicit codex migration.
 *   - The v1.2 codex file format (defined in @stoachain/ouronet-core/codex)
 *     is the wire-level contract; these types are the in-memory contract
 *     that hydrates from it. They share the same shape but evolve
 *     independently from the wire format (which is frozen at 1.2).
 */

/** Wallet-software origin of a kadena HD seed. Determines which signing path
 *  the universal-sign pipeline routes to (koala/foreign → nacl,
 *  chainweaver/eckowallet → WASM). */
export type SeedType = "koala" | "chainweaver" | "eckowallet";

/** DALOS-family cryptographic curve that produced an ouro account's keys.
 *  Stamped at spawn time; legacy accounts without this field fall back to
 *  address-prefix sniffing (Ѻ./Σ. → dalos, ₱./Π. → apollo). */
export type OuronetOriginCurve = "dalos" | "apollo";

/** DALOS key-generation mode that produced an ouro account. Determines how
 *  the reveal modal re-derives the account and which representation tabs
 *  are shown. */
export type OuroOriginMode =
  | "seedWords"
  | "bitmap"
  | "bitString"
  | "integerBase10"
  | "integerBase49";

/** For seedWords-origin accounts, the sub-tab the user picked at creation
 *  (cosmetic — colors the reveal-modal word grid to match creation style). */
export type OuroOriginSeedTab = "12-words" | "write-seed" | "24-words";

export interface IKeyset {
  pred: "keys-all" | "keys-any" | "keys-2";
  keys: string[];
  /** Present when guard is a keyset-ref-guard (e.g. `"ouronet-ns.dh_sc_dpdc-keyset"`). */
  keysetRef?: string;
}

/** A single account derived from a kadena HD seed. */
export interface WalletAccount {
  index: number;
  publicKey: string;
  derivationPath: string;
  guard?: string[];
}

/** A kadena HD seed (one mnemonic) with all derived accounts. The `secret`
 *  is the encrypted mnemonic (encrypted at the codex password). */
export interface IKadenaSeed {
  id: string;
  name?: string;
  seedType: SeedType;
  version: string;
  index: number;
  secret: string;
  main: string;
  createdAt: string;
  accounts: WalletAccount[];
  /** Prime Codex Seed marker (spec §B1 — see docs/v0.2.0-design.md).
   *  True for the seed that kickstarted the codex; false (or absent) for
   *  additional seeds added later. The package's `deleteKadenaSeed`
   *  throws `CodexPrimeSeedProtectedError` on `isPrime: true` seeds.
   *  There is exactly one prime seed per codex, set atomically by
   *  `kickstartCodex`. Added v0.2.0. */
  isPrime?: boolean;
}

/** A raw Pact -g keypair stored directly in the codex (not derived from a
 *  seed). The `encryptedPrivateKey` is encrypted at the codex password,
 *  same envelope as seed secrets. Signed via the `seedType: "foreign"`
 *  path in universal-sign. */
export interface IPureKeypair {
  id: string;
  label?: string;
  /** 64-char hex */
  publicKey: string;
  /** `encryptString(privateKey, codexPassword)` */
  encryptedPrivateKey: string;
  createdAt: string;
}

/** An ouro (Ѻ./Σ.) account on chain. Persisted in the codex with its
 *  encrypted secret + last-known chain state. */
export interface IOuroAccount {
  id: string;
  name?: string;
  version: string;
  isSmart: boolean;
  address: string;
  guard: IKeyset | null;
  kadenaLedger: string | null;
  /** Codex-local public key (the value the UI itself produced — source of
   *  truth for what we minted). Compare to `chainPublicKey` for the live
   *  chain-side value. */
  publicKey: string;
  secret: string;
  backup: string;
  isActive?: boolean;
  /** DALOS mode used to derive this account. */
  originMode?: OuroOriginMode;
  /** Seed-words sub-tab used at creation. Only set when `originMode === "seedWords"`. */
  originSeedTab?: OuroOriginSeedTab;
  /** On-chain public key as returned by `URC_0027_AccountSelectorMapper`.
   *  Populated live from the sync cycle. Mismatch with `publicKey`
   *  indicates an admin-level rotation or codex corruption. */
  chainPublicKey?: string;
  /** Smart-account only — the Ѻ. standard account holding sovereignty. */
  sovereign?: string;
  /** Smart-account only — the account's governor guard (any Pact shape). */
  governor?: unknown;
  /** Live payment-key guard from the URC_0027 selector (any Pact shape). */
  paymentKeyGuard?: unknown;
  /** DALOS-family curve that produced this account's keys. */
  originCurve?: OuronetOriginCurve;
  /** CodexPrime non-deletion flag (spec §B2). True for the auto-created
   *  primary account on every fresh codex; false (or absent) for all
   *  user-added accounts. The package's `useOuroAccounts().deleteAccount`
   *  hook throws `CodexPrimeProtectedError` when called on a `isPrime: true`
   *  account. */
  isPrime?: boolean;
  /** ID of the IKadenaSeed this account was derived from (v0.2.0+).
   *  Undefined for pure-keypair-derived accounts (which have no parent
   *  seed) and for legacy accounts imported from v0.1.0 backups. Set by
   *  `kickstartCodex` on the CodexPrime account so the prime-account
   *  invariant is causal ("derived from the prime seed") rather than
   *  positional ("first added wins"). See docs/v0.2.0-design.md §4.2. */
  parentSeedId?: string;
}

/** Address-book entry — a labeled recipient address for the address picker. */
export interface AddressBookEntry {
  id: string;
  name: string;
  address: string;
  notes?: string;
  type: "ouronet" | "stoa";
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

/** Codex-level UI preferences. Subset of OuronetUI's existing
 *  `walletsSlice.uiSettings` that's codex-scoped (NOT app-scoped — fields
 *  like `zbomProfile` and `poolFeeUnit` that are OuronetUI-specific stay
 *  in OuronetUI's app state). */
export interface UiSettings {
  /** How long to cache the unlocked password in memory after authenticate(). */
  passwordCacheMinutes: number;
  /** Default behavior for CFM patron-picker. */
  patronSelectionMode: "wealthiest" | "active-wallet" | "manual";
  /** Active node preset. */
  selectedNode: "node1" | "node2" | "custom";
  customNodeUrl: string;
  customNodeGasLimit: number;
  /** Pre-v0.30.x koala signing path. Legacy users may still need this on. */
  legacyKoalaSigning: boolean;
  /** Experimental APOLLO curve opt-in. */
  experimentalCurvesEnabled: boolean;
  /** Allow consumer-specific keys without forcing a typed extension here.
   *  OuronetUI stashes its DEX-specific UI settings under the same
   *  `uiSettings` umbrella historically; this escape hatch keeps that
   *  working without bloating the package's canonical type. */
  [extra: string]: unknown;
}

/** Sensible UiSettings defaults — used by adapters on first boot when
 *  nothing has been persisted yet. */
export const DEFAULT_UI_SETTINGS: UiSettings = {
  passwordCacheMinutes: 1,
  patronSelectionMode: "wealthiest",
  selectedNode: "node2",
  customNodeUrl: "",
  customNodeGasLimit: 1_600_000,
  legacyKoalaSigning: false,
  experimentalCurvesEnabled: false,
};

/** Device-variant marker — Vite consumers usually read this from
 *  `import.meta.env.VITE_APP_VARIANT`. Adapters that don't have a Vite
 *  context (Next.js, Node tests) accept it as a constructor parameter. */
export type DeviceVariant = "dev" | "main";

/** Watchlist entry — read-only observation of a chain account whose keys
 *  live elsewhere. Persisted at the codex level (round-trips with backups)
 *  but distinct from the address book (which is for transfer recipients). */
export interface WatchListEntry {
  id: string;
  label: string;
  address: string;
  type: "ouronet" | "stoa";
  createdAt: string;
}

/** A single consumer's namespaced settings registry entry (v0.3.0+).
 *
 *  The codex stores a `Record<string, IConsumerSettings>` keyed by
 *  `consumerName`, letting multiple consumer apps (OuronetUI,
 *  AncientHoldings, Mnemosyne, ...) each stash their own settings under
 *  the same codex without colliding. The `settings` payload is the escape
 *  hatch (mirrors `UiSettings[extra]`): consumer-defined keys that the
 *  package treats as opaque, keeping the canonical type unbloated. The
 *  registry container itself is the structured part; each entry's own
 *  schema evolves under the consumer's `schemaVersion`. */
export interface IConsumerSettings {
  /** Canonical consumer identifier (e.g. "OuronetUI", "AncientHoldings",
   *  "Mnemosyne"). Used as the registry key. The store action validates
   *  this against a tight ASCII identifier regex on write. */
  consumerName: string;
  /** The consumer app's own semver at the time of the write. */
  consumerVersion: string;
  /** The consumer's own settings-schema version. The store action rejects
   *  a write whose schemaVersion is strictly less than the stored entry's
   *  (downgrade protection); equal is allowed (same-version re-save). */
  schemaVersion: number;
  /** Consumer-defined opaque payload. The package never inspects these
   *  keys — they round-trip verbatim. */
  settings: Record<string, unknown>;
  /** ISO timestamp of the last write. Server-stamped by the store action
   *  (caller-supplied value is overridden) so it is a trustworthy
   *  last-write marker. */
  lastUpdatedAt: string;
}
