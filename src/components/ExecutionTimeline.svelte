<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ExecutionAttempt } from "../types/Plan";

  export let attempts: ExecutionAttempt[];

  const dispatch = createEventDispatcher();

  let expandedAttemptId: string | null = null;

  function toggleAttempt(attemptId: string) {
    expandedAttemptId = expandedAttemptId === attemptId ? null : attemptId;
  }

  function handleSelectAttempt(attempt: ExecutionAttempt) {
    dispatch("select", { attempt });
  }

  // Format timestamp
  function formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  // Calculate duration
  function getDuration(attempt: ExecutionAttempt): string {
    if (!attempt.endedAt) return "In progress...";

    const durationMs = attempt.endedAt.getTime() - attempt.startedAt.getTime();
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  }

  // Get status color
  function getStatusColor(status: string): string {
    switch (status) {
      case "completed": return "green";
      case "failed": return "red";
      case "cancelled": return "gray";
      case "running": return "blue";
      default: return "gray";
    }
  }

  // Get status icon
  function getStatusIcon(status: string): string {
    switch (status) {
      case "completed": return "✓";
      case "failed": return "✗";
      case "cancelled": return "⊗";
      case "running": return "◐";
      default: return "○";
    }
  }

  // Get step summary
  function getStepSummary(attempt: ExecutionAttempt): string {
    const total = attempt.stepResults.length;
    const successful = attempt.stepResults.filter(r => r.success).length;
    return `${successful}/${total} steps`;
  }
</script>

<div class="execution-timeline">
  {#if attempts.length === 0}
    <div class="empty-state">
      <div class="empty-icon">⏱️</div>
      <div class="empty-text">No execution history</div>
    </div>
  {:else}
    <div class="timeline">
      {#each attempts as attempt, index (attempt.id)}
        {@const isExpanded = expandedAttemptId === attempt.id}
        {@const statusColor = getStatusColor(attempt.status)}

        <div class="timeline-item">
          <!-- Timeline node -->
          <div class="timeline-line">
            {#if index > 0}
              <div class="line-segment top"></div>
            {/if}
            <div class="node" class:green={statusColor === 'green'} class:red={statusColor === 'red'} class:blue={statusColor === 'blue'} class:gray={statusColor === 'gray'}>
              {getStatusIcon(attempt.status)}
            </div>
            {#if index < attempts.length - 1}
              <div class="line-segment bottom"></div>
            {/if}
          </div>

          <!-- Timeline content -->
          <div class="timeline-content">
            <button
              class="attempt-header"
              class:expanded={isExpanded}
              on:click={() => toggleAttempt(attempt.id)}
            >
              <div class="header-main">
                <span class="attempt-status" class:green={statusColor === 'green'} class:red={statusColor === 'red'} class:blue={statusColor === 'blue'} class:gray={statusColor === 'gray'}>
                  {attempt.status}
                </span>
                <span class="attempt-timestamp">{formatTimestamp(attempt.startedAt)}</span>
              </div>
              <div class="header-meta">
                <span class="step-summary">{getStepSummary(attempt)}</span>
                <span class="separator">•</span>
                <span class="duration">{getDuration(attempt)}</span>
              </div>
              <span class="chevron">{isExpanded ? '▼' : '▶'}</span>
            </button>

            {#if isExpanded}
              <div class="attempt-details">
                <!-- Error message if failed -->
                {#if attempt.error}
                  <div class="error-section">
                    <div class="error-title">Error</div>
                    <div class="error-message">{attempt.error}</div>
                  </div>
                {/if}

                <!-- Step results -->
                {#if attempt.stepResults.length > 0}
                  <div class="steps-section">
                    <div class="steps-title">Steps</div>
                    <div class="steps-list">
                      {#each attempt.stepResults as stepResult, stepIndex}
                        <div class="step-result" class:success={stepResult.success} class:failure={!stepResult.success}>
                          <span class="step-number">{stepIndex + 1}</span>
                          <span class="step-status-icon">{stepResult.success ? "✓" : "✗"}</span>
                          <span class="step-id">{stepResult.stepId}</span>
                          <span class="step-duration">{stepResult.duration}ms</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- View full result button -->
                <button
                  class="view-result-btn"
                  on:click={() => handleSelectAttempt(attempt)}
                >
                  View full result
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .execution-timeline {
    background: var(--background-primary);
    border-radius: 6px;
    padding: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.3;
  }

  .empty-text {
    font-size: 11px;
    color: var(--text-muted);
  }

  .timeline {
    display: flex;
    flex-direction: column;
  }

  .timeline-item {
    display: flex;
    gap: 12px;
  }

  .timeline-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 24px;
    flex-shrink: 0;
  }

  .line-segment {
    width: 2px;
    background: var(--background-modifier-border);
  }

  .line-segment.top {
    height: 8px;
    margin-bottom: 4px;
  }

  .line-segment.bottom {
    flex: 1;
    margin-top: 4px;
  }

  .node {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    flex-shrink: 0;
    border: 2px solid var(--background-primary);
  }

  .node.green {
    background: var(--color-green);
    color: white;
  }

  .node.red {
    background: var(--color-red);
    color: white;
  }

  .node.blue {
    background: var(--interactive-accent);
    color: white;
  }

  .node.gray {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .timeline-content {
    flex: 1;
    min-width: 0;
    margin-bottom: 16px;
  }

  .timeline-item:last-child .timeline-content {
    margin-bottom: 0;
  }

  .attempt-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    position: relative;
    transition: all 0.15s ease;
  }

  .attempt-header:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .attempt-header.expanded {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom-color: transparent;
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .attempt-status {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .attempt-status.green {
    background: rgba(0, 200, 0, 0.15);
    color: var(--color-green);
  }

  .attempt-status.red {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .attempt-status.blue {
    background: rgba(0, 100, 255, 0.15);
    color: var(--interactive-accent);
  }

  .attempt-status.gray {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .attempt-timestamp {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--text-muted);
  }

  .separator {
    opacity: 0.5;
  }

  .chevron {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 10px;
    color: var(--text-faint);
  }

  .attempt-details {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-top: none;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    padding: 12px;
  }

  .error-section {
    margin-bottom: 12px;
  }

  .error-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .error-message {
    font-size: 11px;
    color: var(--color-red);
    padding: 6px 8px;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
    font-family: var(--font-monospace);
  }

  .steps-section {
    margin-bottom: 12px;
  }

  .steps-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .step-result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: var(--background-primary);
    border-radius: 4px;
    font-size: 10px;
  }

  .step-result.success {
    border-left: 2px solid var(--color-green);
  }

  .step-result.failure {
    border-left: 2px solid var(--color-red);
  }

  .step-number {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-weight: 600;
    flex-shrink: 0;
  }

  .step-status-icon {
    font-weight: bold;
    flex-shrink: 0;
  }

  .step-result.success .step-status-icon {
    color: var(--color-green);
  }

  .step-result.failure .step-status-icon {
    color: var(--color-red);
  }

  .step-id {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-monospace);
    color: var(--text-muted);
  }

  .step-duration {
    flex-shrink: 0;
    color: var(--text-faint);
  }

  .view-result-btn {
    width: 100%;
    padding: 6px 12px;
    font-size: 11px;
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    cursor: pointer;
    font-weight: 500;
  }

  .view-result-btn:hover {
    background: var(--background-modifier-active-hover);
    border-color: var(--interactive-accent);
  }
</style>
