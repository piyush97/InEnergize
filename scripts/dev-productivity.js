#!/usr/bin/env node

/**
 * Developer Productivity Tools for InErgize
 * 
 * Features:
 * - Quick service management commands
 * - Database operations shortcuts  
 * - Log aggregation and filtering
 * - Performance profiling tools
 * - Code generation helpers
 * - Workflow shortcuts and aliases
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__dirname);
const PROJECT_ROOT = join(__dirname, '..');

class DeveloperProductivityTools {
  constructor() {
    this.services = [
      'auth-service', 'user-service', 'linkedin-service', 
      'analytics-service', 'ai-service', 'websocket-service', 'web-app'
    ];
    
    this.shortcuts = this.loadShortcuts();
    this.logPatterns = {
      error: /ERROR|Error|error|FATAL|Fatal|fatal/,
      warning: /WARN|Warning|warning/,
      info: /INFO|Info|info/,
      debug: /DEBUG|Debug|debug/,
      linkedin: /linkedin|LinkedIn|LINKEDIN/,
      auth: /auth|Auth|AUTH|jwt|JWT|token/,
      database: /database|Database|DATABASE|prisma|Prisma|PRISMA/
    };
  }

  loadShortcuts() {
    return {
      // Service management
      'start': 'node scripts/dev-env-manager.js start',
      'stop': 'node scripts/dev-env-manager.js stop',
      'restart': 'node scripts/dev-env-manager.js restart',
      'health': 'node scripts/dev-env-manager.js health',
      'logs': 'docker-compose logs -f',
      
      // Database operations
      'db-reset': 'bun run db:reset && bun run db:migrate && bun run db:seed',
      'db-migrate': 'bun run db:migrate',
      'db-seed': 'bun run db:seed',
      'db-studio': 'bun run db:studio',
      
      // Testing shortcuts
      'test-quick': 'node scripts/test-runner.js --fast',
      'test-unit': 'bun run test:unit',
      'test-integration': 'bun run test:integration',
      'test-e2e': 'bun run test:e2e',
      'test-compliance': 'bun run test:compliance',
      
      // Code quality
      'lint-fix': 'bun run lint && bunx prettier --write .',
      'type-check': 'bun run type-check',
      'security-audit': 'bun audit',
      
      // Performance tools
      'perf-profile': 'node scripts/dev-productivity.js profile',
      'perf-monitor': 'node scripts/monitoring-automation.js start',
      
      // Development helpers
      'gen-component': 'node scripts/dev-productivity.js generate component',
      'gen-service': 'node scripts/dev-productivity.js generate service',
      'gen-test': 'node scripts/dev-productivity.js generate test'
    };
  }

  async executeCommand(command, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Executing: ${command}`);
      const result = execSync(command, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        timeout: options.timeout || 120000,
        ...options
      });
      
      const duration = Date.now() - startTime;
      if (!options.silent) {
        console.log(`✅ Completed in ${(duration / 1000).toFixed(2)}s`);
      }
      
      return { success: true, output: result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      if (!options.silent) {
        console.error(`❌ Failed after ${(duration / 1000).toFixed(2)}s`);
        console.error(`Error: ${error.message}`);
      }
      
      return { success: false, error: error.message, duration };
    }
  }

  async runShortcut(shortcut, args = []) {
    if (!this.shortcuts[shortcut]) {
      console.error(`❌ Unknown shortcut: ${shortcut}`);
      console.log('Available shortcuts:');
      Object.keys(this.shortcuts).forEach(key => {
        console.log(`  ${key}: ${this.shortcuts[key]}`);
      });
      return false;
    }

    const command = `${this.shortcuts[shortcut]} ${args.join(' ')}`.trim();
    const result = await this.executeCommand(command);
    return result.success;
  }

  async aggregateLogs(options = {}) {
    console.log('📋 Aggregating logs from all services...');
    
    const services = options.services || this.services;
    const since = options.since || '1h';
    const pattern = options.pattern || null;
    
    const logData = {};
    
    for (const service of services) {
      console.log(`Collecting logs from ${service}...`);
      
      const result = await this.executeCommand(
        `docker-compose logs --since=${since} --no-color ${service}`,
        { silent: true, timeout: 30000 }
      );
      
      if (result.success) {
        let logs = result.output.split('\\n');
        
        // Filter by pattern if specified
        if (pattern && this.logPatterns[pattern]) {
          logs = logs.filter(line => this.logPatterns[pattern].test(line));
        }
        
        logData[service] = logs;
      } else {
        logData[service] = [`Error collecting logs: ${result.error}`];
      }
    }

    // Generate log summary
    const summary = {
      timestamp: new Date().toISOString(),
      timeRange: since,
      services: services.length,
      totalLines: Object.values(logData).flat().length,
      errorCount: this.countLogsByPattern(logData, 'error'),
      warningCount: this.countLogsByPattern(logData, 'warning'),
      pattern: pattern || 'all'
    };

    // Save aggregated logs
    const logsDir = join(PROJECT_ROOT, '.dev-logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = join(logsDir, `aggregated-logs-${timestamp}.json`);
    
    writeFileSync(logFile, JSON.stringify({
      summary,
      logs: logData
    }, null, 2));

    console.log('\\n📊 Log Summary:');
    console.log(`Time Range: ${since}`);
    console.log(`Total Lines: ${summary.totalLines}`);
    console.log(`Errors: ${summary.errorCount}`);
    console.log(`Warnings: ${summary.warningCount}`);
    console.log(`Saved to: ${logFile}\\n`);

    // Display recent errors
    if (summary.errorCount > 0) {
      console.log('🚨 Recent Errors:');
      for (const [service, logs] of Object.entries(logData)) {
        const errors = logs.filter(line => this.logPatterns.error.test(line));
        if (errors.length > 0) {
          console.log(`\\n${service}:`);
          errors.slice(-3).forEach(error => console.log(`  ${error}`));
        }
      }
    }

    return { summary, logFile };
  }

  countLogsByPattern(logData, pattern) {
    if (!this.logPatterns[pattern]) return 0;
    
    return Object.values(logData)
      .flat()
      .filter(line => this.logPatterns[pattern].test(line))
      .length;
  }

  async profilePerformance(options = {}) {
    console.log('⚡ Starting performance profiling...');
    
    const duration = options.duration || 60; // seconds
    const services = options.services || this.services;
    
    const profileData = {
      timestamp: new Date().toISOString(),
      duration,
      services: {}
    };

    // Collect baseline metrics
    console.log('📊 Collecting baseline metrics...');
    const baselineStats = await this.getDockerStats();
    
    // Run load test if requested
    if (options.loadTest) {
      console.log('🔄 Running load test...');
      await this.runLoadTest(options.loadTestConfig);
    }

    // Monitor for specified duration
    console.log(`⏱️  Monitoring for ${duration} seconds...`);
    const monitoringInterval = 5000; // 5 seconds
    const iterations = Math.floor((duration * 1000) / monitoringInterval);
    
    for (let i = 0; i < iterations; i++) {
      const stats = await this.getDockerStats();
      const timestamp = new Date().toISOString();
      
      for (const service of services) {
        if (!profileData.services[service]) {
          profileData.services[service] = {
            cpu: [],
            memory: [],
            responseTime: []
          };
        }
        
        const serviceStats = stats.containers.find(c => c.name.includes(service));
        if (serviceStats) {
          profileData.services[service].cpu.push({
            timestamp,
            value: serviceStats.cpu
          });
          
          profileData.services[service].memory.push({
            timestamp,
            usage: serviceStats.memory
          });
        }
        
        // Check response time
        const responseTime = await this.checkResponseTime(service);
        if (responseTime) {
          profileData.services[service].responseTime.push({
            timestamp,
            value: responseTime
          });
        }
      }
      
      process.stdout.write(`\\rProgress: ${Math.round(((i + 1) / iterations) * 100)}%`);
      await this.sleep(monitoringInterval);
    }
    
    console.log('\\n');

    // Generate performance analysis
    const analysis = this.analyzePerformanceData(profileData, baselineStats);
    
    // Save profile data
    const profilesDir = join(PROJECT_ROOT, '.dev-profiles');
    if (!existsSync(profilesDir)) {
      mkdirSync(profilesDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const profileFile = join(profilesDir, `performance-profile-${timestamp}.json`);
    
    writeFileSync(profileFile, JSON.stringify({
      profileData,
      analysis
    }, null, 2));

    console.log('📈 Performance Analysis Summary:');
    console.log(JSON.stringify(analysis, null, 2));
    console.log(`\\nDetailed profile saved to: ${profileFile}`);

    return { profileData, analysis, profileFile };
  }

  async getDockerStats() {
    const result = await this.executeCommand(
      'docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"',
      { silent: true }
    );

    if (!result.success) {
      return { containers: [], healthy: false };
    }

    const lines = result.output.split('\\n').slice(1);
    const containers = [];

    for (const line of lines) {
      if (line.trim()) {
        const [name, cpu, memory] = line.split('\\t');
        containers.push({
          name: name.trim(),
          cpu: parseFloat(cpu.replace('%', '')) || 0,
          memory: memory.trim()
        });
      }
    }

    return { containers, healthy: true };
  }

  async checkResponseTime(service) {
    const endpoints = {
      'auth-service': 'http://localhost:3001/health',
      'user-service': 'http://localhost:3002/health',
      'linkedin-service': 'http://localhost:3003/health',
      'analytics-service': 'http://localhost:3004/health',
      'ai-service': 'http://localhost:3005/health',
      'websocket-service': 'http://localhost:3007/health',
      'web-app': 'http://localhost:3000'
    };

    const endpoint = endpoints[service];
    if (!endpoint) return null;

    const startTime = Date.now();
    const result = await this.executeCommand(
      `curl -f -s --max-time 5 ${endpoint}`,
      { silent: true, timeout: 10000 }
    );

    const responseTime = Date.now() - startTime;
    return result.success ? responseTime : null;
  }

  analyzePerformanceData(profileData, baseline) {
    const analysis = {
      summary: {},
      alerts: [],
      recommendations: []
    };

    for (const [service, data] of Object.entries(profileData.services)) {
      const cpuValues = data.cpu.map(d => d.value);
      const responseTimeValues = data.responseTime.map(d => d.value);

      const serviceAnalysis = {
        cpu: {
          avg: this.average(cpuValues),
          max: Math.max(...cpuValues),
          min: Math.min(...cpuValues)
        },
        responseTime: {
          avg: this.average(responseTimeValues),
          max: Math.max(...responseTimeValues),
          min: Math.min(...responseTimeValues),
          p95: this.percentile(responseTimeValues, 95)
        }
      };

      analysis.summary[service] = serviceAnalysis;

      // Generate alerts
      if (serviceAnalysis.cpu.avg > 80) {
        analysis.alerts.push(`${service}: High CPU usage (${serviceAnalysis.cpu.avg.toFixed(1)}%)`);
      }

      if (serviceAnalysis.responseTime.p95 > 1000) {
        analysis.alerts.push(`${service}: Slow response time P95 (${serviceAnalysis.responseTime.p95}ms)`);
      }

      // Generate recommendations
      if (serviceAnalysis.cpu.max > 90) {
        analysis.recommendations.push(`${service}: Consider CPU scaling or optimization`);
      }

      if (serviceAnalysis.responseTime.avg > 500) {
        analysis.recommendations.push(`${service}: Optimize response time (current avg: ${serviceAnalysis.responseTime.avg}ms)`);
      }
    }

    return analysis;
  }

  async runLoadTest(config = {}) {
    const defaultConfig = {
      url: 'http://localhost:3000',
      duration: '30s',
      users: 10,
      rampUp: '10s'
    };

    const loadConfig = { ...defaultConfig, ...config };
    
    console.log(`🔄 Running load test: ${loadConfig.users} users for ${loadConfig.duration}`);
    
    // Use k6 if available, otherwise simulate load
    const k6Available = await this.executeCommand('which k6', { silent: true });
    
    if (k6Available.success) {
      const k6Script = `
        import http from 'k6/http';
        import { check } from 'k6';
        
        export let options = {
          stages: [
            { duration: '${loadConfig.rampUp}', target: ${loadConfig.users} },
            { duration: '${loadConfig.duration}', target: ${loadConfig.users} },
            { duration: '10s', target: 0 }
          ]
        };
        
        export default function() {
          let response = http.get('${loadConfig.url}');
          check(response, {
            'status is 200': (r) => r.status === 200,
            'response time < 500ms': (r) => r.timings.duration < 500
          });
        }
      `;
      
      writeFileSync('/tmp/loadtest.js', k6Script);
      await this.executeCommand('k6 run /tmp/loadtest.js', { timeout: 120000 });
    } else {
      console.log('⚠️  k6 not available, skipping load test');
    }
  }

  async generateCode(type, name, options = {}) {
    console.log(`🏗️  Generating ${type}: ${name}`);
    
    const generators = {
      component: this.generateReactComponent,
      service: this.generateMicroservice,
      test: this.generateTestFile,
      migration: this.generateMigration,
      api: this.generateApiEndpoint
    };

    const generator = generators[type];
    if (!generator) {
      console.error(`❌ Unknown generator type: ${type}`);
      console.log('Available generators:', Object.keys(generators).join(', '));
      return false;
    }

    try {
      const result = await generator.call(this, name, options);
      console.log(`✅ Generated ${type}: ${result.path}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to generate ${type}:`, error.message);
      return false;
    }
  }

  generateReactComponent(name, options = {}) {
    const componentName = name.charAt(0).toUpperCase() + name.slice(1);
    const fileName = `${componentName}.tsx`;
    const path = join(PROJECT_ROOT, 'web/src/components', options.directory || 'generated', fileName);

    const template = `import React from 'react';

interface ${componentName}Props {
  // Add your props here
}

const ${componentName}: React.FC<${componentName}Props> = ({}) => {
  return (
    <div className="${name.toLowerCase()}">
      <h2>${componentName}</h2>
      {/* Add your component content here */}
    </div>
  );
};

