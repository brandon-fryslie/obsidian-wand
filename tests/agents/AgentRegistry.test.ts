import { AgentRegistry } from "../../src/agents/AgentRegistry";
import { WandAgentFactory } from "../../src/agents/WandAgentFactory";
import { AgentDependencies } from "../../src/agents/Agent";
import { DEFAULT_SETTINGS, ALL_TOOLS } from "../../src/types/settings";
import { LLMProvider } from "../../src/services/LLMProvider";
import { Executor } from "../../src/services/Executor";
import { ToolsLayer } from "../../src/services/ToolsLayer";
import { ApprovalService } from "../../src/services/ApprovalService";
import { App } from "obsidian";

describe("AgentRegistry", () => {
  let registry: AgentRegistry;
  let mockApp: App;
  let deps: AgentDependencies;

  beforeEach(() => {
    registry = new AgentRegistry();
    mockApp = createMockApp();

    const llmProvider = new LLMProvider(DEFAULT_SETTINGS);
    const toolsLayer = new ToolsLayer(mockApp);
    const executor = new Executor(toolsLayer);
    const approvalService = new ApprovalService(DEFAULT_SETTINGS);

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
  });

  describe("registration", () => {
    it("should register an agent factory", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);

      expect(registry.has("wand")).toBe(true);
    });

    it("should handle registration of multiple factories", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);
      registry.register("custom", factory);

      expect(registry.has("wand")).toBe(true);
      expect(registry.has("custom")).toBe(true);
    });

    it("should warn when overwriting existing factory", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      const factory = new WandAgentFactory();

      registry.register("wand", factory);
      registry.register("wand", factory);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Overwriting existing agent type: wand")
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("creation", () => {
    it("should create agent from registered factory", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);

      const agent = registry.create("wand", deps);

      expect(agent).toBeDefined();
      expect(agent.getName()).toBe("Wand Agent");
    });

    it("should throw error for unknown agent type", () => {
      expect(() => {
        registry.create("unknown", deps);
      }).toThrow("Unknown agent type");
    });

    it("should include available types in error message", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);

      expect(() => {
        registry.create("unknown", deps);
      }).toThrow(/Available types.*wand/);
    });

    it("should handle empty registry gracefully", () => {
      expect(() => {
        registry.create("unknown", deps);
      }).toThrow(/Available types.*none/);
    });
  });

  describe("listing", () => {
    it("should list all registered agents", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);

      const agents = registry.list();

      expect(agents).toHaveLength(1);
      expect(agents[0].type).toBe("wand");
      expect(agents[0].name).toBe("Wand Agent");
      expect(agents[0].description).toContain("Plan-based");
    });

    it("should return empty array when no agents registered", () => {
      const agents = registry.list();
      expect(agents).toHaveLength(0);
    });

    it("should list multiple registered agents", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);

      const agents = registry.list();

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.map(a => a.type)).toContain("wand");
    });
  });

  describe("has", () => {
    it("should return true for registered agent", () => {
      const factory = new WandAgentFactory();
      registry.register("wand", factory);

      expect(registry.has("wand")).toBe(true);
    });

    it("should return false for unregistered agent", () => {
      expect(registry.has("unknown")).toBe(false);
    });

    it("should return true after registration", () => {
      const factory = new WandAgentFactory();

      expect(registry.has("wand")).toBe(false);
      registry.register("wand", factory);
      expect(registry.has("wand")).toBe(true);
    });
  });
});
