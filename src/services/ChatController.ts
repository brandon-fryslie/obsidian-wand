import { App, MarkdownView } from "obsidian";
import { ToolAgentSettings } from "../types/settings";
import { ActionPlan, ExecutionContext } from "../types/ActionPlan";
import { Executor, ExecutionProgress, ExecutionLogEntry } from "./Executor";
import { PlanValidator, PlanSummary, ValidationWarning } from "./PlanValidator";
import { ApprovalService, ApprovalDecision } from "./ApprovalService";
import { Agent, AgentContext } from "../agents/Agent";

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

/**
 * ChatController orchestrates the conversation flow and execution.
 *
 * Responsibilities:
 * - Message history management
 * - Approval flow coordination
 * - Execution orchestration
 * - State change notifications
 *
 * Delegates to Agent for:
 * - Plan generation
 * - Prompt building
 * - Response formatting
 */
export class ChatController {
  private app: App;
  private agent: Agent;
  private executor: Executor;
  private planValidator: PlanValidator;
  private approvalService: ApprovalService;
  private state: ChatState;
  private stateChangeCallbacks: ((state: ChatState) => void)[] = [];

  constructor(
    app: App,
    agent: Agent,
    executor: Executor,
    approvalService: ApprovalService
  ) {
    this.app = app;
    this.agent = agent;
    this.executor = executor;
    this.planValidator = new PlanValidator();
    this.approvalService = approvalService;
    this.state = {
      messages: [],
      isGenerating: false,
      isExecuting: false,
    };
  }

  async initialize() {
    await this.agent.initialize();
    this.updateState({ messages: [] });
  }

  updateSettings(_settings: ToolAgentSettings) {
    // Settings updates handled by PluginServices
  }

  onStateChange(callback: (state: ChatState) => void) {
    this.stateChangeCallbacks.push(callback);
  }

  private updateState(updates: Partial<ChatState>) {
    this.state = { ...this.state, ...updates };
    console.log("[Chat] updateState: triggering", this.stateChangeCallbacks.length, "callbacks");
    this.stateChangeCallbacks.forEach((cb) => {
      cb(this.state);
    });
  }

  getState(): ChatState {
    return { ...this.state };
  }

