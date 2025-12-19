import { App, TFile } from "obsidian";

export interface TemplaterStatus {
  available: boolean;
  version?: string;
  enabled: boolean;
  templatesFolder?: string;
}

export interface TemplateFile {
  path: string;
  name: string;
  folder: string;
}

/**
 * TemplaterService provides a high-level interface to the Templater plugin's API.
 * It handles detection, initialization, and provides typed methods for template operations.
 *
 * Templater is one of Obsidian's most popular plugins (3.4M+ downloads) for advanced
 * template functionality with dynamic content generation.
 */
export class TemplaterService {
  private app: App;
  private templater: any; // Templater plugin API if available

  constructor(app: App) {
    this.app = app;
    this.initialize();
  }

  private initialize(): void {
    // Try to get the Templater plugin
    // @ts-ignore - accessing internal plugin API
    const plugins = this.app.plugins?.plugins;
    if (plugins && plugins["templater-obsidian"]) {
      this.templater = plugins["templater-obsidian"];
      console.log(`[Wand:Templater] Templater detected`);
    } else {
      console.log("[Wand:Templater] Templater not available");
    }
  }

  /**
   * Check if Templater is available and get its status
   */
  getStatus(): TemplaterStatus {
    if (!this.templater) {
      return {
        available: false,
        enabled: false
      };
    }

    // Try to get Templater settings
    let templatesFolder: string | undefined;
    try {
      // @ts-ignore - accessing internal settings
      const settings = this.templater.settings;
      templatesFolder = settings?.templates_folder || settings?.template_folder;
    } catch (error) {
      console.warn("[Wand:Templater] Could not access settings:", error);
    }

    return {
      available: true,
      enabled: true,
      templatesFolder,
    };
  }

  /**
   * Check if Templater is installed and enabled
   */
  isAvailable(): boolean {
    return this.templater !== undefined;
  }

  /**
   * Execute a template file and return the generated content without inserting it.
   * This is useful for getting template output to use programmatically.
   *
   * @param templatePath - Path to the template file (e.g., "Templates/Daily Note.md")
   * @param targetFile - Optional file to use as context (for file-specific template vars)
   * @returns The generated template content as a string
   */
  async runTemplate(templatePath: string, targetFile?: TFile): Promise<string> {
    if (!this.templater) {
      throw new Error("Templater is not available. Please install the Templater plugin.");
    }

    // Get the template file
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (!(templateFile instanceof TFile)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    // Read the template content
    const templateContent = await this.app.vault.read(templateFile);

    // Use target file or create a temporary context
    const contextFile = targetFile || this.app.workspace.getActiveFile();

    try {
      // Try to access Templater's templater object for parsing
      // @ts-ignore - accessing internal API
      const templaterObj = this.templater.templater;

      if (templaterObj && typeof templaterObj.parse_template === 'function') {
        // Use Templater's parse function if available
        // @ts-ignore
        const result = await templaterObj.parse_template(
          { target_file: contextFile, run_mode: 4 }, // run_mode 4 = DynamicProcessor
          templateContent
        );
        return result;
      } else if (this.templater.functions_generator) {
        // Fallback: use functions_generator approach
        // This is a simplified fallback that doesn't fully process Templater syntax
        // but at least attempts to use the functions_generator API
        // @ts-ignore - accessing internal API
        const funcGen = this.templater.functions_generator;
        // Note: generate_object returns template functions, but full parsing requires
        // the templater object's parse_template method which we don't have here
        await funcGen.generate_object(contextFile, 4);

        // Since we can't fully parse without templater.parse_template, return raw content
        // with a warning. Users should ensure Templater is properly installed.
        console.warn("[Wand:Templater] Using fallback - template may not be fully processed");
        return templateContent;
      }

      // If we can't parse, return the template as-is
      console.warn("[Wand:Templater] Could not parse template - returning raw content");
      return templateContent;
    } catch (error) {
      throw new Error(`Failed to run template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a template and insert the result at the cursor position (or replace selection).
   * This mimics Templater's normal insert behavior.
   *
   * @param templatePath - Path to the template file
   * @returns Success status and the generated content
   */
  async insertTemplate(templatePath: string): Promise<{ success: boolean; content: string }> {
    if (!this.templater) {
      throw new Error("Templater is not available. Please install the Templater plugin.");
    }

    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) {
      throw new Error("No active editor found");
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      throw new Error("No active file");
    }

    // Generate the template content
    const content = await this.runTemplate(templatePath, activeFile);

    // Insert at cursor or replace selection
    const cursor = editor.getCursor();
    editor.replaceRange(content, cursor);

    return { success: true, content };
  }

  /**
   * Create a new note from a template with optional dynamic values.
   * This uses Templater's create_new_note_from_template functionality.
   *
   * @param templatePath - Path to the template file
   * @param outputPath - Path where the new note should be created
   * @param openNote - Whether to open the created note (default: false)
   * @param folderPath - Optional folder to create the note in (overrides outputPath directory)
   * @returns The created TFile
   */
  async createFromTemplate(
    templatePath: string,
    outputPath: string,
    openNote: boolean = false,
    folderPath?: string
  ): Promise<TFile> {
    if (!this.templater) {
      throw new Error("Templater is not available. Please install the Templater plugin.");
    }

    // Get the template file
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (!(templateFile instanceof TFile)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    try {
      // Try to use Templater's create_new_note_from_template if available
      // @ts-ignore - accessing internal API
      const templaterObj = this.templater.templater;

      if (templaterObj && typeof templaterObj.create_new_note_from_template === 'function') {
        // @ts-ignore
        const createdFile = await templaterObj.create_new_note_from_template(
          templateFile,
          folderPath || outputPath.substring(0, outputPath.lastIndexOf('/')),
          outputPath.substring(outputPath.lastIndexOf('/') + 1),
          openNote
        );
        return createdFile;
      }

      // Fallback: manually create the note with template content
      const content = await this.runTemplate(templatePath);

      // Ensure the parent folder exists
      const folderMatch = outputPath.match(/^(.*)\/[^/]+$/);
      if (folderMatch) {
        const folder = folderMatch[1];
        if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
          await this.app.vault.createFolder(folder);
        }
      }

      // Create the file
      const createdFile = await this.app.vault.create(outputPath, content);

      // Open if requested
      if (openNote) {
        await this.app.workspace.getLeaf().openFile(createdFile);
      }

      return createdFile;
    } catch (error) {
      throw new Error(`Failed to create note from template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available template files.
   * Returns templates from the configured Templater folder.
   *
   * @returns Array of template file information
   */
  async listTemplates(): Promise<TemplateFile[]> {
    const status = this.getStatus();
    const templates: TemplateFile[] = [];

    if (!status.templatesFolder) {
      // If no specific folder configured, look for common template locations
      const commonFolders = ["Templates", "templates", "_templates"];

      for (const folderPath of commonFolders) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (folder) {
          const files = this.app.vault.getMarkdownFiles();
          for (const file of files) {
            if (file.path.startsWith(folderPath + "/")) {
              templates.push({
                path: file.path,
                name: file.basename,
                folder: folderPath,
              });
            }
          }
        }
      }
    } else {
      // Use configured folder
      const files = this.app.vault.getMarkdownFiles();
      for (const file of files) {
        if (file.path.startsWith(status.templatesFolder + "/")) {
          templates.push({
            path: file.path,
            name: file.basename,
            folder: status.templatesFolder,
          });
        }
      }
    }

    return templates;
  }
}
