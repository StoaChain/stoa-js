"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaKeyPairsFromRandom = void 0;
const crypto_js_1 = require("../utils/crypto.cjs");
const sign_js_1 = require("./utils/sign.cjs");
/**
 * Generates random key pairs without updating the internal state.
 *
 * @param count - The number of key pairs to generate default is `1`.
 * @returns An array of generated key pairs.
 * @public
 */
function kadenaKeyPairsFromRandom(count = 1) {
    const keyPairs = [];
    for (let index = 0; index < count; index++) {
        const randomSeedBuffer = (0, crypto_js_1.randomBytes)(32);
        const derivationPath = `m'/44'/626'/${index}'`;
        const pair = (0, sign_js_1.deriveKeyPair)(randomSeedBuffer, derivationPath);
        keyPairs.push({
            publicKey: pair.publicKey,
            secretKey: pair.privateKey,
        });
    }
    return keyPairs;
}
exports.kadenaKeyPairsFromRandom = kadenaKeyPairsFromRandom;
//# sourceMappingURL=kadenaKeyPairsFromRandom.js.map