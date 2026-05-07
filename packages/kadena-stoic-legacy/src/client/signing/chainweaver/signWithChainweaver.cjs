// MODIFIED 2026-05-06 by StoaChain: cross-fetch -> globalThis.fetch (Node 22+ native). Original at @kadena/client@1.18.3 lib/signing/chainweaver/signWithChainweaver.js
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSignWithChainweaver = exports.signWithChainweaver = exports.signTransactions = void 0;
const debug_1 = __importDefault(require("debug"));
const addSignatures_1 = require("../utils/addSignatures");
const parseTransactionCommand_1 = require("../utils/parseTransactionCommand");
const debug = (0, debug_1.default)('pactjs:signWithChainweaver');
/**
 *
 * @internal
 *
 */
const signTransactions = (chainweaverUrl) => (async (transactionList) => {
    if (transactionList === undefined) {
        throw new Error('No transaction(s) to sign');
    }
    const isList = Array.isArray(transactionList);
    const transactions = isList ? transactionList : [transactionList];
    const quickSignRequest = {
        cmdSigDatas: transactions.map((t) => {
            const parsedTransaction = (0, parseTransactionCommand_1.parseTransactionCommand)(t);
            return {
                cmd: t.cmd,
                sigs: parsedTransaction.signers.map((signer, i) => {
                    var _a, _b;
                    return {
                        pubKey: signer.pubKey,
                        sig: (_b = (_a = t.sigs[i]) === null || _a === void 0 ? void 0 : _a.sig) !== null && _b !== void 0 ? _b : null,
                    };
                }),
            };
        }),
    };
    const body = JSON.stringify(quickSignRequest);
    debug('calling sign api:', body);
    const response = await globalThis.fetch(`${chainweaverUrl}/v1/quicksign`, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
    });
    const bodyText = await response.text();
    // response is not JSON when not-ok, that's why we use try-catch
    try {
        const result = JSON.parse(bodyText);
        if ('error' in result) {
            if ('msg' in result.error) {
                console.log('error in result', result.error.msg);
            }
            throw new Error(JSON.stringify(result.error));
        }
        result.responses.map((signedCommand, i) => {
            transactions[i] = (0, addSignatures_1.addSignatures)(transactions[i], ...signedCommand.commandSigData.sigs.filter(isASigner));
        });
        return isList ? transactions : transactions[0];
    }
    catch (error) {
        throw new Error('An error occurred when adding signatures to the command' +
            `\nResponse from v1/quicksign was \`${bodyText}\`. ` +
            `\nCode: \`${response.status}\`` +
            `\nText: \`${response.statusText}\` ` +
            `${error}`);
    }
});
exports.signTransactions = signTransactions;
/**
 * * Lets you sign with chainweaver according to {@link https://github.com/kadena-io/KIPs/blob/master/kip-0015.md | sign-v1 API}
 *
 * @deprecated Use {@link createSignWithChainweaver} instead
 * @public
 */
exports.signWithChainweaver = (0, exports.signTransactions)('http://127.0.0.1:9467');
/**
 * Creates the signWithChainweaver function with interface {@link ISignFunction}
 * Lets you sign with Chainweaver according to {@link https://github.com/kadena-io/KIPs/blob/master/kip-0015.md | sign-v1 API}
 *
 * @param options - object to customize behaviour.
 *   - `host: string` - the host of the chainweaver instance to use. Defaults to `http://127.0.0.1:9467`
 * @returns - {@link ISignFunction}
 * @public
 */
function createSignWithChainweaver(options = { host: 'http://127.0.0.1:9467' }) {
    const { host } = options;
    const signWithChainweaver = (0, exports.signTransactions)(host);
    return signWithChainweaver;
}
exports.createSignWithChainweaver = createSignWithChainweaver;
function isASigner(signer) {
    return ('pubKey' in signer &&
        'sig' in signer &&
        signer.sig !== null &&
        signer.pubKey.length > 0);
}
//# sourceMappingURL=signWithChainweaver.js.map