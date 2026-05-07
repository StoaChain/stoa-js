import type { ITransactionBuilder } from './createTransactionBuilder/createTransactionBuilder';
/**
 * Interface that represents the generated Pact modules
 * @public
 */
export interface IPactModules {
}
/**
 * Interface that represents the Pact object
 * @public
 */
export interface IPact {
    modules: IPactModules;
    builder: ITransactionBuilder;
}
/**
 * @internal
 */
export declare const getModule: (name: string) => any;
/**
 * The wrapper object that provides the Transaction builder and Contract interface
 * @public
 */
export declare const Pact: IPact;
//# sourceMappingURL=pact.d.ts.map