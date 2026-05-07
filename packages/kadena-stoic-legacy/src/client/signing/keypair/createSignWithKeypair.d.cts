import type { IKeyPair } from '@kadena/types';
import type { ISignFunction } from '../ISignFunction';
/**
 * interface for the `createSignWithKeypair` function {@link createSignWithKeypair}
 *
 * @public
 */
export interface ICreateSignWithKeypair {
    /**
     * @param key - provide the key to sign with
     * @returns a function to sign with
     *
     * @example
     * ```ts
     * const signWithKeystore = createSignWithKeypair([keyPair, keyPair2]);
     * const [signedTx1, signedTx2] = await signWithKeystore([tx1, tx2]);
     * const signedTx3 = await signWithKeystore(tx3);
     * ```
     *
     * @public
     */
    (key: IKeyPair): ISignFunction;
    /**
     * @param keys - provide the keys to sign with
     * @returns a function to sign with
     *
     *
     * @example
     * ```ts
     * const signWithKeystore = createSignWithKeypair([keyPair, keyPair2]);
     * const [signedTx1, signedTx2] = await signWithKeystore([tx1, tx2]);
     * const signedTx3 = await signWithKeystore(tx3);
     * ```
     *
     * @public
     */
    (keys: IKeyPair[]): ISignFunction;
}
/**
 * function to create a `signWithKeypair` function
 * This allows you to sign subsequent transactions with the same keypair(s)
 *
 * @param keyOrKeys - provide the key or multiple keys to sign with
 * @returns a function to sign with
 *
 * @example
 * ```ts
 * const signWithKeystore = createSignWithKeypair([keyPair, keyPair2]);
 * const [signedTx1, signedTx2] = await signWithKeystore([tx1, tx2]);
 * const signedTx3 = await signWithKeystore(tx3);
 * ```
 *
 * @public
 */
export declare const createSignWithKeypair: ICreateSignWithKeypair;
//# sourceMappingURL=createSignWithKeypair.d.ts.map