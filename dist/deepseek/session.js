"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
const client_1 = require("./client");
async function createSession(authState) {
    const result = await (0, client_1.createChatSession)(authState);
    if (!result.success || !result.data) {
        return null;
    }
    const data = result.data.data?.biz_data?.chat_session ?? result.data.data?.chat_session ?? result.data;
    return {
        id: data.chat_session_id || data.id || '',
        model: data.model_type || 'expert',
        createdAt: Date.now(),
    };
}
//# sourceMappingURL=session.js.map