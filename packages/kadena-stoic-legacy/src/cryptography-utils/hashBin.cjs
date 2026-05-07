"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashBin = void 0;
const blakejs_1 = require("blakejs");
/**
 * Takes in string and outputs blake2b256 hash binary as a Uint8Array.
 *
 * @alpha
 */
function hashBin(str) {
    return (0, blakejs_1.blake2b)(str, undefined, 32);
}
exports.hashBin = hashBin;
//# sourceMappingURL=hashBin.js.map