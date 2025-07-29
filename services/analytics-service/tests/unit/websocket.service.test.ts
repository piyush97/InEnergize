// WebSocket Service Unit Tests

import { WebSocketService } from '../../src/services/websocket.service';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

// Mock dependencies are already mocked in jest.setup.ts

describe('WebSocketService', () => {
  let wsService: WebSocketService;
  let mockServer: jest.Mocked<Server>;
  let mockWSS: jest.Mocked<WebSocketServer>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockServer = {
      listen: jest.fn((port, callback) => callback && callback()),
      close: jest.fn((callback) => callback && callback()),
      on: jest.fn()
    } as any;

    wsService = new WebSocketService(mockServer);
    mockWSS = (wsService as any).wss;
    mockRedis = (wsService as any).redis;

    // Mock JWT verification
    (jwt.verify as jest.Mock).mockImplementation((token, secret) => {
      if (token === 'valid-token') {
        return {
          userId: 'user-123',
          email: 'test@example.com',
          subscriptionLevel: 'PREMIUM'
        };
      }
      throw new Error('Invalid token');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize WebSocket server correctly', () => {
      expect(mockWSS.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWSS.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle server initialization errors', () => {
      const errorSpy = jest.fn();
      wsService.on('error', errorSpy);

      // Simulate WebSocket server error
      const errorHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'error')[1];
      
      const error = new Error('Server initialization failed');
      errorHandler(error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('client connection handling', () => {
    let mockClient: jest.Mocked<WebSocket>;

    beforeEach(() => {
      mockClient = {
        send: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn()
      } as any;
    });

    it('should handle new client connections', () => {
      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token&subscriptions=profile_metrics,automation_status',
        headers: {
          'user-agent': 'Test Client'
        }
      };

      connectionHandler(mockClient, mockRequest);

      expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    it('should reject connections without valid token', () => {
      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=invalid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      expect(mockClient.close).toHaveBeenCalledWith(1008, 'Authentication failed');
    });

    it('should reject connections without token', () => {
      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      expect(mockClient.close).toHaveBeenCalledWith(1008, 'Authentication required');
    });

    it('should handle client disconnection gracefully', () => {
      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      // Simulate client disconnection
      const closeHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'close')[1];

      closeHandler(1000, 'Normal closure');

      // Should cleanup client resources
      expect(mockClient.removeAllListeners).toHaveBeenCalled();
    });

    it('should handle client errors', () => {
      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      // Simulate client error
      const errorHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'error')[1];

      const error = new Error('Client connection error');
      errorHandler(error);

      expect(mockClient.terminate).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    let mockClient: jest.Mocked<WebSocket>;

    beforeEach(() => {
      mockClient = {
        send: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn()
      } as any;

      // Setup client connection
      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);
    });

    it('should handle subscription messages', () => {
      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        channels: ['profile_metrics', 'automation_status']
      });

      messageHandler(Buffer.from(subscribeMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscription_confirmed',
          channels: ['profile_metrics', 'automation_status']
        })
      );
    });

    it('should handle unsubscription messages', () => {
      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const unsubscribeMessage = JSON.stringify({
        type: 'unsubscribe',
        channels: ['profile_metrics']
      });

      messageHandler(Buffer.from(unsubscribeMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'unsubscription_confirmed',
          channels: ['profile_metrics']
        })
      );
    });

    it('should handle ping messages', () => {
      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const pingMessage = JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      });

      messageHandler(Buffer.from(pingMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should reject invalid JSON messages', () => {
      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      messageHandler(Buffer.from('invalid json'));

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        })
      );
    });

    it('should handle unknown message types', () => {
      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const unknownMessage = JSON.stringify({
        type: 'unknown_type',
        data: 'test'
      });

      messageHandler(Buffer.from(unknownMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'error',
          message: 'Unknown message type: unknown_type'
        })
      );
    });

    it('should enforce subscription limits based on tier', () => {
      // Mock FREE tier user
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user-456',
        subscriptionLevel: 'FREE'
      });

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      const freeClient = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      } as any;

      connectionHandler(freeClient, mockRequest);

      const messageHandler = (freeClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        channels: ['profile_metrics', 'automation_status', 'analytics', 'predictions'] // Too many for free tier
      });

      messageHandler(Buffer.from(subscribeMessage));

      expect(freeClient.send).toHaveBeenCalledWith(
        expect.stringContaining('Subscription limit exceeded')
      );
    });
  });

  describe('broadcasting', () => {
    it('should broadcast to specific user', async () => {
      const mockClient1 = {
        send: jest.fn(),
        readyState: WebSocket.OPEN
      } as any;
      const mockClient2 = {
        send: jest.fn(),
        readyState: WebSocket.OPEN
      } as any;

      // Mock clients set
      mockWSS.clients = new Set([mockClient1, mockClient2]);

      // Mock client metadata
      (wsService as any).clientMetadata.set(mockClient1, {
        userId: 'user-123',
        subscriptions: ['profile_metrics']
      });
      (wsService as any).clientMetadata.set(mockClient2, {
        userId: 'user-456',
        subscriptions: ['profile_metrics']
      });

      const message = {
        type: 'profile_update',
        data: { views: 100, connections: 50 }
      };

      await wsService.broadcastToUser('user-123', 'profile_metrics', message);

      expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockClient2.send).not.toHaveBeenCalled();
    });

    it('should broadcast to all users in channel', async () => {
      const mockClient1 = {
        send: jest.fn(),
        readyState: WebSocket.OPEN
      } as any;
      const mockClient2 = {
        send: jest.fn(),
        readyState: WebSocket.OPEN
      } as any;

      mockWSS.clients = new Set([mockClient1, mockClient2]);

      (wsService as any).clientMetadata.set(mockClient1, {
        userId: 'user-123',
        subscriptions: ['system_alerts']
      });
      (wsService as any).clientMetadata.set(mockClient2, {
        userId: 'user-456',
        subscriptions: ['system_alerts']
      });

      const message = {
        type: 'system_maintenance',
        data: { message: 'Scheduled maintenance in 10 minutes' }
      };

      await wsService.broadcastToChannel('system_alerts', message);

      expect(mockClient1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockClient2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should handle closed connections during broadcast', async () => {
      const mockClient = {
        send: jest.fn(),
        readyState: WebSocket.CLOSED
      } as any;

      mockWSS.clients = new Set([mockClient]);

      (wsService as any).clientMetadata.set(mockClient, {
        userId: 'user-123',
        subscriptions: ['profile_metrics']
      });

      const message = { type: 'test', data: {} };

      await wsService.broadcastToUser('user-123', 'profile_metrics', message);

      expect(mockClient.send).not.toHaveBeenCalled();
    });

    it('should handle send errors during broadcast', async () => {
      const mockClient = {
        send: jest.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
        readyState: WebSocket.OPEN,
        terminate: jest.fn()
      } as any;

      mockWSS.clients = new Set([mockClient]);

      (wsService as any).clientMetadata.set(mockClient, {
        userId: 'user-123',
        subscriptions: ['profile_metrics']
      });

      const message = { type: 'test', data: {} };

      await wsService.broadcastToUser('user-123', 'profile_metrics', message);

      expect(mockClient.terminate).toHaveBeenCalled();
    });
  });

  describe('heartbeat and connection management', () => {
    it('should implement heartbeat mechanism', (done) => {
      const mockClient = {
        ping: jest.fn(),
        isAlive: true,
        readyState: WebSocket.OPEN,
        terminate: jest.fn(),
        on: jest.fn()
      } as any;

      mockWSS.clients = new Set([mockClient]);

      // Start heartbeat
      wsService.startHeartbeat();

      // Mock interval
      setTimeout(() => {
        expect(mockClient.ping).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should terminate inactive connections', (done) => {
      const mockClient = {
        ping: jest.fn(),
        isAlive: false,
        readyState: WebSocket.OPEN,
        terminate: jest.fn(),
        on: jest.fn()
      } as any;

      mockWSS.clients = new Set([mockClient]);

      wsService.startHeartbeat();

      setTimeout(() => {
        expect(mockClient.terminate).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle pong responses', () => {
      const mockClient = {
        isAlive: false,
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      // Simulate pong response
      const pongHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'pong')[1];

      pongHandler();

      expect(mockClient.isAlive).toBe(true);
    });
  });

  describe('rate limiting and security', () => {
    it('should enforce message rate limits', () => {
      const mockClient = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      // Send many messages rapidly
      for (let i = 0; i < 100; i++) {
        messageHandler(Buffer.from(JSON.stringify({ type: 'ping' })));
      }

      expect(mockClient.close).toHaveBeenCalledWith(
        1008,
        'Rate limit exceeded'
      );
    });

    it('should validate subscription permissions', () => {
      // Mock user with limited permissions
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user-123',
        subscriptionLevel: 'FREE',
        permissions: ['profile_metrics'] // Limited permissions
      });

      const mockClient = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        channels: ['admin_metrics'] // Unauthorized channel
      });

      messageHandler(Buffer.from(subscribeMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('Unauthorized subscription')
      );
    });

    it('should sanitize message content', () => {
      const maliciousContent = '<script>alert("xss")</script>';
      const sanitized = (wsService as any).sanitizeMessage(maliciousContent);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('Redis integration', () => {
    it('should store connection metadata in Redis', async () => {
      const mockClient = {
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'websocket:connections',
        expect.any(String),
        expect.stringContaining('user-123')
      );
    });

    it('should cleanup Redis data on disconnect', () => {
      const mockClient = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        removeAllListeners: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      // Simulate disconnect
      const closeHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'close')[1];

      closeHandler(1000, 'Normal closure');

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringMatching(/websocket:client:/)
      );
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.hset.mockRejectedValue(new Error('Redis connection failed'));

      const message = { type: 'test', data: {} };

      // Should not throw error
      await expect(
        wsService.broadcastToUser('user-123', 'profile_metrics', message)
      ).resolves.not.toThrow();
    });
  });

  describe('analytics and monitoring', () => {
    it('should track connection metrics', () => {
      const mockClient = {
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      expect(mockRedis.incr).toHaveBeenCalledWith('websocket:connections:total');
      expect(mockRedis.incr).toHaveBeenCalledWith('websocket:connections:active');
    });

    it('should track message metrics', () => {
      const mockClient = {
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      const messageHandler = (mockClient.on as jest.Mock).mock.calls
        .find(call => call[0] === 'message')[1];

      const message = JSON.stringify({ type: 'ping' });
      messageHandler(Buffer.from(message));

      expect(mockRedis.incr).toHaveBeenCalledWith('websocket:messages:received');
    });

    it('should provide connection statistics', async () => {
      mockRedis.get
        .mockResolvedValueOnce('15')  // total connections
        .mockResolvedValueOnce('8')   // active connections
        .mockResolvedValueOnce('150') // messages sent
        .mockResolvedValueOnce('120'); // messages received

      const stats = await wsService.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 15,
        activeConnections: 8,
        messagesSent: 150,
        messagesReceived: 120
      });
    });
  });

  describe('subscription management', () => {
    it('should validate subscription channels', () => {
      const validChannels = ['profile_metrics', 'automation_status', 'system_alerts'];
      const invalidChannels = ['invalid_channel', 'admin_only'];

      validChannels.forEach(channel => {
        expect((wsService as any).isValidChannel(channel)).toBe(true);
      });

      invalidChannels.forEach(channel => {
        expect((wsService as any).isValidChannel(channel)).toBe(false);
      });
    });

    it('should enforce subscription tier limits', () => {
      const freeUserChannels = ['profile_metrics'];
      const premiumUserChannels = ['profile_metrics', 'automation_status', 'analytics', 'predictions'];

      expect((wsService as any).checkSubscriptionLimits('FREE', freeUserChannels)).toBe(true);
      expect((wsService as any).checkSubscriptionLimits('FREE', premiumUserChannels)).toBe(false);
      expect((wsService as any).checkSubscriptionLimits('PREMIUM', premiumUserChannels)).toBe(true);
    });

    it('should manage user subscriptions efficiently', () => {
      const userId = 'user-123';
      const channels = ['profile_metrics', 'automation_status'];

      (wsService as any).addUserSubscriptions(userId, channels);

      const userSubscriptions = (wsService as any).getUserSubscriptions(userId);
      expect(userSubscriptions).toEqual(new Set(channels));

      (wsService as any).removeUserSubscriptions(userId, ['profile_metrics']);
      const updatedSubscriptions = (wsService as any).getUserSubscriptions(userId);
      expect(updatedSubscriptions).toEqual(new Set(['automation_status']));
    });
  });

  describe('error handling and resilience', () => {
    it('should handle WebSocket server errors gracefully', () => {
      const errorSpy = jest.fn();
      wsService.on('error', errorSpy);

      const serverError = new Error('WebSocket server error');
      const errorHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'error')[1];

      errorHandler(serverError);

      expect(errorSpy).toHaveBeenCalledWith(serverError);
    });

    it('should recover from temporary Redis failures', async () => {
      mockRedis.hset.mockRejectedValueOnce(new Error('Redis timeout'));
      mockRedis.hset.mockResolvedValueOnce(1); // Recovery

      const message = { type: 'test', data: {} };

      await expect(
        wsService.broadcastToUser('user-123', 'profile_metrics', message)
      ).resolves.not.toThrow();
    });

    it('should handle malformed JWT tokens', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Malformed token');
      });

      const mockClient = {
        close: jest.fn(),
        on: jest.fn()
      } as any;

      const connectionHandler = (mockWSS.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connection')[1];

      const mockRequest = {
        url: '/ws?token=malformed-token',
        headers: {}
      };

      connectionHandler(mockClient, mockRequest);

      expect(mockClient.close).toHaveBeenCalledWith(1008, 'Authentication failed');
    });

    it('should handle concurrent client operations', async () => {
      const mockClients = Array.from({ length: 100 }, () => ({
        send: jest.fn(),
        readyState: WebSocket.OPEN
      }));

      mockWSS.clients = new Set(mockClients as any);

      mockClients.forEach((client, index) => {
        (wsService as any).clientMetadata.set(client, {
          userId: `user-${index}`,
          subscriptions: ['profile_metrics']
        });
      });

      const message = { type: 'bulk_update', data: {} };

      await expect(
        wsService.broadcastToChannel('profile_metrics', message)
      ).resolves.not.toThrow();

      mockClients.forEach(client => {
        expect(client.send).toHaveBeenCalledWith(JSON.stringify(message));
      });
    });
  });

  describe('cleanup and shutdown', () => {
    it('should cleanup resources on shutdown', async () => {
      await wsService.shutdown();

      expect(mockWSS.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle graceful shutdown with active connections', async () => {
      const mockClients = [
        { close: jest.fn(), readyState: WebSocket.OPEN },
        { close: jest.fn(), readyState: WebSocket.OPEN }
      ];

      mockWSS.clients = new Set(mockClients as any);

      await wsService.shutdown();

      mockClients.forEach(client => {
        expect(client.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      });
    });

    it('should cleanup heartbeat intervals', async () => {
      wsService.startHeartbeat();
      await wsService.shutdown();

      // Heartbeat should be stopped
      expect(clearInterval).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockWSS.close.mockImplementation((callback) => {
        callback(new Error('Shutdown error'));
      });

      await expect(wsService.shutdown()).resolves.not.toThrow();
    });
  });
});