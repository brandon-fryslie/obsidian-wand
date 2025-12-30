import { Agent, AgentContext, AgentDependencies, AgentResponse, AgentState } from "./Agent";
import { ActionPlan, ExecutionContext } from "../types/ActionPlan";
import { PlanValidator } from "../services/PlanValidator";
import { ActionPlanSchema } from "../schemas/ActionPlanSchema";

/**
 * WandAgent - The original plan-based automation agent.
 *
 * This agent:
 * - Understands user requests in natural language
 * - Generates detailed action plans
 * - Resolves placeholders by executing read-only steps
 * - Provides thoughtful, context-aware automation
 *
 * Philosophy:
 * - Understand before acting (gather context first)
 * - Be proactively helpful (suggest improvements)
 * - Think step by step (break complex tasks into phases)
 * - Make intelligent suggestions (learn from vault patterns)
 */
export class WandAgent implements Agent {
  private deps: AgentDependencies;
  private planValidator: PlanValidator;
  private state: AgentState;
  private stateChangeCallbacks: ((state: AgentState) => void)[] = [];

  constructor(deps: AgentDependencies) {
    this.deps = deps;
    this.planValidator = new PlanValidator();
    this.state = {
      status: "idle",
    };
  }

  async initialize(): Promise<void> {
    // No initialization needed for WandAgent
  }

  getName(): string {
    return "Wand Agent";
  }

  getDescription(): string {
    return "Plan-based automation agent that breaks tasks into thoughtful, step-by-step plans";
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
      // Convert AgentContext to ExecutionContext
      const executionContext = await this.buildExecutionContext(context);

      // Generate plan with retry logic
      const { plan } = await this.generatePlanWithRetry(
        message,
        executionContext
      );

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

  /**
   * Build execution context from agent context
   */
  private async buildExecutionContext(context: AgentContext): Promise<ExecutionContext> {
    const availableCommands = await this.deps.toolsLayer.listCommands();

    return {
      activeFile: context.activeFile,
      selection: context.selection,
      vaultPath: context.vaultPath,
      variables: {},
      stepResults: new Map(),
      availableCommands,
    };
  }

  /**
   * Generate a plan with retry logic for validation failures
   */
  private async generatePlanWithRetry(
    userMessage: string,
    context: ExecutionContext,
    maxRetries: number = 2
  ): Promise<{ plan: ActionPlan; validationResult: any }> {
    let lastError: Error | null = null;
    let feedbackMessages: string[] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(userMessage, context, feedbackMessages);

        console.log("[Wand] LLM Request:", {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          systemPromptLength: systemPrompt.length,
          userPromptLength: userPrompt.length,
        });
        console.log("[Wand] User Prompt:\n", userPrompt);

        const response = await this.deps.llmProvider.generatePlan(systemPrompt, userPrompt);

        // Validate the response
        const validationResult = this.planValidator.validate(response);

        if (!validationResult.valid) {
          // Build feedback for retry
          const errorDetails = this.planValidator.formatValidationResult(validationResult);
          feedbackMessages.push(
            `Previous attempt failed validation:\n${errorDetails}\n\nPlease fix these issues and generate a valid plan.`
          );
          lastError = new Error(`Invalid plan (attempt ${attempt + 1}/${maxRetries + 1}):\n${errorDetails}`);

          if (attempt < maxRetries) {
            console.log(`Plan validation failed, retrying (${attempt + 1}/${maxRetries})...`);
            continue;
          }
        } else {
          // Plan is structurally valid, but check for placeholders
          let currentPlan = ActionPlanSchema.parse(response) as unknown as ActionPlan;
          let currentValidation = validationResult;

          // Attempt to resolve placeholders by executing read-only steps
          const maxPlaceholderAttempts = 2;
          let placeholderAttempt = 0;

          while (
            this.planValidator.hasPlaceholders(currentValidation) &&
            placeholderAttempt < maxPlaceholderAttempts
          ) {
            placeholderAttempt++;
            console.log(`[Wand] Resolving placeholders (attempt ${placeholderAttempt}/${maxPlaceholderAttempts})...`);

            // Execute read-only steps to gather data
            const readResults = await this.executeReadOnlySteps(currentPlan, context);

            if (Object.keys(readResults).length === 0) {
              console.warn("[Wand] No read-only steps to execute, cannot resolve placeholders");
              break;
            }

            // Build a new prompt with the gathered data
            const resolutionPrompt = this.buildResolutionPrompt(
              userMessage,
              context,
              currentPlan,
              readResults
            );

            console.log("[Wand] Resolution Prompt:\n", resolutionPrompt);

            // Call LLM again with the gathered data
            const resolvedResponse = await this.deps.llmProvider.generatePlan(
              this.buildSystemPrompt(),
              resolutionPrompt
            );

            // Validate the resolved plan
            currentValidation = this.planValidator.validate(resolvedResponse);

            if (!currentValidation.valid) {
              console.warn("[Wand] Resolved plan failed validation, keeping original");
              break;
            }

            currentPlan = ActionPlanSchema.parse(resolvedResponse) as unknown as ActionPlan;
          }

          if (this.planValidator.hasPlaceholders(currentValidation)) {
            console.warn("[Wand] Could not resolve all placeholders, proceeding with warnings");
          }

          return {
            plan: currentPlan,
            validationResult: currentValidation,
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error && error.message.includes("JSON")) {
          feedbackMessages.push(
            `Previous attempt generated invalid JSON. Please ensure you output ONLY valid JSON matching the ActionPlan schema.`
          );
        }

        if (attempt < maxRetries) {
          console.log(`Plan generation failed, retrying (${attempt + 1}/${maxRetries})...`, error);
          continue;
        }
      }
    }

    throw lastError || new Error("Failed to generate valid plan after retries");
  }

