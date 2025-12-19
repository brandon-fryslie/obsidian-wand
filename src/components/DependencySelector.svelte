<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Plan, DependencyType } from "../types/Plan";

  export let plan: Plan;
  export let availablePlans: Plan[];
  export let onDetectCycle: (planId: string, dependsOnId: string) => boolean;

  const dispatch = createEventDispatcher();

  let searchQuery = "";
  let selectedPlanId: string | null = null;
  let selectedType: DependencyType = "blocks";

  // Filter available plans (exclude self and current dependencies)
  $: filteredPlans = availablePlans.filter((p) => {
    if (p.id === plan.id) return false;
    if (plan.dependsOn.includes(p.id)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(query) ||
        p.goal.toLowerCase().includes(query)
      );
    }
    return true;
  });

  $: cycleWarning =
    selectedPlanId && onDetectCycle
      ? onDetectCycle(plan.id, selectedPlanId)
      : false;

  $: canAdd = selectedPlanId && !cycleWarning;

  function handleAdd() {
    if (!canAdd || !selectedPlanId) return;

    dispatch("add", {
      dependsOnId: selectedPlanId,
      type: selectedType,
    });

    // Reset
    selectedPlanId = null;
    searchQuery = "";
  }

  function handleCancel() {
    dispatch("cancel");
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case "draft":
        return "○";
      case "pending":
        return "●";
      case "approved":
        return "◉";
      case "executing":
        return "◐";
      case "paused":
        return "⏸";
      case "completed":
        return "✓";
      case "failed":
        return "✗";
      case "cancelled":
        return "⊗";
      default:
        return "○";
    }
  }
</script>

<div class="dependency-selector">
  <div class="header">
    <h3>Add Dependency</h3>
    <p class="subtitle">
      Select a plan that "{plan.title}" depends on
    </p>
  </div>

  <div class="search-section">
    <input
      type="text"
      class="search-input"
      placeholder="Search plans..."
      bind:value={searchQuery}
    />
  </div>

  <div class="plans-list">
    {#if filteredPlans.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          No plans match your search
        {:else}
          No available plans to add as dependencies
        {/if}
      </div>
    {:else}
      {#each filteredPlans as availablePlan (availablePlan.id)}
        <label class="plan-option">
          <input
            type="radio"
            name="dependency-plan"
            value={availablePlan.id}
            bind:group={selectedPlanId}
          />
          <div class="plan-info">
            <div class="plan-header">
              <span class="status-icon">{getStatusIcon(availablePlan.status)}</span>
              <span class="plan-title">{availablePlan.title}</span>
              <span class="plan-status">{availablePlan.status}</span>
            </div>
            {#if availablePlan.goal}
              <div class="plan-goal">{availablePlan.goal}</div>
            {/if}
          </div>
        </label>
      {/each}
    {/if}
  </div>

  <div class="type-section">
    <div class="section-header">Dependency Type</div>
    <label class="type-option">
      <input
        type="radio"
        name="dependency-type"
        value="blocks"
        bind:group={selectedType}
      />
      <div class="type-info">
        <div class="type-name">Blocks (must complete first)</div>
        <div class="type-description">
          Hard blocker - this plan cannot execute until the dependency is completed
        </div>
      </div>
    </label>
    <label class="type-option">
      <input
        type="radio"
        name="dependency-type"
        value="related"
        bind:group={selectedType}
      />
      <div class="type-info">
        <div class="type-name">Related (soft link)</div>
        <div class="type-description">
          Informational link - for reference only, doesn't block execution
        </div>
      </div>
    </label>
    <label class="type-option">
      <input
        type="radio"
        name="dependency-type"
        value="parent-child"
        bind:group={selectedType}
      />
      <div class="type-info">
        <div class="type-name">Parent-child (grouping)</div>
        <div class="type-description">
          Hierarchical grouping - organizes plans together
        </div>
      </div>
    </label>
  </div>

  {#if cycleWarning}
    <div class="warning-banner">
      <span class="warning-icon">⚠</span>
      Adding this dependency would create a circular dependency
    </div>
  {/if}

  <div class="actions">
    <button class="cancel-btn" on:click={handleCancel}>Cancel</button>
    <button class="add-btn" disabled={!canAdd} on:click={handleAdd}>
      Add Dependency
    </button>
  </div>
</div>

<style>
  .dependency-selector {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--background-primary);
    border-radius: 8px;
    max-height: 600px;
  }

  .header h3 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search-input {
    padding: 8px 12px;
    font-size: 13px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    outline: none;
  }

  .search-input:focus {
    border-color: var(--interactive-accent);
  }

  .plans-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    padding: 4px;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .plan-option {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .plan-option:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .plan-option input[type="radio"] {
    margin-top: 2px;
    cursor: pointer;
  }

  .plan-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .plan-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-icon {
    font-size: 12px;
    color: var(--text-muted);
  }

  .plan-title {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .plan-status {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--background-modifier-border);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .plan-goal {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .type-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .type-option {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .type-option:hover {
    background: var(--background-modifier-hover);
  }

  .type-option input[type="radio"] {
    margin-top: 2px;
    cursor: pointer;
  }

  .type-info {
    flex: 1;
  }

  .type-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 2px;
  }

  .type-description {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .warning-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid var(--color-orange);
    border-radius: 6px;
    color: var(--color-orange);
    font-size: 12px;
  }

  .warning-icon {
    font-size: 16px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .cancel-btn,
  .add-btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .cancel-btn:hover {
    background: var(--background-modifier-active-hover);
  }

  .add-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .add-btn:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
