// Jest setup for LinkedIn service tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
process.env.LINKEDIN_REDIRECT_URI = 'http://localhost:3000/auth/linkedin/callback';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Suppress console output during tests
beforeAll(() => {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  jest.restoreAllMocks();
});