"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64UrlDecode = void 0;
const InvalidCharacterError_1 = require("./InvalidCharacterError");
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=';
/**
 * Takes in Base64 Url encoded string and outputs decoded string
 * code from [https://gist.github.com/1020396] by [https://github.com/atk]
 *
 * @alpha
 */
function base64UrlDecode(str) {
    const newString = String(str).replace(/[=]+$/, ''); // #31: ExtendScript bad parse of /=
    if (newString.length % 4 === 1) {
        throw new InvalidCharacterError_1.InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    let output = '';
    for (
    // initialize result and counters
    let bc = 0, bs, buffer, idx = 0; 
    // get next character
    (buffer = newString.charAt(idx++)); // eslint-disable-line no-cond-assign
     
    // character found in table? initialize bit storage and add its ascii value;
    ~buffer &&
        /* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions */
        ((bs = bc % 4 ? (bs || 0) * 64 + buffer : buffer),
            // and if not first of each 4 characters,
            // convert the first 8 bits to one ascii character
            bc++ % 4)
        ? // eslint-disable-next-line no-bitwise
            (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0) {
        // try to find character in table (0-63, not found => -1)
        buffer = chars.indexOf(buffer);
    }
    return output;
}
exports.base64UrlDecode = base64UrlDecode;
//# sourceMappingURL=base64UrlDecode.js.map