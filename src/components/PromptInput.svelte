<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher();

  export let disabled = false;
  export let contextInfo: {
    activeFile?: string;
    selection?: string;
  } = {};

  let prompt = "";
  let isGenerating = false;
  let textareaEl: HTMLTextAreaElement;
  let historyIndex = -1;
  let promptHistory: string[] = [];

  // Quick action templates
  const quickActions = [
    { label: "Create a daily note", prompt: "Create a daily note for today" },
    { label: "Organize notes by tag", prompt: "Organize my notes by tags" },
    { label: "Find related notes", prompt: "Find and link related notes" },
    { label: "Create from template", prompt: "Create a note from template" },
  ];

  onMount(() => {
    // Load prompt history from localStorage
    const stored = localStorage.getItem("wand-prompt-history");
    if (stored) {
      try {
        promptHistory = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to load prompt history:", e);
      }
    }
  });

  function handleSubmit() {
    if (!prompt.trim() || isGenerating || disabled) {
      return;
    }

    // Add to history
    addToHistory(prompt);

    dispatch("submit", { prompt });
    isGenerating = true;
  }

  function handleCancel() {
    dispatch("cancel");
    isGenerating = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Cmd/Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Arrow up/down to cycle through history
    if (e.key === "ArrowUp" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (historyIndex < promptHistory.length - 1) {
        historyIndex++;
        prompt = promptHistory[historyIndex];
      }
    } else if (e.key === "ArrowDown" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        prompt = promptHistory[historyIndex];
      } else if (historyIndex === 0) {
        historyIndex = -1;
        prompt = "";
      }
    }
  }

  function addToHistory(text: string) {
    // Don't add duplicates or empty strings
    if (!text.trim() || promptHistory[0] === text) {
      return;
    }

    // Add to beginning, remove duplicates, limit to 50 items
    promptHistory = [text, ...promptHistory.filter((p) => p !== text)].slice(
      0,
      50
    );
    historyIndex = -1;

    // Save to localStorage
    try {
      localStorage.setItem("wand-prompt-history", JSON.stringify(promptHistory));
    } catch (e) {
      console.error("Failed to save prompt history:", e);
    }
  }

  function useQuickAction(action: { label: string; prompt: string }) {
    prompt = action.prompt;
    textareaEl?.focus();
  }

  function autoResize() {
    if (textareaEl) {
      textareaEl.style.height = "auto";
      textareaEl.style.height = Math.min(textareaEl.scrollHeight, 200) + "px";
    }
  }

  // Reset generating state when disabled changes
  $: if (!disabled && isGenerating) {
    isGenerating = false;
  }

  $: prompt, autoResize();
</script>

<div class="prompt-input">
  <!-- Context indicator -->
  {#if contextInfo.activeFile || contextInfo.selection}
    <div class="context-indicator">
      <span class="label">Context:</span>
      {#if contextInfo.activeFile}
        <span class="context-item file-context" title={contextInfo.activeFile}>
          📄 {contextInfo.activeFile.split("/").pop()}
        </span>
      {/if}
      {#if contextInfo.selection}
        <span
          class="context-item selection-context"
          title={contextInfo.selection}
        >
          📝 "{contextInfo.selection.substring(0, 30)}{contextInfo.selection
            .length > 30
            ? "..."
            : ""}"
        </span>
      {/if}
    </div>
  {/if}

  <!-- Quick actions -->
  {#if !isGenerating && prompt.length === 0}
    <div class="quick-actions">
      {#each quickActions as action}
        <button
          class="quick-action-btn"
          on:click={() => useQuickAction(action)}
          disabled={disabled}
        >
          {action.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Textarea -->
  <textarea
    bind:this={textareaEl}
    bind:value={prompt}
    on:keydown={handleKeyDown}
    placeholder="What would you like to do?"
    disabled={disabled || isGenerating}
    class="prompt-textarea"
    rows="3"
  />

  <!-- Actions -->
  <div class="actions">
    <div class="hint">
      {#if isGenerating}
        Generating plan...
      {:else}
        Press ⌘/Ctrl+Enter to submit
      {/if}
    </div>
    <div class="buttons">
      {#if isGenerating}
        <button class="cancel-btn" on:click={handleCancel}>Cancel</button>
      {:else}
        <button
          class="submit-btn"
          on:click={handleSubmit}
          disabled={!prompt.trim() || disabled}
        >
          Generate Plan
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .prompt-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
  }

  .context-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 11px;
  }

  .label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .context-item {
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--background-primary);
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .quick-action-btn {
    font-size: 11px;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
    white-space: nowrap;
  }

  .quick-action-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .quick-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .prompt-textarea {
    width: 100%;
    min-height: 60px;
    max-height: 200px;
    padding: 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-text);
    font-size: 13px;
    resize: vertical;
    outline: none;
  }

  .prompt-textarea:focus {
    border-color: var(--interactive-accent);
  }

  .prompt-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .hint {
    font-size: 11px;
    color: var(--text-muted);
  }

  .buttons {
    display: flex;
    gap: 6px;
  }

  .submit-btn,
  .cancel-btn {
    font-size: 12px;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }

  .submit-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
  }

  .cancel-btn:hover {
    background: var(--background-modifier-hover);
  }
</style>
