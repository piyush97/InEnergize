// Jest setup for Auth service tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing-auth-service-jwt';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-auth-service-jwt';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'test-password';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/inergize_test';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';
process.env.MFA_SECRET_KEY = 'test-mfa-secret-for-totp-generation';

// Mock Redis connection
jest.mock('ioredis', () => {
  const mockRedis = {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    pipeline: jest.fn().mockReturnValue({
      setex: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([['OK'], ['OK']])
    })
  };
  return jest.fn(() => mockRedis);
});

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn()
    },
    session: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    mfaDevice: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn()
    },
    loginAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    $disconnect: jest.fn()
  }))
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-12345')
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
      rejected: []
    })
  })
}));

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

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
});

afterEach(() => {
  jest.clearAllTimers();
});