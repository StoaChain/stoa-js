"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buffer_1 = require("buffer/");
if (typeof window !== 'undefined') {
    if (typeof window.Buffer === 'undefined') {
        window.Buffer = buffer_1.Buffer;
    }
}
//# sourceMappingURL=browser-polyfill.js.map