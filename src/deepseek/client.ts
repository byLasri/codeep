import { AuthState } from '../auth/state'

const DEFAULT_ORIGIN = process.env.CO_DEEP_PROXY_ORIGIN || 'https://chat.deepseek.com'

export interface DeepSeekResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function createChatSession(
  authState: AuthState,
  origin = DEFAULT_ORIGIN,
): Promise<DeepSeekResponse> {
  const url = new URL('/api/v0/chat_session/create', origin)

  const headers = new Headers({
    Accept: '*/*',
    'Content-Type': 'application/json',
    'Origin': origin,
    'Referer': origin + '/',
    'x-client-bundle-id': 'com.deepseek.chat',
    'x-client-locale': 'en_US',
    'x-client-platform': 'web',
    'x-client-version': '2.4.0',
    'x-client-timezone-offset': String(new Date().getTimezoneOffset()),
  })

  // Add Authorization header if we have a token
  if (authState.authorizationToken) {
    headers.set('Authorization', `Bearer ${authState.authorizationToken}`)
  }

  // Add cookies if we have any
  if (authState.cookies && authState.cookies.length > 0) {
    const cookieHeader = authState.cookies
      .map((c) => `${c.name}=${c.value}`)
      .filter((c) => c.length > 0)
      .join('; ')
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }
  }

  const requestOptions = {
    method: 'POST',
    headers,
    body: '{}',
  }

  const response = await fetch(url, requestOptions)

  const text = await response.text()

  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  const apiSucceeded = data?.code === undefined || data?.code === 0
  return {
    success: response.ok && apiSucceeded,
    data,
    error: response.ok && apiSucceeded
      ? undefined
      : typeof (data?.msg || data?.error) === 'string'
        ? (data.msg || data.error)
        : JSON.stringify(data?.msg || data?.error || text),
  }
}