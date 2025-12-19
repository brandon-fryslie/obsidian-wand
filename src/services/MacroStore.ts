import { App, MarkdownView, normalizePath } from "obsidian";
import { ActionPlan } from "../types/ActionPlan";
import { nanoid } from "nanoid";

export interface SavedMacro {
  id: string;
  name: string;
  description: string;
  plan: ActionPlan;
  parameters: MacroParameter[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface MacroParameter {
  name: string;
  type: "selection" | "filePath" | "folderPath" | "text";
  description: string;
  required: boolean;
  default?: string;
}

export interface MacroExecution {
  macroId: string;
  parameterValues: Record<string, string>;
  executedAt: Date;
  success: boolean;
  results?: any;
}

export class MacroStore {
  private app: App;
  private macros: Map<string, SavedMacro> = new Map();
  private executions: MacroExecution[] = [];
  private dataPath: string;

  constructor(app: App) {
    this.app = app;
    this.dataPath = normalizePath(".obsidian/plugins/obsidian-toolagent/data");
  }

  async load() {
    try {
      await this.ensureDataDirectory();
      await this.loadMacros();
      await this.loadExecutions();
    } catch (error) {
      console.error("Failed to load macro data:", error);
      // Continue with empty state
    }
  }

  async saveMacro(macro: Omit<SavedMacro, "id" | "createdAt" | "updatedAt" | "usageCount">): Promise<SavedMacro> {
    const savedMacro: SavedMacro = {
      ...macro,
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };

    this.macros.set(savedMacro.id, savedMacro);
    await this.saveMacrosToFile();
    return savedMacro;
  }

  async updateMacro(id: string, updates: Partial<SavedMacro>): Promise<SavedMacro | null> {
    const macro = this.macros.get(id);
    if (!macro) return null;

    const updatedMacro = {
      ...macro,
      ...updates,
      updatedAt: new Date(),
    };

    this.macros.set(id, updatedMacro);
    await this.saveMacrosToFile();
    return updatedMacro;
  }

  async deleteMacro(id: string): Promise<boolean> {
    const deleted = this.macros.delete(id);
    if (deleted) {
      await this.saveMacrosToFile();
    }
    return deleted;
  }

  getMacro(id: string): SavedMacro | null {
    return this.macros.get(id) || null;
  }

  getAllMacros(): SavedMacro[] {
    return Array.from(this.macros.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  searchMacros(query: string): SavedMacro[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllMacros().filter(macro =>
      macro.name.toLowerCase().includes(lowerQuery) ||
      macro.description.toLowerCase().includes(lowerQuery) ||
      macro.plan.goal.toLowerCase().includes(lowerQuery)
    );
  }

  async recordExecution(execution: Omit<MacroExecution, "executedAt">): Promise<void> {
    const macro = this.macros.get(execution.macroId);
    if (macro) {
      macro.usageCount++;
      this.macros.set(execution.macroId, macro);
      await this.saveMacrosToFile();
    }

    this.executions.push({
      ...execution,
      executedAt: new Date(),
    });

    // Keep only the last 100 executions
    if (this.executions.length > 100) {
      this.executions = this.executions.slice(-100);
    }

    await this.saveExecutionsToFile();
  }

  getExecutionHistory(macroId?: string, limit: number = 10): MacroExecution[] {
    const filtered = macroId
      ? this.executions.filter(e => e.macroId === macroId)
      : this.executions;

    return filtered
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
      .slice(0, limit);
  }

  async createMacroFromPlan(plan: ActionPlan, name?: string): Promise<SavedMacro> {
    const macroName = name || this.generateMacroName(plan);
    const parameters = this.extractParameters(plan);

    return this.saveMacro({
      name: macroName,
      description: plan.goal,
      plan,
      parameters,
    });
  }

  async executeMacro(macroId: string, parameterValues?: Record<string, string>): Promise<ActionPlan> {
    const macro = this.macros.get(macroId);
    if (!macro) {
      throw new Error(`Macro not found: ${macroId}`);
    }

    // Gather current context values if no parameters provided
    const values = parameterValues || await this.getCurrentContextValues();

    // Validate required parameters
    for (const param of macro.parameters) {
      if (param.required && !values[param.name]) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
    }

    // Add default values for missing optional parameters
    for (const param of macro.parameters) {
      if (!values[param.name] && param.default !== undefined) {
        values[param.name] = param.default;
      }
    }

    // Bind parameters to the plan
    return this.bindParameters(macro.plan, values);
  }

  async exportMacros(macroIds?: string[]): Promise<string> {
    const macrosToExport = macroIds
      ? macroIds.map(id => this.macros.get(id)).filter(Boolean) as SavedMacro[]
      : this.getAllMacros();

    const exportData = {
      version: "1.0",
      exported: new Date().toISOString(),
      macros: macrosToExport,
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importMacros(jsonData: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(jsonData);

      if (!data.macros || !Array.isArray(data.macros)) {
        throw new Error("Invalid import format");
      }

      for (const macroData of data.macros) {
        try {
          // Validate macro data structure
          if (!macroData.name || !macroData.plan) {
            errors.push(`Invalid macro: ${macroData.name || "unnamed"}`);
            continue;
          }

          // Create new macro with fresh ID and timestamps
          await this.saveMacro({
            name: macroData.name,
            description: macroData.description || "",
            plan: macroData.plan,
            parameters: macroData.parameters || [],
          });

          imported++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to import ${macroData.name}: ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to parse import data: ${errorMsg}`);
    }

    return { imported, errors };
  }

  private async ensureDataDirectory(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!adapter.exists(this.dataPath)) {
      await adapter.mkdir(this.dataPath);
    }
  }

  private async loadMacros(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const macrosPath = `${this.dataPath}/macros.json`;

    if (await adapter.exists(macrosPath)) {
      const data = await adapter.read(macrosPath);
      const macroData = JSON.parse(data);

      this.macros = new Map(
        macroData.map((macro: any) => [
          macro.id,
          {
            ...macro,
            createdAt: new Date(macro.createdAt),
            updatedAt: new Date(macro.updatedAt),
          }
        ])
      );
    }
  }

  private async saveMacrosToFile(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const macrosPath = `${this.dataPath}/macros.json`;

    const data = Array.from(this.macros.values());
    await adapter.write(macrosPath, JSON.stringify(data, null, 2));
  }

  private async loadExecutions(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const executionsPath = `${this.dataPath}/executions.json`;

    if (await adapter.exists(executionsPath)) {
      const data = await adapter.read(executionsPath);
      const executionData = JSON.parse(data);

      this.executions = executionData.map((exec: any) => ({
        ...exec,
        executedAt: new Date(exec.executedAt),
      }));
    }
  }

  private async saveExecutionsToFile(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const executionsPath = `${this.dataPath}/executions.json`;
    await adapter.write(executionsPath, JSON.stringify(this.executions, null, 2));
  }

  private extractParameters(plan: ActionPlan): MacroParameter[] {
    const parameters: MacroParameter[] = [];
    const seenParams = new Set<string>();

    // Look for common parameter patterns in the plan
    for (const step of plan.steps) {
      // Check for selection usage
      if (JSON.stringify(step.args).includes("${selection}") || plan.goal.toLowerCase().includes("selection")) {
        if (!seenParams.has("selection")) {
          parameters.push({
            name: "selection",
            type: "selection",
            description: "Selected text to process",
            required: true,
          });
          seenParams.add("selection");
        }
      }

      // Check for file path patterns
      if (plan.goal.toLowerCase().includes("folder") || plan.goal.toLowerCase().includes("directory")) {
        if (!seenParams.has("folder")) {
          parameters.push({
            name: "folder",
            type: "folderPath",
            description: "Target folder path",
            required: false,
            default: "",
          });
          seenParams.add("folder");
        }
      }

      // Check for active file usage
      if (plan.goal.toLowerCase().includes("current") || plan.goal.toLowerCase().includes("active")) {
        if (!seenParams.has("activeFile")) {
          parameters.push({
            name: "activeFile",
            type: "filePath",
            description: "Current active file",
            required: false,
          });
          seenParams.add("activeFile");
        }
      }
    }

    return parameters;
  }

  private generateMacroName(plan: ActionPlan): string {
    // Create a name from the goal
    const name = plan.goal
      .split(" ")
      .slice(0, 5)
      .join(" ")
      .replace(/^[a-z]/, c => c.toUpperCase());

    return name || "Untitled Macro";
  }

  private async getCurrentContextValues(): Promise<Record<string, string>> {
    const activeFile = this.app.workspace.getActiveFile();
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = activeView?.editor?.getSelection();

    return {
      activeFile: activeFile?.path || "",
      selection: selection || "",
      today: new Date().toISOString().split("T")[0],
      now: new Date().toISOString(),
    };
  }

  private bindParameters(plan: ActionPlan, values: Record<string, string>): ActionPlan {
    const jsonStr = JSON.stringify(plan);
    let boundStr = jsonStr;

    // Replace parameter placeholders
    for (const [key, value] of Object.entries(values)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, "g");
      boundStr = boundStr.replace(placeholder, value);
    }

    try {
      return JSON.parse(boundStr);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to bind parameters to plan: ${errorMsg}`);
    }
  }
}
