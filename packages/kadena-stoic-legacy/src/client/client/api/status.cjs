"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollStatus = void 0;
const chainweb_node_client_1 = require("@kadena/chainweb-node-client");
const retry_1 = require("../utils/retry");
const utils_1 = require("../utils/utils");
/**
 * poll until all request are fulfilled
 */
const pollStatus = (host, requestIds, options) => {
    var _a;
    const { onPoll = () => { }, timeout, interval, confirmationDepth = 0, onResult = () => { }, ...requestInit } = options !== null && options !== void 0 ? options : {};
    const signal = (_a = requestInit.signal) !== null && _a !== void 0 ? _a : undefined;
    let requestKeys = [...requestIds];
    const prs = requestKeys.reduce((acc, requestKey) => ({
        ...acc,
        [requestKey]: (0, utils_1.getPromise)(),
    }), {});
    const task = async () => {
        try {
            requestKeys.forEach(onPoll);
            const pollResponse = await (0, chainweb_node_client_1.poll)({ requestKeys }, host, confirmationDepth, requestInit);
            Object.values(pollResponse).forEach((item) => {
                prs[item.reqKey].resolve(item);
                onResult(item.reqKey, item);
                requestKeys = requestKeys.filter((key) => key !== item.reqKey);
            });
        }
        catch (error) {
            onPoll(undefined, error);
            throw error;
        }
        if (requestKeys.length > 0) {
            return Promise.reject(new Error('NOT_COMPLETED'));
        }
    };
    const retryStatus = (0, retry_1.retry)(task, signal);
    retryStatus({ interval, timeout }).catch((err) => {
        Object.values(prs).forEach((pr) => {
            if (!pr.fulfilled) {
                pr.reject(err);
            }
        });
    });
    const returnPromise = Object.assign(Promise.all(Object.entries(prs).map(([requestKey, pr]) => pr.promise.then((data) => ({ [requestKey]: data })))).then(utils_1.mergeAll), { requests: (0, utils_1.mapRecord)(prs, ({ promise }) => promise) });
    return returnPromise;
};
exports.pollStatus = pollStatus;
//# sourceMappingURL=status.js.map