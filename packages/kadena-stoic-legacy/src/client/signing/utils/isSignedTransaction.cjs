"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSignedTransaction = void 0;
/**
 * Determines if a command is fully signed.
 *
 * @param command - The command to check.
 * @returns True if the command is signed, false otherwise.

 * @public
 */
function isSignedTransaction(command) {
    return command.sigs.every((s) => (s === null || s === void 0 ? void 0 : s.sig) !== undefined);
}
exports.isSignedTransaction = isSignedTransaction;
//# sourceMappingURL=isSignedTransaction.js.map