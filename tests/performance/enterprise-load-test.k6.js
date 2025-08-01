/**
 * Enterprise-Grade Load Testing Suite for InErgize Platform
 * 
 * This k6 script provides comprehensive load testing covering:
 * - Realistic user scenarios and workflows
 * - Enterprise-scale concurrent user simulation (10,000+ users)
 * - Production-like data patterns and API usage
 * - LinkedIn API integration performance under load
 * - WebSocket connection stability testing
 * - Database performance under high concurrent load
 * - Automation safety monitoring under stress
 * - Mobile API performance simulation
 * 
 * Performance Targets:
 * - 10,000+ concurrent users
 * - API p95 <200ms
 * - Error rate <0.1%
 * - WebSocket latency <100ms
 * - 99.9% uptime during load
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics for enterprise monitoring
const errorRate = new Rate('error_rate');
const responseTimeP95 = new Trend('response_time_p95');
const responseTimeP99 = new Trend('response_time_p99');
const apiCallsTotal = new Counter('api_calls_total');
const authFailures = new Counter('auth_failures');
const linkedinApiCalls = new Counter('linkedin_api_calls');
const websocketConnections = new Gauge('websocket_connections');
const automationSafetyChecks = new Counter('automation_safety_checks');
const databaseOperations = new Counter('database_operations');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

// Enterprise load test configuration
export const options = {
  scenarios: {
    // Warm-up phase - gradual ramp-up
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Warm-up to 50 users
        { duration: '3m', target: 100 },  // Ramp to 100 users
        { duration: '2m', target: 50 },   // Ramp down
        { duration: '1m', target: 0 },    // Cool down
      ],
      exec: 'warmupScenario',
    },
    
    // Main load test - enterprise scale
    enterprise_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 500 },    // Ramp-up
        { duration: '10m', target: 2000 },  // Scale up
        { duration: '15m', target: 5000 },  // Heavy load
        { duration: '10m', target: 8000 },  // Peak load
        { duration: '5m', target: 10000 },  // Enterprise peak
        { duration: '15m', target: 10000 }, // Sustained load
        { duration: '10m', target: 5000 },  // Ramp down
        { duration: '5m', target: 1000 },   // Cool down
        { duration: '3m', target: 0 },      // Complete
      ],
      exec: 'enterpriseLoadScenario',
    },
    
    // Stress test - breaking point
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 5000 },   // Quick ramp
        { duration: '5m', target: 15000 },  // Beyond capacity
        { duration: '5m', target: 20000 },  // Stress test
        { duration: '2m', target: 25000 },  // Breaking point
        { duration: '5m', target: 0 },      // Recovery
      ],
      exec: 'stressTestScenario',
    },
    
    // WebSocket sustained connections
    websocket_load: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '30m',
      exec: 'websocketScenario',
    },
    
    // Mobile API simulation
    mobile_simulation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 200 },
        { duration: '10m', target: 1000 },
        { duration: '10m', target: 1500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      exec: 'mobileScenario',
    },
  },
  
  // Performance thresholds - enterprise SLA
  thresholds: {
    http_req_duration: [
      'p(95)<200',  // 95% of requests under 200ms
      'p(99)<500',  // 99% of requests under 500ms
    ],
    http_req_failed: ['rate<0.001'], // Less than 0.1% failure rate
    error_rate: ['rate<0.001'],
    response_time_p95: ['p(95)<200'],
    response_time_p99: ['p(99)<500'],
    websocket_connections: ['value>800'], // Maintain 800+ WS connections
    'group_duration{group:::Authentication Flow}': ['p(95)<3000'],
    'group_duration{group:::Profile Management}': ['p(95)<2000'],
    'group_duration{group:::Content Operations}': ['p(95)<4000'],
    'group_duration{group:::Analytics Dashboard}': ['p(95)<5000'],
    'group_duration{group:::Automation Management}': ['p(95)<3000'],
  },
  
  // External monitoring integration
  ext: {
    loadimpact: {
      projectID: 3596346,
      name: 'InErgize Enterprise Load Test',
      note: 'Comprehensive enterprise-scale performance testing',
    },
  },
};

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const API_BASE = __ENV.API_URL || 'http://localhost:8000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3007';
const TEST_DATA_SIZE = __ENV.TEST_DATA_SIZE || 'large'; // small, medium, large, enterprise

// Test data pools - enterprise scale
const TEST_USERS = generateTestUsers(10000); // 10K test users
const CONTENT_TEMPLATES = generateContentTemplates(500);
const LINKEDIN_PROFILES = generateLinkedInProfiles(1000);
const AUTOMATION_TEMPLATES = generateAutomationTemplates(200);

// Realistic user behavior patterns
const USER_BEHAVIOR_PATTERNS = {
  power_user: { weight: 10, sessionDuration: 1800, actionsPerMinute: 8 },
  regular_user: { weight: 60, sessionDuration: 900, actionsPerMinute: 4 },
  casual_user: { weight: 25, sessionDuration: 300, actionsPerMinute: 2 },
  enterprise_admin: { weight: 5, sessionDuration: 3600, actionsPerMinute: 12 }
};

/**
 * Warm-up scenario - system preparation
 */
