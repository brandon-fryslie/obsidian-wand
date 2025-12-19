import { chromium, Browser } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';

export interface ObsidianInstance {
  browser: Browser;
  process: ChildProcess;
}

/**
 * Launch Obsidian with Chrome DevTools Protocol (CDP) enabled
 *
 * @param vaultPath - Absolute path to the Obsidian vault
 * @param debugPort - CDP debug port (default: 9222)
 * @returns Browser instance and Obsidian process
 *
 * @example
 * ```ts
 * const { browser, process } = await launchObsidian('~/obsidian-test-vault');
 * const context = browser.contexts()[0];
 * const page = context.pages()[0];
 * // ... interact with Obsidian ...
 * await closeObsidian(browser, process);
 * ```
 */
export async function launchObsidian(
  vaultPath: string,
  debugPort: number = 9222
): Promise<ObsidianInstance> {
  // Expand tilde in path
  const expandedVaultPath = vaultPath.replace(/^~/, process.env.HOME || '~');

  // macOS Obsidian executable path
  const obsidianPath = '/Applications/Obsidian.app/Contents/MacOS/Obsidian';

  // Launch Obsidian with remote debugging enabled
  const obsidianProcess = spawn(
    obsidianPath,
    [
      `--remote-debugging-port=${debugPort}`,
      expandedVaultPath
    ],
    {
      detached: false,
      stdio: 'pipe'
    }
  );

  // Log stdout/stderr for debugging
  obsidianProcess.stdout?.on('data', (data) => {
    console.log(`[Obsidian] ${data.toString().trim()}`);
  });

  obsidianProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    // Filter out common noise
    if (!msg.includes('Ignored:') && !msg.includes('DevTools listening')) {
      console.error(`[Obsidian Error] ${msg}`);
    }
    // Log DevTools connection info
    if (msg.includes('DevTools listening')) {
      console.log(`[Obsidian] ${msg}`);
    }
  });

  // Handle process errors
  obsidianProcess.on('error', (err) => {
    throw new Error(`Failed to launch Obsidian: ${err.message}`);
  });

  // Wait for CDP endpoint to be available
  const cdpEndpoint = `http://localhost:${debugPort}`;
  const maxRetries = 30; // 15 seconds max
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(`${cdpEndpoint}/json/version`);
      if (response.ok) {
        console.log('[Obsidian] CDP endpoint ready');
        break;
      }
    } catch (err) {
      // CDP not ready yet, wait and retry
    }

    retries++;
    if (retries >= maxRetries) {
      obsidianProcess.kill('SIGKILL');
      throw new Error(
        `Obsidian CDP endpoint not available after ${maxRetries * 500}ms. ` +
        `Check that Obsidian is installed at ${obsidianPath}`
      );
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Connect to Obsidian via CDP
  let browser: Browser;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${debugPort}`);
    console.log('[Obsidian] Connected via CDP');
  } catch (err) {
    obsidianProcess.kill('SIGKILL');
    throw new Error(`Failed to connect to Obsidian via CDP: ${err}`);
  }

  // Wait a bit for Obsidian UI to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  return { browser, process: obsidianProcess };
}

/**
 * Close Obsidian gracefully
 *
 * @param browser - Playwright browser instance
 * @param process - Obsidian child process
 */
export async function closeObsidian(
  browser: Browser,
  process: ChildProcess
): Promise<void> {
  try {
    // Try to close browser connection first
    if (browser && browser.isConnected()) {
      await browser.close();
      console.log('[Obsidian] Browser connection closed');
    }
  } catch (err) {
    console.warn(`[Obsidian] Error closing browser: ${err}`);
  }

  // Kill Obsidian process
  if (process && !process.killed) {
    process.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Force kill if still running
    if (!process.killed) {
      process.kill('SIGKILL');
    }

    console.log('[Obsidian] Process terminated');
  }
}

/**
 * Get the main Obsidian page from browser context
 *
 * @param browser - Playwright browser instance
 * @returns First page in first context
 */
export function getObsidianPage(browser: Browser) {
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('No browser contexts available');
  }

  const pages = contexts[0].pages();
  if (pages.length === 0) {
    throw new Error('No pages available in browser context');
  }

  return pages[0];
}