  /**
   * Execute read-only steps from a plan to gather data for placeholder resolution
   */
  private async executeReadOnlySteps(
    plan: ActionPlan,
    context: ExecutionContext
  ): Promise<Record<string, any>> {
    const readOnlyTools = [
      "vault.readFile",
      "vault.listFiles",
      "vault.searchText",
      "editor.getSelection",
      "editor.getActiveFilePath",
      "workspace.getContext",
      "commands.list",
    ];

    const results: Record<string, any> = {};

    for (const step of plan.steps) {
      if (readOnlyTools.includes(step.tool)) {
        try {
          console.log(`[Wand] Executing read-only step: ${step.id} (${step.tool})`);
          const result = await this.deps.toolsLayer.executeTool(step.tool as any, step.args, context);
          results[step.id] = {
            tool: step.tool,
            args: step.args,
            result,
          };
        } catch (error) {
          console.warn(`[Wand] Read-only step ${step.id} failed:`, error);
          results[step.id] = {
            tool: step.tool,
            args: step.args,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    return results;
  }

  /**
   * Build a prompt for the LLM to resolve placeholders with gathered data
   */
  private buildResolutionPrompt(
    userMessage: string,
    context: ExecutionContext,
    originalPlan: ActionPlan,
    readResults: Record<string, any>
  ): string {
    const resultsStr = Object.entries(readResults)
      .map(([stepId, data]) => {
        if (data.error) {
          return `## ${stepId} (${data.tool}) - ERROR\n${data.error}`;
        }
        return `## ${stepId} (${data.tool})\n\`\`\`json\n${JSON.stringify(data.result, null, 2)}\n\`\`\``;
      })
      .join("\n\n");

    return `User request: "${userMessage}"

Current context:
- Active file: ${context.activeFile || "None"}
- Vault path: ${context.vaultPath || "/"}

## Previously Generated Plan (has placeholders that need resolution)

Goal: ${originalPlan.goal}

The plan has steps with placeholder values that need to be filled in with actual content.

## Data Gathered from Read Operations

${resultsStr}

## Your Task

Using the ACTUAL DATA above, regenerate the action plan with COMPLETE, REAL content - no placeholders.

CRITICAL REQUIREMENTS:
1. For any vault.writeFile step, the "content" field MUST contain the COMPLETE file content
2. Do NOT use phrases like "Content will be preserved here" or "existing content" - include the ACTUAL content
3. If adding tags to a file, include the ENTIRE file content with the new tags added
4. The content must be ready to write directly to the file

Generate the complete action plan as JSON.`;
  }

  /**
   * Build the system prompt that defines Wand's behavior
   */
  private buildSystemPrompt(): string {
    const configuredTools = this.getConfiguredTools();
    const toolsSection = this.buildToolsSection(configuredTools);

    return `You are Wand, an intelligent Obsidian automation assistant. You help users manage their knowledge base with thoughtfulness, precision, and genuine helpfulness.

## Your Core Philosophy

1. **Understand Before Acting**: Always gather context first. If the user says "tag my recent documents", first list what files exist, check what tags are already in use, then propose intelligent tagging based on actual content.

2. **Be Proactively Helpful**: Don't just do the minimum. If a user asks to create a daily note, also consider: Does a template exist? Should it link to related notes? Would tags be helpful?

3. **Think Step by Step**: Break complex tasks into logical phases:
   - Phase 1: Gather information (read files, list folders, search for context)
   - Phase 2: Analyze and plan based on what you found
   - Phase 3: Execute the changes

4. **Make Intelligent Suggestions**: Use what you learn from the vault to make smart recommendations. If you see existing patterns (naming conventions, folder structure, tag taxonomy), follow them.

5. **Be Safe but Not Timid**: You can be thorough without being reckless. Reading files is always safe. Creating new files is usually safe. Modifying or deleting existing content deserves more care.

## Planning Strategy

**For tasks involving existing content** (tagging, organizing, updating):
- ALWAYS start with vault.listFiles or vault.searchText to understand what exists
- ALWAYS read relevant files to understand their content before modifying
- Base your actions on ACTUAL content, not assumptions

**For tasks creating new content**:
- Check if similar content already exists (don't create duplicates)
- Follow existing naming patterns and folder structures
- Consider what frontmatter, tags, or links would be valuable

**For ambiguous requests**:
- State your assumptions clearly
- Choose the most useful interpretation
- Explain what you're doing and why in the preview field

${toolsSection}

## Response Format

Output ONLY valid JSON matching this schema:

{
  "version": "1.0",
  "goal": "Clear description of what this plan accomplishes",
  "assumptions": [
    "State each assumption you're making",
    "Explain any interpretations of ambiguous requests",
    "Note what information you'd ideally have"
  ],
  "riskLevel": "read-only" | "writes" | "commands",
  "steps": [
    {
      "id": "step-1",
      "tool": "tool.name",
      "args": { "parameter": "value" },
      "preview": "Human-readable explanation of what this step does and why"
    }
  ]
}

## Example: Smart Tagging

User: "Tag my recent documents"

BAD approach: Immediately try to add arbitrary tags without knowing what exists.

GOOD approach:
1. vault.listFiles to see what documents exist
2. vault.searchText to find what tags are already in use (#tag patterns)
3. vault.readFile on recent files to understand their content
4. THEN propose intelligent tags based on actual content and existing taxonomy

Remember: You're not just executing commands - you're thoughtfully helping someone manage their knowledge. Take the time to understand the context, and your actions will be genuinely useful.`;
  }

  /**
   * Build the tools section of the system prompt based on configured tools
   */
  private buildToolsSection(configuredTools: string[]): string {
    // Categorize configured tools
    const readTools: string[] = [];
    const writeTools: string[] = [];
    const dangerousTools: string[] = [];
    const utilityTools: string[] = [];
    const pluginTools: string[] = [];

    const readOnlyPatterns = ["readFile", "listFiles", "searchText", "getSelection", "getActiveFilePath", "getContext", "commands.list"];
    const safeWritePatterns = ["ensureFolder", "createFile", "openFile", "insertAtCursor"];
    const dangerousPatterns = ["delete", "rename", "writeFile", "replaceSelection", "commands.run"];
    const utilityPatterns = ["util."];
    const pluginPatterns = ["dataview.", "templater.", "tasks.", "advancedtables.", "excalidraw."];

    for (const tool of configuredTools) {
      if (utilityPatterns.some(p => tool.includes(p))) {
        utilityTools.push(tool);
      } else if (pluginPatterns.some(p => tool.includes(p))) {
        pluginTools.push(tool);
      } else if (readOnlyPatterns.some(p => tool.includes(p))) {
        readTools.push(tool);
      } else if (dangerousPatterns.some(p => tool.includes(p))) {
        dangerousTools.push(tool);
      } else if (safeWritePatterns.some(p => tool.includes(p))) {
        writeTools.push(tool);
      } else {
        // Default to read if unsure
        readTools.push(tool);
      }
    }

    let section = "## Available Tools\n\n";

    if (readTools.length > 0) {
      section += "**Information Gathering (always safe, use freely):**\n";
      readTools.forEach(tool => {
        section += `- ${tool}\n`;
      });
      section += "\n";
    }

    if (writeTools.length > 0) {
      section += "**Content Creation:**\n";
      writeTools.forEach(tool => {
        section += `- ${tool}\n`;
      });
      section += "\n";
    }

    if (dangerousTools.length > 0) {
      section += "**Content Modification (use thoughtfully):**\n";
      dangerousTools.forEach(tool => {
        section += `- ${tool}\n`;
      });
      section += "\n";
    }

    if (utilityTools.length > 0) {
      section += "**Utilities:**\n";
      utilityTools.forEach(tool => {
        section += `- ${tool}\n`;
      });
      section += "\n";
    }

    if (pluginTools.length > 0) {
      section += "**Plugin Integrations:**\n";
      pluginTools.forEach(tool => {
        section += `- ${tool}\n`;
      });
      section += "\n";
    }

    return section;
  }

  /**
   * Build the user prompt with context and feedback
   */
  private buildUserPrompt(
    userMessage: string,
    context: ExecutionContext,
    feedbackMessages: string[] = []
  ): string {
    let prompt = `User request: "${userMessage}"

Current context:
- Active file: ${context.activeFile || "None"}
- Selection: ${context.selection ? `"${context.selection.substring(0, 200)}${context.selection.length > 200 ? "..." : ""}"` : "None"}
- Vault path: ${context.vaultPath}`;

    if (feedbackMessages.length > 0) {
      prompt += "\n\n" + feedbackMessages.join("\n\n");
    }

    prompt += "\n\nGenerate an action plan to fulfill this request.";
    return prompt;
  }

  /**
   * Format errors into user-friendly messages
   */
  private formatError(error: unknown): string {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Network errors
    if (errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("ECONNREFUSED")) {
      return "**Network Error**\n\nCouldn't connect to the LLM service. Please check:\n- Your internet connection\n- The API endpoint configuration\n- Whether the service is accessible";
    }

    // API Key errors
    if (errorMsg.includes("401") || errorMsg.includes("unauthorized") || errorMsg.includes("API key")) {
      return "**Authentication Error**\n\nInvalid API key. Please check your settings and ensure you have a valid API key configured.";
    }

    // Rate limiting
    if (errorMsg.includes("429") || errorMsg.includes("rate limit")) {
      return "**Rate Limit Exceeded**\n\nYou've made too many requests. Please wait a moment and try again.";
    }

    // API errors
    if (errorMsg.includes("500") || errorMsg.includes("503") || errorMsg.includes("service")) {
      return "**Service Error**\n\nThe LLM service is experiencing issues. Please try again in a moment.";
    }

    // JSON parsing errors
    if (errorMsg.includes("JSON") || errorMsg.includes("parse")) {
      return "**Response Error**\n\nReceived invalid response from LLM. This may be a temporary issue. Please try again.";
    }

    // Validation errors
    if (errorMsg.includes("Invalid plan") || errorMsg.includes("validation")) {
      return `**Plan Generation Failed**\n\nCouldn't generate a valid plan after multiple attempts.\n\nDetails:\n${errorMsg}`;
    }

    // Generic error
    return `**Error**\n\n${errorMsg}`;
  }
}
