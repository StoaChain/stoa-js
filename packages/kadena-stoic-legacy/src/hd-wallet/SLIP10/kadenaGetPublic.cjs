"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaGetPublic = void 0;
const kadenaEncryption_js_1 = require("../utils/kadenaEncryption.cjs");
const isDerivationPathTemplateValid_js_1 = require("./utils/isDerivationPathTemplateValid.cjs");
const sign_js_1 = require("./utils/sign.cjs");
function genPublicKeyFromSeed(seedBuffer, index, derivationPathTemplate) {
    if (!(0, isDerivationPathTemplateValid_js_1.isDerivationPathTemplateValid)(derivationPathTemplate)) {
        throw new Error('Invalid derivation path template.');
    }
    const derivationPath = derivationPathTemplate.replace('<index>', index.toString());
    const { publicKey } = (0, sign_js_1.deriveKeyPair)(seedBuffer, derivationPath);
    return publicKey;
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
async function kadenaGetPublic(password, seed, indexOrRange, derivationPathTemplate = `m'/44'/626'/<index>'`) {
    if (seed === undefined || seed === '') {
        throw new Error('NO_SEED: No seed provided.');
    }
    const seedBuffer = new Uint8Array(await (0, kadenaEncryption_js_1.kadenaDecrypt)(password, seed));
    if (typeof indexOrRange === 'number') {
        return genPublicKeyFromSeed(seedBuffer, indexOrRange, derivationPathTemplate);
    }
    if (Array.isArray(indexOrRange)) {
        const [startIndex, endIndex] = indexOrRange;
        if (startIndex > endIndex) {
            throw new Error('The start index must be less than the end index.');
        }
        const keyPairs = [];
        for (let index = startIndex; index <= endIndex; index++) {
            const publicKey = genPublicKeyFromSeed(seedBuffer, index, derivationPathTemplate);
            keyPairs.push(publicKey);
        }
        return keyPairs;
    }
    throw new Error('Invalid index or range.');
}
exports.kadenaGetPublic = kadenaGetPublic;
//# sourceMappingURL=kadenaGetPublic.js.map