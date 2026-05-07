import type { IKeyPair, SignCommand } from '@stoachain/kadena-stoic-legacy/types';
/**
 Sign a hash using key pair

 * @alpha
*/
export declare function signHash(hash: string, { secretKey, publicKey }: IKeyPair): SignCommand;
//# sourceMappingURL=signHash.d.ts.map