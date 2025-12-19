import { App } from "obsidian";

export interface TasksStatus {
  available: boolean;
  version?: string;
  enabled: boolean;
}

/**
 * TasksService provides a high-level interface to the Tasks plugin's API.
 * It handles detection, initialization, and provides typed methods for task operations.
 *
 * Tasks is one of Obsidian's most popular plugins (3M+ downloads) for managing
 * tasks with rich metadata like due dates, priorities, and recurrence.
 */
export class TasksService {
  private app: App;
  private tasksPlugin: any; // Tasks plugin API if available

  constructor(app: App) {
    this.app = app;
    this.initialize();
  }

  private initialize(): void {
    // Try to get the Tasks plugin
    // @ts-ignore - accessing internal plugin API
    const plugins = this.app.plugins?.plugins;
    if (plugins && plugins["obsidian-tasks-plugin"]) {
      this.tasksPlugin = plugins["obsidian-tasks-plugin"];
      console.log(`[Wand:Tasks] Tasks plugin detected`);
    } else {
      console.log("[Wand:Tasks] Tasks plugin not available");
    }
  }

  /**
   * Check if Tasks is available and get its status
   */
  getStatus(): TasksStatus {
    if (!this.tasksPlugin) {
      return {
        available: false,
        enabled: false,
      };
    }

    // Try to get version from manifest
    let version: string | undefined;
    try {
      // @ts-ignore - accessing internal manifest
      version = this.tasksPlugin.manifest?.version;
    } catch (error) {
      console.warn("[Wand:Tasks] Could not access version:", error);
    }

    return {
      available: true,
      enabled: true,
      version,
    };
  }

  /**
   * Check if Tasks is installed and enabled
   */
  isAvailable(): boolean {
    return this.tasksPlugin !== undefined;
  }

  /**
   * Open the Tasks modal to create a new task.
   * Returns the created task line as a markdown string, or empty string if cancelled.
   *
   * @returns The task line in markdown format (e.g., "- [ ] My task 📅 2024-01-15")
   */
  async createTask(): Promise<string> {
    if (!this.tasksPlugin) {
      throw new Error("Tasks plugin is not available. Please install the Tasks plugin.");
    }

    try {
      // Access the Tasks API v1
      // @ts-ignore - accessing plugin API
      const api = this.tasksPlugin.apiV1;

      if (!api || typeof api.createTaskLineModal !== 'function') {
        throw new Error("Tasks API v1 is not available or does not support createTaskLineModal");
      }

      // Open the modal and wait for user input
      const taskLine = await api.createTaskLineModal();

      return taskLine || "";
    } catch (error) {
      throw new Error(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Open the Tasks modal to edit an existing task line.
   * Returns the edited task line as a markdown string, or empty string if cancelled.
   *
   * @param taskLine - The existing task line to edit (e.g., "- [ ] My task")
   * @returns The edited task line in markdown format
   */
  async editTask(taskLine: string): Promise<string> {
    if (!this.tasksPlugin) {
      throw new Error("Tasks plugin is not available. Please install the Tasks plugin.");
    }

    try {
      // Access the Tasks API v1
      // @ts-ignore - accessing plugin API
      const api = this.tasksPlugin.apiV1;

      if (!api || typeof api.editTaskLineModal !== 'function') {
        throw new Error("Tasks API v1 is not available or does not support editTaskLineModal");
      }

      // Open the modal with the existing task pre-filled
      const editedLine = await api.editTaskLineModal(taskLine);

      return editedLine || "";
    } catch (error) {
      throw new Error(`Failed to edit task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Toggle the completion status of a task.
   * This handles recurrence rules automatically if the task has them.
   *
   * @param line - The task line content
   * @param path - The file path containing the task
   * @returns The new task line after toggling
   */
  toggleTask(line: string, path: string): string {
    if (!this.tasksPlugin) {
      throw new Error("Tasks plugin is not available. Please install the Tasks plugin.");
    }

    try {
      // Access the Tasks API v1
      // @ts-ignore - accessing plugin API
      const api = this.tasksPlugin.apiV1;

      if (!api || typeof api.executeToggleTaskDoneCommand !== 'function') {
        throw new Error("Tasks API v1 is not available or does not support executeToggleTaskDoneCommand");
      }

      // Execute the toggle command
      const result = api.executeToggleTaskDoneCommand(line, path);

      return result || line;
    } catch (error) {
      throw new Error(`Failed to toggle task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
