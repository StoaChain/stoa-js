"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaMnemonicToRootKeypair = void 0;
const index_js_1 = require("../../index.cjs");
const kadena_crypto_js_1 = require("../kadena-crypto.cjs");
const kadenaMnemonicToRootKeypair = async (password, mnemonic, encode = 'base64') => {
    const result = await (0, kadena_crypto_js_1.kadenaMnemonicToRootKeypair)(password, mnemonic);
    return (0, index_js_1.kadenaEncrypt)(password, result, encode);
};
exports.kadenaMnemonicToRootKeypair = kadenaMnemonicToRootKeypair;
//# sourceMappingURL=kadenaMnemonicToRootKeypair.js.map