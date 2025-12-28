import { App } from "obsidian";
import { ToolAgentSettings } from "../types/settings";
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
import { AgentDependencies } from "../agents/Agent";
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

  constructor(app: App, settings: ToolAgentSettings) {
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

    // Create agent dependencies
    const agentDeps: AgentDependencies = {
      app,
      settings,
      llmProvider: this.llmProvider,
      executor: this.executor,
      toolsLayer: this.toolsLayer,
      approvalService: this.approvalService,
    };

    // Create agent from registry
    const agent = this.agentRegistry.create(settings.agent.type, agentDeps);

    // Create ChatController with agent
    this.chatController = new ChatController(
      app,
      agent,
      this.executor,
      this.approvalService
    );
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
