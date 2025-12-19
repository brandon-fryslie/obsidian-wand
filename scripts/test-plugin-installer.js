#!/usr/bin/env node
/**
 * Manual test script for plugin installer
 *
 * This script tests the plugin installation/uninstallation workflow
 * without running the full E2E test suite.
 *
 * Usage: node scripts/test-plugin-installer.js
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import the installer functions (they'll be transpiled by Node's loader)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We'll implement the test manually to avoid import issues
const vaultPath = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';
const expandedPath = vaultPath.replace(/^~/, process.env.HOME || '~');

function expandPath(path) {
  if (path.startsWith('~/')) {
    return join(process.env.HOME || '~', path.slice(2));
  }
  return path;
}

async function isPluginInstalled(pluginId, vaultPath) {
  const expandedPath = expandPath(vaultPath);
  const pluginDir = join(expandedPath, '.obsidian', 'plugins', pluginId);

  try {
    const stat = await fs.stat(pluginDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n=== Plugin Installer Test ===');
  console.log('Vault path:', vaultPath);
  console.log('Expanded path:', expandedPath);

  // Test 1: Check if vault exists
  console.log('\n[Test 1] Checking if vault exists...');
  try {
    await fs.access(expandedPath);
    console.log('✓ Vault exists');
  } catch (error) {
    console.log('✗ Vault does not exist:', expandedPath);
    console.log('  Please create the vault or set OBSIDIAN_TEST_VAULT env var');
    process.exit(1);
  }

  // Test 2: Check .obsidian directory
  console.log('\n[Test 2] Checking .obsidian directory...');
  const obsidianDir = join(expandedPath, '.obsidian');
  try {
    await fs.access(obsidianDir);
    console.log('✓ .obsidian directory exists');
  } catch (error) {
    console.log('✗ .obsidian directory does not exist');
    process.exit(1);
  }

  // Test 3: Check plugins directory
  console.log('\n[Test 3] Checking plugins directory...');
  const pluginsDir = join(expandedPath, '.obsidian', 'plugins');
  try {
    await fs.access(pluginsDir);
    const plugins = await fs.readdir(pluginsDir);
    console.log('✓ Plugins directory exists');
    console.log('  Current plugins:', plugins);
  } catch (error) {
    console.log('✗ Plugins directory does not exist');
    console.log('  Creating plugins directory...');
    await fs.mkdir(pluginsDir, { recursive: true });
    console.log('✓ Created plugins directory');
  }

  // Test 4: Check community-plugins.json
  console.log('\n[Test 4] Checking community-plugins.json...');
  const communityPluginsPath = join(expandedPath, '.obsidian', 'community-plugins.json');
  try {
    const content = await fs.readFile(communityPluginsPath, 'utf-8');
    const enabledPlugins = JSON.parse(content);
    console.log('✓ community-plugins.json exists');
    console.log('  Enabled plugins:', enabledPlugins);
  } catch (error) {
    console.log('✗ community-plugins.json does not exist or is invalid');
    console.log('  Will be created when enabling first plugin');
  }

  // Test 5: Check if Templater is installed
  console.log('\n[Test 5] Checking Templater installation...');
  const templaterInstalled = await isPluginInstalled('templater-obsidian', vaultPath);
  console.log('Templater installed:', templaterInstalled);

  console.log('\n=== Test Complete ===');
  console.log('\nTo run the actual installer, use:');
  console.log('  pnpm playwright test templater.spec.ts --headed');
  console.log('\n');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
