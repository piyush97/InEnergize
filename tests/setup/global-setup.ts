import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalSetup(config: FullConfig) {
  console.log('🌍 Playwright Global Setup Starting...');
  
  // Set up environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://inergize_user:inergize_password@localhost:5432/inergize_e2e_test';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.NEXTAUTH_SECRET = 'e2e-test-secret';
  
  // Create E2E test database
  try {
    execSync('docker exec inergize-postgres createdb -U inergize_user inergize_e2e_test || true', {
      stdio: 'ignore'
    });
    console.log('✅ E2E test database created');
  } catch (error) {
    console.warn('⚠️  Could not create E2E test database (it may already exist)');
  }
  
  // Set up test database schema
  try {
    execSync('DATABASE_URL=' + process.env.DATABASE_URL + ' npx prisma db push --force-reset', {
      stdio: 'pipe',
    });
    console.log('✅ E2E test database schema synchronized');
  } catch (error) {
    console.error('❌ Failed to sync E2E test database schema:', error);
  }
  
  // Seed test data
  try {
    await seedTestData();
    console.log('✅ E2E test data seeded');
  } catch (error) {
    console.error('❌ Failed to seed E2E test data:', error);
  }
  
  // Warm up browser
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Wait for services to be ready
  const maxRetries = 30;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await page.goto('http://localhost:3000', { timeout: 5000 });
      const response = await page.goto('http://localhost:3001/health', { timeout: 5000 });
      if (response?.ok()) {
        console.log('✅ Services are ready');
        break;
      }
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw new Error('Services failed to start within timeout period');
      }
      console.log(`⏳ Waiting for services... (${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await browser.close();
  
  console.log('✅ Playwright Global Setup Completed');
}

async function seedTestData() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
  
  try {
    // Create test users
    const testUser = await prisma.user.create({
      data: {
        id: 'test-user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        subscriptionTier: 'PROFESSIONAL',
        isActive: true,
        hashedPassword: '$2b$10$K7L8H1c6FY9mZgK3Y9zGNOYeYi5FgL9s3fLmH3nH5xJ8q9Kw6L7X8', // password: 'testpassword123'
      },
    });
    
    // Create LinkedIn profile for test user
    await prisma.linkedinProfile.create({
      data: {
        id: 'test-linkedin-1',
        userId: testUser.id,
        linkedinId: 'test-linkedin-user-123',
        linkedinUrl: 'https://linkedin.com/in/test-user',
        firstName: 'Test',
        lastName: 'User',
        headline: 'Software Engineer at Test Company',
        summary: 'Experienced software engineer with expertise in web development.',
        industry: 'Technology',
        location: 'San Francisco, CA',
        connectionCount: 250,
        followerCount: 150,
        isActive: true,
      },
    });
    
    // Create test content
    await prisma.contentItem.create({
      data: {
        id: 'test-content-1',
        userId: testUser.id,
        linkedinProfileId: 'test-linkedin-1',
        title: 'Test Post',
        content: 'This is a test post for E2E testing.',
        contentType: 'POST',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        views: 25,
        likes: 5,
        comments: 2,
        shares: 1,
      },
    });
    
    // Create test automation rule
    await prisma.automationRule.create({
      data: {
        id: 'test-automation-1',
        userId: testUser.id,
        linkedinProfileId: 'test-linkedin-1',
        name: 'Auto Like Tech Posts',
        description: 'Automatically like posts with technology hashtags',
        ruleType: 'AUTO_LIKE',
        isActive: true,
        triggerConditions: {
          hashtags: ['#technology', '#software', '#programming'],
          keywords: ['development', 'coding'],
        },
        actions: {
          action: 'like',
          delay: 30,
        },
        frequency: 'DAILY',
        timeSlots: ['09:00', '14:00', '18:00'],
        maxExecutionsPerDay: 20,
      },
    });
    
    console.log('✅ Test data seeded successfully');
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;