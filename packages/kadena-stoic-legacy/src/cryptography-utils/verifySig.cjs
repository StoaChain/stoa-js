"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySig = void 0;
const tweetnacl_1 = __importDefault(require("tweetnacl"));
/**
 * Verifies the signature for the message and returns true if verification succeeded or false if it failed.
 *
 * @alpha
 */
function verifySig(msg, sig, pubKey) {
    return tweetnacl_1.default.sign.detached.verify(msg, sig, pubKey);
}
exports.verifySig = verifySig;
//# sourceMappingURL=verifySig.js.map