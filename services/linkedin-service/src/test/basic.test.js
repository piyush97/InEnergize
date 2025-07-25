// Basic smoke test for LinkedIn service
// Using JavaScript to avoid TypeScript compilation issues during development

const { spawn } = require('child_process');
const http = require('http');

describe('LinkedIn Service Basic Tests', () => {
  test('should be able to import the service files', () => {
    expect(() => {
      // Just check that files can be loaded
      require('../services/rateLimit.service.ts');
    }).not.toThrow();
  });

  test('service should start without crashing', (done) => {
    const server = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    let output = '';
    server.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('LinkedIn service started') || output.includes('listening')) {
        server.kill();
        done();
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    server.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        done(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      server.kill();
      done(new Error('Server startup timeout'));
    }, 10000);
  });
});