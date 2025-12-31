/**
 * SkillService - Manages Claude skills for plugin knowledge
 *
 * Skills are on-demand context that teaches the agent how to use plugins.
 * Instead of bloating every request with MCP tool schemas, skills are
 * loaded when relevant based on the user's request.
 *
 * Skills are stored in: .obsidian/wand/skills/{plugin-id}/SKILL.md
 *
 * Supports two generation modes:
 * 1. Simple mode - Fetches README from GitHub (always available)
 * 2. Repomix mode - Uses repomix CLI for comprehensive skills (requires npx)
 */

import { App, requestUrl } from "obsidian";
import { PluginManagerService, CommunityPlugin } from "./PluginManagerService";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, rmSync, mkdirSync, readFileSync, readdirSync, copyFileSync } from "fs";

const SKILLS_FOLDER = ".obsidian/wand/skills";

// Check if repomix is available
let repomixAvailable: boolean | null = null;

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
  private useRepomix: boolean = true; // Prefer repomix when available

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
    // Check repomix availability in background
    this.checkRepomixAvailable().then(available => {
      console.log(`[Skills] Repomix ${available ? 'available' : 'not available'} - ${available ? 'using enhanced skill generation' : 'using simple mode'}`);
    });
  }

  /**
   * Check if repomix CLI is available via npx
   */
  async checkRepomixAvailable(): Promise<boolean> {
    if (repomixAvailable !== null) return repomixAvailable;

    return new Promise((resolve) => {
      try {
        const proc = spawn("npx", ["repomix", "--version"], {
          shell: true,
          timeout: 10000,
        });

        let hasOutput = false;
        proc.stdout.on("data", () => { hasOutput = true; });
        proc.stderr.on("data", () => { hasOutput = true; });

        proc.on("close", (code) => {
          repomixAvailable = code === 0 && hasOutput;
          resolve(repomixAvailable);
        });

        proc.on("error", () => {
          repomixAvailable = false;
          resolve(false);
        });
      } catch {
        repomixAvailable = false;
        resolve(false);
      }
    });
  }

  /**
   * Set whether to use repomix for skill generation
   */
  setUseRepomix(use: boolean): void {
    this.useRepomix = use;
  }

  /**
   * Generate a skill from a plugin's GitHub repository
   * Uses repomix for comprehensive skills when available, falls back to simple mode
   */
  async generateSkillFromPlugin(pluginId: string): Promise<Skill> {
    console.log(`[Skills] Generating skill for plugin: ${pluginId}`);

    // Get plugin info from community registry
    const plugins = await this.pluginManager.searchPlugins(pluginId, 1);
    const plugin = plugins.find(p => p.id === pluginId);

    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found in community registry`);
    }

    const repoUrl = `https://github.com/${plugin.repo}`;

    // Try repomix if available and enabled
    const canUseRepomix = this.useRepomix && await this.checkRepomixAvailable();
    if (canUseRepomix) {
      try {
        return await this.generateSkillWithRepomix(plugin, repoUrl);
      } catch (e) {
        console.warn(`[Skills] Repomix generation failed, falling back to simple mode:`, e);
      }
    }

    // Fallback: Simple mode - fetch README from GitHub
    return await this.generateSkillSimple(plugin, repoUrl);
  }

  /**
   * Generate skill using repomix CLI for comprehensive analysis
   */
  private async generateSkillWithRepomix(plugin: CommunityPlugin, repoUrl: string): Promise<Skill> {
    console.log(`[Skills] Using repomix for ${plugin.name}`);

    const tempDir = join(tmpdir(), `wand-skill-${plugin.id}-${Date.now()}`);
    const skillName = `obsidian-${plugin.id}`;

    try {
      // Create temp directory
      mkdirSync(tempDir, { recursive: true });

      // Run repomix with remote repo and skill generation
      await this.runRepomix(repoUrl, tempDir, skillName);

      // Find the generated skill directory
      const skillSourceDir = join(tempDir, ".claude", "skills", skillName);
      if (!existsSync(skillSourceDir)) {
        throw new Error(`Repomix did not generate skill at expected path: ${skillSourceDir}`);
      }

      // Copy skill files to our skills folder
      const vaultPath = (this.app.vault.adapter as any).basePath;
      const targetDir = join(vaultPath, SKILLS_FOLDER, plugin.id);
      await this.ensureFolder(`${SKILLS_FOLDER}/${plugin.id}`);

      // Copy all files from repomix output
      this.copyDirRecursive(skillSourceDir, targetDir);

      // Read the generated SKILL.md
      const skillMdPath = join(targetDir, "SKILL.md");
      let skillContent = readFileSync(skillMdPath, "utf-8");

      // Enhance with plugin-specific metadata
      skillContent = this.enhanceRepomixSkill(skillContent, plugin, repoUrl);
      const { writeFileSync } = await import("fs");
      writeFileSync(skillMdPath, skillContent);

      // Also write to vault adapter for consistency
      await this.app.vault.adapter.write(`${SKILLS_FOLDER}/${plugin.id}/SKILL.md`, skillContent);

      // Create skill object
      const skill: Skill = {
        id: plugin.id,
        name: plugin.name,
        description: `Comprehensive knowledge about the ${plugin.name} Obsidian plugin (generated by repomix).`,
        pluginId: plugin.id,
        content: skillContent,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenEstimate: Math.ceil(skillContent.length / 3.5),
      };

      this.skillsCache.set(plugin.id, skill);
      console.log(`[Skills] Generated repomix skill for ${plugin.name}: ~${skill.tokenEstimate} tokens`);

      return skill;
    } finally {
      // Clean up temp directory
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn(`[Skills] Failed to clean up temp dir:`, e);
      }
    }
  }

  /**
   * Run repomix CLI to generate a skill from a remote repo
   */
  private runRepomix(repoUrl: string, outputDir: string, skillName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[Skills] Running repomix for ${repoUrl}`);

      const args = [
        "repomix",
        "--remote", repoUrl,
        "--skill-generate", skillName,
        "--output-dir", outputDir,
        "--quiet",
      ];

      const proc = spawn("npx", args, {
        shell: true,
        cwd: outputDir,
        timeout: 120000, // 2 minute timeout
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          console.log(`[Skills] Repomix completed successfully`);
          resolve();
        } else {
          reject(new Error(`Repomix exited with code ${code}: ${stderr || stdout}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to run repomix: ${err.message}`));
      });
    });
  }

  /**
   * Enhance repomix-generated skill with Obsidian plugin metadata
   */
  private enhanceRepomixSkill(content: string, plugin: CommunityPlugin, repoUrl: string): string {
    // Add Obsidian-specific header
    const obsidianHeader = `---
pluginId: ${plugin.id}
pluginName: ${plugin.name}
pluginRepo: ${plugin.repo}
generatedBy: repomix
createdAt: ${new Date().toISOString()}
---

> **Obsidian Plugin**: ${plugin.name}
> ${plugin.description}
> **Repository**: ${repoUrl}

`;

    // Insert after first line or at beginning
    const lines = content.split("\n");
    if (lines[0].startsWith("---")) {
      // Already has frontmatter, merge
      const fmEnd = lines.indexOf("---", 1);
      if (fmEnd > 0) {
        lines.splice(1, 0, `pluginId: ${plugin.id}`, `pluginName: ${plugin.name}`);
      }
      return lines.join("\n");
    } else {
      return obsidianHeader + content;
    }
  }

  /**
   * Copy directory recursively using Node fs
   */
  private copyDirRecursive(src: string, dest: string): void {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Generate skill using simple README fetch (fallback mode)
   */
  private async generateSkillSimple(plugin: CommunityPlugin, repoUrl: string): Promise<Skill> {
    console.log(`[Skills] Using simple mode for ${plugin.name}`);

    // Fetch README and relevant files from GitHub
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
    const skillPath = `${SKILLS_FOLDER}/${plugin.id}/SKILL.md`;
    await this.ensureFolder(`${SKILLS_FOLDER}/${plugin.id}`);
    await this.app.vault.adapter.write(skillPath, skillMd);

    // Create and cache the skill object
    const skill: Skill = {
      id: plugin.id,
      name: plugin.name,
      description: metadata.description,
      pluginId: plugin.id,
      content: skillMd,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokenEstimate: Math.ceil(skillMd.length / 3.5),
    };

    this.skillsCache.set(plugin.id, skill);
    console.log(`[Skills] Generated simple skill for ${plugin.name}: ~${skill.tokenEstimate} tokens`);

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
