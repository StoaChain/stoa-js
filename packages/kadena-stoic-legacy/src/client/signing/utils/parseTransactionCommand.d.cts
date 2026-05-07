import type { ICommand, IUnsignedCommand } from '@kadena/types';
import type { IPactCommand } from '../../interfaces/IPactCommand';
/**
 * parse a ICommand or IUnsignedCommand JSON object to IPactCommand
 *
 * @internal
 */
export declare const parseTransactionCommand: (transaction: IUnsignedCommand | ICommand) => IPactCommand;
//# sourceMappingURL=parseTransactionCommand.d.ts.map