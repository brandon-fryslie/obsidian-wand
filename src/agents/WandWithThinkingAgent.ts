// Using native fetch instead of Obsidian's request() to avoid CORS issues
import { Agent, AgentContext, AgentDependencies, AgentResponse, AgentState } from "./Agent";
import { OBSIDIAN_TOOL_NAMES, OBSIDIAN_TOOL_SCHEMAS } from "./ObsidianMCPServer";
import { ActionPlan, Step, ToolName } from "../types/ActionPlan";

/**
 * WandWithThinkingAgent - Autonomous agent with extended thinking
 *
 * Uses direct Anthropic API calls with tool use, implementing an autonomous
 * agent loop. Supports extended thinking for complex reasoning tasks.
 *
 * Key features:
 * - Autonomous multi-turn execution with tool calling
 * - All operations through Obsidian vault tools
 * - Iterative problem solving (up to maxTurns)
 * - Real-time step tracking
 * - Extended thinking support for complex tasks
 */
export class WandWithThinkingAgent implements Agent {
  private deps: AgentDependencies;
  private state: AgentState;
  private stateChangeCallbacks: ((state: AgentState) => void)[] = [];
  private abortController: AbortController | null = null;
  private executedSteps: Step[] = [];

  private readonly MAX_TURNS = 20;

  constructor(deps: AgentDependencies) {
    this.deps = deps;
    this.state = {
      status: "idle",
    };
  }

  async initialize(): Promise<void> {
    console.log("[WandWithThinking] Initialized with direct API mode");
  }

  getName(): string {
    return "Wand with Thinking";
  }

