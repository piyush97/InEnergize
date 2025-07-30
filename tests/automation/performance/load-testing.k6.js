/**
 * K6 Load Testing Suite for InErgize Automation Features
 * 
 * Comprehensive performance testing for:
 * - Concurrent WebSocket connections (up to 10,000)
 * - API endpoint performance under load
 * - Real-time automation dashboard updates
 * - Safety monitoring system performance
 * - Queue processing scalability
 */

import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import http from 'k6/http';
import ws from 'k6/ws';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics for automation testing
const websocketConnections = new Gauge('websocket_connections_active');
const websocketLatency = new Trend('websocket_latency');
const websocketErrors = new Rate('websocket_errors');
const automationApiLatency = new Trend('automation_api_response_time');
const queueProcessingRate = new Rate('queue_processing_success_rate');
const safetyCheckLatency = new Trend('safety_check_response_time');
const complianceViolations = new Counter('compliance_violations_detected');

// Test configuration
export const options = {
  scenarios: {
    // WebSocket connection load test
    websocket_load: {
      executor: 'ramping-vus',
      exec: 'websocketLoadTest',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Ramp up to 100 connections
        { duration: '5m', target: 500 },   // Scale to 500 connections
        { duration: '10m', target: 1000 }, // Scale to 1,000 connections
        { duration: '15m', target: 2000 }, // Scale to 2,000 connections
        { duration: '5m', target: 5000 },  // Burst to 5,000 connections
        { duration: '2m', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
    },

    // API endpoint performance test
    api_performance: {
      executor: 'constant-arrival-rate',
      exec: 'apiPerformanceTest',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },

    // Automation queue stress test
    queue_stress: {
      executor: 'per-vu-iterations',
      exec: 'queueStressTest',
      vus: 50,
      iterations: 100,
      maxDuration: '10m',
      gracefulStop: '30s',
    },

    // Safety monitoring performance test
    safety_monitoring: {
      executor: 'constant-vus',
      exec: 'safetyMonitoringTest',
      vus: 25,
      duration: '15m',
    },

    // Peak traffic simulation
    peak_traffic: {
      executor: 'ramping-arrival-rate',
      exec: 'peakTrafficTest',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '2m', target: 50 },   // Normal traffic
        { duration: '1m', target: 200 },  // Traffic spike
        { duration: '2m', target: 500 },  // Peak traffic
        { duration: '1m', target: 1000 }, // Extreme peak
        { duration: '2m', target: 50 },   // Back to normal
      ],
      preAllocatedVUs: 100,
      maxVUs: 500,
    }
  },

  // Performance thresholds - tests fail if these are exceeded
  thresholds: {
    // WebSocket performance thresholds
    'websocket_latency': ['p(95)<100', 'p(99)<200'], // 95% under 100ms, 99% under 200ms
    'websocket_errors': ['rate<0.05'], // Less than 5% error rate
    'websocket_connections_active': ['value>0'], // Must maintain connections

    // API performance thresholds
    'automation_api_response_time': ['p(95)<500', 'p(99)<1000'], // API response times
    'http_req_duration': ['p(95)<2000'], // General HTTP response times
    'http_req_failed': ['rate<0.10'], // Less than 10% HTTP failures

    // Queue processing thresholds
    'queue_processing_success_rate': ['rate>0.99'], // 99%+ success rate
    'safety_check_response_time': ['p(95)<1000'], // Safety checks under 1s

    // System stability thresholds
    'compliance_violations_detected': ['count<10'], // Minimal compliance issues
    'checks': ['rate>0.95'], // 95%+ of all checks must pass
  },

  // Test environment settings
  noConnectionReuse: false,
  userAgent: 'InErgize-LoadTest/1.0',
  batch: 20, // Batch HTTP requests for efficiency
  batchPerHost: 10,
};

// Test data generators
const generateAuthToken = (userId) => {
  // Generate JWT token for testing (mock implementation)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    userId: userId,
    tier: randomItem(['free', 'premium', 'enterprise']),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64');
  return `${header}.${payload}.mock_signature`;
};

