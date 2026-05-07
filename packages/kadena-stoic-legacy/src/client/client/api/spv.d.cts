import type { ClientRequestInit, SPVResponse } from '@kadena/chainweb-node-client';
import type { ChainId } from '@kadena/types';
import type { IPollOptions } from '../interfaces/interfaces';
export declare function getSpv(host: string, requestKey: string, targetChainId: ChainId, requestInit?: ClientRequestInit): Promise<SPVResponse>;
export declare const pollSpv: (host: string, requestKey: string, targetChainId: ChainId, pollingOptions?: IPollOptions) => Promise<SPVResponse>;
//# sourceMappingURL=spv.d.ts.map