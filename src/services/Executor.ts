import { ActionPlan, Step, ExecutionContext, ExecutionResult } from "../types/ActionPlan";
import { ToolsLayer } from "./ToolsLayer";

export type LogEntryStatus = "pending" | "running" | "success" | "error" | "skipped";

export interface ExecutionLogEntry {
  stepId: string;
  tool: string;
  preview: string;
  status: LogEntryStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  result?: any;
  error?: string;
  args?: Record<string, any>;
}

export interface ExecutionProgress {
  currentStep: number;
  totalSteps: number;
  currentAction: string;
  log: ExecutionLogEntry[];
  startTime: number;
}

export class Executor {
  private toolsLayer: ToolsLayer;
  private undoJournal: UndoEntry[] = [];

  constructor(toolsLayer: ToolsLayer) {
    this.toolsLayer = toolsLayer;
  }

  async execute(
    plan: ActionPlan,
    context: ExecutionContext,
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const completed = new Set<string>();
    const stepResults = new Map<string, any>();
    const executionStartTime = Date.now();

    // Initialize log with all steps as pending
    const log: ExecutionLogEntry[] = plan.steps.map(step => ({
      stepId: step.id,
      tool: step.tool,
      preview: step.preview || `${step.tool}`,
      status: "pending" as LogEntryStatus,
      args: step.args,
    }));

    const emitProgress = (currentStep: number, currentAction: string) => {
      console.log("[Wand:Executor] emitProgress called:", currentStep, "/", plan.steps.length, "-", currentAction);
      const progressStart = performance.now();
      onProgress?.({
        currentStep,
        totalSteps: plan.steps.length,
        currentAction,
        log: [...log],
        startTime: executionStartTime,
      });
      console.log("[Wand:Executor] emitProgress callback took:", performance.now() - progressStart, "ms");
    };

    const updateLogEntry = (stepId: string, updates: Partial<ExecutionLogEntry>) => {
      const entry = log.find(e => e.stepId === stepId);
      if (entry) {
        Object.assign(entry, updates);
      }
    };

    // Execute steps in dependency order
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Check if all dependencies are completed
      if (step.dependsOn && !step.dependsOn.every(dep => completed.has(dep))) {
        // Skip for now, will be picked up later when dependencies are done
        updateLogEntry(step.id, { status: "skipped", error: "Dependencies not met" });
        continue;
      }

      // Mark as running
      const stepStartTime = Date.now();
      updateLogEntry(step.id, { status: "running", startTime: stepStartTime });
      emitProgress(i + 1, step.preview || `${step.tool}`);

      // Create updated context for this step
      const stepContext = {
        ...context,
        variables: { ...context.variables },
        stepResults: new Map(stepResults),
      };

      // Handle foreach loops
      if (step.foreach) {
        const arrayPath = step.foreach.from;
        const array = this.resolvePath(arrayPath, stepContext);

        if (!Array.isArray(array)) {
          const errorMsg = `Foreach path '${arrayPath}' is not an array`;
          updateLogEntry(step.id, {
            status: "error",
            error: errorMsg,
            endTime: Date.now(),
            duration: Date.now() - stepStartTime,
          });
          results.push({
            stepId: step.id,
            success: false,
            error: errorMsg,
            duration: 0,
          });
          emitProgress(i + 1, `Error: ${errorMsg}`);
          continue;
        }

        // Execute for each item in the array
        for (let j = 0; j < array.length; j++) {
          const item = array[j];
          stepContext.variables[step.foreach.itemName] = item;

          // Use indexName if provided, otherwise default to 'index'
          const indexName = step.foreach.indexName ?? 'index';
          stepContext.variables[indexName] = j;

          const result = await this.executeStep(step, stepContext);
          results.push(result);

          if (!result.success && step.onError === "stop") {
            updateLogEntry(step.id, {
              status: "error",
              error: result.error,
              endTime: Date.now(),
              duration: Date.now() - stepStartTime,
            });
            emitProgress(i + 1, `Error: ${result.error}`);
            return results;
          }

          // Store result for potential use in later steps
          stepResults.set(`${step.id}_${j}`, result.result);
        }

        // Foreach completed successfully
        updateLogEntry(step.id, {
          status: "success",
          endTime: Date.now(),
          duration: Date.now() - stepStartTime,
          result: `Processed ${array.length} items`,
        });
      } else {
        // Single execution
        const result = await this.executeStep(step, stepContext);
        results.push(result);
        stepResults.set(step.id, result.result);

        const endTime = Date.now();
        if (result.success) {
          updateLogEntry(step.id, {
            status: "success",
            endTime,
            duration: endTime - stepStartTime,
            result: result.result,
          });
        } else {
          updateLogEntry(step.id, {
            status: "error",
            error: result.error,
            endTime,
            duration: endTime - stepStartTime,
          });
          emitProgress(i + 1, `Error: ${result.error}`);

          if (step.onError === "stop") {
            return results;
          }
        }
      }

      completed.add(step.id);
      emitProgress(i + 1, `Completed: ${step.preview || step.tool}`);

      // Check if any skipped steps can now be executed
      let foundNew = true;
      let whileIterations = 0;
      while (foundNew) {
        whileIterations++;
        if (whileIterations > 100) {
          console.error("[Wand:Executor] INFINITE LOOP DETECTED in dependency check!");
          break;
        }
        foundNew = false;
        for (const remainingStep of plan.steps) {
          if (!completed.has(remainingStep.id)) {
            const depsMet = !remainingStep.dependsOn ||
              remainingStep.dependsOn.every(dep => completed.has(dep));

            if (depsMet) {
              foundNew = true;
              // This will be handled in the next iteration of the outer loop
              break;
            }
          }
        }
      }
      console.log("[Wand:Executor] dependency check while loop iterations:", whileIterations);
    }

