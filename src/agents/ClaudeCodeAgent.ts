/**
 * ClaudeCodeAgent - SDK-based autonomous agent
 *
 * Uses the official @anthropic-ai/claude-agent-sdk to run the full agent loop.
 * This is a minimal implementation to validate P0-3: SDK query works without subprocess.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { Agent, AgentContext, AgentDependencies, AgentResponse, AgentState } from "./Agent";
import { createObsidianMCPServer, OBSIDIAN_TOOL_NAMES } from "./ObsidianMCPServer";

export class ClaudeCodeAgent implements Agent {
  private deps: AgentDependencies;
  private state: AgentState;
  private stateChangeCallbacks: ((state: AgentState) => void)[] = [];
  private abortController: AbortController | null = null;

  constructor(deps: AgentDependencies) {
    this.deps = deps;
    this.state = {
      status: "idle",
    };
  }

  async initialize(): Promise<void> {
    console.log("[ClaudeCode] Initialized with SDK query");
  }

  getName(): string {
    return "Claude Code Agent";
  }

  getDescription(): string {
    return "Full autonomous agent powered by official SDK";
  }

  getState(): AgentState {
    return { ...this.state };
  }

  onStateChange(callback: (state: AgentState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  getConfiguredTools(): string[] {
    return [...OBSIDIAN_TOOL_NAMES];
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.updateState({ status: "idle" });
  }

  cleanup(): void {
    this.stateChangeCallbacks = [];
    this.abort();
  }

  async handleUserMessage(message: string, _context: AgentContext): Promise<AgentResponse> {
    this.updateState({ status: "thinking" });
    this.abortController = new AbortController();

    try {
      // Get API configuration
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Please set it in plugin settings.");
      }

      const model = this.getModel();

      // Create MCP server with all Obsidian tools
      console.log("[ClaudeCode] Creating MCP server...");
      const mcpServer = createObsidianMCPServer(this.deps.app, this.deps.toolsLayer);
      console.log("[ClaudeCode] MCP server created:", mcpServer.name);

      // Call SDK query - THIS IS THE CRITICAL TEST (P0-3)
      console.log("[ClaudeCode] Calling SDK query()...");
      const queryGenerator = query({
        prompt: message,
        options: {
          model,
          // Pass API key via environment variable
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: apiKey,
          },
          mcpServers: {
            obsidian: mcpServer,
          },
          maxTurns: 10,
          abortController: this.abortController,
          // Disable built-in tools - we only want our MCP tools
          tools: [],
          // Auto-approve tools for now (P1-3 will add permission integration)
          canUseTool: async (_toolName, input) => ({
            behavior: "allow" as const,
            updatedInput: input,
          }),
        },
      });

      // Consume the query generator to get results
      let finalMessage = "";
      for await (const event of queryGenerator) {
        // Log events for debugging
        console.log("[ClaudeCode] Event:", event.type);

        // Extract final message from assistant messages
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text") {
              finalMessage = block.text;
            }
          }
        }
      }

      console.log("[ClaudeCode] Query completed successfully");
      console.log("[ClaudeCode] Final message:", finalMessage);

      this.updateState({ status: "idle" });

      return {
        type: "message",
        message: finalMessage || "Task completed.",
      };
    } catch (error) {
      const errorMsg = this.formatError(error);
      this.updateState({
        status: "error",
        lastError: errorMsg,
      });

      return {
        type: "error",
        error: errorMsg,
      };
    }
  }

  private updateState(updates: Partial<AgentState>): void {
    this.state = { ...this.state, ...updates };
    this.stateChangeCallbacks.forEach(cb => cb(this.state));
  }

  private getApiKey(): string {
    const settings = this.deps.settings;
    return settings.llm.anthropicApiKey || settings.llm.apiKey || "";
  }

  private getModel(): string {
    const settings = this.deps.settings;

    // Map to Anthropic model IDs
    const model = settings.llm.model?.toLowerCase() || "";
    if (model.includes("opus")) return "claude-opus-4-20250514";
    if (model.includes("haiku")) return "claude-3-haiku-20240307";
    return "claude-sonnet-4-20250514";
  }

  private formatError(error: unknown): string {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes("API key") || errorMsg.includes("401")) {
      return "**Auth Error** - Invalid or missing API key. Check your settings.";
    }

    if (errorMsg.includes("rate") || errorMsg.includes("429")) {
      return "**Rate Limited** - Too many requests. Please wait a moment.";
    }

    if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
      return "**Network Error** - Couldn't reach the API. Check your connection.";
    }

    if (errorMsg.includes("abort")) {
      return "**Cancelled** - Operation was aborted.";
    }

    return `**Error** - ${errorMsg}`;
  }
}
