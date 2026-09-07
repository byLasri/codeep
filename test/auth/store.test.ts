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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadAuthState, saveAuthState, deleteAuthState, authStateExists } from '../../src/auth/store';
import { AuthState } from '../../src/auth/state';

const mockAppDataDir = '/fake/local/app/data';
const mockStatePath = '/fake/local/app/data/DeepFree/auth.json';

describe('Auth Store', () => {
  let originalPlatform: string;
  const originalEnvLocalAppData = process.env.LOCALAPPDATA;
  const originalEnvHome = process.env.HOME;
  const originalEnvXDGDataHome = process.env.XDG_DATA_HOME;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original platform
    originalPlatform = process.platform;
    
    // Reset environment variables
    process.env.LOCALAPPDATA = originalEnvLocalAppData;
    process.env.HOME = originalEnvHome;
    process.env.XDG_DATA_HOME = originalEnvXDGDataHome;
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    // Mock fs.existsSync for app data dir - default to false (dir doesn't exist)
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
      if (path === '/fake/local/app/data/DeepFree') {
        return false; // Dir doesn't exist initially
      }
      return path === mockStatePath; // State file exists if this path is checked
    });
  });

  afterEach(() => {
    // Restore original platform using Object.defineProperty
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    
    // Restore environment variables
    process.env.LOCALAPPDATA = originalEnvLocalAppData;
    process.env.HOME = originalEnvHome;
    process.env.XDG_DATA_HOME = originalEnvXDGDataHome;
  });

  describe('saveAuthState', () => {
    it('should save auth state to file', () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.LOCALAPPDATA = '/fake/local/app/data';
      
      const authState: AuthState = {
        authorizationToken: 'test-token',
        cookies: [],
        capturedAt: Date.now(),
        verificationStatus: 'verified',
      };

      saveAuthState(authState);

      // Should create directory if it doesn't exist
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/fake/local/app/data/DeepFree',
        { recursive: true }
      );

      // Should write file
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockStatePath,
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('loadAuthState', () => {
    it('should load auth state from file', () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.LOCALAPPDATA = '/fake/local/app/data';
      
      const mockData = {
        authorizationToken: 'test-token',
        cookies: [],
        capturedAt: Date.now(),
        verificationStatus: 'verified',
      };
      
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockData));
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const state = loadAuthState();
      
      expect(state).not.toBeNull();
      expect(state?.authorizationToken).toBe('test-token');
      expect(state?.verificationStatus).toBe('verified');
    });

    it('should return null if file does not exist', () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.LOCALAPPDATA = '/fake/local/app/data';
      
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const state = loadAuthState();
      expect(state).toBeNull();
    });
  });

  describe('authStateExists', () => {
    it('should return true when state exists', () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.LOCALAPPDATA = '/fake/local/app/data';
      
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        authorizationToken: 'test',
        cookies: [],
        capturedAt: Date.now(),
        verificationStatus: 'unverified',
      }));
      
      expect(authStateExists()).toBe(true);
    });

    it('should return false when state does not exist', () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.LOCALAPPDATA = '/fake/local/app/data';
      
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(authStateExists()).toBe(false);
    });
  });

  describe('deleteAuthState', () => {
    it('should delete the auth state file', () => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.LOCALAPPDATA = '/fake/local/app/data';
      
      // For delete test, we need to mock that the file EXISTS so unlinkSync gets called
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        // Always return true for the auth state file path so delete attempts to unlink it
        return path === mockStatePath;
      });
      
      deleteAuthState();
      // Should attempt to unlink the file
      expect(fs.unlinkSync).toHaveBeenCalledWith(mockStatePath);
    });
  });
});