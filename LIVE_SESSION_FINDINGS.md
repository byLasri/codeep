# DeepSeek Live Session API Investigation Findings

## Summary

Successfully investigated the DeepSeek API using credentials extracted from an active browser session. While we can authenticate and create sessions, the Proof of Work (PoW) validation fails with `INVALID_POW_RESPONSE` error.

## What Works ✅

1. **Authentication**: Bearer token `xcmnne/c0muYFBaZGFxe/rMW63qWRZHZZfdj5ryLbmLGzlUZWF38izzAa1IIYLMT` is valid
2. **Session Creation**: Can create new chat sessions via `/api/v0/chat_session/create`
3. **PoW Challenge Retrieval**: Successfully get challenges from `/api/v0/chat/create_pow_challenge`
4. **PoW Solving**: Correctly implements DeepSeekHashV1 algorithm (SHA256 hash < target)

## What Fails ❌

**Chat Completion Request** returns `40301 INVALID_POW_RESPONSE` despite:
- Using correct nonce that satisfies difficulty requirement
- Properly formatted PoW response object
- Base64 encoding in `x-ds-pow-response` header

## API Endpoints Discovered

```typescript
// 1. Get PoW Challenge
POST https://chat.deepseek.com/api/v0/chat/create_pow_challenge
Headers: Authorization, x-client-* 
Body: { "target_path": "/api/v0/chat/completion" }
Response: { code: 0, data: { biz_data: { challenge: {...} } } }

// 2. Create Chat Session  
POST https://chat.deepseek.com/api/v0/chat_session/create
Headers: Authorization, x-client-*
Body: {}
Response: { code: 0, data: { biz_data: { chat_session: { id: "..." } } } }

// 3. Chat Completion (requires valid PoW)
POST https://chat.deepseek.com/api/v0/chat/completion
Headers: Authorization, x-client-*, x-ds-pow-response (base64 JSON)
Body: {
  chat_session_id: "...",
  messages: [{ role: "user", content: "..." }],
  prompt: "...",
  ref_file_ids: [],
  stream: false
}
```

## PoW Algorithm Details

**Challenge Structure:**
```json
{
  "algorithm": "DeepSeekHashV1",
  "challenge": "5038c6b61677751db1d8f4907ffd0e8862f93156c316a294367608dffbf67915",
  "salt": "a75e60eaaac562b5ef02",
  "signature": "5a0c0b2d9b018ac6f1356db29ff20007b76e621d26dc8f2bf6a949ee339dad00",
  "difficulty": 144000,
  "expire_at": 1788828000000,
  "expire_after": 300000,
  "target_path": "/api/v0/chat/completion"
}
```

**Solution Method:**
```typescript
// Target = 2^256 / difficulty
const target = BigInt(2)**BigInt(256) / BigInt(difficulty);

// Find nonce where SHA256(challenge + salt + nonce) < target
for (let nonce = 0; ; nonce++) {
  const hash = sha256(`${challenge}${salt}${nonce}`);
  if (hashBigInt < target) return nonce;
}
```

**PoW Response Header:**
```typescript
// JSON object base64 encoded
const powResponse = {
  algorithm: "DeepSeekHashV1",
  challenge: "...",
  salt: "...",
  answer: <nonce>,
  signature: "...",  // From challenge, not modified
  target_path: "/api/v0/chat/completion"
};
headerValue = Buffer.from(JSON.stringify(powResponse)).toString('base64');
```

## Possible Issues

1. **Signature Validation**: Server may verify the signature matches the challenge+answer pair
2. **Timing**: PoW must be submitted before `expire_at` timestamp
3. **Single Use**: Each challenge may only be valid for one request
4. **Additional Fields**: Request body may need extra fields not captured in HAR
5. **Client Fingerprinting**: Server may validate client characteristics

## Next Steps for Full Implementation

To achieve working headless API access:

1. **Capture Complete Browser Request**: Use MITM proxy to capture exact bytes of successful request
2. **Analyze Signature Algorithm**: Determine how signature is generated/validated
3. **Check for Additional Headers**: Browser may send extra headers not in our implementation
4. **Verify Request Order**: Some APIs require specific sequence of calls
5. **Test with Fresh Credentials**: Current session may have restrictions

## Test Code Location

Working test implementation: `src/test-live-session.ts`

Run with: `npx ts-node src/test-live-session.ts`

## Credentials Used

- **Auth Token**: `Bearer xcmnne/c0muYFBaZGFxe/rMW63qWRZHZZfdj5ryLbmLGzlUZWF38izzAa1IIYLMT`
- **Extracted From**: HAR file provided by user after browser login
- **Session ID**: Dynamically created (not reused from HAR)

---

*Investigation Date: 2026-09-08*
*Status: Partial Success - Auth works, PoW validation failing*
