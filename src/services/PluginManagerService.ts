import { App, requestUrl } from "obsidian";

const COMMUNITY_PLUGINS_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";

export interface CommunityPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
}

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  author?: string;
  description?: string;
}

export interface PluginSearchResult {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  installed: boolean;
  enabled: boolean;
}

/**
 * PluginManagerService provides tools for searching and managing Obsidian community plugins.
 *
 * Features:
 * - Search the community plugins registry
 * - List installed plugins
 * - Install plugins from the registry
 * - Enable/disable plugins
 */
export class PluginManagerService {
  private app: App;
  private communityPluginsCache: CommunityPlugin[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Search community plugins by name, author, or description
   */
  async searchPlugins(query: string, limit: number = 20): Promise<PluginSearchResult[]> {
    const plugins = await this.fetchCommunityPlugins();
    const installedIds = this.getInstalledPluginIds();
    const enabledIds = this.getEnabledPluginIds();

    const queryLower = query.toLowerCase();

    const matches = plugins
      .filter(
        (p) =>
          p.name.toLowerCase().includes(queryLower) ||
          p.author.toLowerCase().includes(queryLower) ||
          p.description.toLowerCase().includes(queryLower) ||
          p.id.toLowerCase().includes(queryLower)
      )
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        name: p.name,
        author: p.author,
        description: p.description,
        repo: p.repo,
        installed: installedIds.has(p.id),
        enabled: enabledIds.has(p.id),
      }));

    return matches;
  }

  /**
   * Get list of installed community plugins
   */
  listInstalledPlugins(): InstalledPlugin[] {
    // @ts-ignore - accessing internal API
    const plugins = this.app.plugins?.plugins || {};
    // @ts-ignore - accessing internal API
    const manifests = this.app.plugins?.manifests || {};

    const installed: InstalledPlugin[] = [];

    for (const [id, manifest] of Object.entries(manifests)) {
      const m = manifest as any;
      installed.push({
        id,
        name: m.name || id,
        version: m.version || "unknown",
        enabled: id in plugins,
        author: m.author,
        description: m.description,
      });
    }

    return installed.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Install a plugin from the community registry
   */
  async installPlugin(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    // Check if already installed
    if (this.isPluginInstalled(pluginId)) {
      return {
        success: false,
        message: `Plugin "${pluginId}" is already installed`,
        pluginId,
      };
    }

    // Find the plugin in the registry
    const plugins = await this.fetchCommunityPlugins();
    const plugin = plugins.find((p) => p.id === pluginId);

    if (!plugin) {
      return {
        success: false,
        message: `Plugin "${pluginId}" not found in community registry`,
        pluginId,
      };
    }

    try {
      // Fetch the latest release info from GitHub
      const releaseUrl = `https://api.github.com/repos/${plugin.repo}/releases/latest`;
      const releaseResponse = await requestUrl({
        url: releaseUrl,
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (releaseResponse.status !== 200) {
        throw new Error(`Failed to fetch release info: ${releaseResponse.status}`);
      }

      const release = releaseResponse.json;
      const assets = release.assets || [];

      // Find required files in release assets
      const manifestAsset = assets.find((a: any) => a.name === "manifest.json");
      const mainAsset = assets.find((a: any) => a.name === "main.js");
      const stylesAsset = assets.find((a: any) => a.name === "styles.css");

      if (!manifestAsset || !mainAsset) {
        throw new Error("Release missing required files (manifest.json or main.js)");
      }

      // Create plugin directory
      const pluginDir = `.obsidian/plugins/${pluginId}`;
      await this.ensureDir(pluginDir);

      // Download and save files
      await this.downloadAndSave(manifestAsset.browser_download_url, `${pluginDir}/manifest.json`);
      await this.downloadAndSave(mainAsset.browser_download_url, `${pluginDir}/main.js`);

      if (stylesAsset) {
        await this.downloadAndSave(stylesAsset.browser_download_url, `${pluginDir}/styles.css`);
      }

      // Reload plugin manifests
      // @ts-ignore - accessing internal API
      await this.app.plugins?.loadManifests();

      return {
        success: true,
        message: `Successfully installed "${plugin.name}" v${release.tag_name}. Use plugins.enable to activate it.`,
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to install plugin: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
      };
    }
  }

  /**
   * Enable an installed plugin
   */
  async enablePlugin(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    if (!this.isPluginInstalled(pluginId)) {
      return {
        success: false,
        message: `Plugin "${pluginId}" is not installed`,
        pluginId,
      };
    }

    try {
      // @ts-ignore - accessing internal API
      await this.app.plugins?.enablePluginAndSave(pluginId);

      return {
        success: true,
        message: `Plugin "${pluginId}" enabled successfully`,
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to enable plugin: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
      };
    }
  }

  /**
   * Disable an installed plugin
   */
  async disablePlugin(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    if (!this.isPluginInstalled(pluginId)) {
      return {
        success: false,
        message: `Plugin "${pluginId}" is not installed`,
        pluginId,
      };
    }

    try {
      // @ts-ignore - accessing internal API
      await this.app.plugins?.disablePluginAndSave(pluginId);

      return {
        success: true,
        message: `Plugin "${pluginId}" disabled successfully`,
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to disable plugin: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
      };
    }
  }

  /**
   * Uninstall a plugin by removing its files
   */
  async uninstallPlugin(pluginId: string): Promise<{
    success: boolean;
    message: string;
    pluginId: string;
  }> {
    if (!this.isPluginInstalled(pluginId)) {
      return {
        success: false,
        message: `Plugin "${pluginId}" is not installed`,
        pluginId,
      };
    }

    try {
      // First disable the plugin if enabled
      if (this.isPluginEnabled(pluginId)) {
        // @ts-ignore - accessing internal API
        await this.app.plugins?.disablePluginAndSave(pluginId);
      }

      // Remove the plugin directory
      const pluginDir = `.obsidian/plugins/${pluginId}`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(pluginDir)) {
        // List and remove all files in the directory
        const files = await adapter.list(pluginDir);
        for (const file of files.files) {
          await adapter.remove(file);
        }
        // Remove the directory
        await adapter.rmdir(pluginDir, false);
      }

      // Reload manifests
      // @ts-ignore - accessing internal API
      await this.app.plugins?.loadManifests();

      return {
        success: true,
        message: `Plugin "${pluginId}" uninstalled successfully`,
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to uninstall plugin: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
      };
    }
  }

  // ============================================
  // Private helpers
  // ============================================

  private async fetchCommunityPlugins(): Promise<CommunityPlugin[]> {
    // Check cache
    const now = Date.now();
    if (this.communityPluginsCache && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.communityPluginsCache;
    }

    try {
      const response = await requestUrl({ url: COMMUNITY_PLUGINS_URL });
      if (response.status !== 200) {
        throw new Error(`Failed to fetch community plugins: ${response.status}`);
      }

      this.communityPluginsCache = response.json as CommunityPlugin[];
      this.cacheTimestamp = now;

      return this.communityPluginsCache;
    } catch (error) {
      console.error("[PluginManager] Failed to fetch community plugins:", error);
      // Return cached data if available, even if stale
      if (this.communityPluginsCache) {
        return this.communityPluginsCache;
      }
      throw error;
    }
  }

  private getInstalledPluginIds(): Set<string> {
    // @ts-ignore - accessing internal API
    const manifests = this.app.plugins?.manifests || {};
    return new Set(Object.keys(manifests));
  }

  private getEnabledPluginIds(): Set<string> {
    // @ts-ignore - accessing internal API
    const plugins = this.app.plugins?.plugins || {};
    return new Set(Object.keys(plugins));
  }

  private isPluginInstalled(pluginId: string): boolean {
    return this.getInstalledPluginIds().has(pluginId);
  }

  private isPluginEnabled(pluginId: string): boolean {
    return this.getEnabledPluginIds().has(pluginId);
  }

  private async ensureDir(path: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(path))) {
      await adapter.mkdir(path);
    }
  }

  private async downloadAndSave(url: string, path: string): Promise<void> {
    const response = await requestUrl({ url });
    if (response.status !== 200) {
      throw new Error(`Failed to download ${url}: ${response.status}`);
    }

    const adapter = this.app.vault.adapter;
    await adapter.write(path, response.text);
  }
}
