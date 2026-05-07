"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransaction = void 0;
const cryptography_utils_1 = require("@kadena/cryptography-utils");
/**
 * Prepare a transaction object. Creates an object with hash, cmd and sigs ({@link @kadena/types#IUnsignedCommand})
 * @public
 */
const createTransaction = (pactCommand) => {
    var _a, _b;
    const cmd = JSON.stringify(pactCommand);
    const hash = (0, cryptography_utils_1.hash)(cmd);
    return {
        cmd,
        hash,
        sigs: Array.from(Array((_b = (_a = pactCommand.signers) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0)),
    };
};
exports.createTransaction = createTransaction;
//# sourceMappingURL=createTransaction.js.map