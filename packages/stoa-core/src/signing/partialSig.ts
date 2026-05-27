/**
 * Multi-party partial-signature public surface — v3.3.3.
 *
 * Enables the OuronetUI workflow where a Pact transaction passes through
 * multiple signers serially, each adding their own signature without ever
 * holding the others' private keys:
 *
 *   Person A signs with key A → exports → Person B imports → signs with key B
 *   → exports → Person C imports → signs with key C → submits.
 *
 * Built on the partial-signing primitive locked by v3.3.2's
 * `tests/universal-sign.test.ts` ("partial-signing primitive (v3.3.3
 * foundation)" describe group): signing with a subset of declared signers
 * fills only those slots; other slots are left intact across re-signing
 * passes.
 *
 * Cross-party tampering defence: the export envelope embeds
 * `transaction.cmd` AND `transaction.hash`; on import,
 * `deserializePartialTransaction` recomputes blake2b-256(cmd) and rejects
 * with `TamperedHashError` if the embedded hash diverges. As a second
 * layer, `verifyExistingSignatures` checks every already-filled slot's
 * signature against the canonical hash via `nacl.sign.detached.verify`
 * — works for both nacl-direct (koala/foreign) and BIP32-WASM
 * (chainweaver/eckowallet) sigs since both are standard Ed25519 over
 * the same canonical cmd-hash bytes.
 *
 * Public surface (re-exported from `@stoachain/ouronet-core/signing`):
 *
 *   - `signPartial(tx, keypairs)` — sign with whatever keys you hold;
 *     other signer slots stay intact. Drops `onMissingKey` on purpose:
 *     partial signers commit only their own keys; foreign-key paste
 *     resolution belongs to `universalSignTransaction`.
 *   - `serializePartialTransaction(tx, metadata?)` — wrap into a
 *     versioned `PartialSigEnvelope` and stringify.
 *   - `deserializePartialTransaction(json)` — parse + format/version
 *     check + hash-integrity check. Throws `InvalidEnvelopeError` or
 *     `TamperedHashError`.
 *   - `getMissingSigners(tx)` / `getFilledSigners(tx)` — partition the
 *     declared `cmd.signers` by whether the parallel `sigs[i]` slot is
 *     filled.
 *   - `isFullySigned(tx)` — `getMissingSigners(tx).length === 0`.
 *   - `verifyExistingSignatures(tx)` — verify every filled slot's
 *     signature; returns `{allValid, invalid: [{publicKey, reason}]}`.
 *
 * Pure module. No network, no logger. Consumers wire transport (file
 * download, QR code, paste-into-chat, etc.) themselves.
 */

import nacl from "tweetnacl";
import { Buffer } from "node:buffer";
import { base64UrlDecodeArr, hash as kadenaHash } from "@stoachain/kadena-stoic-legacy/cryptography-utils";
import type { IUnsignedCommand, ICommand } from "@stoachain/kadena-stoic-legacy/types";
import {
  universalSignTransaction,
  type UniversalKeypair,
} from "./universalSign.js";

/**
 * Fixed envelope literal so consumers (and tooling) can sanity-check a
 * partial-sig export blob at a glance without parsing the JSON.
 */
export const PARTIAL_SIG_FORMAT = "ouronet-partial-sig" as const;

/**
 * Bumped only when the envelope's STRUCTURE changes in a non-backwards-
 * compatible way (added required field, renamed field, changed
 * transaction-shape contract). Adding optional `metadata.*` fields
 * does NOT require a version bump — readers ignore unknowns.
 */
export const PARTIAL_SIG_VERSION = 1 as const;

/**
 * Versioned wrapper around an `IUnsignedCommand` for transport between
 * signers. Embeds both `cmd` and `hash` so importers can verify the
 * payload hasn't been tampered with mid-flight.
 *
 * `metadata` is intentionally optional and free-form-ish — consumers can
 * stamp it with operator identity, export timestamp, freeform notes for
 * the next signer, etc., but no field is load-bearing for signing
 * correctness.
 */
