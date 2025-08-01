#!/usr/bin/env node

/**
 * Mock InErgize Server for Performance Testing
 * 
 * This creates lightweight mock endpoints that simulate the InErgize API
 * for performance testing when the full stack isn't available.
 */

import http from 'http';
import url from 'url';

const MOCK_DATA = {
  users: Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    email: `user${i + 1}@example.com`,
    firstName: `User${i + 1}`,
    lastName: 'Test',
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  })),
  
  content: Array.from({ length: 500 }, (_, i) => ({
    id: i + 1,
    title: `Content Post ${i + 1}`,
    content: `This is mock content for performance testing. Post number ${i + 1}.`,
    type: ['POST', 'CAROUSEL', 'VIDEO'][i % 3],
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
  })),
  
  templates: Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `Template ${i + 1}`,
    category: ['professional', 'casual', 'promotional'][i % 3],
    usage: Math.floor(Math.random() * 1000)
  })),
  
  metrics: {
    profile: {
      views: Math.floor(Math.random() * 10000),
      connections: Math.floor(Math.random() * 5000),
      engagement: Math.floor(Math.random() * 1000),
      period: '30d'
    },
    realtime: {
      activeUsers: Math.floor(Math.random() * 100),
      timestamp: Date.now()
    }
  }
};

function addDelay(min = 10, max = 200) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function simulateLoad() {
  // Simulate some CPU work
  const start = Date.now();
  let result = 0;
  while (Date.now() - start < Math.random() * 50) {
    result += Math.random();
  }
  return result;
}

