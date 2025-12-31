<script lang="ts">
  import { contextTracker, type ContextBreakdown } from "../services/ContextTracker";
  import type { ChatMessage } from "../services/ChatController";

  export let messages: ChatMessage[] = [];
  export let model: string = "claude-sonnet-4-20250514";
  export let expanded: boolean = false;

  $: breakdown = contextTracker.getContextBreakdown(model, messages);

  function formatTokens(tokens: number): string {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return `${tokens}`;
  }

  function percent(value: number, total: number): string {
    return ((value / total) * 100).toFixed(1);
  }

  function getBarSegments(breakdown: ContextBreakdown): { type: string; percent: number; color: string }[] {
    const total = breakdown.contextLimit;
    return [
      { type: "system", percent: (breakdown.systemPrompt / total) * 100, color: "var(--color-blue)" },
      { type: "tools", percent: (breakdown.mcpTools / total) * 100, color: "var(--color-purple)" },
      { type: "messages", percent: (breakdown.messages / total) * 100, color: "var(--color-green)" },
      { type: "free", percent: (breakdown.freeSpace / total) * 100, color: "var(--background-modifier-border)" },
      { type: "buffer", percent: (breakdown.autocompactBuffer / total) * 100, color: "var(--text-faint)" },
    ];
  }

  function toggleExpanded() {
    expanded = !expanded;
  }
</script>

<div class="context-usage">
  <button class="context-header" on:click={toggleExpanded}>
    <div class="context-bar">
      {#each getBarSegments(breakdown) as segment}
        <div
          class="bar-segment {segment.type}"
          style="width: {segment.percent}%; background-color: {segment.color}"
        ></div>
      {/each}
    </div>
    <div class="context-summary">
      <span class="context-label">{formatTokens(breakdown.totalUsed)}/{formatTokens(breakdown.contextLimit)}</span>
      <span class="context-percent">({breakdown.usagePercent}%)</span>
      <span class="expand-icon">{expanded ? '▼' : '▶'}</span>
    </div>
  </button>

  {#if expanded}
    <div class="context-details">
      <div class="model-name">{breakdown.model}</div>

      <div class="category-list">
        {#if breakdown.systemPrompt > 0}
          <div class="category-item">
            <span class="category-dot" style="background-color: var(--color-blue)"></span>
            <span class="category-name">System prompt</span>
            <span class="category-value">{formatTokens(breakdown.systemPrompt)} ({percent(breakdown.systemPrompt, breakdown.contextLimit)}%)</span>
          </div>
        {/if}
        <div class="category-item">
          <span class="category-dot" style="background-color: var(--color-purple)"></span>
          <span class="category-name">MCP tools</span>
          <span class="category-value">{formatTokens(breakdown.mcpTools)} ({percent(breakdown.mcpTools, breakdown.contextLimit)}%)</span>
        </div>
        <div class="category-item">
          <span class="category-dot" style="background-color: var(--color-green)"></span>
          <span class="category-name">Messages</span>
          <span class="category-value">{formatTokens(breakdown.messages)} ({percent(breakdown.messages, breakdown.contextLimit)}%)</span>
        </div>
        <div class="category-item">
          <span class="category-dot" style="background-color: var(--background-modifier-border)"></span>
          <span class="category-name">Free space</span>
          <span class="category-value">{formatTokens(breakdown.freeSpace)} ({percent(breakdown.freeSpace, breakdown.contextLimit)}%)</span>
        </div>
        <div class="category-item">
          <span class="category-dot" style="background-color: var(--text-faint)"></span>
          <span class="category-name">Reserved buffer</span>
          <span class="category-value">{formatTokens(breakdown.autocompactBuffer)} ({percent(breakdown.autocompactBuffer, breakdown.contextLimit)}%)</span>
        </div>
      </div>

      {#if breakdown.messageBreakdown.length > 0}
        <div class="section-title">Messages by role</div>
        <div class="breakdown-list">
          {#each breakdown.messageBreakdown as msg}
            <div class="breakdown-item">
              <span class="breakdown-name">{msg.role}</span>
              <span class="breakdown-count">{msg.count} msgs</span>
              <span class="breakdown-value">{formatTokens(msg.tokens)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="section-title">Top tools by size</div>
      <div class="tool-list">
        {#each breakdown.toolCosts.slice(0, 8) as tool}
          <div class="tool-item">
            <span class="tool-name">{tool.name}</span>
            <span class="tool-value">{formatTokens(tool.tokens)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .context-usage {
    border-bottom: 1px solid var(--background-modifier-border);
    background-color: var(--background-secondary);
  }

  .context-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .context-header:hover {
    background-color: var(--background-modifier-hover);
  }

  .context-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background-color: var(--background-modifier-border);
  }

  .bar-segment {
    height: 100%;
    min-width: 0;
  }

  .context-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .context-label {
    font-weight: 500;
  }

  .context-percent {
    color: var(--text-faint);
  }

  .expand-icon {
    margin-left: auto;
    font-size: 10px;
  }

  .context-details {
    padding: 8px 12px 12px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .model-name {
    font-size: 10px;
    color: var(--text-faint);
    margin-bottom: 8px;
    font-family: var(--font-monospace);
  }

  .category-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .category-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .category-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .category-name {
    color: var(--text-normal);
    flex: 1;
  }

  .category-value {
    color: var(--text-muted);
    font-family: var(--font-monospace);
    font-size: 10px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    margin-top: 4px;
  }

  .breakdown-list, .tool-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 10px;
  }

  .breakdown-item, .tool-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    padding: 2px 0;
  }

  .breakdown-name, .tool-name {
    color: var(--text-muted);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breakdown-count {
    color: var(--text-faint);
    font-size: 9px;
  }

  .breakdown-value, .tool-value {
    color: var(--text-faint);
    font-family: var(--font-monospace);
    flex-shrink: 0;
  }
</style>
