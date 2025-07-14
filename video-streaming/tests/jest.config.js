/**
 * Jest Configuration for Player Testing
 * Optimized for testing Video.js and FLV.js integration
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js'
  ],
  
  // Test patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/vendor/**',
    '!**/node_modules/**'
  ],
  
  coverageDirectory: 'test-results/coverage',
  
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical files
    'public/js/app.js': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90
    }
  },
  
  // Module mapping for mocks
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/public/js/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Globals
  globals: {
    'window': {},
    'document': {},
    'navigator': {},
    'performance': {
      now: () => Date.now()
    }
  },
  
  // Mock modules
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/test-results/'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'jest-results.xml'
    }],
    ['jest-html-reporters', {
      publicPath: 'test-results/jest-report',
      filename: 'report.html',
      openReport: false
    }]
  ],
  
  // Error handling
  errorOnDeprecated: true,
  
  // Watch options
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/test-results/',
    '<rootDir>/recordings/',
    '<rootDir>/logs/'
  ],
  
  // Test result processor
  testResultsProcessor: '<rootDir>/tests/utils/test-results-processor.js'
};