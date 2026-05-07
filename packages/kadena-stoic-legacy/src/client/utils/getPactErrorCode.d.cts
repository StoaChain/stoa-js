/**
 * Pact error codes
 * @public
 */
export type PactErrorCode = 'RECORD_NOT_FOUND' | 'DEFPACT_COMPLETED' | 'CANNOT_RESOLVE_MODULE' | 'EMPTY_CODE' | 'ERROR';
/**
 * Parses an error message to extract the Pact error code.
 *
 * This function is compatible with both Pact 4 and Pact 5 error formats.
 *
 * @param  error - The error returned by Pact.
 * @returns {@link PactErrorCode} - The extracted Pact error ('ERROR' if the error code could not be extracted).
 *
 * @example
 * ```ts
 * const client = createClient();
 * const response = await client.local(tx);
 * if (response.result.status === 'failure') {
 *   if (getPactErrorCode(response.result.error) === 'RECORD_NOT_FOUND') {
 *     // handle record not found error
 *   }
 * }
 * ```
 * @public
 */
export declare function getPactErrorCode(error: {
    message: string | undefined;
} | undefined): PactErrorCode;
//# sourceMappingURL=getPactErrorCode.d.ts.map