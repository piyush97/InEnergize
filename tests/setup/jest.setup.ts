import { config } from 'dotenv';
import { PerformanceProfiler } from '../utils/performance-profiler';
import { MemoryMonitor } from '../utils/memory-monitor';

// Load environment variables from .env.test file
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Set up test database URL if not already set
  if (!process.env.TEST_DATABASE_URL) {
    process.env.TEST_DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/inergize_test';
  }
  
  // Set up test Redis URL if not already set
  if (!process.env.TEST_REDIS_URL) {
    process.env.TEST_REDIS_URL = 'redis://localhost:6379/1';
  }
  
  // Mock external services in test environment
  process.env.MOCK_LINKEDIN_API = 'true';
  process.env.MOCK_EMAIL_SERVICE = 'true';
  process.env.MOCK_AI_SERVICE = 'true';
  
  // Set test-specific secrets
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.BCRYPT_SALT_ROUNDS = '4'; // Lower for faster tests
  
  // AI Model Testing Configuration
  process.env.AI_MODEL_TEST_MODE = 'true';
  process.env.MOCK_OPENAI_RESPONSES = 'true';
  process.env.MOCK_ANTHROPIC_RESPONSES = 'true';
  
  // LinkedIn Compliance Testing Configuration
  process.env.LINKEDIN_COMPLIANCE_TEST_MODE = 'true';
  process.env.ULTRA_CONSERVATIVE_LIMITS = 'true';
  process.env.SAFETY_MONITORING_ENABLED = 'true';
  
  // Performance Testing Configuration
  process.env.PERFORMANCE_MONITORING_ENABLED = 'true';
  process.env.MEMORY_MONITORING_ENABLED = 'true';
  process.env.PERFORMANCE_TEST_TIMEOUT = '120000'; // 2 minutes
  
  // Team Collaboration Testing Configuration
  process.env.WEBSOCKET_TEST_MODE = 'true';
  process.env.MOCK_WEBSOCKET_SERVER = 'true';
  process.env.REAL_TIME_FEATURES_TEST_MODE = 'true';
  
  console.log('🧪 Jest global setup completed with comprehensive testing framework');
});

