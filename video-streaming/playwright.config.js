/**
 * Playwright Configuration for Video Streaming Platform E2E Tests
 * @type {import('@playwright/test').PlaywrightTestConfig}
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Ignore HTTPS errors for local testing */
    ignoreHTTPSErrors: true,
    
    /* Global timeout for actions */
    actionTimeout: 30000,
    
    /* Navigation timeout */
    navigationTimeout: 30000
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm start',
      port: 3000,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'echo "RTMP server starts with main server"',
      port: 1935,
      timeout: 5000,
      reuseExistingServer: !process.env.CI,
    }
  ],

  /* Test timeout */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000
  },

  /* Test output directory */
  outputDir: 'test-results',

  /* Global test settings */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ],

  /* Metadata for test reports */
  metadata: {
    project: 'Video Streaming Platform',
    testType: 'End-to-End',
    environment: process.env.NODE_ENV || 'test'
  }
});