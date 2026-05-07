"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexToBin = void 0;
const buffer_1 = require("buffer");
/**
 * Takes in hex string and outputs Uint8Array binary object.
 *
 * @alpha
 */
function hexToBin(hexString) {
    return new Uint8Array(buffer_1.Buffer.from(hexString, 'hex'));
}
exports.hexToBin = hexToBin;
//# sourceMappingURL=hexToBin.js.map