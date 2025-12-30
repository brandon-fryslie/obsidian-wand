import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { ChatView, VIEW_TYPE_CHAT } from "./views/ChatView";
import { ToolAgentSettings, DEFAULT_SETTINGS, READ_ONLY_TOOLS, SAFE_WRITE_TOOLS, DANGEROUS_TOOLS, ApprovalMode, AgentType, ALL_TOOLS } from "./types/settings";
import { PluginServices } from "./services/PluginServices";

export default class ToolAgentPlugin extends Plugin {
  settings!: ToolAgentSettings; // Initialized in onload
  services!: PluginServices; // Initialized in onload

  async onload() {
    console.log("Loading Wand plugin");

    // Load settings
    await this.loadSettings();

    // Initialize services
    this.services = new PluginServices(this.app, this.settings);

    // Register the chat view
    this.registerView(
      VIEW_TYPE_CHAT,
      (leaf) => new ChatView(leaf, this.app, this.settings, this.services)
    );

    // Add ribbon icon for chat (single entry point)
    this.addRibbonIcon("wand", "Open Wand", () => {
      this.activateView();
    });

    // Add command to open new chat tab
    this.addCommand({
      id: "open-wand",
      name: "Open Wand Chat",
      callback: () => {
        this.activateView();
      },
    });

    // Add command to open new chat tab (always creates a new tab)
    this.addCommand({
      id: "open-wand-new-tab",
      name: "Open Wand Chat (New Tab)",
      callback: () => {
        this.activateView(true);
      },
    });

    // Add settings tab
    this.addSettingTab(new ToolAgentSettingTab(this.app, this));

    // Initialize plugin data directory
    await this.services.initialize();
  }

  onunload() {
    console.log("Unloading Wand plugin");
    this.services?.cleanup();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.services?.updateSettings(this.settings);
  }

  /**
   * Activate or create a chat view.
   *
   * @param forceNew - If true, always create a new tab. If false, reuse existing tab if available.
   */
  async activateView(forceNew: boolean = false) {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (!forceNew && leaves.length > 0) {
      // Activate existing leaf
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_CHAT, active: true });
    }

    // Reveal the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

}

class ToolAgentSettingTab extends PluginSettingTab {
  plugin: ToolAgentPlugin;

