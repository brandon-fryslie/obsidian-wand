import { App, normalizePath } from "obsidian";
import { nanoid } from "nanoid";
import type {
  PlanTemplate,
  TemplateDraft,
  TemplateCategory,
  TemplateParameter,
} from "../types/PlanTemplate";
import type { ActionPlan } from "../types/ActionPlan";
import type { Plan } from "../types/Plan";

/**
 * Service for managing plan templates
 */
export class TemplateStore {
  private app: App;
  private templates: Map<string, PlanTemplate> = new Map();
  private dataPath: string;

  constructor(app: App) {
    this.app = app;
    this.dataPath = normalizePath(
      ".obsidian/plugins/obsidian-toolagent/data"
    );
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new template
   */
  create(draft: TemplateDraft): PlanTemplate {
    const template: PlanTemplate = {
      id: nanoid(),
      name: draft.name,
      description: draft.description,
      category: draft.category,
      icon: draft.icon,
      actionPlan: draft.actionPlan,
      parameters: draft.parameters,
      isBuiltIn: false,
      createdAt: new Date(),
      usageCount: 0,
    };

    this.templates.set(template.id, template);
    this.save().catch((error) => {
      console.error("Failed to save templates:", error);
    });

    return template;
  }

  /**
   * Get a template by ID
   */
  get(id: string): PlanTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Update a template
   */
  update(id: string, changes: Partial<PlanTemplate>): PlanTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    if (template.isBuiltIn) {
      throw new Error("Cannot modify built-in templates");
    }

    const updated: PlanTemplate = {
      ...template,
      ...changes,
      id: template.id, // Prevent ID changes
      isBuiltIn: template.isBuiltIn, // Prevent changing built-in status
      createdAt: template.createdAt, // Prevent creation date changes
    };

    this.templates.set(id, updated);
    this.save().catch((error) => {
      console.error("Failed to save templates:", error);
    });

    return updated;
  }

  /**
   * Delete a template
   */
  delete(id: string): void {
    const template = this.templates.get(id);
    if (!template) {
      return;
    }

    if (template.isBuiltIn) {
      throw new Error("Cannot delete built-in templates");
    }

    this.templates.delete(id);
    this.save().catch((error) => {
      console.error("Failed to save templates:", error);
    });
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * List all templates, optionally filtered by category
   */
  list(category?: TemplateCategory): PlanTemplate[] {
    const allTemplates = Array.from(this.templates.values());

    if (category) {
      return allTemplates.filter((t) => t.category === category);
    }

    return allTemplates.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Search templates by name or description
   */
  search(query: string): PlanTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all built-in templates
   */
  getBuiltIn(): PlanTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.isBuiltIn);
  }

  /**
   * Get all custom (user-created) templates
   */
  getCustom(): PlanTemplate[] {
    return Array.from(this.templates.values()).filter((t) => !t.isBuiltIn);
  }

  // ============================================================================
  // Usage Operations
  // ============================================================================

