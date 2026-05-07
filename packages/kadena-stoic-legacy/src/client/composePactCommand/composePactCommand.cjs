"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composePactCommand = void 0;
const patchCommand_1 = require("./utils/patchCommand");
const finalizeCommand = (command) => {
    var _a, _b, _c;
    var _d;
    const dateInMs = Date.now();
    const finalCommand = { ...command };
    (_a = finalCommand.nonce) !== null && _a !== void 0 ? _a : (finalCommand.nonce = `kjs:nonce:${dateInMs}`);
    (_b = finalCommand.signers) !== null && _b !== void 0 ? _b : (finalCommand.signers = []);
    if (finalCommand.meta) {
        const defaultMeta = {
            gasLimit: 2500,
            gasPrice: 1.0e-8,
            sender: '',
            ttl: 15 * 60, // 15 minutes,
            creationTime: Math.floor(Date.now() / 1000),
        };
        finalCommand.meta = {
            ...defaultMeta,
            ...finalCommand.meta,
        };
    }
    if (finalCommand.payload && 'cont' in finalCommand.payload) {
        (_c = (_d = finalCommand.payload.cont).proof) !== null && _c !== void 0 ? _c : (_d.proof = null);
    }
    return finalCommand;
};
/**
 * Composer for PactCommand to use with reducers
 * @public
 */
const composePactCommand = (first, ...rest) => (initial = {}) => {
    const args = [first, ...rest];
    const command = args.reduce((acc, next) => {
        return typeof next === 'function'
            ? next(acc)
            : (0, patchCommand_1.patchCommand)(acc, next);
    }, typeof initial === 'function' ? initial() : initial);
    const finalCommand = finalizeCommand(command);
    return finalCommand;
};
exports.composePactCommand = composePactCommand;
//# sourceMappingURL=composePactCommand.js.map