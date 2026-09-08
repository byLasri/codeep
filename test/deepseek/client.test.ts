import { AuthState } from '../../src/auth/state';
import { DeepSeekResponse } from '../../src/deepseek/client';

describe('DeepSeek Client Types', () => {
  it('should define DeepSeekResponse interface', () => {
    // Just test that the type exists and can be used
    const response: DeepSeekResponse<string> = {
      success: true,
      data: 'test data',
    };
    
    expect(response.success).toBe(true);
    expect(response.data).toBe('test data');
  });

  it('should define AuthState interface', () => {
    const authState: AuthState = {
      authorizationToken: 'test-token',
      cookies: [],
      capturedAt: Date.now(),
      verificationStatus: 'unverified',
    };
    
    expect(authState).toBeDefined();
    expect(authState.authorizationToken).toBe('test-token');
  });
});