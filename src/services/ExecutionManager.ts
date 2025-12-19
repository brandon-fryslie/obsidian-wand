import { App } from "obsidian";
import { Executor, ExecutionProgress as ExecutorProgress } from "./Executor";
import { PlanStore } from "./PlanStore";
import { ExecutionContext, ExecutionResult } from "../types/ActionPlan";
import { Plan } from "../types/Plan";

/**
 * Extended execution progress information for UI display
 */
export interface ExecutionProgress {
  planId: string;
  attemptId: string;
  currentStep: number;
  totalSteps: number;
  currentStepPreview: string;
  completedSteps: ExecutionResult[];
  status: "running" | "paused" | "completing";
  startedAt: Date;
  elapsedMs: number;
  log: ExecutorProgress["log"];
}

/**
 * Result of plan execution
 */
export interface PlanExecutionResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  results: ExecutionResult[];
  error?: string;
  duration: number;
}

/**
 * High-level execution orchestration service that manages plan execution lifecycle
 */
export class ExecutionManager {
  private app: App;
  private executor: Executor;
  private planStore: PlanStore;

  // Current execution state
  private currentExecution: {
    planId: string;
    isPaused: boolean;
    isCancelling: boolean;
    startTime: number;
  } | null = null;

  // Progress callbacks
  private progressCallbacks: Set<(progress: ExecutionProgress) => void> =
    new Set();

  constructor(
    app: App,
    executor: Executor,
    planStore: PlanStore
  ) {
    this.app = app;
    this.executor = executor;
    this.planStore = planStore;
  }

