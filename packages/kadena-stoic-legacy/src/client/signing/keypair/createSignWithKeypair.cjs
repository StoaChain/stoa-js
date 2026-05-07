"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSignWithKeypair = void 0;
const cryptography_utils_1 = require("@kadena/cryptography-utils");
const debug_1 = __importDefault(require("debug"));
const addSignatures_1 = require("../utils/addSignatures");
const parseTransactionCommand_1 = require("../utils/parseTransactionCommand");
const debug = (0, debug_1.default)('pactjs:signWithKeypair');
/**
 * function to create a `signWithKeypair` function
 * This allows you to sign subsequent transactions with the same keypair(s)
 *
 * @param keyOrKeys - provide the key or multiple keys to sign with
 * @returns a function to sign with
 *
 * @example
 * ```ts
 * const signWithKeystore = createSignWithKeypair([keyPair, keyPair2]);
 * const [signedTx1, signedTx2] = await signWithKeystore([tx1, tx2]);
 * const signedTx3 = await signWithKeystore(tx3);
 * ```
 *
 * @public
 */
const createSignWithKeypair = (keyOrKeys) => {
    const keypairs = Array.isArray(keyOrKeys)
        ? keyOrKeys
        : [keyOrKeys];
    return async function signWithKeypair(transactionList) {
        if (transactionList === undefined) {
            throw new Error('No transaction(s) to sign');
        }
        const isList = Array.isArray(transactionList);
        const transactions = isList ? transactionList : [transactionList];
        const signedTransactions = transactions.map((tx) => {
            debug(`signing transaction(s): ${JSON.stringify(tx)}`);
            const parsedTransaction = (0, parseTransactionCommand_1.parseTransactionCommand)(tx);
            const relevantKeypairs = getRelevantKeypairs(parsedTransaction, keypairs);
            if (relevantKeypairs.length === 0) {
                throw new Error('The keypair(s) provided are not relevant to the transaction');
            }
            return signWithKeypairs(tx, relevantKeypairs);
        });
        return isList ? signedTransactions : signedTransactions[0];
    };
};
exports.createSignWithKeypair = createSignWithKeypair;
function getRelevantKeypairs(tx, keypairs) {
    const relevantKeypairs = keypairs.filter((keypair) => tx.signers.some(({ pubKey }) => pubKey === keypair.publicKey));
    debug('relevant keypairs', relevantKeypairs);
    return relevantKeypairs;
}
function signWithKeypairs(tx, relevantKeypairs) {
    return relevantKeypairs.reduce((tx, keypair) => {
        const { sig, pubKey } = (0, cryptography_utils_1.signHash)(tx.hash, keypair);
        debug(`adding signature from keypair: pubkey: ${keypair.publicKey}`);
        return (0, addSignatures_1.addSignatures)(tx, { sig: sig, pubKey });
    }, tx);
}
//# sourceMappingURL=createSignWithKeypair.js.map