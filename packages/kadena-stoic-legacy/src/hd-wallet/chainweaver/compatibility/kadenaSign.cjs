"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaSign = void 0;
const index_js_1 = require("../../index.cjs");
const kadena_crypto_js_1 = require("../kadena-crypto.cjs");
const kadenaSign = async (password, hash, // base64 message
secretKey) => {
    return await (0, kadena_crypto_js_1.kadenaSign)(password, Buffer.from(hash, 'base64'), await (0, index_js_1.kadenaDecrypt)(password, secretKey));
};
exports.kadenaSign = kadenaSign;
//# sourceMappingURL=kadenaSign.js.map