import {
  Browser,
  BrowserContext,
  Page,
  chromium,
  firefox,
} from 'playwright'
import { AuthState, AuthCookie } from './state'
import { saveAuthState, deleteAuthState, authStateExists } from './store'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const DEEPSEEK_SIGN_IN = 'https://chat.deepseek.com/sign_in'

export type { AuthState, AuthCookie }

export async function authenticate(): Promise<{
  authState: AuthState
  browser: Browser
  context: BrowserContext
}> {
  return await launchAndAuth()
}

async function launchAndAuth(): Promise<{
  authState: AuthState
  browser: Browser
  context: BrowserContext
}> {
  const browserInfo = await detectBrowser()
  if (!browserInfo) {
    throw new Error('No supported browser found. Please install Chrome, Edge, Brave, Chromium, or Firefox.')
  }

  // Create a temporary directory for the browser user data
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepfree-browser-'))

  let context: BrowserContext;
  let browser: Browser;
  try {
    if (browserInfo.family === 'chromium') {
      context = await chromium.launchPersistentContext(userDataDir, {
        executablePath: browserInfo.executablePath,
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors',
          '--allow-insecure-localhost',
        ],
      });
    } else if (browserInfo.family === 'firefox') {
      // Firefox options for similar purpose
      context = await firefox.launchPersistentContext(userDataDir, {
        executablePath: browserInfo.executablePath,
        headless: false,
        // Firefox preferences to ignore certificate errors and disable security warnings?
        // We'll set some preferences via FirefoxProfile? Not straightforward with launchPersistentContext.
        // For now, we'll rely on default.
      });
    } else {
      throw new Error('Unsupported browser family: ' + browserInfo.family)
    }

    browser = context.browser() as Browser;

    const page = await context.newPage();

    await page.goto(DEEPSEEK_SIGN_IN, {
      waitUntil: 'networkidle',
    })

    await waitForUserLogin(page)

    const authState = await captureAuthStateFromPage(page)

    const verified = await verifyAuthState(authState)
    if (!verified) {
      authState.verificationStatus = 'failed' as const
      await context.close()
      throw new Error(
        'Browser login appears complete, but HTTP authentication verification failed.',
      )
    }

    authState.verificationStatus = 'verified' as const

    saveAuthState(authState)

    await context.close()

    return {
      authState,
      browser,
      context,
    }
  } finally {
    // Clean up the temporary directory
    try {
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true })
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function detectBrowser(): Promise<{ executablePath: string; family: 'chromium' | 'firefox' } | null> {
  // Order of preference: Chrome, Edge, Brave, Chromium, Firefox
  const browserCandidates = [
    { name: 'chrome', family: 'chromium' as const },
    { name: 'msedge', family: 'chromium' as const },
    { name: 'brave', family: 'chromium' as const },
    { name: 'chromium', family: 'chromium' as const },
    { name: 'firefox', family: 'firefox' as const },
  ]

  for (const candidate of browserCandidates) {
    try {
      let executablePath: string | null = null
      if (process.platform === 'win32') {
        // Try where command first
        try {
          const output = execSync(`where ${candidate.name}`, { encoding: 'utf8', stdio: 'pipe' })
          // Take the first line (first match)
          executablePath = output.split('\n')[0].trim()
        } catch {
          // where command failed, try common locations
          executablePath = null
        }

        // If where command didn't find it, try common locations
        if (!executablePath) {
          const commonLocations = getWindowsCommonLocations(candidate.name)
          for (const location of commonLocations) {
            const { existsSync } = await import('node:fs')
            if (existsSync(location)) {
              executablePath = location
              break
            }
          }
        }
      } else {
        // Use which command (Unix-like)
        try {
          const output = execSync(`which ${candidate.name}`, { encoding: 'utf8', stdio: 'pipe' })
          // Take the first line (first match)
          executablePath = output.split('\n')[0].trim()
        } catch {
          // which command failed, try common locations
          executablePath = null
        }

        // If which command didn't find it, try common locations
        if (!executablePath) {
          const commonLocations = getUnixCommonLocations(candidate.name)
          for (const location of commonLocations) {
            const { existsSync } = await import('node:fs')
            if (existsSync(location)) {
              executablePath = location
              break
            }
          }
        }
      }

      if (executablePath && executablePath.length > 0) {
        // Verify the file exists
        const { existsSync } = await import('node:fs')
        if (existsSync(executablePath)) {
          return { executablePath, family: candidate.family }
        }
      }
    } catch {
      // Ignore errors and try next candidate
      continue
    }
  }

  return null
}