  /**
   * Execute a plan from start to finish
   */
  async execute(planId: string): Promise<PlanExecutionResult> {
    const plan = this.planStore.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Check if another plan is already executing
    if (this.currentExecution && !this.currentExecution.isCancelling) {
      throw new Error(
        "Another plan is already executing. Please wait or cancel it first."
      );
    }

    // Validate plan status
    if (
      plan.status !== "approved" &&
      plan.status !== "paused" &&
      plan.status !== "failed"
    ) {
      throw new Error(
        `Cannot execute plan with status '${plan.status}'. Plan must be approved, paused, or failed.`
      );
    }

    // Start execution
    const startTime = Date.now();
    this.currentExecution = {
      planId,
      isPaused: false,
      isCancelling: false,
      startTime,
    };

    try {
      // Start execution in PlanStore (creates attempt)
      if (plan.status !== "paused") {
        this.planStore.startExecution(planId);
      } else {
        // Resume from paused state
        this.planStore.resume(planId);
      }

      // Get updated plan with execution state
      const executingPlan = this.planStore.get(planId)!;

      // Build execution context
      const context = await this.buildExecutionContext(executingPlan);

      // Execute the action plan with progress tracking
      const results = await this.executor.execute(
        executingPlan.actionPlan,
        context,
        (executorProgress) => {
          this.handleExecutorProgress(planId, executorProgress);
        }
      );

      // Check if execution was cancelled or paused
      if (this.currentExecution?.isCancelling) {
        const duration = Date.now() - startTime;
        return {
          success: false,
          completedSteps: results.filter((r) => r.success).length,
          totalSteps: executingPlan.actionPlan.steps.length,
          results,
          error: "Execution was cancelled",
          duration,
        };
      }

      if (this.currentExecution?.isPaused) {
        const duration = Date.now() - startTime;
        return {
          success: false,
          completedSteps: results.filter((r) => r.success).length,
          totalSteps: executingPlan.actionPlan.steps.length,
          results,
          error: "Execution was paused",
          duration,
        };
      }

      // Check if all steps succeeded
      const allSuccess = results.every((r) => r.success);
      const duration = Date.now() - startTime;

      if (allSuccess) {
        // Mark as completed
        this.planStore.complete(planId, {
          stepId: "final",
          success: true,
          result: { completedSteps: results.length },
          duration,
        });

        return {
          success: true,
          completedSteps: results.length,
          totalSteps: executingPlan.actionPlan.steps.length,
          results,
          duration,
        };
      } else {
        // Some steps failed
        const firstError = results.find((r) => !r.success);
        const errorMessage = firstError?.error || "Unknown error";

        this.planStore.fail(planId, errorMessage);

        return {
          success: false,
          completedSteps: results.filter((r) => r.success).length,
          totalSteps: executingPlan.actionPlan.steps.length,
          results,
          error: errorMessage,
          duration,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark as failed in store
      this.planStore.fail(planId, errorMessage);

      return {
        success: false,
        completedSteps: 0,
        totalSteps: plan.actionPlan.steps.length,
        results: [],
        error: errorMessage,
        duration,
      };
    } finally {
      // Clear execution state
      this.currentExecution = null;
    }
  }

  /**
   * Pause execution at the current step
   */
  pause(): void {
    if (!this.currentExecution) {
      throw new Error("No execution in progress");
    }

    if (this.currentExecution.isPaused) {
      throw new Error("Execution is already paused");
    }

    // Mark as paused
    this.currentExecution.isPaused = true;

    // Update plan status
    this.planStore.pause(this.currentExecution.planId);
  }

  /**
   * Resume execution from paused state
   */
  async resume(): Promise<PlanExecutionResult> {
    if (!this.currentExecution) {
      throw new Error("No execution in progress");
    }

    if (!this.currentExecution.isPaused) {
      throw new Error("Execution is not paused");
    }

    // Mark as resumed
    this.currentExecution.isPaused = false;

    // Resume in plan store
    this.planStore.resume(this.currentExecution.planId);

    // Continue execution
    return this.execute(this.currentExecution.planId);
  }

  /**
   * Cancel execution cleanly
   */
  cancel(): void {
    if (!this.currentExecution) {
      throw new Error("No execution in progress");
    }

    // Mark as cancelling
    this.currentExecution.isCancelling = true;

    // Update plan status
    this.planStore.cancel(this.currentExecution.planId);

    // Clear execution state
    this.currentExecution = null;
  }

  /**
   * Check if a plan is currently executing
   */
  isExecuting(): boolean {
    return this.currentExecution !== null && !this.currentExecution.isCancelling;
  }

  /**
   * Get the ID of the currently executing plan
   */
  getCurrentPlanId(): string | null {
    return this.currentExecution?.planId || null;
  }

  /**
   * Subscribe to progress updates
   * @returns Unsubscribe function
   */
  onProgress(callback: (progress: ExecutionProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Get current execution progress
   */
  getProgress(): ExecutionProgress | null {
    if (!this.currentExecution) {
      return null;
    }

    const plan = this.planStore.get(this.currentExecution.planId);
    if (!plan || !plan.executionState) {
      return null;
    }

    const currentStepIndex = plan.executionState.currentStepIndex;
    const currentStep = plan.actionPlan.steps[currentStepIndex];

    return {
      planId: plan.id,
      attemptId: plan.executionState.attemptId,
      currentStep: currentStepIndex + 1,
      totalSteps: plan.executionState.totalSteps,
      currentStepPreview: currentStep?.preview || currentStep?.tool || "Unknown",
      completedSteps: plan.executionState.stepResults,
      status: this.currentExecution.isPaused ? "paused" : "running",
      startedAt: plan.executionState.startedAt,
      elapsedMs: Date.now() - this.currentExecution.startTime,
      log: [], // Will be populated by executor progress
    };
  }

  /**
   * Build execution context for a plan
   */
  private async buildExecutionContext(plan: Plan): Promise<ExecutionContext> {
    // Get current workspace state
    const activeFile = this.app.workspace.getActiveFile();

    // Build context
    const context: ExecutionContext = {
      activeFile: activeFile?.path,
      vaultPath: this.app.vault.getRoot().path,
      variables: {},
      stepResults: new Map(),
      availableCommands: [],
    };

    // If resuming, restore previous step results
    if (plan.executionState) {
      plan.executionState.stepResults.forEach((result) => {
        context.stepResults.set(result.stepId, result.result);
      });
    }

    return context;
  }

  /**
   * Handle progress updates from the executor
   */
  private handleExecutorProgress(
    planId: string,
    executorProgress: ExecutorProgress
  ): void {
    // Update plan store with progress
    const currentStepIndex = executorProgress.currentStep - 1;

    // Find the last completed step result from the log
    const completedLogs = executorProgress.log.filter(
      (entry) => entry.status === "success" || entry.status === "error"
    );

    if (completedLogs.length > 0) {
      const lastCompleted = completedLogs[completedLogs.length - 1];

      // Convert log entry to ExecutionResult
      const stepResult: ExecutionResult = {
        stepId: lastCompleted.stepId,
        success: lastCompleted.status === "success",
        result: lastCompleted.result,
        error: lastCompleted.error,
        duration: lastCompleted.duration || 0,
      };

      this.planStore.updateProgress(planId, currentStepIndex, stepResult);
    } else {
      // Just update step index
      this.planStore.updateProgress(planId, currentStepIndex);
    }

    // Build progress object for callbacks
    const plan = this.planStore.get(planId);
    if (!plan || !plan.executionState) {
      return;
    }

    const progress: ExecutionProgress = {
      planId,
      attemptId: plan.executionState.attemptId,
      currentStep: executorProgress.currentStep,
      totalSteps: executorProgress.totalSteps,
      currentStepPreview: executorProgress.currentAction,
      completedSteps: plan.executionState.stepResults,
      status: this.currentExecution?.isPaused ? "paused" : "running",
      startedAt: plan.executionState.startedAt,
      elapsedMs: Date.now() - executorProgress.startTime,
      log: executorProgress.log,
    };

    // Emit progress to all subscribers
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.error("Error in execution progress callback:", error);
      }
    });
  }
}
