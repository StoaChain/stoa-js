import type { BinaryLike } from '../utils/crypto.cjs';
import type { EncryptedString } from '../utils/kadenaEncryption.cjs';
import type { ISignatureWithPublicKey } from './utils/sign.cjs';
/**
 * Signs a Kadena transaction with a given public and private key pair.
 *
 * @param publicKey - The public key to be used for signing the transaction.
 * @param encryptedPrivateKey - The private key to be used for signing the transaction.
 * @returns A function that takes an unsigned command (`IUnsignedCommand`) and returns an object with an array of signatures.
 * @public
 */
export declare function kadenaSignWithKeyPair(password: BinaryLike, publicKey: string, encryptedPrivateKey: EncryptedString): (hash: string) => Promise<ISignatureWithPublicKey>;
/**
 * Signs a Kadena transaction with a seed and index.
 *
 * @param seed - The encrypted seed used to derive key pairs for signing.
 * @param index - The index number used to select the correct key pair from the derived set.
 * @returns A function that takes an unsigned command (`IUnsignedCommand`) and returns an object with an array of signatures.
 * @public
 */
export declare function kadenaSignWithSeed(password: BinaryLike, seed: BinaryLike, index: number, derivationPathTemplate?: string): (hash: string) => Promise<ISignatureWithPublicKey>;
/**
 * Signs a Kadena transaction with a seed and index.
 *
 * @param seed - The encrypted seed used to derive key pairs for signing.
 * @param indexRange - The index range used to select the correct key pair from the derived set.
 * @returns A function that takes an unsigned command (`IUnsignedCommand`) and returns an object with an array of signatures.
 * @public
 */
export declare function kadenaSignWithSeed(password: BinaryLike, seed: BinaryLike, indexRange: number[], derivationPathTemplate?: string): (hash: string) => Promise<ISignatureWithPublicKey[]>;
/**
 * Verifies the signature for a message against a given public key using the Kadena signature verification convention.
 *
 * @param message - The message in string format to be verified.
 * @param publicKey - The public key in hexadecimal string format to verify the signature against.
 * @param signature - The signature in hexadecimal string format to be verified.
 * @returns Returns true if verification succeeded or false if it failed.
 * @public
 */
export declare function kadenaVerify(message: BinaryLike, publicKey: string, signature: string): boolean;
//# sourceMappingURL=kadenaSign.d.ts.map