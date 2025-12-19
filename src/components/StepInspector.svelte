<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Step } from "../types/ActionPlan";
  import type { ExecutionResult } from "../types/ActionPlan";

  export let step: Step;
  export let index: number;
  export let expanded: boolean = false;
  export let executionResult: ExecutionResult | undefined = undefined;

  const dispatch = createEventDispatcher();

  // Get action verb and icon for tool
  function getActionInfo(tool: string): { verb: string; icon: string; color: string } {
    const toolMap: Record<string, { verb: string; icon: string; color: string }> = {
      "vault.createFile": { verb: "CREATE", icon: "+", color: "green" },
      "vault.writeFile": { verb: "WRITE", icon: "~", color: "orange" },
      "vault.readFile": { verb: "READ", icon: "→", color: "blue" },
      "vault.delete": { verb: "DELETE", icon: "×", color: "red" },
      "vault.rename": { verb: "RENAME", icon: "↔", color: "orange" },
      "vault.ensureFolder": { verb: "FOLDER", icon: "+", color: "green" },
      "vault.listFiles": { verb: "LIST", icon: "≡", color: "blue" },
      "vault.searchText": { verb: "SEARCH", icon: "⌕", color: "blue" },
      "editor.getSelection": { verb: "GET", icon: "→", color: "blue" },
      "editor.replaceSelection": { verb: "REPLACE", icon: "~", color: "orange" },
      "editor.insertAtCursor": { verb: "INSERT", icon: "+", color: "green" },
      "workspace.openFile": { verb: "OPEN", icon: "◎", color: "blue" },
      "commands.run": { verb: "RUN", icon: "▶", color: "red" },
      "commands.list": { verb: "LIST", icon: "≡", color: "blue" },
      "util.parseMarkdownBullets": { verb: "PARSE", icon: "≡", color: "blue" },
      "util.slugifyTitle": { verb: "SLUGIFY", icon: "~", color: "blue" },
    };
    return toolMap[tool] || { verb: tool.split('.')[1]?.toUpperCase() || "ACTION", icon: "•", color: "gray" };
  }

  // Get the primary target from step args
  function getTarget(step: Step): string {
    if (step.args.path) return step.args.path;
    if (step.args.oldPath) return `${step.args.oldPath} → ${step.args.newPath}`;
    if (step.args.query) return `"${step.args.query}"`;
    if (step.args.id) return step.args.id;
    if (step.args.text) return step.args.text.substring(0, 30) + (step.args.text.length > 30 ? "..." : "");
    return "";
  }

  // Format argument value for display
  function formatArgValue(key: string, value: any): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "string") {
      if (key === "content" && value.length > 100) {
        return value.substring(0, 100) + "...";
      }
      return value;
    }
    if (typeof value === "boolean") return value ? "yes" : "no";
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  // Format duration
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  // Get execution status
  $: executionStatus = executionResult
    ? executionResult.success
      ? "success"
      : "failure"
    : undefined;

  $: actionInfo = getActionInfo(step.tool);
</script>

