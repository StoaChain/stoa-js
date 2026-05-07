"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEckoWalletQuicksign = exports.createQuicksignWithEckoWallet = void 0;
const addSignatures_1 = require("../utils/addSignatures");
const parseTransactionCommand_1 = require("../utils/parseTransactionCommand");
const eckoCommon_1 = require("./eckoCommon");
/**
 * Creates the quicksignWithEckoWallet function with interface {@link ISingleSignFunction}
 *
 * @public
 */
function createQuicksignWithEckoWallet() {
    const quicksignWithEckoWallet = (async (transactionList) => {
        var _a;
        if (transactionList === undefined) {
            throw new Error('No transaction(s) to sign');
        }
        const isList = Array.isArray(transactionList);
        const transactions = isList ? transactionList : [transactionList];
        const transactionHashes = [];
        const { networkId } = (0, parseTransactionCommand_1.parseTransactionCommand)(transactions[0]);
        const commandSigDatas = transactions.map((pactCommand) => {
            const { cmd, hash } = pactCommand;
            const parsedTransaction = (0, parseTransactionCommand_1.parseTransactionCommand)(pactCommand);
            transactionHashes.push(hash);
            if (networkId !== parsedTransaction.networkId) {
                throw new Error('Network is not equal for all transactions');
            }
            return {
                cmd,
                sigs: parsedTransaction.signers.map((signer, i) => {
                    var _a, _b;
                    return ({
                        pubKey: signer.pubKey,
                        sig: (_b = (_a = pactCommand.sigs[i]) === null || _a === void 0 ? void 0 : _a.sig) !== null && _b !== void 0 ? _b : null,
                    });
                }),
            };
        });
        const eckoResponse = await ((_a = window.kadena) === null || _a === void 0 ? void 0 : _a.request({
            method: 'kda_requestQuickSign',
            data: {
                networkId,
                commandSigDatas,
            },
        }));
        if (!eckoResponse || (eckoResponse === null || eckoResponse === void 0 ? void 0 : eckoResponse.status) === 'fail') {
            throw new Error('Error signing transaction');
        }
        const responses = 'responses' in eckoResponse
            ? eckoResponse.responses
            : eckoResponse.quickSignData;
        if (!Array.isArray(responses)) {
            throw new Error('Error signing transaction');
        }
        responses.map((signedCommand, i) => {
            if (signedCommand.outcome.result === 'success') {
                if (signedCommand.outcome.hash !== transactionHashes[i]) {
                    throw new Error(`Hash of the transaction signed by the wallet does not match. Our hash: ${transactionHashes[i]}, wallet hash: ${signedCommand.outcome.hash}`);
                }
                const sigs = signedCommand.commandSigData.sigs.filter((sig) => sig.sig !== null);
                // Add the signature(s) that we received from the wallet to the PactCommand(s)
                transactions[i] = (0, addSignatures_1.addSignatures)(transactions[i], ...sigs);
            }
        });
        return isList ? transactions : transactions[0];
    });
    quicksignWithEckoWallet.isInstalled = eckoCommon_1.isInstalled;
    quicksignWithEckoWallet.isConnected = eckoCommon_1.isConnected;
    quicksignWithEckoWallet.connect = eckoCommon_1.connect;
    quicksignWithEckoWallet.checkStatus = eckoCommon_1.checkStatus;
    return quicksignWithEckoWallet;
}
exports.createQuicksignWithEckoWallet = createQuicksignWithEckoWallet;
/**
 * Creates the quicksignWithEckoWallet function with interface {@link ISingleSignFunction}
 *
 * @deprecated Use {@link createQuicksignWithEckoWallet} instead
 * @public
 */
exports.createEckoWalletQuicksign = createQuicksignWithEckoWallet;
//# sourceMappingURL=quicksignWithEckoWallet.js.map