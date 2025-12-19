import { App } from "obsidian";

export interface AdvancedTablesStatus {
  available: boolean;
  enabled: boolean;
}

/**
 * AdvancedTablesService provides a high-level interface to the Advanced Tables plugin.
 * It handles detection and provides typed methods for table operations via command execution.
 *
 * Advanced Tables is one of Obsidian's most popular plugins (2.5M+ downloads) for
 * enhanced markdown table editing with formatting, navigation, and manipulation features.
 *
 * Note: Advanced Tables does not expose a public API, so we interact with it by
 * executing its commands through Obsidian's command system.
 */
export class AdvancedTablesService {
  private app: App;
  private plugin: any; // Advanced Tables plugin if available

  constructor(app: App) {
    this.app = app;
    this.initialize();
  }

  private initialize(): void {
    // Try to get the Advanced Tables plugin
    // @ts-ignore - accessing internal plugin API
    const plugins = this.app.plugins?.plugins;
    if (plugins && plugins["table-editor-obsidian"]) {
      this.plugin = plugins["table-editor-obsidian"];
      console.log(`[Wand:AdvancedTables] Advanced Tables plugin detected`);
    } else {
      console.log("[Wand:AdvancedTables] Advanced Tables plugin not available");
    }
  }

  /**
   * Check if Advanced Tables is available and get its status
   */
  getStatus(): AdvancedTablesStatus {
    if (!this.plugin) {
      return {
        available: false,
        enabled: false,
      };
    }

    return {
      available: true,
      enabled: true,
    };
  }

  /**
   * Check if Advanced Tables is installed and enabled
   */
  isAvailable(): boolean {
    return this.plugin !== undefined;
  }

  /**
   * Execute an Advanced Tables command by ID.
   * Commands are prefixed with "table-editor-obsidian:"
   *
   * @param commandId - The command ID without the prefix (e.g., "format-table")
   * @returns true if command was executed, false if command not found
   */
  async executeCommand(commandId: string): Promise<boolean> {
    if (!this.plugin) {
      throw new Error("Advanced Tables plugin is not available. Please install the Advanced Tables plugin.");
    }

    const fullId = `table-editor-obsidian:${commandId}`;

    // @ts-ignore - accessing internal command API
    const commands = this.app.commands;
    if (commands?.commands?.[fullId]) {
      await commands.executeCommandById(fullId);
      return true;
    }

    return false;
  }

  /**
   * Format the current table or all tables in the file.
   * Cursor must be inside a table for single table formatting.
   *
   * @param allTables - If true, formats all tables in the file. If false, formats only the current table.
   * @returns true if successful
   */
  async formatTable(allTables: boolean = false): Promise<boolean> {
    const commandId = allTables ? "format-all-tables" : "format-table";
    return await this.executeCommand(commandId);
  }

  /**
   * Insert a new row before the current row.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async insertRow(): Promise<boolean> {
    return await this.executeCommand("insert-row");
  }

  /**
   * Insert a new column before the current column.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async insertColumn(): Promise<boolean> {
    return await this.executeCommand("insert-column");
  }

  /**
   * Delete the current row.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async deleteRow(): Promise<boolean> {
    return await this.executeCommand("delete-row");
  }

  /**
   * Delete the current column.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async deleteColumn(): Promise<boolean> {
    return await this.executeCommand("delete-column");
  }

  /**
   * Sort table rows by the current column in ascending order.
   * Cursor must be inside a table column.
   *
   * @returns true if successful
   */
  async sortAscending(): Promise<boolean> {
    return await this.executeCommand("sort-rows-ascending");
  }

  /**
   * Sort table rows by the current column in descending order.
   * Cursor must be inside a table column.
   *
   * @returns true if successful
   */
  async sortDescending(): Promise<boolean> {
    return await this.executeCommand("sort-rows-descending");
  }

  /**
   * Set the alignment of the current column.
   * Cursor must be inside a table column.
   *
   * @param alignment - Column alignment: "left", "center", or "right"
   * @returns true if successful
   */
  async alignColumn(alignment: "left" | "center" | "right"): Promise<boolean> {
    const commandMap = {
      left: "left-align-column",
      center: "center-align-column",
      right: "right-align-column",
    };

    return await this.executeCommand(commandMap[alignment]);
  }

  /**
   * Move the current column to the left.
   * Cursor must be inside a table column.
   *
   * @returns true if successful
   */
  async moveColumnLeft(): Promise<boolean> {
    return await this.executeCommand("move-column-left");
  }

  /**
   * Move the current column to the right.
   * Cursor must be inside a table column.
   *
   * @returns true if successful
   */
  async moveColumnRight(): Promise<boolean> {
    return await this.executeCommand("move-column-right");
  }

  /**
   * Move the current row up.
   * Cursor must be inside a table row.
   *
   * @returns true if successful
   */
  async moveRowUp(): Promise<boolean> {
    return await this.executeCommand("move-row-up");
  }

  /**
   * Move the current row down.
   * Cursor must be inside a table row.
   *
   * @returns true if successful
   */
  async moveRowDown(): Promise<boolean> {
    return await this.executeCommand("move-row-down");
  }

  /**
   * Transpose the table (swap rows and columns).
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async transpose(): Promise<boolean> {
    return await this.executeCommand("transpose");
  }

  /**
   * Evaluate formulas in the table.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async evaluateFormulas(): Promise<boolean> {
    return await this.executeCommand("evaluate-formulas");
  }

  /**
   * Navigate to the next cell in the table.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async nextCell(): Promise<boolean> {
    return await this.executeCommand("next-cell");
  }

  /**
   * Navigate to the previous cell in the table.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async previousCell(): Promise<boolean> {
    return await this.executeCommand("previous-cell");
  }

  /**
   * Navigate to the next row in the table.
   * Cursor must be inside a table.
   *
   * @returns true if successful
   */
  async nextRow(): Promise<boolean> {
    return await this.executeCommand("next-row");
  }
}
