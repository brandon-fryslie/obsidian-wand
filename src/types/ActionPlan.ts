export interface ActionPlan {
  goal: string;
  assumptions: string[];
  riskLevel: "read-only" | "writes" | "commands";
  steps: Step[];
}

export interface Step {
  id: string;
  tool: ToolName;
  args: Record<string, any>;
  // Control flow options
  foreach?: {
    from: string; // Path to array in context
    itemName: string; // Variable name for each item
    indexName?: string; // Variable name for index (defaults to 'index')
  };
  dependsOn?: string[]; // Step IDs to complete first
  onError?: "stop" | "skip" | "retry";
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
  preview?: string; // Human-readable description
}

export type ToolName =
  // Vault operations
  | "vault.ensureFolder"
  | "vault.createFile"
  | "vault.readFile"
  | "vault.writeFile"
  | "vault.rename"
  | "vault.delete"
  | "vault.searchText"
  | "vault.listFiles"

  // Editor operations
  | "editor.getSelection"
  | "editor.replaceSelection"
  | "editor.insertAtCursor"
  | "editor.getActiveFilePath"

  // Workspace operations
  | "workspace.openFile"
  | "workspace.getContext"

  // Command operations
  | "commands.list"
  | "commands.run"

  // Dataview operations (requires Dataview plugin)
  | "dataview.query"
  | "dataview.pages"
  | "dataview.tasks"
  | "dataview.status"

  // Templater operations (requires Templater plugin)
  | "templater.status"
  | "templater.run"
  | "templater.insert"
  | "templater.create"

  // Tasks operations (requires Tasks plugin)
  | "tasks.status"
  | "tasks.create"
  | "tasks.edit"
  | "tasks.toggle"

  // Advanced Tables operations (requires Advanced Tables plugin)
  | "advancedtables.status"
  | "advancedtables.format"
  | "advancedtables.insertRow"
  | "advancedtables.insertColumn"
  | "advancedtables.sort"
  | "advancedtables.align"

  // Excalidraw operations (requires Excalidraw plugin)
  | "excalidraw.status"
  | "excalidraw.create"
  | "excalidraw.exportSVG"
  | "excalidraw.exportPNG"

  // Utility functions
  | "util.parseMarkdownBullets"
  | "util.slugifyTitle"

  // Plugin Manager operations
  | "plugins.search"
  | "plugins.list"
  | "plugins.install"
  | "plugins.uninstall"
  | "plugins.enable"
  | "plugins.disable"

  // Skill operations
  | "skills.list"
  | "skills.get"
  | "skills.generate"
  | "skills.delete"
  | "skills.refresh";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ExecutionContext {
  // Current state
  activeFile?: string;
  selection?: string;
  vaultPath: string;

  // Variables from foreach loops
  variables: Record<string, any>;

  // Results from previous steps
  stepResults: Map<string, any>;

  // Available commands (from commands.list)
  availableCommands: CommandInfo[];
}

export interface CommandInfo {
  id: string;
  name: string;
  editorCallback?: boolean;
  callback?: Function;
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}
