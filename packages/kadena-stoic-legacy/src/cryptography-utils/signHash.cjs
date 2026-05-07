"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signHash = void 0;
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const base64UrlDecodeArr_1 = require("./base64UrlDecodeArr");
const binToHex_1 = require("./binToHex");
const toTweetNaclSecretKey_1 = require("./toTweetNaclSecretKey");
/**
 Sign a hash using key pair

 * @alpha
*/
function signHash(hash, { secretKey, publicKey }) {
    const hshBin = (0, base64UrlDecodeArr_1.base64UrlDecodeArr)(hash);
    const sigBin = tweetnacl_1.default.sign.detached(hshBin, (0, toTweetNaclSecretKey_1.toTweetNaclSecretKey)({ secretKey, publicKey }));
    return { hash, sig: (0, binToHex_1.binToHex)(sigBin), pubKey: publicKey };
}
exports.signHash = signHash;
//# sourceMappingURL=signHash.js.map