export interface PartialSigEnvelope {
  readonly format: typeof PARTIAL_SIG_FORMAT;
  readonly version: typeof PARTIAL_SIG_VERSION;
  readonly transaction: IUnsignedCommand;
  readonly metadata?: {
    readonly exportedAt?: string;
    readonly exportedBy?: string;
    readonly note?: string;
  };
}

/**
 * Thrown when `deserializePartialTransaction` cannot recognise the
 * envelope as a v1 partial-sig export. Causes:
 *   - input is not valid JSON
 *   - input parses but is not a JSON object
 *   - `format` is not `"ouronet-partial-sig"`
 *   - `version` is not `1`
 *   - `transaction.cmd` / `transaction.hash` missing or wrong type
 *   - `transaction.sigs` not an array
 *
 * Always quotes the offending field NAME but never the field VALUE — an
 * envelope can carry a Pact cmd with embedded data, and surfacing those
 * into telemetry/logs would breach the export's information-disclosure
 * boundary (mirrors `deserializeCodex`'s shape-validation discipline).
 */
export class InvalidEnvelopeError extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Invalid partial-sig envelope: ${reason}`, options);
    this.name = "InvalidEnvelopeError";
  }
}

/**
 * Thrown when the envelope's embedded `transaction.hash` does NOT match
 * the blake2b-256(cmd) re-computed at import time — a tamper signal. The
 * `expected` / `actual` fields name the divergence so the operator can
 * decide whether to treat it as a UI bug, transport corruption, or
 * malicious modification.
 */
export class TamperedHashError extends Error {
  readonly expected: string;
  readonly actual: string;
  constructor(expected: string, actual: string) {
    super(
      `Partial-sig envelope hash mismatch — embedded hash does not match blake2b-256(cmd). ` +
        `Expected ${expected}, got ${actual}. The cmd may have been modified mid-flight.`,
    );
    this.name = "TamperedHashError";
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Sign a Pact transaction with whatever subset of `cmd.signers`'s keys
 * you currently hold. Slots for signers NOT covered by `keypairs` are
 * left untouched (preserved as-is from the input transaction) — and
 * already-filled slots from prior signers stay intact.
 *
 * Same routing rules as `universalSignTransaction`: koala/foreign →
 * nacl Ed25519; chainweaver/eckowallet → WASM kadenaSign.
 *
 * Drops `onMissingKey` on purpose: in the multi-party flow each signer
 * commits only their OWN keys, and a "missing" key means another party
 * will sign in their next pass — not that the current signer needs to
 * paste-resolve it. Consumers needing foreign-key paste resolution
 * during a one-shot sign should use `universalSignTransaction` directly.
 */
export async function signPartial(
  transaction: IUnsignedCommand,
  keypairs: UniversalKeypair[],
): Promise<IUnsignedCommand | ICommand> {
  return universalSignTransaction(transaction, keypairs);
}

/**
 * Wrap a partially-signed transaction into the v1 export envelope and
 * stringify it. Pretty-prints with 2-space indent because the output
 * commonly lands on disk / paste buffer / chat where a human will eyeball
 * it (mirrors `serializeCodex`'s decision).
 *
 * `metadata` is optional. Common fields are:
 *   - `exportedAt`: ISO timestamp (caller fills — keeping the function
 *     pure rather than `new Date()`-ing inside).
 *   - `exportedBy`: human-readable signer identity (operator name,
 *     account k:..., wallet device label, etc.).
 *   - `note`: freeform annotation for the next signer.
 *
 * Other fields under `metadata` are ignored on import (forwards-compat).
 */
export function serializePartialTransaction(
  transaction: IUnsignedCommand,
  metadata?: PartialSigEnvelope["metadata"],
): string {
  const envelope: PartialSigEnvelope = {
    format: PARTIAL_SIG_FORMAT,
    version: PARTIAL_SIG_VERSION,
    transaction,
    ...(metadata ? { metadata } : {}),
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parse a partial-sig export JSON string back into an `IUnsignedCommand`,
 * validating envelope shape AND hash integrity along the way.
 *
 * Throws:
 *   - `InvalidEnvelopeError` for any shape problem (not JSON, missing
 *     fields, wrong format/version literal, malformed transaction).
 *   - `TamperedHashError` if `blake2b-256(transaction.cmd)` does not
 *     equal `transaction.hash`. This is the cross-party tamper guard —
 *     a malicious or mistaken cmd modification between signers gets
 *     caught HERE rather than producing invalid signatures the chain
 *     silently rejects.
 *
 * Does NOT verify existing signatures — that's
 * `verifyExistingSignatures`'s job, called on the returned tx if the
 * caller wants a second integrity check.
 */
export function deserializePartialTransaction(json: string): IUnsignedCommand {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new InvalidEnvelopeError("not valid JSON", { cause: err });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidEnvelopeError("expected a JSON object");
  }

  const env = parsed as Record<string, unknown>;

  if (env.format !== PARTIAL_SIG_FORMAT) {
    throw new InvalidEnvelopeError(
      `unrecognised format — expected "${PARTIAL_SIG_FORMAT}"`,
    );
  }

  if (env.version !== PARTIAL_SIG_VERSION) {
    throw new InvalidEnvelopeError(
      `unsupported version — expected ${PARTIAL_SIG_VERSION}`,
    );
  }

  const tx = env.transaction;
  if (!tx || typeof tx !== "object" || Array.isArray(tx)) {
    throw new InvalidEnvelopeError("transaction field missing or not an object");
  }

  const txObj = tx as Record<string, unknown>;
  if (typeof txObj.cmd !== "string") {
    throw new InvalidEnvelopeError("transaction.cmd missing or not a string");
  }
  if (typeof txObj.hash !== "string") {
    throw new InvalidEnvelopeError("transaction.hash missing or not a string");
  }
  if (!Array.isArray(txObj.sigs)) {
    throw new InvalidEnvelopeError("transaction.sigs missing or not an array");
  }

  // Hash-integrity check: blake2b-256(cmd) must equal embedded hash.
  // `kadenaHash` produces unescaped base64URL — same encoding the chain
  // uses, same encoding `signed.hash` carries.
  const recomputed = kadenaHash(txObj.cmd);
  if (recomputed !== txObj.hash) {
    throw new TamperedHashError(txObj.hash, recomputed);
  }

  return txObj as unknown as IUnsignedCommand;
}

/**
 * Read the signer pubkeys declared in `cmd.signers`. Returns `[]` if
 * `cmd` is malformed (best-effort — mirrors `universalSignTransaction`'s
 * tolerant parse). Used by `getMissingSigners`/`getFilledSigners`.
 */
function readSignerPubKeys(transaction: IUnsignedCommand | ICommand): string[] {
  try {
    const parsed = JSON.parse(transaction.cmd);
    const signers = parsed?.signers;
    if (!Array.isArray(signers)) return [];
    return signers
      .map((s: unknown) =>
        s && typeof s === "object" && typeof (s as { pubKey?: unknown }).pubKey === "string"
          ? (s as { pubKey: string }).pubKey
          : null,
      )
      .filter((pk): pk is string => pk !== null);
  } catch {
    return [];
  }
}

/** Slot is "filled" iff `sigs[i]?.sig` is a non-empty hex string. */
function isSlotFilled(slot: IUnsignedCommand["sigs"][number]): boolean {
  if (!slot) return false;
  const sig = (slot as { sig?: string }).sig;
  return typeof sig === "string" && sig.length > 0;
}

/**
 * Return the pubkeys of declared signers whose `sigs[i]` slot is still
 * empty. Use to drive the "who needs to sign next" UI, or to short-circuit
 * `submitToChain` if any are outstanding.
 */
export function getMissingSigners(
  transaction: IUnsignedCommand | ICommand,
): string[] {
  const pubKeys = readSignerPubKeys(transaction);
  return pubKeys.filter((_, i) => !isSlotFilled(transaction.sigs[i]));
}

/**
 * Return the pubkeys of declared signers whose `sigs[i]` slot is filled.
 * Inverse of `getMissingSigners`. Use to display "X of Y signers
 * complete" status.
 */
export function getFilledSigners(
  transaction: IUnsignedCommand | ICommand,
): string[] {
  const pubKeys = readSignerPubKeys(transaction);
  return pubKeys.filter((_, i) => isSlotFilled(transaction.sigs[i]));
}

/**
 * `true` iff every declared signer slot is filled. Cheap pre-check
 * before submitting to chain — the chain itself enforces the same
 * invariant (and rejects with "Invalid signature" if any slot is
 * empty), but local guards give clearer error UX.
 */
export function isFullySigned(transaction: IUnsignedCommand | ICommand): boolean {
  return getMissingSigners(transaction).length === 0;
}

/**
 * Result of `verifyExistingSignatures`. `allValid` is true iff every
 * filled slot's sig validates against the canonical cmd-hash via
 * Ed25519. `invalid` lists each failing slot with the signer pubkey
 * and a brief reason — empty array on the all-valid happy path.
 */
export interface VerifyExistingSignaturesResult {
  readonly allValid: boolean;
  readonly invalid: ReadonlyArray<{ readonly publicKey: string; readonly reason: string }>;
}

/** Hex string → Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

/**
 * Verify every already-filled signature in the transaction's `sigs[]`
 * against the canonical cmd-hash + the corresponding `cmd.signers[i]`
 * pubkey. Empty slots are skipped (not failures). Works for both
 * nacl-direct (koala/foreign) AND WASM (chainweaver/eckowallet) sigs
 * because both are standard Ed25519 over the same hash bytes — the
 * same verification approach used by v3.3.2's
 * `tests/universal-sign.test.ts`.
 *
 * Use as a second-layer cross-party tamper check on top of
 * `deserializePartialTransaction`'s hash-integrity gate: if the cmd
 * was rewritten AND the hash was rewritten to match the new cmd, the
 * `TamperedHashError` won't fire — but every existing signature now
 * fails to verify against the new hash, and `verifyExistingSignatures`
 * surfaces that.
 */
export function verifyExistingSignatures(
  transaction: IUnsignedCommand | ICommand,
): VerifyExistingSignaturesResult {
  // Mutable local accumulator; widens to ReadonlyArray on return via covariance.
  const invalid: Array<{ publicKey: string; reason: string }> = [];
  const pubKeys = readSignerPubKeys(transaction);

  let hashBytes: Uint8Array;
  try {
    hashBytes = base64UrlDecodeArr(transaction.hash) as unknown as Uint8Array;
  } catch (err) {
    return {
      allValid: false,
      invalid: [
        {
          publicKey: "",
          reason: `transaction.hash is not valid base64url (${(err as Error).message})`,
        },
      ],
    };
  }

  for (let i = 0; i < transaction.sigs.length; i += 1) {
    const slot = transaction.sigs[i];
    if (!isSlotFilled(slot)) continue;

    const pubKey = pubKeys[i];
    if (!pubKey) {
      invalid.push({
        publicKey: "",
        reason: `signer at index ${i} not declared in cmd.signers`,
      });
      continue;
    }

    const sigHex = (slot as { sig: string }).sig;
    if (!/^[0-9a-f]+$/i.test(sigHex) || sigHex.length !== 128) {
      invalid.push({
        publicKey: pubKey,
        reason: "signature is not a 128-char hex string (Ed25519 = 64 bytes = 128 hex)",
      });
      continue;
    }

    let ok = false;
    try {
      const sigBytes = hexToBytes(sigHex);
      const pubKeyBytes = hexToBytes(pubKey);
      ok = nacl.sign.detached.verify(hashBytes, sigBytes, pubKeyBytes);
    } catch (err) {
      invalid.push({
        publicKey: pubKey,
        reason: `verification threw: ${(err as Error).message}`,
      });
      continue;
    }

    if (!ok) {
      invalid.push({
        publicKey: pubKey,
        reason: "signature failed Ed25519 verification against transaction.hash",
      });
    }
  }

  return { allValid: invalid.length === 0, invalid };
}