async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Add realistic delay and load simulation
  await addDelay();
  simulateLoad();
  
  try {
    // Health check
    if (path === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      }));
      return;
    }
    
    // API health check
    if (path === '/api/health/database') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'connected', latency: Math.floor(Math.random() * 10) + 5 }));
      return;
    }
    
    if (path === '/api/health/cache') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'connected', hit_ratio: 0.85 }));
      return;
    }
    
    // Auth endpoints
    if (path === '/api/auth/login' && method === 'POST') {
      await addDelay(50, 300); // Auth takes longer
      res.writeHead(200);
      res.end(JSON.stringify({
        accessToken: 'mock-jwt-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now(),
        user: MOCK_DATA.users[0]
      }));
      return;
    }
    
    if (path === '/api/auth/me') {
      res.writeHead(200);
      res.end(JSON.stringify(MOCK_DATA.users[0]));
      return;
    }
    
    // User endpoints
    if (path === '/api/users/profile') {
      res.writeHead(200);
      res.end(JSON.stringify({
        ...MOCK_DATA.users[0],
        completeness: Math.floor(Math.random() * 40) + 60,
        linkedinConnected: true
      }));
      return;
    }
    
    // Content endpoints
    if (path.startsWith('/api/content')) {
      const limit = parseInt(parsedUrl.query.limit) || 20;
      const page = parseInt(parsedUrl.query.page) || 1;
      const start = (page - 1) * limit;
      const content = MOCK_DATA.content.slice(start, start + limit);
      
      // Add cache headers occasionally
      if (Math.random() < 0.7) {
        res.setHeader('X-Cache-Status', 'HIT');
      }
      
      res.writeHead(200);
      res.end(JSON.stringify({
        data: content,
        total: MOCK_DATA.content.length,
        page,
        limit
      }));
      return;
    }
    
    // Templates endpoint
    if (path === '/api/content/templates') {
      res.setHeader('X-Cache-Status', Math.random() < 0.8 ? 'HIT' : 'MISS');
      res.writeHead(200);
      res.end(JSON.stringify(MOCK_DATA.templates));
      return;
    }
    
    // LinkedIn endpoints
    if (path === '/api/v1/linkedin/profile') {
      await addDelay(100, 500); // LinkedIn API simulation
      res.writeHead(200);
      res.end(JSON.stringify({
        id: 'mock-linkedin-id',
        name: 'Test User',
        headline: 'Performance Testing Specialist',
        connections: Math.floor(Math.random() * 1000) + 500,
        lastSync: new Date().toISOString()
      }));
      return;
    }
    
    if (path === '/api/v1/linkedin/profile/status') {
      res.writeHead(200);
      res.end(JSON.stringify({
        connected: true,
        lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        syncStatus: 'success'
      }));
      return;
    }
    
    if (path === '/api/v1/linkedin/sync' && method === 'POST') {
      await addDelay(200, 1000); // Sync takes longer
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'completed',
        changes: Math.floor(Math.random() * 10),
        lastSync: new Date().toISOString()
      }));
      return;
    }
    
    if (path === '/api/v1/linkedin/rate-limits') {
      res.writeHead(200);
      res.end(JSON.stringify({
        isCompliant: true,
        limits: {
          connections: { used: 5, limit: 15, resetAt: Date.now() + 86400000 },
          likes: { used: 12, limit: 30, resetAt: Date.now() + 86400000 }
        }
      }));
      return;
    }
    
    // Analytics endpoints
    if (path.startsWith('/api/v1/metrics')) {
      if (path.includes('realtime')) {
        res.writeHead(200);
        res.end(JSON.stringify(MOCK_DATA.metrics.realtime));
        return;
      }
      
      await addDelay(100, 800); // Analytics queries take time
      res.writeHead(200);
      res.end(JSON.stringify(MOCK_DATA.metrics.profile));
      return;
    }
    
    // Automation endpoints
    if (path === '/api/automation/templates') {
      res.writeHead(200);
      res.end(JSON.stringify([
        { id: 1, name: 'Connection Request', type: 'CONNECTION_REQUEST', active: true },
        { id: 2, name: 'Follow Up', type: 'FOLLOW_UP', active: false },
        { id: 3, name: 'Engagement', type: 'ENGAGEMENT', active: true }
      ]));
      return;
    }
    
    if (path === '/api/automation/safety-score') {
      res.writeHead(200);
      res.end(JSON.stringify({
        score: Math.floor(Math.random() * 20) + 80, // 80-100
        factors: ['rate_compliance', 'pattern_analysis', 'account_health'],
        lastUpdated: new Date().toISOString()
      }));
      return;
    }
    
    if (path === '/api/automation/queue/status') {
      res.writeHead(200);
      res.end(JSON.stringify({
        pending: Math.floor(Math.random() * 50),
        processing: Math.floor(Math.random() * 10),
        completed: Math.floor(Math.random() * 1000) + 500,
        failed: Math.floor(Math.random() * 5)
      }));
      return;
    }
    
    // AI Service endpoints
    if (path === '/api/ai/generate/post' && method === 'POST') {
      await addDelay(2000, 8000); // AI generation is slow
      res.writeHead(200);
      res.end(JSON.stringify({
        content: 'This is AI-generated content for performance testing. The content is optimized for professional LinkedIn engagement.',
        tone: 'professional',
        length: 'medium',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Mobile endpoints
    if (path === '/api/mobile/profile/sync') {
      res.writeHead(200);
      res.end(JSON.stringify({
        ...MOCK_DATA.users[0],
        mobileOptimized: true,
        lastSync: new Date().toISOString()
      }));
      return;
    }
    
    if (path === '/api/mobile/content/feed') {
      const limit = Math.min(parseInt(parsedUrl.query.limit) || 20, 50);
      res.writeHead(200);
      res.end(JSON.stringify({
        data: MOCK_DATA.content.slice(0, limit),
        hasMore: limit < MOCK_DATA.content.length
      }));
      return;
    }
    
    // Default 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found', path, method }));
    
  } catch (error) {
    console.error('Request error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// Create HTTP server
const server = http.createServer(handleRequest);

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 InErgize Mock Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('Mock endpoints available for performance testing');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down mock server...');
  server.close(() => {
    console.log('Mock server stopped');
    process.exit(0);
  });
});

export default server;