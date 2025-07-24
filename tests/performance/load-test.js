// InErgize Load Testing Script
// K6 performance testing for API endpoints and user workflows

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTimeP95 = new Trend('response_time_p95');
const apiCallsTotal = new Counter('api_calls_total');
const authFailures = new Counter('auth_failures');

// Test configuration
export const options = {
  stages: [
    // Warm-up
    { duration: '2m', target: 10 },
    // Ramp-up
    { duration: '5m', target: 50 },
    // Steady state
    { duration: '10m', target: 100 },
    // Peak load
    { duration: '5m', target: 200 },
    // Ramp-down
    { duration: '5m', target: 50 },
    // Cool-down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    http_req_failed: ['rate<0.05'], // Error rate must be below 5%
    error_rate: ['rate<0.05'],
    response_time_p95: ['p(95)<1500'],
  },
  ext: {
    loadimpact: {
      projectID: 3596346,
      name: 'InErgize API Load Test',
    },
  },
};

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8000';
const API_BASE = `${BASE_URL}/v1`;

// Test data
const testUsers = [
  { email: 'load-test-1@example.com', password: 'TestPassword123!' },
  { email: 'load-test-2@example.com', password: 'TestPassword123!' },
  { email: 'load-test-3@example.com', password: 'TestPassword123!' },
  { email: 'load-test-4@example.com', password: 'TestPassword123!' },
  { email: 'load-test-5@example.com', password: 'TestPassword123!' },
];

const sampleContent = {
  posts: [
    {
      type: 'POST',
      title: 'Test LinkedIn Post',
      content: {
        text: 'This is a test LinkedIn post created during load testing. #testing #linkedin',
        hashtags: ['testing', 'linkedin', 'automation'],
      },
    },
    {
      type: 'CAROUSEL',
      title: 'Test Carousel Post',
      content: {
        slides: [
          { title: 'Slide 1', text: 'First slide content' },
          { title: 'Slide 2', text: 'Second slide content' },
          { title: 'Slide 3', text: 'Third slide content' },
        ],
      },
    },
  ],
  bannerRequests: [
    {
      theme: 'Professional Growth',
      industry: 'Technology',
      colors: ['#0077B5', '#FFFFFF'],
      style: 'professional',
    },
    {
      theme: 'Innovation',
      industry: 'Startup',
      colors: ['#FF6B6B', '#4ECDC4'],
      style: 'modern',
    },
  ],
};

// Utility functions
function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

function getRandomContent() {
  return sampleContent.posts[Math.floor(Math.random() * sampleContent.posts.length)];
}

function getRandomBannerRequest() {
  return sampleContent.bannerRequests[Math.floor(Math.random() * sampleContent.bannerRequests.length)];
}

