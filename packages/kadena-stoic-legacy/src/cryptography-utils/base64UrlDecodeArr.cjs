"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64UrlDecodeArr = void 0;
const base64UrlDecode_1 = require("./base64UrlDecode");
const strToUint8Array_1 = require("./strToUint8Array");
/**
 * Takes in a hex string and outputs a Uint8Array binary object.
 *
 * @alpha
 */
function base64UrlDecodeArr(input) {
    return (0, strToUint8Array_1.strToUint8Array)((0, base64UrlDecode_1.base64UrlDecode)(input));
}
exports.base64UrlDecodeArr = base64UrlDecodeArr;
//# sourceMappingURL=base64UrlDecodeArr.js.map