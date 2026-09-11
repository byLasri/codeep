import { AuthState } from './state';
export declare function loadAuthState(): AuthState | null;
export declare function saveAuthState(state: AuthState): void;
export declare function sendAuthStateToProxy(state: AuthState): Promise<boolean>;
export declare function deleteAuthState(): void;
export declare function authStateExists(): boolean;
