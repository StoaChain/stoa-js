"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaEntropyToMnemonic = exports.kadenaMnemonicToSeed = exports.kadenaGenMnemonic = void 0;
const bip39 = __importStar(require("@scure/bip39"));
const english_1 = require("@scure/bip39/wordlists/english");
const kadenaEncryption_js_1 = require("../utils/kadenaEncryption.cjs");
/**
 * Generates a mnemonic phrase using the BIP39 protocol with a specified wordlist.
 *
 * @returns A valid BIP39 mnemonic phrase.
 * @throws If the generated mnemonic is invalid.
 * @public
 */
function kadenaGenMnemonic() {
    return bip39.generateMnemonic(english_1.wordlist);
}
exports.kadenaGenMnemonic = kadenaGenMnemonic;
/**
 * Convert a given mnemonic phrase into a seed buffer.
 *
 * @param mnemonic - A mnemonic seed phrase to be converted into a seed buffer.
 * @param password - Optional password for encrypting the seed.
 * @throws Throws an error if the provided mnemonic is not valid.
 * @returns Returns the seed buffer and processed seed.
 * @public
 */
async function kadenaMnemonicToSeed(password, mnemonic, encode = 'base64') {
    if (bip39.validateMnemonic(mnemonic, english_1.wordlist) === false) {
        throw Error('Invalid mnemonic.');
    }
    const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
    return (0, kadenaEncryption_js_1.kadenaEncrypt)(password, seedBuffer, encode);
}
exports.kadenaMnemonicToSeed = kadenaMnemonicToSeed;
/**
 * Reversible: Converts raw entropy in form of byte array to mnemonic string.
 * @param entropy - byte array
 * @returns - 12-24 words
 * @public
 * @example

* const ent = new Uint8Array([
*   0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
*   0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f
* ]);
* entropyToMnemonic(ent, wordlist);
* // 'legal winner thank year wave sausage worth useful legal winner thank yellow'

**/
const kadenaEntropyToMnemonic = (entropy) => bip39.entropyToMnemonic(entropy, english_1.wordlist);
exports.kadenaEntropyToMnemonic = kadenaEntropyToMnemonic;
//# sourceMappingURL=kadenaMnemonic.js.map