"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signWithSeed = exports.signWithKeyPair = exports.deriveKeyPair = void 0;
const cryptography_utils_1 = require("@stoachain/kadena-stoic-legacy/cryptography-utils");
const hdkey_1 = require("ed25519-keygen/hdkey");
const buffer_helpers_js_1 = require("../../utils/buffer-helpers.cjs");
/**
 * Derive a key pair using a seed and an index. the seed need to be decrypted before using this function.
 * @param seed - The seed for key derivation.
 * @param index - The index for key derivation.
 * @returns Returns the derived private and public keys.
 * @internal
 */
const deriveKeyPair = (seed, derivationPath) => {
    const key = hdkey_1.HDKey.fromMasterSeed(seed).derive(derivationPath, true);
    return {
        privateKey: (0, buffer_helpers_js_1.uint8ArrayToHex)(key.privateKey),
        publicKey: (0, buffer_helpers_js_1.uint8ArrayToHex)(key.publicKey),
    };
};
exports.deriveKeyPair = deriveKeyPair;
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
const signWithKeyPair = (publicKey, secretKey) => (hash) => {
    const { sig } = (0, cryptography_utils_1.signHash)(hash, { publicKey, secretKey });
    if (sig === undefined) {
        throw new Error('Signature is undefined');
    }
    return { sig, pubKey: publicKey };
};
exports.signWithKeyPair = signWithKeyPair;
/**
 * Generate a signer function using a seed and an index.
 * @param {Uint8Array} seed - The seed for key derivation.
 * @param {number} index - The index for key derivation.
 * @returns {(tx: IUnsignedCommand) => { sigs: { sig: string }[] }} - Returns a function that can sign a transaction.
 */
const signWithSeed = (seed, derivationPath) => {
    const { publicKey, privateKey } = (0, exports.deriveKeyPair)(seed, derivationPath);
    return (0, exports.signWithKeyPair)(publicKey, privateKey);
};
exports.signWithSeed = signWithSeed;
//# sourceMappingURL=sign.js.map