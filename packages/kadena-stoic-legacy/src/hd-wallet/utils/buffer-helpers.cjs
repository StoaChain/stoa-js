"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uint8ArrayToHex = exports.base64ToBuffer = exports.bufferToBase64 = void 0;
/**
 * Convert a Buffer to a Base64 encoded string.
 * @param {Buffer} buffer - Buffer to convert.
 * @returns {string} - Returns the Base64 encoded string.
 */
function bufferToBase64(buffer) {
    return buffer.toString('base64');
}
exports.bufferToBase64 = bufferToBase64;
/**
 * Convert a Base64 encoded string to a Buffer.
 * @param {string} base64 - Base64 encoded string to convert.
 * @returns {Buffer} - Returns the resulting Buffer.
 */
function base64ToBuffer(base64) {
    return Buffer.from(base64, 'base64');
}
exports.base64ToBuffer = base64ToBuffer;
/**
 * Convert a Uint8Array to a hexadecimal string.
 * @param {Uint8Array} uint8Array - The array to convert.
 * @returns {string} - Returns the hexadecimal representation of the input.
 */
const uint8ArrayToHex = (uint8Array) => {
    if (uint8Array.length === 33 && uint8Array.at(0) === 0) {
        uint8Array = uint8Array.slice(1);
    }
    return [...uint8Array].map((x) => x.toString(16).padStart(2, '0')).join('');
};
exports.uint8ArrayToHex = uint8ArrayToHex;
//# sourceMappingURL=buffer-helpers.js.map