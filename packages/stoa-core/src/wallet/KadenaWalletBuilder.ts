/**
 * KadenaWalletBuilder — HD keypair derivation + mnemonic generation + the
 * inner AES-GCM encrypt/decrypt provided by @kadena/hd-wallet's own scheme
 * (distinct from the outer Codex encryption handled by core/crypto).
 *
 * Three derivation paths, picked by SeedType:
 *   - koala:      24-word BIP39 → kadenaMnemonicToSeed → kadenaGenKeypairFromSeed.
 *                 Output: standard 32-byte Ed25519 secretKey hex (usable by nacl).
 *   - chainweaver / eckowallet:
 *                 12-word Kadena mnemonic → kadenaMnemonicToRootKeypair →
 *                 kadenaGenKeypair. Output: an EncryptedString extended
 *                 secretKey; signing uses kadenaSign (WASM) with password
 *                 + that encrypted blob. DO NOT attempt to decrypt and
 *                 reuse the hex — Chainweaver's format isn't standard
 *                 BIP32-Ed25519 and the library owns the key lifecycle.
 *   - stoic:      NOT mnemonic-based — see
 *                 `createWalletPairFromDalosBitString` below. An
 *                 already-validated 1600-bit DALOS Genesis seed bitstring +
 *                 an index, run through `@ouronet/dalos-crypto/chainweb`'s
 *                 `generateFromBitStringAtIndex`. Output: a real RFC 8032
 *                 Ed25519 keypair and a Chainweb `k:` account name. This
 *                 path is intentionally NOT reachable through
 *                 `createWalletPairFromMnemonic` — see that method's doc
 *                 comment for why.
 *
 * Portability note: every call here is pure crypto — no React, no browser
 * globals, WebCrypto (@kadena/hd-wallet dependency) available in Node 20+.
 * Consumers instantiate the same way in both runtimes.
 */

import {
  EncryptedString,
  kadenaDecrypt,
  kadenaEncrypt,
  kadenaGenKeypairFromSeed,
  kadenaMnemonicToSeed,
} from "@stoachain/kadena-stoic-legacy/hd-wallet";
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import {
  kadenaCheckMnemonic,
  kadenaMnemonicToRootKeypair,
  kadenaGenMnemonic,
  kadenaGenKeypair,
} from "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver";
import { generateFromBitStringAtIndex } from "@ouronet/dalos-crypto/chainweb";
import type { SeedType } from "./types.js";
import { MnemonicMismatchError } from "./errors.js";

