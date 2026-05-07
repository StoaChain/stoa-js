import type { IPartialPactCommand } from '../interfaces/IPactCommand';
type NoPayload<TCommand> = TCommand extends {
    payload: unknown;
} ? never : TCommand;
type DataOrFunction<TData> = TData | ((a: TData) => TData);
type InitialInput = Partial<IPartialPactCommand> | (() => Partial<IPartialPactCommand>);
interface IComposePactCommand {
    <TPayload extends Pick<IPartialPactCommand, 'payload'>>(payload: TPayload, ...rest: [
        ...Array<Partial<IPartialPactCommand> | ((payload: TPayload & Partial<IPartialPactCommand>) => Partial<IPartialPactCommand>)>
    ]): (cmd?: InitialInput) => Partial<IPartialPactCommand>;
    (first: DataOrFunction<NoPayload<Partial<IPartialPactCommand>>>, ...rest: Array<DataOrFunction<Partial<IPartialPactCommand>>>): (cmd?: InitialInput) => Partial<IPartialPactCommand>;
}
/**
 * Composer for PactCommand to use with reducers
 * @public
 */
export declare const composePactCommand: IComposePactCommand;
export {};
//# sourceMappingURL=composePactCommand.d.ts.map