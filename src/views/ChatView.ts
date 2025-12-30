import { ItemView, WorkspaceLeaf } from "obsidian";
import { App } from "obsidian";
import { ToolAgentSettings, AgentType } from "../types/settings";
import { PluginServices } from "../services/PluginServices";
import { ChatController } from "../services/ChatController";
import { Agent } from "../agents/Agent";
import ChatPanel from "../components/ChatPanel.svelte";

export const VIEW_TYPE_CHAT = "wand-chat";

/**
 * ChatView - A view that displays a chat interface with an agent.
 *
 * Each ChatView instance creates its own agent and chat controller,
 * allowing multiple independent chat tabs to run different agents.
 */
export class ChatView extends ItemView {
  private services: PluginServices;
  private chatPanel!: ChatPanel; // Initialized in onOpen
  private agent: Agent;
  private chatController: ChatController;
  private agentType: AgentType;

  constructor(
    leaf: WorkspaceLeaf,
    app: App,
    _settings: ToolAgentSettings, // Keep for API compatibility
    services: PluginServices,
    agentType?: AgentType // Optional: override default agent type for this view
  ) {
    super(leaf);
    this.app = app;
    this.services = services;
    this.agentType = agentType || services.settings.agent.type;

    // Create this view's own agent instance
    this.agent = services.createAgentForView(this.agentType);

    // Create this view's own chat controller
    this.chatController = new ChatController(
      app,
      this.agent,
      services.executor,
      services.approvalService
    );
  }

  getViewType() {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText() {
    // Include agent name in tab title
    return `Wand (${this.agent.getName()})`;
  }

  getIcon() {
    return "wand";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("wand-chat");

    // Initialize the chat controller
    await this.chatController.initialize();

    // Create Svelte component with this view's chat controller
    this.chatPanel = new ChatPanel({
      target: container,
      props: {
        app: this.app,
        services: {
          ...this.services,
          // Override chatController with this view's instance
          chatController: this.chatController,
        },
      },
    });
  }

  async onClose() {
    if (this.chatPanel) {
      this.chatPanel.$destroy();
    }
    if (this.chatController) {
      this.chatController.cleanup();
    }
    if (this.agent) {
      this.agent.cleanup();
    }
  }

  updateSettings(_settings: ToolAgentSettings) {
    // Settings are accessed via services.settings in the component
    // This method exists for API compatibility
  }

  /**
   * Get the agent type this view is using.
   */
  getAgentType(): AgentType {
    return this.agentType;
  }
}
