import { authenticate } from './auth/browser'
import { loadAuthState, deleteAuthState, authStateExists } from './auth/store'
import { createSession } from './deepseek/session'
import { createChatSession } from './deepseek/client'

const AUTH = 'login'
const STATUS = 'status'
const LOGOUT = 'logout'
const TEST = 'test'

const commands = process.argv.slice(2)

function isCommand(cmd: string, aliases: string[]): boolean {
  return commands[0] === cmd || (aliases && aliases.includes(commands[0]))
}

async function cmdLogin(): Promise<void> {
  try {
    const result = await authenticate()
    const authState = result.authState

    console.log('DeepFree: login complete')
    console.log('  Authentication state saved to OS application-data directory')
    console.log('  Browser closed successfully')
  } catch (err: unknown) {
    console.error('DeepFree: login failed')
    if (err instanceof Error && err.message.includes('HTTP authentication verification failed')) {
      console.error('  Browser login appears complete, but HTTP authentication verification failed.')
    } else {
      console.error(`  ${err}`)
    }
    process.exit(1)
  }
}

async function cmdStatus(): Promise<void> {
  const hasState = authStateExists()

  if (!hasState) {
    console.log('DeepFree')
    console.log('Provider: DeepSeek Web')
    console.log('Status: unauthenticated')
    console.log('Captured: none')
    console.log('HTTP verification: none')
    return
  }

  const state = loadAuthState()
  if (state === null) {
    console.log('DeepFree')
    console.log('Provider: DeepSeek Web')
    console.log('Status: unauthenticated')
    console.log('Captured: none')
    console.log('HTTP verification: none')
    return
  }

  console.log('DeepFree')
  console.log('Provider: DeepSeek Web')
  console.log('Status: authenticated')
  console.log(`Captured: ${new Date(state.capturedAt).toISOString()}`)
  console.log('HTTP verification: successful')
  console.log(`Authorization: ${state.authorizationToken ? 'present' : 'absent'}`)
  console.log(`Cookies: ${state.cookies.length}`)
}

async function cmdLogout(): Promise<void> {
  deleteAuthState()
  console.log('DeepFree: logged out')
  console.log('  Authentication state deleted')
  console.log('  Browser profile untouched')
}

async function cmdTest(): Promise<void> {
  const hasState = authStateExists()
  if (!hasState) {
    console.log('DeepFree: not authenticated')
    console.log('  No saved authentication state found.')
    console.log('  Run: deepfree login')
    process.exit(1)
  }

  const state = loadAuthState()
  if (state === null) {
    console.log('DeepFree: not authenticated')
    console.log('  Failed to load authentication state.')
    process.exit(1)
  }

  try {
    const result = await createChatSession(state)
    if (result.success && result.data) {
      console.log('DeepFree: HTTP test successful')
      console.log('  Authenticated request reached DeepSeek API')
      console.log('  Session creation responded successfully')
    } else {
      console.log('DeepFree: HTTP test failed')
      console.log(`  API response: ${result.error || 'unknown error'}`)
      process.exit(1)
    }
  } catch (err: unknown) {
    console.log('DeepFree: HTTP test failed')
    console.log(`  ${err}`)
    process.exit(1)
  }
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
  default:
    console.error('Usage: deepfree <login|status|logout|test>')
    process.exit(1)
}