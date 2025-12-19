import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for Obsidian plugin E2E testing
 *
 * Key constraints:
 * - Obsidian is single-instance (no parallel tests)
 * - App launch is slow (~5-10 seconds)
 * - Tests connect to Obsidian via CDP, not browser launch
 */
export default defineConfig({
  testDir: './e2e',

  // Obsidian launch can be slow, especially first time
  timeout: 60000,

  // Expect assertions should complete quickly once app is loaded
  expect: {
    timeout: 5000
  },

  // Obsidian is single-instance - must run tests serially
  fullyParallel: false,
  workers: 1,

  // Don't retry by default (flaky tests should be fixed, not retried)
  retries: 0,

  // Capture artifacts on failure for debugging
  use: {
    // Capture screenshot only when test fails
    screenshot: 'only-on-failure',

    // Capture trace on first retry (if retries are enabled)
    trace: 'on-first-retry',

    // Video recording off by default (expensive, Obsidian UI isn't useful)
    video: 'off',
  },

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/test-results/html' }]
  ],

  // Output directory for test artifacts
  outputDir: 'e2e/test-results/artifacts',
});
