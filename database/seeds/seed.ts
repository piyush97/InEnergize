import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Read and execute the SQL seed file
    const seedSqlPath = join(__dirname, '001_development_data.sql');
    const seedSql = readFileSync(seedSqlPath, 'utf-8');
    
    // Split SQL file by statements and execute them
    const statements = seedSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));
    
    console.log(`📄 Executing ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await prisma.$executeRawUnsafe(statement + ';');
      }
    }
    
    // Verify seed data
    const userCount = await prisma.user.count();
    const profileCount = await prisma.linkedinProfile.count();
    const contentCount = await prisma.contentItem.count();
    const automationCount = await prisma.automationRule.count();
    const notificationCount = await prisma.notification.count();
    
    console.log('✅ Database seeded successfully!');
    console.log('📊 Seed data summary:');
    console.log(`   - Users: ${userCount}`);
    console.log(`   - LinkedIn Profiles: ${profileCount}`);
    console.log(`   - Content Items: ${contentCount}`);
    console.log(`   - Automation Rules: ${automationCount}`);
    console.log(`   - Notifications: ${notificationCount}`);
    
    // Create some additional sample data using Prisma
    console.log('🚀 Creating additional sample data...');
    
    // Create additional usage metrics for better analytics testing
    const now = new Date();
    const metricsData = [];
    
    const userIds = ['usr_001', 'usr_002', 'usr_003', 'usr_004'];
    const metricTypes = ['PROFILE_VIEWS', 'POST_IMPRESSIONS', 'ENGAGEMENT_RATE', 'API_USAGE'];
    
    // Generate metrics for the last 30 days
    for (let days = 0; days < 30; days++) {
      const date = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      
      for (const userId of userIds) {
        for (const metricType of metricTypes) {
          let metricValue: number;
          
          switch (metricType) {
            case 'PROFILE_VIEWS':
              metricValue = Math.floor(Math.random() * 100) + 10;
              break;
            case 'POST_IMPRESSIONS':
              metricValue = Math.floor(Math.random() * 1000) + 100;
              break;
            case 'ENGAGEMENT_RATE':
              metricValue = Math.random() * 10 + 1;
              break;
            case 'API_USAGE':
              metricValue = Math.floor(Math.random() * 200) + 50;
              break;
            default:
              metricValue = Math.random() * 100;
          }
          
          metricsData.push({
            userId,
            metricType: metricType as any,
            metricValue,
            timestamp: date,
          });
        }
      }
    }
    
    // Insert metrics in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < metricsData.length; i += batchSize) {
      const batch = metricsData.slice(i, i + batchSize);
      await prisma.usageMetrics.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }
    
    console.log(`📈 Created ${metricsData.length} usage metrics entries`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  });