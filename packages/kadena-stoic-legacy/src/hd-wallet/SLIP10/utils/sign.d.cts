export interface ISignatureWithPublicKey {
    sig: string;
    pubKey: string;
}
/**
 * Derive a key pair using a seed and an index. the seed need to be decrypted before using this function.
 * @param seed - The seed for key derivation.
 * @param index - The index for key derivation.
 * @returns Returns the derived private and public keys.
 * @internal
 */
export declare const deriveKeyPair: (seed: Uint8Array, derivationPath: string) => {
    privateKey: string;
    publicKey: string;
};
/**
 * Creates a signer function for a given public and secret key pair.
 *
 * @function
 * @param {string} publicKey - The public key for signing.
 * @param {string} [secretKey] - The optional secret key for signing.
 * @returns {Function} A function that takes an unsigned command and returns the command with its signature.
 *
 * @example
 * const signer = signWithKeyPair('myPublicKey', 'mySecretKey');
 * const signedCommand = signer(myUnsignedCommand);
 *
 * @throws {Error} Throws an error if the signature is undefined.
 */
export declare const signWithKeyPair: (publicKey: string, secretKey: string) => (hash: string) => {
    sig: string;
    pubKey: string;
};
/**
 * Generate a signer function using a seed and an index.
 * @param {Uint8Array} seed - The seed for key derivation.
 * @param {number} index - The index for key derivation.
 * @returns {(tx: IUnsignedCommand) => { sigs: { sig: string }[] }} - Returns a function that can sign a transaction.
 */
export declare const signWithSeed: (seed: Uint8Array, derivationPath: string) => ((hash: string) => ISignatureWithPublicKey);
//# sourceMappingURL=sign.d.ts.map