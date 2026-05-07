"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPactCommand = void 0;
/**
 * Typescript utility to verify that the passed object is a {@link IPactCommand}
 * @internal
 */
const isPactCommand = (command) => {
    if (command.payload === undefined)
        return false;
    if (!('exec' in command.payload) && !('cont' in command.payload))
        return false;
    if (command.networkId === undefined)
        return false;
    if (command.nonce === undefined)
        return false;
    if (command.meta === undefined)
        return false;
    if (command.meta.chainId === undefined)
        return false;
    if (command.meta.creationTime === undefined)
        return false;
    if (command.meta.gasLimit === undefined)
        return false;
    if (command.meta.gasPrice === undefined)
        return false;
    if (command.meta.ttl === undefined)
        return false;
    return true;
};
exports.isPactCommand = isPactCommand;
//# sourceMappingURL=isPactCommand.js.map