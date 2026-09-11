import { AuthState } from '../auth/state'
import { PowChallenge, solvePow } from './pow'

const BASE_ORIGIN = process.env.CO_DEEP_PROXY_ORIGIN || 'https://chat.deepseek.com'
const COMPLETION_PATH = '/api/v0/chat/completion'

export interface CompletionResult {
  raw: unknown
  text?: string
}

function authHeaders(authState: AuthState): Headers {
  const headers = new Headers({
    Accept: '*/*',
    'Content-Type': 'application/json',
    Origin: BASE_ORIGIN,
    Referer: `${BASE_ORIGIN}/`,
    'x-client-bundle-id': 'com.deepseek.chat',
    'x-client-locale': 'en_US',
    'x-client-platform': 'web',
    'x-client-version': '2.4.0',
    'x-client-timezone-offset': String(new Date().getTimezoneOffset()),
  })

  if (authState.authorizationToken) {
    headers.set('Authorization', `Bearer ${authState.authorizationToken}`)
  }
  const cookies = authState.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  if (cookies) headers.set('Cookie', cookies)
  return headers
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function unwrap<T>(value: unknown): T {
  const root = value as { data?: { biz_data?: T } }
  return root.data?.biz_data ?? (value as T)
}

async function getPowChallenge(authState: AuthState): Promise<PowChallenge> {
  const response = await fetch(`${BASE_ORIGIN}/api/v0/chat/create_pow_challenge`, {
    method: 'POST',
    headers: authHeaders(authState),
    body: JSON.stringify({ target_path: COMPLETION_PATH }),
  })
  const data = await readJson(response)
  if (!response.ok) throw new Error(`PoW challenge failed (${response.status})`)

  const challenge = unwrap<{ challenge?: PowChallenge }>(data).challenge
  if (!challenge) throw new Error('PoW challenge response did not contain a challenge')
  return challenge
}

export async function requestCompletion(
  authState: AuthState,
  prompt: string,
  chatSessionId: string,
): Promise<CompletionResult> {
  const challenge = await getPowChallenge(authState)
  const pow = solvePow(challenge)
  const headers = authHeaders(authState)
  headers.set('x-ds-pow-response', Buffer.from(JSON.stringify(pow)).toString('base64'))

  const response = await fetch(`${BASE_ORIGIN}${COMPLETION_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chat_session_id: chatSessionId,
      parent_message_id: null,
      model_type: 'expert',
      prompt,
      ref_file_ids: [],
      thinking_enabled: true,
      search_enabled: false,
      action: null,
      preempt: false,
    }),
  })
  const raw = await readJson(response)
  if (!response.ok) throw new Error(`Completion failed (${response.status})`)

  const payload = unwrap<{ choices?: Array<{ message?: { content?: string } }> }>(raw)
  return { raw, text: payload.choices?.[0]?.message?.content }
}
