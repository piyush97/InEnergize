#!/usr/bin/env node

/**
 * InErgize Health Check Script (Node.js)
 * Comprehensive health monitoring for all services
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SCRIPT_PATH = path.join(__dirname, 'health-check.sh');

/**
 * Execute the bash health check script
 */
function runHealthCheck() {
  console.log('🏥 Running InErgize Health Check...\n');

  const healthCheck = spawn('bash', [SCRIPT_PATH], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  healthCheck.on('close', (code) => {
    process.exit(code);
  });

  healthCheck.on('error', (error) => {
    console.error('❌ Failed to execute health check script:', error.message);
    
    if (error.code === 'ENOENT') {
      console.error('\n💡 Troubleshooting:');
      console.error('   • Ensure bash is installed and available in PATH');
      console.error('   • Check that health-check.sh exists and is executable');
      console.error('   • Try running: chmod +x scripts/health-check.sh');
    }
    
    process.exit(1);
  });
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'watch':
  case '-w':
  case '--watch':
    console.log('👀 Starting health check monitoring...\n');
    const watchCheck = spawn('bash', [SCRIPT_PATH, 'watch'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    watchCheck.on('close', (code) => {
      process.exit(code);
    });
    
    watchCheck.on('error', (error) => {
      console.error('❌ Failed to start watch mode:', error.message);
      process.exit(1);
    });
    break;

  case 'quiet':
  case '-q':
  case '--quiet':
    const quietCheck = spawn('bash', [SCRIPT_PATH, 'quiet'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    quietCheck.on('close', (code) => {
      process.exit(code);
    });
    
    quietCheck.on('error', (error) => {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    });
    break;

  case 'help':
  case '-h':
  case '--help':
    console.log('InErgize Health Check Script (Node.js wrapper)');
    console.log('');
    console.log('Usage: npm run dev:health-check [OPTIONS]');
    console.log('');
    console.log('Options:');
    console.log('  (none)           Run health check once');
    console.log('  watch, -w        Run continuous monitoring');
    console.log('  quiet, -q        Quiet mode (exit code only)');
    console.log('  help, -h         Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  npm run dev:health-check           # Run once');
    console.log('  npm run dev:health-check watch     # Continuous monitoring');
    console.log('  npm run dev:health-check quiet     # Exit code only');
    break;

  default:
    runHealthCheck();
    break;
}