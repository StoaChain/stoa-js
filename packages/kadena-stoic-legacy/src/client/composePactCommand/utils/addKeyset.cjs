"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addKeyset = void 0;
const addData_1 = require("./addData");
/**
 * Helper to add keyset to the data property for {@link IPactCommand.payload}
 *
 * @public
 */
const addKeyset = (name, pred, ...publicKeys) => (0, addData_1.addData)(name, { keys: publicKeys, pred });
exports.addKeyset = addKeyset;
//# sourceMappingURL=addKeyset.js.map