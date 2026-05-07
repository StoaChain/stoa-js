import type { ClientRequestInit, ICommandResult, ILocalCommandResult, ILocalOptions, IPollResponse, LocalRequestBody, LocalResponse } from '@kadena/chainweb-node-client';
import type { ChainId, ICommand, IUnsignedCommand } from '@kadena/types';
import type { INetworkOptions, IPollOptions, IPollRequestPromise } from './interfaces/interfaces';
/**
 * Represents the object type that the `submit` or `send` function returns,
 * which other helper functions accept as the first input.
 * This ensures that we always have enough data to fetch the request from the chain.
 * @public
 */
export interface ITransactionDescriptor {
    requestKey: string;
    chainId: ChainId;
    networkId: string;
}
/**
 * @public
 */
export interface ISubmit {
    /**
     * Submits one public (unencrypted) signed command to the blockchain for execution.
     *
     * Calls the '/send' endpoint.
     * This is the only function that requires gas payment.
     *
     * @param transaction - The transaction to be submitted.
     * @returns A promise that resolves the transactionDescriptor {@link ITransactionDescriptor}
     */
    (transaction: ICommand, options?: ClientRequestInit): Promise<ITransactionDescriptor>;
    /**
     * Submits one or more public (unencrypted) signed commands to the blockchain for execution.
     *
     * Calls the '/send' endpoint.
     * This is the only function that requires gas payment.
     *
     * @param transactionList - The list of transactions to be submitted.
     * @returns A promise that resolves the transactionDescriptor {@link ITransactionDescriptor}
     */
    (transactionList: ICommand[], options?: ClientRequestInit): Promise<ITransactionDescriptor[]>;
}
/**
 * @public
 */
export interface IBaseClient {
    /**
     * Sends a command for non-transactional execution.
     * In a blockchain environment, this would be a node-local "dirty read".
     * Any database writes or changes to the environment are rolled back.
     * Gas payment is not required for this function.
     *
     * Calls the '/local' endpoint with optional options.
     *
     * @param transaction - The transaction to be executed.
     * @param options - Optional settings for preflight and signatureVerification.
     * @returns A promise that resolves to the local response.
     */
    local: <T extends ILocalOptions>(transaction: LocalRequestBody, options?: T) => Promise<LocalResponse<T>>;
    /**
     * Submits one or more public (unencrypted) signed commands to the blockchain for execution.
     *
     * Calls the '/send' endpoint.
     * This is the only function that requires gas payment.
     *
     * @param transactionList - The list of transactions to be submitted.
     * @returns A promise that resolves the transactionDescriptor {@link ITransactionDescriptor}
     */
    submit: ISubmit;
    /**
     * Polls the result of one or more submitted requests.
     * Calls the '/poll' endpoint multiple times to get the status of all requests.
     *
     * @param transactionDescriptors - transaction descriptors to status polling.
     * @param options - options to adjust polling (onPoll, timeout, interval, and confirmationDepth).
     * @returns A promise that resolves to the poll request promise with the command result.
     */
    pollStatus: (transactionDescriptors: ITransactionDescriptor[] | ITransactionDescriptor, options?: IPollOptions) => IPollRequestPromise<ICommandResult>;
    /**
     * Gets the result of one or more submitted requests.
     * If the result is not ready, it returns an empty object.
     * Calls the '/poll' endpoint only once.
     *
     * @param transactionDescriptors - transaction descriptors to get the status.
     * @returns  A promise that resolves to the poll response with the command result.
     */
    getStatus: (transactionDescriptors: ITransactionDescriptor[] | ITransactionDescriptor, options?: ClientRequestInit) => Promise<IPollResponse>;
    /**
     * Listens for the result of the request. This is a long-polling process that eventually returns the result.
     * Calls the '/listen' endpoint.
     *
     *
     * @param transactionDescriptors - transaction descriptors to listen for.
     * @returns A promise that resolves to the command result.
     */
    listen: (transactionDescriptor: ITransactionDescriptor, options?: ClientRequestInit) => Promise<ICommandResult>;
    /**
     * Creates an SPV proof for a request. This is required for multi-step tasks.
     * Calls the '/spv' endpoint several times to retrieve the SPV proof.
     *
     *
     * @param transactionDescriptor - The request key for which the SPV proof is generated.
     * @param targetChainId - The target chain ID for the SPV proof.
     * @param options - options to adjust polling (onPoll, timeout, and interval).
     * @returns A promise that resolves to the generated SPV proof.
     */
    pollCreateSpv: (transactionDescriptor: ITransactionDescriptor, targetChainId: ChainId, options?: IPollOptions) => Promise<string>;
    /**
     * Creates an SPV proof for a request. This is required for multi-step tasks.
     * Calls the '/spv' endpoint only once.
     *
     *
     * @param transactionDescriptor - The transaction descriptor for which the SPV proof is generated.
     * @param targetChainId - The target chain ID for the SPV proof.
     * @returns A promise that resolves to the generated SPV proof.
     */
    createSpv: (transactionDescriptor: ITransactionDescriptor, targetChainId: ChainId, options?: ClientRequestInit) => Promise<string>;
}
/**
 * Interface for the {@link createClient | createClient()} return value
 * @public
 */
