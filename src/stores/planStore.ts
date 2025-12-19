import { writable, derived, type Readable } from "svelte/store";
import { Plan, PlanStatus } from "../types/Plan";
import { PlanFilters, DEFAULT_PLAN_FILTERS } from "../types/PlanFilters";
import { PlanEvent } from "../types/PlanEvents";

/**
 * All plans in the store
 */
export const plans = writable<Plan[]>([]);

/**
 * ID of the currently active/selected plan
 */
export const activePlanId = writable<string | null>(null);

/**
 * Current filter settings
 */
export const filters = writable<PlanFilters>(DEFAULT_PLAN_FILTERS);

/**
 * Filtered and sorted plans based on current filters
 */
export const filteredPlans: Readable<Plan[]> = derived(
  [plans, filters],
  ([$plans, $filters]) => {
    return applyFilters($plans, $filters);
  }
);

/**
 * Currently active/selected plan
 */
export const activePlan: Readable<Plan | undefined> = derived(
  [plans, activePlanId],
  ([$plans, $activePlanId]) => {
    if (!$activePlanId) {
      return undefined;
    }
    return $plans.find((p) => p.id === $activePlanId);
  }
);

/**
 * Count of pending plans
 */
export const pendingCount: Readable<number> = derived(plans, ($plans) => {
  return $plans.filter((p) => p.status === "pending").length;
});

/**
 * Currently executing plan (if any)
 */
export const executingPlan: Readable<Plan | undefined> = derived(
  plans,
  ($plans) => {
    return $plans.find((p) => p.status === "executing");
  }
);

/**
 * Count by status
 */
export const statusCounts: Readable<Record<PlanStatus, number>> = derived(
  plans,
  ($plans) => {
    const counts: Record<PlanStatus, number> = {
      draft: 0,
      pending: 0,
      approved: 0,
      executing: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    $plans.forEach((p) => {
      counts[p.status]++;
    });

    return counts;
  }
);

/**
 * Pinned plans
 */
export const pinnedPlans: Readable<Plan[]> = derived(plans, ($plans) => {
  return $plans
    .filter((p) => p.pinned)
    .sort((a, b) => b.priority - a.priority);
});

/**
 * Plans grouped by parent
 */
export const plansByParent: Readable<Map<string | null, Plan[]>> = derived(
  plans,
  ($plans) => {
    const groups = new Map<string | null, Plan[]>();

    $plans.forEach((p) => {
      const parentId = p.parentId ?? null;
      if (!groups.has(parentId)) {
        groups.set(parentId, []);
      }
      groups.get(parentId)!.push(p);
    });

    return groups;
  }
);

/**
 * Recent events (for activity log)
 */
export const recentEvents = writable<PlanEvent[]>([]);

/**
 * Add an event to the recent events list (max 100)
 */
export function addEvent(event: PlanEvent): void {
  recentEvents.update((events) => {
    const newEvents = [event, ...events];
    return newEvents.slice(0, 100);
  });
}

/**
 * Clear recent events
 */
export function clearEvents(): void {
  recentEvents.set([]);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply filters to a list of plans
 */
function applyFilters(planList: Plan[], filterConfig: PlanFilters): Plan[] {
  let filtered = [...planList];

  // Filter by status
  if (filterConfig.status && filterConfig.status.length > 0) {
    filtered = filtered.filter((p) =>
      filterConfig.status!.includes(p.status)
    );
  }

  // Filter by tags (plan must have all specified tags)
  if (filterConfig.tags && filterConfig.tags.length > 0) {
    filtered = filtered.filter((p) =>
      filterConfig.tags!.every((tag) => p.tags.includes(tag))
    );
  }

  // Filter by search (matches title, goal, or notes)
  if (filterConfig.search) {
    const searchLower = filterConfig.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        p.goal.toLowerCase().includes(searchLower) ||
        (p.notes && p.notes.toLowerCase().includes(searchLower))
    );
  }

  // Filter by date range
  if (filterConfig.dateRange) {
    filtered = filtered.filter((p) => {
      const createdTime = p.createdAt.getTime();
      return (
        createdTime >= filterConfig.dateRange!.from.getTime() &&
        createdTime <= filterConfig.dateRange!.to.getTime()
      );
    });
  }

  // Filter by priority
  if (filterConfig.priority && filterConfig.priority.length > 0) {
    filtered = filtered.filter((p) =>
      filterConfig.priority!.includes(p.priority)
    );
  }

  // Filter by pinned only
  if (filterConfig.pinnedOnly) {
    filtered = filtered.filter((p) => p.pinned);
  }

  // Filter by parent ID
  if (filterConfig.parentId !== undefined) {
    filtered = filtered.filter((p) => p.parentId === filterConfig.parentId);
  }

  // Filter by has dependencies
  if (filterConfig.hasDependencies !== undefined) {
    filtered = filtered.filter((p) =>
      filterConfig.hasDependencies
        ? p.dependsOn.length > 0
        : p.dependsOn.length === 0
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (filterConfig.sortBy) {
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

    if (filterConfig.sortOrder === "asc") {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  return filtered;
}
