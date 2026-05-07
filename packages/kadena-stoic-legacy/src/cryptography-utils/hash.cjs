"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hash = void 0;
const base64UrlEncodeArr_1 = require("./base64UrlEncodeArr");
const hashBin_1 = require("./hashBin");
/**
 * Takes in string, outputs blake2b256 hash encoded as unescaped base64url.
 *
 * @alpha
 */
function hash(str) {
    return (0, base64UrlEncodeArr_1.base64UrlEncodeArr)((0, hashBin_1.hashBin)(str));
}
exports.hash = hash;
//# sourceMappingURL=hash.js.map