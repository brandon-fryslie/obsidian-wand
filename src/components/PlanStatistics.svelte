<script lang="ts">
  import type { Plan } from "../types/Plan";
  import { formatDuration, startOfDay } from "../utils/timeFormatting";

  export let plans: Plan[] = [];

  // Calculate completion rate for last 7 days
  $: sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  $: recentPlans = plans.filter((p) => p.createdAt >= sevenDaysAgo);
  $: recentCompleted = recentPlans.filter(
    (p) => p.status === "completed"
  ).length;
  $: completionRate =
    recentPlans.length > 0
      ? Math.round((recentCompleted / recentPlans.length) * 100)
      : 0;

  // Calculate average execution time for completed plans
  $: completedPlans = plans.filter((p) => p.status === "completed");
  $: averageExecutionTime = calculateAverageExecutionTime(completedPlans);

  // Find most used tools
  $: mostUsedTools = calculateMostUsedTools(completedPlans);

  // Plans per day for the last 7 days
  $: plansPerDay = calculatePlansPerDay(plans);

  function calculateAverageExecutionTime(
    completedPlans: Plan[]
  ): number | null {
    if (completedPlans.length === 0) return null;

    const totalDuration = completedPlans.reduce((sum, plan) => {
      // Find the completed execution attempt
      const completedAttempt = plan.executionHistory.find(
        (a) => a.status === "completed"
      );
      if (completedAttempt && completedAttempt.endedAt) {
        const duration =
          completedAttempt.endedAt.getTime() -
          completedAttempt.startedAt.getTime();
        return sum + duration;
      }
      return sum;
    }, 0);

    return Math.round(totalDuration / completedPlans.length);
  }

  function calculateMostUsedTools(
    completedPlans: Plan[]
  ): Array<{ tool: string; count: number }> {
    const toolCounts = new Map<string, number>();

    completedPlans.forEach((plan) => {
      plan.actionPlan.steps.forEach((step) => {
        const count = toolCounts.get(step.tool) || 0;
        toolCounts.set(step.tool, count + 1);
      });
    });

    return Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 tools
  }

  function calculatePlansPerDay(
    plans: Plan[]
  ): Array<{ date: string; count: number }> {
    const counts = new Map<string, number>();

    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
      counts.set(dateKey, 0);
    }

    // Count plans created each day
    plans.forEach((plan) => {
      const dateKey = plan.createdAt.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
      if (counts.has(dateKey)) {
        counts.set(dateKey, counts.get(dateKey)! + 1);
      }
    });

    return Array.from(counts.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  // Calculate max for bar chart scaling
  $: maxPlansPerDay = Math.max(...plansPerDay.map((d) => d.count), 1);
</script>

<div class="plan-statistics">
  <!-- Completion Rate -->
  <div class="stat-section">
    <h3 class="stat-title">Completion Rate (Last 7 Days)</h3>
    <div class="completion-rate">
      <div class="rate-circle" data-rate={completionRate}>
        <svg viewBox="0 0 36 36" class="circular-chart">
          <path
            class="circle-bg"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            class="circle"
            stroke-dasharray="{completionRate}, 100"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div class="rate-value">{completionRate}%</div>
      </div>
      <div class="rate-info">
        {recentCompleted} of {recentPlans.length} completed
      </div>
    </div>
  </div>

  <!-- Average Execution Time -->
  <div class="stat-section">
    <h3 class="stat-title">Average Execution Time</h3>
    <div class="stat-value-large">
      {#if averageExecutionTime !== null}
        {formatDuration(averageExecutionTime)}
      {:else}
        <span class="stat-empty">No data</span>
      {/if}
    </div>
    <div class="stat-info">Based on {completedPlans.length} completed plans</div>
  </div>

  <!-- Most Used Tools -->
  <div class="stat-section">
    <h3 class="stat-title">Most Used Tools</h3>
    {#if mostUsedTools.length === 0}
      <div class="stat-empty">No data</div>
    {:else}
      <div class="tool-list">
        {#each mostUsedTools as { tool, count }}
          <div class="tool-item">
            <span class="tool-name">{tool}</span>
            <span class="tool-count">{count}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Plans Per Day -->
  <div class="stat-section">
    <h3 class="stat-title">Plans Per Day (Last 7 Days)</h3>
    <div class="bar-chart">
      {#each plansPerDay as { date, count }}
        <div class="bar-item">
          <div class="bar-label">{date}</div>
          <div class="bar-container">
            <div
              class="bar-fill"
              style="height: {(count / maxPlansPerDay) * 100}%"
              title="{count} plans"
            />
          </div>
          <div class="bar-count">{count}</div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .plan-statistics {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    overflow-y: auto;
  }

  .stat-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stat-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  .stat-empty {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
  }

  /* Completion Rate */
  .completion-rate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .rate-circle {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .circular-chart {
    width: 100%;
    height: 100%;
  }

  .circle-bg {
    fill: none;
    stroke: var(--background-modifier-border);
    stroke-width: 2.8;
  }

  .circle {
    fill: none;
    stroke: var(--interactive-accent);
    stroke-width: 2.8;
    stroke-linecap: round;
    animation: progress 1s ease-out forwards;
  }

  @keyframes progress {
    0% {
      stroke-dasharray: 0 100;
    }
  }

  .rate-value {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .rate-info {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Average Execution Time */
  .stat-value-large {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-normal);
    text-align: center;
  }

  .stat-info {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }

  /* Most Used Tools */
  .tool-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tool-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
  }

  .tool-name {
    font-size: 12px;
    color: var(--text-normal);
    font-family: var(--font-monospace);
  }

  .tool-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  /* Bar Chart */
  .bar-chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 4px;
    height: 100px;
    padding: 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
  }

  .bar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  .bar-label {
    font-size: 9px;
    color: var(--text-muted);
    writing-mode: horizontal-tb;
    text-align: center;
    min-height: 20px;
  }

  .bar-container {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
  }

  .bar-fill {
    width: 100%;
    background: var(--interactive-accent);
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
  }

  .bar-count {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-normal);
    min-height: 16px;
  }
</style>
