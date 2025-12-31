/**
 * SkillService - Manages Claude skills for plugin knowledge
 *
 * Skills are on-demand context that teaches the agent how to use plugins.
 * Instead of bloating every request with MCP tool schemas, skills are
 * loaded when relevant based on the user's request.
 *
 * Skills are stored in: .obsidian/wand/skills/{plugin-id}/SKILL.md
 */

import { App, requestUrl } from "obsidian";
import { PluginManagerService, CommunityPlugin } from "./PluginManagerService";

const SKILLS_FOLDER = ".obsidian/wand/skills";

export interface Skill {
  id: string;
  name: string;
  description: string;
  pluginId?: string; // If generated from a plugin
  content: string; // The full skill content
  createdAt: Date;
  updatedAt: Date;
  tokenEstimate: number;
}

export interface SkillMetadata {
  name: string;
  description: string;
  pluginId?: string;
  pluginRepo?: string;
  createdAt: string;
  updatedAt: string;
  version?: string;
}

export class SkillService {
  private app: App;
  private pluginManager: PluginManagerService;
  private skillsCache: Map<string, Skill> = new Map();

  constructor(app: App, pluginManager: PluginManagerService) {
    this.app = app;
    this.pluginManager = pluginManager;
  }

  /**
   * Initialize and load existing skills
   */
  async initialize(): Promise<void> {
    await this.ensureSkillsFolder();
    await this.loadSkills();
  }

