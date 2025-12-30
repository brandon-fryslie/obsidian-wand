import { MiniAgent } from "../../src/agents/MiniAgent";
import { AgentDependencies, AgentContext } from "../../src/agents/Agent";
import { App } from "obsidian";
import { DEFAULT_SETTINGS, ALL_TOOLS } from "../../src/types/settings";
import { LLMProvider } from "../../src/services/LLMProvider";
import { Executor } from "../../src/services/Executor";
import { ToolsLayer } from "../../src/services/ToolsLayer";
import { ApprovalService } from "../../src/services/ApprovalService";

describe("MiniAgent", () => {
  let agent: MiniAgent;
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
      settings: DEFAULT_SETTINGS,
      agentConfig: {
        tools: [...ALL_TOOLS],
      },
      llmProvider,
      executor,
      toolsLayer,
      approvalService,
    };

    agent = new MiniAgent(deps);
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it("should return correct name", () => {
      expect(agent.getName()).toBe("Mini Agent");
    });

    it("should return correct description", () => {
      expect(agent.getDescription()).toContain("Direct action");
    });

    it("should start in idle state", () => {
      const state = agent.getState();
      expect(state.status).toBe("idle");
      expect(state.currentPlan).toBeUndefined();
      expect(state.lastError).toBeUndefined();
    });

    it("should return configured tools", () => {
      const tools = agent.getConfiguredTools();
      expect(tools).toEqual(ALL_TOOLS);
    });
  });

  describe("action parsing", () => {
    it("should parse JSON-style tool action", () => {
      const response = `Let me list the files.

\`\`\`tool
{ "tool": "vault.listFiles", "args": { "folder": "/" } }
\`\`\``;

      // Access private method for testing
      const action = (agent as any).parseAction(response);
      expect(action).toEqual({
        tool: "vault.listFiles",
        args: { folder: "/" },
      });
    });

    it("should parse function-style tool action", () => {
      const response = `Let me read that file.

\`\`\`tool
vault.readFile({ "path": "test.md" })
\`\`\``;

      const action = (agent as any).parseAction(response);
      expect(action).toEqual({
        tool: "vault.readFile",
        args: { path: "test.md" },
      });
    });

    it("should parse simple function call", () => {
      const response = `Reading the file.

\`\`\`tool
vault.readFile("notes/daily.md")
\`\`\``;

      const action = (agent as any).parseAction(response);
      expect(action).toEqual({
        tool: "vault.readFile",
        args: { path: "notes/daily.md" },
      });
    });

    it("should return null for no action", () => {
      const response = "I don't know how to help with that.";
      const action = (agent as any).parseAction(response);
      expect(action).toBeNull();
    });

    it("should return null for invalid action format", () => {
      const response = `Here's some text

\`\`\`tool
not valid json or function
\`\`\``;

      const action = (agent as any).parseAction(response);
      expect(action).toBeNull();
    });
  });

  describe("state management", () => {
    it("should notify listeners of state changes", async () => {
      const stateChanges: any[] = [];
      agent.onStateChange((state) => {
        stateChanges.push(state);
      });

      const context: AgentContext = {
        vaultPath: "/test",
      };

      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      await agent.handleUserMessage("test", context);

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some((s) => s.status === "thinking")).toBe(true);
      expect(stateChanges.some((s) => s.status === "error")).toBe(true);
    });
  });

  describe("message handling", () => {
    it("should return error response on LLM failure", async () => {
      const context: AgentContext = {
        vaultPath: "/test",
      };

      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      const response = await agent.handleUserMessage("test message", context);

      expect(response.type).toBe("error");
      expect(response.error).toBeDefined();
      expect(response.error).toContain("Network");
    });

    it("should return message response when no action found", async () => {
      const context: AgentContext = {
        vaultPath: "/test",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: "I cannot help with that specific request.",
                },
              },
            ],
          }),
      });

      const response = await agent.handleUserMessage("hello", context);

      expect(response.type).toBe("message");
      expect(response.message).toContain("cannot help");
    });

    it("should return plan response when action found", async () => {
      const context: AgentContext = {
        vaultPath: "/test",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: `Let me list the files.

\`\`\`tool
{ "tool": "vault.listFiles", "args": { "folder": "/" } }
\`\`\``,
                },
              },
            ],
          }),
      });

      const response = await agent.handleUserMessage("list files", context);

      expect(response.type).toBe("plan");
      expect(response.plan).toBeDefined();
      expect(response.plan?.steps).toHaveLength(1);
      expect(response.plan?.steps[0].tool).toBe("vault.listFiles");
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
