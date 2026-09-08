import { AuthState } from '../auth/state';
export interface CompletionResult {
    raw: unknown;
    text?: string;
}
export declare function requestCompletion(authState: AuthState, prompt: string, chatSessionId: string): Promise<CompletionResult>;
