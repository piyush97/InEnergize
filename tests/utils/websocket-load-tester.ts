/**
 * WebSocket Load Testing Utility
 * 
 * Specialized load testing utility for WebSocket connections and real-time features
 * Handles connection management, message latency measurement, and concurrent operations
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class WebSocketLoadTester extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private messageLatencies: Map<string, number> = new Map();
  private activeConnections: number = 0;

  /**
   * Create a WebSocket connection for load testing
   */
  async createConnection(options: ConnectionOptions): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const connectionId = `ws-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const startTime = Date.now();

      const ws = new WebSocket(options.url, {
        headers: options.headers,
        timeout: options.timeout || 10000
      });

      const connection: WebSocketConnection = {
        id: connectionId,
        ws,
        startTime,
        isConnected: false,
        messagesSent: 0,
        messagesReceived: 0,
        errors: []
      };

      // Connection established
      ws.on('open', () => {
        const connectTime = Date.now() - startTime;
        connection.isConnected = true;
        connection.connectTime = connectTime;
        
        this.connections.set(connectionId, connection);
        this.activeConnections++;
        
        this.emit('connectionEstablished', {
          connectionId,
          connectTime,
          totalConnections: this.activeConnections
        });
        
        resolve(ws);
      });

      // Connection error
      ws.on('error', (error) => {
        connection.errors.push({
          timestamp: Date.now(),
          error: error.message
        });
        
        this.emit('connectionError', {
          connectionId,
          error: error.message
        });
        
        reject(error);
      });

      // Connection closed
      ws.on('close', (code, reason) => {
        connection.isConnected = false;
        this.activeConnections--;
        
        this.emit('connectionClosed', {
          connectionId,
          code,
          reason,
          duration: Date.now() - connection.startTime,
          totalConnections: this.activeConnections
        });
        
        this.connections.delete(connectionId);
      });

      // Message received
      ws.on('message', (data) => {
        connection.messagesReceived++;
        
        try {
          const message = JSON.parse(data.toString());
          
          // Check if this is a response to a latency measurement
          if (message.type === 'LATENCY_RESPONSE' && message.messageId) {
            const sendTime = this.messageLatencies.get(message.messageId);
            if (sendTime) {
              const latency = Date.now() - sendTime;
              this.messageLatencies.delete(message.messageId);
              
              this.emit('messageLatency', {
                connectionId,
                messageId: message.messageId,
                latency
              });
            }
          }
          
          this.emit('messageReceived', {
            connectionId,
            message,
            timestamp: Date.now()
          });
          
        } catch (error) {
          connection.errors.push({
            timestamp: Date.now(),
            error: `Failed to parse message: ${error.message}`
          });
        }
      });
    });
  }

  /**
   * Send a message through a WebSocket connection
   */
  async sendMessage(ws: WebSocket, message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection is not open'));
        return;
      }

      try {
        const messageString = JSON.stringify(message);
        ws.send(messageString);
        
        // Find connection and update stats
        const connection = this.findConnectionByWebSocket(ws);
        if (connection) {
          connection.messagesSent++;
        }
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Measure message round-trip latency
   */
  async measureMessageLatency(ws: WebSocket, message: any): Promise<MessageLatencyResult> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sendTime = Date.now();
    
    // Store send time for latency calculation
    this.messageLatencies.set(messageId, sendTime);
    
    // Add latency measurement metadata to message
    const latencyMessage = {
      ...message,
      _latencyTest: true,
      _messageId: messageId,
      _sendTime: sendTime
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageLatencies.delete(messageId);
        reject(new Error(`Message latency timeout for ${messageId}`));
      }, 10000); // 10 second timeout

      // Listen for latency response
      const latencyHandler = (data: { messageId: string; latency: number }) => {
        if (data.messageId === messageId) {
          clearTimeout(timeout);
          this.removeListener('messageLatency', latencyHandler);
          
          resolve({
            messageId,
            latency: data.latency,
            success: true
          });
        }
      };

      this.on('messageLatency', latencyHandler);

      // Send the message
      this.sendMessage(ws, latencyMessage).catch(error => {
        clearTimeout(timeout);
        this.removeListener('messageLatency', latencyHandler);
        this.messageLatencies.delete(messageId);
        
        resolve({
          messageId,
          latency: -1,
          success: false,
          error: error.message
        });
      });
    });
  }

  /**
   * Perform concurrent editing operation
   */
  async performConcurrentEdit(ws: WebSocket, editOperation: EditOperation): Promise<EditResult> {
    const editId = `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();

    const editMessage = {
      type: 'COLLABORATIVE_EDIT',
      editId,
      templateId: editOperation.templateId,
      operation: editOperation.operation,
      userId: editOperation.userId,
      timestamp: editOperation.timestamp || Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Edit operation timeout for ${editId}`));
      }, 5000); // 5 second timeout

      // Listen for edit response
      const editHandler = (data: { message: any }) => {
        if (data.message.type === 'EDIT_RESPONSE' && data.message.editId === editId) {
          clearTimeout(timeout);
          this.removeListener('messageReceived', editHandler);
          
          const endTime = Date.now();
          const latency = endTime - startTime;

          const result: EditResult = {
            editId,
            latency,
            success: data.message.success,
            templateId: editOperation.templateId,
            conflictResolution: data.message.conflictResolution
          };

          if (!data.message.success) {
            result.error = data.message.error;
          }

          resolve(result);
        }
      };

      this.on('messageReceived', editHandler);

      // Send edit operation
      this.sendMessage(ws, editMessage).catch(error => {
        clearTimeout(timeout);
        this.removeListener('messageReceived', editHandler);
        
        resolve({
          editId,
          latency: Date.now() - startTime,
          success: false,
          templateId: editOperation.templateId,
          error: error.message
        });
      });
    });
  }

  /**
   * Simulate realistic user activity patterns
   */
  async simulateUserActivity(ws: WebSocket, config: UserActivityConfig): Promise<UserActivityResult> {
    const activityId = `activity-${Date.now()}`;
    const startTime = Date.now();
    const activities: ActivityEvent[] = [];

    try {
      // Template viewing activity
      if (config.viewTemplates) {
        for (let i = 0; i < config.viewTemplates.count; i++) {
          const templateId = `template-${Math.floor(Math.random() * config.viewTemplates.templates)}`;
          
          await this.sendMessage(ws, {
            type: 'VIEW_TEMPLATE',
            templateId,
            userId: config.userId,
            timestamp: Date.now()
          });
          
          activities.push({
            type: 'VIEW_TEMPLATE',
            timestamp: Date.now(),
            success: true
          });
          
          // Realistic viewing time
          await new Promise(resolve => setTimeout(resolve, 
            config.viewTemplates.duration * 1000 + Math.random() * 2000
          ));
        }
      }

      // Template editing activity
      if (config.editTemplates) {
        for (let i = 0; i < config.editTemplates.count; i++) {
          const templateId = `template-${Math.floor(Math.random() * 50)}`; // 50 templates
          
          const editResult = await this.performConcurrentEdit(ws, {
            templateId,
            operation: {
              type: Math.random() > 0.5 ? 'insert' : 'delete',
              position: Math.floor(Math.random() * 1000),
              content: `User ${config.userId} edit ${i}`,
              length: Math.random() > 0.7 ? Math.floor(Math.random() * 20) : undefined
            },
            userId: config.userId
          });
          
          activities.push({
            type: 'EDIT_TEMPLATE',
            timestamp: Date.now(),
            success: editResult.success,
            latency: editResult.latency
          });
          
          // Pause between edits
          await new Promise(resolve => setTimeout(resolve, 
            Math.random() * 5000 + 1000 // 1-6 seconds
          ));
        }
      }

      // Comment activity
      if (config.createComments) {
        for (let i = 0; i < config.createComments.count; i++) {
          await this.sendMessage(ws, {
            type: 'CREATE_COMMENT',
            templateId: `template-${Math.floor(Math.random() * 50)}`,
            content: `Comment ${i} from user ${config.userId}`,
            userId: config.userId,
            timestamp: Date.now()
          });
          
          activities.push({
            type: 'CREATE_COMMENT',
            timestamp: Date.now(),
            success: true
          });
          
          await new Promise(resolve => setTimeout(resolve, 
            Math.random() * 3000 + 500 // 0.5-3.5 seconds
          ));
        }
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      return {
        activityId,
        userId: config.userId,
        duration: totalDuration,
        activities,
        successRate: activities.filter(a => a.success).length / activities.length,
        totalActivities: activities.length
      };

    } catch (error) {
      return {
        activityId,
        userId: config.userId,
        duration: Date.now() - startTime,
        activities,
        successRate: activities.filter(a => a.success).length / activities.length,
        totalActivities: activities.length,
        error: error.message
      };
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const connections = Array.from(this.connections.values());
    
    const connectedCount = connections.filter(c => c.isConnected).length;
    const totalMessages = connections.reduce((sum, c) => sum + c.messagesSent + c.messagesReceived, 0);
    const totalErrors = connections.reduce((sum, c) => sum + c.errors.length, 0);
    
    const connectTimes = connections
      .filter(c => c.connectTime !== undefined)
      .map(c => c.connectTime!);
    
    const avgConnectTime = connectTimes.length > 0 
      ? connectTimes.reduce((sum, time) => sum + time, 0) / connectTimes.length 
      : 0;

    return {
      totalConnections: connections.length,
      activeConnections: connectedCount,
      avgConnectTime,
      minConnectTime: Math.min(...connectTimes) || 0,
      maxConnectTime: Math.max(...connectTimes) || 0,
      totalMessagesSent: connections.reduce((sum, c) => sum + c.messagesSent, 0),
      totalMessagesReceived: connections.reduce((sum, c) => sum + c.messagesReceived, 0),
      totalMessages,
      totalErrors,
      errorRate: totalErrors / Math.max(totalMessages, 1)
    };
  }

  /**
   * Close all connections and cleanup
   */
  async cleanup(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        closePromises.push(
          new Promise<void>(resolve => {
            connection.ws.on('close', () => resolve());
            connection.ws.close();
          })
        );
      }
    }

    await Promise.all(closePromises);
    
    this.connections.clear();
    this.messageLatencies.clear();
    this.activeConnections = 0;
    this.removeAllListeners();
  }

  // Private helper methods
  private findConnectionByWebSocket(ws: WebSocket): WebSocketConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.ws === ws) {
        return connection;
      }
    }
    return undefined;
  }
}

// Type definitions
export interface ConnectionOptions {
  url: string;
  headers?: { [key: string]: string };
  timeout?: number;
}

interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  startTime: number;
  connectTime?: number;
  isConnected: boolean;
  messagesSent: number;
  messagesReceived: number;
  errors: Array<{
    timestamp: number;
    error: string;
  }>;
}

export interface MessageLatencyResult {
  messageId: string;
  latency: number;
  success: boolean;
  error?: string;
}

export interface EditOperation {
  templateId: string;
  operation: {
    type: 'insert' | 'delete' | 'replace';
    position: number;
    content?: string;
    length?: number;
  };
  userId: string;
  timestamp?: number;
}

export interface EditResult {
  editId: string;
  latency: number;
  success: boolean;
  templateId: string;
  conflictResolution?: {
    type: string;
    resolutionTime: number;
    strategy: string;
  };
  error?: string;
}

export interface UserActivityConfig {
  userId: string;
  viewTemplates?: {
    count: number;
    templates: number; // number of different templates to view
    duration: number; // seconds per view
  };
  editTemplates?: {
    count: number;
  };
  createComments?: {
    count: number;
  };
}

interface ActivityEvent {
  type: string;
  timestamp: number;
  success: boolean;
  latency?: number;
}

export interface UserActivityResult {
  activityId: string;
  userId: string;
  duration: number;
  activities: ActivityEvent[];
  successRate: number;
  totalActivities: number;
  error?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  avgConnectTime: number;
  minConnectTime: number;
  maxConnectTime: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalMessages: number;
  totalErrors: number;
  errorRate: number;
}