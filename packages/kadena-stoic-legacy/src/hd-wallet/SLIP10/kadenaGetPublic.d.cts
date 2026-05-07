import type { BinaryLike } from '../utils/crypto.cjs';
/**
 *
 * @param password - password for decrypting the seed
 * @param seed - encrypted seed to generate keypair
 * @param index - index to generate public key
 * @param derivationPathTemplate - derivation path template
 * @public
 */
export declare function kadenaGetPublic(password: BinaryLike, seed: BinaryLike, index: number, derivationPathTemplate?: string): Promise<string>;
/**
 *
 * @param password - password for decrypting the seed
 * @param seed - encrypted seed to generate keypair
 * @param indexRange - range of indices to generate public keys
 * @param derivationPathTemplate - derivation path template
 * @public
 */
export declare function kadenaGetPublic(password: BinaryLike, seed: BinaryLike, indexRange: [number, number], derivationPathTemplate?: string): Promise<string[]>;
//# sourceMappingURL=kadenaGetPublic.d.ts.map