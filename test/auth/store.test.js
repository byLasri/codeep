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
// Mock the fs module for testing
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
}));
jest.mock('path');
jest.mock('os');
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const store_1 = require("../../src/auth/store");
const mockAppDataDir = '/fake/app/data';
const mockStatePath = '/fake/app/data/DeepFree/auth.json';
describe('Auth Store', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock process.platform
        process.platform = 'win32';
        process.env.LOCALAPPDATA = '/fake/local/app/data';
        // Mock path.join to return predictable paths
        path.join.mockImplementation((...args) => args.join('/'));
        // Mock fs.existsSync for app data dir
        fs.existsSync.mockImplementation((path) => {
            if (path === '/fake/local/app/data/DeepFree') {
                return false; // Dir doesn't exist initially
            }
            return path === mockStatePath; // State file exists if this path is checked
        });
    });
    describe('saveAuthState', () => {
        it('should save auth state to file', () => {
            const authState = {
                authorizationToken: 'test-token',
                cookies: [],
                capturedAt: Date.now(),
                verificationStatus: 'verified',
            };
            (0, store_1.saveAuthState)(authState);
            // Should create directory if it doesn't exist
            expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/local/app/data/DeepFree', { recursive: true });
            // Should write file
            expect(fs.writeFileSync).toHaveBeenCalledWith(mockStatePath, expect.any(String), 'utf-8');
        });
    });
    describe('loadAuthState', () => {
        it('should load auth state from file', () => {
            const mockData = {
                authorizationToken: 'test-token',
                cookies: [],
                capturedAt: Date.now(),
                verificationStatus: 'verified',
            };
            fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
            fs.existsSync.mockReturnValue(true);
            const state = (0, store_1.loadAuthState)();
            expect(state).not.toBeNull();
            expect(state?.authorizationToken).toBe('test-token');
            expect(state?.verificationStatus).toBe('verified');
        });
        it('should return null if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            const state = (0, store_1.loadAuthState)();
            expect(state).toBeNull();
        });
    });
    describe('authStateExists', () => {
        it('should return true when state exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                authorizationToken: 'test',
                cookies: [],
                capturedAt: Date.now(),
                verificationStatus: 'unverified',
            }));
            expect((0, store_1.authStateExists)()).toBe(true);
        });
        it('should return false when state does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            expect((0, store_1.authStateExists)()).toBe(false);
        });
    });
    describe('deleteAuthState', () => {
        it('should delete the auth state file', () => {
            (0, store_1.deleteAuthState)();
            // Should attempt to unlink the file
            // Note: We're not mocking the exact path here since it depends on path.join mocks
            expect(fs.unlinkSync).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=store.test.js.map