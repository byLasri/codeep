"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatSession = createChatSession;
const BASE_ORIGIN = 'https://chat.deepseek.com';
async function createChatSession(authState) {
    const url = new URL('/api/v0/chat_session/create', BASE_ORIGIN);
    const headers = new Headers({
        'Origin': BASE_ORIGIN,
        'Referer': BASE_ORIGIN + '/',
        'x-client-bundle-id': 'com.deepseek.chat',
        'x-client-locale': 'en_US',
        'x-client-platform': 'web',
        'x-client-version': '2.4.0',
    });
    // Add Authorization header if we have a token
    if (authState.authorizationToken) {
        headers.set('Authorization', `Bearer ${authState.authorizationToken}`);
    }
    // Add cookies if we have any
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
        chat_session_id: '',
        parent_message_id: null,
        model_type: 'expert',
        prompt: '',
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
    const response = await fetch(url, requestOptions);
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = text;
    }
    return {
        success: response.ok,
        data,
        error: response.ok ? undefined : (data?.error || text),
    };
}
//# sourceMappingURL=client.js.map