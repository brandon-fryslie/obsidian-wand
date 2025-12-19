<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { ActionPlan, Step } from "../types/ActionPlan";
  import type { PlanSummary } from "../services/PlanValidator";
  import type { StepApprovalStatus } from "../services/ChatController";

  export let plan: ActionPlan;
  export let summary: PlanSummary | undefined = undefined;
  export let warnings: Array<{ type: string; message: string; stepId?: string }> = [];
  export let stepApprovals: StepApprovalStatus[] = [];

  const dispatch = createEventDispatcher();

  let showReviseInput = false;
  let revisionText = "";
  let expandedSteps = new Set<string>();
  let showFullContent = new Set<string>(); // Track which args are showing full content

  function toggleStep(stepId: string) {
    if (expandedSteps.has(stepId)) {
      expandedSteps.delete(stepId);
    } else {
      expandedSteps.add(stepId);
    }
    expandedSteps = expandedSteps; // Trigger reactivity
  }

  function handleExecute() {
    dispatch("execute", { remember: true });
  }

  function handleCancel() {
    dispatch("cancel");
  }

  function handleRevise() {
    if (!revisionText.trim()) return;
    dispatch("revise", { revision: revisionText.trim() });
    revisionText = "";
    showReviseInput = false;
  }

  function handleReviseKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRevise();
    } else if (e.key === "Escape") {
      showReviseInput = false;
      revisionText = "";
    }
  }

  function handleApproveStep(stepId: string, scope: 'once' | 'session' | 'always') {
    dispatch("approveStep", {
      stepId,
      remember: scope === 'session',
      addToAllowlist: scope === 'always'
    });
  }

  function handleApproveAll(scope: 'once' | 'session' | 'always') {
    dispatch("approveAll", {
      remember: scope === 'session',
      addToAllowlist: scope === 'always'
    });
  }

  function getStepApproval(stepId: string): StepApprovalStatus | undefined {
    return stepApprovals.find(s => s.stepId === stepId);
  }

  function getStepWarnings(stepId: string): Array<{ type: string; message: string; field?: string }> {
    return warnings.filter(w => w.stepId === stepId);
  }

  function hasPlaceholderWarning(stepId: string): boolean {
    return warnings.some(w => w.stepId === stepId && w.type === "placeholder");
  }

  function toggleFullContent(key: string) {
    if (showFullContent.has(key)) {
      showFullContent.delete(key);
    } else {
      showFullContent.add(key);
    }
    showFullContent = showFullContent; // Trigger reactivity
  }

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
  function formatArgValue(key: string, value: any, showFull: boolean = false): { text: string; truncated: boolean } {
    if (value === null || value === undefined) return { text: "null", truncated: false };
    if (typeof value === "string") {
      const maxLength = 100;
      if (!showFull && value.length > maxLength) {
        return { text: value.substring(0, maxLength) + "...", truncated: true };
      }
      return { text: value, truncated: false };
    }
    if (typeof value === "boolean") return { text: value ? "yes" : "no", truncated: false };
    if (Array.isArray(value)) return { text: `[${value.length} items]`, truncated: false };
    if (typeof value === "object") {
      const json = JSON.stringify(value, null, 2);
      if (!showFull && json.length > 100) {
        return { text: JSON.stringify(value).substring(0, 100) + "...", truncated: true };
      }
      return { text: json, truncated: false };
    }
    return { text: String(value), truncated: false };
  }

  // Check if a field has a placeholder warning
  function fieldHasPlaceholder(stepId: string, fieldName: string): boolean {
    return warnings.some(w =>
      w.stepId === stepId &&
      w.type === "placeholder" &&
      w.field === `args.${fieldName}`
    );
  }

  // Check if all steps are approved
  $: canExecute = stepApprovals.every(s =>
    s.decision === "allow" || s.userApproved === true
  );

  // Count steps needing approval
  $: needsApprovalCount = stepApprovals.filter(s =>
    s.decision === "ask" && !s.userApproved
  ).length;
</script>