// Global test teardown
afterAll(async () => {
  console.log('🧹 Jest global teardown completed');
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error, // Keep error logging for debugging
};

// Global test helpers
global.testHelpers = {
  // Wait for a specified amount of time
  wait: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Generate random test data
  randomString: (length: number = 10): string => {
    return Math.random().toString(36).substring(2, 2 + length);
  },
  
  randomEmail: (): string => {
    return `test${Math.random().toString(36).substring(2, 8)}@example.com`;
  },
  
  randomNumber: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  // Performance testing helpers
  createPerformanceProfiler: (): PerformanceProfiler => {
    return new PerformanceProfiler();
  },
  
  createMemoryMonitor: (): MemoryMonitor => {
    return new MemoryMonitor();
  },
  
  // AI model testing helpers
  mockAIResponse: (accuracy: number = 0.85): any => {
    return {
      prediction: Math.random() > (1 - accuracy) ? 'correct' : 'incorrect',
      confidence: accuracy + (Math.random() * 0.1 - 0.05),
      latency: Math.random() * 200 + 50, // 50-250ms
      tokens: Math.floor(Math.random() * 1000 + 100)
    };
  },
  
  // LinkedIn compliance testing helpers
  mockLinkedInRateLimit: (action: string): any => {
    const limits = {
      CONNECTION_REQUESTS_DAILY: 15,
      LIKES_DAILY: 30,
      COMMENTS_DAILY: 8,
      PROFILE_VIEWS_DAILY: 25,
      FOLLOWS_DAILY: 5,
      MESSAGES_DAILY: 15
    };
    
    return {
      action,
      limit: limits[action as keyof typeof limits] || 10,
      remaining: Math.floor(Math.random() * 10),
      resetTime: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
  },
  
  // WebSocket testing helpers
  mockWebSocketMessage: (type: string, data: any = {}): any => {
    return {
      type,
      timestamp: Date.now(),
      userId: `user-${Math.random().toString(36).substring(7)}`,
      sessionId: `session-${Math.random().toString(36).substring(7)}`,
      data
    };
  },
  
  // Team collaboration testing helpers
  mockCollaborativeEdit: (templateId: string = 'template-123'): any => {
    return {
      templateId,
      operation: {
        type: Math.random() > 0.5 ? 'insert' : 'delete',
        position: Math.floor(Math.random() * 1000),
        content: `Test edit ${Date.now()}`,
        userId: `user-${Math.random().toString(36).substring(7)}`
      },
      timestamp: Date.now()
    };
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },
  
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  
  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },
  
  // AI Model Testing Matchers
  toMeetAccuracyThreshold(received: number, threshold: number = 0.85) {
    const pass = received >= threshold;
    if (pass) {
      return {
        message: () => `expected accuracy ${received} not to meet threshold ${threshold}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected accuracy ${received} to meet threshold ${threshold}`,
        pass: false,
      };
    }
  },
  
  toBeBiasFree(received: any, threshold: number = 0.05) {
    const biasScore = received.biasScore || received;
    const pass = typeof biasScore === 'number' && biasScore <= threshold;
    if (pass) {
      return {
        message: () => `expected bias score ${biasScore} to exceed threshold ${threshold}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected bias score ${biasScore} to be below threshold ${threshold}`,
        pass: false,
      };
    }
  },
  
  // Performance Testing Matchers
  toMeetLatencyThreshold(received: number, threshold: number = 200) {
    const pass = received <= threshold;
    if (pass) {
      return {
        message: () => `expected latency ${received}ms not to meet threshold ${threshold}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected latency ${received}ms to meet threshold ${threshold}ms`,
        pass: false,
      };
    }
  },
  
  toMeetThroughputThreshold(received: number, threshold: number = 100) {
    const pass = received >= threshold;
    if (pass) {
      return {
        message: () => `expected throughput ${received} RPS not to meet threshold ${threshold} RPS`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected throughput ${received} RPS to meet threshold ${threshold} RPS`,
        pass: false,
      };
    }
  },
  
  // LinkedIn Compliance Testing Matchers
  toRespectRateLimit(received: any, action: string) {
    const limits = {
      CONNECTION_REQUESTS_DAILY: 15,
      LIKES_DAILY: 30,
      COMMENTS_DAILY: 8,
      PROFILE_VIEWS_DAILY: 25,
      FOLLOWS_DAILY: 5,
      MESSAGES_DAILY: 15
    };
    
    const limit = limits[action as keyof typeof limits];
    const count = received.count || received;
    const pass = count <= limit;
    
    if (pass) {
      return {
        message: () => `expected ${action} count ${count} not to respect limit ${limit}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${action} count ${count} to respect limit ${limit}`,
        pass: false,
      };
    }
  },
});

// Mock external modules
jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }));
  
  return Redis;
});

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    linkedinProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contentItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    automationRule: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
    Http: jest.fn(),
  },
}));

// Mock axios for external API calls
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  post: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  put: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  delete: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  create: jest.fn().mockReturnThis(),
  defaults: {
    adapter: {},
  },
}));

// Type declarations for global helpers
declare global {
  var testHelpers: {
    wait: (ms: number) => Promise<void>;
    randomString: (length?: number) => string;
    randomEmail: () => string;
    randomNumber: (min?: number, max?: number) => number;
    createPerformanceProfiler: () => PerformanceProfiler;
    createMemoryMonitor: () => MemoryMonitor;
    mockAIResponse: (accuracy?: number) => any;
    mockLinkedInRateLimit: (action: string) => any;
    mockWebSocketMessage: (type: string, data?: any) => any;
    mockCollaborativeEdit: (templateId?: string) => any;
  };
  
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidEmail(): R;
      toBeValidJWT(): R;
      toMeetAccuracyThreshold(threshold?: number): R;
      toBeBiasFree(threshold?: number): R;
      toMeetLatencyThreshold(threshold?: number): R;
      toMeetThroughputThreshold(threshold?: number): R;
      toRespectRateLimit(action: string): R;
    }
  }
}