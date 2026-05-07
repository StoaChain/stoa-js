import type { IPartialPactCommand } from '../../interfaces/IPactCommand';
/**
 * @internal
 */
export declare const mergePayload: (payload: IPartialPactCommand['payload'] | undefined, newPayload: IPartialPactCommand['payload']) => IPartialPactCommand['payload'];
/**
 * Merge a partial command on top of the command
 *
 * @remarks
 * It will only be necessary to use in advanced use cases
 *
 * @param command - the target command
 * @param patch - the properties to patch on top of the target command
 * @public
 */
export declare function patchCommand(command: IPartialPactCommand, patch: IPartialPactCommand): IPartialPactCommand;
//# sourceMappingURL=patchCommand.d.ts.map