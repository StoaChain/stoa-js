"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64UrlEncodeArr = void 0;
const base64UrlEncode_1 = require("./base64UrlEncode");
const uint8ArrayToStr_1 = require("./uint8ArrayToStr");
/**
 * Takes in Uint8Array binary object and outputs hex string.
 *
 * @alpha
 */
function base64UrlEncodeArr(input) {
    return (0, base64UrlEncode_1.base64UrlEncode)((0, uint8ArrayToStr_1.uint8ArrayToStr)(input));
}
exports.base64UrlEncodeArr = base64UrlEncodeArr;
//# sourceMappingURL=base64UrlEncodeArr.js.map