  /**
   * Generate a skill from a plugin's GitHub repository
   */
  async generateSkillFromPlugin(pluginId: string): Promise<Skill> {
    console.log(`[Skills] Generating skill for plugin: ${pluginId}`);

    // Get plugin info from community registry
    const plugins = await this.pluginManager.searchPlugins(pluginId, 1);
    const plugin = plugins.find(p => p.id === pluginId);

    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found in community registry`);
    }

    // Fetch README and relevant files from GitHub
    const repoUrl = `https://github.com/${plugin.repo}`;
    const skillContent = await this.fetchPluginDocs(plugin);

    // Create skill metadata
    const metadata: SkillMetadata = {
      name: plugin.name,
      description: `Knowledge about the ${plugin.name} Obsidian plugin. ${plugin.description}`,
      pluginId: plugin.id,
      pluginRepo: plugin.repo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create SKILL.md content
    const skillMd = this.formatSkillMd(metadata, skillContent, repoUrl);

    // Save the skill
    const skillPath = `${SKILLS_FOLDER}/${pluginId}/SKILL.md`;
    await this.ensureFolder(`${SKILLS_FOLDER}/${pluginId}`);
    await this.app.vault.adapter.write(skillPath, skillMd);

    // Create and cache the skill object
    const skill: Skill = {
      id: pluginId,
      name: plugin.name,
      description: metadata.description,
      pluginId: plugin.id,
      content: skillMd,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokenEstimate: Math.ceil(skillMd.length / 3.5),
    };

    this.skillsCache.set(pluginId, skill);
    console.log(`[Skills] Generated skill for ${plugin.name}: ~${skill.tokenEstimate} tokens`);

    return skill;
  }

  /**
   * Fetch documentation from a plugin's GitHub repo
   */
  private async fetchPluginDocs(plugin: CommunityPlugin): Promise<string> {
    const parts: string[] = [];

    // Try to fetch README
    try {
      const readmeUrl = `https://raw.githubusercontent.com/${plugin.repo}/master/README.md`;
      const response = await requestUrl({ url: readmeUrl });
      if (response.status === 200) {
        parts.push("## README\n\n" + response.text);
      }
    } catch (e) {
      // Try main branch
      try {
        const readmeUrl = `https://raw.githubusercontent.com/${plugin.repo}/main/README.md`;
        const response = await requestUrl({ url: readmeUrl });
        if (response.status === 200) {
          parts.push("## README\n\n" + response.text);
        }
      } catch (e2) {
        console.warn(`[Skills] Could not fetch README for ${plugin.id}`);
      }
    }

    // Try to fetch manifest.json for version info
    try {
      const manifestUrl = `https://raw.githubusercontent.com/${plugin.repo}/master/manifest.json`;
      const response = await requestUrl({ url: manifestUrl });
      if (response.status === 200) {
        const manifest = JSON.parse(response.text);
        parts.push(`## Plugin Manifest\n\n- **Version**: ${manifest.version}\n- **Min Obsidian Version**: ${manifest.minAppVersion}\n- **Author**: ${manifest.author}`);
      }
    } catch (e) {
      // Ignore
    }

    // Try to fetch any API documentation
    const apiPaths = ["API.md", "docs/API.md", "DOCUMENTATION.md", "docs/README.md"];
    for (const apiPath of apiPaths) {
      try {
        const apiUrl = `https://raw.githubusercontent.com/${plugin.repo}/master/${apiPath}`;
        const response = await requestUrl({ url: apiUrl });
        if (response.status === 200) {
          parts.push(`## API Documentation\n\n${response.text}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }

    if (parts.length === 0) {
      // Fallback to basic description
      parts.push(`## About\n\n${plugin.description}\n\nRepository: https://github.com/${plugin.repo}`);
    }

    return parts.join("\n\n---\n\n");
  }

  /**
   * Format the SKILL.md file
   */
  private formatSkillMd(metadata: SkillMetadata, content: string, repoUrl: string): string {
    return `---
name: ${metadata.name}
description: ${metadata.description}
pluginId: ${metadata.pluginId}
pluginRepo: ${metadata.pluginRepo}
createdAt: ${metadata.createdAt}
updatedAt: ${metadata.updatedAt}
---

# ${metadata.name} Plugin Skill

> This skill provides knowledge about the **${metadata.name}** Obsidian plugin.
> Use this when the user asks about ${metadata.name} features or wants to use its functionality.

**Repository**: ${repoUrl}

${content}

---

## Usage Guidelines

When using this plugin's features:
1. Check if the plugin is installed and enabled using the appropriate status tool
2. Use the plugin's commands via \`commands.run\` when available
3. Refer to the documentation above for specific syntax and options
`;
  }

  /**
   * Get all available skills
   */
  async getSkills(): Promise<Skill[]> {
    return Array.from(this.skillsCache.values());
  }

  /**
   * Get a specific skill by ID
   */
  getSkill(skillId: string): Skill | undefined {
    return this.skillsCache.get(skillId);
  }

  /**
   * Get skills relevant to a user query
   * Returns skills that might be useful based on keyword matching
   */
  getRelevantSkills(query: string, maxSkills: number = 3): Skill[] {
    const queryLower = query.toLowerCase();
    const scored: { skill: Skill; score: number }[] = [];

    for (const skill of this.skillsCache.values()) {
      let score = 0;

      // Check if plugin name is mentioned
      if (queryLower.includes(skill.name.toLowerCase())) {
        score += 10;
      }

      // Check if plugin ID is mentioned
      if (skill.pluginId && queryLower.includes(skill.pluginId.toLowerCase())) {
        score += 10;
      }

      // Check description keywords
      const descWords = skill.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && queryLower.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ skill, score });
      }
    }

    // Sort by score and return top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSkills)
      .map(s => s.skill);
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: string): Promise<void> {
    const skillPath = `${SKILLS_FOLDER}/${skillId}`;
    const adapter = this.app.vault.adapter;

    if (await adapter.exists(skillPath)) {
      const files = await adapter.list(skillPath);
      for (const file of files.files) {
        await adapter.remove(file);
      }
      await adapter.rmdir(skillPath, false);
    }

    this.skillsCache.delete(skillId);
  }

  /**
   * Refresh a skill from its plugin repo
   */
  async refreshSkill(skillId: string): Promise<Skill> {
    await this.deleteSkill(skillId);
    return await this.generateSkillFromPlugin(skillId);
  }

  /**
   * Load all existing skills from disk
   */
  private async loadSkills(): Promise<void> {
    const adapter = this.app.vault.adapter;

    if (!(await adapter.exists(SKILLS_FOLDER))) {
      return;
    }

    const contents = await adapter.list(SKILLS_FOLDER);

    for (const folder of contents.folders) {
      const skillId = folder.split("/").pop()!;
      const skillPath = `${folder}/SKILL.md`;

      if (await adapter.exists(skillPath)) {
        try {
          const content = await adapter.read(skillPath);
          const skill = this.parseSkillMd(skillId, content);
          this.skillsCache.set(skillId, skill);
          console.log(`[Skills] Loaded skill: ${skill.name}`);
        } catch (e) {
          console.warn(`[Skills] Failed to load skill ${skillId}:`, e);
        }
      }
    }

    console.log(`[Skills] Loaded ${this.skillsCache.size} skills`);
  }

  /**
   * Parse a SKILL.md file into a Skill object
   */
  private parseSkillMd(id: string, content: string): Skill {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let name = id;
    let description = "";
    let pluginId: string | undefined;
    let createdAt = new Date();
    let updatedAt = new Date();

    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      const nameMatch = yaml.match(/name:\s*(.+)/);
      const descMatch = yaml.match(/description:\s*(.+)/);
      const pluginMatch = yaml.match(/pluginId:\s*(.+)/);
      const createdMatch = yaml.match(/createdAt:\s*(.+)/);
      const updatedMatch = yaml.match(/updatedAt:\s*(.+)/);

      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
      if (pluginMatch) pluginId = pluginMatch[1].trim();
      if (createdMatch) createdAt = new Date(createdMatch[1].trim());
      if (updatedMatch) updatedAt = new Date(updatedMatch[1].trim());
    }

    return {
      id,
      name,
      description,
      pluginId,
      content,
      createdAt,
      updatedAt,
      tokenEstimate: Math.ceil(content.length / 3.5),
    };
  }

  private async ensureSkillsFolder(): Promise<void> {
    await this.ensureFolder(SKILLS_FOLDER);
  }

  private async ensureFolder(path: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    const parts = path.split("/");
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await adapter.exists(current))) {
        await adapter.mkdir(current);
      }
    }
  }
}
