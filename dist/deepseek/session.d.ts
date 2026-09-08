import { AuthState } from '../auth/state';
export interface ChatSession {
    id: string;
    model: string;
    createdAt: number;
}
export declare function createSession(authState: AuthState): Promise<ChatSession | null>;
