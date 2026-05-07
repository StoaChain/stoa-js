"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicKeyFromLegacySecretKey = exports.encryptLegacySecretKey = void 0;
const index_js_1 = require("../../index.cjs");
async function encryptLegacySecretKey(password, secretKey) {
    const xpub = secretKey.slice(64, 96);
    const encryptedSecret = await (0, index_js_1.kadenaEncrypt)(password, secretKey);
    // Add public key to the encrypted secret
    const encrypted = Buffer.from(encryptedSecret, 'base64').toString();
    const publicKey = Buffer.from(xpub).toString('base64');
    const result = Buffer.from(`${encrypted}.${publicKey}`).toString('base64');
    return result;
}
exports.encryptLegacySecretKey = encryptLegacySecretKey;
function getPublicKeyFromLegacySecretKey(secretKey) {
    // prettier-ignore
    const publicKeyBase64 = Buffer.from(secretKey, 'base64').toString().split('.').pop();
    if (publicKeyBase64 === undefined)
        throw Error('Invalid secret key');
    return Buffer.from(publicKeyBase64, 'base64').toString('hex');
}
exports.getPublicKeyFromLegacySecretKey = getPublicKeyFromLegacySecretKey;
//# sourceMappingURL=encryption.js.map