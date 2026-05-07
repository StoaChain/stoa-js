"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollSpv = exports.getSpv = void 0;
const chainweb_node_client_1 = require("@kadena/chainweb-node-client");
const retry_1 = require("../utils/retry");
async function getSpv(host, requestKey, targetChainId, requestInit = {}) {
    const proof = await (0, chainweb_node_client_1.spv)({ requestKey, targetChainId }, host, requestInit);
    if (typeof proof !== 'string')
        throw new Error('PROOF_IS_NOT_AVAILABLE');
    return proof;
}
exports.getSpv = getSpv;
const pollSpv = (host, requestKey, targetChainId, pollingOptions) => {
    const task = async () => getSpv(host, requestKey, targetChainId, pollingOptions);
    const retrySpv = (0, retry_1.retry)(task);
    return retrySpv(pollingOptions);
};
exports.pollSpv = pollSpv;
//# sourceMappingURL=spv.js.map