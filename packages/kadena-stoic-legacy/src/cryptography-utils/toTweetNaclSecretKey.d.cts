import type { IKeyPair } from '@stoachain/kadena-stoic-legacy/types';
/**
 * Converts a keypair into Uint8Array binary object, public key attached to secret key
 * @alpha
 */
export declare function toTweetNaclSecretKey({ secretKey, publicKey, }: IKeyPair): Uint8Array;
//# sourceMappingURL=toTweetNaclSecretKey.d.ts.map