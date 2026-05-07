"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPact = void 0;
const chainweb_node_client_1 = require("@kadena/chainweb-node-client");
const cryptography_utils_1 = require("@kadena/cryptography-utils");
const composePactCommand_1 = require("../../composePactCommand");
function runPact(hostUrl, code, data = {}, requestInit) {
    const pactCommand = (0, composePactCommand_1.composePactCommand)((0, composePactCommand_1.execution)(code), {
        payload: { exec: { data } },
    })();
    const cmd = JSON.stringify(pactCommand);
    return (0, chainweb_node_client_1.local)({
        cmd,
        hash: (0, cryptography_utils_1.hash)(cmd),
        sigs: [],
    }, hostUrl, {
        preflight: false,
        signatureVerification: false,
        ...requestInit,
    });
}
exports.runPact = runPact;
//# sourceMappingURL=runPact.js.map