function getWindowsCommonLocations(browserName: string): string[] {
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env['LOCALAPPDATA'] || 'C:\\Users\\' + process.env['USERNAME'] + '\\AppData\\Local'
  const userProfile = process.env['USERPROFILE'] || 'C:\\Users\\' + process.env['USERNAME']

  switch (browserName) {
    case 'chrome':
      return [
        programFiles + '\\Google\\Chrome\\Application\\chrome.exe',
        programFilesX86 + '\\Google\\Chrome\\Application\\chrome.exe',
        localAppData + '\\Google\\Chrome\\Application\\chrome.exe'
      ]
    case 'msedge':
      return [
        programFiles + '\\Microsoft\\Edge\\Application\\msedge.exe',
        programFilesX86 + '\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    case 'brave':
      return [
        programFiles + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        programFilesX86 + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        localAppData + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      ]
    case 'chromium':
      return [
        localAppData + '\\Chromium\\Application\\chromium.exe',
        programFiles + '\\Chromium\\Application\\chromium.exe',
        programFilesX86 + '\\Chromium\\Application\\chromium.exe'
      ]
    case 'firefox':
      return [
        programFiles + '\\Mozilla Firefox\\firefox.exe',
        programFilesX86 + '\\Mozilla Firefox\\firefox.exe',
        userProfile + '\\AppData\\Local\\Mozilla Firefox\\firefox.exe'
      ]
    default:
      return []
  }
}

function getUnixCommonLocations(browserName: string): string[] {
  const commonLocations: string[] = []
  switch (browserName) {
    case 'chrome':
      commonLocations.push(
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      )
      break
    case 'msedge':
      commonLocations.push('/usr/bin/microsoft-edge')
      break
    case 'brave':
      commonLocations.push('/usr/bin/brave-browser')
      break
    case 'chromium':
      commonLocations.push(
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      )
      break
    case 'firefox':
      commonLocations.push('/usr/bin/firefox')
      break
    default:
      break
  }
  // Also check /snap/bin/ and /usr/local/bin/
  const snapPaths = [
    '/snap/bin/google-chrome',
    '/snap/bin/chromium',
    '/snap/bin/brave',
    '/snap/bin/firefox'
  ]
  const usrLocalPaths = [
    '/usr/local/bin/google-chrome',
    '/usr/local/bin/chromium',
    '/usr/local/bin/chromium-browser',
    '/usr/local/bin/microsoft-edge',
    '/usr/local/bin/brave-browser',
    '/usr/local/bin/firefox'
  ]
  commonLocations.push(...snapPaths, ...usrLocalPaths)
  return commonLocations
}

async function waitForUserLogin(page: Page): Promise<void> {
  return new Promise((resolve) => {
    const check = async () => {
      try {
        const title = await page.title()
        const url = page.url()

        const hasSignInForm = await page.$('form[action*="sign_in"]') !== null
        const hasChatHeader = await page.$('header, [data-testid], .chat-header') !== null
        const isLoggedIn = !hasSignInForm && (title.toLowerCase().includes('chat') || title.toLowerCase().includes('deepseek'))

        if (isLoggedIn) {
          resolve()
          return
        }

        if (!url.includes('/sign_in') && title.length > 0 && !title.toLowerCase().includes('sign')) {
          resolve()
          return
        }

        setTimeout(check, 500)
      } catch {
        setTimeout(check, 500)
      }
    }

    check()
  })
}

async function captureAuthStateFromPage(page: Page): Promise<AuthState> {
  const cookies: AuthCookie[] = []

  try {
    const rawCookies = await page.context().cookies()
    const deepSeekCookies = rawCookies.filter(
      (c) => c.domain && (c.domain.includes('deepseek.com') || c.domain.includes('chat.deepseek.com')),
    )

    for (const c of deepSeekCookies) {
      cookies.push({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expires: c.expires ? new Date(c.expires) : undefined,
      })
    }
  } catch {
    // ignore
  }

  let authorizationToken = undefined

  try {
    const evalResult = await page.evaluate(() => {
      for (const key of Object.keys(window)) {
        const val = (window as any)[key]
        if (
          typeof val === 'string' &&
          val.startsWith('Bearer ') &&
          val.length > 20
        ) {
          return val
        }
      }
      return null
    })

    if (evalResult && typeof evalResult === 'string') {
      authorizationToken = evalResult.replace(/^Bearer\s+/i, '').trim()
      if (authorizationToken === '') {
        authorizationToken = undefined
      }
    }
  } catch {
    // ignore
  }

  return {
    authorizationToken,
    cookies,
    capturedAt: Date.now(),
    verificationStatus: 'unverified' as const,
  }
}

async function verifyAuthState(authState: AuthState): Promise<boolean> {
  const clientModule = await import('../deepseek/client')
  const result = await clientModule.createChatSession(authState)
  return result.success
}