import { AuthState } from '../auth/state';
export interface CompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: any;
        text: string;
        finish_reason: string | null;
    }>;
}
export declare function requestCompletion(authState: AuthState, prompt: string, chatSessionId: string): Promise<CompletionResponse | null>;
