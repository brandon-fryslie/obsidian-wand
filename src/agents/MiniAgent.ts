import { Agent, AgentContext, AgentDependencies, AgentResponse, AgentState } from "./Agent";
import { ActionPlan, ExecutionContext, Step } from "../types/ActionPlan";

/**
 * MiniAgent - A direct, action-oriented automation agent.
 *
 * Inspired by mini-swe-agent, this agent:
 * - Takes direct action with minimal planning overhead
 * - Executes one tool per request in a conversational loop
 * - Uses simple regex parsing to extract tool calls
 * - Returns single-step plans for quick execution
 *
 * Best for:
 * - Simple, direct tasks ("read this file", "create a note")
 * - Quick iterations and exploration
 * - Users who prefer conversational interaction
 *
 * Philosophy:
 * - Act quickly, iterate often
 * - Single responsibility per request
 * - Clear, direct tool execution
 */
export class MiniAgent implements Agent {
  private deps: AgentDependencies;
  private state: AgentState;
  private stateChangeCallbacks: ((state: AgentState) => void)[] = [];

  // Regex to extract tool calls from LLM response
  // Expects: ```tool\nvault.readFile({ path: "test.md" })\n```
  // Or: ```tool\n{ "tool": "vault.readFile", "args": { "path": "test.md" } }\n```
  private actionRegex = /```tool\s*\n([\s\S]*?)\n```/;

