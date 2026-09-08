"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashDeepSeek = hashDeepSeek;
exports.solvePow = solvePow;
const MASK = (1n << 64n) - 1n;
const ROTATIONS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const CONSTANTS = [
    1n, 0x8082n, 0x800000000000808an, 0x8000000080008000n, 0x808bn, 0x80000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x8an, 0x88n, 0x80008009n, 0x8000000an,
    0x800000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x80000001n, 0x8000000080008008n,
];
function hashDeepSeek(input) {
    const bytes = new TextEncoder().encode(input);
    const state = Array(25).fill(0n);
    const parity = Array(5).fill(0n);
    const theta = Array(5).fill(0n);
    const rhoPi = Array(25).fill(0n);
    const block = new Uint8Array(136);
    block.set(bytes);
    block[bytes.length] ^= 0x06;
    block[135] ^= 0x80;
    for (let index = 0; index < 136; index += 1) {
        state[Math.floor(index / 8)] ^= BigInt(block[index]) << BigInt((index % 8) * 8);
    }
    for (let round = 1; round < 24; round += 1) {
        for (let x = 0; x < 5; x += 1)
            parity[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        for (let x = 0; x < 5; x += 1)
            theta[x] = parity[(x + 4) % 5] ^ rotateLeft(parity[(x + 1) % 5], 1);
        for (let y = 0; y < 5; y += 1)
            for (let x = 0; x < 5; x += 1)
                state[x + 5 * y] ^= theta[x];
        for (let y = 0; y < 5; y += 1)
            for (let x = 0; x < 5; x += 1) {
                const lane = x + 5 * y;
                rhoPi[y + 5 * ((2 * x + 3 * y) % 5)] = rotateLeft(state[lane], ROTATIONS[lane]);
            }
        for (let y = 0; y < 5; y += 1)
            for (let x = 0; x < 5; x += 1) {
                const row = 5 * y;
                state[x + row] = rhoPi[x + row] ^ (~rhoPi[((x + 1) % 5) + row] & MASK & rhoPi[((x + 2) % 5) + row]);
            }
        state[0] ^= CONSTANTS[round];
    }
    return state
        .slice(0, 4)
        .flatMap((lane) => Array.from({ length: 8 }, (_, i) => Number((lane >> BigInt(i * 8)) & 0xffn)))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}
function rotateLeft(value, amount) {
    if (amount === 0)
        return value;
    const shift = BigInt(amount);
    return ((value << shift) | (value >> (64n - shift))) & MASK;
}
function solvePow(challenge) {
    if (challenge.algorithm !== 'DeepSeekHashV1') {
        throw new Error(`Unsupported PoW algorithm: ${challenge.algorithm}`);
    }
    if (!Number.isSafeInteger(challenge.difficulty) || challenge.difficulty <= 0) {
        throw new Error('Invalid PoW difficulty');
    }
    const prefix = `${challenge.salt}_${challenge.expire_at}_`;
    for (let answer = 0; answer < challenge.difficulty; answer += 1) {
        const digest = hashDeepSeek(`${prefix}${answer}`);
        if (digest === challenge.challenge) {
            return { ...challenge, answer };
        }
    }
    throw new Error('Unable to solve PoW challenge');
}
//# sourceMappingURL=pow.js.map