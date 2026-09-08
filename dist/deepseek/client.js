"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatSession = createChatSession;
const BASE_ORIGIN = 'https://chat.deepseek.com';
async function createChatSession(authState) {
    const url = new URL('/api/v0/chat_session/create', BASE_ORIGIN);
    const headers = new Headers({
        Accept: '*/*',
        'Content-Type': 'application/json',
        'Origin': BASE_ORIGIN,
        'Referer': BASE_ORIGIN + '/',
        'x-client-bundle-id': 'com.deepseek.chat',
        'x-client-locale': 'en_US',
        'x-client-platform': 'web',
        'x-client-version': '2.4.0',
        'x-client-timezone-offset': String(new Date().getTimezoneOffset()),
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
    const requestOptions = {
        method: 'POST',
        headers,
        body: '{}',
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
    const apiSucceeded = data?.code === undefined || data?.code === 0;
    return {
        success: response.ok && apiSucceeded,
        data,
        error: response.ok && apiSucceeded ? undefined : (data?.msg || data?.error || text),
    };
}
//# sourceMappingURL=client.js.map