  constructor(app: App, plugin: ToolAgentPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Agent Settings Section
    containerEl.createEl("h2", { text: "Agent Settings" });

    new Setting(containerEl)
      .setName("Agent Type")
      .setDesc("Choose which agent handles your requests")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("wand", "Wand Agent - Plan-based automation")
          .addOption("mini", "Mini Agent - Direct action execution")
          .setValue(this.plugin.settings.agent.type)
          .onChange(async (value) => {
            this.plugin.settings.agent.type = value as AgentType;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h2", { text: "LLM Provider Settings" });

    // Provider selection
    new Setting(containerEl)
      .setName("LLM Provider")
      .setDesc("Choose your LLM provider")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("openai", "OpenAI")
          .addOption("anthropic", "Anthropic")
          .addOption("custom", "Custom Endpoint")
          .setValue(this.plugin.settings.llm.provider)
          .onChange(async (value) => {
            this.plugin.settings.llm.provider = value as "openai" | "anthropic" | "custom";
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide relevant fields
          })
      );

    // Provider-specific settings
    if (this.plugin.settings.llm.provider === "openai") {
      new Setting(containerEl)
        .setName("OpenAI API Key")
        .setDesc("Your OpenAI API key")
        .addText((text) =>
          text
            .setPlaceholder("sk-...")
            .setValue(this.plugin.settings.llm.openaiApiKey || "")
            .onChange(async (value) => {
              this.plugin.settings.llm.openaiApiKey = value;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.llm.provider === "anthropic") {
      new Setting(containerEl)
        .setName("Anthropic API Key")
        .setDesc("Your Anthropic API key")
        .addText((text) =>
          text
            .setPlaceholder("sk-ant-...")
            .setValue(this.plugin.settings.llm.anthropicApiKey || "")
            .onChange(async (value) => {
              this.plugin.settings.llm.anthropicApiKey = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Anthropic API URL")
        .setDesc("Custom API endpoint (leave empty for default api.anthropic.com)")
        .addText((text) =>
          text
            .setPlaceholder("https://api.anthropic.com/v1/messages")
            .setValue(this.plugin.settings.llm.anthropicEndpoint || "")
            .onChange(async (value) => {
              this.plugin.settings.llm.anthropicEndpoint = value;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.llm.provider === "custom") {
      new Setting(containerEl)
        .setName("API Key")
        .setDesc("API key for your custom endpoint")
        .addText((text) =>
          text
            .setPlaceholder("Enter your API key")
            .setValue(this.plugin.settings.llm.customApiKey || "")
            .onChange(async (value) => {
              this.plugin.settings.llm.customApiKey = value;
              await this.plugin.saveSettings();
            })
        );
      new Setting(containerEl)
        .setName("Custom Endpoint URL")
        .setDesc("URL for your custom LLM endpoint")
        .addText((text) =>
          text
            .setPlaceholder("https://api.example.com/v1/chat/completions")
            .setValue(this.plugin.settings.llm.customEndpoint || "")
            .onChange(async (value) => {
              this.plugin.settings.llm.customEndpoint = value;
              await this.plugin.saveSettings();
            })
        );
    }

    // Model selection
    if (this.plugin.settings.llm.provider === "anthropic" || this.plugin.settings.llm.provider === "custom") {
      // Text input for custom model names
      new Setting(containerEl)
        .setName("Model")
        .setDesc("Model to use (e.g., claude-3-5-sonnet-20241022)")
        .addText((text) =>
          text
            .setPlaceholder("claude-3-5-sonnet-20241022")
            .setValue(this.plugin.settings.llm.model)
            .onChange(async (value) => {
              this.plugin.settings.llm.model = value;
              await this.plugin.saveSettings();
            })
        );
    } else {
      // Dropdown for OpenAI models
      new Setting(containerEl)
        .setName("Model")
        .setDesc("Choose which OpenAI model to use")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("gpt-4-turbo-preview", "GPT-4 Turbo (Recommended)")
            .addOption("gpt-4", "GPT-4")
            .addOption("gpt-3.5-turbo", "GPT-3.5 Turbo")
            .setValue(this.plugin.settings.llm.model)
            .onChange(async (value) => {
              this.plugin.settings.llm.model = value;
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Higher = more creative, lower = more focused (0.0 - 2.0)")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings.llm.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.llm.temperature = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max Tokens")
      .setDesc("Maximum length of generated responses")
      .addSlider((slider) =>
        slider
          .setLimits(1000, 16000, 1000)
          .setValue(this.plugin.settings.llm.maxTokens)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.llm.maxTokens = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Streaming")
      .setDesc("Stream responses as they're generated")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.llm.streaming)
          .onChange(async (value) => {
            this.plugin.settings.llm.streaming = value;
            await this.plugin.saveSettings();
          })
      );

    // Approval Settings
    containerEl.createEl("h2", { text: "Approval Settings" });

    new Setting(containerEl)
      .setName("Approval Mode")
      .setDesc("How to handle plan approval")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ask", "Smart (Ask for risky operations)")
          .addOption("yolo", "YOLO (Auto-approve everything)")
          .addOption("paranoid", "Paranoid (Ask for everything)")
          .setValue(this.plugin.settings.approval.mode)
          .onChange(async (value) => {
            this.plugin.settings.approval.mode = value as ApprovalMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Session Memory")
      .setDesc("Remember approvals during session (approve once = approved for session)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.approval.sessionMemory)
          .onChange(async (value) => {
            this.plugin.settings.approval.sessionMemory = value;
            await this.plugin.saveSettings();
          })
      );

    // Chat Settings
    containerEl.createEl("h2", { text: "Chat Settings" });

    new Setting(containerEl)
      .setName("Max History")
      .setDesc("Number of messages to keep in history")
      .addSlider((slider) =>
        slider
          .setLimits(10, 200, 10)
          .setValue(this.plugin.settings.chat.maxHistory)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.chat.maxHistory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Thinking")
      .setDesc("Display agent's reasoning process")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.chat.showThinking)
          .onChange(async (value) => {
            this.plugin.settings.chat.showThinking = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-Save Plans")
      .setDesc("Automatically save executed plans")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.chat.autoSavePlans)
          .onChange(async (value) => {
            this.plugin.settings.chat.autoSavePlans = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Persist History")
      .setDesc("Save chat history between sessions")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.chat.persistHistory)
          .onChange(async (value) => {
            this.plugin.settings.chat.persistHistory = value;
            await this.plugin.saveSettings();
          })
      );

    // UI Settings
    containerEl.createEl("h2", { text: "UI Settings" });

    new Setting(containerEl)
      .setName("Theme")
      .setDesc("Choose the chat interface theme")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("obsidian", "Match Obsidian")
          .addOption("light", "Light")
          .addOption("dark", "Dark")
          .setValue(this.plugin.settings.ui.theme)
          .onChange(async (value) => {
            this.plugin.settings.ui.theme = value as "light" | "dark" | "obsidian";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Font Size")
      .setDesc("Chat text size")
      .addSlider((slider) =>
        slider
          .setLimits(10, 24, 1)
          .setValue(this.plugin.settings.ui.fontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.ui.fontSize = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Ribbon Icon")
      .setDesc("Display Wand icon in the sidebar")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ui.showRibbonIcon)
          .onChange(async (value) => {
            this.plugin.settings.ui.showRibbonIcon = value;
            await this.plugin.saveSettings();
          })
      );

    // Per-Agent Configuration Section
    containerEl.createEl("h2", { text: "Per-Agent Configuration" });
    containerEl.createEl("p", {
      text: "Configure tools and LLM settings for each agent type.",
      cls: "setting-item-description",
    });

    this.displayAgentConfig(containerEl, "wand");
  }

  private displayAgentConfig(containerEl: HTMLElement, agentType: string) {
    const agentConfig = this.plugin.settings.agent.configs?.[agentType] || {
      tools: [...ALL_TOOLS],
    };

    // Ensure config exists
    if (!this.plugin.settings.agent.configs) {
      this.plugin.settings.agent.configs = {};
    }
    if (!this.plugin.settings.agent.configs[agentType]) {
      this.plugin.settings.agent.configs[agentType] = agentConfig;
    }

    // Agent-specific tools section
    const toolsContainer = containerEl.createDiv({ cls: "agent-config-section" });
    toolsContainer.createEl("h3", { text: `${agentType} - Tools` });
    toolsContainer.createEl("p", {
      text: "Select which tools this agent can use:",
      cls: "setting-item-description",
    });

    // Tool categories
    const categories = [
      { name: "Read-Only Tools", tools: READ_ONLY_TOOLS, desc: "Safe information gathering" },
      { name: "Safe Write Tools", tools: SAFE_WRITE_TOOLS, desc: "Create content without risk" },
      { name: "Dangerous Tools", tools: DANGEROUS_TOOLS, desc: "Modify or delete content" },
    ];

    categories.forEach(({ name, tools, desc }) => {
      const categoryHeader = toolsContainer.createEl("h4", { text: name });
      categoryHeader.createEl("span", {
        text: ` - ${desc}`,
        cls: "setting-item-description",
      });

      tools.forEach((tool) => {
        new Setting(toolsContainer)
          .setName(tool)
          .addToggle((toggle) =>
            toggle
              .setValue(agentConfig.tools.includes(tool))
              .onChange(async (value) => {
                const config = this.plugin.settings.agent.configs![agentType];
                if (value) {
                  if (!config.tools.includes(tool)) {
                    config.tools.push(tool);
                  }
                } else {
                  config.tools = config.tools.filter((t) => t !== tool);
                }
                await this.plugin.saveSettings();
              })
          );
      });
    });

    // Agent-specific LLM override section
    const llmContainer = containerEl.createDiv({ cls: "agent-config-section" });
    llmContainer.createEl("h3", { text: `${agentType} - LLM Override (Optional)` });
    llmContainer.createEl("p", {
      text: "Override global LLM settings for this agent. Leave empty to use global settings.",
      cls: "setting-item-description",
    });

    new Setting(llmContainer)
      .setName("Override Provider")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("", "Use Global")
          .addOption("openai", "OpenAI")
          .addOption("anthropic", "Anthropic")
          .addOption("custom", "Custom")
          .setValue(agentConfig.llm?.provider || "")
          .onChange(async (value) => {
            const config = this.plugin.settings.agent.configs![agentType];
            if (!config.llm) config.llm = {};
            config.llm.provider = value as any;
            await this.plugin.saveSettings();
          });
      });

    new Setting(llmContainer)
      .setName("Override Model")
      .addText((text) =>
        text
          .setPlaceholder("Leave empty to use global")
          .setValue(agentConfig.llm?.model || "")
          .onChange(async (value) => {
            const config = this.plugin.settings.agent.configs![agentType];
            if (!config.llm) config.llm = {};
            config.llm.model = value || undefined;
            await this.plugin.saveSettings();
          })
      );

    new Setting(llmContainer)
      .setName("Override Temperature")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(agentConfig.llm?.temperature ?? this.plugin.settings.llm.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            const config = this.plugin.settings.agent.configs![agentType];
            if (!config.llm) config.llm = {};
            config.llm.temperature = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