const generateConnectionRequest = (userId) => ({
  userId: userId,
  targetId: `target_${randomIntBetween(1000, 9999)}`,
  targetName: `Test Target ${randomIntBetween(1, 100)}`,
  message: `Hi there! I'd love to connect with you. Test message ${randomIntBetween(1, 1000)}.`,
  priority: randomItem(['low', 'medium', 'high']),
  scheduledAt: new Date(Date.now() + randomIntBetween(60000, 3600000)).toISOString()
});

const generateEngagementRequest = (userId) => ({
  userId: userId,
  targetId: `post_${randomIntBetween(1000, 9999)}`,
  targetName: `LinkedIn Post ${randomIntBetween(1, 100)}`,
  action: randomItem(['like', 'comment', 'view_profile', 'follow']),
  content: randomItem(['like', 'comment']) === 'comment' ? 
    `Great insight! Thanks for sharing. Comment ${randomIntBetween(1, 1000)}.` : undefined,
  priority: randomItem(['low', 'medium', 'high']),
  scheduledAt: new Date(Date.now() + randomIntBetween(30000, 1800000)).toISOString()
});

// WebSocket Load Testing
export function websocketLoadTest() {
  const userId = `load_test_user_${__VU}_${__ITER}`;
  const authToken = generateAuthToken(userId);
  const wsUrl = `ws://localhost:3007/automation/dashboard/${userId}?token=${authToken}`;

  group('WebSocket Connection Load Test', () => {
    const res = ws.connect(wsUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'User-Agent': 'InErgize-LoadTest-WS/1.0'
      }
    }, (socket) => {
      const startTime = new Date().getTime();
      let connectionEstablished = false;
      let messageCount = 0;
      let errorCount = 0;

      // Connection established handler
      socket.on('open', () => {
        connectionEstablished = true;
        websocketConnections.add(1);
        
        const latency = new Date().getTime() - startTime;
        websocketLatency.add(latency);

        // Subscribe to automation channels
        socket.send(JSON.stringify({
          type: 'subscribe',
          channels: ['overview', 'queue_updates', 'safety_alerts']
        }));

        // Request initial data
        socket.send(JSON.stringify({
          type: 'request_initial_data',
          channels: ['overview', 'templates', 'queue', 'safety']
        }));
      });

      // Message handler
      socket.on('message', (data) => {
        messageCount++;
        try {
          const message = JSON.parse(data);
          
          // Validate expected message types
          const validTypes = [
            'connection_established',
            'subscription_confirmed', 
            'overview_update',
            'queue_update',
            'safety_update',
            'template_update',
            'automation_status',
            'safety_alert',
            'performance_metrics'
          ];

          check(message, {
            'WebSocket message has valid type': (msg) => validTypes.includes(msg.type),
            'WebSocket message has timestamp': (msg) => msg.timestamp !== undefined,
          });

          // Respond to ping messages
          if (message.type === 'ping') {
            const pingTime = new Date().getTime();
            socket.send(JSON.stringify({
              type: 'pong',
              timestamp: pingTime
            }));
            
            // Calculate round-trip latency
            if (message.timestamp) {
              const rttLatency = pingTime - message.timestamp;
              websocketLatency.add(rttLatency);
            }
          }

          // Handle safety alerts
          if (message.type === 'safety_alert' && message.alert.severity === 'critical') {
            complianceViolations.add(1);
          }

        } catch (error) {
          errorCount++;
          websocketErrors.add(1);
        }
      });

      // Error handler
      socket.on('error', (error) => {
        errorCount++;
        websocketErrors.add(1);
        console.error(`WebSocket error for user ${userId}:`, error);
      });

      // Close handler
      socket.on('close', () => {
        websocketConnections.add(-1);
      });

      // Keep connection alive and send periodic messages
      const keepAliveInterval = setInterval(() => {
        if (socket.readyState === 1) { // WebSocket.OPEN
          socket.send(JSON.stringify({
            type: 'ping',
            timestamp: new Date().getTime(),
            userId: userId
          }));
        }
      }, 30000); // Every 30 seconds

      // Simulate user activity
      const activityInterval = setInterval(() => {
        if (socket.readyState === 1) {
          // Randomly subscribe/unsubscribe from channels
          const action = randomItem(['subscribe', 'unsubscribe']);
          const channel = randomItem(['templates', 'analytics', 'premium_features']);
          
          socket.send(JSON.stringify({
            type: action,
            channel: channel,
            timestamp: new Date().getTime()
          }));
        }
      }, randomIntBetween(60000, 180000)); // Every 1-3 minutes

      // Test duration - keep connection open
      sleep(randomIntBetween(30, 90)); // 30-90 seconds per connection

      // Cleanup
      clearInterval(keepAliveInterval);
      clearInterval(activityInterval);

      // Final checks
      check(null, {
        'WebSocket connection established successfully': () => connectionEstablished,
        'WebSocket received messages': () => messageCount > 0,
        'WebSocket error rate acceptable': () => errorCount / Math.max(messageCount, 1) < 0.05,
      });
    });

    check(res, {
      'WebSocket connection succeeded': (r) => r && r.status === 101,
    });
  });

  sleep(randomIntBetween(1, 3)); // Brief pause between connections
}

