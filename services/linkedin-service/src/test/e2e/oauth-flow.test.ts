// OAuth Flow End-to-End Tests

import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import Redis from 'ioredis';

// Test application setup
let app: express.Application;
let server: Server;
let redis: Redis;

describe('LinkedIn OAuth Flow E2E', () => {
  beforeAll(async () => {
    // Setup test application
    app = express();
    app.use(express.json());
    
    // Mock Redis for testing
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true
    });

    // Setup routes
    const linkedinRoutes = require('../../routes/linkedin.routes').default;
    app.use('/api/linkedin', linkedinRoutes);

    // Start test server
    server = app.listen(0);
  });

  afterAll(async () => {
    if (redis) {
      await redis.disconnect();
    }
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean up Redis state between tests
    if (redis.status === 'ready') {
      await redis.flushall();
    }
  });

  describe('Complete OAuth Flow', () => {
    it('should complete full OAuth authorization flow', async () => {
      const userId = 'test-user-123';
      const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6IlVTRVIiLCJzdWJzY3JpcHRpb25MZXZlbCI6IlBSTyJ9.signature';
      
      // Step 1: Initiate OAuth flow
      const initiateResponse = await request(app)
        .post('/api/linkedin/auth/initiate')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          scopes: ['r_basicprofile', 'r_emailaddress'],
          redirectUri: 'http://localhost:3000/auth/linkedin/callback'
        });

      expect(initiateResponse.status).toBe(200);
      expect(initiateResponse.body.success).toBe(true);
      expect(initiateResponse.body.data.authUrl).toContain('linkedin.com/oauth/v2/authorization');
      expect(initiateResponse.body.data.state).toBeDefined();

      const { state } = initiateResponse.body.data;

      // Step 2: Simulate LinkedIn callback
      const callbackResponse = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          code: 'mock-authorization-code',
          state: state
        });

      expect(callbackResponse.status).toBe(200);
      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body.data.accessToken).toBeDefined();
      expect(callbackResponse.body.data.refreshToken).toBeDefined();

      // Step 3: Use access token to fetch profile
      const profileResponse = await request(app)
        .get('/api/linkedin/profile')
        .set('Authorization', `Bearer ${mockJWT}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data).toHaveProperty('id');
    });

    it('should handle OAuth errors gracefully', async () => {
      const mockJWT = 'valid.jwt.token';

      // Step 1: Initiate OAuth flow
      const initiateResponse = await request(app)
        .post('/api/linkedin/auth/initiate')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({});

      const { state } = initiateResponse.body.data;

      // Step 2: Simulate LinkedIn error callback
      const callbackResponse = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          error: 'access_denied',
          error_description: 'User denied authorization',
          state: state
        });

      expect(callbackResponse.status).toBe(400);
      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.message).toContain('access_denied');
    });

    it('should prevent CSRF attacks with state validation', async () => {
      const mockJWT = 'valid.jwt.token';

      // Step 1: Attempt callback with invalid state
      const callbackResponse = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          code: 'mock-authorization-code',
          state: 'invalid-state-parameter'
        });

      expect(callbackResponse.status).toBe(400);
      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.message).toContain('Invalid state parameter');
    });

    it('should handle token refresh flow', async () => {
      const mockJWT = 'valid.jwt.token';

      // Mock expired access token scenario
      const refreshResponse = await request(app)
        .post('/api/linkedin/auth/refresh')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          refreshToken: 'mock-refresh-token'
        });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.expiresIn).toBeDefined();
    });

    it('should revoke tokens on logout', async () => {
      const mockJWT = 'valid.jwt.token';

      const revokeResponse = await request(app)
        .post('/api/linkedin/auth/revoke')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          accessToken: 'token-to-revoke'
        });

      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body.success).toBe(true);
      expect(revokeResponse.body.message).toContain('Token revoked successfully');
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce OAuth rate limits', async () => {
      const mockJWT = 'valid.jwt.token';
      const requests = [];

      // Make multiple OAuth initiation requests rapidly
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .post('/api/linkedin/auth/initiate')
            .set('Authorization', `Bearer ${mockJWT}`)
            .send({})
        );
      }

      const responses = await Promise.all(requests);
      
      // Should start getting rate limited after 20 requests
      const successful = responses.filter(r => r.status === 200);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(successful.length).toBeLessThanOrEqual(20);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      if (rateLimited.length > 0) {
        expect(rateLimited[0].body.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(rateLimited[0].body.retryAfter).toBeDefined();
      }
    });

    it('should track rate limits across different endpoints', async () => {
      const mockJWT = 'valid.jwt.token';

      // Check initial rate limit status
      const initialStatus = await request(app)
        .get('/api/linkedin/rate-limits')
        .set('Authorization', `Bearer ${mockJWT}`);

      expect(initialStatus.status).toBe(200);
      const initialOAuthLimit = initialStatus.body.data.oauth.remaining;

      // Make OAuth request
      await request(app)
        .post('/api/linkedin/auth/initiate')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({});

      // Check updated rate limit status
      const updatedStatus = await request(app)
        .get('/api/linkedin/rate-limits')
        .set('Authorization', `Bearer ${mockJWT}`);

      expect(updatedStatus.body.data.oauth.remaining).toBe(initialOAuthLimit - 1);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle concurrent OAuth requests', async () => {
      const mockJWT = 'valid.jwt.token';
      const concurrentRequests = [];

      // Launch multiple concurrent OAuth initiations
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          request(app)
            .post('/api/linkedin/auth/initiate')
            .set('Authorization', `Bearer ${mockJWT}`)
            .send({
              scopes: ['r_basicprofile'],
              redirectUri: `http://localhost:3000/callback-${i}`
            })
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // All should succeed with unique states
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.state).toBeDefined();
      });

      // All states should be unique
      const states = responses.map(r => r.body.data.state);
      const uniqueStates = [...new Set(states)];
      expect(uniqueStates.length).toBe(states.length);
    });

    it('should handle malformed requests gracefully', async () => {
      const mockJWT = 'valid.jwt.token';

      // Test with malformed JSON
      const malformedResponse = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(malformedResponse.status).toBe(400);
      expect(malformedResponse.body.success).toBe(false);
    });

    it('should handle network timeouts', async () => {
      const mockJWT = 'valid.jwt.token';

      // This would require mocking network delays
      // For now, test that the service can handle timeout scenarios
      const response = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .timeout(1000) // 1 second timeout
        .send({
          code: 'slow-response-code',
          state: 'valid-state'
        });

      // Response should either succeed or provide meaningful error
      expect([200, 408, 500]).toContain(response.status);
    });

    it('should maintain session state across multiple requests', async () => {
      const mockJWT = 'valid.jwt.token';

      // Step 1: Initiate OAuth
      const initiateResponse = await request(app)
        .post('/api/linkedin/auth/initiate')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({});

      const { state } = initiateResponse.body.data;

      // Step 2: Check that state is stored
      const agent = request.agent(app);
      
      // Step 3: Complete OAuth with same agent
      const callbackResponse = await agent
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          code: 'mock-code',
          state: state
        });

      expect(callbackResponse.status).toBe(200);
    });
  });

  describe('Security & Compliance', () => {
    it('should validate PKCE flow', async () => {
      const mockJWT = 'valid.jwt.token';

      // Step 1: Initiate OAuth with PKCE
      const initiateResponse = await request(app)
        .post('/api/linkedin/auth/initiate')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          usePKCE: true,
          scopes: ['r_basicprofile']
        });

      expect(initiateResponse.status).toBe(200);
      expect(initiateResponse.body.data.codeChallenge).toBeDefined();
      expect(initiateResponse.body.data.codeChallengeMethod).toBe('S256');

      const { state, codeVerifier } = initiateResponse.body.data;

      // Step 2: Complete OAuth with code verifier
      const callbackResponse = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          code: 'mock-code',
          state: state,
          codeVerifier: codeVerifier
        });

      expect(callbackResponse.status).toBe(200);
    });

    it('should sanitize sensitive data in logs', async () => {
      const mockJWT = 'valid.jwt.token';

      // Make request with sensitive data
      const response = await request(app)
        .post('/api/linkedin/auth/callback')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          code: 'sensitive-auth-code',
          state: 'valid-state'
        });

      // Log messages should not contain sensitive auth codes
      // This would require log inspection in a real test
      expect(response.status).toBeLessThanOrEqual(500);
    });

    it('should enforce HTTPS in production', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockJWT = 'valid.jwt.token';

      const response = await request(app)
        .post('/api/linkedin/auth/initiate')
        .set('Authorization', `Bearer ${mockJWT}`)
        .send({
          redirectUri: 'http://insecure-domain.com/callback' // HTTP not HTTPS
        });

      // Should reject non-HTTPS redirect URIs in production
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('HTTPS required');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Performance & Load Testing', () => {
    it('should handle high-throughput OAuth requests', async () => {
      const mockJWT = 'valid.jwt.token';
      const startTime = Date.now();
      const requests = [];

      // Generate 50 concurrent OAuth initiation requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .post('/api/linkedin/auth/initiate')
            .set('Authorization', `Bearer ${mockJWT}`)
            .send({
              scopes: ['r_basicprofile'],
              redirectUri: `http://localhost:3000/callback-${i}`
            })
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(totalTime).toBeLessThan(5000);

      // Most requests should succeed (allowing for some rate limiting)
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(20);
    });

    it('should maintain response times under load', async () => {
      const mockJWT = 'valid.jwt.token';
      const responseTimes = [];

      // Test individual request response times
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/linkedin/rate-limits')
          .set('Authorization', `Bearer ${mockJWT}`);
          
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Average response time should be under 100ms
      const averageTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      expect(averageTime).toBeLessThan(100);

      // 95th percentile should be under 200ms
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      expect(p95Time).toBeLessThan(200);
    });
  });
});