// Authentication helper
function authenticate() {
  const user = getRandomUser();
  
  const loginResponse = http.post(
    `${API_BASE}/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  apiCallsTotal.add(1);

  if (!check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response contains token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.accessToken !== undefined;
      } catch (e) {
        return false;
      }
    },
  })) {
    authFailures.add(1);
    errorRate.add(1);
    return null;
  }

  const loginData = JSON.parse(loginResponse.body);
  return {
    token: loginData.accessToken,
    user: loginData.user,
  };
}

// Test scenarios
export function setup() {
  console.log('Starting InErgize load test...');
  console.log(`Target URL: ${BASE_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${API_BASE}/health`);
  if (!check(healthCheck, { 'API is accessible': (r) => r.status === 200 })) {
    throw new Error('API is not accessible. Aborting test.');
  }
  
  console.log('API health check passed. Starting load test...');
  return { baseUrl: BASE_URL };
}

export default function loadTest() {
  // Authentication flow
  group('Authentication Flow', () => {
    const auth = authenticate();
    if (!auth) return;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`,
    };

    // Profile operations
    group('Profile Operations', () => {
      // Get user profile
      const profileResponse = http.get(`${API_BASE}/users/profile`, { headers });
      apiCallsTotal.add(1);
      
      const profileCheck = check(profileResponse, {
        'get profile status is 200': (r) => r.status === 200,
        'profile contains user data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.id !== undefined && body.email !== undefined;
          } catch (e) {
            return false;
          }
        },
      });
      
      if (!profileCheck) errorRate.add(1);
      responseTimeP95.add(profileResponse.timings.duration);

      // Update profile (25% of users)
      if (Math.random() < 0.25) {
        const updateResponse = http.put(
          `${API_BASE}/users/profile`,
          JSON.stringify({
            firstName: `LoadTest${Math.floor(Math.random() * 1000)}`,
          }),
          { headers }
        );
        
        apiCallsTotal.add(1);
        if (!check(updateResponse, { 'update profile status is 200': (r) => r.status === 200 })) {
          errorRate.add(1);
        }
      }

      sleep(1);
    });

    // Content operations
    group('Content Operations', () => {
      // List content
      const listResponse = http.get(`${API_BASE}/content?page=1&limit=10`, { headers });
      apiCallsTotal.add(1);
      
      if (!check(listResponse, {
        'list content status is 200': (r) => r.status === 200,
        'content list contains items array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.items);
          } catch (e) {
            return false;
          }
        },
      })) {
        errorRate.add(1);
      }
      responseTimeP95.add(listResponse.timings.duration);

      // Create content (50% of users)
      if (Math.random() < 0.5) {
        const content = getRandomContent();
        const createResponse = http.post(
          `${API_BASE}/content`,
          JSON.stringify(content),
          { headers }
        );
        
        apiCallsTotal.add(1);
        if (!check(createResponse, { 'create content status is 201': (r) => r.status === 201 })) {
          errorRate.add(1);
        } else {
          // Get created content
          try {
            const createdContent = JSON.parse(createResponse.body);
            const getResponse = http.get(`${API_BASE}/content/${createdContent.id}`, { headers });
            apiCallsTotal.add(1);
            
            if (!check(getResponse, { 'get content status is 200': (r) => r.status === 200 })) {
              errorRate.add(1);
            }
          } catch (e) {
            errorRate.add(1);
          }
        }
      }

      sleep(1);
    });

    // AI operations (limited to reduce load)
    group('AI Operations', () => {
      if (Math.random() < 0.1) { // Only 10% of users
        // Generate banner
        const bannerRequest = getRandomBannerRequest();
        const bannerResponse = http.post(
          `${API_BASE}/ai/generate/banner`,
          JSON.stringify(bannerRequest),
          { headers }
        );
        
        apiCallsTotal.add(1);
        if (!check(bannerResponse, {
          'generate banner status is 200 or 402': (r) => r.status === 200 || r.status === 402,
        })) {
          errorRate.add(1);
        }
        responseTimeP95.add(bannerResponse.timings.duration);

        sleep(2); // AI operations take longer
      }

      if (Math.random() < 0.15) { // 15% of users
        // Generate post
        const postResponse = http.post(
          `${API_BASE}/ai/generate/post`,
          JSON.stringify({
            topic: 'Professional development in technology',
            tone: 'professional',
            length: 'medium',
            includeHashtags: true,
          }),
          { headers }
        );
        
        apiCallsTotal.add(1);
        if (!check(postResponse, {
          'generate post status is 200 or 402': (r) => r.status === 200 || r.status === 402,
        })) {
          errorRate.add(1);
        }
        responseTimeP95.add(postResponse.timings.duration);

        sleep(1);
      }
    });

    // Analytics operations
    group('Analytics Operations', () => {
      if (Math.random() < 0.3) { // 30% of users check analytics
        const analyticsResponse = http.get(`${API_BASE}/analytics/profile?period=30d`, { headers });
        apiCallsTotal.add(1);
        
        if (!check(analyticsResponse, {
          'analytics status is 200': (r) => r.status === 200,
        })) {
          errorRate.add(1);
        }
        responseTimeP95.add(analyticsResponse.timings.duration);

        sleep(1);
      }
    });

    // Automation operations (limited)
    group('Automation Operations', () => {
      if (Math.random() < 0.2) { // 20% of users
        const rulesResponse = http.get(`${API_BASE}/automation/rules`, { headers });
        apiCallsTotal.add(1);
        
        if (!check(rulesResponse, {
          'automation rules status is 200': (r) => r.status === 200,
        })) {
          errorRate.add(1);
        }
        responseTimeP95.add(rulesResponse.timings.duration);

        sleep(1);
      }
    });

    // Random wait between user sessions
    sleep(Math.random() * 3 + 1);
  });
}

// System health monitoring during test
export function healthCheck() {
  group('System Health Check', () => {
    const healthResponse = http.get(`${API_BASE}/health`);
    
    check(healthResponse, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 500ms': (r) => r.timings.duration < 500,
      'system is healthy': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'healthy';
        } catch (e) {
          return false;
        }
      },
    });

    const statusResponse = http.get(`${API_BASE}/status`);
    check(statusResponse, {
      'status endpoint is accessible': (r) => r.status === 200,
    });
  });
}

export function teardown(data) {
  console.log('Load test completed.');
  console.log(`Target URL: ${data.baseUrl}`);
  console.log('Check the results for performance metrics and error rates.');
}