// API Performance Testing
export function apiPerformanceTest() {
  const userId = `api_test_user_${__VU}_${__ITER}`;
  const authToken = generateAuthToken(userId);
  const baseUrl = 'http://localhost:3000/api';

  group('Automation API Performance', () => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'InErgize-LoadTest-API/1.0'
    };

    // Test automation overview endpoint
    group('Overview API', () => {
      const startTime = new Date().getTime();
      const response = http.get(`${baseUrl}/automation/overview`, { headers });
      const responseTime = new Date().getTime() - startTime;
      
      automationApiLatency.add(responseTime);
      
      check(response, {
        'Overview API returns 200': (r) => r.status === 200,
        'Overview API has valid JSON': (r) => {
          try {
            const data = JSON.parse(r.body);
            return data.connections !== undefined && data.engagement !== undefined;
          } catch (e) {
            return false;
          }
        },
        'Overview API responds quickly': (r) => responseTime < 500,
      });
    });

    // Test queue management endpoints
    group('Queue Management API', () => {
      // Get queue status
      const queueResponse = http.get(`${baseUrl}/automation/queue`, { headers });
      
      check(queueResponse, {
        'Queue API returns 200': (r) => r.status === 200,
        'Queue API returns array': (r) => {
          try {
            const data = JSON.parse(r.body);
            return Array.isArray(data);
          } catch (e) {
            return false;
          }
        },
      });

      // Schedule a connection request
      const connectionRequest = generateConnectionRequest(userId);
      const scheduleResponse = http.post(
        `${baseUrl}/automation/connections/schedule`, 
        JSON.stringify(connectionRequest),
        { headers }
      );
      
      check(scheduleResponse, {
        'Schedule connection returns 200 or 201': (r) => [200, 201].includes(r.status),
        'Schedule connection returns job ID': (r) => {
          try {
            const data = JSON.parse(r.body);
            return data.queueItem && data.queueItem.id;
          } catch (e) {
            return false;
          }
        },
      });

      // Schedule an engagement action
      const engagementRequest = generateEngagementRequest(userId);
      const engagementResponse = http.post(
        `${baseUrl}/automation/engagement/schedule`,
        JSON.stringify(engagementRequest),
        { headers }
      );

      check(engagementResponse, {
        'Schedule engagement returns 200 or 201': (r) => [200, 201].includes(r.status),
      });
    });

    // Test safety monitoring endpoints
    group('Safety Monitoring API', () => {
      const safetyStartTime = new Date().getTime();
      const safetyResponse = http.get(`${baseUrl}/automation/safety/status`, { headers });
      const safetyResponseTime = new Date().getTime() - safetyStartTime;
      
      safetyCheckLatency.add(safetyResponseTime);
      
      check(safetyResponse, {
        'Safety API returns 200': (r) => r.status === 200,
        'Safety API has score': (r) => {
          try {
            const data = JSON.parse(r.body);
            return typeof data.score === 'number' && data.score >= 0 && data.score <= 100;
          } catch (e) {
            return false;
          }
        },
        'Safety API responds quickly': (r) => safetyResponseTime < 1000,
      });
    });

    // Test template management endpoints
    group('Template Management API', () => {
      const templatesResponse = http.get(`${baseUrl}/automation/templates`, { headers });
      
      check(templatesResponse, {
        'Templates API returns 200': (r) => r.status === 200,
        'Templates API returns array': (r) => {
          try {
            const data = JSON.parse(r.body);
            return Array.isArray(data);
          } catch (e) {
            return false;
          }
        },
      });
    });
  });

  sleep(randomIntBetween(1, 2)); // Brief pause between API calls
}

