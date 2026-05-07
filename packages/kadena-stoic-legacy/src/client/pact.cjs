"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pact = exports.getModule = void 0;
const pactjs_1 = require("@kadena/pactjs");
const createTransactionBuilder_1 = require("./createTransactionBuilder/createTransactionBuilder");
const pact_helpers_1 = require("./utils/pact-helpers");
const parseAsPactValue_1 = require("./utils/parseAsPactValue");
/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getModule = (name) => {
    let code = name;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = new Proxy(function () { }, {
        get(target, path) {
            // dont add depact to the code
            if (path === 'defpact')
                return pr;
            code = `${code}.${path}`;
            return pr;
        },
        apply(target, thisArg, args) {
            const exp = (0, pact_helpers_1.unpackLiterals)((0, pactjs_1.createExp)(code, ...args.map(parseAsPactValue_1.parseAsPactValue)));
            code = name;
            return exp;
        },
    });
    return pr;
};
exports.getModule = getModule;
const pactCreator = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy({}, {
        get(target, path) {
            return (0, exports.getModule)(path);
        },
    });
};
/**
 * The wrapper object that provides the Transaction builder and Contract interface
 * @public
 */
exports.Pact = {
    /**
     * Generated modules
     */
    get modules() {
        return pactCreator();
    },
    /**
     * Transaction builder
     */
    get builder() {
        return (0, createTransactionBuilder_1.createTransactionBuilder)();
    },
};
//# sourceMappingURL=pact.js.map