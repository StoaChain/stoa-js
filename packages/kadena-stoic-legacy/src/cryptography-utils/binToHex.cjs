"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.binToHex = void 0;
const buffer_1 = require("buffer");
/**
 * Takes in Uint8Array binary object and outputs hex string.
 *
 * @alpha
 */
function binToHex(array) {
    return buffer_1.Buffer.from(array).toString('hex');
}
exports.binToHex = binToHex;
//# sourceMappingURL=binToHex.js.map