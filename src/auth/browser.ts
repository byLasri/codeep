import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { saveAuthState, deleteAuthState, authStateExists } from './store'
import { AuthState, AuthCookie } from './state'
import type { Page, Browser, BrowserContext } from 'playwright'

const DEEPSEEK_SIGN_IN = 'https://chat.deepseek.com/sign_in'
const DEEPSEEK_CHAT = 'https://chat.deepseek.com'

export type { AuthState, AuthCookie }

/**
 * Opens a browser for DeepSeek authentication.
 * Waits for the user to complete login interactively.
 * Captures cookies and auth state after successful login.
 */
export async function authenticate(): Promise<{
  authState: AuthState
  browser: import('playwright').Browser
  context: import('playwright').BrowserContext
}> {
  return await launchAndAuth()
}

async function launchAndAuth(): Promise<{
  authState: AuthState
  browser: import('playwright').Browser
  context: import('playwright').BrowserContext
}> {
  const browserInfo = await detectBrowser()
  if (!browserInfo) {
    throw new Error('No supported browser found. Please install Chrome, Edge, Brave, Chromium, or Firefox.')
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepfree-browser-'))

  let context: import('playwright').BrowserContext;
  let browser: import('playwright').Browser | undefined = undefined;
  try {
    if (browserInfo.family === 'chromium') {
      const { chromium } = await import('playwright')
      browser = await chromium.launch({
        executablePath: browserInfo.executablePath,
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--ignore-certificate-errors',
          '--allow-insecure-localhost',
        ],
      });
      context = await browser.newContext({
        storageState: undefined,
      });
    } else if (browserInfo.family === 'firefox') {
      const { firefox } = await import('playwright')
      browser = await firefox.launch({
        executablePath: browserInfo.executablePath,
        headless: false,
      });
      context = await browser.newContext();
    } else {
      throw new Error('Unsupported browser family: ' + browserInfo.family)
    }

    let observedAuthorizationToken: string | undefined
    const pendingAuthHeaderReads: Promise<void>[] = []
    const observeRequest = (request: import('playwright').Request): void => {
      const read = request.allHeaders().then((headers) => {
        const url = new URL(request.url())
        if (!url.hostname.endsWith('deepseek.com')) return
        const authorization = headers.authorization
        if (!observedAuthorizationToken && authorization?.trim()) {
          observedAuthorizationToken = authorization.replace(/^Bearer\s+/i, '').trim()
        }
      }).catch(() => {
        // Ignore requests whose headers are unavailable.
      })
      pendingAuthHeaderReads.push(read)
    }
    context.on('request', observeRequest)

    const page = await context.newPage();
    page.on('request', observeRequest)

    console.log('DeepFree: Opening browser for authentication...')
    console.log('Please log in at https://chat.deepseek.com/sign_in')
    console.log('Use email/password login (not Google auth)')
    
    await page.goto(DEEPSEEK_SIGN_IN, {
      waitUntil: 'networkidle',
    })

    await waitForUserLogin(page)

    await page.waitForTimeout(1500)
    await new Promise((resolve) => setTimeout(resolve, 250))
    await Promise.all(pendingAuthHeaderReads)
    const authState = await captureAuthStateFromPage(page, observedAuthorizationToken)

    const verification = await verifyAuthState(authState)
    if (!verification.success) {
      authState.verificationStatus = 'failed' as const
      deleteAuthState()
      if (browser) {
        await browser.close()
      }
      throw new Error(
        `Browser login appears complete, but HTTP authentication verification failed (authorization token observed: ${Boolean(authState.authorizationToken)}; ${verification.error ?? 'no API error details'}).`,
      )
    }

    authState.verificationStatus = 'verified' as const
    saveAuthState(authState)

    if (browser) {
      await browser.close()
    }

    console.log('DeepFree: Login complete!')
    console.log('  Authentication state saved')
    console.log('  Browser closed')

    return {
      authState,
      browser: browser!,
      context,
    }
  } catch (error) {
    try {
      if (browser) {
        await browser.close()
      }
    } catch {
      // ignore
    }
    throw error
  } finally {
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
        try {
          const output = execSync(`where ${candidate.name}`, { encoding: 'utf8', stdio: 'pipe' })
          executablePath = output.split('\n')[0].trim()
        } catch {
          executablePath = null
        }

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
        try {
          const output = execSync(`which ${candidate.name}`, { encoding: 'utf8', stdio: 'pipe' })
          executablePath = output.split('\n')[0].trim()
        } catch {
          executablePath = null
        }

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
        const { existsSync } = await import('node:fs')
        if (existsSync(executablePath)) {
          return { executablePath, family: candidate.family }
        }
      }
    } catch {
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
      commonLocations.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser')
      break
    case 'msedge':
      commonLocations.push('/usr/bin/microsoft-edge')
      break
    case 'brave':
      commonLocations.push('/usr/bin/brave-browser')
      break
    case 'chromium':
      commonLocations.push('/usr/bin/chromium', '/usr/bin/chromium-browser')
      break
    case 'firefox':
      commonLocations.push('/usr/bin/firefox')
      break
    default:
      break
  }
  const snapPaths = ['/snap/bin/google-chrome', '/snap/bin/chromium', '/snap/bin/brave', '/snap/bin/firefox']
  const usrLocalPaths = ['/usr/local/bin/google-chrome', '/usr/local/bin/chromium', '/usr/local/bin/chromium-browser', '/usr/local/bin/microsoft-edge', '/usr/local/bin/brave-browser', '/usr/local/bin/firefox']
  commonLocations.push(...snapPaths, ...usrLocalPaths)
  return commonLocations
}

