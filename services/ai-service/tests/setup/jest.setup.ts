// Jest setup for AI service tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'sk-test-key-for-testing-ai-service-openai-integration';
process.env.ANTHROPIC_API_KEY = 'test-key-for-testing-anthropic-claude-integration';
process.env.JWT_SECRET = 'test-jwt-secret-for-ai-service-authentication';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'test-password';
process.env.RATE_LIMIT_WINDOW_MS = '3600000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.FREE_TIER_LIMIT = '10';
process.env.PREMIUM_TIER_LIMIT = '100';

// Mock Redis connection
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    pipeline: jest.fn().mockReturnValue({
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([['OK'], ['OK']])
    })
  };
  return jest.fn(() => mockRedis);
});

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test AI response content'
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150
            }
          })
        }
      },
      images: {
        generate: jest.fn().mockResolvedValue({
          created: Date.now(),
          data: [{
            url: 'https://test-image-url.com/generated-banner.png',
            revised_prompt: 'Test revised prompt for banner generation'
          }]
        })
      },
      moderations: {
        create: jest.fn().mockResolvedValue({
          id: 'modr-test',
          model: 'text-moderation-007',
          results: [{
            flagged: false,
            categories: {
              hate: false,
              'hate/threatening': false,
              harassment: false,
              'harassment/threatening': false,
              'self-harm': false,
              'self-harm/intent': false,
              'self-harm/instructions': false,
              sexual: false,
              'sexual/minors': false,
              violence: false,
              'violence/graphic': false
            },
            category_scores: {
              hate: 0.001,
              'hate/threatening': 0.001,
              harassment: 0.001,
              'harassment/threatening': 0.001,
              'self-harm': 0.001,
              'self-harm/intent': 0.001,
              'self-harm/instructions': 0.001,
              sexual: 0.001,
              'sexual/minors': 0.001,
              violence: 0.001,
              'violence/graphic': 0.001
            }
          }]
        })
      }
    }))
  };
});

// Mock Anthropic Claude
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          id: 'msg-test',
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'text',
            text: 'Test Claude response content'
          }],
          model: 'claude-3-sonnet-20240229',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50
          }
        })
      }
    }))
  };
});

// Mock Axios for external API calls
jest.mock('axios', () => ({
  default: {
    get: jest.fn().mockResolvedValue({ 
      data: 'Mock HTTP response data',
      status: 200,
      statusText: 'OK'
    }),
    post: jest.fn().mockResolvedValue({ 
      data: { success: true },
      status: 200,
      statusText: 'OK'
    }),
    create: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ data: 'Mock response' }),
      post: jest.fn().mockResolvedValue({ data: { success: true } })
    }))
  }
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({
    userId: 'test-user-123',
    email: 'test@example.com',
    subscriptionTier: 'premium',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  }),
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  decode: jest.fn().mockReturnValue({
    userId: 'test-user-123',
    email: 'test@example.com'
  })
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345')
}));

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('Mock file content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined)
  },
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  })
}));

// Mock metrics collection
const mockMetrics = {
  register: {
    metrics: jest.fn().mockResolvedValue('# Prometheus metrics mock'),
    clear: jest.fn(),
    getSingleMetric: jest.fn(),
    getMetricsAsJSON: jest.fn().mockReturnValue([])
  },
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
    reset: jest.fn()
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    reset: jest.fn(),
    startTimer: jest.fn().mockReturnValue(jest.fn())
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn()
  }))
};

jest.mock('prom-client', () => mockMetrics);

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Setup and teardown
beforeAll(() => {
  // Any global setup
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset timers for each test
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});