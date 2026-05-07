"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaVerify = exports.kadenaSignWithSeed = exports.kadenaSignWithKeyPair = void 0;
const cryptography_utils_1 = require("@stoachain/kadena-stoic-legacy/cryptography-utils");
const kadenaEncryption_js_1 = require("../utils/kadenaEncryption.cjs");
const isDerivationPathTemplateValid_js_1 = require("./utils/isDerivationPathTemplateValid.cjs");
const sign_js_1 = require("./utils/sign.cjs");
/**
 * Signs a Kadena transaction with a given public and private key pair.
 *
 * @param publicKey - The public key to be used for signing the transaction.
 * @param encryptedPrivateKey - The private key to be used for signing the transaction.
 * @returns A function that takes an unsigned command (`IUnsignedCommand`) and returns an object with an array of signatures.
 * @public
 */
function kadenaSignWithKeyPair(password, publicKey, encryptedPrivateKey) {
    const decryptedPrivateKey = (0, kadenaEncryption_js_1.kadenaDecrypt)(password, encryptedPrivateKey);
    decryptedPrivateKey.catch(() => {
        console.error('Could not decrypt private key');
    });
    return async (hash) => (0, sign_js_1.signWithKeyPair)(publicKey, Buffer.from(await (0, kadenaEncryption_js_1.kadenaDecrypt)(password, encryptedPrivateKey)).toString('hex'))(hash);
}
exports.kadenaSignWithKeyPair = kadenaSignWithKeyPair;
/**
 * Signs a Kadena transaction with a seed and index.
 *
 * @param seed - The seed array used to derive key pairs for signing.
 * @param index - The index number used to select the correct key pair from the derived set.
 * @returns A function that takes an unsigned command (`IUnsignedCommand`) and returns an object with an array of signatures.
 */
function kadenaSignWithSeed(password, seed, index, derivationPathTemplate = `m'/44'/626'/<index>'`) {
    const decryptedSeed = (0, kadenaEncryption_js_1.kadenaDecrypt)(password, seed);
    decryptedSeed.catch(() => {
        console.error('Could not decrypt private key');
    });
    if (!(0, isDerivationPathTemplateValid_js_1.isDerivationPathTemplateValid)(derivationPathTemplate)) {
        throw new Error('Invalid derivation path template.');
    }
    if (typeof index === 'number') {
        return async (hash) => (0, sign_js_1.signWithSeed)(await decryptedSeed, derivationPathTemplate.replace('<index>', index.toString()))(hash);
    }
    const signers = index.map((i) => async (hash) => (0, sign_js_1.signWithSeed)(await decryptedSeed, derivationPathTemplate.replace('<index>', i.toString()))(hash));
    return (hash) => Promise.all(signers.map((signer) => signer(hash)));
}
exports.kadenaSignWithSeed = kadenaSignWithSeed;
/**
 * Verifies the signature for a message against a given public key using the Kadena signature verification convention.
 *
 * @param message - The message in string format to be verified.
 * @param publicKey - The public key in hexadecimal string format to verify the signature against.
 * @param signature - The signature in hexadecimal string format to be verified.
 * @returns Returns true if verification succeeded or false if it failed.
 * @public
 */
function kadenaVerify(message, publicKey, signature) {
    // Convert the message, public key, and signature from hex string to Uint8Array
    const msgUint8Array = typeof message === 'string'
        ? Uint8Array.from(Buffer.from(message, 'hex'))
        : new Uint8Array(message);
    const publicKeyUint8Array = Uint8Array.from(Buffer.from(publicKey, 'hex'));
    const signatureUint8Array = Uint8Array.from(Buffer.from(signature, 'hex'));
    return (0, cryptography_utils_1.verifySig)(msgUint8Array, signatureUint8Array, publicKeyUint8Array);
}
exports.kadenaVerify = kadenaVerify;
//# sourceMappingURL=kadenaSign.js.map