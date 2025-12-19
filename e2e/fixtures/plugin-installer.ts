import { promises as fs } from 'fs';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { execSync } from 'child_process';

/**
 * Plugin metadata configuration
 */
export interface PluginConfig {
  id: string;           // Plugin ID (folder name)
  github?: string;      // GitHub repo (owner/repo) - optional for local builds
  files: string[];      // Files to download/copy from release
  buildFromSource?: boolean; // If true, build locally instead of downloading
}

/**
 * Registry of supported Obsidian community plugins
 */
export const PLUGINS: Record<string, PluginConfig> = {
  wand: {
    id: 'wand',
    files: ['main.js', 'manifest.json', 'styles.css'],
    buildFromSource: true
  },
  templater: {
    id: 'templater-obsidian',
    github: 'SilentVoid13/Templater',
    files: ['main.js', 'manifest.json', 'styles.css']
  },
  tasks: {
    id: 'obsidian-tasks-plugin',
    github: 'obsidian-tasks-group/obsidian-tasks',
    files: ['main.js', 'manifest.json', 'styles.css']
  },
  advancedTables: {
    id: 'table-editor-obsidian',
    github: 'tgrosinger/advanced-tables-obsidian',
    files: ['main.js', 'manifest.json']
  },
  excalidraw: {
    id: 'obsidian-excalidraw-plugin',
    github: 'zsviczian/obsidian-excalidraw-plugin',
    files: ['main.js', 'manifest.json', 'styles.css']
  }
};

/**
 * Expand tilde (~) in file paths to user's home directory
 */
function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(process.env.HOME || '~', path.slice(2));
  }
  return path;
}

/**
 * Download a file from a URL to a destination path
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  // Ensure parent directory exists
  const dir = join(dest, '..');
  await fs.mkdir(dir, { recursive: true });

  // Convert ReadableStream to Node.js Readable stream
  const nodeStream = Readable.fromWeb(response.body as any);
  const fileStream = createWriteStream(dest);

  await pipeline(nodeStream, fileStream);
}

/**
 * Build the Wand plugin from source
 */
async function buildWandPlugin(projectRoot: string): Promise<void> {
  console.log('[Plugin Installer] Building Wand plugin from source...');

  try {
    // Run pnpm build in the project root
    execSync('pnpm run build', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env }
    });

    console.log('[Plugin Installer] Wand plugin built successfully');
  } catch (error) {
    console.error('[Plugin Installer] Failed to build Wand plugin:', error);
    throw new Error(`Failed to build Wand plugin: ${error}`);
  }
}

/**
 * Install Wand plugin from local build
 */
async function installWandPlugin(vaultPath: string, projectRoot: string): Promise<void> {
  const expandedPath = expandPath(vaultPath);
  const pluginDir = join(expandedPath, '.obsidian', 'plugins', 'wand');

  console.log('[Plugin Installer] Installing Wand plugin from local build...');

  // Build the plugin first
  await buildWandPlugin(projectRoot);

  // Create plugin directory
  await fs.mkdir(pluginDir, { recursive: true });

  // Copy built files from project root to plugin directory
  const files = ['main.js', 'manifest.json', 'styles.css'];
  for (const file of files) {
    const sourcePath = join(projectRoot, file);
    const destPath = join(pluginDir, file);

    try {
      await fs.access(sourcePath);
      await fs.copyFile(sourcePath, destPath);
      console.log(`[Plugin Installer] Copied ${file}`);
    } catch (error) {
      // styles.css is optional
      if (file === 'styles.css') {
        console.log(`[Plugin Installer] Optional ${file} not found, skipping`);
        continue;
      }

      console.error(`[Plugin Installer] Failed to copy ${file}:`, error);
      throw error;
    }
  }

  console.log('[Plugin Installer] Wand plugin installed successfully');
}

/**
 * Check if a plugin is installed in the vault
 */
