"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.continuation = exports.execution = void 0;
/**
 * Utility function to create payload for execution {@link IPactCommand.payload}
 *
 * @public
 */
const execution = (...codes) => {
    const pld = {
        exec: { code: codes.join(''), data: {} },
    };
    return {
        payload: pld,
        // funs is a trick to make the type inferring work but it's not a real field in the payload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    };
};
exports.execution = execution;
/**
 * Utility function to create payload for continuation  {@link IPactCommand.payload}
 *
 * @public
 */
const continuation = (options) => {
    const clone = {
        data: {},
        ...options,
    };
    if (typeof clone.proof === 'string') {
        clone.proof = clone.proof.replace(/\"/gi, '');
    }
    return {
        payload: { cont: clone },
    };
};
exports.continuation = continuation;
//# sourceMappingURL=payload.js.map