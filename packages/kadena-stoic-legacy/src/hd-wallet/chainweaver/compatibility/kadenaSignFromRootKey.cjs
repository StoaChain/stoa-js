"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaSignFromRootKey = void 0;
const index_js_1 = require("../../index.cjs");
const kadena_crypto_js_1 = require("../kadena-crypto.cjs");
const kadenaGenKeypair_js_1 = require("./kadenaGenKeypair.cjs");
/**
 * Sign a base64 message with a root key and the index of the keypair to use
 * @param password
 * @param hash // base64 hash
 * @param rootKey
 * @param index
 * @returns signature
 */
async function kadenaSignFromRootKey(password, hash, rootKey, index) {
    const { secretKey } = await (0, kadenaGenKeypair_js_1.kadenaGenKeypair)(password, rootKey, index);
    const secret = await (0, index_js_1.kadenaDecrypt)(password, secretKey);
    return (0, kadena_crypto_js_1.kadenaSign)(password, Buffer.from(hash, 'base64'), secret);
}
exports.kadenaSignFromRootKey = kadenaSignFromRootKey;
//# sourceMappingURL=kadenaSignFromRootKey.js.map