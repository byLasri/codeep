# DeepSeek Active Session Analysis

## Extracted Credentials from HAR Data

### Authentication Token
```
Authorization: Bearer xcmnne/c0muYFBaZGFxe/rMW63qWRZHZZfdj5ryLbmLGzlUZWF38izzAa1IIYLMT
```

### Session Information
- **Chat Session ID**: `b194b27d-dab3-4133-b895-12bad80e39c8`
- **Session Sequence ID**: `210990319`
- **User Unique ID**: `a899e400-7d0e-4b66-873b-192403f09e5a`
- **Web ID**: `7682953682245160705`

### Client Headers Required
```json
{
  "x-client-bundle-id": "com.deepseek.chat",
  "x-client-platform": "web",
  "x-client-version": "2.4.0",
  "x-client-locale": "en_US",
  "x-client-timezone-offset": "3600",
  "content-type": "application/json",
  "accept": "*/*"
}
```

### API Endpoints Discovered

1. **Create PoW Challenge**
   - URL: `POST https://chat.deepseek.com/api/v0/chat/create_pow_challenge`
   - Body: `{"target_path":"/api/v0/chat/completion"}`
   - Returns: Challenge with algorithm, salt, difficulty, signature

2. **Create Chat Session**
   - URL: `POST https://chat.deepseek.com/api/v0/chat_session/create`
   - Body: `{}`
   - Returns: New chat session object

3. **Chat Completion** (requires PoW)
   - URL: `POST https://chat.deepseek.com/api/v0/chat/completion`
   - Headers: `x-ds-pow-response` (PoW solution)
   - Body: Chat message payload

4. **Analytics Endpoint**
   - URL: `POST https://gator.volces.com/list`
   - Used for telemetry/events tracking

## PoW (Proof of Work) Details

From the challenge response:
```json
{
  "algorithm": "DeepSeekHashV1",
  "challenge": "2d9dae31a881e9a51df1921f8bd43154bdc0d0bb2bc63be973d5327dd1566318",
  "salt": "fef1ebf52856856ac4a7",
  "signature": "6a5d82caae83cb5d23516b52b70622fc78902e254f9c65ff9933978e2492eac8",
  "difficulty": 144000,
  "expire_at": 1788827418910,
  "expire_after": 300000,
  "target_path": "/api/v0/chat/completion"
}
```

The answer found in the completion request header was: `56428`

## How DeepSeekHashV1 Works

Based on the data:
1. Server sends a challenge with salt and difficulty
2. Client must find a nonce that when hashed with the challenge produces a hash below the difficulty threshold
3. The answer (nonce) is sent back in `x-ds-pow-response` header
4. The header contains a JSON with: algorithm, challenge, salt, answer, signature, target_path

## Headless Proxy Architecture

### Option 1: Direct API Client (Recommended)
Since we have valid credentials, we can bypass browser entirely:

```typescript
// Direct API client using extracted tokens
class DeepSeekClient {
  private baseUrl = 'https://chat.deepseek.com';
  private token: string;
  private sessionId?: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  async createSession() {
    const resp = await fetch(`${this.baseUrl}/api/v0/chat_session/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: '{}'
    });
    const data = await resp.json();
    this.sessionId = data.data.biz_data.chat_session.id;
    return this.sessionId;
  }
  
  async sendMessage(message: string) {
    // 1. Get PoW challenge
    const powResp = await fetch(`${this.baseUrl}/api/v0/chat/create_pow_challenge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ target_path: '/api/v0/chat/completion' })
    });
    const { biz_data: { challenge } } = await powResp.json();
    
    // 2. Solve PoW
    const answer = await this.solvePow(challenge);
    
    // 3. Send message with PoW
    const completionResp = await fetch(`${this.baseUrl}/api/v0/chat/completion`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'x-ds-pow-response': JSON.stringify({
          algorithm: challenge.algorithm,
          challenge: challenge.challenge,
          salt: challenge.salt,
          answer: answer,
          signature: challenge.signature,
          target_path: challenge.target_path
        })
      },
      body: JSON.stringify({
        chat_session_id: this.sessionId,
        messages: [{ role: 'user', content: message }]
      })
    });
    
    return completionResp.json();
  }
  
  private getHeaders() {
    return {
      'authorization': `Bearer ${this.token}`,
      'x-client-bundle-id': 'com.deepseek.chat',
      'x-client-platform': 'web',
      'x-client-version': '2.4.0',
      'x-client-locale': 'en_US',
      'x-client-timezone-offset': '3600',
      'content-type': 'application/json',
      'accept': '*/*'
    };
  }
  
  private async solvePow(challenge: any): Promise<number> {
    // Implement DeepSeekHashV1 algorithm
    // Brute force nonce until hash < difficulty
    const crypto = require('crypto');
    let nonce = 0;
    const target = Math.pow(2, 256) / challenge.difficulty;
    
    while (true) {
      const input = `${challenge.challenge}${challenge.salt}${nonce}`;
      const hash = crypto.createHash('sha256').update(input).digest('hex');
      const hashValue = BigInt('0x' + hash);
      
      if (hashValue < BigInt(Math.floor(target))) {
        return nonce;
      }
      nonce++;
    }
  }
}
```

### Option 2: MITM Proxy with Recorded Session
Use the existing session cookies/tokens to proxy requests:

```bash
# Using mitmproxy or similar
mitmweb --mode reverse:https://chat.deepseek.com \
  --set confdir=~/.mitmproxy/deepseek \
  --set upstream_cert=false
```

Configure proxy to inject:
- Authorization header with Bearer token
- All required x-client-* headers
- Reuse existing session ID

### Option 3: Puppeteer/Playwright in Headless Mode with Pre-loaded Auth
Launch browser with pre-set authentication:

```typescript
const browser = await playwright.chromium.launch({ 
  headless: true,
  args: ['--disable-blink-features=AutomationControlled']
});

const context = await browser.newContext({
  baseURL: 'https://chat.deepseek.com',
  extraHTTPHeaders: {
    'authorization': 'Bearer xcmnne/c0muYFBaZGFxe/rMW63qWRZHZZfdj5ryLbmLGzlUZWF38izzAa1IIYLMT'
  }
});

// Set cookies from HAR data
await context.addCookies([
  { name: 'auth_token', value: '...', domain: 'chat.deepseek.com', path: '/' }
]);
```

## Implementation Steps

1. **Extract and store credentials securely**
   - Save Bearer token to environment variable
   - Store session ID for reuse

2. **Implement PoW solver**
   - DeepSeekHashV1 algorithm
   - Cache solutions while valid (5 min TTL)

3. **Build REST client**
   - Session management
   - Message sending/receiving
   - Stream handling for real-time responses

4. **Add error handling**
   - Token expiration detection
   - Automatic re-authentication flow
   - Rate limiting compliance

5. **Test with recorded session**
   - Verify API calls match HAR data patterns
   - Ensure PoW solutions are accepted

## Security Notes

⚠️ **WARNING**: The credentials in this analysis are from a real active session.
- Never commit tokens to version control
- Rotate tokens regularly
- Use environment variables for storage
- Implement proper token refresh mechanisms

## Next Steps

1. Create `src/api/deepseek-client.ts` with direct API implementation
2. Add PoW solver utility `src/utils/pow-solver.ts`
3. Update CLI to support `--headless` mode using API instead of browser
4. Add configuration for storing/retrieving auth tokens
5. Implement session persistence across CLI invocations
