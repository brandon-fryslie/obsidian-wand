/**
 * Manual test script for plugin installer
 * Run with: node e2e/test-installer.mjs
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  PLUGINS,
  installPlugin,
  enablePlugin,
  uninstallPlugin,
  isPluginInstalled,
  installAndEnablePlugin
} from './fixtures/plugin-installer.ts';

const vaultPath = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';
const expandedPath = vaultPath.replace(/^~/, process.env.HOME || '~');

async function main() {
  console.log('\n=== Plugin Installer Test ===');
  console.log('Vault path:', vaultPath);
  console.log('Expanded path:', expandedPath);

  // Test 1: Check if Templater is already installed
  console.log('\n[Test 1] Checking if Templater is installed...');
  const templaterInstalled = await isPluginInstalled('templater-obsidian', vaultPath);
  console.log('Templater installed:', templaterInstalled);

  // Test 2: List available plugins
  console.log('\n[Test 2] Available plugins:');
  Object.entries(PLUGINS).forEach(([key, config]) => {
    console.log(`  - ${key}: ${config.id} (${config.github})`);
  });

  // Test 3: Check community-plugins.json
  console.log('\n[Test 3] Current enabled plugins:');
  const communityPluginsPath = join(expandedPath, '.obsidian', 'community-plugins.json');
  try {
    const content = await fs.readFile(communityPluginsPath, 'utf-8');
    const enabledPlugins = JSON.parse(content);
    console.log('Enabled plugins:', enabledPlugins);
  } catch (error) {
    console.log('Error reading community-plugins.json:', error.message);
  }

  // Test 4: Install a plugin (if not already installed)
  if (!templaterInstalled) {
    console.log('\n[Test 4] Installing Templater plugin...');
    try {
      await installAndEnablePlugin('templater', vaultPath);
      console.log('Templater installation complete!');

      // Verify installation
      const nowInstalled = await isPluginInstalled('templater-obsidian', vaultPath);
      console.log('Verification - Templater now installed:', nowInstalled);

      // Check files
      const pluginDir = join(expandedPath, '.obsidian', 'plugins', 'templater-obsidian');
      const files = await fs.readdir(pluginDir);
      console.log('Plugin files:', files);

      // Cleanup
      console.log('\n[Cleanup] Uninstalling Templater...');
      await uninstallPlugin('templater-obsidian', vaultPath);
      const stillInstalled = await isPluginInstalled('templater-obsidian', vaultPath);
      console.log('After cleanup - Templater installed:', stillInstalled);
    } catch (error) {
      console.error('Error during installation test:', error);
    }
  } else {
    console.log('\n[Test 4] Skipped - Templater already installed');
  }

  console.log('\n=== Test Complete ===\n');
}

main().catch(console.error);
