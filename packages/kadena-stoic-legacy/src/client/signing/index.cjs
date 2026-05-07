// MODIFIED 2026-05-06 by StoaChain: removed walletconnect re-exports (DROP per Phase 2 T2.7 decision log). Original at @kadena/client@1.18.3 lib/signing/index.js
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./utils/addSignatures"), exports);
__exportStar(require("./utils/isSignedTransaction"), exports);
__exportStar(require("./chainweaver/signWithChainweaver"), exports);
__exportStar(require("./eckoWallet/quicksignWithEckoWallet"), exports);
__exportStar(require("./eckoWallet/signWithEckoWallet"), exports);
__exportStar(require("./keypair/createSignWithKeypair"), exports);
//# sourceMappingURL=index.js.map