import type { EncryptedString } from '../../index.cjs';
/**
 * Sign a base64 message with a root key and the index of the keypair to use
 * @param password
 * @param hash // base64 hash
 * @param rootKey
 * @param index
 * @returns signature
 */
export declare function kadenaSignFromRootKey(password: string | Uint8Array, hash: string, rootKey: EncryptedString, index: number): Promise<Uint8Array>;
//# sourceMappingURL=kadenaSignFromRootKey.d.ts.map