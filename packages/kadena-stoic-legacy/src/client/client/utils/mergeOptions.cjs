"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeOptions = void 0;
function mergeOptions(first, second) {
    if (!first)
        return second;
    if (!second)
        return first;
    const merged = { ...second };
    Object.entries(first).forEach(([key, value]) => {
        if (merged[key] === undefined) {
            merged[key] = value;
            return;
        }
        if (Array.isArray(merged[key])) {
            merged[key] = [
                ...(Array.isArray(value) ? value : [value]),
                ...merged[key],
            ];
            return;
        }
        if (value !== null &&
            typeof merged[key] === 'object' &&
            typeof value === 'object') {
            merged[key] = mergeOptions(value, merged[key]);
            return;
        }
    });
    return merged;
}
exports.mergeOptions = mergeOptions;
//# sourceMappingURL=mergeOptions.js.map