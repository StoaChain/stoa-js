"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaGetPublicFromRootKey = void 0;
const index_js_1 = require("../../index.cjs");
const kadena_crypto_js_1 = require("../kadena-crypto.cjs");
async function kadenaGetPublicFromRootKey(password, rootKey, index) {
    const decrypted = await (0, index_js_1.kadenaDecrypt)(password, rootKey);
    const [, publicKey] = await (0, kadena_crypto_js_1.kadenaGenKeypair)(password, decrypted, index);
    return publicKey;
}
exports.kadenaGetPublicFromRootKey = kadenaGetPublicFromRootKey;
//# sourceMappingURL=kadenaGetPublicFromRootKey.js.map