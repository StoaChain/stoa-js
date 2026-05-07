"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransactionBuilder = void 0;
const composePactCommand_1 = require("../composePactCommand");
const addVerifier_1 = require("../composePactCommand/utils/addVerifier");
const patchCommand_1 = require("../composePactCommand/utils/patchCommand");
const createTransaction_1 = require("../utils/createTransaction");
const statefulCompose = (init) => {
    let reducer = (0, composePactCommand_1.composePactCommand)(init);
    return {
        composeWith: (patch) => {
            reducer = (0, composePactCommand_1.composePactCommand)(reducer, patch);
        },
        get finalize() {
            return reducer;
        },
    };
};
const getBuilder = (init) => {
    const state = statefulCompose(init);
    const builder = {
        addData: (key, value) => {
            state.composeWith((0, composePactCommand_1.addData)(key, value));
            return builder;
        },
        addKeyset: (key, pred, ...publicKeys) => {
            state.composeWith((0, composePactCommand_1.addKeyset)(key, pred, ...publicKeys));
            return builder;
        },
        addSigner: (pubKey, cap) => {
            state.composeWith((0, composePactCommand_1.addSigner)(pubKey, cap));
            return builder;
        },
        addVerifier: (verifier, cap) => {
            state.composeWith((0, addVerifier_1.addVerifier)(verifier, cap));
            return builder;
        },
        setMeta: (meta) => {
            state.composeWith((0, composePactCommand_1.setMeta)(meta));
            return builder;
        },
        setNetworkId: (id) => {
            state.composeWith((0, composePactCommand_1.setNetworkId)(id));
            return builder;
        },
        setNonce: (arg) => {
            state.composeWith((cmd) => {
                const nonce = typeof arg === 'function' ? arg(cmd) : arg;
                return (0, patchCommand_1.patchCommand)(cmd, (0, composePactCommand_1.setNonce)(nonce));
            });
            return builder;
        },
        getCommand: () => {
            return state.finalize({});
        },
        createTransaction: () => (0, createTransaction_1.createTransaction)(builder.getCommand()),
    };
    return builder;
};
/**
 * returns a new instance of command builder
 * @param initial - the initial command
 *
 * @public
 */
const createTransactionBuilder = (initial) => {
    return {
        execution: (...pactExpressions) => {
            const init = initial
                ? (0, patchCommand_1.patchCommand)(initial, (0, composePactCommand_1.execution)(...pactExpressions))
                : (0, composePactCommand_1.execution)(...pactExpressions);
            return getBuilder(init);
        },
        continuation: (contOptions) => {
            const contWithDefaults = { proof: null, ...contOptions };
            const init = initial
                ? (0, patchCommand_1.patchCommand)(initial, (0, composePactCommand_1.continuation)(contWithDefaults))
                : (0, composePactCommand_1.continuation)(contWithDefaults);
            return getBuilder(init);
        },
    };
};
exports.createTransactionBuilder = createTransactionBuilder;
//# sourceMappingURL=createTransactionBuilder.js.map