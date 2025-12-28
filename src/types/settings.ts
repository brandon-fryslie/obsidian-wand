export type ApprovalMode = "ask" | "yolo" | "paranoid";

export type AgentType = "wand";

export interface ToolAgentSettings {
  agent: {
    type: AgentType;
  };
  llm: {
    provider: "openai" | "anthropic" | "custom";
    /** @deprecated Use provider-specific keys instead */
    apiKey: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    customApiKey?: string;
    customEndpoint?: string;
    anthropicEndpoint?: string;
    model: string;
    temperature: number;
    streaming: boolean;
    maxTokens: number;
  };
  approval: {
    // Mode: 'ask' (smart defaults), 'yolo' (auto-approve all), 'paranoid' (ask for everything)
    mode: ApprovalMode;
    // Tools that are always allowed without asking (used in 'ask' mode)
    allowedTools: string[];
    // Tools that are always denied
    deniedTools: string[];
    // Path patterns where writes are allowed without asking (glob patterns)
    allowedPaths: string[];
    // Remember approvals during session (approve once = approved for session)
    sessionMemory: boolean;
  };
  chat: {
    maxHistory: number;
    showThinking: boolean;
    autoSavePlans: boolean;
    persistHistory: boolean;
  };
  ui: {
    theme: "light" | "dark" | "obsidian";
    fontSize: number;
    showRibbonIcon: boolean;
  };
}

// Tools that are safe to run without approval (read-only operations)
export const READ_ONLY_TOOLS = [
  "vault.readFile",
  "vault.searchText",
  "vault.listFiles",
  "editor.getSelection",
  "editor.getActiveFilePath",
  "workspace.getContext",
  "commands.list",
  "util.parseMarkdownBullets",
  "util.slugifyTitle",
];

// Tools that modify state but are generally safe
export const SAFE_WRITE_TOOLS = [
  "vault.ensureFolder",
  "vault.createFile",
  "workspace.openFile",
  "editor.insertAtCursor",
];

// Tools that need extra caution
export const DANGEROUS_TOOLS = [
  "vault.delete",
  "vault.rename",
  "vault.writeFile",
  "editor.replaceSelection",
  "commands.run",
];

export const DEFAULT_SETTINGS: ToolAgentSettings = {
  agent: {
    type: "wand",
  },
  llm: {
    provider: "openai",
    apiKey: "", // deprecated, kept for migration
    openaiApiKey: "",
    anthropicApiKey: "",
    customApiKey: "",
    customEndpoint: "",
    anthropicEndpoint: "",
    model: "gpt-4-turbo-preview",
    temperature: 0.3,
    streaming: true,
    maxTokens: 4000,
  },
  approval: {
    mode: "ask",
    // By default, read-only tools are always allowed
    allowedTools: [...READ_ONLY_TOOLS],
    deniedTools: [],
    allowedPaths: [],
    sessionMemory: true,
  },
  chat: {
    maxHistory: 50,
    showThinking: false,
    autoSavePlans: false,
    persistHistory: true,
  },
  ui: {
    theme: "obsidian",
    fontSize: 14,
    showRibbonIcon: true,
  },
};
