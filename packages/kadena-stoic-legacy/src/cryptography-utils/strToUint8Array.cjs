"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strToUint8Array = void 0;
/**
 * Takes in string and outputs Uint8Array
 *
 * @alpha
 */
function strToUint8Array(str) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        arr[i] = str.charCodeAt(i);
    }
    return arr;
}
exports.strToUint8Array = strToUint8Array;
//# sourceMappingURL=strToUint8Array.js.map