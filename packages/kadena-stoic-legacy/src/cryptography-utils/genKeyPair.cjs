"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genKeyPair = void 0;
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const binToHex_1 = require("./binToHex");
/**
 * Generate a random ED25519 keypair.
 *
 * @alpha
 */
function genKeyPair() {
    const keyPair = tweetnacl_1.default.sign.keyPair();
    const publicKey = (0, binToHex_1.binToHex)(keyPair.publicKey);
    const secretKey = (0, binToHex_1.binToHex)(keyPair.secretKey).slice(0, 64);
    return { publicKey, secretKey };
}
exports.genKeyPair = genKeyPair;
//# sourceMappingURL=genKeyPair.js.map