import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import Redis from 'ioredis';

// Integration test setup
let prisma: PrismaClient;
let redis: Redis;

beforeAll(async () => {
  console.log('🔗 Setting up integration tests...');
  
  // Set up test database
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || 
    'postgresql://inergize_user:inergize_password@localhost:5432/inergize_test';
  
  // Create test database if it doesn't exist
  try {
    execSync('docker exec inergize-postgres createdb -U inergize_user inergize_test || true', {
      stdio: 'ignore'
    });
  } catch (error) {
    console.warn('Could not create test database (it may already exist)');
  }
  
  // Initialize Prisma client for test database
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDatabaseUrl,
      },
    },
  });
  
  // Push schema to test database
  try {
    execSync('DATABASE_URL=' + testDatabaseUrl + ' npx prisma db push --force-reset', {
      stdio: 'pipe',
    });
    console.log('✅ Test database schema synchronized');
  } catch (error) {
    console.error('❌ Failed to sync test database schema:', error);
  }
  
  // Set up test Redis connection
  const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  redis = new Redis(testRedisUrl);
  
  // Clear test Redis database
  await redis.flushdb();
  
  // Make database and redis clients available globally
  (global as any).testDb = prisma;
  (global as any).testRedis = redis;
  
  console.log('✅ Integration test setup completed');
});

afterAll(async () => {
  console.log('🧹 Cleaning up integration tests...');
  
  // Clean up test data
  if (prisma) {
    // Delete in reverse dependency order
    await prisma.notification.deleteMany();
    await prisma.usageMetrics.deleteMany();
    await prisma.engagementActivity.deleteMany();
    await prisma.automationRule.deleteMany();
    await prisma.contentItem.deleteMany();
    await prisma.linkedinProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    
    await prisma.$disconnect();
  }
  
  // Clear Redis test database
  if (redis) {
    await redis.flushdb();
    await redis.disconnect();
  }
  
  console.log('✅ Integration test cleanup completed');
});

// Helper functions for integration tests
export const integrationTestHelpers = {
  // Create test user
  createTestUser: async (overrides: any = {}) => {
    return await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        subscriptionTier: 'FREE',
        isActive: true,
        ...overrides,
      },
    });
  },
  
  // Create test LinkedIn profile
  createTestLinkedInProfile: async (userId: string, overrides: any = {}) => {
    return await prisma.linkedinProfile.create({
      data: {
        userId,
        linkedinId: `linkedin-${Date.now()}`,
        linkedinUrl: 'https://linkedin.com/in/test-user',
        firstName: 'Test',
        lastName: 'User',
        headline: 'Software Engineer',
        ...overrides,
      },
    });
  },
  
  // Create test content item
  createTestContent: async (userId: string, linkedinProfileId?: string, overrides: any = {}) => {
    return await prisma.contentItem.create({
      data: {
        userId,
        linkedinProfileId,
        title: 'Test Content',
        content: 'This is test content for LinkedIn.',
        contentType: 'POST',
        status: 'DRAFT',
        ...overrides,
      },
    });
  },
  
  // Create test automation rule
  createTestAutomationRule: async (userId: string, linkedinProfileId: string, overrides: any = {}) => {
    return await prisma.automationRule.create({
      data: {
        userId,
        linkedinProfileId,
        name: 'Test Automation Rule',
        ruleType: 'AUTO_LIKE',
        triggerConditions: { hashtags: ['#testing'] },
        actions: { action: 'like', delay: 30 },
        frequency: 'DAILY',
        maxExecutionsPerDay: 10,
        ...overrides,
      },
    });
  },
  
  // Clean up specific test data
  cleanupTestData: async (userId: string) => {
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.usageMetrics.deleteMany({ where: { userId } });
    await prisma.engagementActivity.deleteMany({
      where: { linkedinProfile: { userId } }
    });
    await prisma.automationRule.deleteMany({ where: { userId } });
    await prisma.contentItem.deleteMany({ where: { userId } });
    await prisma.linkedinProfile.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  },
  
  // Wait for database operations to complete
  waitForDb: async (operation: () => Promise<any>, maxRetries: number = 5) => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 100 * retries));
      }
    }
  },
};

// Make helpers available globally
(global as any).integrationTestHelpers = integrationTestHelpers;

// Type declarations
declare global {
  var testDb: PrismaClient;
  var testRedis: Redis;
  var integrationTestHelpers: typeof integrationTestHelpers;
}