/**
 * guardUtils.ts — Signing guard analysis engine
 *
 * Covers:
 *  - Standard predicates: keys-all, keys-any, keys-2
 *  - stoic-predicates: keys-1/3/4, at-least-N%, keys-M-of-N, all-but-one/two
 *  - Payment key classification: k: (single pubkey) vs custom (warn + console)
 *  - Guard satisfaction check: codex scan → threshold → needMore
 *  - Progressive manual key resolution
 */

import {
  publicKeyFromPrivateKey,
  publicKeyFromExtendedKey,
} from "../signing/primitives";

/**
 * A Kadena keyset guard. The three standard predicates from Pact core plus
 * any stoic-predicate string are all acceptable. `keysetRef` is present when
 * the on-chain guard is a keyset-ref-guard (e.g. "ouronet-ns.dh_sc_dpdc-keyset")
 * rather than an inline keyset.
 */
export interface IKeyset {
  readonly pred: "keys-all" | "keys-any" | "keys-2" | string;
  readonly keys: string[];
  readonly keysetRef?: string;
}

/**
 * Thrown by {@link computeThreshold} when it encounters a predicate string
 * that is not in any of the recognised tables (`keys-all` / `keys-any` /
 * `keys-2`, the stoic fixed/M-of-N/percentage tables, or the
 * `all-but-one`/`all-but-two` tolerance predicates).
 *
 * {@link analyzeGuard} catches this typed class and folds the condition
 * into the structured `predicateRecognized: false` field on the returned
 * {@link GuardAnalysis}, falling back to keys-all semantics so callers
 * who do not branch on the bit continue to get conservative behavior.
 *
 * Re-exported from `@stoachain/ouronet-core/guard` as part of the v2.3.0
 * additive public surface — supersedes the previous silent
 * console-only warning diagnostic.
 *
 * Follows the standard ES2022 `Error.cause` pattern via the optional
 * `ErrorOptions` parameter; `target: "ES2020"` with `lib: ["ES2023"]`
 * provides the `ErrorOptions` interface transitively. `this.name` is
 * set explicitly so error-name-based branching survives bundler
 * minification of the class identifier.
 */
export class UnknownPredicateError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnknownPredicateError";
  }
}

// ── Predicate tables ───────────────────────────────────────────────────────────

const STOIC_FIXED: Record<string, number> = {
  "stoa-ns.stoic-predicates.keys-1": 1,
  "stoa-ns.stoic-predicates.keys-3": 3,
  "stoa-ns.stoic-predicates.keys-4": 4,
};

const STOIC_M_OF_N: Record<string, number> = {
  "stoa-ns.stoic-predicates.keys-2-of-3": 2,
  "stoa-ns.stoic-predicates.keys-3-of-5": 3,
  "stoa-ns.stoic-predicates.keys-4-of-7": 4,
  "stoa-ns.stoic-predicates.keys-5-of-9": 5,
};

const STOIC_PCT: Record<string, number> = {
  "stoa-ns.stoic-predicates.at-least-51pct": 0.51,
  "stoa-ns.stoic-predicates.at-least-60pct": 0.60,
  "stoa-ns.stoic-predicates.at-least-66pct": 0.66,
  "stoa-ns.stoic-predicates.at-least-75pct": 0.75,
  "stoa-ns.stoic-predicates.at-least-90pct": 0.90,
};

/**
 * Compute the minimum number of signatures required to satisfy a predicate
 * given a keyset of `keyCount` keys.
 *
 * @throws {UnknownPredicateError} when `pred` is not recognised as any of
 *   the standard (`keys-all`/`keys-any`/`keys-2`), stoic fixed, stoic
 *   M-of-N, stoic percentage, or stoic tolerance predicates. {@link
 *   analyzeGuard} catches this typed class and folds it into the
 *   `predicateRecognized: false` field on the returned analysis;
 *   {@link predicateLabel} catches it and returns a clear unknown-
 *   predicate label so the UI helper remains non-throwing.
 */
