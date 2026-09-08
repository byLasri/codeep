import { AuthState } from '../auth/state';
export interface DeepSeekResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
export declare function createChatSession(authState: AuthState): Promise<DeepSeekResponse>;
