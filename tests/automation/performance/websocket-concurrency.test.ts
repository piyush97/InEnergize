/**
 * WebSocket Concurrency and Performance Tests
 * 
 * Tests WebSocket server performance under high concurrent load:
 * - 1,000+ concurrent connections
 * - Real-time dashboard updates
 * - Message throughput and latency
 * - Connection stability and recovery
 * - Memory usage and resource limits
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import WebSocket from 'ws';
import { Server } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { performance } from 'perf_hooks';
import os from 'os';

// Types for WebSocket testing
interface WebSocketTestConnection {
  id: string;
  socket: WebSocket;
  connected: boolean;
  messageCount: number;
  latencies: number[];
  errors: string[];
  connectedAt: number;
}

interface PerformanceMetrics {
  connectionsCount: number;
  totalMessages: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

interface TestConfig {
  maxConnections: number;
  rampUpDuration: number;
  testDuration: number;
  messageInterval: number;
  expectedLatencyP95: number;
  expectedLatencyP99: number;
  maxErrorRate: number;
  maxMemoryMB: number;
}

const TEST_CONFIG: TestConfig = {
  maxConnections: 1000,
  rampUpDuration: 30000, // 30 seconds
  testDuration: 300000,  // 5 minutes
  messageInterval: 5000, // 5 seconds
  expectedLatencyP95: 100, // 100ms
  expectedLatencyP99: 200, // 200ms
  maxErrorRate: 0.05, // 5%
  maxMemoryMB: 512, // 512MB
};

// Test utilities
class WebSocketPerformanceTester {
  private connections: Map<string, WebSocketTestConnection> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private testStartTime: number = 0;
  private isRunning: boolean = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(private baseUrl: string = 'ws://localhost:3007') {}

  async createConnection(userId: string, authToken: string): Promise<WebSocketTestConnection> {
    const connectionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wsUrl = `${this.baseUrl}/automation/dashboard/${userId}?token=${authToken}`;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'User-Agent': 'InErgize-Performance-Test/1.0'
        }
      });

      const connection: WebSocketTestConnection = {
        id: connectionId,
        socket,
        connected: false,
        messageCount: 0,
        latencies: [],
        errors: [],
        connectedAt: 0
      };

      const connectTimeout = setTimeout(() => {
        connection.errors.push('Connection timeout');
        reject(new Error(`Connection timeout for ${connectionId}`));
      }, 10000);

      socket.on('open', () => {
        clearTimeout(connectTimeout);
        connection.connected = true;
        connection.connectedAt = performance.now();
        
        // Subscribe to all available channels
        socket.send(JSON.stringify({
          type: 'subscribe',
          channels: ['overview', 'queue_updates', 'safety_alerts', 'templates', 'analytics']
        }));

        this.connections.set(connectionId, connection);
        resolve(connection);
      });

      socket.on('message', (data: WebSocket.Data) => {
        const receiveTime = performance.now();
        connection.messageCount++;

        try {
          const message = JSON.parse(data.toString());
          
          // Calculate latency for timestamped messages
          if (message.timestamp) {
            const latency = receiveTime - message.timestamp;
            connection.latencies.push(latency);
          }

          // Handle ping/pong for RTT measurement
          if (message.type === 'ping') {
            socket.send(JSON.stringify({
              type: 'pong',
              timestamp: receiveTime,
              originalTimestamp: message.timestamp
            }));
          }
        } catch (error) {
          connection.errors.push(`Message parse error: ${error.message}`);
        }
      });

      socket.on('error', (error) => {
        connection.errors.push(`Socket error: ${error.message}`);
        connection.connected = false;
      });

      socket.on('close', (code, reason) => {
        connection.connected = false;
        if (code !== 1000) { // Not normal closure
          connection.errors.push(`Unexpected close: ${code} ${reason}`);
        }
      });
    });
  }

  async rampUpConnections(
    userCount: number, 
    authTokenGenerator: (index: number) => string,
    rampDuration: number
  ): Promise<void> {
    const interval = rampDuration / userCount;
    const connectionPromises: Promise<WebSocketTestConnection>[] = [];

    for (let i = 0; i < userCount; i++) {
      const userId = `perf_test_user_${i}`;
      const authToken = authTokenGenerator(i);
      
      // Delay each connection to create gradual ramp-up
      setTimeout(() => {
        const connectionPromise = this.createConnection(userId, authToken)
          .catch(error => {
            console.warn(`Failed to create connection for ${userId}:`, error.message);
            return null;
          });
        connectionPromises.push(connectionPromise);
      }, i * interval);
    }

    // Wait for all connections to complete (or fail)
    await Promise.all(connectionPromises);
    
    console.log(`✅ Ramp-up complete: ${this.connections.size}/${userCount} connections established`);
  }

  startMetricsCollection(): void {
    this.testStartTime = performance.now();
    this.isRunning = true;

    this.metricsInterval = setInterval(() => {
      const metrics = this.collectCurrentMetrics();
      this.metrics.push(metrics);
      
      console.log(`📊 Metrics: ${metrics.connectionsCount} connections, ` +
        `${metrics.totalMessages} messages, ` +
        `${metrics.averageLatency.toFixed(2)}ms avg latency, ` +
        `${(metrics.errorRate * 100).toFixed(2)}% errors`);
    }, 10000); // Every 10 seconds
  }

  stopMetricsCollection(): void {
    this.isRunning = false;
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  collectCurrentMetrics(): PerformanceMetrics {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.connected);
    
    const allLatencies = activeConnections
      .flatMap(conn => conn.latencies)
      .sort((a, b) => a - b);
    
    const totalMessages = activeConnections
      .reduce((sum, conn) => sum + conn.messageCount, 0);
    
    const totalErrors = activeConnections
      .reduce((sum, conn) => sum + conn.errors.length, 0);

    return {
      connectionsCount: activeConnections.length,
      totalMessages,
      averageLatency: allLatencies.length > 0 ? 
        allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length : 0,
      p95Latency: allLatencies.length > 0 ? 
        allLatencies[Math.floor(allLatencies.length * 0.95)] : 0,
      p99Latency: allLatencies.length > 0 ? 
        allLatencies[Math.floor(allLatencies.length * 0.99)] : 0,
      errorRate: totalMessages > 0 ? totalErrors / totalMessages : 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  simulateUserActivity(): void {
    const connections = Array.from(this.connections.values())
      .filter(conn => conn.connected);

    connections.forEach(connection => {
      // Send periodic ping messages
      const pingInterval = setInterval(() => {
        if (connection.connected && connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(JSON.stringify({
            type: 'ping',
            timestamp: performance.now(),
            userId: connection.id
          }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Every 30 seconds

      // Simulate user interactions
      const activityInterval = setInterval(() => {
        if (connection.connected && connection.socket.readyState === WebSocket.OPEN) {
          const actions = [
            'request_queue_update',
            'request_template_list',
            'subscribe_analytics',
            'request_safety_status'
          ];
          
          const action = actions[Math.floor(Math.random() * actions.length)];
          
          connection.socket.send(JSON.stringify({
            type: action,
            timestamp: performance.now(),
            userId: connection.id
          }));
        } else {
          clearInterval(activityInterval);
        }
      }, 60000 + Math.random() * 60000); // Every 1-2 minutes
    });
  }

  async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(connection => {
      return new Promise<void>((resolve) => {
        if (connection.connected) {
          connection.socket.once('close', () => resolve());
          connection.socket.close();
        } else {
          resolve();
        }
      });
    });

    await Promise.all(closePromises);
    this.connections.clear();
    console.log('🔌 All WebSocket connections closed');
  }

  getFinalMetrics(): PerformanceMetrics {
    return this.collectCurrentMetrics();
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}

// Mock authentication token generator
const generateAuthToken = (userId: number): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    userId: `perf_test_user_${userId}`,
    tier: userId % 3 === 0 ? 'enterprise' : (userId % 2 === 0 ? 'premium' : 'free'),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64');
  return `${header}.${payload}.mock_signature`;
};

describe('WebSocket Concurrency Performance Tests', () => {
  let tester: WebSocketPerformanceTester;

  beforeAll(async () => {
    // Verify WebSocket service is running
    await new Promise<void>((resolve, reject) => {
      const testSocket = new WebSocket('ws://localhost:3007/health');
      testSocket.on('open', () => {
        testSocket.close();
        resolve();
      });
      testSocket.on('error', () => {
        reject(new Error('WebSocket service not available at localhost:3007'));
      });
    });
  }, 30000);

  beforeEach(() => {
    tester = new WebSocketPerformanceTester();
  });

  afterEach(async () => {
    if (tester) {
      tester.stopMetricsCollection();
      await tester.closeAllConnections();
    }
  }, 30000);

  test('should handle 100 concurrent WebSocket connections', async () => {
    const connectionCount = 100;
    const testDuration = 60000; // 1 minute
    
    console.log(`🚀 Starting 100 concurrent connections test...`);
    
    // Ramp up connections
    await tester.rampUpConnections(
      connectionCount,
      generateAuthToken,
      10000 // 10 second ramp-up
    );

    // Start metrics collection
    tester.startMetricsCollection();
    tester.simulateUserActivity();

    // Run test for specified duration
    await new Promise(resolve => setTimeout(resolve, testDuration));

    // Collect final metrics
    const finalMetrics = tester.getFinalMetrics();

    // Assertions
    expect(finalMetrics.connectionsCount).toBeGreaterThanOrEqual(90); // 90% success rate
    expect(finalMetrics.averageLatency).toBeLessThan(100); // < 100ms average
    expect(finalMetrics.p95Latency).toBeLessThan(200); // < 200ms P95
    expect(finalMetrics.errorRate).toBeLessThan(0.05); // < 5% error rate
    expect(finalMetrics.totalMessages).toBeGreaterThan(0);

    console.log(`✅ 100 connections test complete:`, {
      connections: finalMetrics.connectionsCount,
      avgLatency: finalMetrics.averageLatency.toFixed(2) + 'ms',
      p95Latency: finalMetrics.p95Latency.toFixed(2) + 'ms',
      errorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%',
      totalMessages: finalMetrics.totalMessages
    });
  }, 120000);

  test('should handle 500 concurrent WebSocket connections', async () => {
    const connectionCount = 500;
    const testDuration = 120000; // 2 minutes
    
    console.log(`🚀 Starting 500 concurrent connections test...`);
    
    // Ramp up connections gradually
    await tester.rampUpConnections(
      connectionCount,
      generateAuthToken,
      20000 // 20 second ramp-up
    );

    tester.startMetricsCollection();
    tester.simulateUserActivity();

    // Run test
    await new Promise(resolve => setTimeout(resolve, testDuration));

    const finalMetrics = tester.getFinalMetrics();

    // More lenient thresholds for higher load
    expect(finalMetrics.connectionsCount).toBeGreaterThanOrEqual(450); // 90% success rate
    expect(finalMetrics.averageLatency).toBeLessThan(150); // < 150ms average
    expect(finalMetrics.p95Latency).toBeLessThan(300); // < 300ms P95
    expect(finalMetrics.errorRate).toBeLessThan(0.10); // < 10% error rate

    // Memory usage check
    const memoryUsageMB = finalMetrics.memoryUsage.heapUsed / (1024 * 1024);
    expect(memoryUsageMB).toBeLessThan(TEST_CONFIG.maxMemoryMB);

    console.log(`✅ 500 connections test complete:`, {
      connections: finalMetrics.connectionsCount,
      avgLatency: finalMetrics.averageLatency.toFixed(2) + 'ms',
      p95Latency: finalMetrics.p95Latency.toFixed(2) + 'ms',
      errorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%',
      memoryUsageMB: memoryUsageMB.toFixed(2) + 'MB'
    });
  }, 180000);

  test('should handle 1000 concurrent WebSocket connections', async () => {
    const connectionCount = 1000;
    const testDuration = 180000; // 3 minutes
    
    console.log(`🚀 Starting 1000 concurrent connections test...`);
    
    // Gradual ramp-up for maximum load
    await tester.rampUpConnections(
      connectionCount,
      generateAuthToken,
      TEST_CONFIG.rampUpDuration
    );

    tester.startMetricsCollection();
    tester.simulateUserActivity();

    await new Promise(resolve => setTimeout(resolve, testDuration));

    const finalMetrics = tester.getFinalMetrics();
    const metricsHistory = tester.getMetricsHistory();

    // High-load thresholds
    expect(finalMetrics.connectionsCount).toBeGreaterThanOrEqual(800); // 80% success rate
    expect(finalMetrics.averageLatency).toBeLessThan(200); // < 200ms average
    expect(finalMetrics.p99Latency).toBeLessThan(500); // < 500ms P99
    expect(finalMetrics.errorRate).toBeLessThan(0.15); // < 15% error rate

    // System resource checks
    const memoryUsageMB = finalMetrics.memoryUsage.heapUsed / (1024 * 1024);
    expect(memoryUsageMB).toBeLessThan(TEST_CONFIG.maxMemoryMB * 1.5); // 50% buffer for max load

    // Verify performance stability over time
    const latencyTrend = metricsHistory.map(m => m.averageLatency);
    const latencyIncrease = latencyTrend[latencyTrend.length - 1] - latencyTrend[0];
    expect(latencyIncrease).toBeLessThan(100); // Latency shouldn't degrade by >100ms

    console.log(`✅ 1000 connections test complete:`, {
      connections: finalMetrics.connectionsCount,
      avgLatency: finalMetrics.averageLatency.toFixed(2) + 'ms',
      p99Latency: finalMetrics.p99Latency.toFixed(2) + 'ms',
      errorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%',
      memoryUsageMB: memoryUsageMB.toFixed(2) + 'MB',
      latencyTrend: `${latencyTrend[0].toFixed(1)}ms → ${latencyTrend[latencyTrend.length - 1].toFixed(1)}ms`
    });
  }, 300000);

  test('should recover from connection failures gracefully', async () => {
    const connectionCount = 200;
    
    console.log(`🚀 Starting connection recovery test...`);
    
    // Establish initial connections
    await tester.rampUpConnections(connectionCount, generateAuthToken, 10000);
    
    tester.startMetricsCollection();
    const initialMetrics = tester.collectCurrentMetrics();
    
    // Simulate connection failures by closing random connections
    const connections = Array.from(tester['connections'].values());
    const connectionsToClose = connections.slice(0, Math.floor(connections.length * 0.3));
    
    console.log(`🔌 Simulating ${connectionsToClose.length} connection failures...`);
    
    connectionsToClose.forEach(conn => {
      if (conn.connected) {
        conn.socket.close(1001, 'Simulated failure');
      }
    });

    // Wait for recovery
    await new Promise(resolve => setTimeout(resolve, 30000));

    const recoveryMetrics = tester.collectCurrentMetrics();
    
    // Verify the system handles failures gracefully
    expect(recoveryMetrics.connectionsCount).toBeGreaterThan(0);
    expect(recoveryMetrics.errorRate).toBeLessThan(0.50); // Even with failures, < 50% error rate
    
    // Verify remaining connections are still functional
    expect(recoveryMetrics.totalMessages).toBeGreaterThan(initialMetrics.totalMessages);

    console.log(`✅ Connection recovery test complete:`, {
      initialConnections: initialMetrics.connectionsCount,
      simulatedFailures: connectionsToClose.length,
      finalConnections: recoveryMetrics.connectionsCount,
      errorRate: (recoveryMetrics.errorRate * 100).toFixed(2) + '%'
    });
  }, 120000);

  test('should maintain performance under message burst load', async () => {
    const connectionCount = 100;
    
    console.log(`🚀 Starting message burst load test...`);
    
    await tester.rampUpConnections(connectionCount, generateAuthToken, 5000);
    
    tester.startMetricsCollection();
    
    // Generate burst of messages
    const connections = Array.from(tester['connections'].values())
      .filter(conn => conn.connected);
    
    const burstPromises = connections.map(async (connection) => {
      // Send 10 messages rapidly
      for (let i = 0; i < 10; i++) {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(JSON.stringify({
            type: 'burst_message',
            timestamp: performance.now(),
            sequence: i,
            userId: connection.id
          }));
        }
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms between messages
      }
    });

    await Promise.all(burstPromises);
    
    // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const burstMetrics = tester.collectCurrentMetrics();
    
    // Verify system handles message burst
    expect(burstMetrics.connectionsCount).toBeGreaterThanOrEqual(95); // 95% connections maintained
    expect(burstMetrics.averageLatency).toBeLessThan(150); // < 150ms average during burst
    expect(burstMetrics.errorRate).toBeLessThan(0.10); // < 10% error rate during burst

    console.log(`✅ Message burst test complete:`, {
      connections: burstMetrics.connectionsCount,
      avgLatency: burstMetrics.averageLatency.toFixed(2) + 'ms',
      errorRate: (burstMetrics.errorRate * 100).toFixed(2) + '%',
      totalMessages: burstMetrics.totalMessages
    });
  }, 60000);
});