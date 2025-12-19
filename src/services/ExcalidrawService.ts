import { App } from "obsidian";

export interface ExcalidrawStatus {
  available: boolean;
  enabled: boolean;
  version?: string;
}

export interface CreateDrawingOptions {
  filename?: string;
  foldername?: string;
  templatePath?: string;
  onNewPane?: boolean;
}

/**
 * ExcalidrawService provides a high-level interface to the Excalidraw plugin's API.
 * It handles detection, initialization, and provides typed methods for drawing operations.
 *
 * Excalidraw is one of Obsidian's most popular plugins (5M+ downloads) for creating
 * beautiful hand-drawn-like diagrams, flowcharts, and visual content.
 */
export class ExcalidrawService {
  private app: App;
  private excalidrawPlugin: any; // Excalidraw plugin API if available

  constructor(app: App) {
    this.app = app;
    this.initialize();
  }

  private initialize(): void {
    // Try to get the Excalidraw plugin
    // @ts-ignore - accessing internal plugin API
    const plugins = this.app.plugins?.plugins;
    if (plugins && plugins["obsidian-excalidraw-plugin"]) {
      this.excalidrawPlugin = plugins["obsidian-excalidraw-plugin"];
      console.log(`[Wand:Excalidraw] Excalidraw plugin detected`);
    } else {
      console.log("[Wand:Excalidraw] Excalidraw plugin not available");
    }
  }

  /**
   * Check if Excalidraw is available and get its status
   */
  getStatus(): ExcalidrawStatus {
    if (!this.excalidrawPlugin) {
      return {
        available: false,
        enabled: false,
      };
    }

    // Try to get version from manifest
    let version: string | undefined;
    try {
      // @ts-ignore - accessing internal manifest
      version = this.excalidrawPlugin.manifest?.version;
    } catch (error) {
      console.warn("[Wand:Excalidraw] Could not access version:", error);
    }

    return {
      available: true,
      enabled: true,
      version,
    };
  }

  /**
   * Check if Excalidraw is installed and enabled
   */
  isAvailable(): boolean {
    return this.excalidrawPlugin !== undefined;
  }

  /**
   * Get the ExcalidrawAutomate instance for advanced operations.
   * ExcalidrawAutomate is the main API object exposed by the plugin.
   *
   * @returns The ExcalidrawAutomate instance or undefined if not available
   */
  getExcalidrawAutomate(): any {
    if (!this.excalidrawPlugin) {
      return undefined;
    }

    try {
      // Try to access via plugin's ea property first
      // @ts-ignore - accessing plugin API
      if (this.excalidrawPlugin.ea) {
        return this.excalidrawPlugin.ea;
      }

      // Fallback: try to access global ExcalidrawAutomate
      // @ts-ignore - accessing global API
      if ((window as any).ExcalidrawAutomate) {
        return (window as any).ExcalidrawAutomate;
      }

      console.warn("[Wand:Excalidraw] ExcalidrawAutomate API not found");
      return undefined;
    } catch (error) {
      console.warn("[Wand:Excalidraw] Error accessing ExcalidrawAutomate:", error);
      return undefined;
    }
  }

  /**
   * Create a new Excalidraw drawing with optional template and folder.
   *
   * @param options - Configuration for the new drawing
   * @returns Path to the created drawing file
   */
  async createDrawing(options: CreateDrawingOptions = {}): Promise<string> {
    if (!this.excalidrawPlugin) {
      throw new Error("Excalidraw plugin is not available. Please install the Excalidraw plugin.");
    }

    const ea = this.getExcalidrawAutomate();
    if (!ea) {
      throw new Error("ExcalidrawAutomate API is not available");
    }

    try {
      // Reset to default state
      ea.reset();

      // Create the drawing with the provided options
      const createdFile = await ea.create({
        filename: options.filename || "Drawing",
        foldername: options.foldername,
        templatePath: options.templatePath,
        onNewPane: options.onNewPane !== undefined ? options.onNewPane : true,
      });

      // Return the path to the created file
      if (createdFile && createdFile.path) {
        return createdFile.path;
      }

      // Fallback: try to get active file path
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        return activeFile.path;
      }

      throw new Error("Failed to get path of created drawing");
    } catch (error) {
      throw new Error(`Failed to create drawing: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export the current Excalidraw drawing to SVG format.
   *
   * @param drawingPath - Optional path to a specific drawing file. If not provided, uses the active file.
   * @returns SVG string of the drawing
   */
  async exportToSVG(drawingPath?: string): Promise<string> {
    if (!this.excalidrawPlugin) {
      throw new Error("Excalidraw plugin is not available. Please install the Excalidraw plugin.");
    }

    const ea = this.getExcalidrawAutomate();
    if (!ea) {
      throw new Error("ExcalidrawAutomate API is not available");
    }

    try {
      // If a specific path is provided, open that file first
      if (drawingPath) {
        const file = this.app.vault.getAbstractFileByPath(drawingPath);
        if (file) {
          await this.app.workspace.getLeaf().openFile(file as any);
        } else {
          throw new Error(`Drawing file not found: ${drawingPath}`);
        }
      }

      // Export to SVG
      const svg = await ea.createSVG();

      if (!svg) {
        throw new Error("Failed to generate SVG - result is empty");
      }

      return svg;
    } catch (error) {
      throw new Error(`Failed to export to SVG: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export the current Excalidraw drawing to PNG format.
   *
   * @param drawingPath - Optional path to a specific drawing file. If not provided, uses the active file.
   * @returns Base64-encoded PNG string
   */
  async exportToPNG(drawingPath?: string): Promise<string> {
    if (!this.excalidrawPlugin) {
      throw new Error("Excalidraw plugin is not available. Please install the Excalidraw plugin.");
    }

    const ea = this.getExcalidrawAutomate();
    if (!ea) {
      throw new Error("ExcalidrawAutomate API is not available");
    }

    try {
      // If a specific path is provided, open that file first
      if (drawingPath) {
        const file = this.app.vault.getAbstractFileByPath(drawingPath);
        if (file) {
          await this.app.workspace.getLeaf().openFile(file as any);
        } else {
          throw new Error(`Drawing file not found: ${drawingPath}`);
        }
      }

      // Export to PNG
      const png = await ea.createPNG();

      if (!png) {
        throw new Error("Failed to generate PNG - result is empty");
      }

      return png;
    } catch (error) {
      throw new Error(`Failed to export to PNG: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
