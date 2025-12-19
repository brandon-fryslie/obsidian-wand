<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Plan } from "../types/Plan";
  import { isToday } from "../utils/timeFormatting";

  export let plans: Plan[] = [];

  const dispatch = createEventDispatcher();

  // Calculate today's plans
  $: todayPlans = plans.filter(
    (p) => isToday(p.createdAt) || (p.updatedAt && isToday(p.updatedAt))
  );

  // Count by status for today
  $: todayCompleted = todayPlans.filter((p) => p.status === "completed").length;
  $: todayPending = todayPlans.filter((p) => p.status === "pending").length;
  $: todayExecuting = todayPlans.filter((p) => p.status === "executing").length;
  $: todayFailed = todayPlans.filter((p) => p.status === "failed").length;

  // Overall counts
  $: allCompleted = plans.filter((p) => p.status === "completed").length;
  $: allPending = plans.filter((p) => p.status === "pending").length;
  $: allExecuting = plans.filter((p) => p.status === "executing").length;
  $: allFailed = plans.filter((p) => p.status === "failed").length;

  // Calculate progress percentage for today
  $: totalToday = todayPlans.length;
  $: progressPercent =
    totalToday > 0 ? Math.round((todayCompleted / totalToday) * 100) : 0;

  function handleStatusClick(status: string) {
    dispatch("filterByStatus", { status });
  }
</script>

<div class="progress-dashboard">
  <!-- Today's Progress -->
  <div class="dashboard-section">
    <h3 class="section-title">Today's Progress</h3>

    {#if totalToday === 0}
      <div class="empty-state">No plans created or updated today</div>
    {:else}
      <!-- Progress Bar -->
      <div class="progress-bar-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {progressPercent}%"
            title="{todayCompleted}/{totalToday} plans completed"
          />
        </div>
        <div class="progress-label">
          {todayCompleted}/{totalToday} plans done ({progressPercent}%)
        </div>
      </div>

      <!-- Status Counts -->
      <div class="status-counts">
        <button
          class="status-count completed"
          on:click={() => handleStatusClick("completed")}
          title="View completed plans"
        >
          <span class="status-icon">✓</span>
          <span class="status-number">{todayCompleted}</span>
          <span class="status-label">completed</span>
        </button>

        <button
          class="status-count pending"
          on:click={() => handleStatusClick("pending")}
          title="View pending plans"
        >
          <span class="status-icon">●</span>
          <span class="status-number">{todayPending}</span>
          <span class="status-label">pending</span>
        </button>

        <button
          class="status-count executing"
          on:click={() => handleStatusClick("executing")}
          title="View executing plans"
        >
          <span class="status-icon">◐</span>
          <span class="status-number">{todayExecuting}</span>
          <span class="status-label">executing</span>
        </button>

        <button
          class="status-count failed"
          on:click={() => handleStatusClick("failed")}
          title="View failed plans"
        >
          <span class="status-icon">✗</span>
          <span class="status-number">{todayFailed}</span>
          <span class="status-label">failed</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Overall Stats -->
  <div class="dashboard-section">
    <h3 class="section-title">All Time</h3>

    <div class="overall-stats">
      <div class="stat-item">
        <div class="stat-value">{allCompleted}</div>
        <div class="stat-label">Completed</div>
      </div>

      <div class="stat-item">
        <div class="stat-value">{allPending}</div>
        <div class="stat-label">Pending</div>
      </div>

      <div class="stat-item">
        <div class="stat-value">{allExecuting}</div>
        <div class="stat-label">Executing</div>
      </div>

      <div class="stat-item">
        <div class="stat-value">{allFailed}</div>
        <div class="stat-label">Failed</div>
      </div>
    </div>
  </div>
</div>

<style>
  .progress-dashboard {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .dashboard-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  /* Progress Bar */
  .progress-bar-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-bar {
    height: 24px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  /* Status Counts */
  .status-counts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .status-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .status-count:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .status-icon {
    font-size: 16px;
  }

  .status-count.completed .status-icon {
    color: var(--text-success);
  }

  .status-count.pending .status-icon {
    color: var(--text-accent);
  }

  .status-count.executing .status-icon {
    color: var(--text-warning);
  }

  .status-count.failed .status-icon {
    color: var(--text-error);
  }

  .status-number {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .status-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  /* Overall Stats */
  .overall-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
