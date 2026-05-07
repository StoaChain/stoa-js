import type { ISignFunction } from '../ISignFunction';
/**
 *
 * @internal
 *
 */
export declare const signTransactions: (chainweaverUrl: string) => ISignFunction;
/**
 * * Lets you sign with chainweaver according to {@link https://github.com/kadena-io/KIPs/blob/master/kip-0015.md | sign-v1 API}
 *
 * @deprecated Use {@link createSignWithChainweaver} instead
 * @public
 */
export declare const signWithChainweaver: ISignFunction;
/**
 * Creates the signWithChainweaver function with interface {@link ISignFunction}
 * Lets you sign with Chainweaver according to {@link https://github.com/kadena-io/KIPs/blob/master/kip-0015.md | sign-v1 API}
 *
 * @param options - object to customize behaviour.
 *   - `host: string` - the host of the chainweaver instance to use. Defaults to `http://127.0.0.1:9467`
 * @returns - {@link ISignFunction}
 * @public
 */
export declare function createSignWithChainweaver(options?: {
    host: string;
}): ISignFunction;
//# sourceMappingURL=signWithChainweaver.d.ts.map