import { PlanStatus } from "./Plan";

/**
 * Sorting field options for plan queries
 */
export type PlanSortField = "createdAt" | "updatedAt" | "priority" | "title" | "status";

/**
 * Sort direction
 */
export type SortOrder = "asc" | "desc";

/**
 * Filter criteria for querying plans
 */
export interface PlanFilters {
  /** Filter by status(es) */
  status?: PlanStatus[];

  /** Filter by tag(s) - plans must match all tags */
  tags?: string[];

  /** Search in title, goal, and notes */
  search?: string;

  /** Filter by creation date range */
  dateRange?: {
    from: Date;
    to: Date;
  };

  /** Filter by priority level(s) */
  priority?: number[];

  /** Field to sort by */
  sortBy: PlanSortField;

  /** Sort direction */
  sortOrder: SortOrder;

  /** Only show pinned plans */
  pinnedOnly?: boolean;

  /** Filter by parent plan ID (for sub-plans) */
  parentId?: string | null;

  /** Only show plans with dependencies */
  hasDependencies?: boolean;
}

/**
 * Default filter settings
 */
export const DEFAULT_PLAN_FILTERS: PlanFilters = {
  sortBy: "updatedAt",
  sortOrder: "desc",
};

/**
 * Preset filter configurations for common views
 */
export const PLAN_FILTER_PRESETS: Record<string, Partial<PlanFilters>> = {
  all: {
    sortBy: "updatedAt",
    sortOrder: "desc",
  },
  pending: {
    status: ["pending"],
    sortBy: "priority",
    sortOrder: "desc",
  },
  executing: {
    status: ["executing", "paused"],
    sortBy: "updatedAt",
    sortOrder: "desc",
  },
  completed: {
    status: ["completed"],
    sortBy: "updatedAt",
    sortOrder: "desc",
  },
  failed: {
    status: ["failed"],
    sortBy: "updatedAt",
    sortOrder: "desc",
  },
  pinned: {
    pinnedOnly: true,
    sortBy: "priority",
    sortOrder: "desc",
  },
};
