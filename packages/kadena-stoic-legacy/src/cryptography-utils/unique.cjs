"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unique = void 0;
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
function unique(array) {
    const isUnique = {};
    return array.filter((item) => {
        if (!isUnique[item]) {
            isUnique[item] = true;
            return true;
        }
        return false;
    });
}
exports.unique = unique;
//# sourceMappingURL=unique.js.map