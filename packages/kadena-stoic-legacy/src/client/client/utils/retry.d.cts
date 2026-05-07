import type { IPollOptions } from '../interfaces/interfaces';
export declare const retry: <T extends string | boolean | void | object>(task: () => Promise<T>, signal?: AbortSignal) => (options?: IPollOptions, count?: number) => Promise<T>;
//# sourceMappingURL=retry.d.ts.map