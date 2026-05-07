"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTransactionCommand = void 0;
/**
 * parse a ICommand or IUnsignedCommand JSON object to IPactCommand
 *
 * @internal
 */
const parseTransactionCommand = (transaction) => {
    return JSON.parse(transaction.cmd);
};
exports.parseTransactionCommand = parseTransactionCommand;
//# sourceMappingURL=parseTransactionCommand.js.map