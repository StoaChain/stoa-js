import type { IPartialPactCommand } from '../../interfaces/IPactCommand';
export type ValidDataTypes = Record<string, unknown> | string | number | boolean | Array<ValidDataTypes>;
/**
 * Reducer to add `data` to the {@link IPactCommand.payload}
 * @throws DUPLICATED_KEY: "$\{key\}" is already available in the data
 *
 * @public
 */
export declare const addData: (key: string, value: ValidDataTypes) => (cmd: IPartialPactCommand) => IPartialPactCommand;
export interface IAddKeyset {
    <TKey extends string, PRED extends 'keys-all' | 'keys-any' | 'keys-2'>(key: TKey, pred: PRED, ...publicKeys: string[]): (cmd: IPartialPactCommand) => IPartialPactCommand;
    <TKey extends string, PRED extends string>(key: TKey, pred: PRED, ...publicKeys: string[]): (cmd: IPartialPactCommand) => IPartialPactCommand;
}
//# sourceMappingURL=addData.d.ts.map