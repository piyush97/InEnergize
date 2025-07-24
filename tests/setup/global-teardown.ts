import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Playwright Global Teardown Starting...');
  
  // Clean up test database
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://inergize_user:inergize_password@localhost:5432/inergize_e2e_test',
        },
      },
    });
    
    // Clean up all test data
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
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Failed to clean up test data:', error);
  }
  
  // Drop E2E test database
  try {
    execSync('docker exec inergize-postgres dropdb -U inergize_user inergize_e2e_test --if-exists', {
      stdio: 'ignore'
    });
    console.log('✅ E2E test database dropped');
  } catch (error) {
    console.warn('⚠️  Could not drop E2E test database');
  }
  
  // Clean up test artifacts
  try {
    execSync('rm -rf test-results/ coverage/ playwright-report/', {
      stdio: 'ignore'
    });
    console.log('✅ Test artifacts cleaned up');
  } catch (error) {
    console.warn('⚠️  Could not clean up test artifacts');
  }
  
  console.log('✅ Playwright Global Teardown Completed');
}

export default globalTeardown;