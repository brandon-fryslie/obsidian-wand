import { ItemView, WorkspaceLeaf } from "obsidian";
import { App } from "obsidian";
import { ToolAgentSettings } from "../types/settings";
import { PluginServices } from "../services/PluginServices";
import ChatPanel from "../components/ChatPanel.svelte";

export const VIEW_TYPE_CHAT = "wand-chat";

export class ChatView extends ItemView {
  private services: PluginServices;
  private chatPanel!: ChatPanel; // Initialized in onOpen

  constructor(
    leaf: WorkspaceLeaf,
    app: App,
    _settings: ToolAgentSettings, // Keep for API compatibility
    services: PluginServices
  ) {
    super(leaf);
    this.app = app;
    this.services = services;
  }

  getViewType() {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText() {
    return "Wand";
  }

  getIcon() {
    return "wand";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("wand-chat");

    // Create Svelte component
    this.chatPanel = new ChatPanel({
      target: container,
      props: {
        app: this.app,
        services: this.services,
      },
    });
  }

  async onClose() {
    if (this.chatPanel) {
      this.chatPanel.$destroy();
    }
  }

  updateSettings(_settings: ToolAgentSettings) {
    // Settings are accessed via services.settings in the component
    // This method exists for API compatibility
  }
}
