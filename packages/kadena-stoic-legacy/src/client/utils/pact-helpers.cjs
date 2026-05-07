"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpackLiterals = exports.literal = exports.Literal = exports.readKeyset = void 0;
/**
 * Helper function that returns `(read-keyset "key")` Pact expression
 * @public
 */
const readKeyset = (key) => () => `(read-keyset "${key}")`;
exports.readKeyset = readKeyset;
/**
 * the class for adding values to the final pact object without adding quotes to strings
 * @public
 */
class Literal {
    constructor(value) {
        this._value = value;
    }
    getValue() {
        return this._value;
    }
    toJSON() {
        return `Literal(${this._value})`;
    }
    toString() {
        return this.getValue();
    }
}
exports.Literal = Literal;
/**
 * Will create a literal pact expression without surrounding quotes `"`
 * @example
 * ```
 * // use literal as function input
 * Pact.module.["free.crowdfund"]["create-project"](
 *   "project_id",
 *   "project_name",
 *   // this is a reference to another module and should not have quotes in the created expression
 *   literal("coin"),
 *   ...
 * )
 *
 * // use literal as a property of a json in the input
 * Pact.module.["my-contract"]["set-details"](
 *   "name",
 *   "data" : {
 *      age : 35,
 *      tokens : [literal("coin"), literal("kdx")]
 *   }
 * )
 * ```
 * @public
 */
const literal = (value) => {
    return new Literal(value);
};
exports.literal = literal;
const literalRegex = /"Literal\(([^\)]*)\)"/gi;
/**
 * unpack all of the Literal(string) to string
 * @internal
 */
function unpackLiterals(value) {
    // literal object is already unpacked if they are direct argument of a function.
    // but if they are inside a json object, they are not unpacked since the toJSON method packs them as Literal(string)
    return value.replace(literalRegex, (__, literal) => literal);
}
exports.unpackLiterals = unpackLiterals;
//# sourceMappingURL=pact-helpers.js.map