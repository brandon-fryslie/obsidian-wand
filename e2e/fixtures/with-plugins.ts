import { test as base } from '@playwright/test';
import {
  PLUGINS,
  installAndEnablePlugin,
  uninstallPlugin,
  isPluginInstalled
} from './plugin-installer';

/**
 * Extended test fixture that provides plugin installation capability
 *
 * Usage in test files:
 * ```typescript
 * import { test } from '../fixtures/with-plugins';
 *
 * test.describe('My Tests', () => {
 *   test.beforeAll(async ({ withPlugins }) => {
 *     await withPlugins(['templater', 'tasks']);
 *   });
 *
 *   test('my test', async () => {
 *     // Plugins are now installed and enabled
 *   });
 * });
 * ```
 */

interface PluginFixtures {
  /**
   * Install and enable plugins for the test suite
   *
   * @param plugins - Array of plugin keys from PLUGINS registry
   * @returns Promise that resolves when plugins are installed
   *
   * @example
   * ```typescript
   * await withPlugins(['templater', 'tasks']);
   * ```
   */
  withPlugins: (plugins: string[]) => Promise<void>;
}

export const test = base.extend<PluginFixtures>({
  withPlugins: async ({}, use) => {
    const vaultPath = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';
    const installedPlugins: string[] = [];

    /**
     * Plugin installer function passed to tests
     */
    const installer = async (pluginKeys: string[]) => {
      console.log(`[Fixture] Installing plugins: ${pluginKeys.join(', ')}`);

      for (const pluginKey of pluginKeys) {
        const plugin = PLUGINS[pluginKey];
        if (!plugin) {
          throw new Error(
            `Unknown plugin: ${pluginKey}. Available: ${Object.keys(PLUGINS).join(', ')}`
          );
        }

        try {
          // Check if already installed
          const alreadyInstalled = await isPluginInstalled(plugin.id, vaultPath);
          if (alreadyInstalled) {
            console.log(`[Fixture] ${plugin.id} already installed, skipping`);
            continue;
          }

          // Install and enable the plugin
          await installAndEnablePlugin(pluginKey, vaultPath);
          installedPlugins.push(plugin.id);

          console.log(`[Fixture] ${plugin.id} installed and enabled`);
        } catch (error) {
          console.error(`[Fixture] Failed to install ${pluginKey}:`, error);
          throw error;
        }
      }

      console.log(`[Fixture] All plugins ready: ${installedPlugins.join(', ')}`);
    };

    // Provide the installer function to the test
    await use(installer);

    // Cleanup: Uninstall plugins after tests complete
    if (installedPlugins.length > 0) {
      console.log(`[Fixture] Cleaning up plugins: ${installedPlugins.join(', ')}`);

      for (const pluginId of installedPlugins) {
        try {
          await uninstallPlugin(pluginId, vaultPath);
          console.log(`[Fixture] Uninstalled ${pluginId}`);
        } catch (error) {
          console.error(`[Fixture] Failed to uninstall ${pluginId}:`, error);
          // Continue cleanup even if one fails
        }
      }

      console.log(`[Fixture] Plugin cleanup complete`);
    }
  }
});

// Re-export expect for convenience
export { expect } from '@playwright/test';
