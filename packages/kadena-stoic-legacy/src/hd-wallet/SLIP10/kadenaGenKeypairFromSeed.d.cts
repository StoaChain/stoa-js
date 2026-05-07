import type { BinaryLike } from '../utils/crypto.cjs';
import type { EncryptedString } from '../utils/kadenaEncryption.cjs';
/**
 *
 * @param password - password for decrypting the seed
 * @param seed - encrypted seed to generate keypair
 * @param index - index to generate keypair
 * @param derivationPathTemplate - derivation path template
 * @public
 */
export declare function kadenaGenKeypairFromSeed(password: BinaryLike, seed: EncryptedString, index: number, derivationPathTemplate?: string): Promise<[string, EncryptedString]>;
/**
 *
 * @param password - password for decrypting the seed
 * @param seed - encrypted seed to generate keypair
 * @param indexRange - range of indices to generate keypair
 * @param derivationPathTemplate - derivation path template
 * @public
 */
export declare function kadenaGenKeypairFromSeed(password: BinaryLike, seed: EncryptedString, indexRange: [number, number], derivationPathTemplate?: string): Promise<Array<[string, EncryptedString]>>;
//# sourceMappingURL=kadenaGenKeypairFromSeed.d.ts.map