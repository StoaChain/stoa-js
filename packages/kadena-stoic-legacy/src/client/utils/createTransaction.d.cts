import type { IUnsignedCommand } from '@kadena/types';
import type { IPartialPactCommand } from '../interfaces/IPactCommand';
/**
 * Prepare a transaction object. Creates an object with hash, cmd and sigs ({@link @kadena/types#IUnsignedCommand})
 * @public
 */
export declare const createTransaction: (pactCommand: IPartialPactCommand) => IUnsignedCommand;
//# sourceMappingURL=createTransaction.d.ts.map