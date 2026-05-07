"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = exports.toArrayBuffer = exports.randomBytes = void 0;
/**
 *
 * @param size - size of random bytes
 * @returns Uint8Array of random bytes
 * @public
 */
const randomBytes = (size) => crypto.getRandomValues(new Uint8Array(size));
exports.randomBytes = randomBytes;
const toArrayBuffer = (data) => {
    if (typeof data === 'string') {
        return new TextEncoder().encode(data).buffer;
    }
    return new Uint8Array(data).buffer;
};
exports.toArrayBuffer = toArrayBuffer;
const DEFAULT_ITERATIONS = 310000;
// derive string key
async function deriveKey(password, salt, iterations) {
    const algo = {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: typeof salt === 'string' ? new TextEncoder().encode(salt) : salt,
        iterations,
    };
    return crypto.subtle.deriveKey(algo, await crypto.subtle.importKey('raw', (0, exports.toArrayBuffer)(typeof password === 'string'
        ? new TextEncoder().encode(password).buffer
        : password), {
        name: algo.name,
    }, false, ['deriveKey']), {
        name: 'AES-GCM',
        length: 256,
    }, false, ['encrypt', 'decrypt']);
}
// Encrypt function
async function encrypt(text, password, salt) {
    const algo = {
        name: 'AES-GCM',
        length: 256,
        iv: (0, exports.randomBytes)(12),
    };
    return {
        cipherText: new Uint8Array(await crypto.subtle.encrypt(algo, await deriveKey(password, salt, DEFAULT_ITERATIONS), (0, exports.toArrayBuffer)(typeof text === 'string' ? new TextEncoder().encode(text) : text))),
        iv: algo.iv,
        iterations: DEFAULT_ITERATIONS.toString(),
    };
}
exports.encrypt = encrypt;
// Decrypt function
async function decrypt(encrypted, password, salt) {
    const algo = {
        name: 'AES-GCM',
        length: 256,
        iv: encrypted.iv,
    };
    return new Uint8Array(await crypto.subtle.decrypt(algo, await deriveKey(password, salt, 
    // Use legacy iterations if not specified (for backward compatibility)
    encrypted.iterations !== undefined
        ? parseInt(encrypted.iterations, 10)
        : 1000), (0, exports.toArrayBuffer)(encrypted.cipherText)));
}
exports.decrypt = decrypt;
//# sourceMappingURL=crypto.js.map