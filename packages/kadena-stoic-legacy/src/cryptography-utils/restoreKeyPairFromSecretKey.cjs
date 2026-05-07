"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreKeyPairFromSecretKey = void 0;
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const binToHex_1 = require("./binToHex");
const hexToBin_1 = require("./hexToBin");
/**
 * Generate a deterministic ED25519 keypair from a given Kadena secretKey
 *
 * @alpha
 */
function restoreKeyPairFromSecretKey(seed) {
    if (seed.length !== 64) {
        throw new Error('Seed for IKeyPairgeneration has bad size');
    }
    const seedForNacl = (0, hexToBin_1.hexToBin)(seed);
    const keyPair = tweetnacl_1.default.sign.keyPair.fromSeed(seedForNacl);
    const publicKey = (0, binToHex_1.binToHex)(keyPair.publicKey);
    const secretKey = (0, binToHex_1.binToHex)(keyPair.secretKey).slice(0, 64);
    return { publicKey, secretKey };
}
exports.restoreKeyPairFromSecretKey = restoreKeyPairFromSecretKey;
//# sourceMappingURL=restoreKeyPairFromSecretKey.js.map