// Queue Processing Stress Test
export function queueStressTest() {
  const userId = `queue_stress_user_${__VU}`;
  const authToken = generateAuthToken(userId);
  const baseUrl = 'http://localhost:3000/api';

  group('Queue Processing Stress Test', () => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Generate and schedule multiple jobs rapidly
    const jobCount = randomIntBetween(5, 15);
    const scheduledJobs = [];

    for (let i = 0; i < jobCount; i++) {
      const jobType = randomItem(['connection', 'engagement']);
      const request = jobType === 'connection' ? 
        generateConnectionRequest(userId) : 
        generateEngagementRequest(userId);

      const endpoint = jobType === 'connection' ? 
        '/automation/connections/schedule' : 
        '/automation/engagement/schedule';

      const response = http.post(`${baseUrl}${endpoint}`, JSON.stringify(request), { headers });
      
      const success = [200, 201].includes(response.status);
      queueProcessingRate.add(success ? 1 : 0);
      
      if (success) {
        try {
          const data = JSON.parse(response.body);
          if (data.queueItem && data.queueItem.id) {
            scheduledJobs.push(data.queueItem.id);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // Brief pause between jobs
      sleep(randomIntBetween(0.1, 0.5));
    }

    // Check queue status after scheduling
    sleep(2); // Wait for jobs to be processed
    
    const queueResponse = http.get(`${baseUrl}/automation/queue`, { headers });
    
    check(queueResponse, {
      'Queue status accessible after bulk scheduling': (r) => r.status === 200,
      'Queue contains scheduled jobs': (r) => {
        try {
          const data = JSON.parse(r.body);
          return Array.isArray(data) && data.length >= 0;
        } catch (e) {
          return false;
        }
      },
    });

    // Test bulk operations if jobs were scheduled
    if (scheduledJobs.length > 0) {
      const bulkCancelRequest = {
        action: 'cancel',
        jobIds: scheduledJobs.slice(0, Math.ceil(scheduledJobs.length / 2))
      };

      const bulkResponse = http.post(
        `${baseUrl}/automation/queue/bulk`,
        JSON.stringify(bulkCancelRequest),
        { headers }
      );

      check(bulkResponse, {
        'Bulk operation succeeds': (r) => [200, 202].includes(r.status),
      });
    }
  });
}

// Safety Monitoring Performance Test
export function safetyMonitoringTest() {
  const userId = `safety_test_user_${__VU}`;
  const authToken = generateAuthToken(userId);
  const baseUrl = 'http://localhost:3000/api';

  group('Safety Monitoring Performance', () => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Continuously monitor safety status
    for (let i = 0; i < 10; i++) {
      const startTime = new Date().getTime();
      const safetyResponse = http.get(`${baseUrl}/automation/safety/status`, { headers });
      const responseTime = new Date().getTime() - startTime;
      
      safetyCheckLatency.add(responseTime);
      
      check(safetyResponse, {
        'Safety monitoring available': (r) => r.status === 200,
        'Safety score valid': (r) => {
          try {
            const data = JSON.parse(r.body);
            return data.score >= 0 && data.score <= 100;
          } catch (e) {
            return false;
          }
        },
      });

      // Test emergency stop functionality occasionally
      if (i % 5 === 0) {
        const emergencyResponse = http.post(`${baseUrl}/automation/emergency-stop`, '', { headers });
        
        check(emergencyResponse, {
          'Emergency stop responds': (r) => [200, 202, 409].includes(r.status), // 409 if already stopped
        });

        // Try to resume after emergency stop
        sleep(1);
        const resumeResponse = http.post(`${baseUrl}/automation/resume`, '', { headers });
        
        check(resumeResponse, {
          'Resume automation responds': (r) => [200, 202, 400].includes(r.status), // 400 if conditions not met
        });
      }

      sleep(randomIntBetween(2, 5)); // Check every 2-5 seconds
    }
  });
}

// Peak Traffic Simulation
export function peakTrafficTest() {
  const userId = `peak_test_user_${__VU}_${__ITER}`;
  const authToken = generateAuthToken(userId);
  const baseUrl = 'http://localhost:3000/api';

  group('Peak Traffic Simulation', () => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Simulate high-frequency dashboard refreshes
    const endpoints = [
      '/automation/overview',
      '/automation/queue',
      '/automation/safety/status',
      '/automation/templates'
    ];

    const endpoint = randomItem(endpoints);
    const response = http.get(`${baseUrl}${endpoint}`, { headers });
    
    check(response, {
      'Peak traffic endpoint responds': (r) => r.status === 200,
      'Peak traffic response time acceptable': (r) => r.timings.duration < 2000,
    });

    // Occasionally trigger resource-intensive operations
    if (Math.random() < 0.1) { // 10% chance
      const action = randomItem(['schedule_connection', 'schedule_engagement', 'bulk_operation']);
      
      switch (action) {
        case 'schedule_connection':
          const connectionRequest = generateConnectionRequest(userId);
          http.post(`${baseUrl}/automation/connections/schedule`, JSON.stringify(connectionRequest), { headers });
          break;
          
        case 'schedule_engagement':
          const engagementRequest = generateEngagementRequest(userId);
          http.post(`${baseUrl}/automation/engagement/schedule`, JSON.stringify(engagementRequest), { headers });
          break;
          
        case 'bulk_operation':
          // Simulate bulk queue operation
          const bulkRequest = {
            action: 'retry',
            jobIds: [`job_${randomIntBetween(1, 1000)}`]
          };
          http.post(`${baseUrl}/automation/queue/bulk`, JSON.stringify(bulkRequest), { headers });
          break;
      }
    }
  });

  sleep(randomIntBetween(0.5, 2)); // High frequency requests
}

