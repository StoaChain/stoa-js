"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addVerifier = void 0;
const patchCommand_1 = require("./patchCommand");
/**
 * Reducer to add a verifiers and capabilities on a {@link IPactCommand}
 *
 * @public
 */
exports.addVerifier = ((verifier, capability) => {
    let clist = [];
    if (typeof capability === 'function') {
        clist = capability((name, ...args) => ({
            name,
            args,
        }));
    }
    return (cmd) => (0, patchCommand_1.patchCommand)(cmd, {
        verifiers: [
            {
                ...verifier,
                clist,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            },
        ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
});
//# sourceMappingURL=addVerifier.js.map