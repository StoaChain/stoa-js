import type { ICap } from '@kadena/types';
import type { IPartialPactCommand, ISigner } from '../../interfaces/IPactCommand';
import type { ExtractCapabilityType, IGeneralCapability } from '../../interfaces/type-utilities';
interface IAddSigner {
    (first: ISigner | ISigner[]): () => IPartialPactCommand;
    <TCommand extends any>(first: ISigner | ISigner[], capability: (withCapability: ExtractType<TCommand>) => ICap[]): TCommand;
}
/**
 * Reducer to add a signer and capabilities on a {@link IPactCommand}
 *
 * @public
 */
export declare const addSigner: IAddSigner;
export type ExtractType<TCmdReducer> = TCmdReducer extends (cmd: {
    payload: infer TPayload;
}) => unknown ? ExtractCapabilityType<{
    payload: TPayload;
}> : IGeneralCapability;
export {};
//# sourceMappingURL=addSigner.d.ts.map