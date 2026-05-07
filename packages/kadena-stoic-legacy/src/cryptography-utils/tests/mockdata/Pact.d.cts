import type { IUnsignedCommand } from '@kadena/types';
/**
 * @alpha
 */
export declare const pactTestCommand: {
    networkId: undefined | unknown;
    payload: {
        exec: {
            data: {
                'accounts-admin-keyset': string[];
            };
            code: string;
        };
    };
    signers: {
        pubKey: string;
    }[];
    meta: {
        creationTime: number;
        ttl: number;
        gasLimit: number;
        chainId: string;
        gasPrice: number;
        sender: string;
    };
    nonce: string;
};
/**
 * @alpha
 */
export declare const pactTestCommand1: IUnsignedCommand;
/**
 * @alpha
 */
export declare const pactTestCommand2: IUnsignedCommand;
//# sourceMappingURL=Pact.d.ts.map