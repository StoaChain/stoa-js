import type { BuiltInPredicate, IPartialPactCommand } from '../../interfaces/IPactCommand';
export interface IAddKeyset {
    <TKey extends string, PRED extends BuiltInPredicate>(key: TKey, pred: PRED, ...publicKeys: string[]): (cmd: IPartialPactCommand) => IPartialPactCommand;
    <TKey extends string, PRED extends string>(key: TKey, pred: PRED, ...publicKeys: string[]): (cmd: IPartialPactCommand) => IPartialPactCommand;
}
/**
 * Helper to add keyset to the data property for {@link IPactCommand.payload}
 *
 * @public
 */
export declare const addKeyset: IAddKeyset;
//# sourceMappingURL=addKeyset.d.ts.map