import { App, normalizePath } from "obsidian";
import { nanoid } from "nanoid";
import {
  Plan,
  PlanStatus,
  PlanDraft,
  ExecutionAttempt,
  ExecutionState,
  DependencyType,
  PlanDependency,
  CanExecuteResult,
  PlanConflict,
} from "../types/Plan";
import { PlanEvent } from "../types/PlanEvents";
import { PlanFilters, DEFAULT_PLAN_FILTERS } from "../types/PlanFilters";
import { ExecutionResult } from "../types/ActionPlan";
import { PlanValidator } from "./PlanValidator";

/**
 * Centralized state management service for plans with persistence
 */
export class PlanStore {
  private app: App;
  private plans: Map<string, Plan> = new Map();
  private subscribers: Set<(event: PlanEvent) => void> = new Set();
  private validator: PlanValidator = new PlanValidator();
  private saveTimeout: NodeJS.Timeout | null = null;
  private dataPath: string;

  constructor(app: App) {
    this.app = app;
    this.dataPath = normalizePath(
      ".obsidian/plugins/obsidian-toolagent/data"
    );
  }

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  /**
   * Create a new plan from a draft
   */
  create(draft: PlanDraft): Plan {
    // Validate the action plan
    const validationResult = this.validator.validate(draft.actionPlan);

    const now = new Date();
    const plan: Plan = {
      id: nanoid(),
      title: draft.title,
      goal: draft.goal,
      status: validationResult.valid ? "pending" : "draft",
      priority: draft.priority ?? 3,
      createdAt: now,
      updatedAt: now,
      actionPlan: draft.actionPlan,
      summary: validationResult.summary!,
      warnings: validationResult.warnings.map((w) => w.message),
      executionHistory: [],
      dependsOn: draft.dependsOn ?? [],
      dependencies: draft.dependencies ?? [],
      tags: draft.tags ?? [],
      notes: draft.notes,
      pinned: draft.pinned ?? false,
      parentId: draft.parentId,
      collapsed: false,
    };

    this.plans.set(plan.id, plan);
    this.emit({ type: "created", plan, timestamp: now });
    this.scheduleSave();

    return plan;
  }

  /**
   * Get a plan by ID
   */
  get(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  /**
   * Update a plan with partial changes
   */
  update(id: string, changes: Partial<Plan>): Plan {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    const updatedPlan: Plan = {
      ...plan,
      ...changes,
      id: plan.id, // Prevent ID changes
      createdAt: plan.createdAt, // Prevent creation date changes
      updatedAt: new Date(),
    };

    this.plans.set(id, updatedPlan);
    this.emit({
      type: "updated",
      plan: updatedPlan,
      changes,
      timestamp: new Date(),
    });
    this.scheduleSave();

    return updatedPlan;
  }

  /**
   * Delete a plan
   */
  delete(id: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      return;
    }

    this.plans.delete(id);
    this.emit({ type: "deleted", planId: id, timestamp: new Date() });
    this.scheduleSave();
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * List all plans with optional filters
   */
  list(filters?: PlanFilters): Plan[] {
    const allPlans = Array.from(this.plans.values());
    return this.applyFilters(allPlans, filters || DEFAULT_PLAN_FILTERS);
  }

  /**
   * Get the currently active plan (executing or paused)
   */
  getActive(): Plan | undefined {
    return Array.from(this.plans.values()).find(
      (p) => p.status === "executing" || p.status === "paused"
    );
  }

  /**
   * Get all pending plans
   */
  getPending(): Plan[] {
    return this.getByStatus("pending");
  }

  /**
   * Get all plans with a specific status
   */
  getByStatus(status: PlanStatus): Plan[] {
    return Array.from(this.plans.values()).filter((p) => p.status === status);
  }

  // ============================================================================
  // Lifecycle Operations
  // ============================================================================

  /**
   * Approve a pending plan for execution
   */
  approve(id: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== "pending" && plan.status !== "draft") {
      throw new Error(
        `Cannot approve plan with status: ${plan.status}. Plan must be pending or draft.`
      );
    }

    this.updateStatus(id, "approved");
  }

