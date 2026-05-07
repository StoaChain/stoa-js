/**
 * Helper function that returns `(read-keyset "key")` Pact expression
 * @public
 */
export declare const readKeyset: (key: string) => () => string;
/**
 * the class for adding values to the final pact object without adding quotes to strings
 * @public
 */
export declare class Literal {
    private _value;
    constructor(value: string);
    getValue(): string;
    toJSON(): string;
    toString(): string;
}
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
export declare const literal: (value: string) => Literal;
/**
 * unpack all of the Literal(string) to string
 * @internal
 */
export declare function unpackLiterals(value: string): string;
/**
 * General type for reference values
 * @public
 */
export type PactReference = Literal | (() => string);
/**
 * @public
 */
export type PactReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R ? R extends {
    returnType: infer RR;
} ? RR : any : any;
//# sourceMappingURL=pact-helpers.d.ts.map