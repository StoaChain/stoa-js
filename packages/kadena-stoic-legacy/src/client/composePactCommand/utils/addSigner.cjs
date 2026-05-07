"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSigner = void 0;
const patchCommand_1 = require("./patchCommand");
/**
 * Reducer to add a signer and capabilities on a {@link IPactCommand}
 *
 * @public
 */
exports.addSigner = ((signer, capability) => {
    const signers = Array.isArray(signer) ? signer : [signer];
    let clist;
    if (typeof capability === 'function') {
        clist = capability((name, ...args) => ({
            name,
            args,
        }));
    }
    return (cmd) => (0, patchCommand_1.patchCommand)(cmd, {
        signers: signers.map((item) => {
            const isWhenAuthnKey = typeof item === 'string' && item.startsWith('WEBAUTHN');
            const { pubKey, scheme = isWhenAuthnKey ? 'WebAuthn' : 'ED25519', address = undefined, } = typeof item === 'object' ? item : { pubKey: item };
            return {
                pubKey,
                scheme,
                ...(address !== undefined ? { address } : {}),
                ...(clist !== undefined ? { clist } : {}),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            };
        }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
});
//# sourceMappingURL=addSigner.js.map