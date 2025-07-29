// JWT Service Unit Tests

import { JWTService } from '../../src/services/jwt.service';
import { UserRole, SubscriptionLevel } from '../../src/types/auth';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    exists: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  return jest.fn(() => mockRedis);
});

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-session-id-12345'),
}));

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Set environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    jwtService = new JWTService();
    mockRedis = (jwtService as any).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokenPair', () => {
    it('should generate valid access and refresh tokens', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const role = UserRole.USER;
      const subscriptionLevel = SubscriptionLevel.FREE;

      const tokenPair = await jwtService.generateTokenPair(userId, email, role, subscriptionLevel);

      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');

      // Verify tokens can be decoded
      const accessPayload = jwt.decode(tokenPair.accessToken) as any;
      const refreshPayload = jwt.decode(tokenPair.refreshToken) as any;

      expect(accessPayload.userId).toBe(userId);
      expect(accessPayload.email).toBe(email);
      expect(accessPayload.role).toBe(role);
      expect(accessPayload.subscriptionLevel).toBe(subscriptionLevel);
      expect(refreshPayload.userId).toBe(userId);
    });

    it('should store refresh token data in Redis', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const deviceInfo = 'Chrome/Windows';

      await jwtService.generateTokenPair(userId, email, UserRole.USER, SubscriptionLevel.FREE, deviceInfo);

      // Verify Redis calls
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'refresh_token:mock-session-id-12345',
        7 * 24 * 60 * 60,
        expect.stringContaining(userId)
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:mock-session-id-12345',
        7 * 24 * 60 * 60,
        expect.stringContaining(userId)
      );
    });

    it('should use default values for optional parameters', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const tokenPair = await jwtService.generateTokenPair(userId, email);

      const accessPayload = jwt.decode(tokenPair.accessToken) as any;
      expect(accessPayload.role).toBe(UserRole.USER);
      expect(accessPayload.subscriptionLevel).toBe(SubscriptionLevel.FREE);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const sessionId = 'mock-session-id-12345';

      // Mock session exists in Redis
      mockRedis.exists.mockResolvedValue(1);

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      const payload = await jwtService.verifyAccessToken(tokenPair.accessToken);

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(userId);
      expect(payload?.email).toBe(email);
      expect(payload?.sessionId).toBe(sessionId);
    });

    it('should return null for invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';
      const payload = await jwtService.verifyAccessToken(invalidToken);

      expect(payload).toBeNull();
    });

    it('should return null if session does not exist', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      // Mock session does not exist in Redis
      mockRedis.exists.mockResolvedValue(0);

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      const payload = await jwtService.verifyAccessToken(tokenPair.accessToken);

      expect(payload).toBeNull();
    });

    it('should update session access time on successful verification', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      mockRedis.exists.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId,
        sessionId: 'mock-session-id-12345',
        createdAt: new Date(),
        lastAccessAt: new Date(),
        isActive: true,
      }));

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      await jwtService.verifyAccessToken(tokenPair.accessToken);

      // Verify session access was updated
      expect(mockRedis.get).toHaveBeenCalledWith('session:mock-session-id-12345');
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const sessionId = 'mock-session-id-12345';

      const refreshTokenData = {
        userId,
        sessionId,
        deviceInfo: 'unknown',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(refreshTokenData));

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      const tokenData = await jwtService.verifyRefreshToken(tokenPair.refreshToken);

      expect(tokenData).not.toBeNull();
      expect(tokenData?.userId).toBe(userId);
      expect(tokenData?.sessionId).toBe(sessionId);
    });

    it('should return null for invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';
      const tokenData = await jwtService.verifyRefreshToken(invalidToken);

      expect(tokenData).toBeNull();
    });

    it('should return null if token data not found in Redis', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      mockRedis.get.mockResolvedValue(null);

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      const tokenData = await jwtService.verifyRefreshToken(tokenPair.refreshToken);

      expect(tokenData).toBeNull();
    });

    it('should return null and invalidate session if token is expired', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const sessionId = 'mock-session-id-12345';

      const expiredTokenData = {
        userId,
        sessionId,
        deviceInfo: 'unknown',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredTokenData));

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      const tokenData = await jwtService.verifyRefreshToken(tokenPair.refreshToken);

      expect(tokenData).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh_token:${sessionId}`);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new token pair with valid refresh token', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const sessionId = 'mock-session-id-12345';

      const refreshTokenData = {
        userId,
        sessionId,
        deviceInfo: 'Chrome/Windows',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(refreshTokenData));

      const originalTokenPair = await jwtService.generateTokenPair(userId, email);
      const newTokenPair = await jwtService.refreshAccessToken(originalTokenPair.refreshToken);

      expect(newTokenPair).not.toBeNull();
      expect(newTokenPair).toHaveProperty('accessToken');
      expect(newTokenPair).toHaveProperty('refreshToken');

      // Verify old refresh token was deleted
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh_token:${sessionId}`);
    });

    it('should return null for invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';
      const newTokenPair = await jwtService.refreshAccessToken(invalidToken);

      expect(newTokenPair).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should delete session and refresh token from Redis', async () => {
      const sessionId = 'test-session-id';

      await jwtService.invalidateSession(sessionId);

      expect(mockRedis.del).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh_token:${sessionId}`);
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should invalidate all sessions for a user', async () => {
      const userId = 'user-123';
      const sessionKeys = ['session:session1', 'session:session2'];
      const sessionData1 = JSON.stringify({ userId, sessionId: 'session1' });
      const sessionData2 = JSON.stringify({ userId, sessionId: 'session2' });

      mockRedis.keys.mockResolvedValue(sessionKeys);
      mockRedis.get
        .mockResolvedValueOnce(sessionData1)
        .mockResolvedValueOnce(sessionData2);

      await jwtService.invalidateAllUserSessions(userId);

      expect(mockRedis.del).toHaveBeenCalledWith('session:session1', 'session:session2');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh_token:session1', 'refresh_token:session2');
    });

    it('should handle case with no sessions to delete', async () => {
      const userId = 'user-123';

      mockRedis.keys.mockResolvedValue([]);

      await jwtService.invalidateAllUserSessions(userId);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions for a user', async () => {
      const userId = 'user-123';
      const sessionKeys = ['session:session1', 'session:session2'];
      const activeSession = {
        userId,
        sessionId: 'session1',
        createdAt: new Date(),
        lastAccessAt: new Date(),
        isActive: true,
      };
      const inactiveSession = {
        userId,
        sessionId: 'session2',
        createdAt: new Date(),
        lastAccessAt: new Date(),
        isActive: false,
      };

      mockRedis.keys.mockResolvedValue(sessionKeys);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(activeSession))
        .mockResolvedValueOnce(JSON.stringify(inactiveSession));

      const sessions = await jwtService.getUserSessions(userId);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        sessionId: 'session1',
        createdAt: expect.any(String),
        lastAccessAt: expect.any(String),
      });
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const authHeader = 'Bearer test-token-123';
      const token = jwtService.extractTokenFromHeader(authHeader);

      expect(token).toBe('test-token-123');
    });

    it('should return null for invalid header format', () => {
      const invalidHeader = 'Invalid test-token-123';
      const token = jwtService.extractTokenFromHeader(invalidHeader);

      expect(token).toBeNull();
    });

    it('should return null for undefined header', () => {
      const token = jwtService.extractTokenFromHeader(undefined);

      expect(token).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should close Redis connection', async () => {
      await jwtService.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('token validation', () => {
    it('should validate tokens with correct issuer and audience', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const tokenPair = await jwtService.generateTokenPair(userId, email);

      // Decode and verify token structure
      const accessPayload = jwt.decode(tokenPair.accessToken) as any;
      const refreshPayload = jwt.decode(tokenPair.refreshToken) as any;

      expect(accessPayload.iss).toBe('inergize-auth');
      expect(accessPayload.aud).toBe('inergize-api');
      expect(refreshPayload.iss).toBe('inergize-auth');
      expect(refreshPayload.aud).toBe('inergize-refresh');
    });

    it('should handle token verification with wrong secret', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const tokenPair = await jwtService.generateTokenPair(userId, email);

      // Change the secret temporarily to simulate wrong secret
      (jwtService as any).accessTokenSecret = 'wrong-secret';

      const payload = await jwtService.verifyAccessToken(tokenPair.accessToken);

      expect(payload).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      const userId = 'user-123';
      const email = 'test@example.com';

      await expect(jwtService.generateTokenPair(userId, email))
        .rejects.toThrow('Redis connection failed');
    });

    it('should handle malformed JSON in Redis', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      mockRedis.get.mockResolvedValue('invalid-json');

      const tokenPair = await jwtService.generateTokenPair(userId, email);
      const tokenData = await jwtService.verifyRefreshToken(tokenPair.refreshToken);

      expect(tokenData).toBeNull();
    });
  });
});