  /**
   * Start execution of an approved plan
   */
  startExecution(id: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    // Check dependencies
    const blockedBy = this.checkDependencies(plan);
    if (blockedBy.length > 0) {
      throw new Error(
        `Plan is blocked by dependencies: ${blockedBy.join(", ")}`
      );
    }

    // Check if another plan is executing
    const activePlan = this.getActive();
    if (activePlan && activePlan.id !== id) {
      throw new Error(
        `Another plan is already executing: ${activePlan.title}`
      );
    }

    const attemptId = nanoid();
    const attempt: ExecutionAttempt = {
      id: attemptId,
      startedAt: new Date(),
      status: "running",
      stepResults: [],
    };

    const executionState: ExecutionState = {
      attemptId,
      currentStepIndex: 0,
      totalSteps: plan.actionPlan.steps.length,
      startedAt: new Date(),
      stepResults: [],
    };

    const updatedPlan = {
      ...plan,
      status: "executing" as PlanStatus,
      executionState,
      executionHistory: [...plan.executionHistory, attempt],
      updatedAt: new Date(),
    };

    this.plans.set(id, updatedPlan);
    this.updateStatus(id, "executing");
    this.emit({
      type: "execution-started",
      planId: id,
      attemptId,
      timestamp: new Date(),
    });
    this.scheduleSave();
  }

  /**
   * Pause execution of a running plan
   */
  pause(id: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== "executing") {
      throw new Error(`Cannot pause plan with status: ${plan.status}`);
    }

