import type { IPactCommand, IPartialPactCommand } from '../../interfaces/IPactCommand';
/**
 * Reducer to set `meta` on {@link IPartialPactCommand.meta}
 * @public
 */
export declare const setMeta: (options: Partial<Omit<IPactCommand['meta'], 'sender'>> & {
    senderAccount?: string;
}) => ((command: IPartialPactCommand) => IPartialPactCommand);
//# sourceMappingURL=setMeta.d.ts.map