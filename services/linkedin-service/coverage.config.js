/** @type {import('jest').Config} */
module.exports = {
  // Coverage collection settings
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts', // Main entry point
    '!src/test/**/*', // Test files
    '!src/types/**/*', // Type definitions only
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds - these will be enforced
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Service-specific thresholds
    './src/services/rateLimit.service.ts': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    },
    './src/services/completeness.service.ts': {
      branches: 75,
      functions: 80,
      lines: 75,
      statements: 75
    },
    './src/services/oauth.service.ts': {
      branches: 70,
      functions: 75,
      lines: 70,
      statements: 70
    }
  },
  
  // Coverage reporting
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  coverageDirectory: 'coverage',
  
  // Coverage provider
  coverageProvider: 'v8'
};