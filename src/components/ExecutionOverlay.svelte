<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ExecutionProgress } from "../services/ExecutionManager";
  import type { ExecutionLogEntry } from "../services/Executor";

  export let progress: ExecutionProgress;

  const dispatch = createEventDispatcher();

  function handlePause() {
    dispatch("pause");
  }

  function handleCancel() {
    dispatch("cancel");
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case "pending": return "○";
      case "running": return "◐";
      case "success": return "✓";
      case "error": return "✗";
      case "skipped": return "⊘";
      default: return "?";
    }
  }

  function getStatusClass(status: string): string {
    switch (status) {
      case "pending": return "pending";
      case "running": return "running";
      case "success": return "success";
      case "error": return "error";
      case "skipped": return "skipped";
      default: return "";
    }
  }

  $: percentComplete = (progress.currentStep / progress.totalSteps) * 100;
  $: completedCount = progress.log.filter(e => e.status === "success").length;
  $: errorCount = progress.log.filter(e => e.status === "error").length;
  $: isPaused = progress.status === "paused";
</script>

<div class="execution-overlay" class:paused={isPaused}>
  <div class="overlay-backdrop" on:click|stopPropagation></div>

  <div class="overlay-content">
    <!-- Header -->
    <div class="overlay-header">
      <div class="header-left">
        <span class="status-icon" class:paused={isPaused}>
          {isPaused ? "⏸" : "◐"}
        </span>
        <h2 class="title">
          {#if isPaused}
            Execution Paused
          {:else}
            Executing Plan
          {/if}
        </h2>
      </div>
      <div class="header-right">
        <span class="elapsed-time">{formatDuration(progress.elapsedMs)}</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-section">
      <div class="progress-info">
        <span class="current-step">{progress.currentStepPreview}</span>
        <span class="step-count">Step {progress.currentStep} of {progress.totalSteps}</span>
      </div>
      <div class="progress-bar-container">
        <div
          class="progress-bar"
          class:has-errors={errorCount > 0}
          class:paused={isPaused}
          style="width: {percentComplete}%"
        ></div>
      </div>
      <div class="progress-stats">
        <span class="stat success">{completedCount} completed</span>
        {#if errorCount > 0}
          <span class="stat error">{errorCount} failed</span>
        {/if}
        <span class="stat total">{progress.totalSteps} total</span>
      </div>
    </div>

    <!-- Step Log -->
    <div class="log-section">
      <div class="log-header">Execution Log</div>
      <div class="log-list">
        {#each progress.log as entry}
          <div class="log-entry {getStatusClass(entry.status)}">
            <span class="entry-icon" class:spinning={entry.status === "running"}>
              {getStatusIcon(entry.status)}
            </span>
            <div class="entry-content">
              <div class="entry-main">
                <span class="entry-tool">{entry.tool}</span>
                <span class="entry-preview">{entry.preview}</span>
              </div>
              {#if entry.duration !== undefined}
                <span class="entry-duration">{formatDuration(entry.duration)}</span>
              {/if}
              {#if entry.error}
                <div class="entry-error">{entry.error}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="overlay-actions">
      {#if isPaused}
        <button class="btn btn-secondary" on:click={handleCancel}>
          Cancel
        </button>
      {:else}
        <button class="btn btn-secondary" on:click={handlePause}>
          Pause
        </button>
        <button class="btn btn-danger" on:click={handleCancel}>
          Cancel
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .execution-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .overlay-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
  }

  .overlay-content {
    position: relative;
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-icon {
    font-size: 24px;
    animation: rotate 2s linear infinite;
  }

  .status-icon.paused {
    animation: none;
    color: var(--color-yellow);
  }

  @keyframes rotate {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .status-icon {
      animation: pulse 1.5s infinite;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .execution-overlay.paused .title {
    color: var(--color-yellow);
  }

  .elapsed-time {
    font-size: 14px;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .progress-section {
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .current-step {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-count {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 12px;
    flex-shrink: 0;
  }

  .progress-bar-container {
    height: 8px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .progress-bar {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.3s ease, background-color 0.3s ease;
    border-radius: 4px;
  }

  .progress-bar.has-errors {
    background: var(--color-orange);
  }

  .progress-bar.paused {
    background: var(--color-yellow);
  }

  .progress-stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
  }

  .stat {
    color: var(--text-muted);
  }

  .stat.success {
    color: var(--color-green);
  }

  .stat.error {
    color: var(--color-red);
  }

  .log-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .log-header {
    padding: 12px 24px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .log-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 0;
  }

  .log-entry {
    display: flex;
    gap: 10px;
    padding: 8px 24px;
    transition: background-color 0.2s ease;
  }

  .log-entry.running {
    background: rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.08);
  }

  .log-entry.success {
    animation: slideInEntry 0.3s ease;
  }

  @keyframes slideInEntry {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .entry-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .entry-icon.spinning {
    animation: rotate 2s linear infinite;
  }

  .log-entry.success .entry-icon {
    color: var(--color-green);
  }

  .log-entry.error .entry-icon {
    color: var(--color-red);
  }

  .log-entry.pending .entry-icon {
    color: var(--text-faint);
    opacity: 0.5;
  }

  .entry-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .entry-main {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .entry-tool {
    font-family: var(--font-monospace);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-accent);
    flex-shrink: 0;
  }

  .entry-preview {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-duration {
    font-size: 10px;
    color: var(--text-faint);
    font-family: var(--font-monospace);
  }

  .entry-error {
    font-size: 11px;
    color: var(--color-red);
    padding: 4px 8px;
    background: rgba(255, 0, 0, 0.08);
    border-radius: 4px;
    margin-top: 2px;
  }

  .overlay-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .btn {
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-active-hover);
  }

  .btn-danger {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .btn-danger:hover {
    background: rgba(255, 0, 0, 0.25);
  }
</style>
