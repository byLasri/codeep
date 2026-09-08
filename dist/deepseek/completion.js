"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestCompletion = requestCompletion;
const BASE_ORIGIN = 'https://chat.deepseek.com';
async function requestCompletion(authState, prompt, chatSessionId) {
    // NOTE: DeepSeek completion currently requires:
    // - x-ds-pow-response: dynamic PoW value (single-use, short-lived)
    // - x-hif-leim: header required for completion
    // These are NOT yet safely implementable in Phase 1.
    // Completion is reserved for Phase 2.
    const url = new URL('/api/v0/chat/completion', BASE_ORIGIN);
    const headers = new Headers({
        'Origin': BASE_ORIGIN,
        'Referer': BASE_ORIGIN + '/',
        'x-client-bundle-id': 'com.deepseek.chat',
        'x-client-locale': 'en_US',
        'x-client-platform': 'web',
        'x-client-version': '2.4.0',
    });
    // Add Authorization header if available
    if (authState.authorizationToken) {
        headers.set('Authorization', `Bearer ${authState.authorizationToken}`);
    }
    // Add cookies if available
    if (authState.cookies && authState.cookies.length > 0) {
        const cookieHeader = authState.cookies
            .map((c) => `${c.name}=${c.value}`)
            .filter((c) => c.length > 0)
            .join('; ');
        if (cookieHeader) {
            headers.set('Cookie', cookieHeader);
        }
    }
    const body = JSON.stringify({
        chat_session_id: chatSessionId,
        parent_message_id: null,
        model_type: 'expert',
        prompt,
        ref_file_ids: [],
        thinking_enabled: true,
        search_enabled: false,
        action: null,
        preempt: false,
    });
    const requestOptions = {
        method: 'POST',
        headers,
        body,
    };
    try {
        const response = await fetch(url, requestOptions);
        const text = await response.text();
        if (!response.ok) {
            const errorData = JSON.parse(text);
            if (errorData?.error?.includes('x-ds-pow-response') ||
                errorData?.error?.includes('x-hif-leim') ||
                text.includes('x-ds-pow-response')) {
                console.info('PoW header required for completion - NOT IMPLEMENTED / NEXT PHASE');
                return null;
            }
        }
        const data = JSON.parse(text);
        return data;
    }
    catch {
        console.info('Completion endpoint not yet implemented - NOT IMPLEMENTED / NEXT PHASE');
        return null;
    }
}
//# sourceMappingURL=completion.js.map