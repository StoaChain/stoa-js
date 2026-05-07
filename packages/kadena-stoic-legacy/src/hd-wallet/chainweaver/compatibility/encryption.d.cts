import type { EncryptedString } from '../../index.cjs';
export declare function encryptLegacySecretKey(password: string | Uint8Array, secretKey: Uint8Array): Promise<EncryptedString>;
export declare function getPublicKeyFromLegacySecretKey(secretKey: EncryptedString): string;
//# sourceMappingURL=encryption.d.ts.map