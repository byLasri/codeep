"use strict";
/**
 * Live Session Communication Test - FINAL VERSION
 * Uses Node.js crypto module for PoW calculation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const nodeCrypto = __importStar(require("crypto"));
const SESSION_CONFIG = {
    baseUrl: 'https://chat.deepseek.com',
    authToken: 'Bearer xcmnne/c0muYFBaZGFxe/rMW63qWRZHZZfdj5ryLbmLGzlUZWF38izzAa1IIYLMT',
    clientVersion: '2.4.0',
    clientBundleId: 'com.deepseek.chat',
    clientPlatform: 'web'
};
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Authorization': SESSION_CONFIG.authToken,
    'x-client-bundle-id': SESSION_CONFIG.clientBundleId,
    'x-client-platform': SESSION_CONFIG.clientPlatform,
    'x-client-version': SESSION_CONFIG.clientVersion,
    'x-client-locale': 'en_US',
    'x-client-timezone-offset': new Date().getTimezoneOffset().toString()
};
async function solvePowChallenge(algorithm, challenge, salt, difficulty) {
    console.log(`Solving PoW: ${algorithm}, difficulty: ${difficulty}...`);
    if (algorithm !== 'DeepSeekHashV1') {
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    const start = Date.now();
    const two256 = BigInt(2) ** BigInt(256);
    const target = two256 / BigInt(difficulty);
    let nonce = 0;
    while (true) {
        const data = `${challenge}${salt}${nonce}`;
        const hashBuffer = nodeCrypto.createHash('sha256').update(data).digest();
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashBigInt = BigInt('0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
        if (hashBigInt < target) {
            console.log(`PoW solved in ${Date.now() - start}ms with nonce: ${nonce}`);
            return nonce;
        }
        nonce++;
        if (nonce % 100000 === 0) {
            console.log(`  Attempted ${nonce.toLocaleString()} nonces...`);
        }
    }
}
async function getPowChallenge(targetPath) {
    const response = await fetch(`${SESSION_CONFIG.baseUrl}/api/v0/chat/create_pow_challenge`, {
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ target_path: targetPath })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get PoW challenge: ${response.status} ${text}`);
    }
    const json = await response.json();
    if (json.code !== 0 || !json.data?.biz_data?.challenge) {
        throw new Error(`API Error: ${json.msg || 'Invalid structure'}`);
    }
    return json.data.biz_data.challenge;
}
async function createChatSession() {
    console.log('Creating new chat session...');
    const response = await fetch(`${SESSION_CONFIG.baseUrl}/api/v0/chat_session/create`, {
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({})
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create session: ${response.status} ${text}`);
    }
    const json = await response.json();
    if (json.code !== 0) {
        throw new Error(`Session creation error: ${json.msg}`);
    }
    const sessionId = json.data?.biz_data?.chat_session?.id;
    console.log('New session created:', sessionId);
    return sessionId;
}
async function sendChatMessage(sessionId, content) {
    console.log('\n--- Sending Chat Message ---');
    console.log(`User: ${content}`);
    const challengeData = await getPowChallenge('/api/v0/chat/completion');
    console.log('Got challenge, solving...');
    const nonce = await solvePowChallenge(challengeData.algorithm, challengeData.challenge, challengeData.salt, challengeData.difficulty);
    const powResponseObj = {
        algorithm: challengeData.algorithm,
        challenge: challengeData.challenge,
        salt: challengeData.salt,
        answer: nonce,
        signature: challengeData.signature,
        target_path: '/api/v0/chat/completion'
    };
    console.log('PoW Response object:', JSON.stringify(powResponseObj));
    const powHeader = Buffer.from(JSON.stringify(powResponseObj)).toString('base64');
    const requestBody = {
        chat_session_id: sessionId,
        messages: [{ role: 'user', content: content }],
        prompt: content,
        ref_file_ids: [],
        stream: false
    };
    const response = await fetch(`${SESSION_CONFIG.baseUrl}/api/v0/chat/completion`, {
        method: 'POST',
        headers: {
            ...DEFAULT_HEADERS,
            'x-ds-pow-response': powHeader
        },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Completion failed: ${response.status} ${text}`);
    }
    const result = await response.json();
    if (result.code !== 0) {
        console.log('Full Response:', JSON.stringify(result, null, 2));
        throw new Error(`API returned error: ${result.msg || result.code}`);
    }
    const reply = result.data?.biz_data?.choices?.[0]?.message?.content;
    console.log('Assistant:', reply);
    console.log('--- End of Message ---\n');
}
async function main() {
    try {
        console.log('Starting Live Session Test...\n');
        const sessionId = await createChatSession();
        await sendChatMessage(sessionId, 'Hi');
        await sendChatMessage(sessionId, 'What is 1+1?');
        console.log('✅ All tests passed!');
    }
    catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=test-live-session.js.map