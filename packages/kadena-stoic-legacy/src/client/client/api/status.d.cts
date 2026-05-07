import type { ICommandResult } from '@kadena/chainweb-node-client';
import type { IPollOptions, IPollRequestPromise } from '../interfaces/interfaces';
export interface IPollStatus {
    (host: string, requestIds: string[], options?: IPollOptions): IPollRequestPromise<ICommandResult>;
}
/**
 * poll until all request are fulfilled
 */
export declare const pollStatus: IPollStatus;
//# sourceMappingURL=status.d.ts.map