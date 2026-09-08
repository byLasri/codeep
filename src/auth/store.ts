import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { AuthState } from './state'

const APP_NAME = 'DeepFree'

function getAppDataDir(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) return localAppData
  }
  if (process.platform === 'darwin') {
    const home = process.env.HOME
    if (home) return path.join(home, 'Library', 'Application Support')
  }
  const xdgDataHome = process.env.XDG_DATA_HOME
  if (xdgDataHome) return xdgDataHome
  const home = process.env.HOME
  if (home) return path.join(home, 'local', 'share')
  return path.join(os.tmpdir(), 'deepfree')
}

function getStatePath(): string {
  const base = getAppDataDir()
  const dir = path.join(base, APP_NAME)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'auth.json')
}

export function loadAuthState(): AuthState | null {
  const statePath = getStatePath()
  if (!fs.existsSync(statePath)) return null
  try {
    const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    return {
      authorizationToken: data.authorizationToken,
      cookies: data.cookies || [],
      capturedAt: data.capturedAt || Date.now(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      verificationStatus: data.verificationStatus || 'unverified',
    }
  } catch {
    return null
  }
}

export function saveAuthState(state: AuthState): void {
  const statePath = getStatePath()
  const data = {
    authorizationToken: state.authorizationToken,
    cookies: state.cookies,
    capturedAt: state.capturedAt,
    expiresAt: state.expiresAt ? state.expiresAt.toISOString() : undefined,
    verificationStatus: state.verificationStatus,
  }
  fs.writeFileSync(statePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function deleteAuthState(): void {
  const statePath = getStatePath()
  try {
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath)
  } catch {
    // ignore
  }
}

export function authStateExists(): boolean {
  return loadAuthState() !== null
}