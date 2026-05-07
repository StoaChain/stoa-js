"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaGetPublic = void 0;
const encryption_js_1 = require("./encryption.cjs");
const kadenaGetPublic = (secretKey) => {
    return (0, encryption_js_1.getPublicKeyFromLegacySecretKey)(secretKey);
};
exports.kadenaGetPublic = kadenaGetPublic;
//# sourceMappingURL=kadenaGetPublic.js.map