<div class="step-inspector">
  <!-- Step Header (clickable) -->
  <button
    class="step-header"
    class:expanded
    class:success={executionStatus === "success"}
    class:failure={executionStatus === "failure"}
    on:click={() => dispatch("toggle")}
    title="Click to {expanded ? 'collapse' : 'expand'} details"
  >
    <span class="step-number">{index + 1}</span>
    <span class="action-badge" class:green={actionInfo.color === 'green'} class:orange={actionInfo.color === 'orange'} class:red={actionInfo.color === 'red'} class:blue={actionInfo.color === 'blue'}>
      <span class="action-icon">{actionInfo.icon}</span>
      {actionInfo.verb}
    </span>
    <span class="target">{getTarget(step)}</span>
    {#if step.foreach}
      <span class="foreach-badge">×N</span>
    {/if}
    {#if executionStatus}
      <span class="execution-status" class:success={executionStatus === "success"} class:failure={executionStatus === "failure"}>
        {executionStatus === "success" ? "✓" : "✗"}
      </span>
    {/if}
    <span class="chevron">{expanded ? '▼' : '▶'}</span>
  </button>

  <!-- Step Details (expanded) -->
  {#if expanded}
    <div class="step-details">
      <!-- Preview -->
      {#if step.preview}
        <div class="preview-text">{step.preview}</div>
      {/if}

      <!-- Tool name -->
      <div class="section">
        <div class="section-title">Tool</div>
        <div class="tool-name">{step.tool}</div>
      </div>

      <!-- Arguments -->
      <div class="section">
        <div class="section-title">Arguments</div>
        <div class="args-table">
          {#each Object.entries(step.args) as [key, value]}
            <div class="arg-row">
              <span class="arg-label">{key}</span>
              <span class="arg-value" class:content={key === 'content'}>{formatArgValue(key, value)}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Foreach -->
      {#if step.foreach}
        <div class="section">
          <div class="section-title">Loop</div>
          <div class="foreach-info">
            Repeats for each item in <code>{step.foreach.from}</code> as <code>{step.foreach.itemName}</code>
            {#if step.foreach.indexName}
              (index as <code>{step.foreach.indexName}</code>)
            {/if}
          </div>
        </div>
      {/if}

      <!-- Dependencies -->
      {#if step.dependsOn && step.dependsOn.length > 0}
        <div class="section">
          <div class="section-title">Dependencies</div>
          <div class="dependencies">
            {#each step.dependsOn as depId}
              <span class="dependency-badge">{depId}</span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Error handling -->
      {#if step.onError}
        <div class="section">
          <div class="section-title">Error Handling</div>
          <div class="error-handling">
            On error: <strong>{step.onError}</strong>
            {#if step.retry}
              (retry up to {step.retry.maxAttempts} times with {step.retry.backoffMs}ms backoff)
            {/if}
          </div>
        </div>
      {/if}

      <!-- Execution Result -->
      {#if executionResult}
        <div class="section">
          <div class="section-title">Execution Result</div>
          <div class="execution-result" class:success={executionResult.success} class:failure={!executionResult.success}>
            <div class="result-status">
              <span class="result-icon">{executionResult.success ? "✓" : "✗"}</span>
              <span class="result-label">{executionResult.success ? "Success" : "Failed"}</span>
              <span class="result-duration">{formatDuration(executionResult.duration)}</span>
            </div>
            {#if executionResult.error}
              <div class="result-error">{executionResult.error}</div>
            {/if}
            {#if executionResult.result}
              <div class="result-output">
                <div class="output-label">Output:</div>
                <pre class="output-content">{typeof executionResult.result === 'string' ? executionResult.result : JSON.stringify(executionResult.result, null, 2)}</pre>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .step-inspector {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .step-inspector:last-child {
    border-bottom: none;
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-normal);
    font-size: 12px;
    transition: background 0.15s ease;
  }

  .step-header:hover {
    background: var(--background-modifier-hover);
  }

  .step-header.expanded {
    background: var(--background-modifier-hover);
  }

  .step-header.success {
    border-left: 3px solid var(--color-green);
  }

  .step-header.failure {
    border-left: 3px solid var(--color-red);
  }

  .step-number {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .action-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .action-badge.green {
    background: rgba(0, 200, 0, 0.15);
    color: var(--color-green);
  }

  .action-badge.orange {
    background: rgba(255, 165, 0, 0.15);
    color: var(--color-orange);
  }

  .action-badge.red {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .action-badge.blue {
    background: rgba(0, 100, 255, 0.15);
    color: var(--color-blue, #4a9eff);
  }

  .action-icon {
    font-weight: bold;
  }

  .target {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-monospace);
    color: var(--text-muted);
    font-size: 11px;
  }

  .foreach-badge {
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 3px;
    background: var(--color-purple, #a855f7);
    color: white;
    font-weight: 600;
  }

  .execution-status {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 11px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .execution-status.success {
    background: var(--color-green);
    color: white;
  }

  .execution-status.failure {
    background: var(--color-red);
    color: white;
  }

  .chevron {
    color: var(--text-faint);
    font-size: 10px;
    flex-shrink: 0;
  }

  .step-details {
    padding: 12px 12px 12px 40px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  .preview-text {
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 12px;
    font-size: 11px;
  }

  .section {
    margin-bottom: 12px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .tool-name {
    font-family: var(--font-monospace);
    font-size: 11px;
    color: var(--text-normal);
    background: var(--background-primary);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .args-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .arg-row {
    display: flex;
    gap: 8px;
    font-size: 11px;
  }

  .arg-label {
    color: var(--text-muted);
    min-width: 80px;
    flex-shrink: 0;
    font-weight: 500;
  }

  .arg-value {
    color: var(--text-normal);
    font-family: var(--font-monospace);
    background: var(--background-primary);
    padding: 2px 6px;
    border-radius: 3px;
    word-break: break-all;
    flex: 1;
  }

  .arg-value.content {
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
  }

  .foreach-info {
    font-size: 11px;
    color: var(--text-normal);
    padding: 6px 8px;
    background: rgba(168, 85, 247, 0.1);
    border-radius: 4px;
  }

  .foreach-info code {
    background: var(--background-primary);
    padding: 1px 4px;
    border-radius: 2px;
    font-family: var(--font-monospace);
  }

  .dependencies {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .dependency-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 3px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .error-handling {
    font-size: 11px;
    color: var(--text-normal);
  }

  .execution-result {
    padding: 8px;
    border-radius: 4px;
    background: var(--background-primary);
  }

  .execution-result.success {
    border-left: 3px solid var(--color-green);
  }

  .execution-result.failure {
    border-left: 3px solid var(--color-red);
  }

  .result-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .result-icon {
    font-size: 14px;
    font-weight: bold;
  }

  .execution-result.success .result-icon {
    color: var(--color-green);
  }

  .execution-result.failure .result-icon {
    color: var(--color-red);
  }

  .result-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .result-duration {
    font-size: 10px;
    color: var(--text-muted);
    margin-left: auto;
  }

  .result-error {
    font-size: 11px;
    color: var(--color-red);
    padding: 6px 8px;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .result-output {
    margin-top: 8px;
  }

  .output-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .output-content {
    font-size: 10px;
    font-family: var(--font-monospace);
    color: var(--text-normal);
    background: var(--background-secondary);
    padding: 6px 8px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0;
  }
</style>