export function warmupScenario() {
  group('System Warm-up', () => {
    // Health check
    const healthResponse = http.get(`${API_BASE}/health`);
    check(healthResponse, {
      'health check passes': (r) => r.status === 200,
      'health response time OK': (r) => r.timings.duration < 1000,
    });
    
    // Database warm-up
    const dbWarmup = http.get(`${API_BASE}/api/users/profile`, {
      headers: getAuthHeaders(getRandomUser()),
    });
    check(dbWarmup, { 'DB warm-up OK': (r) => r.status === 200 });
    
    // Cache warm-up
    const cacheWarmup = http.get(`${API_BASE}/api/content/templates`);
    check(cacheWarmup, { 'Cache warm-up OK': (r) => r.status === 200 });
    
    sleep(randomIntBetween(1, 3));
  });
}

/**
 * Enterprise load scenario - main performance test
 */
export function enterpriseLoadScenario() {
  const user = getRandomUser();
  const userBehavior = selectUserBehavior();
  const sessionStartTime = Date.now();
  
  // Authenticate user
  const authResult = authenticateUser(user);
  if (!authResult.success) {
    authFailures.add(1);
    return;
  }
  
  // Main user session based on behavior pattern
  const sessionActions = calculateSessionActions(userBehavior);
  
  for (let action = 0; action < sessionActions; action++) {
    const scenario = selectScenario();
    
    switch (scenario) {
      case 'profile_management':
        profileManagementFlow(authResult.token);
        break;
      case 'content_operations':
        contentOperationsFlow(authResult.token);
        break;
      case 'analytics_dashboard':
        analyticsDashboardFlow(authResult.token);
        break;
      case 'automation_management':
        automationManagementFlow(authResult.token);
        break;
      case 'linkedin_integration':
        linkedinIntegrationFlow(authResult.token);
        break;
      default:
        basicNavigationFlow(authResult.token);
    }
    
    // Realistic think time between actions
    sleep(randomIntBetween(2, 8));
    
    // Check if session should end
    const sessionDuration = (Date.now() - sessionStartTime) / 1000;
    if (sessionDuration > userBehavior.sessionDuration) {
      break;
    }
  }
}

/**
 * Stress test scenario - beyond normal capacity
 */
