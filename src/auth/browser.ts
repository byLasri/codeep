import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { saveAuthState, deleteAuthState, authStateExists } from './store'
import { AuthState, AuthCookie } from './state'
import type { Page, Browser, BrowserContext } from 'playwright'

const DEEPSEEK_SIGN_IN = 'https://chat.deepseek.com/sign_in'

export type { AuthState, AuthCookie }

/**
 * Opens the system's default browser to the DeepSeek sign-in page.
 * Waits for the user to complete authentication manually.
 * Since we can't directly access the default browser's cookies via Playwright,
 * we use a hybrid approach:
 * 1. Open the default browser for user to log in
 * 2. Wait for user confirmation that login is complete
 * 3. Launch a temporary browser instance pointing to the same domain to capture cookies
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
  // Step 1: Open the system's default browser for user to log in
  console.log('DeepFree: Opening your default browser for authentication...')
  console.log('Please complete the login process at https://chat.deepseek.com/sign_in')
  console.log('After successful login, press Enter here to continue...')
  
  openInDefaultBrowser(DEEPSEEK_SIGN_IN)
  
  // Wait for user to confirm they've logged in
  await waitForUserConfirmation()
  
  // Step 2: Now launch a temporary browser to capture the auth state
  // We need to find what browser is available and use it
  const browserInfo = await detectBrowser()
  if (!browserInfo) {
    throw new Error('No supported browser found. Please install Chrome, Edge, Brave, Chromium, or Firefox.')
  }

  // Create a temporary directory for the browser user data
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepfree-browser-'))

  let context: import('playwright').BrowserContext;
  let browser: import('playwright').Browser;
  try {
    if (browserInfo.family === 'chromium') {
      const { chromium } = await import('playwright')
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
      const { firefox } = await import('playwright')
      // Firefox options for similar purpose
      context = await firefox.launchPersistentContext(userDataDir, {
        executablePath: browserInfo.executablePath,
        headless: false,
      });
    } else {
      throw new Error('Unsupported browser family: ' + browserInfo.family)
    }

    browser = context.browser() as import('playwright').Browser;

    const page = await context.newPage();

    // Navigate to DeepSeek - if user logged in with default browser,
    // they may need to log in again here since this is a fresh profile
    // OR we guide them to copy cookies (more complex)
    // For now, we'll have them log in through this browser too if needed
    
    console.log('DeepFree: Please ensure you are logged in at chat.deepseek.com')
    console.log('If you logged in via your default browser, please log in again in this browser window.')
    
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

/**
 * Opens a URL in the system's default browser using OS-specific commands.
 * This respects the user's actual default browser choice.
 */
function openInDefaultBrowser(url: string): void {
  const platform = process.platform
  
  try {
    if (platform === 'darwin') {
      // macOS
      execSync(`open "${url}"`, { stdio: 'ignore' as any })
    } else if (platform === 'win32') {
      // Windows - use cmd.exe with start command
      execSync(`cmd /c start "" "${url}"`, { stdio: 'ignore' as any, shell: true as any })
    } else {
      // Linux and other Unix-like systems
      // Try xdg-open first (most common on Linux)
      try {
        execSync(`xdg-open "${url}"`, { stdio: 'ignore' as any })
      } catch {
        // Fallback to other common Linux browser openers
        try {
          execSync(`gio open "${url}"`, { stdio: 'ignore' as any })
        } catch {
          // Last resort: try gnome-open
          execSync(`gnome-open "${url}"`, { stdio: 'ignore' as any })
        }
      }
    }
  } catch (error) {
    console.error('Warning: Could not open default browser automatically.')
    console.error(`Please open this URL manually: ${url}`)
  }
}

/**
 * Waits for the user to press Enter, confirming they've completed login.
 */
