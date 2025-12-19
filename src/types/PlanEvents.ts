import { Plan, PlanStatus } from "./Plan";
import { ExecutionResult } from "./ActionPlan";

/**
 * Discriminated union of all plan-related events for reactive UI updates
 */
export type PlanEvent =
  | PlanCreatedEvent
  | PlanUpdatedEvent
  | PlanStatusChangedEvent
  | PlanExecutionStartedEvent
  | PlanExecutionProgressEvent
  | PlanExecutionCompletedEvent
  | PlanDeletedEvent;

/**
 * Emitted when a new plan is created
 */
export interface PlanCreatedEvent {
  type: "created";
  plan: Plan;
  timestamp: Date;
}

/**
 * Emitted when a plan is updated (any field changes except status)
 */
export interface PlanUpdatedEvent {
  type: "updated";
  plan: Plan;
  changes: Partial<Plan>;
  timestamp: Date;
}

/**
 * Emitted when a plan's status changes
 */
export interface PlanStatusChangedEvent {
  type: "status-changed";
  planId: string;
  from: PlanStatus;
  to: PlanStatus;
  timestamp: Date;
}

/**
 * Emitted when plan execution begins
 */
export interface PlanExecutionStartedEvent {
  type: "execution-started";
  planId: string;
  attemptId: string;
  timestamp: Date;
}

/**
 * Emitted during execution to track progress
 */
export interface PlanExecutionProgressEvent {
  type: "execution-progress";
  planId: string;
  attemptId: string;
  /** Current step index (0-based) */
  step: number;
  /** Total number of steps */
  total: number;
  /** Step result if step just completed */
  stepResult?: ExecutionResult;
  timestamp: Date;
}

/**
 * Emitted when plan execution finishes (success or failure)
 */
export interface PlanExecutionCompletedEvent {
  type: "execution-completed";
  planId: string;
  attemptId: string;
  result: ExecutionResult;
  timestamp: Date;
}

/**
 * Emitted when a plan is deleted
 */
export interface PlanDeletedEvent {
  type: "deleted";
  planId: string;
  timestamp: Date;
}

/**
 * Type guard to check if an event is a specific type
 */
export function isPlanEvent<T extends PlanEvent["type"]>(
  event: PlanEvent,
  type: T
): event is Extract<PlanEvent, { type: T }> {
  return event.type === type;
}
