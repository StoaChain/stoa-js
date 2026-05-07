"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kadenaGenMnemonic = exports.kadenaGenKeypair = exports.kadenaVerify = exports.kadenaSign = exports.kadenaGetPublic = exports.kadenaCheckMnemonic = exports.kadenaChangePassword = exports.kadenaMnemonicToRootKeypair = void 0;
const kadena_crypto_js_1 = __importDefault(require("./vendor/kadena-crypto.cjs"));
const nextTick = () => new Promise((resolve) => process.nextTick(resolve));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeAsync = (cb) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args) => {
        // kadena-crypto internally loads a wasm module
        // which is an async operation, ensure it is completed
        while (!kadena_crypto_js_1.default.isLoaded()) {
            await nextTick();
        }
        return cb(...args);
    };
};
exports.kadenaMnemonicToRootKeypair = makeAsync(kadena_crypto_js_1.default.kadenaMnemonicToRootKeypair);
exports.kadenaChangePassword = makeAsync(kadena_crypto_js_1.default.kadenaChangePassword);
exports.kadenaCheckMnemonic = kadena_crypto_js_1.default.kadenaCheckMnemonic;
exports.kadenaGetPublic = makeAsync(kadena_crypto_js_1.default.kadenaGetPublic);
exports.kadenaSign = makeAsync(kadena_crypto_js_1.default.kadenaSign);
exports.kadenaVerify = makeAsync(kadena_crypto_js_1.default.kadenaVerify);
exports.kadenaGenKeypair = makeAsync(kadena_crypto_js_1.default.kadenaGenKeypair);
exports.kadenaGenMnemonic = kadena_crypto_js_1.default.kadenaGenMnemonic;
//# sourceMappingURL=kadena-crypto.js.map