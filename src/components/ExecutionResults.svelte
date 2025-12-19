<script lang="ts">
  export let results: any[];

  $: successCount = results.filter(r => r.success).length;
  $: failureCount = results.length - successCount;

  // Track which results are expanded (all collapsed by default)
  let expandedResults = new Set<string>();

  function toggleResult(stepId: string) {
    if (expandedResults.has(stepId)) {
      expandedResults.delete(stepId);
    } else {
      expandedResults.add(stepId);
    }
    expandedResults = expandedResults; // trigger reactivity
  }

  function isExpanded(stepId: string): boolean {
    return expandedResults.has(stepId);
  }
</script>

<div class="execution-results">
  <div class="results-header">
    <h4>📊 Execution Results</h4>
    <div class="results-summary">
      <span class="success-count">✅ {successCount} successful</span>
      {#if failureCount > 0}
        <span class="failure-count">❌ {failureCount} failed</span>
      {/if}
    </div>
  </div>

  <div class="results-list">
    {#each results as result}
      <div class="result-item" class:success={result.success} class:failure={!result.success}>
        <button class="result-step" on:click={() => toggleResult(result.stepId)}>
          <span class="expand-icon">{isExpanded(result.stepId) ? '▼' : '▶'}</span>
          <strong>{result.stepId}</strong>
          <span class="result-status">{result.success ? '✓' : '✗'}</span>
          <span class="result-duration">{result.duration}ms</span>
        </button>

        {#if isExpanded(result.stepId)}
          {#if result.success}
            <div class="result-success">
              {#if result.result}
                <pre class="result-data">{JSON.stringify(result.result, null, 2)}</pre>
              {:else}
                <span class="no-data">No data returned</span>
              {/if}
            </div>
          {:else}
            <div class="result-error">
              Error: {result.error}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .execution-results {
    background-color: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
    margin-top: 8px;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .results-header h4 {
    margin: 0;
    color: var(--text-normal);
  }

  .results-summary {
    display: flex;
    gap: 12px;
    font-size: var(--font-ui-smaller);
  }

  .success-count {
    color: var(--color-green);
  }

  .failure-count {
    color: var(--color-red);
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .result-item {
    padding: 8px;
    border-radius: 6px;
    background-color: var(--background-primary);
  }

  .result-item.success {
    border-left: 3px solid var(--color-green);
  }

  .result-item.failure {
    border-left: 3px solid var(--color-red);
  }

  .result-step {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: inherit;
    color: var(--text-normal);
  }

  .result-step:hover {
    background: var(--background-modifier-hover);
    border-radius: 4px;
  }

  .expand-icon {
    font-size: 10px;
    color: var(--text-muted);
    width: 12px;
    flex-shrink: 0;
  }

  .result-status {
    font-size: 12px;
  }

  .result-item.success .result-status {
    color: var(--color-green);
  }

  .result-item.failure .result-status {
    color: var(--color-red);
  }

  .result-duration {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    font-weight: normal;
    margin-left: auto;
  }

  .result-success {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    padding-left: 20px;
  }

  .result-error {
    color: var(--color-red);
    font-size: var(--font-ui-smaller);
    padding-left: 20px;
  }

  .no-data {
    font-style: italic;
    color: var(--text-faint);
  }

  .result-data {
    margin-top: 8px;
    padding: 8px;
    background-color: var(--background-modifier-border);
    border-radius: 4px;
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }
</style>