<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import type { ExecutionLogEntry } from "../services/Executor";

  export let progress: {
    currentStep: number;
    totalSteps: number;
    currentAction: string;
    log: ExecutionLogEntry[];
    startTime: number;
  };

  const dispatch = createEventDispatcher();

  // Use an interval to update elapsed time instead of reactive Date.now()
  // This prevents the infinite re-render loop caused by Date.now() changing every ms
  let elapsedTime = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let expanded = false;

  onMount(() => {
    // Update elapsed time every 500ms to avoid excessive renders
    intervalId = setInterval(() => {
      elapsedTime = Date.now() - progress.startTime;
    }, 500);
    // Initial calculation
    elapsedTime = Date.now() - progress.startTime;
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  function handleCancel() {
    dispatch("cancel");
  }

  function toggleExpanded() {
    expanded = !expanded;
  }

  function formatDuration(ms: number | undefined): string {
    if (ms === undefined) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatResult(result: any): string {
    if (result === undefined || result === null) return "";
    if (typeof result === "string") return result;
    if (typeof result === "object") {
      // Show key info from common result types
      if (result.path) return result.path;
      if (result.files) return `${result.files.length} files`;
      if (result.results) return `${result.results.length} results`;
      return JSON.stringify(result).substring(0, 50);
    }
    return String(result);
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

  $: percentComplete = (progress.currentStep / progress.totalSteps) * 100;
  $: hasErrors = progress.log.some(e => e.status === "error");
  $: isComplete = progress.currentStep >= progress.totalSteps;
  $: successCount = progress.log.filter(e => e.status === "success").length;
  $: errorCount = progress.log.filter(e => e.status === "error").length;
</script>

<div class="execution-progress" class:complete={isComplete && !hasErrors}>
  <button class="progress-header" on:click={toggleExpanded}>
    <span class="expand-icon">{expanded ? '▼' : '▶'}</span>
    <span class="title">
      {#if isComplete}
        {hasErrors ? 'Completed with errors' : 'Complete'}
      {:else}
        Executing
      {/if}
    </span>
    <span class="step-count">{progress.currentStep}/{progress.totalSteps}</span>
    {#if isComplete}
      <span class="summary">
        {#if successCount > 0}<span class="success-count">✓{successCount}</span>{/if}
        {#if errorCount > 0}<span class="error-count">✗{errorCount}</span>{/if}
      </span>
    {/if}
    <span class="elapsed">{formatDuration(elapsedTime)}</span>
    <button class="cancel-btn" on:click|stopPropagation={handleCancel} title="Cancel execution">×</button>
  </button>

  <div class="progress-bar-container">
    <div class="progress-bar" class:has-errors={hasErrors} class:complete={isComplete && !hasErrors} style="width: {percentComplete}%"></div>
  </div>

  {#if expanded}
    <div class="log-container">
      {#each progress.log as entry}
        <div class="log-entry" class:running={entry.status === "running"} class:success={entry.status === "success"} class:error={entry.status === "error"} class:pending={entry.status === "pending"}>
          <span class="status-icon" class:running={entry.status === "running"}>
            {getStatusIcon(entry.status)}
          </span>
          <span class="tool">{entry.tool}</span>
          <span class="preview">{entry.preview}</span>
          {#if entry.duration !== undefined}
            <span class="duration">{formatDuration(entry.duration)}</span>
          {/if}
          {#if entry.status === "success" && entry.result}
            <span class="result">{formatResult(entry.result)}</span>
          {/if}
          {#if entry.status === "error" && entry.error}
            <span class="error-msg">{entry.error}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if !isComplete}
    <div class="footer">
      <span class="current-action">{progress.currentAction}</span>
    </div>
  {/if}
</div>

<style>
  .execution-progress {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    margin: 10px 14px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  .execution-progress.complete {
    border-color: var(--color-green);
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-size: 12px;
    color: var(--text-normal);
  }

  .progress-header:hover {
    background: var(--background-modifier-hover);
  }

  .expand-icon {
    font-size: 10px;
    color: var(--text-muted);
    width: 12px;
  }

  .title {
    font-weight: 600;
    color: var(--text-normal);
  }

  .step-count {
    color: var(--text-muted);
    font-size: 11px;
  }

  .summary {
    display: flex;
    gap: 6px;
    font-size: 11px;
  }

  .success-count {
    color: var(--color-green);
  }

  .error-count {
    color: var(--color-red);
  }

  .elapsed {
    color: var(--text-faint);
    font-size: 11px;
    margin-left: auto;
  }

  .cancel-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
    line-height: 1;
  }

  .cancel-btn:hover {
    color: var(--text-normal);
  }

  .progress-bar-container {
    height: 3px;
    background: var(--background-modifier-border);
  }

  .progress-bar {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.3s ease;
  }

  .progress-bar.has-errors {
    background: var(--color-orange);
  }

  .progress-bar.complete {
    background: var(--color-green);
  }

  .log-container {
    border-top: 1px solid var(--background-modifier-border);
    padding: 8px 0;
    max-height: 200px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .log-entry {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 12px;
    font-size: 11px;
    line-height: 1.5;
  }

  .log-entry.pending {
    opacity: 0.5;
  }

  .log-entry.running {
    background: rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.08);
  }

  .log-entry.error {
    background: rgba(255, 0, 0, 0.05);
  }

  .status-icon {
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    font-size: 11px;
  }

  .status-icon.running {
    animation: rotate 2s linear infinite;
  }

  @keyframes rotate {
    to { transform: rotate(360deg); }
  }

  .log-entry.success .status-icon {
    color: var(--color-green);
  }

  .log-entry.error .status-icon {
    color: var(--color-red);
  }

  .tool {
    color: var(--text-accent);
    flex-shrink: 0;
    font-family: var(--font-monospace);
    font-weight: 500;
  }

  .preview {
    color: var(--text-muted);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .duration {
    color: var(--text-faint);
    flex-shrink: 0;
    font-size: 10px;
  }

  .result {
    color: var(--color-green);
    flex-shrink: 0;
    font-size: 10px;
    max-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .error-msg {
    color: var(--color-red);
    font-size: 10px;
    flex-shrink: 1;
    word-break: break-word;
  }

  .footer {
    padding: 6px 12px;
    border-top: 1px solid var(--background-modifier-border);
    font-size: 11px;
  }

  .current-action {
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
