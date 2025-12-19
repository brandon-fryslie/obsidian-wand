import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { ChatView, VIEW_TYPE_CHAT } from "./views/ChatView";
import { ToolAgentSettings, DEFAULT_SETTINGS, READ_ONLY_TOOLS, SAFE_WRITE_TOOLS, DANGEROUS_TOOLS, ApprovalMode } from "./types/settings";
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

    // Add command palette entry
    this.addCommand({
      id: "open-wand",
      name: "Open Wand",
      callback: () => {
        this.activateView();
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

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (leaves.length > 0) {
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
        .setDesc("Enter the model name (e.g., claude-3-5-sonnet-20241022)")
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
      // Dropdown for OpenAI
      const modelOptions: Record<string, string> = {
        "gpt-4": "GPT-4",
        "gpt-4-turbo-preview": "GPT-4 Turbo",
        "gpt-3.5-turbo": "GPT-3.5 Turbo"
      };

      new Setting(containerEl)
        .setName("Model")
        .setDesc("Choose the model to use")
        .addDropdown((dropdown) => {
          Object.entries(modelOptions).forEach(([value, label]) => {
            dropdown.addOption(value, label);
          });
          return dropdown
            .setValue(this.plugin.settings.llm.model)
            .onChange(async (value) => {
              this.plugin.settings.llm.model = value;
              await this.plugin.saveSettings();
            });
        });
    }

    // Temperature
    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Controls randomness in responses (0.0 to 1.0)")
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.llm.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.llm.temperature = value;
            await this.plugin.saveSettings();
          })
      );

    // Streaming toggle
    new Setting(containerEl)
      .setName("Enable Streaming")
      .setDesc("Show responses as they are being generated")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.llm.streaming)
          .onChange(async (value) => {
            this.plugin.settings.llm.streaming = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h2", { text: "Approval Settings" });

    // Approval mode
    new Setting(containerEl)
      .setName("Approval mode")
      .setDesc("Controls when Wand asks for permission before executing actions")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ask", "Ask (smart defaults)")
          .addOption("yolo", "YOLO (approve everything)")
          .addOption("paranoid", "Paranoid (ask for everything)")
          .setValue(this.plugin.settings.approval.mode)
          .onChange(async (value) => {
            this.plugin.settings.approval.mode = value as ApprovalMode;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide relevant fields
          })
      );

    // Session memory
    new Setting(containerEl)
      .setName("Remember approvals for session")
      .setDesc("Once you approve a tool, it stays approved until you reload the plugin")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.approval.sessionMemory)
          .onChange(async (value) => {
            this.plugin.settings.approval.sessionMemory = value;
            await this.plugin.saveSettings();
          })
      );

    // Only show tool configuration in "ask" mode
    if (this.plugin.settings.approval.mode === "ask") {
      containerEl.createEl("h3", { text: "Tool Permissions" });
      containerEl.createEl("p", {
        text: "Configure which tools can run without asking. Read-only tools are safe and allowed by default.",
        cls: "setting-item-description"
      });

      // Preset buttons
      new Setting(containerEl)
        .setName("Quick presets")
        .setDesc("Quickly configure tool permissions")
        .addButton((button) =>
          button
            .setButtonText("Allow Read-Only")
            .onClick(async () => {
              this.plugin.settings.approval.allowedTools = [...READ_ONLY_TOOLS];
              await this.plugin.saveSettings();
              this.display();
            })
        )
        .addButton((button) =>
          button
            .setButtonText("Allow Safe Writes")
            .onClick(async () => {
              this.plugin.settings.approval.allowedTools = [...READ_ONLY_TOOLS, ...SAFE_WRITE_TOOLS];
              await this.plugin.saveSettings();
              this.display();
            })
        )
        .addButton((button) =>
          button
            .setButtonText("Allow All")
            .onClick(async () => {
              this.plugin.settings.approval.allowedTools = [...READ_ONLY_TOOLS, ...SAFE_WRITE_TOOLS, ...DANGEROUS_TOOLS];
              await this.plugin.saveSettings();
              this.display();
            })
        );

      // Group tools by category
      const allTools = [
        { category: "Read-Only (Safe)", tools: READ_ONLY_TOOLS, description: "These tools only read data and cannot modify your vault" },
        { category: "Safe Writes", tools: SAFE_WRITE_TOOLS, description: "These tools create or modify files in controlled ways" },
        { category: "Dangerous", tools: DANGEROUS_TOOLS, description: "These tools can delete files or run arbitrary commands" },
      ];

      for (const group of allTools) {
        containerEl.createEl("h4", { text: group.category });
        containerEl.createEl("p", {
          text: group.description,
          cls: "setting-item-description"
        });

        for (const tool of group.tools) {
          const isAllowed = this.plugin.settings.approval.allowedTools.includes(tool);
          const isDenied = this.plugin.settings.approval.deniedTools.includes(tool);

          new Setting(containerEl)
            .setName(tool)
            .setDesc(this.getToolDescription(tool))
            .addDropdown((dropdown) =>
              dropdown
                .addOption("ask", "Ask")
                .addOption("allow", "Always allow")
                .addOption("deny", "Always deny")
                .setValue(isDenied ? "deny" : isAllowed ? "allow" : "ask")
                .onChange(async (value) => {
                  // Remove from both lists first
                  this.plugin.settings.approval.allowedTools =
                    this.plugin.settings.approval.allowedTools.filter(t => t !== tool);
                  this.plugin.settings.approval.deniedTools =
                    this.plugin.settings.approval.deniedTools.filter(t => t !== tool);

                  // Add to appropriate list
                  if (value === "allow") {
                    this.plugin.settings.approval.allowedTools.push(tool);
                  } else if (value === "deny") {
                    this.plugin.settings.approval.deniedTools.push(tool);
                  }

                  await this.plugin.saveSettings();
                })
            );
        }
      }

      // Allowed paths
      containerEl.createEl("h3", { text: "Allowed Paths" });
      new Setting(containerEl)
        .setName("Auto-approve paths")
        .setDesc("Glob patterns for paths where writes are automatically approved (one per line)")
        .addTextArea((text) =>
          text
            .setPlaceholder("Daily Notes/*\nTemplates/*")
            .setValue(this.plugin.settings.approval.allowedPaths.join("\n"))
            .onChange(async (value) => {
              this.plugin.settings.approval.allowedPaths = value
                .split("\n")
                .map(p => p.trim())
                .filter(p => p.length > 0);
              await this.plugin.saveSettings();
            })
        );
    }

    containerEl.createEl("h2", { text: "Chat Settings" });

    // Max conversation history
    new Setting(containerEl)
      .setName("Max conversation history")
      .setDesc("Maximum number of messages to keep in memory (0 for unlimited)")
      .addText((text) =>
        text
          .setPlaceholder("50")
          .setValue(String(this.plugin.settings.chat.maxHistory))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.chat.maxHistory = num;
              await this.plugin.saveSettings();
            }
          })
      );

    // Persist conversation history
    new Setting(containerEl)
      .setName("Persist conversation history")
      .setDesc("Save conversation across Obsidian restarts")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.chat.persistHistory)
          .onChange(async (value) => {
            this.plugin.settings.chat.persistHistory = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private getToolDescription(tool: string): string {
    const descriptions: Record<string, string> = {
      // Read-only
      "vault.readFile": "Read file contents",
      "vault.searchText": "Search for text across files",
      "vault.listFiles": "List files in a folder",
      "editor.getSelection": "Get current text selection",
      "editor.getActiveFilePath": "Get path of active file",
      "workspace.getContext": "Get workspace context",
      "commands.list": "List available commands",
      "util.parseMarkdownBullets": "Parse markdown bullet lists",
      "util.slugifyTitle": "Convert title to filename",
      // Safe writes
      "vault.ensureFolder": "Create folder if it doesn't exist",
      "vault.createFile": "Create a new file",
      "workspace.openFile": "Open a file in the editor",
      "editor.insertAtCursor": "Insert text at cursor",
      // Dangerous
      "vault.delete": "Delete files or folders",
      "vault.rename": "Rename files or folders",
      "vault.writeFile": "Overwrite existing files",
      "editor.replaceSelection": "Replace selected text",
      "commands.run": "Execute Obsidian commands",
    };
    return descriptions[tool] || tool;
  }
}