export function stressTestScenario() {
  const user = getRandomUser();
  
  // Rapid-fire authentication
  const authResult = authenticateUser(user);
  if (!authResult.success) return;
  
  // Aggressive API usage pattern
  group('Stress Test Operations', () => {
    // Concurrent API calls
    const requests = [
      ['GET', '/api/users/profile'],
      ['GET', '/api/content?limit=50'],
      ['GET', '/api/v1/metrics/profile?period=7d'],
      ['GET', '/api/automation/templates'],
      ['GET', '/api/v1/linkedin/profile'],
    ];
    
    requests.forEach(([method, endpoint]) => {
      const response = http.request(method, `${API_BASE}${endpoint}`, null, {
        headers: getAuthHeaders({ token: authResult.token }),
        timeout: '10s',
      });
      
      apiCallsTotal.add(1);
      responseTimeP95.add(response.timings.duration);
      responseTimeP99.add(response.timings.duration);
      
      if (response.status >= 400) {
        errorRate.add(1);
      }
    });
  });
  
  // Minimal think time for stress
  sleep(randomIntBetween(0.1, 0.5));
}

/**
 * WebSocket scenario - sustained real-time connections
 */
export function websocketScenario() {
  const user = getRandomUser();
  const authResult = authenticateUser(user);
  if (!authResult.success) return;
  
  const wsUrl = `${WS_URL}?token=${authResult.token}`;
  
  const response = ws.connect(wsUrl, {
    headers: { Authorization: `Bearer ${authResult.token}` },
  }, function (socket) {
    websocketConnections.add(1);
    
    socket.on('open', () => {
      console.log('WebSocket connection established');
      
      // Subscribe to real-time metrics
      socket.send(JSON.stringify({
        type: 'SUBSCRIBE',
        channels: ['metrics', 'automation_updates', 'safety_monitoring']
      }));
    });
    
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      
      // Simulate realistic WebSocket interactions
      if (message.type === 'METRICS_UPDATE') {
        // Acknowledge metrics update
        socket.send(JSON.stringify({
          type: 'METRICS_ACK',
          messageId: message.id,
          timestamp: Date.now()
        }));
      }
      
      if (message.type === 'SAFETY_ALERT') {
        automationSafetyChecks.add(1);
        // Respond to safety alert
        socket.send(JSON.stringify({
          type: 'SAFETY_RESPONSE',
          alertId: message.alertId,
          action: 'acknowledge'
        }));
      }
    });
    
    socket.on('error', (e) => {
      console.log('WebSocket error:', e);
      errorRate.add(1);
    });
    
    // Send periodic heartbeat and activity
    const heartbeatInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'HEARTBEAT',
          timestamp: Date.now(),
          userId: user.id
        }));
        
        // Simulate user activity
        if (Math.random() < 0.3) {
          socket.send(JSON.stringify({
            type: 'USER_ACTIVITY',
            action: randomItem(['view_template', 'edit_profile', 'check_metrics']),
            timestamp: Date.now()
          }));
        }
      }
    }, 30000); // Every 30 seconds
    
    // Keep connection alive for test duration
    sleep(1800); // 30 minutes
    
    clearInterval(heartbeatInterval);
    websocketConnections.add(-1);
  });
  
  check(response, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });
}

/**
 * Mobile scenario - mobile API usage patterns
 */
export function mobileScenario() {
  const user = getRandomUser();
  
  // Mobile-specific headers
  const mobileHeaders = {
    'User-Agent': 'InErgize-Mobile/1.0 (iOS 15.0; iPhone13,2)',
    'X-Platform': 'mobile',
    'X-App-Version': '1.0.0',
  };
  
  group('Mobile Authentication', () => {
    const authResponse = http.post(`${API_BASE}/api/auth/mobile/login`, {
      email: user.email,
      password: user.password,
      deviceId: user.deviceId,
      pushToken: user.pushToken,
    }, { headers: mobileHeaders });
    
    const authCheck = check(authResponse, {
      'mobile auth success': (r) => r.status === 200,
      'mobile auth response time': (r) => r.timings.duration < 1000,
    });
    
    if (!authCheck) {
      authFailures.add(1);
      return;
    }
    
    const authData = JSON.parse(authResponse.body);
    mobileHeaders['Authorization'] = `Bearer ${authData.accessToken}`;
  });
  
  // Mobile-optimized API calls
  group('Mobile Profile Sync', () => {
    const profileResponse = http.get(`${API_BASE}/api/mobile/profile/sync`, {
      headers: mobileHeaders,
    });
    
    check(profileResponse, {
      'mobile profile sync': (r) => r.status === 200,
      'mobile profile size': (r) => r.body.length < 50000, // <50KB
    });
    
    apiCallsTotal.add(1);
    responseTimeP95.add(profileResponse.timings.duration);
  });
  
  group('Mobile Content Feed', () => {
    const feedResponse = http.get(`${API_BASE}/api/mobile/content/feed?page=1&limit=20`, {
      headers: mobileHeaders,
    });
    
    check(feedResponse, {
      'mobile feed load': (r) => r.status === 200,
      'mobile feed response time': (r) => r.timings.duration < 2000,
    });
    
    apiCallsTotal.add(1);
  });
  
  // Mobile-specific behavior - shorter sessions, more frequent
  sleep(randomIntBetween(5, 15));
}

