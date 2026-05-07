"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEckoWalletSign = exports.createSignWithEckoWallet = void 0;
const pactCommandToSigningRequest_1 = require("../utils/pactCommandToSigningRequest");
const parseTransactionCommand_1 = require("../utils/parseTransactionCommand");
const eckoCommon_1 = require("./eckoCommon");
/**
 * Creates the signWithEckoWallet function with interface {@link ISingleSignFunction}
 *
 * @remarks
 * It is preferred to use the {@link createEckoWalletQuicksign} function
 *
 * @public
 */
function createSignWithEckoWallet() {
    const signWithEckoWallet = async (transaction) => {
        var _a;
        const parsedTransaction = (0, parseTransactionCommand_1.parseTransactionCommand)(transaction);
        const signingRequest = (0, pactCommandToSigningRequest_1.pactCommandToSigningRequest)(parsedTransaction);
        await (0, eckoCommon_1.connect)(parsedTransaction.networkId);
        const response = await ((_a = window.kadena) === null || _a === void 0 ? void 0 : _a.request({
            method: 'kda_requestSign',
            data: {
                networkId: parsedTransaction.networkId,
                signingCmd: signingRequest,
            },
        }));
        if ((response === null || response === void 0 ? void 0 : response.signedCmd) === undefined) {
            throw new Error('Error signing transaction');
        }
        return response.signedCmd;
    };
    signWithEckoWallet.isInstalled = eckoCommon_1.isInstalled;
    signWithEckoWallet.isConnected = eckoCommon_1.isConnected;
    signWithEckoWallet.connect = eckoCommon_1.connect;
    signWithEckoWallet.checkStatus = eckoCommon_1.checkStatus;
    return signWithEckoWallet;
}
exports.createSignWithEckoWallet = createSignWithEckoWallet;
/**
 * Creates the signWithEckoWallet function with interface {@link ISingleSignFunction}
 *
 * @remarks
 * It is preferred to use the {@link createQuicksignWithEckoWallet} function
 *
 * @deprecated Use {@link createSignWithEckoWallet} instead
 * @public
 */
exports.createEckoWalletSign = createSignWithEckoWallet;
//# sourceMappingURL=signWithEckoWallet.js.map