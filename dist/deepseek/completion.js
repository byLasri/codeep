"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestCompletion = requestCompletion;
const pow_1 = require("./pow");
const BASE_ORIGIN = 'https://chat.deepseek.com';
const COMPLETION_PATH = '/api/v0/chat/completion';
function authHeaders(authState) {
    const headers = new Headers({
        Accept: '*/*',
        'Content-Type': 'application/json',
        Origin: BASE_ORIGIN,
        Referer: `${BASE_ORIGIN}/`,
        'x-client-bundle-id': 'com.deepseek.chat',
        'x-client-locale': 'en_US',
        'x-client-platform': 'web',
        'x-client-version': '2.4.0',
        'x-client-timezone-offset': String(new Date().getTimezoneOffset()),
    });
    if (authState.authorizationToken) {
        headers.set('Authorization', `Bearer ${authState.authorizationToken}`);
    }
    const cookies = authState.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    if (cookies)
        headers.set('Cookie', cookies);
    return headers;
}
async function readJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function unwrap(value) {
    const root = value;
    return root.data?.biz_data ?? value;
}
async function getPowChallenge(authState) {
    const response = await fetch(`${BASE_ORIGIN}/api/v0/chat/create_pow_challenge`, {
        method: 'POST',
        headers: authHeaders(authState),
        body: JSON.stringify({ target_path: COMPLETION_PATH }),
    });
    const data = await readJson(response);
    if (!response.ok)
        throw new Error(`PoW challenge failed (${response.status})`);
    const challenge = unwrap(data).challenge;
    if (!challenge)
        throw new Error('PoW challenge response did not contain a challenge');
    return challenge;
}
async function requestCompletion(authState, prompt, chatSessionId) {
    const challenge = await getPowChallenge(authState);
    const pow = (0, pow_1.solvePow)(challenge);
    const headers = authHeaders(authState);
    headers.set('x-ds-pow-response', Buffer.from(JSON.stringify(pow)).toString('base64'));
    const response = await fetch(`${BASE_ORIGIN}${COMPLETION_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            chat_session_id: chatSessionId,
            parent_message_id: null,
            model_type: 'expert',
            prompt,
            ref_file_ids: [],
            thinking_enabled: true,
            search_enabled: false,
            action: null,
            preempt: false,
        }),
    });
    const raw = await readJson(response);
    if (!response.ok)
        throw new Error(`Completion failed (${response.status})`);
    const payload = unwrap(raw);
    return { raw, text: payload.choices?.[0]?.message?.content };
}
//# sourceMappingURL=completion.js.map