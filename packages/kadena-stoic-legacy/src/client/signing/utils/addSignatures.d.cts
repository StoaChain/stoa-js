import type { ICommand, IUnsignedCommand } from '@kadena/types';
/**
 * adds signatures to an {@link @kadena/types#IUnsignedCommand | unsigned command}
 *
 * @public
 */
export declare const addSignatures: (transaction: IUnsignedCommand, ...signatures: {
    sig: string;
    pubKey?: string;
}[]) => IUnsignedCommand | ICommand;
//# sourceMappingURL=addSignatures.d.ts.map