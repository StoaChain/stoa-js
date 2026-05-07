/// <reference types="node" />
/**
 * Convert a Buffer to a Base64 encoded string.
 * @param {Buffer} buffer - Buffer to convert.
 * @returns {string} - Returns the Base64 encoded string.
 */
export declare function bufferToBase64(buffer: Buffer): string;
/**
 * Convert a Base64 encoded string to a Buffer.
 * @param {string} base64 - Base64 encoded string to convert.
 * @returns {Buffer} - Returns the resulting Buffer.
 */
export declare function base64ToBuffer(base64: string): Buffer;
/**
 * Convert a Uint8Array to a hexadecimal string.
 * @param {Uint8Array} uint8Array - The array to convert.
 * @returns {string} - Returns the hexadecimal representation of the input.
 */
export declare const uint8ArrayToHex: (uint8Array: Uint8Array) => string;
//# sourceMappingURL=buffer-helpers.d.ts.map