"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExecCommand = void 0;
/**
 * @internal
 */
function isExecCommand(parsedTransaction) {
    return 'exec' in parsedTransaction.payload;
}
exports.isExecCommand = isExecCommand;
//# sourceMappingURL=isExecCommand.js.map