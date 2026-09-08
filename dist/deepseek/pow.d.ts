export interface PowChallenge {
    algorithm: string;
    challenge: string;
    salt: string;
    signature: string;
    difficulty: number;
    target_path: string;
    expire_at: number;
}
export interface PowResponse extends PowChallenge {
    answer: number;
}
export declare function hashDeepSeek(input: string): string;
export declare function solvePow(challenge: PowChallenge): PowResponse;