async function waitForUserLogin(page: Page): Promise<void> {
  console.log('DeepFree: Waiting for you to complete login...')
  
  return new Promise((resolve) => {
    let lastUrl = ''
    let stableCount = 0
    let loginDetectedAt = 0

    const check = async () => {
      try {
        const url = page.url()
        const title = await page.title()

        const urlChanged = url !== lastUrl
        if (urlChanged) {
          stableCount = 0
          lastUrl = url
        } else {
          stableCount++
        }

        const isOnSignInPage = url.includes('/sign_in') || 
                               url.includes('/login') ||
                               title.toLowerCase().includes('sign in') || 
                               title.toLowerCase().includes('log in') ||
                               title.toLowerCase().includes('login')

        const hasPasswordField = await page.$('input[type="password"]') !== null
        const hasEmailField = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]') !== null
        const hasChatInterface = await page.$('[data-testid="chat"], .chat-container, .message-input, button[data-testid*="send"], textarea[placeholder*="message" i], div[contenteditable="true"]') !== null
        const hasUserProfile = await page.$('[data-testid="user"], .user-avatar, .profile-menu, [class*="avatar" i], [class*="profile" i], [class*="account" i]') !== null
        const hasLoggedInNav = await page.$('nav[class*="sidebar" i], aside[class*="nav" i], header[class*="dashboard" i]') !== null

        const isLoggedIn = !isOnSignInPage && 
                          !hasPasswordField && 
                          !hasEmailField &&
                          (hasChatInterface || hasUserProfile || hasLoggedInNav)

        if (isLoggedIn && loginDetectedAt === 0) {
          loginDetectedAt = Date.now()
          setTimeout(async () => {
            const finalUrl = page.url()
            const stillNotSignIn = !finalUrl.includes('/sign_in') && !finalUrl.includes('/login')
            const stillNoPassword = await page.$('input[type="password"]') === null
            const stillNoEmail = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]') === null
            
            if (stillNotSignIn && stillNoPassword && stillNoEmail) {
              console.log('DeepFree: Login detected!')
              resolve()
            } else {
              loginDetectedAt = 0
              check()
            }
          }, 2000)
          return
        }

        if (!isOnSignInPage && 
            !hasPasswordField && 
            !hasEmailField &&
            title.length > 0 && 
            (title.toLowerCase().includes('chat') || title.toLowerCase().includes('deepseek') || title.toLowerCase().includes('assistant'))) {
          if (loginDetectedAt === 0) {
            loginDetectedAt = Date.now()
          }
          setTimeout(async () => {
            const finalUrl = page.url()
            const stillNotSignIn = !finalUrl.includes('/sign_in') && !finalUrl.includes('/login')
            const stillNoPassword = await page.$('input[type="password"]') === null
            const stillNoEmail = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]') === null
            
            if (stillNotSignIn && stillNoPassword && stillNoEmail) {
              console.log('DeepFree: Login detected!')
              resolve()
            } else {
              loginDetectedAt = 0
              check()
            }
          }, 2000)
          return
        }

        if (stableCount > 12 && isOnSignInPage) {
          if (stableCount % 24 === 12) {
            console.log('DeepFree: Still waiting for login...')
          }
        }

        setTimeout(check, 500)
      } catch (err) {
        setTimeout(check, 500)
      }
    }

    check()
  })
}

async function captureAuthStateFromPage(
  page: Page,
  observedAuthorizationToken?: string,
): Promise<AuthState> {
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

  let authorizationToken: string | undefined = observedAuthorizationToken ?? undefined

  try {
    const evalResult = await page.evaluate(() => {
      const stores = [window.localStorage, window.sessionStorage]
      const normalizeToken = (value: string): string | null => {
        const bearer = value.match(/Bearer\s+([^\s"',}]+)/i)
        if (bearer?.[1]) return bearer[1]
        if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
          return value
        }
        return null
      }
      const findToken = (value: unknown, key = ''): string | null => {
        if (typeof value === 'string') {
          const token = normalizeToken(value)
          return token && (/token|auth|credential|session/i.test(key) || value.startsWith('Bearer '))
            ? token
            : null
        }
        if (value && typeof value === 'object') {
          for (const [nestedKey, nested] of Object.entries(value)) {
            const result = findToken(nested, nestedKey)
            if (result) return result
          }
        }
        return null
      }
      for (const store of stores) {
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index)
          const value = key ? store.getItem(key) : null
          if (value) {
            let parsed: unknown = value
            try {
              parsed = JSON.parse(value)
            } catch {
              // Plain storage values are handled directly.
            }
            const token = findToken(parsed, key ?? '')
            if (token) return `Bearer ${token}`
          }
        }
      }
      return null
    })

    if (!authorizationToken && evalResult && typeof evalResult === 'string') {
      authorizationToken = evalResult.replace(/^Bearer\s+/i, '').trim()
      if (authorizationToken === '') {
        authorizationToken = undefined
      }

    }
  } catch {
    // ignore
  }

  if (!authorizationToken) {
    const cookiesWithToken = cookies.find((cookie) => /token|auth/i.test(cookie.name))
    authorizationToken = cookiesWithToken?.value
  }

  return {
    authorizationToken,
    cookies,
    capturedAt: Date.now(),
    verificationStatus: 'unverified' as const,
  }
}

async function verifyAuthState(authState: AuthState): Promise<{ success: boolean; error?: string }> {
  const clientModule = await import('../deepseek/client')
  const result = await clientModule.createChatSession(authState)
  return { success: result.success, error: result.error }
}
