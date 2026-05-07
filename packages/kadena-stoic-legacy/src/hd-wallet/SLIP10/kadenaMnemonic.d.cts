import type { BinaryLike } from '../utils/crypto.cjs';
/**
 * Generates a mnemonic phrase using the BIP39 protocol with a specified wordlist.
 *
 * @returns A valid BIP39 mnemonic phrase.
 * @throws If the generated mnemonic is invalid.
 * @public
 */
export declare function kadenaGenMnemonic(): string;
/**
 * Convert a given mnemonic phrase into a seed buffer.
 *
 * @param mnemonic - A mnemonic seed phrase to be converted into a seed buffer.
 * @param password - Optional password for encrypting the seed.
 * @throws Throws an error if the provided mnemonic is not valid.
 * @returns Returns the seed buffer and processed seed.
 * @public
 */
export declare function kadenaMnemonicToSeed<TEncode extends 'base64' | 'buffer' = 'base64'>(password: BinaryLike, mnemonic: string, encode?: TEncode): Promise<TEncode extends "base64" ? import("../utils/kadenaEncryption.js").EncryptedString : Uint8Array>;
/**
 * Reversible: Converts raw entropy in form of byte array to mnemonic string.
 * @param entropy - byte array
 * @returns - 12-24 words
 * @public
 * @example

* const ent = new Uint8Array([
*   0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
*   0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f
* ]);
* entropyToMnemonic(ent, wordlist);
* // 'legal winner thank year wave sausage worth useful legal winner thank yellow'

**/
export declare const kadenaEntropyToMnemonic: (entropy: Uint8Array) => string;
//# sourceMappingURL=kadenaMnemonic.d.ts.map