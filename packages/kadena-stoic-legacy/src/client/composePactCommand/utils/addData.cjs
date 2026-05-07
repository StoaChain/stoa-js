"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addData = void 0;
const patchCommand_1 = require("./patchCommand");
const getData = (cmd, key) => {
    var _a, _b;
    if (cmd.payload &&
        'exec' in cmd.payload &&
        ((_a = cmd.payload.exec) === null || _a === void 0 ? void 0 : _a.data) !== undefined) {
        return cmd.payload.exec.data[key];
    }
    if (cmd.payload &&
        'cont' in cmd.payload &&
        ((_b = cmd.payload.cont) === null || _b === void 0 ? void 0 : _b.data) !== undefined) {
        return cmd.payload.cont.data[key];
    }
    return undefined;
};
/**
 * Reducer to add `data` to the {@link IPactCommand.payload}
 * @throws DUPLICATED_KEY: "$\{key\}" is already available in the data
 *
 * @public
 */
const addData = (key, value) => (cmd) => {
    let target = 'exec';
    if (cmd.payload && 'cont' in cmd.payload) {
        target = 'cont';
    }
    if (getData(cmd, key) !== undefined) {
        throw new Error(`DUPLICATED_KEY: "${key}" is already available in the data`);
    }
    const patch = {
        payload: {
            [target]: {
                data: {
                    [key]: value,
                },
            },
        },
    };
    return (0, patchCommand_1.patchCommand)(cmd, patch);
};
exports.addData = addData;
//# sourceMappingURL=addData.js.map