<div class="plan-preview">
  <!-- Header -->
  <div class="header">
    <div class="header-content">
      <span class="risk" class:writes={plan.riskLevel === 'writes'} class:commands={plan.riskLevel === 'commands'}>
        {plan.riskLevel}
      </span>
      <span class="goal">{plan.goal}</span>
    </div>
    {#if needsApprovalCount > 0}
      <span class="approval-badge">{needsApprovalCount} need approval</span>
    {/if}
  </div>

  <!-- Assumptions -->
  {#if plan.assumptions.length > 0}
    <div class="assumptions">
      {#each plan.assumptions as assumption}
        <span class="assumption">• {assumption}</span>
      {/each}
    </div>
  {/if}

  <!-- Warnings -->
  {#if warnings.length > 0}
    <div class="warnings">
      {#each warnings as warning}
        <span class="warning">⚠ {warning.message}</span>
      {/each}
    </div>
  {/if}

  <!-- Steps -->
  <div class="steps">
    {#each plan.steps as step, index}
      {@const approval = getStepApproval(step.id)}
      {@const actionInfo = getActionInfo(step.tool)}
      {@const isExpanded = expandedSteps.has(step.id)}
      {@const needsApproval = approval?.decision === 'ask' && !approval?.userApproved}
      {@const hasPlaceholder = hasPlaceholderWarning(step.id)}
      {@const stepWarnings = getStepWarnings(step.id)}

      <div class="step" class:needs-approval={needsApproval} class:expanded={isExpanded} class:has-placeholder={hasPlaceholder}>
        <!-- Step Header (clickable) -->
        <button
          class="step-header"
          on:click={() => toggleStep(step.id)}
          title="Click to {isExpanded ? 'collapse' : 'expand'} details"
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
          {#if hasPlaceholder}
            <span class="placeholder-badge" title="This step has placeholder values">⚠</span>
          {/if}
          <span class="step-status">
            {#if approval?.decision === 'allow'}
              <span class="status-badge auto">✓</span>
            {:else if approval?.userApproved}
              <span class="status-badge approved">✓</span>
            {:else if needsApproval}
              <span class="status-badge pending">?</span>
            {/if}
          </span>
          <span class="chevron">{isExpanded ? '▼' : '▶'}</span>
        </button>

        <!-- Step Details (expanded) -->
        {#if isExpanded}
          <div class="step-details">
            {#if step.preview}
              <div class="preview-text">{step.preview}</div>
            {/if}

            <!-- Step-specific placeholder warnings -->
            {#if stepWarnings.filter(w => w.type === 'placeholder').length > 0}
              <div class="step-placeholder-warning">
                ⚠ This step contains placeholder values that need real data
              </div>
            {/if}

            <div class="args-table">
              {#each Object.entries(step.args) as [key, value]}
                {@const argKey = `${step.id}-${key}`}
                {@const isShowingFull = showFullContent.has(argKey)}
                {@const formatted = formatArgValue(key, value, isShowingFull)}
                {@const isPlaceholder = fieldHasPlaceholder(step.id, key)}
                <div class="arg-row" class:placeholder-value={isPlaceholder}>
                  <span class="arg-label">
                    {key}
                    {#if isPlaceholder}
                      <span class="placeholder-icon" title="Placeholder value detected">⚠</span>
                    {/if}
                  </span>
                  <div class="arg-value-container">
                    <span class="arg-value" class:content={key === 'content'} class:full={isShowingFull}>{formatted.text}</span>
                    {#if formatted.truncated || isShowingFull}
                      <button
                        class="expand-btn"
                        on:click|stopPropagation={() => toggleFullContent(argKey)}
                        title={isShowingFull ? "Show less" : "Show full value"}
                      >
                        {isShowingFull ? "▲ less" : "▼ more"}
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            {#if step.foreach}
              <div class="foreach-info">
                Repeats for each item in <code>{step.foreach.from}</code> as <code>{step.foreach.itemName}</code>
              </div>
            {/if}

            {#if needsApproval}
              <div class="approval-actions">
                <button
                  class="approve-btn"
                  on:click|stopPropagation={() => handleApproveStep(step.id, 'session')}
                >
                  Allow this step
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Revise Input -->
  {#if showReviseInput}
    <div class="revise-input">
      <input
        type="text"
        bind:value={revisionText}
        on:keydown={handleReviseKeydown}
        placeholder="Describe how to revise the plan..."
        autofocus
      />
      <button class="revise-submit" on:click={handleRevise} disabled={!revisionText.trim()}>Go</button>
      <button class="revise-cancel" on:click={() => { showReviseInput = false; revisionText = ''; }}>×</button>
    </div>
  {/if}

  <!-- Action Bar -->
  <div class="actions">
    {#if needsApprovalCount > 0}
      <div class="approval-options">
        <button class="text-btn" on:click={() => handleApproveAll('session')}>
          Allow all ({needsApprovalCount})
        </button>
        <button class="text-btn secondary" on:click={() => handleApproveAll('always')}>
          Always allow
        </button>
      </div>
    {/if}
    <div class="main-actions">
      <button class="action-btn secondary" on:click={() => showReviseInput = !showReviseInput}>
        Revise
      </button>
      <button class="action-btn secondary" on:click={handleCancel}>Cancel</button>
      <button class="action-btn primary" on:click={handleExecute} disabled={!canExecute}>
        {canExecute ? 'Execute' : `Approve ${needsApprovalCount}`}
      </button>
    </div>
  </div>
</div>

<style>
  .plan-preview {
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    font-size: 12px;
    margin: 8px 12px;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .risk {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .risk.writes {
    background: rgba(255, 165, 0, 0.2);
    color: var(--color-orange);
  }

  .risk.commands {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .goal {
    color: var(--text-normal);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .approval-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--color-orange);
    color: white;
    font-weight: 500;
    flex-shrink: 0;
  }

  .assumptions {
    padding: 8px 12px;
    background: var(--background-secondary-alt, var(--background-secondary));
    border-bottom: 1px solid var(--background-modifier-border);
    font-size: 11px;
    color: var(--text-muted);
  }

  .assumption {
    display: block;
    margin: 2px 0;
  }

  .warnings {
    padding: 8px 12px;
    background: rgba(255, 165, 0, 0.1);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .warning {
    display: block;
    color: var(--color-orange);
    font-size: 11px;
    margin: 2px 0;
  }

  .steps {
    max-height: 400px;
    overflow-y: auto;
  }

  .step {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .step:last-child {
    border-bottom: none;
  }

  .step.needs-approval {
    background: rgba(255, 165, 0, 0.05);
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
  }

  .step-header:hover {
    background: var(--background-modifier-hover);
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

  .placeholder-badge {
    font-size: 12px;
    color: var(--color-orange);
    flex-shrink: 0;
  }

  .step.has-placeholder {
    background: rgba(255, 165, 0, 0.08);
    border-left: 3px solid var(--color-orange);
  }

  .step-status {
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: bold;
  }

  .status-badge.auto {
    background: var(--color-green);
    color: white;
  }

  .status-badge.approved {
    background: var(--color-blue, #4a9eff);
    color: white;
  }

  .status-badge.pending {
    background: var(--color-orange);
    color: white;
  }

  .chevron {
    color: var(--text-faint);
    font-size: 10px;
    flex-shrink: 0;
  }

  .step-details {
    padding: 8px 12px 12px 40px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  .preview-text {
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 8px;
    font-size: 11px;
  }

  .args-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .step-placeholder-warning {
    background: rgba(255, 165, 0, 0.15);
    color: var(--color-orange);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    margin-bottom: 8px;
  }

  .arg-row {
    display: flex;
    gap: 8px;
    font-size: 11px;
    flex-direction: column;
  }

  .arg-row.placeholder-value {
    background: rgba(255, 165, 0, 0.1);
    padding: 6px;
    border-radius: 4px;
    margin: 2px -6px;
  }

  .arg-label {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .placeholder-icon {
    color: var(--color-orange);
    font-size: 10px;
  }

  .arg-value-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .arg-value {
    color: var(--text-normal);
    font-family: var(--font-monospace);
    background: var(--background-primary);
    padding: 4px 8px;
    border-radius: 3px;
    word-break: break-all;
    font-size: 11px;
  }

  .arg-value.content {
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
  }

  .arg-value.full {
    max-height: 300px;
    overflow-y: auto;
  }

  .expand-btn {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-accent);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
  }

  .expand-btn:hover {
    text-decoration: underline;
  }

  .foreach-info {
    font-size: 10px;
    color: var(--text-muted);
    padding: 6px 8px;
    background: rgba(168, 85, 247, 0.1);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .foreach-info code {
    background: var(--background-primary);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .approval-actions {
    display: flex;
    justify-content: flex-end;
  }

  .approve-btn {
    font-size: 11px;
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
  }

  .approve-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .revise-input {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .revise-input input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 12px;
  }

  .revise-input input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .revise-submit {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 11px;
    cursor: pointer;
  }

  .revise-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .revise-cancel {
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
  }

  .revise-cancel:hover {
    color: var(--text-normal);
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
    gap: 12px;
  }

  .approval-options {
    display: flex;
    gap: 12px;
  }

  .text-btn {
    font-size: 11px;
    color: var(--interactive-accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-weight: 500;
  }

  .text-btn:hover {
    text-decoration: underline;
  }

  .text-btn.secondary {
    color: var(--text-muted);
  }

  .main-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .action-btn {
    font-size: 11px;
    padding: 6px 14px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 500;
  }

  .action-btn.secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .action-btn.secondary:hover {
    background: var(--background-modifier-active-hover);
  }

  .action-btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .action-btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
