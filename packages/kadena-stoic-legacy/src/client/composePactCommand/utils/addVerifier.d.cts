import type { ICap, PactValue } from '@kadena/types';
import type { IPartialPactCommand } from '../../interfaces/IPactCommand';
import type { ExtractType } from './addSigner';
export interface IVerifier {
    name: string;
    proof: PactValue;
}
interface IAddVerifier {
    (verifier: IVerifier): () => IPartialPactCommand;
    <TCommand extends any>(verifier: IVerifier, capability: (forCapability: ExtractType<TCommand>) => ICap[]): TCommand;
}
/**
 * Reducer to add a verifiers and capabilities on a {@link IPactCommand}
 *
 * @public
 */
export declare const addVerifier: IAddVerifier;
export {};
//# sourceMappingURL=addVerifier.d.ts.map