  getDescription(): string {
    return "Autonomous agent with extended thinking - iterates until task complete";
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

  async handleUserMessage(message: string, context: AgentContext): Promise<AgentResponse> {
    this.updateState({ status: "thinking" });
    this.executedSteps = [];
    this.abortController = new AbortController();

    try {
      // Get API configuration
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Please set it in plugin settings.");
      }

      const baseUrl = this.getBaseUrl();
      const model = this.getModel();

      // Build the system prompt
      const systemPrompt = this.buildSystemPrompt(context);

      // Build tool definitions for the API
      const tools = this.buildToolDefinitions();

      // Run the agent loop
      console.log(`[WandWithThinking] Starting agent loop...`);
      const result = await this.runAgentLoop({
        systemPrompt,
        userMessage: message,
        tools,
        apiKey,
        baseUrl,
        model,
        context,
      });

      console.log(`[WandWithThinking] Agent loop completed, result length: ${result?.length || 0}`);
      this.updateState({ status: "idle" });
      console.log(`[WandWithThinking] State updated to idle`);

      // Return results
      if (this.executedSteps.length > 0) {
        const plan: ActionPlan = {
          goal: message,
          assumptions: ["Executed via autonomous agent loop"],
          riskLevel: this.executedSteps.some(s =>
            s.tool.includes("delete") || s.tool.includes("write") || s.tool.includes("run")
          ) ? "writes" : "read-only",
          steps: this.executedSteps,
        };

        return {
          type: "plan",
          plan,
          message: result || "Task completed.",
        };
      }

      return {
        type: "message",
        message: result || "I processed your request.",
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

  private async runAgentLoop(params: {
    systemPrompt: string;
    userMessage: string;
    tools: any[];
    apiKey: string;
    baseUrl: string;
    model: string;
    context: AgentContext;
  }): Promise<string> {
    const { systemPrompt, userMessage, tools, apiKey, baseUrl, model, context } = params;

    // Message history for the conversation
    const messages: any[] = [
      { role: "user", content: userMessage }
    ];

    let finalResponse = "";
    let turn = 0;

    while (turn < this.MAX_TURNS) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      turn++;
      console.log(`[WandWithThinking] Turn ${turn}/${this.MAX_TURNS}`);

      // Make API call
      const response = await this.callAnthropicAPI({
        systemPrompt,
        messages,
        tools,
        apiKey,
        baseUrl,
        model,
      });

      // Add assistant response to history
      console.log(`[WandWithThinking] Processing response...`);

      if (!response.content || !Array.isArray(response.content)) {
        console.error(`[WandWithThinking] Invalid response structure:`, JSON.stringify(response).substring(0, 500));
        throw new Error("Invalid API response: missing content array");
      }

      messages.push({ role: "assistant", content: response.content });

      // Check if we're done (no tool use)
      const toolUseBlocks = response.content.filter((b: any) => b.type === "tool_use");
      console.log(`[WandWithThinking] Tool use blocks found: ${toolUseBlocks.length}`);

      if (toolUseBlocks.length === 0) {
        // Extract final text response
        const textBlocks = response.content.filter((b: any) => b.type === "text");
        console.log(`[WandWithThinking] Text blocks found: ${textBlocks.length}`);

        // Handle extended thinking - some providers return thinking blocks
        const thinkingBlocks = response.content.filter((b: any) => b.type === "thinking");
        if (thinkingBlocks.length > 0) {
          console.log(`[WandWithThinking] Thinking blocks found: ${thinkingBlocks.length}`);
        }

        finalResponse = textBlocks.map((b: any) => b.text).join("\n");
        console.log(`[WandWithThinking] Final response length: ${finalResponse.length} chars`);
        break;
      }

      // Execute tools and collect results
      this.updateState({ status: "executing" });
      const toolResults: any[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[WandWithThinking] Executing tool: ${toolUse.name}`, toolUse.input);

        // Track the step
        this.executedSteps.push({
          id: `step-${this.executedSteps.length + 1}`,
          tool: this.convertToolName(toolUse.name) as ToolName,
          args: toolUse.input,
          preview: `Executing ${toolUse.name}`,
        });

        // Execute via ToolsLayer
        try {
          const result = await this.executeTool(toolUse.name, toolUse.input, context);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result, null, 2),
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true,
          });
        }
      }

      // Add tool results to history
      messages.push({ role: "user", content: toolResults });

      this.updateState({ status: "thinking" });
    }

    if (turn >= this.MAX_TURNS) {
      finalResponse += "\n\n(Reached maximum turns limit)";
    }

    console.log(`[WandWithThinking] Returning from agent loop, finalResponse length: ${finalResponse.length}`);
    return finalResponse;
  }

  private async callAnthropicAPI(params: {
    systemPrompt: string;
    messages: any[];
    tools: any[];
    apiKey: string;
    baseUrl: string;
    model: string;
  }): Promise<any> {
    const { systemPrompt, messages, tools, apiKey, baseUrl, model } = params;

    const url = `${baseUrl}/v1/messages`;
    console.log(`[WandWithThinking] Making API request to: ${url}`);
    console.log(`[WandWithThinking] Using model: ${model}`);

    // Determine correct headers based on endpoint
    // MiniMax uses Authorization Bearer and doesn't support anthropic-version header (CORS)
    // Anthropic uses x-api-key and requires anthropic-version
    const isMiniMax = baseUrl.includes("minimax");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isMiniMax) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      // Note: MiniMax CORS doesn't allow anthropic-version header
    } else {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    }

    console.log(`[WandWithThinking] Using auth: ${isMiniMax ? "Authorization Bearer" : "x-api-key"}`);

    // Use native fetch - Obsidian's request() has CORS issues with some headers
    const requestBody = JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools,
    });

    console.log(`[WandWithThinking] Request body length: ${requestBody.length}`);

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: requestBody,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[WandWithThinking] fetch threw error:`, errorMessage);
      console.error(`[WandWithThinking] Error details:`, err);
      throw new Error(`Network request failed: ${errorMessage}`);
    }

    console.log(`[WandWithThinking] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WandWithThinking] API error response:`, errorText);
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    // Parse the response
    try {
      const data = await response.json();
      console.log(`[WandWithThinking] Response parsed successfully, content blocks:`, data.content?.length || 0);
      console.log(`[WandWithThinking] Response content types:`, data.content?.map((b: any) => b.type).join(", ") || "none");
      return data;
    } catch (err) {
      console.error(`[WandWithThinking] Failed to parse JSON response:`, err);
      throw new Error(`Invalid JSON response from API`);
    }
  }

  private async executeTool(toolName: string, input: any, context: AgentContext): Promise<any> {
    // Convert MCP tool name to ToolsLayer name
    const layerToolName = this.convertToolName(toolName);

    // Build execution context
    const execContext = {
      activeFile: context.activeFile || undefined,
      selection: context.selection || undefined,
      vaultPath: context.vaultPath,
      stepResults: new Map(),
      variables: {},
      availableCommands: [],
    };

    return await this.deps.toolsLayer.executeTool(layerToolName as ToolName, input, execContext);
  }

  private convertToolName(mcpName: string): string {
    // Convert from MCP format (vault_readFile) to ToolsLayer format (vault.readFile)
    return mcpName.replace("_", ".");
  }

  private buildToolDefinitions(): any[] {
    // Convert our tool schemas to Anthropic tool format
    return OBSIDIAN_TOOL_SCHEMAS.map(schema => ({
      name: schema.name,
      description: schema.description,
      input_schema: schema.inputSchema,
    }));
  }

  private buildSystemPrompt(context: AgentContext): string {
    return `You are an autonomous AI agent operating inside Obsidian, a knowledge management application.

## Your Capabilities

You can execute multiple actions iteratively to accomplish complex tasks. After each tool call, you'll receive results and can decide on next steps. Continue working until the task is complete.

## Environment

You are operating on an Obsidian vault:
- All file operations use vault_* tools
- Paths are relative to vault root (no absolute paths)
- Files are typically Markdown (.md) with YAML frontmatter
- The vault may have plugins: Dataview, Templater, Tasks, Excalidraw

## Current Context

- Active file: ${context.activeFile || "None"}
- Vault path: ${context.vaultPath}
${context.selection ? `- Selected text: "${context.selection.substring(0, 200)}${context.selection.length > 200 ? "..." : ""}"` : ""}

## Available Tools

**Vault Operations:**
- vault_readFile: Read file contents
- vault_writeFile: Write/update file
- vault_createFile: Create new file
- vault_listFiles: List files in folder
- vault_searchText: Search across vault
- vault_ensureFolder: Create folder
- vault_rename: Rename file/folder
- vault_delete: Delete file/folder

**Editor Operations:**
- editor_getSelection: Get selected text
- editor_replaceSelection: Replace selection
- editor_insertAtCursor: Insert at cursor
- editor_getActiveFilePath: Get active file path

**Workspace Operations:**
- workspace_openFile: Open file in editor
- workspace_getContext: Get current context

**Command Operations:**
- commands_list: List available commands
- commands_run: Run Obsidian command

**Plugin Integrations:**
- dataview_query, dataview_pages, dataview_tasks, dataview_status
- templater_run, templater_insert, templater_create, templater_status
- tasks_create, tasks_toggle, tasks_status
- advancedtables_format, advancedtables_insertRow, advancedtables_status
- excalidraw_create, excalidraw_exportSVG, excalidraw_status

## Guidelines

1. Explore first: Use vault_listFiles and vault_searchText to understand the vault
2. Check plugin status before using plugin-specific tools
3. Be thorough: Read relevant files before making changes
4. Iterate: If one approach doesn't work, try alternatives
5. Report clearly: Summarize what you did and results`;
  }

  private updateState(updates: Partial<AgentState>): void {
    this.state = { ...this.state, ...updates };
    this.stateChangeCallbacks.forEach(cb => cb(this.state));
  }

  private getApiKey(): string {
    const settings = this.deps.settings;
    return settings.llm.anthropicApiKey || settings.llm.apiKey || "";
  }

  private getBaseUrl(): string {
    const settings = this.deps.settings;
    const customEndpoint = settings.llm.anthropicEndpoint?.trim();
    return customEndpoint || "https://api.anthropic.com";
  }

  private getModel(): string {
    const settings = this.deps.settings;
    const customEndpoint = settings.llm.anthropicEndpoint?.trim();

    // MiniMax uses different model names
    if (customEndpoint?.includes("minimax")) {
      return "MiniMax-M2.1";
    }

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
