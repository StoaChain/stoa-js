"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaGenKeypairFromSeed = void 0;
const kadenaEncryption_js_1 = require("../utils/kadenaEncryption.cjs");
const isDerivationPathTemplateValid_js_1 = require("./utils/isDerivationPathTemplateValid.cjs");
const sign_js_1 = require("./utils/sign.cjs");
async function genKeypairFromSeed(password, seedBuffer, index, derivationPathTemplate) {
    if (!(0, isDerivationPathTemplateValid_js_1.isDerivationPathTemplateValid)(derivationPathTemplate)) {
        throw new Error('Invalid derivation path template.');
    }
    const derivationPath = derivationPathTemplate.replace('<index>', index.toString());
    const { publicKey, privateKey } = (0, sign_js_1.deriveKeyPair)(seedBuffer, derivationPath);
    const encryptedPrivateKey = await (0, kadenaEncryption_js_1.kadenaEncrypt)(password, Buffer.from(privateKey, 'hex'));
    return [publicKey, encryptedPrivateKey];
}
/**
 * Generates a key pair from a seed buffer and an index or range of indices, and optionally encrypts the private key.
 * it uses bip44 m'/44'/626'/${index}' derivation path
 *
 * @param {Uint8Array} seedBuffer - The seed buffer to use for key generation.
 * @param {number | [number, number]} indexOrRange - Either a single index or a tuple with start and end indices for key pair generation.
 * @param {string} [password] - Optional password for encrypting the private key.
 * @returns {([string, string] | [string, string][])} - Depending on the input, either a tuple for a single key pair or an array of tuples for a range of key pairs, with the private key encrypted if a password is provided.
 * @throws {Error} Throws an error if the seed buffer is not provided, if the indices are invalid, or if encryption fails.
 */
async function kadenaGenKeypairFromSeed(password, seed, indexOrRange, derivationPathTemplate = `m'/44'/626'/<index>'`) {
    if (seed === undefined || seed === '') {
        throw new Error('NO_SEED: No seed provided.');
    }
    if (!(0, isDerivationPathTemplateValid_js_1.isDerivationPathTemplateValid)(derivationPathTemplate)) {
        throw new Error('Invalid derivation path template.');
    }
    const seedBuffer = await (0, kadenaEncryption_js_1.kadenaDecrypt)(password, seed);
    if (typeof indexOrRange === 'number') {
        return genKeypairFromSeed(password, seedBuffer, indexOrRange, derivationPathTemplate);
    }
    if (Array.isArray(indexOrRange)) {
        const [startIndex, endIndex] = indexOrRange;
        if (startIndex > endIndex) {
            throw new Error('The start index must be less than the end index.');
        }
        const keyPairs = [];
        for (let index = startIndex; index <= endIndex; index++) {
            const [publicKey, encryptedPrivateKey] = await genKeypairFromSeed(password, seedBuffer, index, derivationPathTemplate);
            keyPairs.push([publicKey, encryptedPrivateKey]);
        }
        return keyPairs;
    }
    throw new Error('Invalid index or range.');
}
exports.kadenaGenKeypairFromSeed = kadenaGenKeypairFromSeed;
//# sourceMappingURL=kadenaGenKeypairFromSeed.js.map