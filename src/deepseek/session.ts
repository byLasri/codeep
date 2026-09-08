import { AuthState } from '../auth/state'
import { createChatSession } from './client'

export interface ChatSession {
  id: string
  model: string
  createdAt: number
}

export async function createSession(authState: AuthState): Promise<ChatSession | null> {
  const result = await createChatSession(authState)
  if (!result.success || !result.data) {
    return null
  }

  const data = result.data.data?.biz_data?.chat_session ?? result.data.data?.chat_session ?? result.data
  return {
    id: data.chat_session_id || data.id || '',
    model: data.model_type || 'expert',
    createdAt: Date.now(),
  }
}