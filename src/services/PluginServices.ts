import { App } from "obsidian";
import { ToolAgentSettings, AgentConfig } from "../types/settings";
import { ChatController } from "./ChatController";
import { Executor } from "./Executor";
import { ToolsLayer } from "./ToolsLayer";
import { MacroStore } from "./MacroStore";
import { LLMProvider } from "./LLMProvider";
import { ApprovalService } from "./ApprovalService";
import { PlanStore } from "./PlanStore";
import { PlanGenerator } from "./PlanGenerator";
import { ExecutionManager } from "./ExecutionManager";
import { TemplateStore } from "./TemplateStore";
import { Agent, AgentDependencies } from "../agents/Agent";
import { AgentRegistry } from "../agents/AgentRegistry";
import { WandAgentFactory } from "../agents/WandAgentFactory";

export class PluginServices {
  public readonly toolsLayer: ToolsLayer;
  public readonly executor: Executor;
  public readonly chatController: ChatController;
  public readonly macroStore: MacroStore;
  public readonly planStore: PlanStore;
  public readonly llmProvider: LLMProvider;
  public readonly approvalService: ApprovalService;
  public readonly planGenerator: PlanGenerator;
  public readonly executionManager: ExecutionManager;
  public readonly templateStore: TemplateStore;
  public readonly agentRegistry: AgentRegistry;
  public settings: ToolAgentSettings;
  private app: App;

  constructor(app: App, settings: ToolAgentSettings) {
    this.app = app;
    this.settings = settings;

    // Initialize in dependency order
    this.toolsLayer = new ToolsLayer(app);
    this.llmProvider = new LLMProvider(settings);
    this.approvalService = new ApprovalService(settings);
    this.executor = new Executor(this.toolsLayer);
    this.macroStore = new MacroStore(app);
    this.planStore = new PlanStore(app);
    this.templateStore = new TemplateStore(app);
    this.executionManager = new ExecutionManager(
      app,
      this.executor,
      this.planStore
    );
    this.planGenerator = new PlanGenerator(
      app,
      settings,
      this.llmProvider,
      this.planStore,
      this.toolsLayer
    );

    // Initialize agent registry
    this.agentRegistry = new AgentRegistry();
    this.agentRegistry.register("wand", new WandAgentFactory());

    // Create default agent from registry
    const agent = this.createAgent(settings.agent.type);

    // Create ChatController with agent (for backward compatibility)
    this.chatController = new ChatController(
      app,
      agent,
      this.executor,
      this.approvalService
    );
  }

  /**
   * Create an agent instance for a view.
   * Each view gets its own agent instance, allowing multiple independent tabs.
   *
   * @param agentType - The type of agent to create
   * @returns A new agent instance
   */
  createAgentForView(agentType: string): Agent {
    return this.createAgent(agentType);
  }

  /**
   * Create an agent instance with merged configuration.
   * Supports per-agent LLM overrides.
   */
  private createAgent(agentType: string): Agent {
    // Get agent-specific config (create default if missing)
    const agentConfig = this.getAgentConfig(agentType);

    // Create LLM provider with merged settings (per-agent override + global)
    const llmProvider = this.createLLMProvider(agentConfig);

    // Create agent dependencies
    const agentDeps: AgentDependencies = {
      app: this.app,
      settings: this.settings,
      agentConfig,
      llmProvider,
      executor: this.executor,
      toolsLayer: this.toolsLayer,
      approvalService: this.approvalService,
    };

    // Create agent from registry
    return this.agentRegistry.create(agentType, agentDeps);
  }

  /**
   * Get agent configuration, creating default if missing.
   */
  private getAgentConfig(agentType: string): AgentConfig {
    if (!this.settings.agent.configs) {
      this.settings.agent.configs = {};
    }

    if (!this.settings.agent.configs[agentType]) {
      // Create default config for this agent type
      this.settings.agent.configs[agentType] = {
        tools: [], // Will be populated by agent factory defaults
      };
    }

    return this.settings.agent.configs[agentType];
  }

  /**
   * Create LLM provider with merged settings (agent override + global).
   */
  private createLLMProvider(agentConfig: AgentConfig): LLMProvider {
    // If agent has LLM overrides, merge with global settings
    if (agentConfig.llm) {
      const mergedSettings = {
        ...this.settings,
        llm: {
          ...this.settings.llm,
          ...(agentConfig.llm.provider && { provider: agentConfig.llm.provider }),
          ...(agentConfig.llm.model && { model: agentConfig.llm.model }),
          ...(agentConfig.llm.temperature !== undefined && { temperature: agentConfig.llm.temperature }),
        },
      };
      return new LLMProvider(mergedSettings);
    }

    // No override, use shared global provider
    return this.llmProvider;
  }

  async initialize() {
    await this.macroStore.load();
    await this.planStore.load();
    await this.templateStore.load();
    await this.chatController.initialize();
  }

  updateSettings(settings: ToolAgentSettings) {
    this.settings = settings;
    this.llmProvider.updateSettings(settings);
    this.approvalService.updateSettings(settings);
    // Note: ChatController no longer needs updateSettings
    // Settings changes flow through the shared LLMProvider/ApprovalService
  }

  cleanup() {
    this.chatController.cleanup();
  }
}
