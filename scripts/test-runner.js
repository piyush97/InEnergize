#!/usr/bin/env node

/**
 * Intelligent Test Runner for InErgize
 * 
 * Features:
 * - Smart test selection based on file changes
 * - Parallel test execution with optimal worker allocation
 * - Test result caching and incremental testing
 * - Performance monitoring and optimization
 * - Automated test categorization and prioritization
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

class IntelligentTestRunner {
  constructor() {
    this.config = this.loadConfig();
    this.gitChanges = this.getGitChanges();
    this.testCache = this.loadTestCache();
    this.maxWorkers = this.calculateOptimalWorkers();
  }

  loadConfig() {
    const defaultConfig = {
      testPatterns: {
        unit: '**/*.test.{ts,tsx,js,jsx}',
        integration: '**/integration/**/*.test.{ts,tsx,js,jsx}',
        e2e: '**/e2e/**/*.{test,spec}.{ts,tsx,js,jsx}',
        performance: '**/performance/**/*.test.{ts,tsx,js,jsx}',
        security: '**/*security*.test.{ts,tsx,js,jsx}',
        compliance: '**/compliance/**/*.test.{ts,tsx,js,jsx}'
      },
      parallelism: {
        unit: 4,
        integration: 2,
        e2e: 1,
        performance: 1
      },
      priorities: {
        critical: ['auth', 'security', 'linkedin-compliance'],
        high: ['user', 'analytics', 'ai'],
        medium: ['ui', 'performance'],
        low: ['documentation', 'utils']
      },
      timeouts: {
        unit: 30000,
        integration: 120000,
        e2e: 300000,
        performance: 600000
      }
    };

    try {
      const configPath = join(PROJECT_ROOT, 'test-runner.config.json');
      if (existsSync(configPath)) {
        return { ...defaultConfig, ...JSON.parse(readFileSync(configPath, 'utf8')) };
      }
    } catch (error) {
      console.warn('Using default test runner configuration');
    }

    return defaultConfig;
  }

  getGitChanges() {
    try {
      const changed = execSync('git diff --name-only HEAD~1 HEAD', { 
        encoding: 'utf8',
        cwd: PROJECT_ROOT 
      }).trim().split('\\n').filter(Boolean);
      
      const staged = execSync('git diff --cached --name-only', { 
        encoding: 'utf8',
        cwd: PROJECT_ROOT 
      }).trim().split('\\n').filter(Boolean);
      
      return [...new Set([...changed, ...staged])];
    } catch (error) {
      // If git command fails, return empty array (run all tests)
      return [];
    }
  }

  loadTestCache() {
    try {
      const cachePath = join(PROJECT_ROOT, '.test-cache.json');
      if (existsSync(cachePath)) {
        return JSON.parse(readFileSync(cachePath, 'utf8'));
      }
    } catch (error) {
      console.warn('Unable to load test cache');
    }
    
    return {
      lastRun: null,
      testResults: {},
      fileHashes: {},
      failedTests: []
    };
  }

  saveTestCache() {
    try {
      const cachePath = join(PROJECT_ROOT, '.test-cache.json');
      writeFileSync(cachePath, JSON.stringify(this.testCache, null, 2));
    } catch (error) {
      console.warn('Unable to save test cache');
    }
  }

  calculateOptimalWorkers() {
    const cpuCount = require('os').cpus().length;
    const memoryGB = require('os').totalmem() / (1024 * 1024 * 1024);
    
    // Conservative allocation: max 75% of CPUs, ensure 2GB RAM per worker
    const maxWorkersByCPU = Math.max(1, Math.floor(cpuCount * 0.75));
    const maxWorkersByRAM = Math.max(1, Math.floor(memoryGB / 2));
    
    return Math.min(maxWorkersByCPU, maxWorkersByRAM, 8); // Cap at 8 workers
  }

  identifyAffectedTests() {
    if (!this.gitChanges.length) {
      return { all: true, tests: [] };
    }

    const affectedTests = new Set();
    const serviceMap = {
      'services/auth-service': ['auth', 'authentication', 'security'],
      'services/user-service': ['user', 'profile'],
      'services/linkedin-service': ['linkedin', 'automation', 'compliance'],
      'services/analytics-service': ['analytics', 'metrics', 'timescale'],
      'services/ai-service': ['ai', 'content', 'generation'],
      'web': ['ui', 'frontend', 'next']
    };

    // Map changed files to test categories
    for (const changedFile of this.gitChanges) {
      // Direct test file changes
      if (changedFile.includes('.test.') || changedFile.includes('.spec.')) {
        affectedTests.add(changedFile);
        continue;
      }

      // Service-specific changes
      for (const [servicePath, keywords] of Object.entries(serviceMap)) {
        if (changedFile.startsWith(servicePath)) {
          keywords.forEach(keyword => affectedTests.add(`**/*${keyword}*.test.*`));
        }
      }

      // Infrastructure changes affect all tests
      if (changedFile.includes('docker-compose') || 
          changedFile.includes('infrastructure/') ||
          changedFile.includes('package.json')) {
        return { all: true, tests: [] };
      }
    }

    return { 
      all: false, 
      tests: Array.from(affectedTests),
      priority: this.prioritizeTests(Array.from(affectedTests))
    };
  }

  prioritizeTests(testList) {
    const prioritized = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    for (const test of testList) {
      let assigned = false;
      
      for (const [priority, keywords] of Object.entries(this.config.priorities)) {
        if (keywords.some(keyword => test.includes(keyword))) {
          prioritized[priority].push(test);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        prioritized.medium.push(test);
      }
    }

    return prioritized;
  }

  async runTestSuite(type, testPattern, options = {}) {
    const startTime = Date.now();
    console.log(`\\n🧪 Running ${type} tests...`);
    
    const workers = options.workers || this.config.parallelism[type] || this.maxWorkers;
    const timeout = options.timeout || this.config.timeouts[type] || 60000;
    
    const jestConfig = {
      testMatch: [testPattern],
      maxWorkers: workers,
      testTimeout: timeout,
      collectCoverage: options.coverage || false,
      coverageReporters: ['text-summary', 'json'],
      passWithNoTests: true,
      verbose: options.verbose || false,
      bail: options.bail || false,
      json: true,
      outputFile: `test-results-${type}.json`
    };

    // Add changed file filter for incremental testing
    if (options.onlyChanged && this.gitChanges.length > 0) {
      jestConfig.changedSince = 'HEAD~1';
    }

    try {
      const command = this.buildJestCommand(jestConfig);
      console.log(`Executing: ${command}`);
      
      const result = await this.executeCommand(command);
      const duration = Date.now() - startTime;
      
      this.recordTestResults(type, result, duration);
      
      console.log(`✅ ${type} tests completed in ${(duration / 1000).toFixed(2)}s`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${type} tests failed after ${(duration / 1000).toFixed(2)}s`);
      console.error(error.message);
      
      this.recordTestResults(type, { success: false, error: error.message }, duration);
      throw error;
    }
  }

  buildJestCommand(config) {
    const args = [];
    
    if (config.testMatch) {
      args.push(`--testPathPattern="${config.testMatch.join('|')}"`);
    }
    
    if (config.maxWorkers) {
      args.push(`--maxWorkers=${config.maxWorkers}`);
    }
    
    if (config.testTimeout) {
      args.push(`--testTimeout=${config.testTimeout}`);
    }
    
    if (config.collectCoverage) {
      args.push('--coverage');
      args.push(`--coverageReporters=${config.coverageReporters.join(',')}`);
    }
    
    if (config.passWithNoTests) {
      args.push('--passWithNoTests');
    }
    
    if (config.verbose) {
      args.push('--verbose');
    }
    
    if (config.bail) {
      args.push('--bail');
    }
    
    if (config.json && config.outputFile) {
      args.push('--json');
      args.push(`--outputFile=${config.outputFile}`);
    }
    
    if (config.changedSince) {
      args.push(`--changedSince=${config.changedSince}`);
    }

    return `bunx jest ${args.join(' ')}`;
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, code });
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  recordTestResults(type, result, duration) {
    this.testCache.lastRun = new Date().toISOString();
    this.testCache.testResults[type] = {
      ...result,
      duration,
      timestamp: new Date().toISOString()
    };
    
    this.saveTestCache();
  }

  async runIntelligentTestSuite(options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting Intelligent Test Runner for InErgize\\n');
    
    const affectedTests = this.identifyAffectedTests();
    
    if (options.force || affectedTests.all) {
      console.log('📋 Running full test suite (no specific changes detected)');
      return this.runFullTestSuite(options);
    }
    
    console.log(`📋 Running targeted tests for ${affectedTests.tests.length} affected areas`);
    console.log('Priority breakdown:', JSON.stringify(affectedTests.priority, null, 2));
    
    return this.runTargetedTests(affectedTests, options);
  }

  async runFullTestSuite(options = {}) {
    const results = {};
    
    try {
      // Run tests in priority order for fail-fast feedback
      if (!options.skipUnit) {
        results.unit = await this.runTestSuite('unit', 
          this.config.testPatterns.unit, 
          { workers: this.maxWorkers, coverage: options.coverage }
        );
      }
      
      if (!options.skipIntegration) {
        results.integration = await this.runTestSuite('integration', 
          this.config.testPatterns.integration,
          { workers: Math.max(2, Math.floor(this.maxWorkers / 2)) }
        );
      }
      
      if (!options.skipSecurity) {
        results.security = await this.runTestSuite('security', 
          this.config.testPatterns.security,
          { workers: 2, timeout: 120000 }
        );
      }
      
      if (!options.skipCompliance) {
        results.compliance = await this.runTestSuite('compliance', 
          this.config.testPatterns.compliance,
          { workers: 1, timeout: 300000 }
        );
      }
      
      if (!options.skipE2e) {
        results.e2e = await this.runTestSuite('e2e', 
          this.config.testPatterns.e2e,  
          { workers: 1, timeout: 600000 }
        );
      }
      
      return results;
    } catch (error) {
      console.error('Full test suite failed:', error.message);
      throw error;
    }
  }

  async runTargetedTests(affectedTests, options = {}) {
    const results = {};
    
    try {
      // Run critical tests first
      if (affectedTests.priority.critical.length > 0) {
        console.log('🔥 Running critical tests first...');
        results.critical = await this.runTestSuite('critical',
          affectedTests.priority.critical,
          { workers: Math.min(2, this.maxWorkers), bail: true }
        );
      }
      
      // Run high priority tests in parallel
      if (affectedTests.priority.high.length > 0) {
        console.log('⚡ Running high priority tests...');
        results.high = await this.runTestSuite('high',
          affectedTests.priority.high,
          { workers: this.maxWorkers }
        );
      }
      
      // Run medium and low priority tests if time permits
      if (affectedTests.priority.medium.length > 0 && !options.fastMode) {
        results.medium = await this.runTestSuite('medium',
          affectedTests.priority.medium,
          { workers: Math.max(2, Math.floor(this.maxWorkers / 2)) }
        );
      }
      
      return results;
    } catch (error) {
      console.error('Targeted test run failed:', error.message);
      throw error;
    }
  }

  generateReport(results) {
    const totalDuration = Object.values(results)
      .reduce((sum, result) => sum + (result.duration || 0), 0);
    
    console.log('\\n📊 Test Run Summary');
    console.log('===================');
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Worker Utilization: ${this.maxWorkers} workers`);
    
    for (const [type, result] of Object.entries(results)) {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? `(${(result.duration / 1000).toFixed(2)}s)` : '';
      console.log(`${status} ${type}: ${result.success ? 'PASSED' : 'FAILED'} ${duration}`);
    }
    
    const overallSuccess = Object.values(results).every(r => r.success);
    console.log(`\\n🎯 Overall Result: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    
    return overallSuccess;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    force: args.includes('--force'),
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    fastMode: args.includes('--fast'),
    skipUnit: args.includes('--skip-unit'),
    skipIntegration: args.includes('--skip-integration'),
    skipE2e: args.includes('--skip-e2e'),
    skipSecurity: args.includes('--skip-security'),
    skipCompliance: args.includes('--skip-compliance')
  };

  const runner = new IntelligentTestRunner();
  
  try {
    const results = await runner.runIntelligentTestSuite(options);
    const success = runner.generateReport(results);
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\\n❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default IntelligentTestRunner;