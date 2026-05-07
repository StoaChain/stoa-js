/**
 * Takes in Array with IBase64Url values and outputs an Array with unique IBase64Url values
 * @example
 * Here's some example code to use unique:
 *
 * ```ts
 *   const cmdHashes = [
 *     'NjduEShgzrjEmAVhprS85hst7mvCqOo6qjGH5j5WHro',
 *     'pMohh9G2NT1jQn4byK1iwvoLopbnU86NeNPSUq8I0ik',
 *     'pMohh9G2NT1jQn4byK1iwvoLopbnU86NeNPSUq8I0ik',
 *   ];
 *
 *   const uniqueHashesArray = unique(cmdHashes);
 *
 *   // output [
 *   //  'NjduEShgzrjEmAVhprS85hst7mvCqOo6qjGH5j5WHro',
 *   //  'pMohh9G2NT1jQn4byK1iwvoLopbnU86NeNPSUq8I0ik',
 *   // ];
 *
 * ```
 * @alpha
 */
export declare function unique(array: Array<string>): Array<string>;
//# sourceMappingURL=unique.d.ts.map