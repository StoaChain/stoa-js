export type BinaryLike = string | ArrayBuffer | Uint8Array;
/**
 *
 * @param size - size of random bytes
 * @returns Uint8Array of random bytes
 * @public
 */
export declare const randomBytes: (size: number) => Uint8Array;
export declare const toArrayBuffer: (data: BinaryLike) => ArrayBuffer;
export declare function encrypt(text: BinaryLike, password: BinaryLike, salt: BinaryLike): Promise<Required<IEncrypted>>;
interface IEncrypted {
    cipherText: BinaryLike;
    iv: BinaryLike;
    iterations?: string;
}
export declare function decrypt(encrypted: IEncrypted, password: BinaryLike, salt: BinaryLike): Promise<Uint8Array>;
export {};
//# sourceMappingURL=crypto.d.ts.map