import type { ICap } from '@kadena/types';
import type { IContinuationPayloadObject, IExecutionPayloadObject } from '../../interfaces/IPactCommand';
import type { ExtractPactModule } from '../../interfaces/type-utilities';
export type AddCapabilities<T> = {
    [K in keyof T]: T[K] extends {
        capability: any;
    } ? T[K] : ExtractPactModule<T[K]>;
};
interface IExec {
    <TCodes extends Array<(string & {
        capability(name: string, ...args: unknown[]): ICap;
    }) | string>>(...codes: [...TCodes]): {
        payload: {
            exec: Required<IExecutionPayloadObject['exec']>;
        } & {
            funs: AddCapabilities<[...TCodes]>;
        };
    };
}
interface ICont {
    (options: Partial<IContinuationPayloadObject['cont']>): {
        payload: {
            cont: Partial<IContinuationPayloadObject['cont']>;
        };
    };
}
/**
 * Utility function to create payload for execution {@link IPactCommand.payload}
 *
 * @public
 */
export declare const execution: IExec;
/**
 * Utility function to create payload for continuation  {@link IPactCommand.payload}
 *
 * @public
 */
export declare const continuation: ICont;
export {};
//# sourceMappingURL=payload.d.ts.map