/**
 * Profile Management Flow
 */
function profileManagementFlow(token) {
  group('Profile Management', () => {
    // Get current profile
    const profileResponse = http.get(`${API_BASE}/api/users/profile`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(profileResponse, {
      'profile load success': (r) => r.status === 200,
      'profile load time': (r) => r.timings.duration < 500,
    });
    
    apiCallsTotal.add(1);
    databaseOperations.add(1);
    
    // Update profile (30% of users)
    if (Math.random() < 0.3) {
      const updateData = {
        firstName: `LoadTest${randomIntBetween(1, 10000)}`,
        bio: `Updated bio at ${Date.now()}`,
        skills: randomItem(CONTENT_TEMPLATES).skills,
      };
      
      const updateResponse = http.put(`${API_BASE}/api/users/profile`, 
        JSON.stringify(updateData), 
        { headers: getAuthHeaders({ token }) }
      );
      
      check(updateResponse, {
        'profile update success': (r) => r.status === 200,
        'profile update time': (r) => r.timings.duration < 1000,
      });
      
      apiCallsTotal.add(1);
      databaseOperations.add(1);
    }
    
    // LinkedIn profile sync (20% of users)
    if (Math.random() < 0.2) {
      const linkedinSync = http.post(`${API_BASE}/api/v1/linkedin/sync`, null, {
        headers: getAuthHeaders({ token }),
      });
      
      check(linkedinSync, {
        'linkedin sync success': (r) => r.status === 200 || r.status === 202,
        'linkedin sync time': (r) => r.timings.duration < 2000,
      });
      
      linkedinApiCalls.add(1);
    }
  });
}

/**
 * Content Operations Flow
 */
function contentOperationsFlow(token) {
  group('Content Operations', () => {
    // List content templates
    const templatesResponse = http.get(`${API_BASE}/api/content/templates?limit=20`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(templatesResponse, {
      'templates load success': (r) => r.status === 200,
      'templates load time': (r) => r.timings.duration < 800,
    });
    
    apiCallsTotal.add(1);
    
    // Check cache efficiency
    const cacheHeader = templatesResponse.headers['X-Cache-Status'];
    if (cacheHeader === 'HIT') {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
    
    // Create content (40% of users)
    if (Math.random() < 0.4) {
      const contentTemplate = randomItem(CONTENT_TEMPLATES);
      const newContent = {
        type: contentTemplate.type,
        title: `${contentTemplate.title} - Load Test ${Date.now()}`,
        content: contentTemplate.content,
        tags: contentTemplate.tags,
        scheduledFor: new Date(Date.now() + randomIntBetween(3600, 86400) * 1000).toISOString(),
      };
      
      const createResponse = http.post(`${API_BASE}/api/content`, 
        JSON.stringify(newContent), 
        { headers: getAuthHeaders({ token }) }
      );
      
      check(createResponse, {
        'content creation success': (r) => r.status === 201,
        'content creation time': (r) => r.timings.duration < 1500,
      });
      
      apiCallsTotal.add(1);
      databaseOperations.add(1);
      
      // AI content generation (15% of content creators)
      if (Math.random() < 0.15) {
        const aiRequest = {
          prompt: contentTemplate.aiPrompt || 'Generate professional LinkedIn post',
          tone: randomItem(['professional', 'casual', 'enthusiastic']),
          length: randomItem(['short', 'medium', 'long']),
        };
        
        const aiResponse = http.post(`${API_BASE}/api/ai/generate/post`, 
          JSON.stringify(aiRequest), 
          { headers: getAuthHeaders({ token }) }
        );
        
        check(aiResponse, {
          'AI generation success': (r) => r.status === 200 || r.status === 402,
          'AI generation time': (r) => r.timings.duration < 10000,
        });
        
        apiCallsTotal.add(1);
      }
    }
  });
}

/**
 * Analytics Dashboard Flow
 */
function analyticsDashboardFlow(token) {
  group('Analytics Dashboard', () => {
    // Load analytics data
    const analyticsResponse = http.get(`${API_BASE}/api/v1/metrics/profile?period=30d`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(analyticsResponse, {
      'analytics load success': (r) => r.status === 200,
      'analytics load time': (r) => r.timings.duration < 2000,
    });
    
    apiCallsTotal.add(1);
    databaseOperations.add(1);
    
    // Real-time metrics (25% of users)
    if (Math.random() < 0.25) {
      const realtimeResponse = http.get(`${API_BASE}/api/v1/metrics/realtime`, {
        headers: getAuthHeaders({ token }),
      });
      
      check(realtimeResponse, {
        'realtime metrics success': (r) => r.status === 200,
        'realtime metrics time': (r) => r.timings.duration < 1000,
      });
      
      apiCallsTotal.add(1);
    }
    
    // Export analytics (5% of users)
    if (Math.random() < 0.05) {
      const exportResponse = http.post(`${API_BASE}/api/v1/metrics/export`, {
        format: 'csv',
        period: '30d',
        metrics: ['views', 'engagement', 'connections'],
      }, { headers: getAuthHeaders({ token }) });
      
      check(exportResponse, {
        'export success': (r) => r.status === 200 || r.status === 202,
        'export time': (r) => r.timings.duration < 3000,
      });
      
      apiCallsTotal.add(1);
    }
  });
}

/**
 * Automation Management Flow
 */
function automationManagementFlow(token) {
  group('Automation Management', () => {
    // Get automation templates
    const templatesResponse = http.get(`${API_BASE}/api/automation/templates`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(templatesResponse, {
      'automation templates success': (r) => r.status === 200,
      'automation templates time': (r) => r.timings.duration < 1000,
    });
    
    apiCallsTotal.add(1);
    
    // Safety score check
    const safetyResponse = http.get(`${API_BASE}/api/automation/safety-score`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(safetyResponse, {
      'safety score success': (r) => r.status === 200,
      'safety score time': (r) => r.timings.duration < 500,
    });
    
    automationSafetyChecks.add(1);
    apiCallsTotal.add(1);
    
    // Create automation rule (20% of users)
    if (Math.random() < 0.2) {
      const automationTemplate = randomItem(AUTOMATION_TEMPLATES);
      const newRule = {
        type: automationTemplate.type,
        name: `${automationTemplate.name} - Load Test ${Date.now()}`,
        config: automationTemplate.config,
        schedule: {
          enabled: true,
          days: randomItem(['weekdays', 'daily', 'weekends']),
          timeSlots: [{ start: '09:00', end: '17:00' }],
        },
      };
      
      const createRuleResponse = http.post(`${API_BASE}/api/automation/rules`, 
        JSON.stringify(newRule), 
        { headers: getAuthHeaders({ token }) }
      );
      
      check(createRuleResponse, {
        'automation rule creation': (r) => r.status === 201,
        'automation rule time': (r) => r.timings.duration < 1200,
      });
      
      apiCallsTotal.add(1);
      databaseOperations.add(1);
    }
    
    // Queue status check
    const queueResponse = http.get(`${API_BASE}/api/automation/queue/status`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(queueResponse, {
      'queue status success': (r) => r.status === 200,
      'queue status time': (r) => r.timings.duration < 300,
    });
    
    apiCallsTotal.add(1);
  });
}

/**
 * LinkedIn Integration Flow
 */
function linkedinIntegrationFlow(token) {
  group('LinkedIn Integration', () => {
    // LinkedIn profile status
    const profileStatus = http.get(`${API_BASE}/api/v1/linkedin/profile/status`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(profileStatus, {
      'linkedin profile status': (r) => r.status === 200,
      'linkedin status time': (r) => r.timings.duration < 800,
    });
    
    linkedinApiCalls.add(1);
    apiCallsTotal.add(1);
    
    // Connection suggestions (30% of users)
    if (Math.random() < 0.3) {
      const suggestionsResponse = http.get(`${API_BASE}/api/v1/linkedin/connections/suggestions?limit=10`, {
        headers: getAuthHeaders({ token }),
      });
      
      check(suggestionsResponse, {
        'connection suggestions': (r) => r.status === 200,
        'suggestions time': (r) => r.timings.duration < 1500,
      });
      
      linkedinApiCalls.add(1);
      apiCallsTotal.add(1);
    }
    
    // Rate limit check
    const rateLimitResponse = http.get(`${API_BASE}/api/v1/linkedin/rate-limits`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(rateLimitResponse, {
      'rate limit check': (r) => r.status === 200,
      'rate limit compliance': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.isCompliant === true;
        } catch {
          return false;
        }
      },
    });
    
    apiCallsTotal.add(1);
  });
}

/**
 * Basic Navigation Flow
 */
function basicNavigationFlow(token) {
  group('Basic Navigation', () => {
    const endpoints = [
      '/api/users/profile',
      '/api/content?limit=10',
      '/api/automation/templates?limit=5',
    ];
    
    const endpoint = randomItem(endpoints);
    const response = http.get(`${API_BASE}${endpoint}`, {
      headers: getAuthHeaders({ token }),
    });
    
    check(response, {
      'navigation success': (r) => r.status === 200,
      'navigation time': (r) => r.timings.duration < 1000,
    });
    
    apiCallsTotal.add(1);
  });
}

// Helper functions
function authenticateUser(user) {
  const loginResponse = http.post(`${API_BASE}/api/auth/login`, {
    email: user.email,
    password: user.password,
  }, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  apiCallsTotal.add(1);
  
  const success = check(loginResponse, {
    'authentication success': (r) => r.status === 200,
    'auth response time': (r) => r.timings.duration < 2000,
  });
  
  if (success) {
    try {
      const authData = JSON.parse(loginResponse.body);
      return { success: true, token: authData.accessToken, user: authData.user };
    } catch {
      return { success: false };
    }
  }
  
  return { success: false };
}

function getAuthHeaders(auth) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${auth.token}`,
  };
}

function getRandomUser() {
  return randomItem(TEST_USERS);
}

function selectUserBehavior() {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [type, config] of Object.entries(USER_BEHAVIOR_PATTERNS)) {
    cumulative += config.weight / 100;
    if (rand <= cumulative) {
      return config;
    }
  }
  
  return USER_BEHAVIOR_PATTERNS.regular_user;
}

function calculateSessionActions(behavior) {
  return Math.floor((behavior.sessionDuration / 60) * behavior.actionsPerMinute);
}

function selectScenario() {
  const scenarios = [
    { name: 'profile_management', weight: 25 },
    { name: 'content_operations', weight: 30 },
    { name: 'analytics_dashboard', weight: 20 },
    { name: 'automation_management', weight: 15 },
    { name: 'linkedin_integration', weight: 10 },
  ];
  
  const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  
  for (const scenario of scenarios) {
    cumulative += scenario.weight;
    if (rand <= cumulative) {
      return scenario.name;
    }
  }
  
  return 'profile_management';
}

// Test data generators
function generateTestUsers(count) {
  const users = [];
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com'];
  
  for (let i = 1; i <= count; i++) {
    users.push({
      id: i,
      email: `loadtest${i}@${randomItem(domains)}`,
      password: 'LoadTest123!',
      deviceId: `device-${randomIntBetween(1000, 9999)}-${i}`,
      pushToken: `push-token-${i}-${randomIntBetween(100000, 999999)}`,
    });
  }
  
  return users;
}

function generateContentTemplates(count) {
  const templates = [];
  const types = ['POST', 'CAROUSEL', 'VIDEO', 'ARTICLE'];
  const tones = ['professional', 'casual', 'enthusiastic', 'informative'];
  const topics = [
    'Professional Development', 'Industry Insights', 'Team Achievements',
    'Product Updates', 'Thought Leadership', 'Company Culture',
    'Technology Trends', 'Career Growth', 'Innovation', 'Networking'
  ];
  
  for (let i = 1; i <= count; i++) {
    templates.push({
      id: i,
      type: randomItem(types),
      title: `${randomItem(topics)} - Template ${i}`,
      content: `This is load test content for template ${i}. Generated for performance testing.`,
      tags: [randomItem(topics).toLowerCase().replace(' ', ''), 'loadtest', 'performance'],
      skills: [`Skill${randomIntBetween(1, 100)}`, `Technology${randomIntBetween(1, 50)}`],
      aiPrompt: `Generate a ${randomItem(tones)} post about ${randomItem(topics)}`,
    });
  }
  
  return templates;
}

function generateLinkedInProfiles(count) {
  const profiles = [];
  
  for (let i = 1; i <= count; i++) {
    profiles.push({
      id: i,
      linkedinId: `linkedin-user-${i}`,
      name: `Load Test User ${i}`,
      headline: `Professional in Load Testing - Profile ${i}`,
      connections: randomIntBetween(100, 5000),
      lastSync: new Date(Date.now() - randomIntBetween(0, 86400000)).toISOString(),
    });
  }
  
  return profiles;
}

function generateAutomationTemplates(count) {
  const templates = [];
  const types = ['CONNECTION_REQUEST', 'ENGAGEMENT', 'CONTENT_SHARING', 'FOLLOW_UP'];
  
  for (let i = 1; i <= count; i++) {
    templates.push({
      id: i,
      type: randomItem(types),
      name: `Automation Template ${i}`,
      config: {
        dailyLimit: randomIntBetween(10, 50),
        delay: randomIntBetween(60, 300),
        personalizedMessage: true,
        safetyChecks: true,
      },
    });
  }
  
  return templates;
}

// Setup and teardown
export function setup() {
  console.log('🚀 Starting InErgize Enterprise Load Test...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`WebSocket: ${WS_URL}`);
  console.log(`Test Users: ${TEST_USERS.length}`);
  console.log(`Content Templates: ${CONTENT_TEMPLATES.length}`);
  
  // Verify system health before starting
  const healthCheck = http.get(`${API_BASE}/health`);
  if (!check(healthCheck, { 'System healthy': (r) => r.status === 200 })) {
    throw new Error('System health check failed. Aborting load test.');
  }
  
  return {
    baseUrl: BASE_URL,
    apiUrl: API_BASE,
    wsUrl: WS_URL,
    startTime: Date.now(),
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('📊 Enterprise Load Test Completed');
  console.log(`Duration: ${duration}s`);
  console.log(`Total API Calls: ${apiCallsTotal.value}`);
  console.log(`Authentication Failures: ${authFailures.value}`);
  console.log(`LinkedIn API Calls: ${linkedinApiCalls.value}`);
  console.log(`Automation Safety Checks: ${automationSafetyChecks.value}`);
  console.log(`Database Operations: ${databaseOperations.value}`);
  console.log(`Cache Hit Ratio: ${cacheHits.value / (cacheHits.value + cacheMisses.value) * 100}%`);
  console.log('Check detailed results for performance analysis.');
}
