import { AuthState, AuthCookie } from '../../src/auth/state'

describe('AuthState', () => {
  it('should create a valid AuthState', () => {
    const authState: AuthState = {
      authorizationToken: 'test-token',
      cookies: [
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: '.deepseek.com',
          path: '/',
          expires: new Date(Date.now() + 3600000),
        },
      ],
      capturedAt: Date.now(),
      expiresAt: new Date(Date.now() + 7200000),
      verificationStatus: 'verified',
    }

    expect(authState.authorizationToken).toBe('test-token')
    expect(authState.cookies.length).toBe(1)
    expect(authState.cookies[0].name).toBe('test-cookie')
    expect(authState.verificationStatus).toBe('verified')
  })

  it('should create an AuthState with undefined token', () => {
    const authState: AuthState = {
      authorizationToken: undefined,
      cookies: [],
      capturedAt: Date.now(),
      verificationStatus: 'unverified',
    }

    expect(authState.authorizationToken).toBeUndefined()
    expect(authState.cookies).toEqual([])
    expect(authState.verificationStatus).toBe('unverified')
  })
})

describe('AuthCookie', () => {
  it('should create a valid AuthCookie', () => {
    const cookie: AuthCookie = {
      name: 'sessionid',
      value: 'abc123',
      domain: '.deepseek.com',
      path: '/',
    }

    expect(cookie.name).toBe('sessionid')
    expect(cookie.value).toBe('abc123')
    expect(cookie.domain).toBe('.deepseek.com')
    expect(cookie.path).toBe('/')
  })
})