import { AuthState } from './state';
export declare function loadAuthState(): AuthState | null;
export declare function saveAuthState(state: AuthState): void;
export declare function deleteAuthState(): void;
export declare function authStateExists(): boolean;