export async function isPluginInstalled(pluginId: string, vaultPath: string): Promise<boolean> {
  const expandedPath = expandPath(vaultPath);
  const pluginDir = join(expandedPath, '.obsidian', 'plugins', pluginId);

  try {
    const stat = await fs.stat(pluginDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Install a plugin from GitHub releases to the vault
 *
 * @param pluginKey - Key from PLUGINS registry (e.g., 'templater')
 * @param vaultPath - Path to Obsidian vault (supports ~ expansion)
 * @param useCache - Whether to cache downloads in /tmp (default: true)
 */
export async function installPlugin(
  pluginKey: string,
  vaultPath: string,
  useCache: boolean = true
): Promise<void> {
  const plugin = PLUGINS[pluginKey];
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginKey}. Available: ${Object.keys(PLUGINS).join(', ')}`);
  }

  const expandedPath = expandPath(vaultPath);
  const pluginDir = join(expandedPath, '.obsidian', 'plugins', plugin.id);
  const cacheDir = join('/tmp', 'obsidian-test-plugins', plugin.id);

  // Check if already installed
  if (await isPluginInstalled(plugin.id, vaultPath)) {
    console.log(`[Plugin Installer] ${plugin.id} already installed, skipping`);
    return;
  }

  // Handle Wand plugin specially (build from source)
  if (plugin.buildFromSource) {
    // Get project root (assuming we're in e2e/fixtures/)
    const projectRoot = join(__dirname, '..', '..');
    await installWandPlugin(vaultPath, projectRoot);
    return;
  }

  // For other plugins, download from GitHub
  if (!plugin.github) {
    throw new Error(`Plugin ${pluginKey} requires github property for download`);
  }

  console.log(`[Plugin Installer] Installing ${plugin.id} from ${plugin.github}...`);

  // Create plugin directory
  await fs.mkdir(pluginDir, { recursive: true });

  // Download each required file
  for (const file of plugin.files) {
    const url = `https://github.com/${plugin.github}/releases/latest/download/${file}`;
    const destPath = join(pluginDir, file);
    const cachePath = join(cacheDir, file);

    try {
      // Try to use cached version if enabled
      if (useCache) {
        try {
          await fs.access(cachePath);
          console.log(`[Plugin Installer] Using cached ${file}`);
          await fs.copyFile(cachePath, destPath);
          continue;
        } catch {
          // Cache miss, download normally
        }
      }

      // Download the file
      console.log(`[Plugin Installer] Downloading ${file} from ${url}`);
      await downloadFile(url, destPath);

      // Cache the download for future use
      if (useCache) {
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.copyFile(destPath, cachePath);
        console.log(`[Plugin Installer] Cached ${file} for future use`);
      }
    } catch (error) {
      // If a file fails to download, clean up and rethrow
      // (Some plugins may not have all optional files like styles.css)
      if (file === 'styles.css') {
        console.log(`[Plugin Installer] Optional ${file} not found, skipping`);
        continue;
      }

      // Required file failed to download
      console.error(`[Plugin Installer] Failed to download ${file}:`, error);
      await uninstallPlugin(plugin.id, vaultPath);
      throw error;
    }
  }

  console.log(`[Plugin Installer] ${plugin.id} installed successfully`);
}

/**
 * Enable a plugin in the vault's community-plugins.json
 *
 * @param pluginId - Plugin ID to enable
 * @param vaultPath - Path to Obsidian vault (supports ~ expansion)
 */
export async function enablePlugin(pluginId: string, vaultPath: string): Promise<void> {
  const expandedPath = expandPath(vaultPath);
  const communityPluginsPath = join(expandedPath, '.obsidian', 'community-plugins.json');

  // Read current enabled plugins
  let enabledPlugins: string[] = [];
  try {
    const content = await fs.readFile(communityPluginsPath, 'utf-8');
    enabledPlugins = JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid, start with empty array
    console.log(`[Plugin Installer] Creating new community-plugins.json`);
  }

  // Add plugin if not already enabled
  if (!enabledPlugins.includes(pluginId)) {
    enabledPlugins.push(pluginId);
    await fs.writeFile(
      communityPluginsPath,
      JSON.stringify(enabledPlugins, null, 2),
      'utf-8'
    );
    console.log(`[Plugin Installer] Enabled ${pluginId}`);
  } else {
    console.log(`[Plugin Installer] ${pluginId} already enabled`);
  }
}

/**
 * Disable and uninstall a plugin from the vault
 *
 * @param pluginId - Plugin ID to uninstall
 * @param vaultPath - Path to Obsidian vault (supports ~ expansion)
 */
export async function uninstallPlugin(pluginId: string, vaultPath: string): Promise<void> {
  const expandedPath = expandPath(vaultPath);
  const pluginDir = join(expandedPath, '.obsidian', 'plugins', pluginId);
  const communityPluginsPath = join(expandedPath, '.obsidian', 'community-plugins.json');

  // Remove from enabled plugins list
  try {
    const content = await fs.readFile(communityPluginsPath, 'utf-8');
    let enabledPlugins: string[] = JSON.parse(content);

    if (enabledPlugins.includes(pluginId)) {
      enabledPlugins = enabledPlugins.filter(id => id !== pluginId);
      await fs.writeFile(
        communityPluginsPath,
        JSON.stringify(enabledPlugins, null, 2),
        'utf-8'
      );
      console.log(`[Plugin Installer] Disabled ${pluginId}`);
    }
  } catch (error) {
    // community-plugins.json doesn't exist or is invalid
    console.log(`[Plugin Installer] No community-plugins.json to update`);
  }

  // Remove plugin directory
  try {
    await fs.rm(pluginDir, { recursive: true, force: true });
    console.log(`[Plugin Installer] Uninstalled ${pluginId}`);
  } catch (error) {
    // Directory doesn't exist, that's fine
    console.log(`[Plugin Installer] Plugin directory not found: ${pluginDir}`);
  }
}

/**
 * Install and enable a plugin (convenience function)
 */
export async function installAndEnablePlugin(
  pluginKey: string,
  vaultPath: string,
  useCache: boolean = true
): Promise<void> {
  const plugin = PLUGINS[pluginKey];
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginKey}`);
  }

  await installPlugin(pluginKey, vaultPath, useCache);
  await enablePlugin(plugin.id, vaultPath);
}
