import { App, MarkdownView } from "obsidian";
import { ToolAgentSettings } from "../types/settings";
import { ActionPlan, ExecutionContext } from "../types/ActionPlan";
import { LLMProvider } from "./LLMProvider";
import { Executor, ExecutionProgress, ExecutionLogEntry } from "./Executor";
import { ToolsLayer } from "./ToolsLayer";
import { PlanValidator, PlanSummary, ValidationWarning } from "./PlanValidator";
import { ActionPlanSchema } from "../schemas/ActionPlanSchema";
import { ApprovalService, ApprovalDecision } from "./ApprovalService";

export type { ExecutionLogEntry };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  plan?: ActionPlan;
  executionResults?: any[];
}

export interface StepApprovalStatus {
  stepId: string;
  tool: string;
  decision: ApprovalDecision;
  reason: string;
  // User's choice for this step
  userApproved?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  currentPlan?: ActionPlan;
  currentPlanSummary?: PlanSummary;
  currentPlanWarnings?: ValidationWarning[];
  // Approval status for each step in the current plan
  stepApprovals?: StepApprovalStatus[];
  // Whether all steps are auto-approved (no user interaction needed)
  allAutoApproved?: boolean;
  isExecuting: boolean;
  executionProgress?: ExecutionProgress;
}

export class ChatController {
  private app: App;
  private llmProvider: LLMProvider;
  private executor: Executor;
  private toolsLayer: ToolsLayer;
  private planValidator: PlanValidator;
  private approvalService: ApprovalService;
  private state: ChatState;
  private stateChangeCallbacks: ((state: ChatState) => void)[] = [];

  constructor(
    app: App,
    _settings: ToolAgentSettings,
    llmProvider: LLMProvider,
    executor: Executor,
    toolsLayer: ToolsLayer,
    approvalService: ApprovalService
  ) {
    this.app = app;
    this.llmProvider = llmProvider;
    this.executor = executor;
    this.toolsLayer = toolsLayer;
    this.planValidator = new PlanValidator();
    this.approvalService = approvalService;
    this.state = {
      messages: [],
      isGenerating: false,
      isExecuting: false,
    };
  }

  async initialize() {
    // Load conversation history if needed
    this.updateState({ messages: [] });
  }

  updateSettings(settings: ToolAgentSettings) {
    this.llmProvider.updateSettings(settings);
  }

  onStateChange(callback: (state: ChatState) => void) {
    this.stateChangeCallbacks.push(callback);
  }

  private updateState(updates: Partial<ChatState>) {
    this.state = { ...this.state, ...updates };
    console.log("[Wand:Timing] updateState: triggering", this.stateChangeCallbacks.length, "callbacks");
    const callbackStart = performance.now();
    this.stateChangeCallbacks.forEach((cb, index) => {
      const cbStart = performance.now();
      cb(this.state);
      console.log("[Wand:Timing] updateState: callback", index, "took", performance.now() - cbStart, "ms");
    });
    console.log("[Wand:Timing] updateState: all callbacks took", performance.now() - callbackStart, "ms total");
  }

  getState(): ChatState {
    return { ...this.state };
  }

  async sendMessage(message: string): Promise<void> {
    const sendMessageStart = performance.now();
    console.log("[Wand:Timing] sendMessage START");

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    const newMessages = [...this.state.messages, userMessage];
    console.log("[Wand:Timing] About to updateState with user message");
    this.updateState({
      messages: newMessages,
      isGenerating: true
    });
    console.log("[Wand:Timing] updateState (user message) took", performance.now() - sendMessageStart, "ms");

    try {
      // Get current context
      console.log("[Wand:Timing] About to gatherContext");
      const contextStart = performance.now();
      const context = await this.gatherContext();
      console.log("[Wand:Timing] gatherContext took", performance.now() - contextStart, "ms");

      // Generate plan from LLM with retry logic
      console.log("[Wand:Timing] About to generatePlanWithRetry");
      const planGenStart = performance.now();
      const { plan, validationResult } = await this.generatePlanWithRetry(message, context);
      console.log("[Wand:Timing] generatePlanWithRetry took", performance.now() - planGenStart, "ms");

      // Check approvals for each step
      console.log("[Wand:Timing] About to checkPlanApprovals");
      const approvalStart = performance.now();
      const stepApprovals = this.checkPlanApprovals(plan);
      const allAutoApproved = stepApprovals.every(s => s.decision === "allow");
      const anyDenied = stepApprovals.some(s => s.decision === "deny");
      console.log("[Wand:Timing] checkPlanApprovals took", performance.now() - approvalStart, "ms");

      // If any step is denied, show error
      if (anyDenied) {
        const deniedSteps = stepApprovals.filter(s => s.decision === "deny");
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          role: "assistant",
          content: this.formatDeniedStepsError(plan, deniedSteps),
          timestamp: new Date(),
        };

        console.log("[Wand:Timing] About to updateState with denied error");
        const deniedUpdateStart = performance.now();
        this.updateState({
          messages: [...newMessages, errorMessage],
          isGenerating: false,
        });
        console.log("[Wand:Timing] updateState (denied) took", performance.now() - deniedUpdateStart, "ms");
        return;
      }

      // Add assistant message with plan
      console.log("[Wand:Timing] About to formatPlanResponse");
      const formatStart = performance.now();
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: this.formatPlanResponse(plan, validationResult.summary, allAutoApproved),
        timestamp: new Date(),
        plan,
      };
      console.log("[Wand:Timing] formatPlanResponse took", performance.now() - formatStart, "ms");