export default ${componentName};
`;

    // Ensure directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, template);
    
    // Generate corresponding test file
    const testPath = path.replace('.tsx', '.test.tsx');
    const testTemplate = `import React from 'react';
import { render, screen } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  it('renders correctly', () => {
    render(<${componentName} />);
    expect(screen.getByText('${componentName}')).toBeInTheDocument();
  });
});
`;

    writeFileSync(testPath, testTemplate);

    return { path, testPath };
  }

  generateMicroservice(name, options = {}) {
    const serviceName = `${name}-service`;
    const servicePath = join(PROJECT_ROOT, 'services', serviceName);

    if (existsSync(servicePath)) {
      throw new Error(`Service ${serviceName} already exists`);
    }

    // Create service directory structure
    mkdirSync(servicePath, { recursive: true });
    mkdirSync(join(servicePath, 'src'), { recursive: true });
    mkdirSync(join(servicePath, 'src', 'routes'), { recursive: true });
    mkdirSync(join(servicePath, 'src', 'services'), { recursive: true });
    mkdirSync(join(servicePath, 'src', 'models'), { recursive: true });
    mkdirSync(join(servicePath, 'tests'), { recursive: true });

    // Generate package.json
    const packageJson = {
      name: serviceName,
      version: '1.0.0',
      description: `${name} microservice for InErgize`,
      main: 'dist/index.js',
      scripts: {
        dev: 'nodemon src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
        test: 'jest',
        'test:watch': 'jest --watch'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        helmet: '^7.0.0',
        dotenv: '^16.0.0'
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/cors': '^2.8.0',
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
        nodemon: '^3.0.0',
        'ts-node': '^10.0.0',
        jest: '^29.0.0',
        '@types/jest': '^29.0.0'
      }
    };

    writeFileSync(join(servicePath, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Generate main service file
    const indexTemplate = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: '${serviceName}',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.get('/api/${name}', (req, res) => {
  res.json({
    message: 'Hello from ${serviceName}!',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`${serviceName} running on port \${PORT}\`);
});

export default app;
`;

    writeFileSync(join(servicePath, 'src', 'index.ts'), indexTemplate);

    // Generate TypeScript config
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    };

    writeFileSync(join(servicePath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

    // Generate Dockerfile
    const dockerfile = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
`;

    writeFileSync(join(servicePath, 'Dockerfile'), dockerfile);

    return { path: servicePath };
  }

  generateTestFile(name, options = {}) {
    const testPath = join(PROJECT_ROOT, 'tests', options.directory || 'generated', `${name}.test.ts`);
    
    const template = `describe('${name}', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should work correctly', () => {
    // Add your test assertions here
    expect(true).toBe(true);
  });

  it('should handle edge cases', () => {
    // Add edge case tests
  });

  it('should handle errors gracefully', () => {
    // Add error handling tests
  });
});
`;

    const dir = dirname(testPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(testPath, template);
    return { path: testPath };
  }

  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  percentile(numbers, percentile) {
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showHelp() {
    console.log('🛠️  InErgize Developer Productivity Tools');
    console.log('========================================\\n');
    
    console.log('Shortcuts:');
    Object.entries(this.shortcuts).forEach(([key, value]) => {
      console.log(`  ${key.padEnd(15)} - ${value}`);
    });
    
    console.log('\\nCommands:');
    console.log('  logs [service] [pattern] [since] - Aggregate and filter logs');
    console.log('  profile [duration] [--load-test] - Performance profiling');
    console.log('  generate <type> <name> [options] - Code generation');
    console.log('  shortcut <name> [args...]        - Run predefined shortcut');
    console.log('\\nExamples:');
    console.log('  dev-productivity.js logs linkedin-service error 2h');
    console.log('  dev-productivity.js profile 120 --load-test');
    console.log('  dev-productivity.js generate component UserProfile');
    console.log('  dev-productivity.js shortcut test-quick');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const tools = new DeveloperProductivityTools();
  
  try {
    switch (command) {
      case 'logs':
        const service = args[1];
        const pattern = args[2];
        const since = args[3] || '1h';
        await tools.aggregateLogs({
          services: service ? [service] : undefined,
          pattern,
          since
        });
        break;
        
      case 'profile':
        const duration = parseInt(args[1]) || 60;
        const loadTest = args.includes('--load-test');
        await tools.profilePerformance({
          duration,
          loadTest
        });
        break;
        
      case 'generate':
        const type = args[1];
        const name = args[2];
        if (!type || !name) {
          console.error('❌ Usage: generate <type> <name>');
          process.exit(1);
        }
        await tools.generateCode(type, name);
        break;
        
      case 'shortcut':
        const shortcut = args[1];
        const shortcutArgs = args.slice(2);
        if (!shortcut) {
          console.error('❌ Usage: shortcut <name> [args...]');
          process.exit(1);
        }
        await tools.runShortcut(shortcut, shortcutArgs);
        break;
        
      default:
        tools.showHelp();
        if (command) {
          console.log(`\\n❌ Unknown command: ${command}`);
          process.exit(1);
        }
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

export default DeveloperProductivityTools;