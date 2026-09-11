import { authenticate } from './auth/browser'

const AUTH = 'login'
const STATUS = 'status'
const LOGOUT = 'logout'
const TEST = 'test'
const CHAT = 'chat'

const commands = process.argv.slice(2)

function isCommand(cmd: string, aliases: string[]): boolean {
  return commands[0] === cmd || (aliases && aliases.includes(commands[0]))
}

async function cmdLogin(): Promise<void> {
  try {
    const result = await authenticate()
    console.log('DeepFree: login complete')
    console.log('  Authentication state sent to proxy')
    console.log('  Browser closed successfully')
  } catch (err: unknown) {
    console.error('DeepFree: login failed')
    if (err instanceof Error && err.message.includes('HTTP authentication verification failed')) {
      console.error(`  ${err.message}`)
    } else {
      console.error(`  ${err}`)
    }
    process.exit(1)
  }
}

async function cmdStatus(): Promise<void> {
  const proxy = process.env.CO_DEEP_PROXY_ORIGIN || 'http://127.0.0.1:8787'
  try {
    const res = await fetch(new URL('/v1/auth', proxy).toString(), { method: 'GET' })
    const data = await res.json().catch(() => ({ exists: false }))
    if (!data.exists) {
      console.log('DeepFree')
      console.log('Provider: DeepSeek Web')
      console.log('Status: unauthenticated')
      console.log('Captured: none')
      console.log('HTTP verification: none')
      return
    }
  } catch (e) {
    console.error('DeepFree: failed to reach proxy for status:', e)
    process.exit(1)
  }

  console.log('DeepFree')
  console.log('Provider: DeepSeek Web')
  console.log('Status: authenticated')
  console.log('Authentication state is held by the proxy')
}

async function cmdLogout(): Promise<void> {
  const proxy = process.env.CO_DEEP_PROXY_ORIGIN || 'http://127.0.0.1:8787'
  try {
    const res = await fetch(new URL('/v1/auth', proxy).toString(), { method: 'DELETE' })
    if (!res.ok) throw new Error(`proxy returned ${res.status}`)
    console.log('DeepFree: logged out')
    console.log('  Authentication state deleted from proxy')
    console.log('  Browser profile untouched')
  } catch (e) {
    console.error('DeepFree: failed to delete auth state on proxy:', e)
    process.exit(1)
  }
}

async function cmdTest(): Promise<void> {
  const proxy = process.env.CO_DEEP_PROXY_ORIGIN || 'http://127.0.0.1:8787'
  const response = await fetch(new URL('/health', proxy))
  if (!response.ok) throw new Error(`proxy returned ${response.status}`)
  const data = await response.json() as { authenticated?: boolean }
  console.log(`DeepFree: proxy ${data.authenticated ? 'authenticated' : 'not authenticated'}`)
}

async function cmdChat(): Promise<void> {
  const prompt = commands.slice(1).join(' ').trim()
  if (!prompt) {
    console.error('Usage: deepfree chat <message>')
    process.exit(1)
  }
  throw new Error('The bridge does not send chat requests. Configure Codex to use the proxy and send the prompt there.')
}

const command = commands[0]

switch (command) {
  case AUTH:
    cmdLogin()
    break
  case STATUS:
    cmdStatus()
    break
  case LOGOUT:
    cmdLogout()
    break
  case TEST:
    cmdTest()
    break
  case CHAT:
    cmdChat().catch((err: unknown) => {
      console.error(`DeepFree: chat failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    })
    break
  default:
    console.error('Usage: deepfree <login|status|logout|test|chat>')
    process.exit(1)
}