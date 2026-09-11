"use strict";
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
exports.loadAuthState = loadAuthState;
exports.saveAuthState = saveAuthState;
exports.sendAuthStateToProxy = sendAuthStateToProxy;
exports.deleteAuthState = deleteAuthState;
exports.authStateExists = authStateExists;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const APP_NAME = 'DeepFree';
function getAppDataDir() {
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData)
            return localAppData;
    }
    if (process.platform === 'darwin') {
        const home = process.env.HOME;
        if (home)
            return path.join(home, 'Library', 'Application Support');
    }
    const xdgDataHome = process.env.XDG_DATA_HOME;
    if (xdgDataHome)
        return xdgDataHome;
    const home = process.env.HOME;
    if (home)
        return path.join(home, 'local', 'share');
    return path.join(os.tmpdir(), 'deepfree');
}
function getStatePath() {
    const base = getAppDataDir();
    const dir = path.join(base, APP_NAME);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'auth.json');
}
function loadAuthState() {
    const statePath = getStatePath();
    if (!fs.existsSync(statePath))
        return null;
    try {
        const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        return {
            authorizationToken: data.authorizationToken,
            cookies: data.cookies || [],
            capturedAt: data.capturedAt || Date.now(),
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
            verificationStatus: data.verificationStatus || 'unverified',
        };
    }
    catch {
        return null;
    }
}
function saveAuthState(state) {
    const statePath = getStatePath();
    const data = {
        authorizationToken: state.authorizationToken,
        cookies: state.cookies,
        capturedAt: state.capturedAt,
        expiresAt: state.expiresAt ? state.expiresAt.toISOString() : undefined,
        verificationStatus: state.verificationStatus,
    };
    fs.writeFileSync(statePath, JSON.stringify(data, null, 2), 'utf-8');
}
async function sendAuthStateToProxy(state) {
    try {
        const proxy = process.env.CO_DEEP_PROXY_ORIGIN || 'http://127.0.0.1:8787';
        const response = await fetch(new URL('/v1/auth', proxy).toString(), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(state),
        });
        return response.ok;
    }
    catch (e) {
        console.error('Failed to send auth state to proxy:', e);
        return false;
    }
}
function deleteAuthState() {
    const statePath = getStatePath();
    try {
        if (fs.existsSync(statePath))
            fs.unlinkSync(statePath);
    }
    catch {
        // ignore
    }
}
function authStateExists() {
    return loadAuthState() !== null;
}
//# sourceMappingURL=store.js.map