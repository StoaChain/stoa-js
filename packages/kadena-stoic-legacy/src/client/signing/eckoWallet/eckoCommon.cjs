"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStatus = exports.connect = exports.isConnected = exports.isInstalled = void 0;
const isInstalled = () => {
    const { kadena } = window;
    return Boolean(kadena && kadena.isKadena && kadena.request);
};
exports.isInstalled = isInstalled;
const isConnected = async (networkId) => {
    var _a;
    if (!(0, exports.isInstalled)()) {
        return false;
    }
    const checkStatusResponse = await ((_a = window.kadena) === null || _a === void 0 ? void 0 : _a.request({
        method: 'kda_checkStatus',
        networkId,
    }));
    return (checkStatusResponse === null || checkStatusResponse === void 0 ? void 0 : checkStatusResponse.status) === 'success';
};
exports.isConnected = isConnected;
const connect = async (networkId) => {
    var _a;
    if (!(0, exports.isInstalled)()) {
        throw new Error('Ecko Wallet is not installed');
    }
    if (await (0, exports.isConnected)(networkId)) {
        return true;
    }
    const connectResponse = await ((_a = window.kadena) === null || _a === void 0 ? void 0 : _a.request({
        method: 'kda_connect',
        networkId,
    }));
    if ((connectResponse === null || connectResponse === void 0 ? void 0 : connectResponse.status) === 'fail') {
        throw new Error('User declined connection');
    }
    return true;
};
exports.connect = connect;
const checkStatus = async (networkId) => {
    var _a;
    if (!(0, exports.isInstalled)()) {
        throw new Error('Ecko Wallet is not installed');
    }
    await (0, exports.connect)(networkId);
    const checkstatusResponse = await ((_a = window.kadena) === null || _a === void 0 ? void 0 : _a.request({
        method: 'kda_checkStatus',
        networkId,
    }));
    if ((checkstatusResponse === null || checkstatusResponse === void 0 ? void 0 : checkstatusResponse.status) === 'fail') {
        throw new Error('Error getting status from Ecko Wallet');
    }
    return checkstatusResponse;
};
exports.checkStatus = checkStatus;
//# sourceMappingURL=eckoCommon.js.map