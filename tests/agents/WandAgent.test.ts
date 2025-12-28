import { WandAgent } from "../../src/agents/WandAgent";
import { AgentDependencies, AgentContext } from "../../src/agents/Agent";
import { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/types/settings";
import { LLMProvider } from "../../src/services/LLMProvider";
import { Executor } from "../../src/services/Executor";
import { ToolsLayer } from "../../src/services/ToolsLayer";
import { ApprovalService } from "../../src/services/ApprovalService";

describe("WandAgent", () => {
  let agent: WandAgent;
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
      llmProvider,
      executor,
      toolsLayer,
      approvalService,
    };

    agent = new WandAgent(deps);
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it("should return correct name", () => {
      expect(agent.getName()).toBe("Wand Agent");
    });

    it("should return correct description", () => {
      expect(agent.getDescription()).toContain("Plan-based automation");
    });

    it("should start in idle state", () => {
      const state = agent.getState();
      expect(state.status).toBe("idle");
      expect(state.currentPlan).toBeUndefined();
      expect(state.lastError).toBeUndefined();
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

      // Mock LLM to return error to trigger state changes
      jest.spyOn(llmProvider, "generatePlan").mockRejectedValue(new Error("Test error"));

      await agent.handleUserMessage("test", context);

      // Should have state changes: thinking -> error
      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges.some(s => s.status === "thinking")).toBe(true);
      expect(stateChanges.some(s => s.status === "error")).toBe(true);
    });

    it("should transition to thinking state during message handling", async () => {
      const stateChanges: any[] = [];
      agent.onStateChange((state) => {
        stateChanges.push(state);
      });

      const context: AgentContext = {
        vaultPath: "/test",
      };

      jest.spyOn(llmProvider, "generatePlan").mockRejectedValue(new Error("Test error"));

      await agent.handleUserMessage("test", context);

      const thinkingState = stateChanges.find(s => s.status === "thinking");
      expect(thinkingState).toBeDefined();
    });
  });

  describe("message handling", () => {
    it("should return error response on LLM failure", async () => {
      const context: AgentContext = {
        vaultPath: "/test",
      };

      jest.spyOn(llmProvider, "generatePlan").mockRejectedValue(new Error("Network error"));

      const response = await agent.handleUserMessage("test message", context);

      expect(response.type).toBe("error");
      expect(response.error).toBeDefined();
      expect(response.error).toContain("Network");
    });

    it("should return plan response on success", async () => {
      const context: AgentContext = {
        vaultPath: "/test",
      };

      const mockPlan = {
        version: "1.0",
        goal: "Test goal",
        assumptions: [],
        riskLevel: "read-only" as const,
        steps: [
          {
            id: "step-1",
            tool: "vault.listFiles" as const,
            args: { path: "/" },
          },
        ],
      };

      jest.spyOn(llmProvider, "generatePlan").mockResolvedValue(mockPlan);
      jest.spyOn(toolsLayer, "listCommands").mockResolvedValue([]);

      const response = await agent.handleUserMessage("list files", context);

      expect(response.type).toBe("plan");
      expect(response.plan).toBeDefined();
      expect(response.plan?.goal).toBe("Test goal");
    });
  });

  describe("abort", () => {
    it("should call LLM provider abort", () => {
      const abortSpy = jest.spyOn(llmProvider, "abort");
      agent.abort();
      expect(abortSpy).toHaveBeenCalled();
    });

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
      agent.abort(); // This would normally trigger callbacks

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
