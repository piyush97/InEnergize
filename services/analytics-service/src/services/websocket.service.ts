import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { logger } from '@/config/logger';
import { WebSocketMessage } from '@/types/analytics';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class WebSocketService {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  public initialize(port: number): void {
    this.wss = new WebSocket.Server({
      port,
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();

    logger.info('WebSocket server initialized', { port });
  }

  /**
   * Verify client authentication
   */
  private verifyClient(info: any): boolean {
    try {
      const url = new URL(info.req.url, 'ws://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided');
        return false;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      info.req.userId = decoded.userId;
      
      return true;
    } catch (error) {
      logger.warn('WebSocket connection rejected: Invalid token', { error });
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, req: any): void {
    const userId = req.userId;
    ws.userId = userId;
    ws.isAlive = true;

    // Add client to user's connection set
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);

    logger.info('WebSocket client connected', { userId, totalConnections: this.getTotalConnections() });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages from client
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error, data });
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { error, userId });
      this.handleDisconnection(ws);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connection_status',
      data: { status: 'connected', timestamp: new Date() },
      timestamp: new Date()
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: AuthenticatedWebSocket, message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'subscribe':
        // Handle subscription to specific metrics or events
        logger.info('Client subscribed', { userId: ws.userId, subscription: data });
        break;
      
      case 'unsubscribe':
        // Handle unsubscription
        logger.info('Client unsubscribed', { userId: ws.userId, subscription: data });
        break;
      
      case 'ping':
        // Respond to ping
        this.sendToClient(ws, {
          type: 'pong',
          data: { timestamp: new Date() },
          timestamp: new Date()
        });
        break;
      
      default:
        logger.warn('Unknown WebSocket message type', { type, userId: ws.userId });
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    const userId = ws.userId;
    
    if (userId && this.clients.has(userId)) {
      this.clients.get(userId)!.delete(ws);
      
      // Remove user entry if no more connections
      if (this.clients.get(userId)!.size === 0) {
        this.clients.delete(userId);
      }
    }

    logger.info('WebSocket client disconnected', { userId, totalConnections: this.getTotalConnections() });
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: string, message: WebSocketMessage): void {
    const userConnections = this.clients.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      logger.debug('No WebSocket connections for user', { userId });
      return;
    }

    const messageString = JSON.stringify(message);
    let sentCount = 0;

    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageString);
        sentCount++;
      }
    });

    logger.debug('Message sent to user', { userId, sentCount, message: message.type });
  }

  /**
   * Send message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    const messageString = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((userConnections) => {
      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageString);
          sentCount++;
        }
      });
    });

    logger.debug('Message broadcasted', { sentCount, message: message.type });
  }

  /**
   * Send real-time metric update
   */
  public sendMetricUpdate(userId: string, metricType: string, data: any): void {
    this.sendToUser(userId, {
      type: 'metric_update',
      userId,
      data: {
        metricType,
        ...data
      },
      timestamp: new Date()
    });
  }

  /**
   * Send real-time data update
   */
  public sendRealTimeData(userId: string, data: any): void {
    this.sendToUser(userId, {
      type: 'real_time_data',
      userId,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Send alert notification
   */
  public sendAlert(userId: string, alert: any): void {
    this.sendToUser(userId, {
      type: 'alert',
      userId,
      data: alert,
      timestamp: new Date()
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat to check client connections
   */
  private startHeartbeat(): void {
    const interval = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000');
    
    this.pingInterval = setInterval(() => {
      this.clients.forEach((userConnections, userId) => {
        userConnections.forEach((ws) => {
          if (!ws.isAlive) {
            logger.debug('WebSocket client failed heartbeat', { userId });
            ws.terminate();
            this.handleDisconnection(ws);
          } else {
            ws.isAlive = false;
            ws.ping();
          }
        });
      });
    }, interval);

    logger.info('WebSocket heartbeat started', { interval });
  }

  /**
   * Get total number of connections
   */
  private getTotalConnections(): number {
    let total = 0;
    this.clients.forEach((userConnections) => {
      total += userConnections.size;
    });
    return total;
  }

  /**
   * Get connection count for specific user
   */
  public getUserConnectionCount(userId: string): number {
    return this.clients.get(userId)?.size || 0;
  }

  /**
   * Get all connected user IDs
   */
  public getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Close all connections and shutdown server
   */
  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    logger.info('WebSocket server closed');
  }
}