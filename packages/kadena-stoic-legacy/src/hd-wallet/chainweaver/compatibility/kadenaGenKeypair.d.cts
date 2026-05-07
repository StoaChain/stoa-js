import type { EncryptedString } from '../../index.cjs';
/**
 *
 * @param password
 * @param rootKey
 * @param index start from 0; it will be hardened automatically
 */
export declare function kadenaGenKeypair(password: string | Uint8Array, rootKey: EncryptedString | Uint8Array, index: number): Promise<{
    publicKey: string;
    secretKey: EncryptedString;
}>;
/**
 *
 * @param password
 * @param rootKey
 * @param range [start, end] start from 0; it will be hardened automatically
 */
export declare function kadenaGenKeypair(password: string | Uint8Array, rootKey: EncryptedString | Uint8Array, range: [start: number, end: number]): Promise<{
    publicKey: string;
    secretKey: EncryptedString;
}[]>;
//# sourceMappingURL=kadenaGenKeypair.d.ts.map