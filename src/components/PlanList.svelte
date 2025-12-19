<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Plan } from "../types/Plan";
  import PlanCard from "./PlanCard.svelte";

  export let plans: Plan[];
  export let selectedId: string | null = null;
  export let planStore: any = null; // PlanStore instance for collapsing

  const dispatch = createEventDispatcher();

  let selectedIndex = -1;

  // Build hierarchical plan list
  interface PlanWithDepth {
    plan: Plan;
    depth: number;
    children: Plan[];
    hasChildren: boolean;
  }

  // Get hierarchy
  $: plansWithHierarchy = buildHierarchy(plans);

  function buildHierarchy(allPlans: Plan[]): PlanWithDepth[] {
    const result: PlanWithDepth[] = [];
    const childMap = new Map<string, Plan[]>();

    // Group children by parent
    allPlans.forEach((plan) => {
      if (plan.parentId) {
        if (!childMap.has(plan.parentId)) {
          childMap.set(plan.parentId, []);
        }
        childMap.get(plan.parentId)!.push(plan);
      }
    });

    // Add top-level plans and their children recursively
    const topLevel = allPlans.filter((p) => !p.parentId);

    function addPlanWithChildren(
      plan: Plan,
      depth: number
    ): void {
      const children = childMap.get(plan.id) || [];
      result.push({
        plan,
        depth,
        children,
        hasChildren: children.length > 0,
      });

      // Add children if not collapsed
      if (!plan.collapsed && children.length > 0) {
        children.forEach((child) => addPlanWithChildren(child, depth + 1));
      }
    }

    topLevel.forEach((plan) => addPlanWithChildren(plan, 0));

    return result;
  }

  // Update selected index when selectedId changes
  $: {
    if (selectedId) {
      selectedIndex = plansWithHierarchy.findIndex((p) => p.plan.id === selectedId);
    } else {
      selectedIndex = -1;
    }
  }

  function handleSelect(plan: Plan) {
    dispatch("select", { plan });
  }

  function handleDoubleClick(plan: Plan) {
    dispatch("action", { action: "open", plan });
  }

  function handleToggleCollapse(plan: Plan) {
    dispatch("action", { action: "toggleCollapse", plan });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (plansWithHierarchy.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const newIndex = Math.min(selectedIndex + 1, plansWithHierarchy.length - 1);
      if (newIndex >= 0 && newIndex < plansWithHierarchy.length) {
        dispatch("select", { plan: plansWithHierarchy[newIndex].plan });
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const newIndex = Math.max(selectedIndex - 1, 0);
      if (newIndex >= 0 && newIndex < plansWithHierarchy.length) {
        dispatch("select", { plan: plansWithHierarchy[newIndex].plan });
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < plansWithHierarchy.length) {
        dispatch("action", {
          action: "open",
          plan: plansWithHierarchy[selectedIndex].plan,
        });
      }
    } else if (event.key === "ArrowRight") {
      // Expand if collapsed and has children
      event.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < plansWithHierarchy.length) {
        const item = plansWithHierarchy[selectedIndex];
        if (item.hasChildren && item.plan.collapsed) {
          handleToggleCollapse(item.plan);
        }
      }
    } else if (event.key === "ArrowLeft") {
      // Collapse if expanded and has children
      event.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < plansWithHierarchy.length) {
        const item = plansWithHierarchy[selectedIndex];
        if (item.hasChildren && !item.plan.collapsed) {
          handleToggleCollapse(item.plan);
        }
      }
    }
  }
</script>

<div class="plan-list" on:keydown={handleKeydown} tabindex="0">
  {#if plans.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No plans found</div>
      <div class="empty-subtitle">
        Create a new plan or adjust your filters
      </div>
    </div>
  {:else}
    {#each plansWithHierarchy as item (item.plan.id)}
      <div
        class="plan-wrapper"
        style="margin-left: {item.depth * 20}px"
      >
        {#if item.hasChildren}
          <button
            class="collapse-toggle"
            on:click={() => handleToggleCollapse(item.plan)}
            title={item.plan.collapsed ? "Expand" : "Collapse"}
          >
            {item.plan.collapsed ? "▶" : "▼"}
          </button>
        {:else}
          <div class="collapse-spacer"></div>
        {/if}
        <div class="plan-card-container">
          <PlanCard
            plan={item.plan}
            selected={item.plan.id === selectedId}
            on:select={() => handleSelect(item.plan)}
            on:dblclick={() => handleDoubleClick(item.plan)}
          />
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .plan-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    outline: none;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    height: 100%;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
  }

  .empty-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .empty-subtitle {
    font-size: 12px;
    color: var(--text-muted);
  }

  .plan-wrapper {
    display: flex;
    align-items: start;
    gap: 6px;
  }

  .collapse-toggle {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 8px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 10px;
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .collapse-toggle:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    border-radius: 2px;
  }

  .collapse-spacer {
    width: 16px;
    flex-shrink: 0;
  }

  .plan-card-container {
    flex: 1;
    min-width: 0;
  }
</style>