export function computeThreshold(pred: string, keyCount: number): number {
  if (keyCount === 0) return 0;

  // Standard
  if (pred === "keys-any") return 1;
  if (pred === "keys-all") return keyCount;
  if (pred === "keys-2")   return Math.min(2, keyCount);

  // Stoic fixed
  if (pred in STOIC_FIXED) return Math.min(STOIC_FIXED[pred], keyCount);

  // Stoic m-of-n
  if (pred in STOIC_M_OF_N) return Math.min(STOIC_M_OF_N[pred], keyCount);

  // Stoic percentage
  if (pred in STOIC_PCT) return Math.ceil(keyCount * STOIC_PCT[pred]);

  // Stoic tolerance
  if (pred === "stoa-ns.stoic-predicates.all-but-one") return Math.max(1, keyCount - 1);
  if (pred === "stoa-ns.stoic-predicates.all-but-two") return Math.max(1, keyCount - 2);

  throw new UnknownPredicateError(
    `computeThreshold: unrecognized predicate "${pred}"`,
  );
}

/**
 * Human-readable label for a predicate + keyset size.
 *
 * Wraps {@link computeThreshold} in a try/catch so the helper remains
 * non-throwing for UI callers — when `pred` is unrecognised the label
 * format becomes `<short> (unknown predicate, of <keyCount>)`, mirroring
 * the existing `<short> (<threshold> of <keyCount>)` shape with the
 * threshold replaced by the literal phrase "unknown predicate".
 */
export function predicateLabel(pred: string, keyCount: number): string {
  let threshold: number;
  try {
    threshold = computeThreshold(pred, keyCount);
  } catch (e) {
    if (e instanceof UnknownPredicateError) {
      const shortFallback = pred.split(".").pop() ?? pred;
      return `${shortFallback} (unknown predicate, of ${keyCount})`;
    }
    throw e;
  }
  const short = pred.split(".").pop() ?? pred;
  if (pred === "keys-any") return `keys-any (1 of ${keyCount})`;
  if (pred === "keys-all") return `keys-all (${keyCount} of ${keyCount})`;
  return `${short} (${threshold} of ${keyCount})`;
}

// ── Guard analysis ─────────────────────────────────────────────────────────────

export interface GuardAnalysis {
  /** All keys declared in the guard keyset */
  readonly keys: string[];
  readonly pred: string;
  /** Minimum signatures needed */
  readonly threshold: number;
  /**
   * `false` when the predicate string was not recognised by
   * {@link computeThreshold} (it threw {@link UnknownPredicateError}); the
   * analysis falls back to keys-all semantics in that case so callers who
   * do not branch on this bit continue to get conservative behavior.
   * Callers that DO branch on the bit can present a clear error rather
   * than silently signing under unfamiliar semantics. Supersedes the
   * previous unobservable console-only warning diagnostic in
   * {@link computeThreshold}.
   */
  readonly predicateRecognized: boolean;
  /** Keys immediately signable from Codex */
  readonly codexKeys: string[];
  /** Keys NOT found in Codex and not yet manually resolved */
  readonly foreignKeys: string[];
  /** Subset of foreignKeys that user has resolved via manual private key input */
  readonly resolvedForeignKeys: string[];
  /** Total keys currently able to sign: codexKeys + resolvedForeignKeys */
  readonly signable: number;
  /** Whether the guard is satisfied */
  readonly satisfied: boolean;
  /** How many more keys are still needed (0 when satisfied) */
  readonly neededMore: number;
  /** Human-readable predicate label */
  readonly predLabel: string;
}

/**
 * Analyze a guard keyset against the Codex pub set and any manually resolved keys.
 * Returns a fully computed GuardAnalysis with satisfaction state.
 */
export function analyzeGuard(
  guard: { keys: string[]; pred: string } | null | undefined,
  codexPubs: Set<string>,
  resolvedManualKeys: Record<string, string> = {},
): GuardAnalysis {
  if (!guard?.keys?.length) {
    return {
      keys: [], pred: "keys-all", threshold: 0,
      predicateRecognized: true,
      codexKeys: [], foreignKeys: [], resolvedForeignKeys: [],
      signable: 0, satisfied: true, neededMore: 0, predLabel: "—",
    };
  }

  let threshold: number;
  let predicateRecognized = true;
  try {
    threshold = computeThreshold(guard.pred, guard.keys.length);
  } catch (e) {
    if (e instanceof UnknownPredicateError) {
      predicateRecognized = false;
      threshold = guard.keys.length; // keys-all fallback (mirrors pre-throw behavior)
    } else {
      throw e;
    }
  }

  const codexKeys: string[]   = [];
  const foreignKeys: string[] = [];

  for (const key of guard.keys) {
    (codexPubs.has(key) ? codexKeys : foreignKeys).push(key);
  }

  const resolvedForeignKeys = foreignKeys.filter(k => !!resolvedManualKeys[k]);
  const signable    = codexKeys.length + resolvedForeignKeys.length;
  const satisfied   = signable >= threshold;
  const neededMore  = Math.max(0, threshold - signable);

  return {
    keys: guard.keys,
    pred: guard.pred,
    threshold,
    predicateRecognized,
    codexKeys,
    foreignKeys,
    resolvedForeignKeys,
    signable,
    satisfied,
    neededMore,
    predLabel: predicateLabel(guard.pred, guard.keys.length),
  };
}

