"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaGenKeypair = void 0;
const index_js_1 = require("../../index.cjs");
const kadena_crypto_js_1 = require("../kadena-crypto.cjs");
const encryption_js_1 = require("./encryption.cjs");
const HARDENED_OFFSET = 0x80000000;
const harden = (n) => HARDENED_OFFSET + n;
async function kadenaGenOneKeypair(password, rootKey, index) {
    if (index < HARDENED_OFFSET) {
        throw new Error('Index must be hardened');
    }
    const keyPair = await (0, kadena_crypto_js_1.kadenaGenKeypair)(password, rootKey, index);
    return {
        publicKey: Buffer.from(keyPair[1]).toString('hex'),
        secretKey: await (0, encryption_js_1.encryptLegacySecretKey)(password, keyPair[0]),
    };
}
async function kadenaGenKeypair(password, rootKey, indexOrRange) {
    const decrypted = await (0, index_js_1.kadenaDecrypt)(password, rootKey);
    if (typeof indexOrRange === 'number') {
        return await kadenaGenOneKeypair(password, decrypted, harden(indexOrRange));
    }
    const [start, end] = indexOrRange;
    const keypairs = [];
    for (let i = start; i <= end; i += 1) {
        keypairs.push(await kadenaGenOneKeypair(password, decrypted, harden(i)));
    }
    return keypairs;
}
exports.kadenaGenKeypair = kadenaGenKeypair;
//# sourceMappingURL=kadenaGenKeypair.js.map