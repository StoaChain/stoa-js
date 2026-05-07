import type { IEckoSignSingleFunction } from './eckoTypes';
declare global {
    interface Window {
        kadena?: {
            isKadena: boolean;
            request<T>(args: unknown): Promise<T>;
        };
    }
}
/**
 * Creates the signWithEckoWallet function with interface {@link ISingleSignFunction}
 *
 * @remarks
 * It is preferred to use the {@link createEckoWalletQuicksign} function
 *
 * @public
 */
export declare function createSignWithEckoWallet(): IEckoSignSingleFunction;
/**
 * Creates the signWithEckoWallet function with interface {@link ISingleSignFunction}
 *
 * @remarks
 * It is preferred to use the {@link createQuicksignWithEckoWallet} function
 *
 * @deprecated Use {@link createSignWithEckoWallet} instead
 * @public
 */
export declare const createEckoWalletSign: typeof createSignWithEckoWallet;
//# sourceMappingURL=signWithEckoWallet.d.ts.map