  /**
   * Create a plan from a template by binding parameters
   */
  createPlanFromTemplate(
    templateId: string,
    params: Record<string, any>
  ): ActionPlan {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required && !params[param.name]) {
        throw new Error(`Missing required parameter: ${param.label}`);
      }
    }

    // Add default values for missing optional parameters
    for (const param of template.parameters) {
      if (!params[param.name] && param.defaultValue !== undefined) {
        params[param.name] = param.defaultValue;
      }
    }

    // Bind parameters to the action plan
    const boundPlan = this.bindParameters(template.actionPlan, params);

    // Increment usage count
    template.usageCount++;
    this.templates.set(templateId, template);
    this.save().catch((error) => {
      console.error("Failed to save templates:", error);
    });

    return boundPlan;
  }

  /**
   * Save a plan as a template
   */
  saveAsTemplate(plan: Plan, name: string, description: string): PlanTemplate {
    // Extract parameters from the plan
    const parameters = this.extractParameters(plan.actionPlan);

    // Create template with the plan's category or default to custom
    const template: PlanTemplate = {
      id: nanoid(),
      name,
      description,
      category: "custom",
      actionPlan: plan.actionPlan,
      parameters,
      isBuiltIn: false,
      createdAt: new Date(),
      usageCount: 0,
    };

    this.templates.set(template.id, template);
    this.save().catch((error) => {
      console.error("Failed to save templates:", error);
    });

    return template;
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Load templates from disk
   */
  async load(): Promise<void> {
    try {
      await this.ensureDataDirectory();

      // Load built-in templates first
      this.loadBuiltInTemplates();

      // Then load custom templates
      const templatesPath = `${this.dataPath}/templates.json`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(templatesPath)) {
        const data = await adapter.read(templatesPath);
        const templateData = JSON.parse(data);

        // Add custom templates to the map
        for (const tmpl of templateData) {
          if (!tmpl.isBuiltIn) {
            this.templates.set(tmpl.id, this.deserializeTemplate(tmpl));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      // Continue with built-in templates only
    }
  }

  /**
   * Save templates to disk
   */
  async save(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      const templatesPath = `${this.dataPath}/templates.json`;
      const adapter = this.app.vault.adapter;

      // Only save custom templates (built-in templates are hardcoded)
      const customTemplates = Array.from(this.templates.values())
        .filter((t) => !t.isBuiltIn)
        .map((t) => this.serializeTemplate(t));

      await adapter.write(
        templatesPath,
        JSON.stringify(customTemplates, null, 2)
      );
    } catch (error) {
      console.error("Failed to save templates:", error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.dataPath))) {
      await adapter.mkdir(this.dataPath);
    }
  }

  /**
   * Bind parameters to an action plan by replacing placeholders
   */
  private bindParameters(
    plan: ActionPlan,
    params: Record<string, any>
  ): ActionPlan {
    const jsonStr = JSON.stringify(plan);
    let boundStr = jsonStr;

    // Replace parameter placeholders
    for (const [key, value] of Object.entries(params)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, "g");
      boundStr = boundStr.replace(placeholder, String(value));
    }

    try {
      return JSON.parse(boundStr);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to bind parameters to template: ${errorMsg}`);
    }
  }

  /**
   * Extract parameters from an action plan
   * This is a simple implementation that looks for common patterns
   */
  private extractParameters(plan: ActionPlan): TemplateParameter[] {
    const parameters: TemplateParameter[] = [];
    const seenParams = new Set<string>();

    // Convert plan to JSON to search for placeholders
    const jsonStr = JSON.stringify(plan);
    const placeholderRegex = /\$\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
    let match;

    while ((match = placeholderRegex.exec(jsonStr)) !== null) {
      const paramName = match[1];
      if (!seenParams.has(paramName)) {
        seenParams.add(paramName);

        // Infer parameter type from name
        let type: TemplateParameter["type"] = "string";
        if (paramName.toLowerCase().includes("date")) {
          type = "date";
        } else if (paramName.toLowerCase().includes("file")) {
          type = "file";
        } else if (paramName.toLowerCase().includes("folder")) {
          type = "folder";
        } else if (paramName.toLowerCase().includes("selection")) {
          type = "selection";
        }

        parameters.push({
          name: paramName,
          label: this.humanizeParamName(paramName),
          type,
          description: `Value for ${paramName}`,
          required: true,
        });
      }
    }

    return parameters;
  }

  /**
   * Convert a parameter name like "targetFolder" to "Target Folder"
   */
  private humanizeParamName(name: string): string {
    return (
      name
        // Insert space before capital letters
        .replace(/([A-Z])/g, " $1")
        // Capitalize first letter
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    );
  }

  /**
   * Serialize a template for storage
   */
  private serializeTemplate(template: PlanTemplate): any {
    return {
      ...template,
      createdAt: template.createdAt.toISOString(),
    };
  }

  /**
   * Deserialize a template from storage
   */
  private deserializeTemplate(data: any): PlanTemplate {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
    };
  }

  /**
   * Load built-in templates
   */
  private loadBuiltInTemplates(): void {
    const builtInTemplates: PlanTemplate[] = [
      // 1. Create Daily Note
      {
        id: "builtin-daily-note",
        name: "Create Daily Note",
        description: "Create a daily note for a specific date",
        category: "daily-notes",
        icon: "📝",
        actionPlan: {
          goal: "Create daily note for ${date}",
          assumptions: [
            "Daily notes folder exists",
            "Date format is YYYY-MM-DD",
          ],
          riskLevel: "writes",
          steps: [
            {
              id: "step-1",
              tool: "vault.ensureFolder",
              args: {
                path: "Daily",
              },
              preview: "Ensure Daily folder exists",
            },
            {
              id: "step-2",
              tool: "vault.createFile",
              args: {
                path: "Daily/${date}.md",
                content: "# ${date}\n\n",
              },
              dependsOn: ["step-1"],
              preview: "Create daily note file",
            },
            {
              id: "step-3",
              tool: "workspace.openFile",
              args: {
                path: "Daily/${date}.md",
              },
              dependsOn: ["step-2"],
              preview: "Open the new daily note",
            },
          ],
        },
        parameters: [
          {
            name: "date",
            label: "Date",
            type: "date",
            description: "Date for the daily note (YYYY-MM-DD)",
            required: true,
            defaultValue: new Date().toISOString().split("T")[0],
          },
        ],
        isBuiltIn: true,
        createdAt: new Date(),
        usageCount: 0,
      },

      // 2. Organize Notes by Tag
      {
        id: "builtin-organize-by-tag",
        name: "Organize Notes by Tag",
        description: "Move all notes with a specific tag to a folder",
        category: "organization",
        icon: "📁",
        actionPlan: {
          goal: "Move all notes tagged with #${tag} to ${targetFolder}",
          assumptions: ["Tag format is correct", "Target folder path is valid"],
          riskLevel: "writes",
          steps: [
            {
              id: "step-1",
              tool: "vault.ensureFolder",
              args: {
                path: "${targetFolder}",
              },
              preview: "Ensure target folder exists",
            },
            {
              id: "step-2",
              tool: "vault.searchText",
              args: {
                query: "#${tag}",
              },
              preview: "Find all notes with the tag",
            },
            {
              id: "step-3",
              tool: "vault.rename",
              args: {
                fromPath: "${item.path}",
                toPath: "${targetFolder}/${item.basename}",
              },
              foreach: {
                from: "step-2.results",
                itemName: "item",
              },
              dependsOn: ["step-1", "step-2"],
              preview: "Move each note to target folder",
            },
          ],
        },
        parameters: [
          {
            name: "tag",
            label: "Tag",
            type: "string",
            description: "Tag to search for (without #)",
            required: true,
            placeholder: "project",
          },
          {
            name: "targetFolder",
            label: "Target Folder",
            type: "folder",
            description: "Folder to move notes to",
            required: true,
            placeholder: "Projects/Archive",
          },
        ],
        isBuiltIn: true,
        createdAt: new Date(),
        usageCount: 0,
      },

      // 3. Create Note from Selection
      {
        id: "builtin-note-from-selection",
        name: "Create Note from Selection",
        description: "Extract selected text into a new note",
        category: "creation",
        icon: "✂️",
        actionPlan: {
          goal: "Create new note from selected text",
          assumptions: ["Text is selected", "Title is valid filename"],
          riskLevel: "writes",
          steps: [
            {
              id: "step-1",
              tool: "editor.getSelection",
              args: {},
              preview: "Get selected text",
            },
            {
              id: "step-2",
              tool: "vault.ensureFolder",
              args: {
                path: "${folder}",
              },
              preview: "Ensure target folder exists",
            },
            {
              id: "step-3",
              tool: "util.slugifyTitle",
              args: {
                title: "${title}",
              },
              preview: "Generate valid filename",
            },
            {
              id: "step-4",
              tool: "vault.createFile",
              args: {
                path: "${folder}/${step-3.result}.md",
                content: "# ${title}\n\n${step-1.result}",
              },
              dependsOn: ["step-1", "step-2", "step-3"],
              preview: "Create new note with selection",
            },
            {
              id: "step-5",
              tool: "editor.replaceSelection",
              args: {
                text: "[[${step-3.result}]]",
              },
              dependsOn: ["step-4"],
              preview: "Replace selection with link to new note",
            },
          ],
        },
        parameters: [
          {
            name: "title",
            label: "Note Title",
            type: "string",
            description: "Title for the new note",
            required: true,
            placeholder: "New Note",
          },
          {
            name: "folder",
            label: "Folder",
            type: "folder",
            description: "Folder to create note in",
            required: false,
            defaultValue: "",
          },
        ],
        isBuiltIn: true,
        createdAt: new Date(),
        usageCount: 0,
      },

      // 4. Bulk Add Frontmatter
      {
        id: "builtin-bulk-frontmatter",
        name: "Bulk Add Frontmatter",
        description: "Add a frontmatter property to all notes in a folder",
        category: "organization",
        icon: "🏷️",
        actionPlan: {
          goal: "Add frontmatter property ${key}: ${value} to all notes in ${folder}",
          assumptions: [
            "Folder exists",
            "Notes have valid frontmatter or none",
          ],
          riskLevel: "writes",
          steps: [
            {
              id: "step-1",
              tool: "vault.listFiles",
              args: {
                folder: "${folder}",
                extension: ".md",
              },
              preview: "List all markdown files in folder",
            },
            {
              id: "step-2",
              tool: "vault.readFile",
              args: {
                path: "${item.path}",
              },
              foreach: {
                from: "step-1.results",
                itemName: "item",
              },
              dependsOn: ["step-1"],
              preview: "Read each file",
            },
            {
              id: "step-3",
              tool: "vault.writeFile",
              args: {
                path: "${item.path}",
                content: "${this.addFrontmatter(item.content, key, value)}",
              },
              foreach: {
                from: "step-1.results",
                itemName: "item",
              },
              dependsOn: ["step-2"],
              preview: "Write updated frontmatter to each file",
            },
          ],
        },
        parameters: [
          {
            name: "folder",
            label: "Folder",
            type: "folder",
            description: "Folder containing notes to update",
            required: true,
            placeholder: "Notes",
          },
          {
            name: "key",
            label: "Property Key",
            type: "string",
            description: "Frontmatter property name",
            required: true,
            placeholder: "status",
          },
          {
            name: "value",
            label: "Property Value",
            type: "string",
            description: "Value to set",
            required: true,
            placeholder: "active",
          },
        ],
        isBuiltIn: true,
        createdAt: new Date(),
        usageCount: 0,
      },

      // 5. Archive Old Notes
      {
        id: "builtin-archive-old-notes",
        name: "Archive Old Notes",
        description: "Move notes older than X days to archive folder",
        category: "organization",
        icon: "📦",
        actionPlan: {
          goal: "Archive notes older than ${olderThan} days to ${archiveFolder}",
          assumptions: [
            "Source folder exists",
            "Archive folder will be created if needed",
          ],
          riskLevel: "writes",
          steps: [
            {
              id: "step-1",
              tool: "vault.ensureFolder",
              args: {
                path: "${archiveFolder}",
              },
              preview: "Ensure archive folder exists",
            },
            {
              id: "step-2",
              tool: "vault.listFiles",
              args: {
                folder: "${sourceFolder}",
                extension: ".md",
              },
              preview: "List all markdown files",
            },
            {
              id: "step-3",
              tool: "vault.rename",
              args: {
                fromPath: "${item.path}",
                toPath: "${archiveFolder}/${item.basename}",
              },
              foreach: {
                from: "step-2.results.filter(f => isOlderThan(f, olderThan))",
                itemName: "item",
              },
              dependsOn: ["step-1", "step-2"],
              preview: "Move old notes to archive",
            },
          ],
        },
        parameters: [
          {
            name: "sourceFolder",
            label: "Source Folder",
            type: "folder",
            description: "Folder to check for old notes",
            required: true,
            placeholder: "Notes",
          },
          {
            name: "olderThan",
            label: "Older Than (days)",
            type: "number",
            description: "Archive notes older than this many days",
            required: true,
            defaultValue: "30",
          },
          {
            name: "archiveFolder",
            label: "Archive Folder",
            type: "folder",
            description: "Folder to move old notes to",
            required: true,
            placeholder: "Archive",
          },
        ],
        isBuiltIn: true,
        createdAt: new Date(),
        usageCount: 0,
      },
    ];

    // Add built-in templates to the map
    for (const template of builtInTemplates) {
      this.templates.set(template.id, template);
    }
  }
}