    this.updateStatus(id, "paused");
  }

  /**
   * Resume execution of a paused plan
   */
  resume(id: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== "paused") {
      throw new Error(`Cannot resume plan with status: ${plan.status}`);
    }

    this.updateStatus(id, "executing");
  }

  /**
   * Cancel execution of a running or paused plan
   */
  cancel(id: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== "executing" && plan.status !== "paused") {
      throw new Error(`Cannot cancel plan with status: ${plan.status}`);
    }

    // Mark the current attempt as cancelled
    if (plan.executionState) {
      const attempt = plan.executionHistory.find(
        (a) => a.id === plan.executionState!.attemptId
      );
      if (attempt) {
        attempt.status = "cancelled";
        attempt.endedAt = new Date();
      }
    }

    const updatedPlan = {
      ...plan,
      executionState: undefined,
      executionHistory: [...plan.executionHistory],
    };

    this.plans.set(id, updatedPlan);
    this.updateStatus(id, "cancelled");
  }

  /**
   * Mark a plan as completed with results
   */
  complete(id: string, result: ExecutionResult): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== "executing") {
      throw new Error(`Cannot complete plan with status: ${plan.status}`);
    }

    // Update the current attempt
    if (plan.executionState) {
      const attempt = plan.executionHistory.find(
        (a) => a.id === plan.executionState!.attemptId
      );
      if (attempt) {
        attempt.status = "completed";
        attempt.endedAt = new Date();
        attempt.result = result;
      }
    }

    const updatedPlan = {
      ...plan,
      executionState: undefined,
      executionHistory: [...plan.executionHistory],
    };

    this.plans.set(id, updatedPlan);
    this.emit({
      type: "execution-completed",
      planId: id,
      attemptId: plan.executionState!.attemptId,
      result,
      timestamp: new Date(),
    });
    this.updateStatus(id, "completed");
  }

  /**
   * Mark a plan as failed with error message
   */
  fail(id: string, error: string): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    if (plan.status !== "executing") {
      throw new Error(`Cannot fail plan with status: ${plan.status}`);
    }

    // Update the current attempt
    if (plan.executionState) {
      const attempt = plan.executionHistory.find(
        (a) => a.id === plan.executionState!.attemptId
      );
      if (attempt) {
        attempt.status = "failed";
        attempt.endedAt = new Date();
        attempt.error = error;
      }
    }

    const updatedPlan = {
      ...plan,
      executionState: undefined,
      executionHistory: [...plan.executionHistory],
    };

    this.plans.set(id, updatedPlan);
    this.updateStatus(id, "failed");
  }

  /**
   * Update execution progress for a running plan
   */
  updateProgress(
    id: string,
    stepIndex: number,
    stepResult?: ExecutionResult
  ): void {
    const plan = this.plans.get(id);
    if (!plan || !plan.executionState) {
      return;
    }

    const updatedState: ExecutionState = {
      ...plan.executionState,
      currentStepIndex: stepIndex,
      stepResults: stepResult
        ? [...plan.executionState.stepResults, stepResult]
        : plan.executionState.stepResults,
    };

    // Also update the attempt's step results
    const attempt = plan.executionHistory.find(
      (a) => a.id === plan.executionState!.attemptId
    );
    if (attempt && stepResult) {
      attempt.stepResults = [...attempt.stepResults, stepResult];
    }

    const updatedPlan = {
      ...plan,
      executionState: updatedState,
      updatedAt: new Date(),
    };

    this.plans.set(id, updatedPlan);
    this.emit({
      type: "execution-progress",
      planId: id,
      attemptId: plan.executionState.attemptId,
      step: stepIndex,
      total: plan.executionState.totalSteps,
      stepResult,
      timestamp: new Date(),
    });
    this.scheduleSave();
  }

  // ============================================================================
  // Dependency Management
  // ============================================================================

  /**
   * Add a dependency between two plans
   */
  addDependency(
    planId: string,
    dependsOnId: string,
    type: DependencyType = "blocks"
  ): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const dependsOnPlan = this.plans.get(dependsOnId);
    if (!dependsOnPlan) {
      throw new Error(`Dependency plan not found: ${dependsOnId}`);
    }

    // Cannot depend on self
    if (planId === dependsOnId) {
      throw new Error("A plan cannot depend on itself");
    }

    // Check for cycles
    if (this.detectCycles(planId, dependsOnId)) {
      throw new Error(
        "Adding this dependency would create a circular dependency"
      );
    }

    const dependency: PlanDependency = {
      fromPlanId: planId,
      toPlanId: dependsOnId,
      type,
      createdAt: new Date(),
    };

    const dependencies = plan.dependencies || [];

    // Check if dependency already exists
    const existingIndex = dependencies.findIndex(
      (d) => d.fromPlanId === planId && d.toPlanId === dependsOnId
    );

    if (existingIndex >= 0) {
      // Update existing dependency
      dependencies[existingIndex] = dependency;
    } else {
      // Add new dependency
      dependencies.push(dependency);
    }

    // Update dependsOn array for blocking dependencies
    const dependsOn = [...plan.dependsOn];
    if (type === "blocks" && !dependsOn.includes(dependsOnId)) {
      dependsOn.push(dependsOnId);
    }

    this.update(planId, { dependencies, dependsOn });
  }

  /**
   * Remove a dependency between two plans
   */
  removeDependency(planId: string, dependsOnId: string): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const dependencies = (plan.dependencies || []).filter(
      (d) => !(d.fromPlanId === planId && d.toPlanId === dependsOnId)
    );

    const dependsOn = plan.dependsOn.filter((id) => id !== dependsOnId);

    this.update(planId, { dependencies, dependsOn });
  }

  /**
   * Get all plans that this plan depends on
   */
  getDependencies(planId: string): Plan[] {
    const plan = this.plans.get(planId);
    if (!plan) {
      return [];
    }

    return plan.dependsOn
      .map((id) => this.plans.get(id))
      .filter((p): p is Plan => p !== undefined);
  }

  /**
   * Get all plans that depend on this plan
   */
  getDependents(planId: string): Plan[] {
    return Array.from(this.plans.values()).filter((p) =>
      p.dependsOn.includes(planId)
    );
  }

  /**
   * Check if a plan can execute (all dependencies met)
   */
  canExecute(planId: string): CanExecuteResult {
    const plan = this.plans.get(planId);
    if (!plan) {
      return {
        canExecute: false,
        reason: "Plan not found",
      };
    }

    if (plan.dependsOn.length === 0) {
      return { canExecute: true };
    }

    const blockedBy: Plan[] = [];
    for (const depId of plan.dependsOn) {
      const dep = this.plans.get(depId);
      if (!dep) {
        blockedBy.push({
          id: depId,
          title: "Missing Plan",
          status: "cancelled",
        } as Plan);
      } else if (dep.status !== "completed") {
        blockedBy.push(dep);
      }
    }

    if (blockedBy.length > 0) {
      return {
        canExecute: false,
        blockedBy,
        reason: `Blocked by ${blockedBy.length} incomplete dependencies`,
      };
    }

    return { canExecute: true };
  }

  /**
   * Detect if adding a dependency would create a cycle
   */
  detectCycles(planId: string, dependsOnId: string): boolean {
    // BFS to check if dependsOnId already depends on planId (directly or indirectly)
    const visited = new Set<string>();
    const queue = [dependsOnId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      // If we reach planId, there's a cycle
      if (currentId === planId) {
        return true;
      }

      const current = this.plans.get(currentId);
      if (current) {
        queue.push(...current.dependsOn);
      }
    }

    return false;
  }

  /**
   * Get overlapping file paths between two plans
   */
  getFileOverlaps(planId1: string, planId2: string): string[] {
    const plan1 = this.plans.get(planId1);
    const plan2 = this.plans.get(planId2);

    if (!plan1 || !plan2) {
      return [];
    }

    const paths1 = this.extractFilePaths(plan1);
    const paths2 = this.extractFilePaths(plan2);

    return paths1.filter((p) => paths2.includes(p));
  }

  /**
   * Detect conflicts between plans
   */
  detectConflicts(planId: string): PlanConflict[] {
    const plan = this.plans.get(planId);
    if (!plan) {
      return [];
    }

    const conflicts: PlanConflict[] = [];
    const otherPlans = Array.from(this.plans.values()).filter(
      (p) =>
        p.id !== planId &&
        (p.status === "pending" ||
          p.status === "approved" ||
          p.status === "executing")
    );

    for (const other of otherPlans) {
      const overlaps = this.getFileOverlaps(planId, other.id);
      if (overlaps.length > 0) {
        // Determine severity based on risk levels
        const severity =
          plan.actionPlan.riskLevel === "writes" ||
          other.actionPlan.riskLevel === "writes"
            ? "error"
            : "warning";

        conflicts.push({
          planIds: [planId, other.id],
          conflictingPaths: overlaps,
          severity,
          description: `Plans "${plan.title}" and "${other.title}" both operate on ${overlaps.length} shared file(s)`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Get child plans (plans with this plan as parent)
   */
  getChildren(planId: string): Plan[] {
    return Array.from(this.plans.values()).filter(
      (p) => p.parentId === planId
    );
  }

  /**
   * Toggle collapsed state for a parent plan
   */
  toggleCollapsed(planId: string): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    this.update(planId, { collapsed: !plan.collapsed });
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to plan events
   * @returns Unsubscribe function
   */
  subscribe(callback: (event: PlanEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  private emit(event: PlanEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in plan event subscriber:", error);
      }
    });
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Load plans from disk
   */
  async load(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      const plansPath = `${this.dataPath}/plans.json`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(plansPath)) {
        const data = await adapter.read(plansPath);
        const planData = JSON.parse(data);

        this.plans = new Map(
          planData.map((plan: any) => [
            plan.id,
            this.deserializePlan(plan),
          ])
        );
      }
    } catch (error) {
      console.error("Failed to load plans:", error);
      // Continue with empty state
    }
  }

  /**
   * Save plans to disk (debounced)
   */
  async save(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      const plansPath = `${this.dataPath}/plans.json`;
      const adapter = this.app.vault.adapter;

      const data = Array.from(this.plans.values()).map((plan) =>
        this.serializePlan(plan)
      );
      await adapter.write(plansPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save plans:", error);
      throw error;
    }
  }

  /**
   * Schedule a debounced save
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save().catch((error) => {
        console.error("Debounced save failed:", error);
      });
    }, 500);
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.dataPath))) {
      await adapter.mkdir(this.dataPath);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Update plan status and emit status-changed event
   */
  private updateStatus(id: string, newStatus: PlanStatus): void {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }

    const oldStatus = plan.status;
    if (oldStatus === newStatus) {
      return;
    }

    const updatedPlan = {
      ...plan,
      status: newStatus,
      updatedAt: new Date(),
    };

    this.plans.set(id, updatedPlan);
    this.emit({
      type: "status-changed",
      planId: id,
      from: oldStatus,
      to: newStatus,
      timestamp: new Date(),
    });
    this.scheduleSave();
  }

  /**
   * Check if a plan's dependencies are satisfied
   * @returns Array of blocking plan IDs
   */
  private checkDependencies(plan: Plan): string[] {
    const blockedBy: string[] = [];

    for (const depId of plan.dependsOn) {
      const dep = this.plans.get(depId);
      if (!dep) {
        // Dependency doesn't exist - treat as blocking
        blockedBy.push(depId);
      } else if (dep.status !== "completed") {
        // Dependency exists but not completed
        blockedBy.push(depId);
      }
    }

    return blockedBy;
  }

  /**
   * Extract file paths from a plan's steps
   */
  private extractFilePaths(plan: Plan): string[] {
    const paths: string[] = [];

    for (const step of plan.actionPlan.steps) {
      // Extract paths from common arguments
      const args = step.args;

      if (args.path && typeof args.path === "string") {
        paths.push(args.path);
      }
      if (args.filePath && typeof args.filePath === "string") {
        paths.push(args.filePath);
      }
      if (args.folder && typeof args.folder === "string") {
        paths.push(args.folder);
      }
      if (args.oldPath && typeof args.oldPath === "string") {
        paths.push(args.oldPath);
      }
      if (args.newPath && typeof args.newPath === "string") {
        paths.push(args.newPath);
      }
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Apply filters to a list of plans
   */
  private applyFilters(plans: Plan[], filters: PlanFilters): Plan[] {
    let filtered = [...plans];

    // Filter by status
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((p) => filters.status!.includes(p.status));
    }

    // Filter by tags (plan must have all specified tags)
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((p) =>
        filters.tags!.every((tag) => p.tags.includes(tag))
      );
    }

    // Filter by search (matches title, goal, or notes)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.goal.toLowerCase().includes(searchLower) ||
          (p.notes && p.notes.toLowerCase().includes(searchLower))
      );
    }

    // Filter by date range
    if (filters.dateRange) {
      filtered = filtered.filter((p) => {
        const createdTime = p.createdAt.getTime();
        return (
          createdTime >= filters.dateRange!.from.getTime() &&
          createdTime <= filters.dateRange!.to.getTime()
        );
      });
    }

    // Filter by priority
    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter((p) => filters.priority!.includes(p.priority));
    }

    // Filter by pinned only
    if (filters.pinnedOnly) {
      filtered = filtered.filter((p) => p.pinned);
    }

    // Filter by parent ID
    if (filters.parentId !== undefined) {
      filtered = filtered.filter((p) => p.parentId === filters.parentId);
    }

    // Filter by has dependencies
    if (filters.hasDependencies !== undefined) {
      filtered = filtered.filter((p) =>
        filters.hasDependencies
          ? p.dependsOn.length > 0
          : p.dependsOn.length === 0
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (filters.sortBy) {
        case "createdAt":
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
          break;
        case "updatedAt":
          aVal = a.updatedAt.getTime();
          bVal = b.updatedAt.getTime();
          break;
        case "priority":
          aVal = a.priority;
          bVal = b.priority;
          break;
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  }

  /**
   * Serialize a plan for storage (convert dates to strings)
   */
  private serializePlan(plan: Plan): any {
    return {
      ...plan,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      dependencies: plan.dependencies?.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
      executionState: plan.executionState
        ? {
            ...plan.executionState,
            startedAt: plan.executionState.startedAt.toISOString(),
          }
        : undefined,
      executionHistory: plan.executionHistory.map((attempt) => ({
        ...attempt,
        startedAt: attempt.startedAt.toISOString(),
        endedAt: attempt.endedAt?.toISOString(),
      })),
    };
  }

  /**
   * Deserialize a plan from storage (convert strings to dates)
   */
  private deserializePlan(data: any): Plan {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      dependencies: data.dependencies?.map((d: any) => ({
        ...d,
        createdAt: new Date(d.createdAt),
      })),
      executionState: data.executionState
        ? {
            ...data.executionState,
            startedAt: new Date(data.executionState.startedAt),
          }
        : undefined,
      executionHistory: data.executionHistory.map((attempt: any) => ({
        ...attempt,
        startedAt: new Date(attempt.startedAt),
        endedAt: attempt.endedAt ? new Date(attempt.endedAt) : undefined,
      })),
    };
  }
}
