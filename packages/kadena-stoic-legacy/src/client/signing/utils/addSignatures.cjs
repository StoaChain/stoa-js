"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSignatures = void 0;
const debug_1 = __importDefault(require("debug"));
const parseTransactionCommand_1 = require("./parseTransactionCommand");
const debug = (0, debug_1.default)('@kadena/client:signing:addSignature');
/**
 * adds signatures to an {@link @kadena/types#IUnsignedCommand | unsigned command}
 *
 * @public
 */
const addSignatures = (transaction, ...signatures) => {
    debug(`Adding signatures to transaction
  transaction: ${JSON.stringify(transaction)}
  signatures: ${JSON.stringify(signatures)}`);
    const { cmd, hash, sigs } = transaction;
    const parsedTransaction = (0, parseTransactionCommand_1.parseTransactionCommand)(transaction);
    const pubKeyOrder = parsedTransaction.signers.map((signer) => signer.pubKey);
    if (allSignaturesHavePubKeys(signatures)) {
        // signatures have pubKeys, use pubKeys to identify order
        debug(`Adding signatures based on pubKeys`);
        return {
            cmd,
            hash,
            sigs: pubKeyOrder.map((pubKey, i) => {
                const existed = sigs.find((sig) => (sig === null || sig === void 0 ? void 0 : sig.pubKey) === pubKey);
                if (existed && existed.sig) {
                    return existed;
                }
                const signature = signatures.find((signature) => signature.pubKey === pubKey);
                return {
                    pubKey,
                    ...((signature === null || signature === void 0 ? void 0 : signature.sig) ? { sig: signature.sig } : {}),
                };
            }),
        };
    }
    else if (signaturesMatchesSigners(parsedTransaction, signatures)) {
        // signatures do not have pubKeys, but matching length, use order of signatures
        debug(`Adding signatures based on order of signatures`);
        return {
            cmd,
            hash,
            sigs: pubKeyOrder.map((pubKey, i) => {
                var _a, _b;
                return ({
                    pubKey,
                    sig: (_a = signatures[i].sig) !== null && _a !== void 0 ? _a : (_b = sigs[i]) === null || _b === void 0 ? void 0 : _b.sig,
                });
            }),
        };
    }
    else {
        // signatures do not have pubKeys, and do not match length, ERROR
        const msg = `Signatures do not have pubKeys, and the length of signatures, does not match the length of signers. Cannot add signatures.`;
        debug(msg);
        throw new Error(msg);
    }
};
exports.addSignatures = addSignatures;
function signaturesMatchesSigners(transaction, sigs) {
    return transaction.signers.length === sigs.length;
}
function allSignaturesHavePubKeys(sigs) {
    return sigs.every((sig) => sig.pubKey !== undefined);
}
//# sourceMappingURL=addSignatures.js.map