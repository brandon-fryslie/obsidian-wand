import { ClaudeCodeAgent } from "../../src/agents/ClaudeCodeAgent";
import { ClaudeCodeAgentFactory } from "../../src/agents/ClaudeCodeAgentFactory";
import { AgentDependencies } from "../../src/agents/Agent";
import { App } from "obsidian";
import { DEFAULT_SETTINGS, ALL_TOOLS } from "../../src/types/settings";
import { LLMProvider } from "../../src/services/LLMProvider";
import { Executor } from "../../src/services/Executor";
import { ToolsLayer } from "../../src/services/ToolsLayer";
import { ApprovalService } from "../../src/services/ApprovalService";
import { OBSIDIAN_TOOL_NAMES } from "../../src/agents/ObsidianMCPServer";

// Mock the Claude Agent SDK - it spawns subprocesses which won't work in Jest
jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn(),
  createSdkMcpServer: jest.fn().mockReturnValue({
    type: "sdk",
    name: "mock-server",
    instance: {},
  }),
  tool: jest.fn().mockImplementation((name, desc, schema, handler) => ({
    name,
    description: desc,
    inputSchema: schema,
    handler,
  })),
}));

describe("ClaudeCodeAgent", () => {
  let agent: ClaudeCodeAgent;
  let mockApp: App;
  let deps: AgentDependencies;
  let llmProvider: LLMProvider;
  let executor: Executor;
  let toolsLayer: ToolsLayer;
  let approvalService: ApprovalService;

  beforeEach(() => {
    mockApp = createMockApp();
    llmProvider = new LLMProvider(DEFAULT_SETTINGS);
    toolsLayer = new ToolsLayer(mockApp);
    executor = new Executor(toolsLayer);
    approvalService = new ApprovalService(DEFAULT_SETTINGS);

    deps = {
      app: mockApp,
      settings: {
        ...DEFAULT_SETTINGS,
        llm: {
          ...DEFAULT_SETTINGS.llm,
          provider: "anthropic",
          anthropicApiKey: "test-key",
        },
      },
      agentConfig: {
        tools: [...ALL_TOOLS],
        llm: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
      },
      llmProvider,
      executor,
      toolsLayer,
      approvalService,
    };

    agent = new ClaudeCodeAgent(deps);
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it("should return correct name", () => {
      expect(agent.getName()).toBe("Claude Code Agent");
    });

    it("should return correct description", () => {
      expect(agent.getDescription()).toContain("autonomous");
    });

    it("should start in idle state", () => {
      const state = agent.getState();
      expect(state.status).toBe("idle");
      expect(state.currentPlan).toBeUndefined();
      expect(state.lastError).toBeUndefined();
    });

    it("should include both builtin and Obsidian tools", () => {
      const tools = agent.getConfiguredTools();
      // Should have builtin tools
      expect(tools).toContain("Task");
      expect(tools).toContain("TodoWrite");
      expect(tools).toContain("WebFetch");
      // Should have Obsidian tools
      expect(tools).toContain("vault_readFile");
      expect(tools).toContain("vault_writeFile");
      expect(tools).toContain("editor_insertAtCursor");
    });

    it("should not include filesystem tools that are replaced by Obsidian", () => {
      const tools = agent.getConfiguredTools();
      // These should be disabled - replaced by Obsidian vault tools
      expect(tools).not.toContain("Read");
      expect(tools).not.toContain("Write");
      expect(tools).not.toContain("Edit");
      expect(tools).not.toContain("Glob");
      expect(tools).not.toContain("Grep");
      expect(tools).not.toContain("Bash");
    });
  });

  describe("state management", () => {
    it("should notify listeners of state changes", () => {
      const stateChanges: any[] = [];
      agent.onStateChange((state) => {
        stateChanges.push(state);
      });

      agent.abort();

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some((s) => s.status === "idle")).toBe(true);
    });
  });

  describe("abort", () => {
    it("should transition to idle state", () => {
      const stateChanges: any[] = [];
      agent.onStateChange((state) => {
        stateChanges.push(state);
      });

      agent.abort();

      const lastState = stateChanges[stateChanges.length - 1];
      expect(lastState.status).toBe("idle");
    });
  });

  describe("cleanup", () => {
    it("should clear state change callbacks", () => {
      const callback = jest.fn();
      agent.onStateChange(callback);

      agent.cleanup();
      agent.abort();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe("ClaudeCodeAgentFactory", () => {
  let factory: ClaudeCodeAgentFactory;

  beforeEach(() => {
    factory = new ClaudeCodeAgentFactory();
  });

  it("should return correct info", () => {
    const info = factory.getInfo();
    expect(info.type).toBe("claude-code");
    expect(info.name).toBe("Claude Code Agent");
    expect(info.description).toContain("autonomous");
  });

  it("should create ClaudeCodeAgent instance", () => {
    const mockApp = createMockApp();
    const deps: AgentDependencies = {
      app: mockApp,
      settings: DEFAULT_SETTINGS,
      agentConfig: {
        tools: [...ALL_TOOLS],
      },
      llmProvider: new LLMProvider(DEFAULT_SETTINGS),
      executor: new Executor(new ToolsLayer(mockApp)),
      toolsLayer: new ToolsLayer(mockApp),
      approvalService: new ApprovalService(DEFAULT_SETTINGS),
    };

    const agent = factory.create(deps);
    expect(agent).toBeInstanceOf(ClaudeCodeAgent);
    expect(agent.getName()).toBe("Claude Code Agent");
  });
});

describe("ObsidianMCPServer tool names", () => {
  it("should export all vault tools", () => {
    expect(OBSIDIAN_TOOL_NAMES).toContain("vault_readFile");
    expect(OBSIDIAN_TOOL_NAMES).toContain("vault_writeFile");
    expect(OBSIDIAN_TOOL_NAMES).toContain("vault_createFile");
    expect(OBSIDIAN_TOOL_NAMES).toContain("vault_delete");
    expect(OBSIDIAN_TOOL_NAMES).toContain("vault_listFiles");
    expect(OBSIDIAN_TOOL_NAMES).toContain("vault_searchText");
  });

  it("should export all editor tools", () => {
    expect(OBSIDIAN_TOOL_NAMES).toContain("editor_getSelection");
    expect(OBSIDIAN_TOOL_NAMES).toContain("editor_replaceSelection");
    expect(OBSIDIAN_TOOL_NAMES).toContain("editor_insertAtCursor");
  });

  it("should export all plugin integration tools", () => {
    expect(OBSIDIAN_TOOL_NAMES).toContain("dataview_query");
    expect(OBSIDIAN_TOOL_NAMES).toContain("templater_run");
    expect(OBSIDIAN_TOOL_NAMES).toContain("tasks_create");
    expect(OBSIDIAN_TOOL_NAMES).toContain("excalidraw_create");
  });
});