async function waitForUserConfirmation(): Promise<void> {
  return new Promise<void>((resolve) => {
    import('readline').then((readline) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      
      rl.question('', () => {
        rl.close()
        resolve()
      })
    })
  })
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
  console.log('DeepFree: Waiting for you to complete login...')
  console.log('Please enter your email and password, then complete any verification steps.')
  
  return new Promise((resolve) => {
    let lastUrl = ''
    let lastTitle = ''
    let stableCount = 0
    
    const check = async () => {
      try {
        const url = page.url()
        const title = await page.title()
        
        // Detect if URL/title changed significantly (user is interacting)
        const urlChanged = url !== lastUrl
        const titleChanged = title !== lastTitle
        
        if (urlChanged || titleChanged) {
          stableCount = 0
          lastUrl = url
          lastTitle = title
        } else {
          stableCount++
        }
        
        // Check if we're still on a sign-in related page
        const isOnSignInPage = url.includes('/sign_in') || 
                               url.includes('/login') ||
                               title.toLowerCase().includes('sign in') || 
                               title.toLowerCase().includes('log in') ||
                               title.toLowerCase().includes('login')
        
        // Look for password input field - if present, user hasn't completed login yet
        const hasPasswordField = await page.$('input[type="password"]') !== null
        
        // Look for email input field - if present, user hasn't even entered email yet
        const hasEmailField = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]') !== null
        
        // Look for submit/login buttons that might indicate incomplete login
        const hasSubmitButton = await page.$('button[type="submit"], input[type="submit"], button[class*="submit" i], button[class*="login" i], button[class*="signin" i]') !== null
        
        // Check for actual chat interface indicators (logged in state)
        const hasChatInterface = await page.$('[data-testid="chat"], .chat-container, .message-input, button[data-testid*="send"], textarea[placeholder*="message" i], div[contenteditable="true"]') !== null
        
        // Check for user profile/avatar which typically appears when logged in
        const hasUserProfile = await page.$('[data-testid="user"], .user-avatar, .profile-menu, [class*="avatar" i], [class*="profile" i], [class*="account" i]') !== null
        
        // Check for navigation elements that appear when logged in
        const hasLoggedInNav = await page.$('nav[class*="sidebar" i], aside[class*="nav" i], header[class*="dashboard" i]') !== null

        // User is likely logged in if:
        // 1. We're not on a sign-in/login page AND
        // 2. No password field is visible (past the password step) AND
        // 3. Either chat interface OR user profile OR logged-in nav is present
        const isLoggedIn = !isOnSignInPage && 
                          !hasPasswordField && 
                          !hasEmailField &&
                          (hasChatInterface || hasUserProfile || hasLoggedInNav)

        if (isLoggedIn) {
          // Double-check: wait a moment to ensure page is stable
          setTimeout(async () => {
            const finalUrl = page.url()
            const finalTitle = await page.title()
            const stillNotSignIn = !finalUrl.includes('/sign_in') && !finalUrl.includes('/login')
            if (stillNotSignIn) {
              console.log('DeepFree: Login detected!')
              resolve()
            } else {
              check()
            }
          }, 1500)
          return
        }
        
        // Alternative detection: page title suggests logged-in state
        if (!isOnSignInPage && 
            !hasPasswordField && 
            !hasEmailField &&
            title.length > 0 && 
            (title.toLowerCase().includes('chat') || title.toLowerCase().includes('deepseek') || title.toLowerCase().includes('assistant'))) {
          // Wait a bit more to ensure page is fully loaded and stable
          setTimeout(check, 2000)
          return
        }

        // If page has been stable for a while and still on sign-in, remind user
        if (stableCount > 6 && isOnSignInPage) {
          // Only show reminder every 12 checks to avoid spam
          if (stableCount % 12 === 6) {
            console.log('DeepFree: Still waiting for login completion...')
            console.log('  Current page:', url.substring(0, 80))
          }
        }

        setTimeout(check, 500)
      } catch (err) {
        // Page might be reloading, continue checking
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