#!/usr/bin/env node

/**
 * Development Environment Manager for InErgize
 * 
 * Features:
 * - One-command environment setup and teardown
 * - Health monitoring and auto-recovery
 * - Resource optimization and cleanup
 * - Development workflow shortcuts
 * - Multi-environment support (dev, test, staging)
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

class DevelopmentEnvironmentManager {
  constructor() {
    this.services = {
      infrastructure: ['postgres', 'timescale', 'redis', 'elasticsearch', 'kibana', 'kong'],
      applications: ['auth-service', 'user-service', 'linkedin-service', 'analytics-service', 'ai-service', 'websocket-service'],
      frontend: ['web-app']
    };
    
    this.ports = {
      'postgres': 5432,
      'timescale': 5433,
      'redis': 6379,
      'elasticsearch': 9200,
      'kibana': 5601,
      'kong': 8000,
      'kong-admin': 8001,
      'auth-service': 3001,
      'user-service': 3002,
      'linkedin-service': 3003,
      'analytics-service': 3004,
      'ai-service': 3005,
      'websocket-service': 3007,
      'web-app': 3000
    };

    this.healthEndpoints = {
      'auth-service': 'http://localhost:3001/health',
      'user-service': 'http://localhost:3002/health',
      'linkedin-service': 'http://localhost:3003/health',
      'analytics-service': 'http://localhost:3004/health',
      'ai-service': 'http://localhost:3005/health',
      'websocket-service': 'http://localhost:3007/health',
      'web-app': 'http://localhost:3000',
      'kong': 'http://localhost:8001/status',
      'kibana': 'http://localhost:5601/api/status'
    };
  }

  async executeCommand(command, options = {}) {
    const startTime = Date.now();
    console.log(`🔧 Executing: ${command}`);
    
    try {
      const result = execSync(command, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        timeout: options.timeout || 120000,
        ...options
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ Command completed in ${(duration / 1000).toFixed(2)}s`);
      
      return { success: true, output: result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Command failed after ${(duration / 1000).toFixed(2)}s`);
      console.error(`Error: ${error.message}`);
      
      return { success: false, error: error.message, duration };
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    const requirements = [
      { name: 'Docker', command: 'docker --version' },
      { name: 'Docker Compose', command: 'docker-compose --version' },
      { name: 'Bun', command: 'bun --version' },
      { name: 'Node.js', command: 'node --version' }
    ];

    const results = {};
    let allPassed = true;

    for (const req of requirements) {
      const result = await this.executeCommand(req.command, { timeout: 10000 });
      results[req.name] = result.success;
      
      if (result.success) {
        console.log(`✅ ${req.name}: Available`);
      } else {
        console.error(`❌ ${req.name}: Not found or not working`);
        allPassed = false;
      }
    }

    if (!allPassed) {
      console.error('\\n❌ Prerequisites check failed. Please install missing requirements.');
      process.exit(1);
    }

    console.log('✅ All prerequisites satisfied\\n');
    return results;
  }

  async checkPortAvailability() {
    console.log('🔍 Checking port availability...');
    
    const occupiedPorts = [];
    
    for (const [service, port] of Object.entries(this.ports)) {
      try {
        execSync(`lsof -i :${port}`, { stdio: 'ignore' });
        occupiedPorts.push({ service, port });
      } catch (error) {
        // Port is available (lsof returns non-zero when port is free)
      }
    }

    if (occupiedPorts.length > 0) {
      console.warn('⚠️  Some required ports are occupied:');
      occupiedPorts.forEach(({ service, port }) => {
        console.warn(`   - ${service}: ${port}`);
      });
      
      const answer = await this.promptUser('Continue anyway? Services may fail to start. (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('Aborting. Please free the occupied ports and try again.');
        process.exit(1);
      }
    } else {
      console.log('✅ All required ports are available\\n');
    }
  }

  async promptUser(question) {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question(question, (answer) => {
        readline.close();
        resolve(answer);
      });
    });
  }

  async startInfrastructure() {
    console.log('🏗️  Starting infrastructure services...');
    
    const command = 'docker-compose up -d postgres timescale redis elasticsearch kibana kong';
    const result = await this.executeCommand(command);
    
    if (!result.success) {
      throw new Error('Failed to start infrastructure services');
    }

    // Wait for services to be healthy
    console.log('⏳ Waiting for infrastructure services to be healthy...');
    await this.waitForHealthyServices(['postgres', 'timescale', 'redis'], 120);
    
    console.log('✅ Infrastructure services started successfully\\n');
    return result;
  }

  async startApplicationServices() {
    console.log('🚀 Starting application services...');
    
    // Start services in dependency order
    const serviceOrder = [
      'auth-service',
      'user-service', 
      'linkedin-service',
      'analytics-service',
      'ai-service',
      'websocket-service'
    ];

    for (const service of serviceOrder) {
      console.log(`Starting ${service}...`);
      const command = `docker-compose up -d ${service}`;
      const result = await this.executeCommand(command);
      
      if (!result.success) {
        console.error(`Failed to start ${service}`);
        continue;
      }

      // Wait a bit for service to initialize
      await this.sleep(3000);
    }

    console.log('⏳ Waiting for application services to be healthy...');
    await this.waitForHealthyServices(serviceOrder, 180);
    
    console.log('✅ Application services started successfully\\n');
  }

  async startFrontend() {
    console.log('🎨 Starting frontend application...');
    
    const command = 'docker-compose up -d web-app';
    const result = await this.executeCommand(command);
    
    if (!result.success) {
      throw new Error('Failed to start frontend application');
    }

    console.log('⏳ Waiting for frontend to be ready...');
    await this.waitForHealthyServices(['web-app'], 60);
    
    console.log('✅ Frontend application started successfully\\n');
    return result;
  }

  async waitForHealthyServices(services, timeoutSeconds = 120) {
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;
    
    while (Date.now() - startTime < timeout) {
      const healthChecks = await Promise.all(
        services.map(service => this.checkServiceHealth(service))
      );
      
      const allHealthy = healthChecks.every(check => check.healthy);
      
      if (allHealthy) {
        return true;
      }
      
      const unhealthyServices = services.filter((_, index) => !healthChecks[index].healthy);
      console.log(`⏳ Waiting for services: ${unhealthyServices.join(', ')}`);
      
      await this.sleep(5000);
    }
    
    throw new Error(`Timeout waiting for services to be healthy: ${services.join(', ')}`);
  }

  async checkServiceHealth(service) {
    try {
      // Check if container is running
      const containerResult = await this.executeCommand(
        `docker-compose ps -q ${service}`, 
        { timeout: 5000 }
      );
      
      if (!containerResult.success || !containerResult.output.trim()) {
        return { healthy: false, reason: 'Container not running' };
      }

      // Check health endpoint if available
      const endpoint = this.healthEndpoints[service];
      if (endpoint) {
        const healthResult = await this.executeCommand(
          `curl -f -s --max-time 5 ${endpoint}`, 
          { timeout: 10000 }
        );
        
        return { 
          healthy: healthResult.success, 
          reason: healthResult.success ? 'Health check passed' : 'Health check failed' 
        };
      }

      // For services without health endpoints, check if port is listening
      const port = this.ports[service];
      if (port) {
        const portResult = await this.executeCommand(
          `nc -z localhost ${port}`, 
          { timeout: 5000 }
        );
        
        return { 
          healthy: portResult.success, 
          reason: portResult.success ? 'Port accessible' : 'Port not accessible' 
        };
      }

      return { healthy: true, reason: 'Container running' };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }

  async runDatabaseMigrations() {
    console.log('📊 Running database migrations...');
    
    const migrations = [
      'bun run db:migrate:main',
      'bun run db:migrate:analytics'
    ];

    for (const migration of migrations) {
      console.log(`Running: ${migration}`);
      const result = await this.executeCommand(migration);
      
      if (!result.success) {
        console.error(`Migration failed: ${migration}`);
        throw new Error('Database migration failed');
      }
    }

    console.log('✅ Database migrations completed successfully\\n');
  }

  async seedDatabase() {
    console.log('🌱 Seeding database with initial data...');
    
    const result = await this.executeCommand('bun run db:seed');
    
    if (!result.success) {
      console.error('Database seeding failed');
      throw new Error('Database seeding failed');
    }

    console.log('✅ Database seeded successfully\\n');
  }

  async generateHealthReport() {
    console.log('📋 Generating environment health report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      services: {},
      overall: { healthy: 0, total: 0 }
    };

    const allServices = [
      ...this.services.infrastructure,
      ...this.services.applications,
      ...this.services.frontend
    ];

    for (const service of allServices) {
      const health = await this.checkServiceHealth(service);
      report.services[service] = {
        healthy: health.healthy,
        reason: health.reason,
        port: this.ports[service] || null,
        endpoint: this.healthEndpoints[service] || null
      };
      
      report.overall.total++;
      if (health.healthy) {
        report.overall.healthy++;
      }
    }

    report.overall.healthPercentage = Math.round(
      (report.overall.healthy / report.overall.total) * 100
    );

    // Display report
    console.log('\\n🏥 Environment Health Report');
    console.log('============================');
    console.log(`Overall Health: ${report.overall.healthy}/${report.overall.total} (${report.overall.healthPercentage}%)\\n`);

    for (const [service, status] of Object.entries(report.services)) {
      const icon = status.healthy ? '✅' : '❌';
      const port = status.port ? `:${status.port}` : '';
      console.log(`${icon} ${service}${port} - ${status.reason}`);
    }

    console.log('\\n');
    
    // Save report to file
    const reportPath = join(PROJECT_ROOT, '.env-health-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  async startFullEnvironment(options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting InErgize Development Environment\\n');
    
    try {
      // Prerequisites check
      if (!options.skipPrereq) {
        await this.checkPrerequisites();
        await this.checkPortAvailability();
      }

      // Start infrastructure
      await this.startInfrastructure();

      // Run database setup
      if (!options.skipDb) {
        await this.runDatabaseMigrations();
        await this.seedDatabase();
      }

      // Start application services
      await this.startApplicationServices();

      // Start frontend
      if (!options.skipFrontend) {
        await this.startFrontend();
      }

      // Generate health report
      const report = await this.generateHealthReport();
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`🎉 Environment started successfully in ${totalTime.toFixed(2)}s`);
      console.log(`Health: ${report.overall.healthy}/${report.overall.total} services running\\n`);
      
      // Show access URLs
      this.showAccessInformation();
      
      return { success: true, duration: totalTime, report };
    } catch (error) {
      const totalTime = (Date.now() - startTime) / 1000;
      console.error(`❌ Environment startup failed after ${totalTime.toFixed(2)}s`);
      console.error(`Error: ${error.message}\\n`);
      
      return { success: false, duration: totalTime, error: error.message };
    }
  }

  showAccessInformation() {
    console.log('🌐 Access Information');
    console.log('====================');
    console.log('Web Application:      http://localhost:3000');
    console.log('API Gateway (Kong):   http://localhost:8000');
    console.log('Kong Admin:           http://localhost:8001');
    console.log('Kibana:               http://localhost:5601');
    console.log('Elasticsearch:        http://localhost:9200');
    console.log('');
    console.log('Service Health Checks:');
    console.log('Auth Service:         http://localhost:3001/health');
    console.log('User Service:         http://localhost:3002/health');
    console.log('LinkedIn Service:     http://localhost:3003/health');
    console.log('Analytics Service:    http://localhost:3004/health');
    console.log('AI Service:           http://localhost:3005/health');
    console.log('WebSocket Service:    http://localhost:3007/health');
    console.log('');
  }

  async stopEnvironment(options = {}) {
    console.log('🛑 Stopping InErgize Development Environment\\n');
    
    const command = options.cleanup ? 
      'docker-compose down -v --remove-orphans' : 
      'docker-compose down';
    
    const result = await this.executeCommand(command);
    
    if (result.success) {
      console.log('✅ Environment stopped successfully');
      
      if (options.cleanup) {
        console.log('🧹 Cleaned up volumes and orphaned containers');
      }
    } else {
      console.error('❌ Failed to stop environment');
    }
    
    return result;
  }

  async restartServices(services = []) {
    if (services.length === 0) {
      console.log('🔄 Restarting all services...');
      services = [
        ...this.services.infrastructure,
        ...this.services.applications,
        ...this.services.frontend
      ];
    } else {
      console.log(`🔄 Restarting services: ${services.join(', ')}...`);
    }

    const command = `docker-compose restart ${services.join(' ')}`;
    const result = await this.executeCommand(command);
    
    if (result.success) {
      console.log('⏳ Waiting for services to be healthy...');
      await this.waitForHealthyServices(services, 120);
      console.log('✅ Services restarted successfully');
    } else {
      console.error('❌ Failed to restart services');
    }
    
    return result;
  }

  async cleanupEnvironment() {
    console.log('🧹 Cleaning up development environment...');
    
    const cleanupTasks = [
      'docker-compose down -v --remove-orphans',
      'docker system prune -f',
      'docker volume prune -f'
    ];

    for (const task of cleanupTasks) {
      console.log(`Running: ${task}`);
      await this.executeCommand(task);
    }

    // Clean up local files
    const filesToClean = [
      '.env-health-report.json',
      '.test-cache.json',
      'test-results-*.json'
    ];

    for (const file of filesToClean) {
      const filePath = join(PROJECT_ROOT, file);
      if (existsSync(filePath)) {
        try {
          require('fs').unlinkSync(filePath);
          console.log(`Removed: ${file}`);
        } catch (error) {
          console.warn(`Could not remove ${file}: ${error.message}`);
        }
      }
    }

    console.log('✅ Environment cleanup completed');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  const options = {
    skipPrereq: args.includes('--skip-prereq'),
    skipDb: args.includes('--skip-db'),
    skipFrontend: args.includes('--skip-frontend'),
    cleanup: args.includes('--cleanup'),
    services: args.filter(arg => !arg.startsWith('--') && arg !== command)
  };

  const manager = new DevelopmentEnvironmentManager();
  
  try {
    switch (command) {
      case 'start':
        await manager.startFullEnvironment(options);
        break;
        
      case 'stop':
        await manager.stopEnvironment(options);
        break;
        
      case 'restart':
        await manager.restartServices(options.services);
        break;
        
      case 'health':
        await manager.generateHealthReport();
        break;
        
      case 'cleanup':
        await manager.cleanupEnvironment();
        break;
        
      case 'urls':
        manager.showAccessInformation();
        break;
        
      default:
        console.log('Usage: dev-env-manager.js [command] [options]');
        console.log('Commands:');
        console.log('  start    - Start full development environment');
        console.log('  stop     - Stop development environment');
        console.log('  restart  - Restart services');
        console.log('  health   - Check environment health');
        console.log('  cleanup  - Clean up environment and files');
        console.log('  urls     - Show access URLs');
        console.log('Options:');
        console.log('  --skip-prereq    - Skip prerequisites check');
        console.log('  --skip-db        - Skip database setup');
        console.log('  --skip-frontend  - Skip frontend startup');
        console.log('  --cleanup        - Remove volumes and orphans');
        process.exit(1);
    }
  } catch (error) {
    console.error(`\\n❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default DevelopmentEnvironmentManager;