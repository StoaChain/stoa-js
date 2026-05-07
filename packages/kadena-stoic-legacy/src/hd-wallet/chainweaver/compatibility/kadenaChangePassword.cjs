"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaChangePassword = void 0;
const index_js_1 = require("../../index.cjs");
const kadena_crypto_js_1 = require("../kadena-crypto.cjs");
const encryption_js_1 = require("./encryption.cjs");
const kadenaChangePassword = async (secretKey, oldPassword, newPassword) => {
    const newSecretKey = await (0, kadena_crypto_js_1.kadenaChangePassword)(await (0, index_js_1.kadenaDecrypt)(oldPassword, secretKey), oldPassword, newPassword);
    return (0, encryption_js_1.encryptLegacySecretKey)(newPassword, newSecretKey);
};
exports.kadenaChangePassword = kadenaChangePassword;
//# sourceMappingURL=kadenaChangePassword.js.map