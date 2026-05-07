"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pactCommandToSigningRequest = void 0;
const isExecCommand_1 = require("../../interfaces/isExecCommand");
const pactCommandToSigningRequest = (parsedTransaction) => {
    var _a;
    if (!(0, isExecCommand_1.isExecCommand)(parsedTransaction)) {
        throw new Error('`cont` transactions are not supported');
    }
    return {
        code: (_a = parsedTransaction.payload.exec.code) !== null && _a !== void 0 ? _a : '',
        data: parsedTransaction.payload.exec.data,
        caps: parsedTransaction.signers.flatMap((signer) => {
            if (signer.clist === undefined) {
                return [];
            }
            return signer.clist.map(({ name, args }) => {
                const nameArr = name.split('.');
                return {
                    role: nameArr[nameArr.length - 1],
                    description: `Description for ${name}`,
                    cap: {
                        name,
                        args,
                    },
                };
            });
        }),
        nonce: parsedTransaction.nonce,
        chainId: parsedTransaction.meta.chainId,
        gasLimit: parsedTransaction.meta.gasLimit,
        gasPrice: parsedTransaction.meta.gasPrice,
        sender: parsedTransaction.meta.sender,
        ttl: parsedTransaction.meta.ttl,
    };
};
exports.pactCommandToSigningRequest = pactCommandToSigningRequest;
//# sourceMappingURL=pactCommandToSigningRequest.js.map