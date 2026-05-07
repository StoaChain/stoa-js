"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uint8ArrayToStr = void 0;
/**
 * Convert Uint8Array to string
 *
 * @alpha
 */
function uint8ArrayToStr(array) {
    return String.fromCharCode.apply(null, [...new Uint16Array(array)]);
}
exports.uint8ArrayToStr = uint8ArrayToStr;
//# sourceMappingURL=uint8ArrayToStr.js.map