  async sendMessage(message: string): Promise<void> {
    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    const newMessages = [...this.state.messages, userMessage];
    this.updateState({
      messages: newMessages,
      isGenerating: true
    });

    try {
      // Gather context and delegate to agent
      const context = await this.gatherContext();
      const response = await this.agent.handleUserMessage(message, context);

      if (response.type === "error") {
        // Add error message
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          role: "assistant",
          content: response.error || "An unknown error occurred",
          timestamp: new Date(),
        };

        this.updateState({
          messages: [...newMessages, errorMessage],
          isGenerating: false,
        });
        return;
      }

      if (response.type === "plan" && response.plan) {
        const plan = response.plan;

        // Validate and get summary
        const validationResult = this.planValidator.validate(plan);

        // Check approvals for each step
        const stepApprovals = this.checkPlanApprovals(plan);
        const allAutoApproved = stepApprovals.every(s => s.decision === "allow");
        const anyDenied = stepApprovals.some(s => s.decision === "deny");

        // If any step is denied, show error
        if (anyDenied) {
          const deniedSteps = stepApprovals.filter(s => s.decision === "deny");
          const errorMessage: ChatMessage = {
            id: this.generateId(),
            role: "assistant",
            content: this.formatDeniedStepsError(plan, deniedSteps),
            timestamp: new Date(),
          };

          this.updateState({
            messages: [...newMessages, errorMessage],
            isGenerating: false,
          });
          return;
        }

        // Add assistant message with plan
        const assistantMessage: ChatMessage = {
          id: this.generateId(),
          role: "assistant",
          content: this.formatPlanResponse(plan, validationResult.summary, allAutoApproved),
          timestamp: new Date(),
          plan,
        };

        this.updateState({
          messages: [...newMessages, assistantMessage],
          currentPlan: plan,
          currentPlanSummary: validationResult.summary,
          currentPlanWarnings: validationResult.warnings,
          stepApprovals,
          allAutoApproved,
          isGenerating: false,
        });

        // If all steps are auto-approved, execute immediately
        if (allAutoApproved) {
          await this.executePlan(plan);
        }
      }
    } catch (error) {
      console.error("[Chat] Error in sendMessage:", error);
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: `**Error**\n\n${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };

      this.updateState({
        messages: [...newMessages, errorMessage],
        isGenerating: false,
      });
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
   * Format plan response for display
   */
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
    const startTime = Date.now();

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
      const context = await this.gatherExecutionContext();

      const results = await this.executor.execute(plan, context, (progress) => {
        this.updateState({
          executionProgress: progress
        });
      });

      // Add execution results to the last message
      const messages = [...this.state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.plan) {
        lastMessage.executionResults = results;
        this.updateState({ messages });
      }

    } catch (error) {
      console.error("[Chat] executePlan: ERROR:", error);
      throw error;
    } finally {
      this.updateState({
        isExecuting: false,
        executionProgress: undefined,
        currentPlan: undefined,
        currentPlanSummary: undefined,
        currentPlanWarnings: undefined,
        stepApprovals: undefined,
        allAutoApproved: undefined,
      });
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
    this.agent.abort();
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
      // For now, treat revision as a new message
      // TODO: Could enhance Agent API to support explicit revision
      const context = await this.gatherContext();
      const fullMessage = `Revise the previous plan (${currentPlan.goal}): ${revision}`;
      const response = await this.agent.handleUserMessage(fullMessage, context);

      if (response.type === "error") {
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          role: "assistant",
          content: response.error || "An unknown error occurred",
          timestamp: new Date(),
        };

        this.updateState({
          messages: [...newMessages, errorMessage],
          isGenerating: false,
        });
        return;
      }

      if (response.type === "plan" && response.plan) {
        const plan = response.plan;
        const validationResult = this.planValidator.validate(plan);
        const stepApprovals = this.checkPlanApprovals(plan);
        const allAutoApproved = stepApprovals.every(s => s.decision === "allow");

        const assistantMessage: ChatMessage = {
          id: this.generateId(),
          role: "assistant",
          content: this.formatPlanResponse(plan, validationResult.summary, allAutoApproved),
          timestamp: new Date(),
          plan,
        };

        this.updateState({
          messages: [...newMessages, assistantMessage],
          currentPlan: plan,
          currentPlanSummary: validationResult.summary,
          currentPlanWarnings: validationResult.warnings,
          stepApprovals,
          allAutoApproved,
          isGenerating: false,
        });

        if (allAutoApproved) {
          await this.executePlan(plan);
        }
      }
    } catch (error) {
      console.error("Error revising plan:", error);
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: "assistant",
        content: `**Error**\n\n${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      };

      this.updateState({
        messages: [...newMessages, errorMessage],
        isGenerating: false,
      });
    }
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

  /**
   * Gather context for agent (lightweight version)
   */
  private async gatherContext(): Promise<AgentContext> {
    const activeFile = this.app.workspace.getActiveFile();
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = activeView?.editor?.getSelection();

    return {
      activeFile: activeFile?.path,
      selection: selection || undefined,
      vaultPath: this.app.vault.getRoot().path,
    };
  }

  /**
   * Gather full execution context
   */
  private async gatherExecutionContext(): Promise<ExecutionContext> {
    const activeFile = this.app.workspace.getActiveFile();
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const selection = activeView?.editor?.getSelection();

    return {
      activeFile: activeFile?.path,
      selection: selection || undefined,
      vaultPath: this.app.vault.getRoot().path,
      variables: {},
      stepResults: new Map(),
      availableCommands: [],
    };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanup() {
    this.agent.cleanup();
    this.stateChangeCallbacks = [];
  }
}
