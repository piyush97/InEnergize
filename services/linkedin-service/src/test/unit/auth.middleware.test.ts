// Auth Middleware Unit Tests

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';

// Mock dependencies
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    authMiddleware = new AuthMiddleware();
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should validate valid JWT token', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        subscriptionLevel: 'PRO',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      mockedJwt.verify.mockReturnValue(mockPayload as any);

      await authMiddleware.validateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        subscriptionLevel: 'PRO'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authMiddleware.validateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization header is required',
        code: 'MISSING_AUTHORIZATION_HEADER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      await authMiddleware.validateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid authorization header format. Use: Bearer <token>',
        code: 'INVALID_AUTHORIZATION_FORMAT'
      });
    });

    it('should reject expired JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token'
      };
      mockedJwt.verify.mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authMiddleware.validateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'JWT token has expired',
        code: 'TOKEN_EXPIRED'
      });
    });

    it('should reject invalid JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };
      mockedJwt.verify.mockImplementation(() => {
        const error = new Error('invalid signature');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await authMiddleware.validateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid JWT token',
        code: 'INVALID_TOKEN'
      });
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        subscriptionLevel: 'BASIC'
      };
    });

    it('should allow user with required role', () => {
      const middleware = authMiddleware.requireRole(['USER', 'ADMIN']);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      const middleware = authMiddleware.requireRole(['ADMIN']);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions for this operation',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: ['ADMIN'],
        userRole: 'USER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated user', () => {
      mockRequest.user = undefined;
      const middleware = authMiddleware.requireRole(['USER']);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    });
  });

  describe('requireSubscription', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        subscriptionLevel: 'BASIC'
      };
    });

    it('should allow user with sufficient subscription level', () => {
      const middleware = authMiddleware.requireSubscription('BASIC');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow user with higher subscription level', () => {
      mockRequest.user!.subscriptionLevel = 'PRO';
      const middleware = authMiddleware.requireSubscription('BASIC');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject user with insufficient subscription level', () => {
      const middleware = authMiddleware.requireSubscription('PRO');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'This feature requires PRO subscription or higher',
        code: 'SUBSCRIPTION_UPGRADE_REQUIRED',
        currentLevel: 'BASIC',
        requiredLevel: 'PRO'
      });
    });

    it('should handle user without subscription level (default to FREE)', () => {
      mockRequest.user!.subscriptionLevel = undefined;
      const middleware = authMiddleware.requireSubscription('BASIC');

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          currentLevel: 'FREE',
          requiredLevel: 'BASIC'
        })
      );
    });
  });

  describe('extractUserFromToken', () => {
    it('should extract user info from valid token', () => {
      const mockPayload = {
        userId: 'user-456',
        email: 'user@example.com',
        role: 'ADMIN',
        subscriptionLevel: 'ENTERPRISE'
      };
      mockedJwt.verify.mockReturnValue(mockPayload as any);

      const user = authMiddleware.extractUserFromToken('Bearer valid-token');

      expect(user).toEqual({
        id: 'user-456',
        email: 'user@example.com',
        role: 'ADMIN',
        subscriptionLevel: 'ENTERPRISE'
      });
    });

    it('should return null for invalid token', () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const user = authMiddleware.extractUserFromToken('Bearer invalid-token');

      expect(user).toBeNull();
    });

    it('should return null for malformed authorization header', () => {
      const user = authMiddleware.extractUserFromToken('InvalidFormat');

      expect(user).toBeNull();
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const user = {
        id: 'user-789',
        email: 'new@example.com',
        role: 'USER',
        subscriptionLevel: 'PRO'
      };

      mockedJwt.sign.mockReturnValue('generated-token');

      const token = authMiddleware.generateToken(user);

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        {
          userId: 'user-789',
          email: 'new@example.com',
          role: 'USER',
          subscriptionLevel: 'PRO'
        },
        expect.any(String),
        { expiresIn: '24h' }
      );
      expect(token).toBe('generated-token');
    });
  });
});