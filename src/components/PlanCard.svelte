<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Plan } from "../types/Plan";

  export let plan: Plan;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher();

  // Status indicator mapping
  function getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      draft: "○",
      pending: "●",
      approved: "◉",
      executing: "◐",
      paused: "⏸",
      completed: "✓",
      failed: "✗",
      cancelled: "⊗",
    };
    return icons[status] || "○";
  }

  // Format relative time
  function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
    return `${Math.floor(diffDay / 30)}mo ago`;
  }

  // Get step count
  $: stepCount = plan.actionPlan.steps.length;

  // Get risk level
  $: riskLevel = plan.actionPlan.riskLevel;

  // Calculate progress if executing
  $: progress = plan.executionState
    ? (plan.executionState.currentStepIndex / plan.executionState.totalSteps) * 100
    : 0;

  // Relative timestamp
  $: relativeTime = getRelativeTime(plan.updatedAt);

  function handleClick() {
    dispatch("select");
  }

  function handleDoubleClick() {
    dispatch("dblclick");
  }
</script>

<button
  class="plan-card"
  class:selected
  on:click={handleClick}
  on:dblclick={handleDoubleClick}
>
  <div class="card-header">
    <span
      class="status-icon"
      class:status-gray={plan.status === "draft" || plan.status === "cancelled"}
      class:status-orange={plan.status === "pending"}
      class:status-blue={plan.status === "approved" || plan.status === "executing"}
      class:status-yellow={plan.status === "paused"}
      class:status-green={plan.status === "completed"}
      class:status-red={plan.status === "failed"}
    >
      {getStatusIcon(plan.status)}
    </span>
    <span class="title" title={plan.title}>
      {#if plan.pinned}
        <span class="pin-icon">📌</span>
      {/if}
      {plan.title}
    </span>
    <span class="priority-badge">P{plan.priority}</span>
  </div>

  <div class="card-meta">
    <span class="step-count">{stepCount} steps</span>
    <span class="separator">|</span>
    <span class="risk-level" class:writes={riskLevel === "writes"} class:commands={riskLevel === "commands"}>
      {riskLevel}
    </span>
    <span class="separator">|</span>
    <span class="timestamp">{relativeTime}</span>
  </div>

  {#if plan.status === "executing" && plan.executionState}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {progress}%"></div>
    </div>
    <div class="progress-text">
      {plan.executionState.currentStepIndex}/{plan.executionState.totalSteps} - {Math.round(progress)}%
    </div>
  {/if}
</button>

<style>
  .plan-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 0.15s ease;
  }

  .plan-card:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .plan-card.selected {
    background: var(--background-modifier-active-hover);
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px var(--interactive-accent);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-icon {
    font-size: 14px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    color: var(--text-muted);
  }

  .status-icon.status-green {
    color: var(--color-green);
  }

  .status-icon.status-orange {
    color: var(--color-orange);
  }

  .status-icon.status-red {
    color: var(--color-red);
  }

  .status-icon.status-blue {
    color: var(--interactive-accent);
  }

  .status-icon.status-yellow {
    color: #fbbf24;
  }

  .status-icon.status-gray {
    color: var(--text-muted);
  }

  .pin-icon {
    font-size: 10px;
    margin-right: 2px;
  }

  .title {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-normal);
    font-size: 13px;
    font-weight: 500;
  }

  .priority-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    padding-left: 24px;
  }

  .separator {
    color: var(--background-modifier-border);
  }

  .risk-level {
    font-weight: 500;
  }

  .risk-level.writes {
    color: var(--color-orange);
  }

  .risk-level.commands {
    color: var(--color-red);
  }

  .progress-bar {
    height: 4px;
    background: var(--background-modifier-border);
    border-radius: 2px;
    overflow: hidden;
    margin-left: 24px;
  }

  .progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 10px;
    color: var(--text-faint);
    padding-left: 24px;
  }
</style>
