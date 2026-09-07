"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
describe('DeepSeek Client Types', () => {
    it('should define DeepSeekResponse interface', () => {
        // Just test that the type exists and can be used
        const response = {
            success: true,
            data: 'test data',
        };
        expect(response.success).toBe(true);
        expect(response.data).toBe('test data');
    });
    it('should define AuthState interface', () => {
        const authState = {
            authorizationToken: 'test-token',
            cookies: [],
            capturedAt: Date.now(),
            verificationStatus: 'unverified',
        };
        expect(authState).toBeDefined();
        expect(authState.authorizationToken).toBe('test-token');
    });
});
//# sourceMappingURL=client.test.js.map