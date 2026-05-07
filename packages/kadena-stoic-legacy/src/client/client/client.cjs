"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = void 0;
const chainweb_node_client_1 = require("@kadena/chainweb-node-client");
const runPact_1 = require("./api/runPact");
const spv_1 = require("./api/spv");
const status_1 = require("./api/status");
const mergeOptions_1 = require("./utils/mergeOptions");
const utils_1 = require("./utils/utils");
const getHostData = (hostObject) => {
    const hostUrl = typeof hostObject === 'string' ? hostObject : hostObject.hostUrl;
    const requestInit = typeof hostObject === 'object' ? hostObject.requestInit : {};
    return { hostUrl, requestInit };
};
/**
 * Creates Chainweb client
 * @public
 */
const createClient = (host = utils_1.kadenaHostGenerator, defaults = { confirmationDepth: 0 }) => {
    const confirmationDepth = defaults.confirmationDepth;
    const getHost = typeof host === 'string' ? () => host : host;
    const client = {
        local(body, options) {
            const cmd = JSON.parse(body.cmd);
            const hostObject = getHost({
                chainId: cmd.meta.chainId,
                networkId: cmd.networkId,
            });
            const { hostUrl, requestInit } = getHostData(hostObject);
            return (0, chainweb_node_client_1.local)(body, hostUrl, (0, mergeOptions_1.mergeOptions)(requestInit, options));
        },
        submit: (async (body, options) => {
            const isList = Array.isArray(body);
            const commands = isList ? body : [body];
            const [first] = commands;
            if (first === undefined) {
                throw new Error('EMPTY_COMMAND_LIST');
            }
            const cmd = JSON.parse(first.cmd);
            const hostObject = getHost({
                chainId: cmd.meta.chainId,
                networkId: cmd.networkId,
            });
            const { hostUrl, requestInit } = getHostData(hostObject);
            const { requestKeys } = await (0, chainweb_node_client_1.send)({ cmds: commands }, hostUrl, (0, mergeOptions_1.mergeOptions)(requestInit, options));
            const transactionDescriptors = requestKeys.map((key) => ({
                requestKey: key,
                chainId: cmd.meta.chainId,
                networkId: cmd.networkId,
            }));
            return isList ? transactionDescriptors : transactionDescriptors[0];
        }),
        pollStatus(transactionDescriptors, options) {
            const requestsList = Array.isArray(transactionDescriptors)
                ? transactionDescriptors
                : [transactionDescriptors];
            const results = (0, utils_1.groupByHost)(requestsList.map(({ requestKey, chainId, networkId }) => {
                const hostObject = getHost({ chainId, networkId, type: 'poll' });
                const { hostUrl, requestInit } = getHostData(hostObject);
                return {
                    requestKey,
                    host: hostUrl,
                    requestInit,
                };
            })).map(([host, requestKeys]) => {
                const requestInit = requestKeys[0].requestInit;
                return (0, status_1.pollStatus)(host, requestKeys.map((r) => r.requestKey), {
                    confirmationDepth,
                    ...(0, mergeOptions_1.mergeOptions)(requestInit, options),
                });
            });
            // merge all of the result in one object
            const mergedPollRequestPromises = (0, utils_1.mergeAllPollRequestPromises)(results);
            return mergedPollRequestPromises;
        },
        async getStatus(transactionDescriptors, options) {
            const requestsList = Array.isArray(transactionDescriptors)
                ? transactionDescriptors
                : [transactionDescriptors];
            const results = await Promise.all((0, utils_1.groupByHost)(requestsList.map(({ requestKey, chainId, networkId }) => {
                const hostObject = getHost({ chainId, networkId, type: 'poll' });
                const { hostUrl, requestInit } = getHostData(hostObject);
                return {
                    requestKey,
                    host: hostUrl,
                    requestInit,
                };
            })).map(([hostUrl, requestKeys]) => {
                const requestInit = requestKeys[0].requestInit;
                return (0, chainweb_node_client_1.poll)({ requestKeys: requestKeys.map((r) => r.requestKey) }, hostUrl, undefined, (0, mergeOptions_1.mergeOptions)(requestInit, options));
            }));
            // merge all of the result in one object
            const mergedResults = (0, utils_1.mergeAll)(results);
            return mergedResults;
        },
        async listen({ requestKey, chainId, networkId }, options) {
            const hostObject = getHost({ chainId, networkId, type: 'listen' });
            const { hostUrl, requestInit } = getHostData(hostObject);
            const result = await (0, chainweb_node_client_1.listen)({ listen: requestKey }, hostUrl, (0, mergeOptions_1.mergeOptions)(requestInit, options));
            return result;
        },
        pollCreateSpv({ requestKey, chainId, networkId }, targetChainId, options) {
            const hostObject = getHost({ chainId, networkId, type: 'spv' });
            const { hostUrl, requestInit } = getHostData(hostObject);
            return (0, spv_1.pollSpv)(hostUrl, requestKey, targetChainId, (0, mergeOptions_1.mergeOptions)(requestInit, options));
        },
        async createSpv({ requestKey, chainId, networkId }, targetChainId, options) {
            const hostObject = getHost({ chainId, networkId, type: 'spv' });
            const { hostUrl, requestInit } = getHostData(hostObject);
            return (0, spv_1.getSpv)(hostUrl, requestKey, targetChainId, (0, mergeOptions_1.mergeOptions)(requestInit, options));
        },
    };
    return {
        ...client,
        submitOne: client.submit,
        preflight(body, options) {
            return client.local(body, {
                ...options,
                preflight: true,
                signatureVerification: true,
            });
        },
        signatureVerification(body, options) {
            return client.local(body, {
                ...options,
                preflight: false,
                signatureVerification: true,
            });
        },
        dirtyRead(body, options) {
            return client.local(body, {
                ...options,
                preflight: false,
                signatureVerification: false,
            });
        },
        runPact: (code, data, options) => {
            const hostObject = getHost(options);
            const { hostUrl, requestInit } = getHostData(hostObject);
            if (hostUrl === '')
                throw new Error('NO_HOST_URL');
            return (0, runPact_1.runPact)(hostUrl, code, data, (0, mergeOptions_1.mergeOptions)(requestInit, options));
        },
        send: client.submit,
        getPoll: client.getStatus,
        pollOne: (transactionDescriptor, options) => {
            return client
                .pollStatus(transactionDescriptor, options)
                .then((res) => res[transactionDescriptor.requestKey]);
        },
    };
};
exports.createClient = createClient;
//# sourceMappingURL=client.js.map