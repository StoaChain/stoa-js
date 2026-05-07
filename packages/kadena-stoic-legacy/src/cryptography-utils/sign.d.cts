import type { IKeyPair, SignCommand } from '@stoachain/kadena-stoic-legacy/types';
/**
Perform blake2b256 hashing on a message, and sign using keyPair.

 * @alpha
*/
export declare function sign(msg: string, { secretKey, publicKey }: IKeyPair): SignCommand;
//# sourceMappingURL=sign.d.ts.map