      console.log("[Wand:Timing] About to updateState with plan");
      const updateStateStart = performance.now();
      this.updateState({
        messages: [...newMessages, assistantMessage],
        currentPlan: plan,
        currentPlanSummary: validationResult.summary,
        currentPlanWarnings: validationResult.warnings,
        stepApprovals,
        allAutoApproved,
        isGenerating: false,
      });
      console.log("[Wand:Timing] updateState (with plan) took", performance.now() - updateStateStart, "ms");

      // If all steps are auto-approved, execute immediately
      if (allAutoApproved) {
        console.log("[Wand:Timing] All steps auto-approved, about to executePlan");
        const execStart = performance.now();
        await this.executePlan(plan);
        console.log("[Wand:Timing] executePlan took", performance.now() - execStart, "ms");
      }

      console.log("[Wand:Timing] sendMessage COMPLETE, total time:", performance.now() - sendMessageStart, "ms");
    } catch (error) {
      console.error("[Wand:Timing] Error generating plan:", error);
      const userFriendlyError = this.formatError(error);

      // Add error message
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: userFriendlyError,
        timestamp: new Date(),
      };

      console.log("[Wand:Timing] About to updateState with error message");
      const errorUpdateStart = performance.now();
      this.updateState({
        messages: [...newMessages, errorMessage],
        isGenerating: false,
      });
      console.log("[Wand:Timing] updateState (error) took", performance.now() - errorUpdateStart, "ms");
      console.log("[Wand:Timing] sendMessage ERROR COMPLETE, total time:", performance.now() - sendMessageStart, "ms");
    }
  }

  /**
   * Check approval status for each step in the plan
   */
  private checkPlanApprovals(plan: ActionPlan): StepApprovalStatus[] {
    return plan.steps.map(step => ({
      stepId: step.id,
      tool: step.tool,
      decision: this.approvalService.checkApproval(step),
      reason: this.approvalService.getApprovalReason(step),
    }));
  }

  /**
   * Format error message for denied steps
   */
  private formatDeniedStepsError(plan: ActionPlan, deniedSteps: StepApprovalStatus[]): string {
    let response = `**Cannot execute plan: ${plan.goal}**\n\n`;
    response += "The following operations are blocked by your settings:\n\n";

    for (const step of deniedSteps) {
      response += `- ❌ **${step.tool}**: ${step.reason}\n`;
    }

    response += "\nYou can modify the denied tools list in settings to allow these operations.";
    return response;
  }

  /**
   * Approve a specific step and optionally remember the decision
   */
  approveStep(stepId: string, options?: { remember?: boolean; addToAllowlist?: boolean }): void {
    const stepApprovals = this.state.stepApprovals;
    if (!stepApprovals) return;

    const stepIndex = stepApprovals.findIndex(s => s.stepId === stepId);
    if (stepIndex === -1) return;

    const step = stepApprovals[stepIndex];
    step.userApproved = true;

    // Record the decision
    this.approvalService.recordDecision(step.tool, "allow", options);

    // Update state
    this.updateState({ stepApprovals: [...stepApprovals] });
  }

  /**
   * Approve all steps that need approval
   */
  approveAllSteps(options?: { remember?: boolean; addToAllowlist?: boolean }): void {
    const stepApprovals = this.state.stepApprovals;
    if (!stepApprovals) return;

    for (const step of stepApprovals) {
      if (step.decision === "ask") {
        step.userApproved = true;
        this.approvalService.recordDecision(step.tool, "allow", options);
      }
    }

    this.updateState({ stepApprovals: [...stepApprovals] });
  }

  /**
   * Check if all steps that need approval have been approved by the user
   */
  canExecutePlan(): boolean {
    const stepApprovals = this.state.stepApprovals;
    if (!stepApprovals) return false;

    return stepApprovals.every(s =>
      s.decision === "allow" || s.userApproved === true
    );
  }

  async executePlan(plan: ActionPlan): Promise<void> {
    console.log("[Wand:Timing] executePlan START");
    const execPlanStart = performance.now();
    const startTime = Date.now();

    console.log("[Wand:Timing] executePlan: setting initial state");
    this.updateState({
      isExecuting: true,
      executionProgress: {
        currentStep: 0,
        totalSteps: plan.steps.length,
        currentAction: "Starting execution...",
        log: plan.steps.map(step => ({
          stepId: step.id,
          tool: step.tool,
          preview: step.preview || step.tool,
          status: "pending" as const,
          args: step.args,
        })),
        startTime,
      }
    });

    try {
      console.log("[Wand:Timing] executePlan: gathering context");
      const context = await this.gatherContext();

      console.log("[Wand:Timing] executePlan: starting executor.execute");
      const executeStart = performance.now();
      const results = await this.executor.execute(plan, context, (progress) => {
        this.updateState({
          executionProgress: progress
        });
      });
      console.log("[Wand:Timing] executePlan: executor.execute completed in", performance.now() - executeStart, "ms");
      console.log("[Wand:Timing] executePlan: results count:", results.length);

      // Add execution results to the last message
      console.log("[Wand:Timing] executePlan: updating messages with results");
      const messages = [...this.state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.plan) {
        lastMessage.executionResults = results;
        this.updateState({ messages });
      }
      console.log("[Wand:Timing] executePlan: messages updated");

    } catch (error) {
      console.error("[Wand:Timing] executePlan: ERROR:", error);
      throw error;
    } finally {
      console.log("[Wand:Timing] executePlan: finally block - clearing state");
      const finallyStart = performance.now();
      this.updateState({
        isExecuting: false,
        executionProgress: undefined,
        currentPlan: undefined,
        currentPlanSummary: undefined,
        currentPlanWarnings: undefined,
        stepApprovals: undefined,
        allAutoApproved: undefined,
      });
      console.log("[Wand:Timing] executePlan: finally updateState took", performance.now() - finallyStart, "ms");
      console.log("[Wand:Timing] executePlan COMPLETE, total time:", performance.now() - execPlanStart, "ms");
    }
  }

  cancelPlan(): void {
    this.updateState({
      currentPlan: undefined,
      currentPlanSummary: undefined,
      currentPlanWarnings: undefined,
      stepApprovals: undefined,
      allAutoApproved: undefined,
    });
  }

  cancelGeneration(): void {
    this.llmProvider.abort();
    this.updateState({ isGenerating: false });
  }

  async revisePlan(revision: string): Promise<void> {
    const currentPlan = this.state.currentPlan;
    if (!currentPlan) return;

    // Add user's revision request as a message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: "user",
      content: `Revise the plan: ${revision}`,
      timestamp: new Date(),
    };

    const newMessages = [...this.state.messages, userMessage];
    this.updateState({
      messages: newMessages,
      isGenerating: true,
      currentPlan: undefined,
      currentPlanSummary: undefined,
      currentPlanWarnings: undefined,
      stepApprovals: undefined,
      allAutoApproved: undefined,
    });

    try {
      const context = await this.gatherContext();
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildRevisionPrompt(currentPlan, revision, context);

      console.log("[Wand] Revision Prompt:\n", userPrompt);

      const response = await this.llmProvider.generatePlan(systemPrompt, userPrompt);
      const validationResult = this.planValidator.validate(response);

      if (!validationResult.valid) {
        throw new Error(this.planValidator.formatValidationResult(validationResult));
      }

      const stepApprovals = this.checkPlanApprovals(response);
      const allAutoApproved = stepApprovals.every(s => s.decision === "allow");

      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: this.formatPlanResponse(response, validationResult.summary, allAutoApproved),
        timestamp: new Date(),
        plan: response,
      };

      this.updateState({
        messages: [...newMessages, assistantMessage],
        currentPlan: response,
        currentPlanSummary: validationResult.summary,
        currentPlanWarnings: validationResult.warnings,
        stepApprovals,
        allAutoApproved,
        isGenerating: false,
      });

      if (allAutoApproved) {
        await this.executePlan(response);
      }
    } catch (error) {
      console.error("Error revising plan:", error);
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: this.formatError(error),
        timestamp: new Date(),
      };

      this.updateState({
        messages: [...newMessages, errorMessage],
        isGenerating: false,
      });
    }
  }

  private buildRevisionPrompt(currentPlan: ActionPlan, revision: string, context: ExecutionContext): string {
    return `Current plan:
${JSON.stringify(currentPlan, null, 2)}

User wants to revise this plan: "${revision}"

Context:
- Active file: ${context.activeFile || "None"}
- Vault path: ${context.vaultPath}

Generate a revised action plan incorporating the user's feedback.`;
  }

  clearMessages(): void {
    this.updateState({
      messages: [],
      currentPlan: undefined,
      currentPlanSummary: undefined,
      currentPlanWarnings: undefined,
      stepApprovals: undefined,
      allAutoApproved: undefined,
    });
  }

  restoreMessages(messages: ChatMessage[]): void {
    this.updateState({ messages });
  }

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

        // Debug logging - show what's being sent to the LLM
        console.log("[Wand] LLM Request:", {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          systemPromptLength: systemPrompt.length,
          userPromptLength: userPrompt.length,
        });
        console.log("[Wand] User Prompt:\n", userPrompt);

        const response = await this.llmProvider.generatePlan(systemPrompt, userPrompt);

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
            const resolvedResponse = await this.llmProvider.generatePlan(
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
          const result = await this.toolsLayer.executeTool(step.tool as any, step.args, context);
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

  private buildSystemPrompt(): string {
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

## Available Tools

**Information Gathering (always safe, use freely):**
- vault.listFiles: List files in a folder (use recursive=true to see everything)
- vault.readFile: Read a file's content - USE THIS to understand context
- vault.searchText: Search for text patterns across the vault
- editor.getSelection: Get currently selected text
- editor.getActiveFilePath: Get the current file path
- workspace.getContext: Get workspace state

**Content Creation:**
- vault.ensureFolder: Create a folder structure
- vault.createFile: Create a new file with content (safe for new files)
- editor.insertAtCursor: Add text at cursor position

**Content Modification (use thoughtfully):**
- vault.writeFile: Overwrite file contents (careful - replaces everything)
- editor.replaceSelection: Replace selected text
- vault.rename: Rename or move a file

**Potentially Destructive:**
- vault.delete: Remove a file or folder permanently

**Utilities:**
- commands.list: List available Obsidian commands
- commands.run: Execute an Obsidian command by ID
- util.parseMarkdownBullets: Parse bullet list to array
- util.slugifyTitle: Convert text to filename-safe slug

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

  private formatPlanResponse(plan: ActionPlan, summary?: PlanSummary, allAutoApproved?: boolean): string {
    let response = `I'll help you **${plan.goal}**.\n\n`;

    if (plan.assumptions.length > 0) {
      response += "**Assumptions:**\n";
      plan.assumptions.forEach(assumption => {
        response += `- ${assumption}\n`;
      });
      response += "\n";
    }

    response += `**Risk Level:** ${plan.riskLevel}\n`;

    if (summary) {
      response += `**Steps:** ${summary.estimatedSteps}\n`;

      if (summary.filesCreated.length > 0) {
        response += `**Files to create:** ${summary.filesCreated.length}\n`;
      }
      if (summary.filesModified.length > 0) {
        response += `**Files to modify:** ${summary.filesModified.length}\n`;
      }
      if (summary.filesDeleted.length > 0) {
        response += `**Files to delete:** ${summary.filesDeleted.length}\n`;
      }
      if (summary.commandsExecuted.length > 0) {
        response += `**Commands to run:** ${summary.commandsExecuted.length}\n`;
      }
    }

    if (allAutoApproved) {
      response += "\nAll operations are pre-approved. Executing...";
    } else {
      response += "\nReview the plan below and approve to execute.";
    }
    return response;
  }

  private async gatherContext(): Promise<ExecutionContext> {
    const activeFile = this.app.workspace.getActiveFile();
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = activeView?.editor?.getSelection();

    // List available commands
    const availableCommands = await this.toolsLayer.listCommands();

    const context = {
      activeFile: activeFile?.path,
      selection: selection || undefined,
      vaultPath: this.app.vault.getRoot().path,
      variables: {},
      stepResults: new Map(),
      availableCommands,
    };

    // Debug logging
    console.log("[Wand] Context gathered:", {
      activeFile: context.activeFile,
      hasSelection: !!context.selection,
      selectionLength: context.selection?.length || 0,
      selectionPreview: context.selection?.substring(0, 100),
      commandCount: availableCommands.length,
    });

    return context;
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanup() {
    // Clean up resources
    this.stateChangeCallbacks = [];
  }
}
