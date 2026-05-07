"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupByHost = exports.sleep = exports.withCounter = exports.mapRecord = exports.mergeAllPollRequestPromises = exports.mergeAll = exports.getPromise = exports.kadenaHostGenerator = exports.getHostUrl = exports.getUrl = exports.jsonRequest = void 0;
const jsonRequest = (body) => ({
    headers: {
        'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(body),
});
exports.jsonRequest = jsonRequest;
function getUrl(host, endpoint, params) {
    const cleanHost = host.endsWith('/') ? host.slice(0, host.length - 1) : host;
    const urlStr = `${cleanHost}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const url = new URL(urlStr);
    if (params !== undefined) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value.toString());
            }
        });
    }
    return url.toString();
}
exports.getUrl = getUrl;
/**
 *
 * @public
 * Creates endpoint url based on the baseUrl, networkId and chainId
 *
 * @example
 * const getLocalHostUrl = getHostUrl('http://localhost:8080')
 * const client = createClient(getLocalHostUrl)
 */
const getHostUrl = (hostBaseUrl) => {
    const base = hostBaseUrl.endsWith('/')
        ? hostBaseUrl.slice(0, hostBaseUrl.length - 1)
        : hostBaseUrl;
    return ({ networkId, chainId }) => `${base}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;
};
exports.getHostUrl = getHostUrl;
const kadenaHostGenerator = ({ networkId, chainId, }) => {
    switch (networkId) {
        case 'mainnet01':
            return (0, exports.getHostUrl)('https://api.chainweb.com')({ networkId, chainId });
        case 'testnet04':
            return (0, exports.getHostUrl)('https://api.testnet.chainweb.com')({
                networkId,
                chainId,
            });
        case 'testnet05':
            return (0, exports.getHostUrl)('https://api.testnet05.chainweb.com')({
                networkId,
                chainId,
            });
        default:
            throw new Error(`UNKNOWN_NETWORK_ID: ${networkId}`);
    }
};
exports.kadenaHostGenerator = kadenaHostGenerator;
const getPromise = () => {
    let resolveFn = () => { };
    let rejectFn = () => { };
    let fulfilled = false;
    let result;
    const promise = new Promise((resolve, reject) => {
        resolveFn = (data) => {
            result = data;
            fulfilled = true;
            resolve(data);
        };
        rejectFn = (err) => {
            fulfilled = true;
            reject(err);
        };
    });
    return {
        promise,
        resolve: resolveFn,
        reject: rejectFn,
        get fulfilled() {
            return fulfilled;
        },
        get data() {
            return result;
        },
    };
};
exports.getPromise = getPromise;
const mergeAll = (results) => results.reduce((acc, data) => ({ ...acc, ...data }), {});
exports.mergeAll = mergeAll;
const mergeAllPollRequestPromises = (results) => {
    return Object.assign(Promise.all(results).then(exports.mergeAll), {
        requests: results.reduce((acc, data) => ({ ...acc, ...data.requests }), {}),
    });
};
exports.mergeAllPollRequestPromises = mergeAllPollRequestPromises;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapRecord = (object, mapper) => Object.fromEntries(Object.entries(object).map(([key, data]) => [key, mapper(data)]));
exports.mapRecord = mapRecord;
const withCounter = (cb) => {
    let counter = 0;
    return (...args) => {
        counter += 1;
        return cb(counter, ...args);
    };
};
exports.withCounter = withCounter;
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
exports.sleep = sleep;
const groupByHost = (items) => {
    const byHost = new Map();
    items.forEach(({ host: hostUrl, requestKey, requestInit }) => {
        var _a;
        const prev = (_a = byHost.get(hostUrl)) !== null && _a !== void 0 ? _a : [];
        byHost.set(hostUrl, [...prev, { requestInit, requestKey }]);
    });
    return [...byHost.entries()];
};
exports.groupByHost = groupByHost;
//# sourceMappingURL=utils.js.map