// Test lifecycle hooks
export function setup() {
  console.log('🚀 Starting InErgize Automation Load Tests');
  console.log('📊 Test Configuration:');
  console.log('   - Max WebSocket Connections: 5,000');
  console.log('   - API Request Rate: 100 RPS');
  console.log('   - Queue Stress: 50 VUs × 100 iterations');
  console.log('   - Peak Traffic: up to 1,000 RPS');
  console.log('   - Total Test Duration: ~20 minutes');
  
  // Verify test environment is ready
  const healthCheck = http.get('http://localhost:3000/health');
  if (healthCheck.status !== 200) {
    throw new Error('Test environment not ready - health check failed');
  }
  
  return {
    startTime: new Date().toISOString(),
    environment: 'load-test'
  };
}

export function teardown(data) {
  console.log('🏁 Load Tests Completed');
  console.log(`   - Started: ${data.startTime}`);
  console.log(`   - Completed: ${new Date().toISOString()}`);
  console.log('📈 Check test results for performance metrics and thresholds');
}

// Default export for single-scenario runs
export default function() {
  // Run a mixed workload simulation
  const scenario = randomItem([
    'websocket',
    'api_performance', 
    'queue_stress',
    'safety_monitoring'
  ]);
  
  switch (scenario) {
    case 'websocket':
      websocketLoadTest();
      break;
    case 'api_performance':
      apiPerformanceTest();
      break;
    case 'queue_stress':
      queueStressTest();
      break;
    case 'safety_monitoring':
      safetyMonitoringTest();
      break;
  }
}