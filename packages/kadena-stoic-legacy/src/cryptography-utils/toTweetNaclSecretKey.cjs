"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTweetNaclSecretKey = void 0;
const hexToBin_1 = require("./hexToBin");
/**
 * Converts a keypair into Uint8Array binary object, public key attached to secret key
 * @alpha
 */
function toTweetNaclSecretKey({ secretKey, publicKey, }) {
    return (0, hexToBin_1.hexToBin)(secretKey + publicKey);
}
exports.toTweetNaclSecretKey = toTweetNaclSecretKey;
//# sourceMappingURL=toTweetNaclSecretKey.js.map