export interface IClient extends IBaseClient {
    /**
     * An alias for `local` when both preflight and signatureVerification are `true`.
     * @see local
     */
    preflight: (transaction: ICommand | IUnsignedCommand, options?: ClientRequestInit) => Promise<ILocalCommandResult>;
    /**
     * An alias for `local` when preflight is `false` and signatureVerification is `true`.
     *
     * @remarks
     * @see {@link IBaseClient.local | local() function}
     */
    signatureVerification: (transaction: ICommand, options?: ClientRequestInit) => Promise<ICommandResult>;
    /**
     * An alias for `local` when both preflight and signatureVerification are `false`.
     * This call has minimum restrictions and can be used to read data from the node.
     *
     * @remarks
     * @see {@link IBaseClient.local | local() function}
     */
    dirtyRead: (transaction: IUnsignedCommand, options?: ClientRequestInit) => Promise<ICommandResult>;
    /**
     * Generates a command from the code and data, then sends it to the '/local' endpoint.
     *
     * @see {@link IBaseClient.local | local() function}
     */
    runPact: (code: string, data: Record<string, unknown>, option: ClientRequestInit & INetworkOptions) => Promise<ICommandResult>;
    /**
     * Alias for `submit`.
     * Use {@link IBaseClient.submit | submit() function}
     *
     * @deprecated Use `submit` instead.
     */
    send: ISubmit;
    /**
     * Alias for `submit` that accepts only one transaction. useful when you want more precise type checking.
     * {@link IBaseClient.submit | submit() function}
     */
    submitOne: (transaction: ICommand, options?: ClientRequestInit) => Promise<ITransactionDescriptor>;
    /**
     * Use {@link IBaseClient.getStatus | getStatus() function}
     * Alias for `getStatus`.
     *
     * @deprecated Use `getStatus` instead.
     */
    getPoll: (transactionDescriptors: ITransactionDescriptor[] | ITransactionDescriptor, options?: ClientRequestInit) => Promise<IPollResponse>;
    /**
     * Polls the result of one request.
     * Calls the '/poll' endpoint.
     *
     *
     * @param transactionDescriptors - transaction descriptors to listen for.
     * @param options - options to adjust polling (onPoll, timeout, interval, and confirmationDepth).
     * @returns A promise that resolves to the command result.
     */
    pollOne: (transactionDescriptor: ITransactionDescriptor, options?: IPollOptions) => Promise<ICommandResult>;
}
/**
 * @public
 */
export interface ICreateClient {
    /**
     * Generates a client instance by passing the URL of the host.
     *
     * Useful when you are working with a single network and chainId.
     * @param hostUrl - the URL to use in the client
     * @param defaults - default options for the client it includes confirmationDepth that is used for polling
     */
    (hostUrl: string, defaults?: {
        confirmationDepth?: number;
    }): IClient;
    /**
     * Generates a client instance by passing a hostUrlGenerator function.
     *
     * Note: The default hostUrlGenerator creates a Kadena testnet or mainnet URL based on networkId.
     * @param hostAddressGenerator - the function that generates the URL based on `chainId` and `networkId` from the transaction
     * @param defaults - default options for the client it includes confirmationDepth that is used for polling
     */
    (hostAddressGenerator?: (options: {
        chainId: ChainId;
        networkId: string;
        type?: 'local' | 'send' | 'poll' | 'listen' | 'spv';
    }) => string | {
        hostUrl: string;
        requestInit: ClientRequestInit;
    }, defaults?: {
        confirmationDepth?: number;
    }): IClient;
}
/**
 * Creates Chainweb client
 * @public
 */
export declare const createClient: ICreateClient;
//# sourceMappingURL=client.d.ts.map