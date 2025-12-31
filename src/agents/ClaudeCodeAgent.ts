/**
 * ClaudeCodeAgent - SDK-based autonomous agent
 *
 * Uses the official @anthropic-ai/claude-agent-sdk to run the full agent loop.
 * This is a minimal implementation to validate P0-3: SDK query works without subprocess.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as path from "path";
import * as fs from "fs";
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
        throw new Error("API key not configured. Please set it in plugin settings.");
      }
      console.log("[ClaudeCode] API key configured:", apiKey ? `${apiKey.slice(0, 12)}...` : "NONE");

      const settings = this.deps.settings;
      const customEndpoint = settings.llm.anthropicEndpoint || "";
      if (customEndpoint) {
        console.log("[ClaudeCode] Custom endpoint configured:", customEndpoint);
      }

      const model = this.getModel();
      console.log("[ClaudeCode] Using model:", model);

      // Create MCP server with all Obsidian tools
      console.log("[ClaudeCode] Creating MCP server...");
      const mcpServer = createObsidianMCPServer(this.deps.app, this.deps.toolsLayer);
      console.log("[ClaudeCode] MCP server created:", mcpServer.name);

      // Find the bundled Claude Code CLI using multiple strategies
      const cliPath = this.findCliPath();
      if (!cliPath) {
        throw new Error(
          "Could not find Claude Agent SDK cli.js. " +
          "Set CLAUDE_CLI_PATH env var or ensure SDK is installed."
        );
      }
      console.log("[ClaudeCode] Using CLI path:", cliPath);

      // Call SDK query with the bundled executable
      console.log("[ClaudeCode] Calling SDK query()...");
      const queryGenerator = query({
        prompt: message,
        options: {
          model,
          // Path to bundled CLI executable
          pathToClaudeCodeExecutable: cliPath,
          // Pass API key and optional custom endpoint via environment variables
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: apiKey,
            // Pass custom endpoint if configured (for MiniMax, etc.)
            ...(customEndpoint && { ANTHROPIC_BASE_URL: customEndpoint }),
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
        console.log("[ClaudeCode] Event:", event.type, JSON.stringify(event, null, 2).slice(0, 500));

        // Check for error events
        if (event.type === "result") {
          const result = event as any;
          if (result.error) {
            console.error("[ClaudeCode] Result error:", result.error);
          }
          if (result.exitCode !== undefined) {
            console.log("[ClaudeCode] Exit code:", result.exitCode);
          }
        }

        // Extract final message from assistant messages
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text") {
              finalMessage = block.text;
              console.log("[ClaudeCode] Found text:", block.text.slice(0, 200));
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
    // Try settings first, then fall back to environment variable
    const settingsKey = settings.llm.anthropicApiKey || settings.llm.apiKey || "";
    const envKey = process.env.ANTHROPIC_API_KEY || "";
    return settingsKey || envKey;
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

    if (errorMsg.includes("401") || errorMsg.includes("authentication")) {
      return `**Auth Error** - ${errorMsg}`;
    }

    if (errorMsg.includes("rate") || errorMsg.includes("429")) {
      return `**Rate Limited** - ${errorMsg}`;
    }

    if (errorMsg.includes("abort")) {
      return "**Cancelled** - Operation was aborted.";
    }

    return `**Error** - ${errorMsg}`;
  }

  /**
   * Find the Claude Agent SDK cli.js using multiple strategies:
   * 1. Environment variable CLAUDE_CLI_PATH
   * 2. Relative to plugin directory (for production)
   * 3. Dev mode: hardcoded path to node_modules
   * 4. Common global installation paths
   */
  private findCliPath(): string | null {
    const candidates: string[] = [];

    // Strategy 1: Environment variable (highest priority)
    if (process.env.CLAUDE_CLI_PATH) {
      candidates.push(process.env.CLAUDE_CLI_PATH);
    }

    // Strategy 2: Relative to vault's plugin directory (for shipped plugins)
    try {
      const vaultPath = (this.deps.app.vault.adapter as any).basePath;
      if (vaultPath) {
        // Check for cli.js shipped with plugin
        candidates.push(path.join(vaultPath, ".obsidian", "plugins", "wand", "cli.js"));
        candidates.push(path.join(vaultPath, ".obsidian", "plugins", "obsidian-toolagent", "cli.js"));
      }
    } catch (e) {
      console.log("[ClaudeCode] Could not get vault path:", e);
    }

    // Strategy 3: Dev mode - look in project's node_modules
    // This works when plugin is symlinked from dev directory
    const devPaths = [
      // Common dev paths
      "/Users/bmf/code/obsidian-toolagent/node_modules/@anthropic-ai/claude-agent-sdk/cli.js",
      // Relative to CWD (might work in some contexts)
      path.join(process.cwd(), "node_modules/@anthropic-ai/claude-agent-sdk/cli.js"),
    ];
    candidates.push(...devPaths);

    // Strategy 4: Global npm/pnpm paths
    const homedir = process.env.HOME || process.env.USERPROFILE || "";
    if (homedir) {
      candidates.push(
        path.join(homedir, ".npm-global/lib/node_modules/@anthropic-ai/claude-agent-sdk/cli.js"),
        path.join(homedir, ".pnpm-global/5/node_modules/@anthropic-ai/claude-agent-sdk/cli.js"),
        path.join(homedir, "node_modules/@anthropic-ai/claude-agent-sdk/cli.js")
      );
    }

    // Check each candidate and return first valid one
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          console.log("[ClaudeCode] Found CLI at:", candidate);
          return candidate;
        }
      } catch (e) {
        // Ignore errors, try next candidate
      }
    }

    console.log("[ClaudeCode] Tried candidates:", candidates);
    return null;
  }
}