/**
 * Lowercase hex encoding for the raw `Uint8Array` keys `@ouronet/dalos-crypto`
 * hands back — kept dependency-free (no `node:buffer`) to preserve this
 * file's "no browser globals" portability guarantee end to end.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

class KadenaWalletBuilder {
  /** Standard SLIP-10 derivation from a pre-existing encrypted seed blob. */
  static async createWalletPair(
    password: string,
    seed: EncryptedString,
    index: number,
  ) {
    const wallet = await kadenaGenKeypairFromSeed(password, seed, index);
    return wallet;
  }

  /**
   * Derive a keypair directly from a mnemonic. Routes by seedType:
   *   - chainweaver / eckowallet → 12-word validation + BIP32-Ed25519
   *   - koala (default)          → 24-word BIP39 + SLIP-10 Ed25519
   * Throws on mismatched mnemonic length / checksum for the selected type.
   *
   * "stoic" is deliberately NOT a branch here. This method's contract is
   * "validate + derive from a mnemonic string" — every existing branch
   * checks a word count and a checksum before deriving. `stoic` has no
   * mnemonic at all: its input is an already-validated 1600-bit DALOS
   * Genesis seed bitstring, so there is no `bip39`/`kadenaCheckMnemonic`
   * check that could apply, and forcing the bitstring into this method's
   * `mnemonic: string` parameter would be misleading — the parameter name
   * promises a mnemonic, and callers would be passing something structurally
   * different. Use `createWalletPairFromDalosBitString` instead.
   */
  static async createWalletPairFromMnemonic(
    password: string,
    mnemonic: string,
    index: number,
    seedType: SeedType = "koala",
  ) {
    switch (seedType) {
      case "chainweaver":
      case "eckowallet": {
        if (!kadenaCheckMnemonic(mnemonic)) {
          throw new MnemonicMismatchError("Invalid 12-word Chainweaver mnemonic.");
        }
        const chainweaverSeed = await kadenaMnemonicToRootKeypair(
          password,
          mnemonic,
        );
        const wallet = await kadenaGenKeypair(password, chainweaverSeed, index);
        return {
          publicKey: wallet.publicKey,
          secretKey: wallet.secretKey,
        };
      }
      case "koala":
      default: {
        if (!bip39.validateMnemonic(mnemonic, wordlist)) {
          throw new MnemonicMismatchError("Invalid 24-word BIP39 mnemonic.");
        }
        const standardSeed = await kadenaMnemonicToSeed(password, mnemonic);
        const [publicKey, secretKey] = await kadenaGenKeypairFromSeed(
          password,
          standardSeed,
          index,
        );
        return { publicKey, secretKey };
      }
    }
  }

  /**
   * Derive a Chainweb Ed25519 keypair + `k:` account from an
   * already-validated 1600-bit DALOS Genesis seed bitstring and an index —
   * the "stoic" SeedType. This is NOT a mnemonic flow (see the doc comment
   * on `createWalletPairFromMnemonic` for why it doesn't live there): there
   * is no word count or checksum to check here, `bitString` validation is
   * the caller's responsibility (typically already done by the DALOS
   * Genesis registry before this method is ever reached), and the
   * derivation is a direct call into
   * `@ouronet/dalos-crypto/chainweb`'s `generateFromBitStringAtIndex` — no
   * WASM, no PBKDF2 round, no `@kadena/hd-wallet` involvement at all.
   *
   * Same index semantics as RSA4096's indexed generation elsewhere in this
   * ecosystem: `(bitString, index)` is a pure function — any index is
   * directly reachable without deriving the ones before it, and the same
   * pair always reproduces the same keypair.
   *
   * Return shape: `publicKey`/`secretKey` are lowercase hex strings (not
   * raw `Uint8Array`s) to match every other method on this class — koala
   * returns hex directly from `kadenaGenKeypairFromSeed`, and chainweaver's
   * `wallet.publicKey`/`wallet.secretKey` are hex-ish strings too (secretKey
   * there is an opaque `EncryptedString`, but the shape callers destructure
   * is still `{ publicKey: string, secretKey: string }`). `dalos-crypto`
   * hands back raw `Uint8Array`s instead, so this method hex-encodes both
   * before returning — anything else would make this the only method on
   * `KadenaWalletBuilder` whose return shape callers can't treat uniformly.
   * `address` is additionally surfaced (none of the other methods produce
   * one) because it's the actual spendable Chainweb account name and the
   * entire point of this derivation — recomputing it from `publicKey`
   * downstream would just be `"k:" + publicKey`, but there's no reason to
   * make every caller re-derive that themselves.
   *
   * No password, no encryption at this layer — matches `createWalletPair`
   * and `createWalletPairFromMnemonic`, both of which are pure derivation;
   * encryption-at-rest is a consumer-layer concern (see this file's header
   * comment).
   */
  static createWalletPairFromDalosBitString(
    bitString: string,
    index: number,
  ): { publicKey: string; secretKey: string; address: string } {
    const { privateKey, publicKey, address } = generateFromBitStringAtIndex(
      bitString,
      index,
    );
    return {
      publicKey: bytesToHex(publicKey),
      secretKey: bytesToHex(privateKey),
      address,
    };
  }

  /** @kadena/hd-wallet's AES-GCM wrapper — used for per-seed encrypted blobs. */
  static async encrypt(
    password: string,
    data: string,
  ): Promise<EncryptedString> {
    return await kadenaEncrypt(password, data);
  }

  static async decrypt(
    password: string,
    encryptedData: EncryptedString,
  ): Promise<Uint8Array> {
    return await kadenaDecrypt(password, encryptedData);
  }

  /** Generate a fresh mnemonic of the requested length (12 or 24 words). */
  static async generateMnemonic(length: 12 | 24): Promise<string> {
    if (length === 12) {
      return kadenaGenMnemonic();
    }
    if (length === 24) {
      return bip39.generateMnemonic(wordlist, 256);
    }
    throw new Error("Invalid mnemonic length. Use 12 or 24.");
  }

  /**
   * Validate a mnemonic. If seedType is given, checks against that derivation
   * family's word-count and checksum. Without seedType, falls back to a
   * word-count-based dispatch (12 → Chainweaver, 24 → BIP39).
   *
   * "stoic" always returns `false` here rather than falling through to the
   * koala/BIP39 branch: stoic has no mnemonic — its input is a DALOS
   * Genesis seed bitstring — so there is nothing for this method to
   * meaningfully validate. Falling through to `default` would have silently
   * run a BIP39 wordlist check against a bitstring, which happens to almost
   * always return `false` but for the wrong reason and by accident; an
   * explicit branch documents that "stoic" is simply out of scope for
   * mnemonic validation rather than relying on incidental behavior.
   */
  static async isValidMnemonic(mnemonic: string, seedType?: SeedType): Promise<boolean> {
    if (seedType) {
      switch (seedType) {
        case "chainweaver":
        case "eckowallet":
          return kadenaCheckMnemonic(mnemonic);
        case "stoic":
          return false;
        case "koala":
        default:
          return bip39.validateMnemonic(mnemonic, wordlist);
      }
    }

    const words = mnemonic.trim().split(/\s+/);
    const mnemonicLength = words.length;

    if (mnemonicLength !== 12 && mnemonicLength !== 24) {
      return false;
    }
    if (mnemonicLength === 12) {
      return kadenaCheckMnemonic(mnemonic);
    }
    return bip39.validateMnemonic(mnemonic, wordlist);
  }
}

export default KadenaWalletBuilder;
