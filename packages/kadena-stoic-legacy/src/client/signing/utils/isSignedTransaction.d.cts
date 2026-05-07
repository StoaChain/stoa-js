import type { ICommand, IUnsignedCommand } from '@stoachain/kadena-stoic-legacy/types';
/**
 * Determines if a command is fully signed.
 *
 * @param command - The command to check.
 * @returns True if the command is signed, false otherwise.

 * @public
 */
export declare function isSignedTransaction(command: IUnsignedCommand | ICommand): command is ICommand;
//# sourceMappingURL=isSignedTransaction.d.ts.map