  constructor(deps: AgentDependencies) {
    this.deps = deps;
    this.state = {
      status: "idle",
    };
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  getName(): string {
    return "Mini Agent";
  }

  getDescription(): string {
    return "Direct action agent - quick single-step execution with minimal planning";
  }

  getState(): AgentState {
    return { ...this.state };
  }

  onStateChange(callback: (state: AgentState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  getConfiguredTools(): string[] {
    return this.deps.agentConfig.tools;
  }

  abort(): void {
    this.deps.llmProvider.abort();
    this.updateState({ status: "idle" });
  }

  cleanup(): void {
    this.stateChangeCallbacks = [];
  }

  async handleUserMessage(message: string, context: AgentContext): Promise<AgentResponse> {
    this.updateState({ status: "thinking" });

    try {
      const executionContext = await this.buildExecutionContext(context);
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(message, executionContext);

      console.log("[Mini] LLM Request:", {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
      });

      const response = await this.generateRawResponse(systemPrompt, userPrompt);

      console.log("[Mini] LLM Response:", response.substring(0, 500));

      // Parse the action from the response
      const action = this.parseAction(response);

      if (!action) {
        // No action found - treat as a message response
        this.updateState({ status: "idle" });
        return {
          type: "message",
          message: response,
        };
      }

      // Create a single-step plan from the action
      const plan = this.createPlanFromAction(message, action, response);

      this.updateState({
        status: "idle",
        currentPlan: plan,
      });

      return {
        type: "plan",
        plan,
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

  private async buildExecutionContext(context: AgentContext): Promise<ExecutionContext> {
    return {
      activeFile: context.activeFile,
      selection: context.selection,
      vaultPath: context.vaultPath,
      variables: {},
      stepResults: new Map(),
      availableCommands: [],
    };
  }

  /**
   * Generate a raw text response from the LLM (not JSON).
   * MiniAgent needs raw text to parse actions from markdown code blocks.
   */
  private async generateRawResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    const settings = this.deps.settings;
    const provider = settings.llm.provider;

    // Use AbortController for cancellation support
    const abortController = new AbortController();

    try {
      if (provider === "openai") {
        return await this.callOpenAI(systemPrompt, userPrompt, abortController.signal);
      } else if (provider === "anthropic") {
        return await this.callAnthropic(systemPrompt, userPrompt, abortController.signal);
      } else if (provider === "custom") {
        return await this.callCustom(systemPrompt, userPrompt, abortController.signal);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      throw error;
    }
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string> {
    const settings = this.deps.settings;
    const apiKey = settings.llm.openaiApiKey || settings.llm.apiKey;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: settings.llm.temperature,
        max_tokens: settings.llm.maxTokens,
        // No response_format - we want raw text
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
    }

    return data.choices?.[0]?.message?.content || "";
  }

  private async callAnthropic(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string> {
    const settings = this.deps.settings;
    const endpoint = settings.llm.anthropicEndpoint?.trim() || "https://api.anthropic.com/v1/messages";
    const apiKey = settings.llm.anthropicApiKey || settings.llm.apiKey;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.llm.model,
        max_tokens: settings.llm.maxTokens,
        temperature: settings.llm.temperature,
        messages: [
          { role: "user", content: `${systemPrompt}\n\n${userPrompt}` }
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Anthropic API error: ${data.error.message || data.error}`);
    }

    return data.content?.[0]?.text || "";
  }

  private async callCustom(systemPrompt: string, userPrompt: string, signal: AbortSignal): Promise<string> {
    const settings = this.deps.settings;
    if (!settings.llm.customEndpoint) {
      throw new Error("Custom endpoint not configured");
    }

    const apiKey = settings.llm.customApiKey || settings.llm.apiKey;

    const response = await fetch(settings.llm.customEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: settings.llm.temperature,
        max_tokens: settings.llm.maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.content || "";
  }

  /**
   * Parse the action from the LLM response.
   * Expects a tool code block with either:
   * - JSON: { "tool": "vault.readFile", "args": { "path": "test.md" } }
   * - Function-like: vault.readFile({ path: "test.md" })
   */
  private parseAction(response: string): { tool: string; args: Record<string, any> } | null {
    const match = response.match(this.actionRegex);

    if (!match || !match[1]) {
      return null;
    }

    const actionContent = match[1].trim();

    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(actionContent);
      if (parsed.tool && typeof parsed.tool === "string") {
        return {
          tool: parsed.tool,
          args: parsed.args || {},
        };
      }
    } catch {
      // Not JSON, try function-like syntax
    }

    // Try function-like syntax: vault.readFile({ path: "test.md" })
    const funcMatch = actionContent.match(/^([\w.]+)\s*\(\s*(\{[\s\S]*\})\s*\)$/);
    if (funcMatch) {
      try {
        const tool = funcMatch[1];
        const args = JSON.parse(funcMatch[2]);
        return { tool, args };
      } catch {
        // Invalid args JSON
      }
    }

    // Try simple function call: vault.readFile("test.md")
    const simpleMatch = actionContent.match(/^([\w.]+)\s*\(\s*"([^"]*)"\s*\)$/);
    if (simpleMatch) {
      const tool = simpleMatch[1];
      // Infer the argument name based on tool
      const argName = this.inferArgName(tool);
      return {
        tool,
        args: { [argName]: simpleMatch[2] },
      };
    }

    return null;
  }

  /**
   * Infer the primary argument name for a tool
   */
  private inferArgName(tool: string): string {
    if (tool.includes("File") || tool.includes("Folder")) {
      return "path";
    }
    if (tool.includes("search")) {
      return "query";
    }
    if (tool.includes("insert") || tool.includes("replace")) {
      return "text";
    }
    return "value";
  }

  /**
   * Create a single-step plan from the parsed action
   */
  private createPlanFromAction(
    userMessage: string,
    action: { tool: string; args: Record<string, any> },
    fullResponse: string
  ): ActionPlan {
    // Extract the reasoning/thought from before the action block
    const thoughtMatch = fullResponse.match(/^([\s\S]*?)```tool/);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

    const step: Step = {
      id: "action-1",
      tool: action.tool as any,
      args: action.args,
      preview: thought || `Execute ${action.tool}`,
    };

    // Determine risk level based on tool
    let riskLevel: "read-only" | "writes" | "commands" = "read-only";
    if (action.tool.includes("write") || action.tool.includes("create") || action.tool.includes("delete") || action.tool.includes("rename")) {
      riskLevel = "writes";
    }
    if (action.tool.includes("commands.run")) {
      riskLevel = "commands";
    }

    return {
      goal: userMessage,
      assumptions: [],
      riskLevel,
      steps: [step],
    };
  }

  /**
   * Build the system prompt for MiniAgent
   */
  private buildSystemPrompt(): string {
    const configuredTools = this.getConfiguredTools();

    return `You are Mini, a direct action assistant for Obsidian. You help users quickly accomplish tasks by executing single tool calls.

## How You Work

1. **Analyze** what the user wants
2. **Choose** the single best tool for the job
3. **Execute** it with proper arguments

## Your Response Format

First, briefly explain your reasoning (1-2 sentences).
Then output exactly ONE tool call in a code block:

\`\`\`tool
{ "tool": "tool.name", "args": { "arg": "value" } }
\`\`\`

Or function syntax:

\`\`\`tool
vault.readFile({ path: "example.md" })
\`\`\`

## Available Tools

${configuredTools.map(t => `- ${t}`).join("\n")}

## Tool Reference

**Reading:**
- vault.readFile({ path: "path/to/file.md" }) - Read file contents
- vault.listFiles({ folder: "folder/path" }) - List files in folder
- vault.searchText({ query: "search term" }) - Search vault

**Writing:**
- vault.createFile({ path: "path/to/new.md", content: "content" }) - Create new file
- vault.writeFile({ path: "path/to/file.md", content: "new content" }) - Overwrite file
- vault.ensureFolder({ path: "folder/path" }) - Create folder if missing

**Editor:**
- editor.insertAtCursor({ text: "text to insert" }) - Insert at cursor
- editor.replaceSelection({ text: "replacement" }) - Replace selection
- editor.getSelection() - Get selected text

**Workspace:**
- workspace.openFile({ path: "path/to/file.md" }) - Open file in editor
- workspace.getContext() - Get current context info

## Rules

1. ONE tool per response - no multi-step plans
2. Be direct - minimal explanation needed
3. If you can't help with a tool, just respond conversationally (no tool block)
4. For complex tasks, handle one step at a time - the user can continue the conversation

## Example

User: "What files are in my Daily Notes folder?"

Daily Notes are commonly stored in a dedicated folder. Let me list what's there.

\`\`\`tool
vault.listFiles({ folder: "Daily Notes" })
\`\`\``;
  }

  /**
   * Build the user prompt with context
   */
  private buildUserPrompt(message: string, context: ExecutionContext): string {
    let prompt = `Request: ${message}\n\n`;
    prompt += `Context:\n`;
    prompt += `- Active file: ${context.activeFile || "None"}\n`;

    if (context.selection) {
      const truncated = context.selection.length > 200
        ? context.selection.substring(0, 200) + "..."
        : context.selection;
      prompt += `- Selection: "${truncated}"\n`;
    }

    prompt += `- Vault: ${context.vaultPath}\n`;

    return prompt;
  }

  /**
   * Format errors into user-friendly messages
   */
  private formatError(error: unknown): string {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes("fetch") || errorMsg.includes("network")) {
      return "**Network Error** - Couldn't reach the LLM service. Check your connection.";
    }

    if (errorMsg.includes("401") || errorMsg.includes("API key")) {
      return "**Auth Error** - Invalid API key. Check your settings.";
    }

    if (errorMsg.includes("429")) {
      return "**Rate Limited** - Too many requests. Wait a moment.";
    }

    return `**Error** - ${errorMsg}`;
  }
}
