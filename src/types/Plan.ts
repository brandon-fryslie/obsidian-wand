import { ActionPlan, ExecutionResult } from "./ActionPlan";
import { PlanSummary } from "../services/PlanValidator";

/**
 * Plan lifecycle status
 */
export type PlanStatus =
  | "draft" // Just created, not yet validated
  | "pending" // Validated, awaiting approval
  | "approved" // User approved, ready to execute
  | "executing" // Currently running
  | "paused" // Execution paused (can resume)
  | "completed" // Successfully finished
  | "failed" // Execution failed
  | "cancelled"; // User cancelled

/**
 * Type of dependency relationship between plans
 */
export type DependencyType =
  | "blocks" // Hard blocker - must complete first
  | "related" // Soft link - for reference
  | "parent-child"; // Hierarchical grouping

/**
 * Dependency relationship between two plans
 */
export interface PlanDependency {
  /** ID of the plan that depends on another */
  fromPlanId: string;
  /** ID of the plan being depended upon */
  toPlanId: string;
  /** Type of dependency relationship */
  type: DependencyType;
  /** When the dependency was created */
  createdAt: Date;
}

/**
 * Result of checking if a plan can execute
 */
export interface CanExecuteResult {
  /** Whether the plan can execute */
  canExecute: boolean;
  /** Plans blocking execution (if any) */
  blockedBy?: Plan[];
  /** Reason execution is blocked */
  reason?: string;
}

/**
 * Detected conflict between plans
 */
export interface PlanConflict {
  /** IDs of conflicting plans */
  planIds: [string, string];
  /** File paths that conflict */
  conflictingPaths: string[];
  /** Severity of conflict */
  severity: "warning" | "error";
  /** Description of the conflict */
  description: string;
}

/**
 * Current execution state for a running or paused plan
 */
export interface ExecutionState {
  /** ID of the current execution attempt */
  attemptId: string;
  /** Index of the current step being executed */
  currentStepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Timestamp when execution started */
  startedAt: Date;
  /** Results from completed steps in this execution */
  stepResults: ExecutionResult[];
}

/**
 * Record of a single execution attempt
 */
export interface ExecutionAttempt {
  /** Unique ID for this attempt */
  id: string;
  /** When execution started */
  startedAt: Date;
  /** When execution ended (undefined if still running) */
  endedAt?: Date;
  /** Current status of this attempt */
  status: "running" | "completed" | "failed" | "cancelled";
  /** Final result if completed */
  result?: ExecutionResult;
  /** Error message if failed */
  error?: string;
  /** Step-by-step results */
  stepResults: ExecutionResult[];
}

/**
 * Complete plan entity with metadata, lifecycle state, and execution history
 */
export interface Plan {
  // Core identity
  /** Unique identifier */
  id: string;
  /** Short descriptive title */
  title: string;
  /** Full goal statement */
  goal: string;
  /** Current lifecycle status */
  status: PlanStatus;
  /** Priority level (1-5, higher = more urgent) */
  priority: number;
  /** When plan was created */
  createdAt: Date;
  /** When plan was last modified */
  updatedAt: Date;

  // Plan content
  /** The action plan with steps to execute */
  actionPlan: ActionPlan;
  /** Summary of plan operations and impact */
  summary: PlanSummary;
  /** Validation warnings */
  warnings: string[];

  // Execution state
  /** Current execution state (only present when status is 'executing' or 'paused') */
  executionState?: ExecutionState;
  /** History of all execution attempts */
  executionHistory: ExecutionAttempt[];

  // Relationships
  /** Parent plan ID for sub-plans */
  parentId?: string;
  /** Plan IDs that must complete before this one can execute (blocking dependencies) */
  dependsOn: string[];
  /** Dependencies with type information */
  dependencies?: PlanDependency[];
  /** User-defined tags for organization */
  tags: string[];

  // User annotations
  /** User notes about the plan */
  notes?: string;
  /** Whether plan is pinned to top of list */
  pinned: boolean;
  /** Whether plan is collapsed in list view (for parent plans) */
  collapsed?: boolean;
}

/**
 * Draft plan for creation (before full validation and ID assignment)
 */
export interface PlanDraft {
  title: string;
  goal: string;
  actionPlan: ActionPlan;
  priority?: number;
  tags?: string[];
  notes?: string;
  pinned?: boolean;
  parentId?: string;
  dependsOn?: string[];
  dependencies?: PlanDependency[];
}
