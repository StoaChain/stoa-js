"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchCommand = exports.mergePayload = void 0;
/**
 * @internal
 */
const mergePayload = (payload, newPayload) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (payload === undefined || newPayload === undefined)
        return newPayload !== null && newPayload !== void 0 ? newPayload : payload;
    if ('exec' in payload && 'exec' in newPayload) {
        return {
            exec: {
                code: ((_b = (_a = payload.exec) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : '') + ((_d = (_c = newPayload.exec) === null || _c === void 0 ? void 0 : _c.code) !== null && _d !== void 0 ? _d : ''),
                data: {
                    ...(_e = payload.exec) === null || _e === void 0 ? void 0 : _e.data,
                    ...(_f = newPayload.exec) === null || _f === void 0 ? void 0 : _f.data,
                },
            },
        };
    }
    if ('cont' in payload && 'cont' in newPayload) {
        return {
            cont: {
                ...payload.cont,
                ...newPayload.cont,
                data: {
                    ...(_g = payload.cont) === null || _g === void 0 ? void 0 : _g.data,
                    ...(_h = newPayload.cont) === null || _h === void 0 ? void 0 : _h.data,
                },
            },
        };
    }
    throw new Error('PAYLOAD_NOT_MERGEABLE');
};
exports.mergePayload = mergePayload;
/**
 * Merge a partial command on top of the command
 *
 * @remarks
 * It will only be necessary to use in advanced use cases
 *
 * @param command - the target command
 * @param patch - the properties to patch on top of the target command
 * @public
 */
function patchCommand(command, patch) {
    var _a;
    const state = { ...command };
    if (patch.payload !== undefined) {
        state.payload = (0, exports.mergePayload)(state.payload, patch.payload);
    }
    if (patch.meta !== undefined) {
        state.meta = { ...state.meta, ...patch.meta };
    }
    if (patch.nonce !== undefined) {
        state.nonce = patch.nonce;
    }
    if (patch.networkId !== undefined) {
        state.networkId = patch.networkId;
    }
    if (patch.signers !== undefined) {
        patch.signers.forEach((signer) => {
            var _a, _b, _c;
            (_a = state.signers) !== null && _a !== void 0 ? _a : (state.signers = []);
            const foundSigner = state.signers
                .filter(Boolean)
                .find((item) => (signer === null || signer === void 0 ? void 0 : signer.pubKey) === (item === null || item === void 0 ? void 0 : item.pubKey));
            if (foundSigner !== undefined) {
                foundSigner.clist = [
                    ...((_b = foundSigner.clist) !== null && _b !== void 0 ? _b : []),
                    ...((_c = signer === null || signer === void 0 ? void 0 : signer.clist) !== null && _c !== void 0 ? _c : []),
                ];
            }
            else {
                state.signers.push(signer);
            }
        });
    }
    if (patch.verifiers !== undefined && patch.verifiers.length > 0) {
        state.verifiers = [...((_a = state.verifiers) !== null && _a !== void 0 ? _a : []), ...patch.verifiers];
    }
    return state;
}
exports.patchCommand = patchCommand;
//# sourceMappingURL=patchCommand.js.map