export type ApprovalMode = "ask" | "yolo" | "paranoid";

export type AgentType = "wand" | "mini" | "wand-thinking" | "claude-code";

export type LLMProvider = "openai" | "anthropic" | "custom";

/**
 * Per-agent configuration for tools and LLM settings.
 * Each agent type can have its own tool set and optionally override global LLM settings.
 */
export interface AgentConfig {
  /** Which tools this agent can use */
  tools: string[];
  /** Optional LLM configuration override (inherits global if not set) */
  llm?: {
    provider?: LLMProvider;
    model?: string;
    temperature?: number;
  };
}

export interface ToolAgentSettings {
  agent: {
    type: AgentType;
    /** Per-agent configuration (tools and LLM overrides) */
    configs: {
      [agentType: string]: AgentConfig;
    };
  };
  llm: {
    provider: LLMProvider;
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
  "plugins.search",
  "plugins.list",
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
  "plugins.install",
  "plugins.uninstall",
  "plugins.enable",
  "plugins.disable",
];

// All available tools
export const ALL_TOOLS = [
  ...READ_ONLY_TOOLS,
  ...SAFE_WRITE_TOOLS,
  ...DANGEROUS_TOOLS,
  // Plugin-specific tools
  "dataview.query",
  "dataview.pages",
  "dataview.tasks",
  "dataview.status",
  "templater.status",
  "templater.run",
  "templater.insert",
  "templater.create",
  "tasks.status",
  "tasks.create",
  "tasks.edit",
  "tasks.toggle",
  "advancedtables.status",
  "advancedtables.format",
  "advancedtables.insertRow",
  "advancedtables.insertColumn",
  "advancedtables.sort",
  "advancedtables.align",
  "excalidraw.status",
  "excalidraw.create",
  "excalidraw.exportSVG",
  "excalidraw.exportPNG",
];

export const DEFAULT_SETTINGS: ToolAgentSettings = {
  agent: {
    type: "wand",
    configs: {
      // WandAgent gets all tools by default
      wand: {
        tools: [...ALL_TOOLS],
      },
      // MiniAgent gets all tools by default (direct action agent)
      mini: {
        tools: [...ALL_TOOLS],
      },
      // WandWithThinkingAgent - autonomous agent with extended thinking
      "wand-thinking": {
        tools: [...ALL_TOOLS],
        llm: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
    },
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
