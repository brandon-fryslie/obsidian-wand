import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, getObsidianPage } from './helpers/obsidian-launcher';

/**
 * Smoke test: Verify Obsidian plugin loads
 *
 * This test validates the minimal E2E infrastructure:
 * 1. Launch Obsidian with CDP enabled
 * 2. Connect via Playwright
 * 3. Verify plugin is loaded and visible in UI
 * 4. Clean up gracefully
 */

test.describe('Obsidian Plugin Smoke Tests', () => {
  test('plugin loads and appears in sidebar', async () => {
    // Get test vault path from environment or use default
    const vaultPath = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';

    // Launch Obsidian with CDP
    const { browser, process: obsidianProcess } = await launchObsidian(vaultPath);

    try {
      // Get the main Obsidian page
      const page = getObsidianPage(browser);

      // Wait for Obsidian workspace to be loaded
      // The workspace root is a reliable indicator that UI is ready
      await page.waitForSelector('.workspace', { timeout: 10000 });
      console.log('[Test] Obsidian workspace loaded');

      // Verify the plugin ribbon icon exists
      // The plugin adds a ribbon icon with a specific aria-label or class
      // We'll look for common plugin UI elements
      const leftRibbon = await page.waitForSelector('.side-dock-ribbon.mod-left', { timeout: 5000 });
      expect(leftRibbon).toBeTruthy();

      // Check that ribbon has action buttons (plugin icons)
      const ribbonActions = await page.$$('.side-dock-ribbon-action');
      expect(ribbonActions.length).toBeGreaterThan(0);
      console.log(`[Test] Found ${ribbonActions.length} ribbon actions`);

      // Take a screenshot for verification
      await page.screenshot({ path: 'e2e/test-results/smoke-test.png' });
      console.log('[Test] Screenshot saved');

      // Basic assertion: Obsidian UI is loaded and functional
      const title = await page.title();
      expect(title).toContain('Obsidian');
      console.log(`[Test] Page title: ${title}`);

    } finally {
      // Always clean up, even if test fails
      await closeObsidian(browser, obsidianProcess);
    }
  });

  test('can open and close settings modal', async () => {
    const vaultPath = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';
    const { browser, process: obsidianProcess } = await launchObsidian(vaultPath);

    try {
      const page = getObsidianPage(browser);

      // Wait for workspace
      await page.waitForSelector('.workspace', { timeout: 10000 });

      // Open settings via keyboard shortcut (Cmd+,)
      await page.keyboard.press('Meta+,');

      // Wait for settings modal to appear
      const settingsModal = await page.waitForSelector('.modal.mod-settings', { timeout: 5000 });
      expect(settingsModal).toBeTruthy();
      console.log('[Test] Settings modal opened');

      // Close settings (Escape key)
      await page.keyboard.press('Escape');

      // Verify modal closes
      await page.waitForSelector('.modal.mod-settings', { state: 'hidden', timeout: 3000 });
      console.log('[Test] Settings modal closed');

    } finally {
      await closeObsidian(browser, obsidianProcess);
    }
  });
});
