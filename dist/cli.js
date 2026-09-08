"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const browser_1 = require("./auth/browser");
const store_1 = require("./auth/store");
const session_1 = require("./deepseek/session");
const client_1 = require("./deepseek/client");
const completion_1 = require("./deepseek/completion");
const AUTH = 'login';
const STATUS = 'status';
const LOGOUT = 'logout';
const TEST = 'test';
const CHAT = 'chat';
const commands = process.argv.slice(2);
function isCommand(cmd, aliases) {
    return commands[0] === cmd || (aliases && aliases.includes(commands[0]));
}
async function cmdLogin() {
    try {
        const result = await (0, browser_1.authenticate)();
        const authState = result.authState;
        console.log('DeepFree: login complete');
        console.log('  Authentication state saved to OS application-data directory');
        console.log('  Browser closed successfully');
    }
    catch (err) {
        console.error('DeepFree: login failed');
        if (err instanceof Error && err.message.includes('HTTP authentication verification failed')) {
            console.error(`  ${err.message}`);
        }
        else {
            console.error(`  ${err}`);
        }
        process.exit(1);
    }
}
async function cmdStatus() {
    const hasState = (0, store_1.authStateExists)();
    if (!hasState) {
        console.log('DeepFree');
        console.log('Provider: DeepSeek Web');
        console.log('Status: unauthenticated');
        console.log('Captured: none');
        console.log('HTTP verification: none');
        return;
    }
    const state = (0, store_1.loadAuthState)();
    if (state === null) {
        console.log('DeepFree');
        console.log('Provider: DeepSeek Web');
        console.log('Status: unauthenticated');
        console.log('Captured: none');
        console.log('HTTP verification: none');
        return;
    }
    console.log('DeepFree');
    console.log('Provider: DeepSeek Web');
    console.log('Status: authenticated');
    console.log(`Captured: ${new Date(state.capturedAt).toISOString()}`);
    console.log('HTTP verification: successful');
    console.log(`Authorization: ${state.authorizationToken ? 'present' : 'absent'}`);
    console.log(`Cookies: ${state.cookies.length}`);
}
async function cmdLogout() {
    (0, store_1.deleteAuthState)();
    console.log('DeepFree: logged out');
    console.log('  Authentication state deleted');
    console.log('  Browser profile untouched');
}
async function cmdTest() {
    const hasState = (0, store_1.authStateExists)();
    if (!hasState) {
        console.log('DeepFree: not authenticated');
        console.log('  No saved authentication state found.');
        console.log('  Run: deepfree login');
        process.exit(1);
    }
    const state = (0, store_1.loadAuthState)();
    if (state === null) {
        console.log('DeepFree: not authenticated');
        console.log('  Failed to load authentication state.');
        process.exit(1);
    }
    try {
        const result = await (0, client_1.createChatSession)(state);
        if (result.success && result.data) {
            console.log('DeepFree: HTTP test successful');
            console.log('  Authenticated request reached DeepSeek API');
            console.log('  Session creation responded successfully');
        }
        else {
            console.log('DeepFree: HTTP test failed');
            console.log(`  API response: ${result.error || 'unknown error'}`);
            process.exit(1);
        }
    }
    catch (err) {
        console.log('DeepFree: HTTP test failed');
        console.log(`  ${err}`);
        process.exit(1);
    }
}
async function cmdChat() {
    const prompt = commands.slice(1).join(' ').trim();
    if (!prompt) {
        console.error('Usage: deepfree chat <message>');
        process.exit(1);
    }
    const state = (0, store_1.loadAuthState)();
    if (!state) {
        console.error('DeepFree: not authenticated');
        console.error('  Run: deepfree login');
        process.exit(1);
    }
    const session = await (0, session_1.createSession)(state);
    if (!session?.id)
        throw new Error('DeepSeek did not return a chat session ID');
    const result = await (0, completion_1.requestCompletion)(state, prompt, session.id);
    console.log(result.text ?? JSON.stringify(result.raw, null, 2));
}
const command = commands[0];
switch (command) {
    case AUTH:
        cmdLogin();
        break;
    case STATUS:
        cmdStatus();
        break;
    case LOGOUT:
        cmdLogout();
        break;
    case TEST:
        cmdTest();
        break;
    case CHAT:
        cmdChat().catch((err) => {
            console.error(`DeepFree: chat failed: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        });
        break;
    default:
        console.error('Usage: deepfree <login|status|logout|test|chat>');
        process.exit(1);
}
//# sourceMappingURL=cli.js.map