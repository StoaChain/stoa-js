"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMeta = void 0;
const patchCommand_1 = require("./patchCommand");
/**
 * Reducer to set `meta` on {@link IPartialPactCommand.meta}
 * @public
 */
const setMeta = (options) => (command) => {
    const { senderAccount, ...rest } = options;
    return (0, patchCommand_1.patchCommand)(command, {
        meta: {
            ...command.meta,
            ...rest,
            ...(senderAccount !== undefined ? { sender: senderAccount } : {}),
        },
    });
};
exports.setMeta = setMeta;
//# sourceMappingURL=setMeta.js.map