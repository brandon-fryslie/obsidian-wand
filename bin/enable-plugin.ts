#!/usr/bin/env npx tsx
/**
 * Automates enabling the plugin in Obsidian via CDP
 *
 * Usage: npx tsx bin/enable-plugin.ts [vault-path]
 */

import { spawn, ChildProcess } from 'child_process';
import { chromium, Browser, Page } from 'playwright';

const OBSIDIAN_PATH = '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
const DEBUG_PORT = 9222;
const PLUGINS_TO_ENABLE = ['hot-reload', 'wand'];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function launchObsidian(vaultPath: string): Promise<{ process: ChildProcess; browser: Browser }> {
  console.log(`[Obsidian] Launching with vault: ${vaultPath}`);

  const obsidianProcess = spawn(OBSIDIAN_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `obsidian://open?path=${encodeURIComponent(vaultPath)}`
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  // Wait for CDP to be ready
  let cdpReady = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!cdpReady && attempts < maxAttempts) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) {
        cdpReady = true;
        console.log('[Obsidian] CDP endpoint ready');
      }
    } catch {
      attempts++;
      await sleep(500);
    }
  }

  if (!cdpReady) {
    obsidianProcess.kill();
    throw new Error('Failed to connect to Obsidian CDP endpoint');
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  console.log('[Obsidian] Connected via CDP');

  return { process: obsidianProcess, browser };
}

async function closeObsidian(browser: Browser, process: ChildProcess): Promise<void> {
  try {
    await browser.close();
    console.log('[Obsidian] Browser connection closed');
  } catch {
    // Ignore close errors
  }

  process.kill('SIGTERM');
  await sleep(500);

  if (!process.killed) {
    process.kill('SIGKILL');
  }
  console.log('[Obsidian] Process terminated');
}

async function findAndEnablePlugin(page: Page, pluginId: string, pluginName: string): Promise<boolean> {
  console.log(`[Setup] Looking for plugin: ${pluginName} (${pluginId})`);

  // Try multiple selectors for finding the plugin
  const selectors = [
    // By data-id attribute
    `div[data-id="${pluginId}"]`,
    // By plugin name text
    `.community-plugin-item:has-text("${pluginName}")`,
    `.installed-plugin-item:has-text("${pluginName}")`,
    // Generic plugin containers
    `div:has-text("${pluginName}"):has(.checkbox-container)`,
  ];

  let pluginElement: ReturnType<typeof page.locator> | null = null;

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
        pluginElement = element;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!pluginElement) {
    // Last resort: look for any toggle with our plugin name nearby
    const allPluginItems = page.locator('.setting-item');
    const count = await allPluginItems.count();

    for (let i = 0; i < count; i++) {
      const item = allPluginItems.nth(i);
      const text = await item.textContent().catch(() => '');
      if (text?.toLowerCase().includes(pluginName.toLowerCase()) || text?.includes(pluginId)) {
        pluginElement = item;
        break;
      }
    }
  }

  if (pluginElement) {
    // Find and click the toggle
    const toggle = pluginElement.locator('.checkbox-container').first();
    if (await toggle.isVisible().catch(() => false)) {
      const isEnabled = await toggle.evaluate(el => el.classList.contains('is-enabled')).catch(() => false);

      if (!isEnabled) {
        await toggle.click();
        await sleep(300);
        console.log(`[Setup] ✓ Enabled: ${pluginName}`);
      } else {
        console.log(`[Setup] ✓ Already enabled: ${pluginName}`);
      }
      return true;
    }
  }

  console.log(`[Setup] ⚠ Not found: ${pluginName}`);
  return false;
}

async function enablePlugins(page: Page): Promise<boolean> {
  // Wait for Obsidian workspace to load
  console.log('[Setup] Waiting for Obsidian workspace...');
  await page.waitForSelector('.workspace', { timeout: 30000 });
  await sleep(1500);

  // Open settings with Cmd+,
  console.log('[Setup] Opening settings...');
  await page.keyboard.press('Meta+,');
  await sleep(1000);

  // Wait for settings modal
  await page.waitForSelector('.modal-container', { timeout: 10000 });
  console.log('[Setup] Settings modal opened');

  // Click on "Community plugins" in sidebar
  const communityPluginsTab = page.locator('.vertical-tab-nav-item').filter({ hasText: 'Community plugins' });
  await communityPluginsTab.click();
  await sleep(1000);
  console.log('[Setup] Navigated to Community plugins');

  // Check if restricted mode is on - look for the "Turn on" button
  const turnOnButton = page.locator('button').filter({ hasText: 'Turn on community plugins' });
  const restrictedModeOn = await turnOnButton.isVisible().catch(() => false);

  if (restrictedModeOn) {
    console.log('[Setup] Restricted mode is ON, enabling community plugins...');
    await turnOnButton.click();
    await sleep(1000);

    // Handle confirmation modal if it appears
    const confirmButton = page.locator('.modal-button-container button').filter({ hasText: 'Turn on' });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await sleep(1000);
    }
    console.log('[Setup] Community plugins enabled');
  } else {
    console.log('[Setup] Community plugins already enabled');
  }

  // Wait a moment for the plugin list to render
  await sleep(500);

  // Plugin name mapping
  const pluginNames: Record<string, string> = {
    'hot-reload': 'Hot Reload',
    'wand': 'Wand',
  };

  // Enable each plugin
  let allSuccess = true;
  for (const pluginId of PLUGINS_TO_ENABLE) {
    const pluginName = pluginNames[pluginId] || pluginId;
    const success = await findAndEnablePlugin(page, pluginId, pluginName);
    if (!success) allSuccess = false;
    await sleep(200);
  }

  // Close settings
  await page.keyboard.press('Escape');
  await sleep(300);
  console.log('[Setup] Settings closed');

  return allSuccess;
}

async function main() {
  const vaultPath = process.argv[2] || `${process.env.HOME}/obsidian-test-vault`;
  const expandedPath = vaultPath.replace(/^~/, process.env.HOME || '');

  console.log('='.repeat(50));
  console.log('Obsidian Plugin Enabler');
  console.log('='.repeat(50));
  console.log(`Vault: ${expandedPath}`);
  console.log(`Plugins: ${PLUGINS_TO_ENABLE.join(', ')}`);
  console.log('');

  let obsidian: { process: ChildProcess; browser: Browser } | null = null;

  try {
    obsidian = await launchObsidian(expandedPath);

    const pages = obsidian.browser.contexts()[0]?.pages() || [];
    const page = pages[0];

    if (!page) {
      throw new Error('No page found in Obsidian');
    }

    const success = await enablePlugins(page);

    if (success) {
      console.log('');
      console.log('='.repeat(50));
      console.log('✓ Plugin setup complete!');
      console.log('='.repeat(50));
    } else {
      console.log('');
      console.log('='.repeat(50));
      console.log('⚠ Plugin setup incomplete - check warnings above');
      console.log('='.repeat(50));
      process.exit(1);
    }
  } catch (error) {
    console.error('[Error]', error);
    process.exit(1);
  } finally {
    if (obsidian) {
      await closeObsidian(obsidian.browser, obsidian.process);
    }
  }
}

main();
