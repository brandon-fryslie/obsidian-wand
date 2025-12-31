<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { App, Notice, MarkdownView, WorkspaceLeaf } from "obsidian";
  import { PluginServices } from "../services/PluginServices";
  import { ChatState } from "../services/ChatController";
  import MessageList from "./MessageList.svelte";
  import PlanPreview from "./PlanPreview.svelte";
  import ExecutionProgress from "./ExecutionProgress.svelte";
  import ContextUsage from "./ContextUsage.svelte";

  export let app: App;
  export let services: PluginServices;

  let state: ChatState = {
    messages: [],
    isGenerating: false,
    isExecuting: false,
  };

  let inputText = "";
  let showSelectionIndicator = false;
  let selectionText = "";
  let selectionSource = "";
  let fullSelection = "";

  // Command history
  let commandHistory: string[] = [];
  let historyIndex = -1;
  let savedInput = "";

  let unsubscribe: () => void;
  let inputElement: HTMLTextAreaElement;

  // Suggestions for empty state
  const suggestions = [
    { icon: "📝", text: "Create a daily note for today" },
    { icon: "📁", text: "Organize my notes into folders by topic" },
    { icon: "🔍", text: "Find all notes mentioning..." },
    { icon: "📋", text: "Create a template for meeting notes" },
    { icon: "🏷️", text: "Add tags to my recent notes" },
    { icon: "📊", text: "Summarize the key points from..." },
  ];

  // Show suggestions when no messages
  $: showSuggestions = state.messages.length === 0 && !state.isGenerating;

  // Auto-resize textarea
  $: if (inputElement && inputText !== undefined) {
    autoResizeTextarea();
  }

  function autoResizeTextarea() {
    if (!inputElement) return;
    inputElement.style.height = 'auto';
    const newHeight = Math.min(inputElement.scrollHeight, 150); // max 150px
    inputElement.style.height = newHeight + 'px';
  }

  // Save messages whenever they change
  $: if (services.settings.chat.persistHistory && state.messages.length > 0) {
    try {
      localStorage.setItem("wand-conversation", JSON.stringify(state.messages));
    } catch (e) {
      console.warn("[Wand] Failed to save conversation:", e);
    }
  }

  onMount(async () => {
    unsubscribe = services.chatController.onStateChange((newState) => {
      state = newState;
    });

    // Load command history
    try {
      const saved = localStorage.getItem("wand-command-history");
      if (saved) commandHistory = JSON.parse(saved);
    } catch (e) {
      console.warn("[Wand] Failed to load command history:", e);
    }

    // Load conversation history if enabled
    if (services.settings.chat.persistHistory) {
      try {
        const savedMessages = localStorage.getItem("wand-conversation");
        if (savedMessages) {
          const messages = JSON.parse(savedMessages);
          // Restore Date objects
          messages.forEach((m: any) => m.timestamp = new Date(m.timestamp));
          services.chatController.restoreMessages(messages);
        }
      } catch (e) {
        console.warn("[Wand] Failed to load conversation:", e);
      }
    }

    checkAllSelections();
    app.workspace.on("active-leaf-change", checkAllSelections);
    app.workspace.on("editor-change", checkAllSelections);
    const interval = setInterval(checkAllSelections, 500);

    return () => clearInterval(interval);
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  function useSuggestion(text: string) {
    inputText = text;
    inputElement?.focus();
  }

  function checkAllSelections() {
    let foundSelection = "";
    let foundSource = "";

    app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.editor) {
        const selection = view.editor.getSelection();
        if (selection && selection.trim().length > 0) {
          if (selection.length > foundSelection.length) {
            foundSelection = selection;
            foundSource = view.file?.basename || "untitled";
          }
        }
      }
    });

    if (foundSelection) {
      showSelectionIndicator = true;
      fullSelection = foundSelection;
      selectionSource = foundSource;
      selectionText = foundSelection.substring(0, 60) + (foundSelection.length > 60 ? "..." : "");
    } else {
      showSelectionIndicator = false;
      fullSelection = "";
      selectionText = "";
      selectionSource = "";
    }
  }

  async function sendMessage() {
    if (!inputText.trim() || state.isGenerating || state.isExecuting) return;

    const message = inputText.trim();

    if (commandHistory[0] !== message) {
      commandHistory.unshift(message);
      commandHistory = commandHistory.slice(0, 50);
      try {
        localStorage.setItem("wand-command-history", JSON.stringify(commandHistory));
      } catch (e) {}
    }
    historyIndex = -1;
    savedInput = "";
    inputText = "";

    try {
      await services.chatController.sendMessage(message);
    } catch (error) {
      new Notice(`Error: ${error.message}`);
    }
  }

  async function executePlan() {
    if (!state.currentPlan || state.isExecuting) return;
    try {
      await services.chatController.executePlan(state.currentPlan);
      new Notice("Done");
    } catch (error) {
      new Notice(`Failed: ${error.message}`);
    }
  }

  function cancelPlan() {
    services.chatController.cancelPlan();
  }

  function cancelGeneration() {
    services.chatController.cancelGeneration();
  }

  function cancelExecution() {
    // For now, just show a notice - full cancellation would need abort support in Executor
    new Notice("Cancellation requested...");
    // The execution will complete the current step but won't start new ones
  }

  async function handleRevise(event: CustomEvent<{ revision: string }>) {
    const { revision } = event.detail;
    try {
      await services.chatController.revisePlan(revision);
    } catch (error) {
      new Notice(`Error: ${error.message}`);
    }
  }

  function handleApproveStep(event: CustomEvent<{ stepId: string; remember: boolean; addToAllowlist?: boolean }>) {
    const { stepId, remember, addToAllowlist } = event.detail;
    services.chatController.approveStep(stepId, { remember, addToAllowlist });
  }

  function handleApproveAll(event: CustomEvent<{ remember: boolean; addToAllowlist?: boolean }>) {
    const { remember, addToAllowlist } = event.detail;
    services.chatController.approveAllSteps({ remember, addToAllowlist });
  }

  function useSelection() {
    if (fullSelection) {
      inputText = `[${selectionSource}]\n${fullSelection}\n\n` + inputText;
    }
  }

  function clearChat() {
    services.chatController.clearMessages();
    localStorage.removeItem("wand-conversation");
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
      return;
    }

    if (event.key === "c" && event.ctrlKey && !event.metaKey) {
      const target = event.target as HTMLTextAreaElement;
      if (target.selectionStart === target.selectionEnd) {
        event.preventDefault();
        inputText = "";
        historyIndex = -1;
        savedInput = "";
      }
      return;
    }

    if (event.key === "l" && event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      clearChat();
      return;
    }

    if (event.key === "ArrowUp" && !event.shiftKey) {
      const target = event.target as HTMLTextAreaElement;
      if (target.selectionStart === 0 || inputText.trim() === "") {
        event.preventDefault();
        navigateHistory(-1);
      }
      return;
    }

    if (event.key === "ArrowDown" && !event.shiftKey) {
      const target = event.target as HTMLTextAreaElement;
      if (target.selectionStart === inputText.length || inputText.trim() === "") {
        event.preventDefault();
        navigateHistory(1);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      inputText = "";
      historyIndex = -1;
      savedInput = "";
      return;
    }
  }

  function navigateHistory(direction: number) {
    if (commandHistory.length === 0) return;
    if (historyIndex === -1 && direction === -1) savedInput = inputText;

    const newIndex = historyIndex + (-direction);
    if (newIndex < -1) return;

    if (newIndex === -1) {
      inputText = savedInput;
      historyIndex = -1;
    } else if (newIndex < commandHistory.length) {
      inputText = commandHistory[newIndex];
      historyIndex = newIndex;
    }
  }
