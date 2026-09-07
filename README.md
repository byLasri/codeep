# DeepFree

A minimal TypeScript authentication client for DeepSeek Web.

## Phase 1: Browser-based Authentication

This implementation focuses on proving the authentication flow:

1. User runs `deepfree login`
2. System launches browser to https://chat.deepseek.com/sign_in
3. User manually completes AWS WAF + DeepSeek authentication
4. System captures minimum authentication state
5. System verifies authentication via HTTP request
6. System stores auth state in OS application-data directory
7. User can run `deepfree test` to verify authenticated requests work

## Features

- ✅ Browser-based login using Playwright
- ✅ Manual authentication (no password collection)
- ✅ Auth state capture and verification
- ✅ OS application-data directory storage
- ✅ Minimal dependencies
- ✅ TypeScript implementation
- ✅ CLI with login, status, logout, test commands

## Installation

```bash
npm install
```

## Usage

```bash
# Login - launches browser for manual authentication
deepfree login

# Check authentication status
deepfree status

# Logout - removes saved authentication state
deepfree logout

# Test - makes authenticated HTTP request to verify state works
deepfree test
```

## Architecture

```
src/
  auth/
    browser.ts   - Playwright browser automation
    capture.ts   - Auth state extraction (combined with browser)
    state.ts     - AuthState type definitions
    store.ts     - OS application-data persistence
  deepseek/
    client.ts    - HTTP client for DeepSeek API
    session.ts   - Chat session management
    completion.ts- Completion endpoint (Phase 2)
  cli.ts         - Command-line interface
```

## Security

- Never logs or stores passwords
- Only captures minimum required auth state
- Stores state outside project directory (OS app data)
- Redacts sensitive information in logs/error messages

## Testing

```bash
# Run unit tests
npm test
```

Note: Full end-to-end testing requires a real DeepSeek account and manual browser interaction.

## OS Application Data Directory

Auth state is stored in:
- Windows: `%LOCALAPPDATA%\DeepFree\auth.json`
- macOS: `$HOME/Library/Application Support/DeepFree/auth.json`
- Linux: `$XDG_DATA_HOME/DeepFree/auth.json` or `$HOME/local/share/DeepFree/auth.json`