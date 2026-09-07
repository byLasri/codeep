export interface AuthCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: Date
}

export interface AuthState {
  authorizationToken?: string
  cookies: AuthCookie[]
  capturedAt: number
  expiresAt?: Date
  verificationStatus: 'unverified' | 'verified' | 'failed'
}