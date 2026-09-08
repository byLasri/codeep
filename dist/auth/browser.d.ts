import { AuthState, AuthCookie } from './state';
export type { AuthState, AuthCookie };
/**
 * Opens a browser for DeepSeek authentication.
 * Waits for the user to complete login interactively.
 * Captures cookies and auth state after successful login.
 */
export declare function authenticate(): Promise<{
    authState: AuthState;
    browser: import('playwright').Browser;
    context: import('playwright').BrowserContext;
}>;
