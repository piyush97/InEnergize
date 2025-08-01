/**
 * Team Collaboration Load Testing Framework
 * 
 * Comprehensive load testing for InErgize's team collaboration features including:
 * - WebSocket connection scalability (5000+ concurrent connections)
 * - Real-time collaboration performance under load
 * - Team permission system performance
 * - Data isolation and multi-tenancy performance
 * - Concurrent editing and conflict resolution stress testing
 */

import WebSocket from 'ws';
import { TeamService } from '../../services/user-management/src/services/team.service';
import { TemplateService } from '../../services/linkedin-service/src/services/template.service';
import { WebSocketService } from '../../services/analytics-service/src/services/websocket.service';

// Load testing utilities
import { WebSocketLoadTester } from '../utils/websocket-load-tester';
import { ConcurrencyManager } from '../utils/concurrency-manager';
import { PerformanceMonitor } from '../utils/performance-monitor';

// Test data fixtures
import { teamTestData, collaborationTestData } from '../fixtures/team-test-data';

jest.setTimeout(120000); // 2 minutes for load tests

describe('Team Collaboration Load Testing', () => {
  let teamService: TeamService;
  let templateService: TemplateService;
  let websocketService: WebSocketService;
  let loadTester: WebSocketLoadTester;
  let concurrencyManager: ConcurrencyManager;
  let performanceMonitor: PerformanceMonitor;

  // Load testing thresholds
  const LOAD_THRESHOLDS = {
    MAX_CONCURRENT_CONNECTIONS: 5000,
    MAX_WEBSOCKET_LATENCY: 100, // milliseconds
    MAX_PERMISSION_CHECK_LATENCY: 50, // milliseconds
    MAX_TEMPLATE_UPDATE_LATENCY: 200, // milliseconds
    MAX_ERROR_RATE: 0.02, // 2% error rate
    MIN_THROUGHPUT: 1000, // operations per second
    MAX_MEMORY_USAGE: 1024, // MB
    MAX_CPU_UTILIZATION: 0.8 // 80%
  };

  beforeEach(() => {
    teamService = new TeamService();
    templateService = new TemplateService();
    websocketService = new WebSocketService();
    loadTester = new WebSocketLoadTester();
    concurrencyManager = new ConcurrencyManager();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(async () => {
    await loadTester.cleanup();
    await concurrencyManager.shutdown();
    performanceMonitor.reset();
  });

  describe('WebSocket Connection Scalability', () => {
    it('should handle 5000+ concurrent WebSocket connections', async () => {
      const targetConnections = 5000;
      const connectionBatchSize = 250;
      const batches = Math.ceil(targetConnections / connectionBatchSize);
      
      console.log(`\nTesting ${targetConnections} concurrent WebSocket connections...`);
      
      const connectionResults: ConnectionMetrics[] = [];
      const activeConnections: WebSocket[] = [];
      
      // Establish connections in batches to avoid overwhelming the system
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now();
        const batchConnections: Promise<WebSocket>[] = [];
        
        for (let i = 0; i < connectionBatchSize; i++) {
          const connectionIndex = batch * connectionBatchSize + i;
          
          batchConnections.push(
            loadTester.createConnection({
              url: 'ws://localhost:3007',
              headers: {
                'Authorization': `Bearer ${await generateTestJWT(connectionIndex)}`,
                'X-Team-Id': `team-${Math.floor(connectionIndex / 100)}` // 100 users per team
              },
              timeout: 5000
            })
          );
        }
        
        try {
          const connections = await Promise.all(batchConnections);
          activeConnections.push(...connections);
          
          const batchEnd = Date.now();
          const batchDuration = batchEnd - batchStart;
          
          connectionResults.push({
            batch: batch + 1,
            connectionsCount: connections.length,
            duration: batchDuration,
            avgConnectionTime: batchDuration / connections.length,
            successRate: connections.length / connectionBatchSize
          });
          
          console.log(`Batch ${batch + 1}/${batches}: ${connections.length} connections in ${batchDuration}ms`);
          
          // Brief pause between batches
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Batch ${batch + 1} failed:`, error);
          throw error;
        }
      }
      
      // Verify all connections are established
      const totalConnections = activeConnections.length;
      expect(totalConnections).toBeGreaterThanOrEqual(targetConnections * 0.95); // Allow 5% failure rate
      
      // Test WebSocket message broadcast performance
      console.log(`Testing message broadcast to ${totalConnections} connections...`);
      
      const broadcastStart = Date.now();
      const testMessage = {
        type: 'TEMPLATE_UPDATE',
        data: {
          templateId: 'load-test-template',
          updates: { content: 'Load test broadcast message' },
          timestamp: Date.now(),
          userId: 'load-test-user'
        }
      };
      
      // Send test message to all connections
      const messagePromises = activeConnections.map(ws => 
        loadTester.sendMessage(ws, testMessage)
      );
      
      const messageResults = await Promise.allSettled(messagePromises);
      const broadcastEnd = Date.now();
      const broadcastDuration = broadcastEnd - broadcastStart;
      
      const successfulMessages = messageResults.filter(r => r.status === 'fulfilled').length;
      const messageSuccessRate = successfulMessages / totalConnections;
      const messagesPerSecond = totalConnections / (broadcastDuration / 1000);
      
      // Performance assertions
      expect(messageSuccessRate).toBeGreaterThan(0.95); // 95% message delivery success
      expect(broadcastDuration).toBeLessThan(5000); // Broadcast completed within 5 seconds
      expect(messagesPerSecond).toBeGreaterThan(500); // At least 500 messages/second
      
      console.log('Connection scalability results:', {
        totalConnections,
        connectionSuccessRate: `${((totalConnections / targetConnections) * 100).toFixed(1)}%`,
        broadcastDuration: `${broadcastDuration}ms`,
        messageSuccessRate: `${(messageSuccessRate * 100).toFixed(1)}%`,
        messagesPerSecond: messagesPerSecond.toFixed(0)
      });
      
      // Cleanup connections
      await Promise.all(activeConnections.map(ws => 
        new Promise(resolve => {
          ws.close();
          ws.on('close', resolve);
        })
      ));
    });
    
    it('should maintain low latency during high concurrent usage', async () => {
      const concurrentUsers = 1000;
      const messagesPerUser = 10;
      const totalMessages = concurrentUsers * messagesPerUser;
      
      console.log(`\nTesting WebSocket latency with ${concurrentUsers} concurrent users...`);
      
      // Establish connections for concurrent users
      const connections = await Promise.all(
        Array(concurrentUsers).fill(null).map(async (_, index) => {
          return loadTester.createConnection({
            url: 'ws://localhost:3007',
            headers: {
              'Authorization': `Bearer ${await generateTestJWT(index)}`,
              'X-Team-Id': `team-${Math.floor(index / 50)}` // 50 users per team
            },
            timeout: 5000
          });
        })
      );
      
      const latencies: number[] = [];
      const messagePromises: Promise<MessageLatencyResult>[] = [];
      
      // Send messages concurrently from all users
      for (let userIndex = 0; userIndex < concurrentUsers; userIndex++) {
        for (let msgIndex = 0; msgIndex < messagesPerUser; msgIndex++) {
          const messagePromise = loadTester.measureMessageLatency(
            connections[userIndex],
            {
              type: 'COLLABORATIVE_EDIT',
              data: {
                templateId: `template-${userIndex % 100}`, // 100 templates total
                operation: {
                  type: 'insert',
                  position: msgIndex * 10,
                  content: `User ${userIndex} message ${msgIndex}`,
                  timestamp: Date.now()
                },
                userId: `user-${userIndex}`
              }
            }
          );
          
          messagePromises.push(messagePromise);
        }
      }
      
      console.log(`Sending ${totalMessages} messages concurrently...`);
      const results = await Promise.allSettled(messagePromises);
      
      // Analyze latency results
      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<MessageLatencyResult>).value);
      
      const latencyValues = successfulResults.map(r => r.latency);
      const sortedLatencies = latencyValues.sort((a, b) => a - b);
      
      const avgLatency = latencyValues.reduce((sum, lat) => sum + lat, 0) / latencyValues.length;
      const p50Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
      const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];
      const maxLatency = Math.max(...latencyValues);
      
      const successRate = successfulResults.length / totalMessages;
      
      // Latency assertions
      expect(avgLatency).toBeLessThan(LOAD_THRESHOLDS.MAX_WEBSOCKET_LATENCY);
      expect(p95Latency).toBeLessThan(LOAD_THRESHOLDS.MAX_WEBSOCKET_LATENCY * 2);
      expect(successRate).toBeGreaterThan(0.95);
      
      console.log('WebSocket latency results:', {
        totalMessages,
        successfulMessages: successfulResults.length,
        successRate: `${(successRate * 100).toFixed(1)}%`,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        p50Latency: `${p50Latency}ms`,
        p95Latency: `${p95Latency}ms`,
        p99Latency: `${p99Latency}ms`,
        maxLatency: `${maxLatency}ms`
      });
      
      // Cleanup
      await Promise.all(connections.map(ws => {
        ws.close();
        return new Promise(resolve => ws.on('close', resolve));
      }));
    });
  });
  
  describe('Team Permission System Performance', () => {
    it('should handle high-volume permission checks efficiently', async () => {
      const totalChecks = 10000;
      const concurrentChecks = 100;
      const batches = Math.ceil(totalChecks / concurrentChecks);
      
      console.log(`\nTesting ${totalChecks} permission checks in batches of ${concurrentChecks}...`);
      
      // Setup test teams and users
      const testTeams = await Promise.all(
        Array(20).fill(null).map(async (_, index) => {
          return teamService.createTeam({
            name: `Load Test Team ${index}`,
            description: 'Team for load testing',
            ownerId: `owner-${index}`,
            settings: {
              permissions: {
                'automation.create': ['OWNER', 'ADMIN', 'MANAGER'],
                'templates.edit': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
                'data.export': ['OWNER', 'ADMIN']
              }
            }
          });
        })
      );
      
      const permissionCheckLatencies: number[] = [];
      const errors: Error[] = [];
      
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now();
        const batchPromises: Promise<PermissionCheckResult>[] = [];
        
        for (let i = 0; i < concurrentChecks; i++) {
          const checkIndex = batch * concurrentChecks + i;
          const teamIndex = checkIndex % testTeams.length;
          const team = testTeams[teamIndex];
          
          batchPromises.push(
            measurePermissionCheck(
              teamService,
              `user-${checkIndex}`,
              team.id,
              'templates.edit'
            )
          );
        }
        
        const batchResults = await Promise.allSettled(batchPromises);
        const batchEnd = Date.now();
        
        // Process batch results
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            permissionCheckLatencies.push(result.value.latency);
          } else {
            errors.push(result.reason);
          }
        });
        
        const batchDuration = batchEnd - batchStart;
        const batchThroughput = concurrentChecks / (batchDuration / 1000);
        
        console.log(`Batch ${batch + 1}/${batches}: ${batchDuration}ms (${batchThroughput.toFixed(0)} checks/sec)`);\n        
        // Brief pause between batches
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Calculate performance metrics
      const avgLatency = permissionCheckLatencies.reduce((sum, lat) => sum + lat, 0) / permissionCheckLatencies.length;
      const sortedLatencies = permissionCheckLatencies.sort((a, b) => a - b);
      const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const maxLatency = Math.max(...permissionCheckLatencies);
      const errorRate = errors.length / totalChecks;
      
      // Performance assertions
      expect(avgLatency).toBeLessThan(LOAD_THRESHOLDS.MAX_PERMISSION_CHECK_LATENCY);
      expect(p95Latency).toBeLessThan(LOAD_THRESHOLDS.MAX_PERMISSION_CHECK_LATENCY * 2);
      expect(errorRate).toBeLessThan(LOAD_THRESHOLDS.MAX_ERROR_RATE);
      
      console.log('Permission system performance:', {
        totalChecks,
        successfulChecks: permissionCheckLatencies.length,
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        p95Latency: `${p95Latency.toFixed(2)}ms`,
        maxLatency: `${maxLatency.toFixed(2)}ms`
      });
      
      // Cleanup
      await Promise.all(testTeams.map(team => teamService.deleteTeam(team.id)));
    });
  });
  
  describe('Concurrent Template Editing Performance', () => {
    it('should handle simultaneous editing by multiple users', async () => {
      const concurrentEditors = 50;
      const editsPerUser = 20;
      const totalEdits = concurrentEditors * editsPerUser;
      const templateId = 'load-test-template';
      
      console.log(`\nTesting concurrent editing: ${concurrentEditors} users, ${editsPerUser} edits each...`);
      
      // Create test template
      const testTemplate = await templateService.createTemplate({
        name: 'Load Test Template',
        content: 'Initial template content for load testing. '.repeat(50), // ~2KB content
        type: 'connection_request',
        teamId: 'load-test-team',
        createdBy: 'load-test-owner'
      });
      
      // Establish WebSocket connections for all editors
      const editorConnections = await Promise.all(
        Array(concurrentEditors).fill(null).map(async (_, index) => {
          return loadTester.createConnection({
            url: 'ws://localhost:3007',
            headers: {
              'Authorization': `Bearer ${await generateTestJWT(index)}`,
              'X-Team-Id': 'load-test-team'
            }
          });
        })
      );
      
      const editLatencies: number[] = [];
      const conflictResolutions: ConflictResolutionResult[] = [];
      const editPromises: Promise<EditResult>[] = [];
      
      // Generate concurrent edits
      for (let userIndex = 0; userIndex < concurrentEditors; userIndex++) {
        for (let editIndex = 0; editIndex < editsPerUser; editIndex++) {
          const editPromise = loadTester.performConcurrentEdit(
            editorConnections[userIndex],
            {
              templateId: testTemplate.id,
              operation: {
                type: Math.random() > 0.7 ? 'delete' : 'insert',
                position: Math.floor(Math.random() * 1000),
                content: `Edit by user ${userIndex}, operation ${editIndex}`,
                length: Math.random() > 0.8 ? Math.floor(Math.random() * 50) : undefined
              },
              userId: `user-${userIndex}`,
              timestamp: Date.now() + editIndex * 100 // Stagger edits slightly
            }
          );
          
          editPromises.push(editPromise);
        }
      }
      
      console.log(`Executing ${totalEdits} concurrent edits...`);
      const editResults = await Promise.allSettled(editPromises);
      
      // Analyze edit results
      const successfulEdits = editResults
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<EditResult>).value);
      
      successfulEdits.forEach(result => {
        editLatencies.push(result.latency);
        if (result.conflictResolution) {
          conflictResolutions.push(result.conflictResolution);
        }
      });
      
      // Calculate performance metrics
      const avgEditLatency = editLatencies.reduce((sum, lat) => sum + lat, 0) / editLatencies.length;
      const sortedLatencies = editLatencies.sort((a, b) => a - b);
      const p95EditLatency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const editSuccessRate = successfulEdits.length / totalEdits;
      const conflictRate = conflictResolutions.length / successfulEdits.length;
      
      // Analyze conflict resolution performance
      const avgConflictResolutionTime = conflictResolutions.length > 0 
        ? conflictResolutions.reduce((sum, cr) => sum + cr.resolutionTime, 0) / conflictResolutions.length
        : 0;
      
      // Performance assertions
      expect(avgEditLatency).toBeLessThan(LOAD_THRESHOLDS.MAX_TEMPLATE_UPDATE_LATENCY);
      expect(p95EditLatency).toBeLessThan(LOAD_THRESHOLDS.MAX_TEMPLATE_UPDATE_LATENCY * 2);
      expect(editSuccessRate).toBeGreaterThan(0.95);
      expect(avgConflictResolutionTime).toBeLessThan(500); // Conflicts resolved within 500ms
      
      console.log('Concurrent editing performance:', {
        totalEdits,
        successfulEdits: successfulEdits.length,
        editSuccessRate: `${(editSuccessRate * 100).toFixed(1)}%`,
        avgEditLatency: `${avgEditLatency.toFixed(2)}ms`,
        p95EditLatency: `${p95EditLatency.toFixed(2)}ms`,
        conflictRate: `${(conflictRate * 100).toFixed(1)}%`,
        avgConflictResolutionTime: `${avgConflictResolutionTime.toFixed(2)}ms`,
        totalConflicts: conflictResolutions.length
      });
      
      // Verify template integrity after concurrent editing
      const finalTemplate = await templateService.getTemplate(testTemplate.id);
      expect(finalTemplate).toBeDefined();
      expect(finalTemplate.version).toBeGreaterThan(1); // Template was updated
      
      // Cleanup
      await Promise.all(editorConnections.map(ws => {
        ws.close();
        return new Promise(resolve => ws.on('close', resolve));
      }));
      
      await templateService.deleteTemplate(testTemplate.id);
    });
  });
  
  describe('System Resource Monitoring', () => {
    it('should maintain acceptable resource usage during peak load', async () => {
      const testDuration = 60; // seconds
      const usersPerSecond = 50;
      const totalUsers = testDuration * usersPerSecond;
      
      console.log(`\nMonitoring system resources during ${testDuration}s load test...`);
      
      // Start system monitoring
      performanceMonitor.startMonitoring({
        interval: 1000, // 1 second intervals
        metrics: ['cpu', 'memory', 'network', 'database']
      });
      
      const loadStartTime = Date.now();
      const userConnections: WebSocket[] = [];
      
      // Simulate realistic user behavior over time
      for (let second = 0; second < testDuration; second++) {
        const secondStart = Date.now();
        
        // Add new users this second
        const newUserPromises = Array(usersPerSecond).fill(null).map(async (_, index) => {
          const userId = second * usersPerSecond + index;
          
          try {
            // Establish WebSocket connection
            const connection = await loadTester.createConnection({
              url: 'ws://localhost:3007',
              headers: {
                'Authorization': `Bearer ${await generateTestJWT(userId)}`,
                'X-Team-Id': `team-${userId % 100}`
              }
            });
            
            userConnections.push(connection);
            
            // Simulate user activity
            await simulateRealisticUserActivity(connection, userId);
            
            return connection;
          } catch (error) {
            console.warn(`Failed to create user ${userId}:`, error.message);
            return null;
          }
        });
        
        await Promise.allSettled(newUserPromises);
        
        // Wait for the remainder of the second
        const elapsed = Date.now() - secondStart;
        const remaining = 1000 - elapsed;
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        
        console.log(`Second ${second + 1}/${testDuration}: ${userConnections.length} active connections`);
      }
      
      const loadEndTime = Date.now();
      const actualDuration = (loadEndTime - loadStartTime) / 1000;
      
      // Stop monitoring and get report
      const resourceReport = performanceMonitor.stopMonitoring();
      
      // Analyze resource usage
      const avgCpuUsage = resourceReport.cpu.reduce((sum, usage) => sum + usage, 0) / resourceReport.cpu.length;
      const maxCpuUsage = Math.max(...resourceReport.cpu);
      const avgMemoryUsage = resourceReport.memory.reduce((sum, usage) => sum + usage, 0) / resourceReport.memory.length;
      const maxMemoryUsage = Math.max(...resourceReport.memory);
      
      // Resource usage assertions
      expect(avgCpuUsage).toBeLessThan(LOAD_THRESHOLDS.MAX_CPU_UTILIZATION);
      expect(maxCpuUsage).toBeLessThan(LOAD_THRESHOLDS.MAX_CPU_UTILIZATION * 1.2); // Allow 20% spikes
      expect(avgMemoryUsage).toBeLessThan(LOAD_THRESHOLDS.MAX_MEMORY_USAGE);
      expect(maxMemoryUsage).toBeLessThan(LOAD_THRESHOLDS.MAX_MEMORY_USAGE * 1.1); // Allow 10% spikes
      
      console.log('System resource usage:', {
        testDuration: `${actualDuration.toFixed(1)}s`,
        peakConnections: userConnections.length,
        avgCpuUsage: `${(avgCpuUsage * 100).toFixed(1)}%`,
        maxCpuUsage: `${(maxCpuUsage * 100).toFixed(1)}%`,
        avgMemoryUsage: `${avgMemoryUsage.toFixed(0)} MB`,
        maxMemoryUsage: `${maxMemoryUsage.toFixed(0)} MB`,
        networkThroughput: `${resourceReport.networkThroughput.toFixed(2)} MB/s`,
        databaseConnections: resourceReport.databaseConnections
      });
      
      // Cleanup all connections
      await Promise.all(userConnections.map(ws => {
        ws.close();
        return new Promise(resolve => ws.on('close', resolve));
      }));
    });
  });
});

// Helper functions
async function generateTestJWT(userId: number): Promise<string> {
  // Mock JWT generation for testing
  return `test-jwt-token-${userId}`;
}

async function measurePermissionCheck(
  teamService: TeamService,
  userId: string,
  teamId: string,
  permission: string
): Promise<PermissionCheckResult> {
  const start = Date.now();
  
  try {
    const hasPermission = await teamService.checkPermission(userId, teamId, permission);
    const end = Date.now();
    
    return {
      userId,
      permission,
      hasPermission,
      latency: end - start,
      success: true
    };
  } catch (error) {
    const end = Date.now();
    
    return {
      userId,
      permission,
      hasPermission: false,
      latency: end - start,
      success: false,
      error: error.message
    };
  }
}

async function simulateRealisticUserActivity(connection: WebSocket, userId: number): Promise<void> {
  const activities = [
    'VIEW_TEMPLATE',
    'EDIT_TEMPLATE',
    'CREATE_COMMENT',
    'UPDATE_PROFILE',
    'VIEW_ANALYTICS'
  ];
  
  const activity = activities[Math.floor(Math.random() * activities.length)];
  
  const message = {
    type: activity,
    data: {
      userId: `user-${userId}`,
      timestamp: Date.now(),
      metadata: { source: 'load-test' }
    }
  };
  
  if (connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
  }
}

// Type definitions
interface ConnectionMetrics {
  batch: number;
  connectionsCount: number;
  duration: number;
  avgConnectionTime: number;
  successRate: number;
}

interface MessageLatencyResult {
  messageId: string;
  latency: number;
  success: boolean;
}

interface PermissionCheckResult {
  userId: string;
  permission: string;
  hasPermission: boolean;
  latency: number;
  success: boolean;
  error?: string;
}

interface EditResult {
  editId: string;
  latency: number;
  success: boolean;
  conflictResolution?: ConflictResolutionResult;
}

interface ConflictResolutionResult {
  conflictType: string;
  resolutionStrategy: string;
  resolutionTime: number;
  affectedOperations: number;
}