</script>

<div class="wand-panel">
  <!-- Header -->
  <div class="panel-header">
    <span class="title">Wand</span>
    <button class="clear-btn" on:click={clearChat} title="Clear conversation (Ctrl+L)">Clear</button>
  </div>

  <!-- Context Usage -->
  <ContextUsage messages={state.messages} model={services.settings.llm.model} />

  <!-- Selection indicator -->
  {#if showSelectionIndicator}
    <button class="selection" on:click={useSelection} title="Click to include selection">
      <span class="sel-source">{selectionSource}</span>
      <span class="sel-text">{selectionText}</span>
      <span class="sel-add">+</span>
    </button>
  {/if}

  <!-- Messages -->
  <MessageList messages={state.messages} />

  <!-- Suggestions for empty state -->
  {#if showSuggestions}
    <div class="suggestions">
      <div class="suggestions-header">Try something like:</div>
      <div class="suggestions-grid">
        {#each suggestions as suggestion, i}
          <button
            class="suggestion-chip"
            style="animation-delay: {i * 0.1}s"
            on:click={() => useSuggestion(suggestion.text)}
            title="Click to use this suggestion"
          >
            <span class="suggestion-icon">{suggestion.icon}</span>
            <span class="suggestion-text">{suggestion.text}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Typing indicator -->
  {#if state.isGenerating}
    <div class="typing-indicator">
      <div class="typing-content">
        <span class="wand-label">Wand</span>
        <div class="typing-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
      <button class="cancel-gen-btn" on:click={cancelGeneration} title="Cancel request">
        Cancel
      </button>
    </div>
  {/if}

  <!-- Plan Preview -->
  {#if state.currentPlan && !state.isExecuting && !state.allAutoApproved}
    <PlanPreview
      plan={state.currentPlan}
      summary={state.currentPlanSummary}
      warnings={state.currentPlanWarnings || []}
      stepApprovals={state.stepApprovals || []}
      on:execute={executePlan}
      on:cancel={cancelPlan}
      on:approveStep={handleApproveStep}
      on:approveAll={handleApproveAll}
      on:revise={handleRevise}
    />
  {/if}

  <!-- Execution Progress -->
  {#if state.isExecuting && state.executionProgress}
    <ExecutionProgress progress={state.executionProgress} on:cancel={cancelExecution} />
  {/if}

  <!-- Input -->
  <div class="input-area">
    <textarea
      bind:this={inputElement}
      bind:value={inputText}
      placeholder="What would you like to do?"
      on:keydown={handleKeydown}
      on:input={autoResizeTextarea}
      disabled={state.isGenerating || state.isExecuting}
      rows="1"
    ></textarea>
    <div class="input-footer">
      <span class="hint">
        {#if historyIndex >= 0}
          {historyIndex + 1}/{commandHistory.length}
        {:else}
          Enter to send • Shift+Enter for new line
        {/if}
      </span>
      <button
        class="send-btn"
        on:click={sendMessage}
        disabled={!inputText.trim() || state.isGenerating || state.isExecuting}
      >
        {state.isGenerating ? '...' : 'Send'}
      </button>
    </div>
  </div>
</div>

<style>
  .wand-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-secondary);
    font-size: 13px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }

  .title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-normal);
    letter-spacing: 0.5px;
  }

  .clear-btn {
    font-size: 11px;
    padding: 4px 10px;
    border: none;
    border-radius: 5px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    font-weight: 500;
  }

  .clear-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
    transform: translateY(-1px);
  }

  .clear-btn:active {
    transform: translateY(0);
  }

  .selection {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 14px 0;
    padding: 8px 12px;
    background: linear-gradient(135deg, var(--background-modifier-hover) 0%, var(--background-primary) 100%);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font-size: 12px;
    transition: all 0.2s ease;
  }

  .selection:hover {
    background: var(--background-modifier-active-hover);
    border-color: var(--interactive-accent);
    transform: translateX(4px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }

  .sel-source {
    color: var(--text-accent);
    font-weight: 600;
    flex-shrink: 0;
  }

  .sel-text {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .sel-add {
    color: var(--interactive-accent);
    font-weight: 700;
    font-size: 16px;
    flex-shrink: 0;
  }

  .input-area {
    padding: 10px 14px 14px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }

  textarea {
    width: 100%;
    min-height: 44px;
    max-height: 150px;
    padding: 10px 12px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    resize: none;
    font-family: var(--font-interface);
    font-size: 13px;
    line-height: 1.5;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    overflow-y: auto;
  }

  textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb, 99, 102, 241), 0.1);
  }

  textarea::placeholder {
    color: var(--text-faint);
  }

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
  }

  .hint {
    font-size: 11px;
    color: var(--text-faint);
  }

  .send-btn {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .send-btn:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .send-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .typing-indicator {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: var(--background-primary);
    border-radius: 8px;
    margin: 10px 14px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  .typing-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .wand-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .typing-dots {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--interactive-accent);
    animation: bounce 1.4s ease-in-out infinite;
  }

  .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.7;
    }
    30% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 60%, 100% { opacity: 0.5; }
      30% { opacity: 1; }
    }
  }

  .cancel-gen-btn {
    font-size: 11px;
    padding: 4px 10px;
    border: none;
    border-radius: 5px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-gen-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
    transform: translateY(-1px);
  }

  .cancel-gen-btn:active {
    transform: translateY(0);
  }

  .suggestions {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px 14px;
    overflow-y: auto;
  }

  .suggestions-header {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 14px;
    text-align: center;
    font-weight: 500;
  }

  .suggestions-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .suggestion-chip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    transition: all 0.25s ease;
    opacity: 0;
    transform: translateX(-20px);
    animation: slideIn 0.4s ease forwards;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  @keyframes slideIn {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .suggestion-chip:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateX(6px) scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .suggestion-chip:active {
    transform: translateX(6px) scale(0.98);
  }

  @media (prefers-reduced-motion: reduce) {
    .suggestion-chip {
      animation: fadeIn 0.3s ease forwards;
      transform: none;
    }
    @keyframes fadeIn {
      to { opacity: 1; }
    }
    .suggestion-chip:hover {
      transform: none;
    }
  }

  .suggestion-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .suggestion-text {
    color: var(--text-normal);
    font-size: 12px;
    line-height: 1.4;
  }
</style>
