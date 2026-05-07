"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAsPactValue = void 0;
const pactjs_1 = require("@kadena/pactjs");
const pact_helpers_1 = require("./pact-helpers");
const isDate = (obj) => {
    if (typeof obj === 'object' && obj instanceof Date)
        return true;
    return false;
};
/**
 * @public
 */
function parseAsPactValue(input) {
    if (input instanceof pact_helpers_1.Literal) {
        return input.getValue();
    }
    switch (typeof input) {
        case 'object': {
            if ('decimal' in input) {
                return new pactjs_1.PactNumber(input.decimal).toDecimal();
            }
            if ('int' in input) {
                return new pactjs_1.PactNumber(input.int).toInteger();
            }
            if (isDate(input)) {
                const isoTime = `${input.toISOString().split('.')[0]}Z`;
                return `(time "${isoTime}")`;
            }
            if (Array.isArray(input)) {
                return `[${input.map(parseAsPactValue).join(' ')}]`;
            }
            return `{${Object.entries(input)
                .map(([key, value]) => `"${key}": ${parseAsPactValue(value)}`)
                .join(', ')}}`;
        }
        case 'number':
            throw new Error('Type `number` is not allowed in the command. Use `{ decimal: "10.0" }` or `{ int: "10" }` instead');
        case 'string':
            return `"${input}"`;
        case 'function':
            return input();
        case 'boolean':
            return input.toString();
        default:
            return input;
    }
}
exports.parseAsPactValue = parseAsPactValue;
//# sourceMappingURL=parseAsPactValue.js.map