    // Final progress update
    emitProgress(plan.steps.length, "Execution complete");
    return results;
  }

  private async executeStep(step: Step, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = step.retry?.maxAttempts ?? 1;

    while (attempt < maxAttempts) {
      try {
        // Interpolate args before executing
        const interpolatedArgs = this.interpolateArgs(step.args, context);
        const result = await this.toolsLayer.executeTool(step.tool, interpolatedArgs, context);

        return {
          stepId: step.id,
          success: true,
          result,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        attempt++;

        if (attempt >= maxAttempts) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return {
            stepId: step.id,
            success: false,
            error: errorMsg,
            duration: Date.now() - startTime,
          };
        }

        // Wait before retrying
        if (step.retry && step.retry.backoffMs > 0) {
          await this.sleep(step.retry.backoffMs);
        }
      }
    }

    // Should not reach here
    return {
      stepId: step.id,
      success: false,
      error: "Max attempts exceeded",
      duration: Date.now() - startTime,
    };
  }

  private interpolateArgs(args: Record<string, any>, context: ExecutionContext): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(args)) {
      result[key] = this.interpolateValue(value, context);
    }

    return result;
  }

  private interpolateValue(value: any, context: ExecutionContext): any {
    if (typeof value === 'string' && value.startsWith('$')) {
      return this.resolveReference(value, context);
    }
    if (Array.isArray(value)) {
      return value.map(v => this.interpolateValue(v, context));
    }
    if (value && typeof value === 'object') {
      return this.interpolateArgs(value, context);
    }
    return value;
  }

  private resolveReference(ref: string, context: ExecutionContext): any {
    if (ref.startsWith('$steps.')) {
      const parts = ref.slice(7).split('.');
      const stepId = parts[0];
      const path = parts.slice(1);
      let result = context.stepResults.get(stepId);
      for (const p of path) {
        result = result?.[p];
      }
      return result;
    }
    if (ref.startsWith('$vars.')) {
      const parts = ref.slice(6).split('.');
      let result: any = context.variables;
      for (const p of parts) {
        result = result?.[p];
      }
      return result;
    }
    return ref;
  }

  private resolvePath(path: string, context: ExecutionContext): any {
    // Simple path resolution - can be enhanced later
    const parts = path.split(".");
    let current: any = context;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getUndoJournal(): UndoEntry[] {
    return [...this.undoJournal];
  }

  clearUndoJournal(): void {
    this.undoJournal = [];
  }

  async undoLastOperation(): Promise<boolean> {
    if (this.undoJournal.length === 0) {
      return false;
    }

    const lastEntry = this.undoJournal.pop()!;

    try {
      await this.toolsLayer.undoOperation(lastEntry);
      return true;
    } catch (error) {
      // Put it back if undo failed
      this.undoJournal.push(lastEntry);
      return false;
    }
  }
}

interface UndoEntry {
  operation: string;
  args: any;
  previousState?: any;
  timestamp: Date;
}
