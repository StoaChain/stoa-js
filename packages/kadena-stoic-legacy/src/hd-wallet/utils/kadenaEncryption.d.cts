import type { BinaryLike } from './crypto.cjs';
/**
 * @public
 */
export type EncryptedString = string & {
    _brand: 'EncryptedString';
};
/**
 * Encrypts the message with a password .
 * @param message - The message to be encrypted.
 * @param password - password used for encryption.
 * @returns The encrypted string
 * @public
 */
export declare function kadenaEncrypt<TEncode extends 'base64' | 'buffer' = 'base64', TReturn = TEncode extends 'base64' ? EncryptedString : Uint8Array>(password: BinaryLike, message: BinaryLike, encode?: TEncode): Promise<TReturn>;
/**
 * Decrypts an encrypted message using the provided password.
 * This function is a wrapper for the internal decryption logic, intended
 * for public-facing API usage where the private key encryption follows
 *
 * @param encryptedData - The encrypted data as a Base64 encoded string.
 * @param password - The password used to encrypt the private key.
 * @returns The decrypted private key.
 * @throws Throws an error if decryption fails.
 * @public
 */
export declare function kadenaDecrypt(password: BinaryLike, encryptedData: BinaryLike): Promise<Uint8Array>;
/**
 * Changes the password of an encrypted data.
 *
 * @param privateKey - The encrypted private key as a Base64 encoded string.
 * @param password - The current password used to encrypt the private key.
 * @param newPassword - The new password to encrypt the private key with.
 * @returns The newly encrypted private key as a Base64 encoded string.
 * @throws Throws an error if the old password is empty, new password is incorrect empty passwords are empty, or if encryption with the new password fails.
 * @public
 */
export declare function kadenaChangePassword<TEncode extends 'base64' | 'buffer' = 'base64', TReturn = TEncode extends 'base64' ? EncryptedString : Uint8Array>(password: BinaryLike, encryptedData: BinaryLike, newPassword: string, encode?: TEncode): Promise<TReturn>;
//# sourceMappingURL=kadenaEncryption.d.ts.map