// ── Payment key classification ─────────────────────────────────────────────────

export type PaymentKeyType = "k-account" | "custom-account";

export interface PaymentKeyInfo {
  readonly address: string;
  readonly type: PaymentKeyType;
  /** Only defined for k-account: the raw pubkey (address without "k:") */
  readonly pubkey: string | null;
}

/**
 * Determine if a payment key address is a standard k: account (single known pubkey)
 * or a custom account (c:, u:, w:, named — cannot reliably derive pubkey).
 */
export function classifyPaymentKey(address: string | null): PaymentKeyInfo | null {
  if (!address) return null;
  if (address.startsWith("k:")) {
    return { address, type: "k-account", pubkey: address.slice(2) };
  }
  return { address, type: "custom-account", pubkey: null };
}

// ── Codex pub set ──────────────────────────────────────────────────────────────

/** Build a Set of all public keys present in the wallet Codex (seeds + pure keypairs) */
export function buildCodexPubSet(
  kadenaSeeds: any[] | undefined,
  kadenaAccounts: any[] | undefined,
  pureKeypairs?: any[] | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const s of (kadenaSeeds ?? [])) {
    for (const a of (s.accounts ?? [])) {
      if (a.publicKey) set.add(a.publicKey);
    }
  }
  for (const a of (kadenaAccounts ?? [])) {
    if (a.publicKey) set.add(a.publicKey);
  }
  for (const kp of (pureKeypairs ?? [])) {
    if (kp.publicKey) set.add(kp.publicKey);
  }
  return set;
}

// ── Manual key derivation ──────────────────────────────────────────────────────

/**
 * Try to derive a public key from a raw private key string.
 * Supports 64-char (Ed25519) and 128-char (extended) formats.
 * Returns null if the input is not a valid private key.
 */
export function tryDerivePublicKey(priv: string): string | null {
  try {
    if (priv.length === 128) return publicKeyFromExtendedKey(priv.slice(0, 64));
    if (priv.length === 64)  return publicKeyFromPrivateKey(priv);
    return null;
  } catch {
    return null;
  }
}

// ── Gas station / caps key selection ──────────────────────────────────────────

/**
 * Select the best key for signing capabilities (CAPS zone):
 *  1. Payment key pubkey (if in Codex) — highest priority
 *  2. Any Codex key not used for pure guard signing
 *  3. null if no eligible key found
 *
 * Returns null if payment key pubkey is in pure signing set (warn user — "impossible overlap").
 */
export function selectCapsSigningKey(
  paymentKeyPub: string | null,
  codexPubs: Set<string>,
  pureSigningPubs: Set<string>,
): {
  key: string | null;
  isPaymentKey: boolean;
  impossible: boolean;
} {
  // Best case: payment key is in Codex and NOT in pure signing
  if (paymentKeyPub && codexPubs.has(paymentKeyPub) && !pureSigningPubs.has(paymentKeyPub)) {
    return { key: paymentKeyPub, isPaymentKey: true, impossible: false };
  }

  // Fallback: any Codex key not used for pure signing
  for (const pub of codexPubs) {
    if (!pureSigningPubs.has(pub)) {
      return { key: pub, isPaymentKey: false, impossible: false };
    }
  }

  // Worst case: payment key pub is in pure signing — tx impossible without guard rotation
  if (paymentKeyPub && pureSigningPubs.has(paymentKeyPub)) {
    return { key: null, isPaymentKey: true, impossible: true };
  }

  return { key: null, isPaymentKey: false, impossible: false };
}
