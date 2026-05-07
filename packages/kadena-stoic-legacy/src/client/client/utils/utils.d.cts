import type { ClientRequestInit } from '@kadena/chainweb-node-client';
import type { INetworkOptions, IPollRequestPromise } from '../interfaces/interfaces';
export declare const jsonRequest: (body: object) => {
    headers: {
        'Content-Type': "application/json";
    };
    method: "POST";
    body: string;
};
export declare function getUrl(host: string, endpoint: string, params?: object): string;
/**
 *
 * @public
 * Creates endpoint url based on the baseUrl, networkId and chainId
 *
 * @example
 * const getLocalHostUrl = getHostUrl('http://localhost:8080')
 * const client = createClient(getLocalHostUrl)
 */
export declare const getHostUrl: (hostBaseUrl: string) => ({ networkId, chainId }: INetworkOptions) => string;
export declare const kadenaHostGenerator: ({ networkId, chainId, }: INetworkOptions) => string;
export interface IExtPromise<T> {
    promise: Promise<T>;
    resolve: (result: T) => void;
    reject: (err: unknown) => void;
    fulfilled: boolean;
    data: T | undefined;
}
export declare const getPromise: <T>() => IExtPromise<T>;
export declare const mergeAll: <T extends object>(results: Array<T>) => T;
export declare const mergeAllPollRequestPromises: <T extends string | object>(results: Array<IPollRequestPromise<T>>) => IPollRequestPromise<T>;
export declare const mapRecord: <T extends unknown, Mapper extends (item: T) => any>(object: Record<string, T>, mapper: Mapper) => Record<string, ReturnType<Mapper>>;
export declare const withCounter: <A extends unknown[], F extends (counter: number, ...args_0: A) => any>(cb: F) => ((...args: A) => ReturnType<F>);
export declare const sleep: (duration: number) => Promise<void>;
export declare const groupByHost: (items: Array<{
    requestKey: string;
    host: string;
    requestInit?: ClientRequestInit;
}>) => [string, {
    requestInit?: ClientRequestInit;
    requestKey: string;
}[]][];
//# sourceMappingURL=utils.d.ts.map