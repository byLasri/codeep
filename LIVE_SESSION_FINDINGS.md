# DeepSeek Headless API Findings

## Verified flow

The headless client works with authentication captured from a user-completed
browser login:

1. `deepfree login` opens a browser and captures cookies plus the authorization
   token from authenticated DeepSeek requests.
2. `POST /api/v0/chat_session/create` creates a chat session with body `{}`.
3. `POST /api/v0/chat/create_pow_challenge` requests a challenge for
   `/api/v0/chat/completion`.
4. The client solves `DeepSeekHashV1` and sends the result in the
   `x-ds-pow-response` header.
5. `POST /api/v0/chat/completion` returns an SSE response.

No credentials, cookies, or captured request files belong in source control.

## Required request headers

The client sends the browser-compatible headers below. Values for
`Authorization` and `Cookie` come only from the locally stored auth state and
are never logged.

```text
Accept: */*
Content-Type: application/json
Origin: https://chat.deepseek.com
Referer: https://chat.deepseek.com/
Authorization: Bearer <locally stored token>
Cookie: <locally stored cookies>
x-client-bundle-id: com.deepseek.chat
x-client-platform: web
x-client-version: 2.4.0
x-client-locale: en_US
x-client-timezone-offset: <local offset>
```

## PoW challenge

```json
{
  "algorithm": "DeepSeekHashV1",
  "challenge": "<64-character hexadecimal digest>",
  "salt": "<challenge salt>",
  "signature": "<server signature>",
  "difficulty": 144000,
  "expire_at": 0,
  "expire_after": 300000,
  "target_path": "/api/v0/chat/completion"
}
```

The real `expire_at` value is supplied by the server. The solver hashes:

```text
`${salt}_${expire_at}_${nonce}`
```

and searches nonce values from `0` through `difficulty - 1` until the
DeepSeekHashV1 digest equals `challenge`.

DeepSeekHashV1 is a custom KECCAK-p[1600] construction:

- rounds 1 through 23
- 136-byte rate
- little-endian 32-bit words representing 64-bit lanes
- SHA3 domain suffix `0x06`
- final rate byte XOR `0x80`
- standard Keccak rotation offsets and round constants

The implementation is in [src/deepseek/pow.ts](src/deepseek/pow.ts). Its
reference vector is:

```text
DeepSeekHashV1("abc")
f841106c601ce9be9bc38525e90d4178d47f21dd8eb9f238fc55ffaa4ca94506
```

The resulting PoW object is compact JSON and Base64 encoded:

```json
{
  "algorithm": "DeepSeekHashV1",
  "challenge": "<original challenge>",
  "salt": "<original salt>",
  "answer": 0,
  "signature": "<original signature>",
  "target_path": "/api/v0/chat/completion"
}
```

## Completion request

```json
{
  "chat_session_id": "<session id>",
  "parent_message_id": null,
  "model_type": "expert",
  "prompt": "<user prompt>",
  "ref_file_ids": [],
  "thinking_enabled": true,
  "search_enabled": false,
  "action": null,
  "preempt": false
}
```

The server responds with Server-Sent Events. Events include `ready`,
`update_session`, incremental `data` fragments, `title`, and `close`.
Completion status is reported in the streamed data as `FINISHED`.

## Running the client

```powershell
npm install
npm run build
npm start -- login
node dist/cli.js chat "Reply with exactly LIVE_OK"
```

The current CLI prints the raw SSE stream. This preserves all server events;
an SSE parser can be added later to expose only assistant response fragments.

## Validation

```powershell
npm run build
npm test -- --runInBand
```

The PoW unit tests verify the reference digest and padding edge cases. A live
request has been verified to complete with `status: FINISHED` and an assistant
response.
