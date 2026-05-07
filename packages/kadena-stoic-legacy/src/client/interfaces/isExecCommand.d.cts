import type { IExecutionPayloadObject, IPactCommand } from './IPactCommand';
/**
 * @internal
 */
export declare function isExecCommand(parsedTransaction: IPactCommand): parsedTransaction is IPactCommand & {
    payload: IExecutionPayloadObject;
};
//# sourceMappingURL=isExecCommand.d.ts.map