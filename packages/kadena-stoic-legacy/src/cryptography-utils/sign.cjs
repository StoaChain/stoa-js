"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sign = void 0;
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const base64UrlEncodeArr_1 = require("./base64UrlEncodeArr");
const binToHex_1 = require("./binToHex");
const hashBin_1 = require("./hashBin");
const toTweetNaclSecretKey_1 = require("./toTweetNaclSecretKey");
/**
Perform blake2b256 hashing on a message, and sign using keyPair.

 * @alpha
*/
function sign(msg, { secretKey, publicKey }) {
    const hshBin = (0, hashBin_1.hashBin)(msg);
    const hsh = (0, base64UrlEncodeArr_1.base64UrlEncodeArr)(hshBin);
    const sigBin = tweetnacl_1.default.sign.detached(hshBin, (0, toTweetNaclSecretKey_1.toTweetNaclSecretKey)({ secretKey, publicKey }));
    return { hash: hsh, sig: (0, binToHex_1.binToHex)(sigBin), pubKey: publicKey };
}
exports.sign = sign;
//# sourceMappingURL=sign.js.map