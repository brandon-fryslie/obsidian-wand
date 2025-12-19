<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Plan, PlanStatus } from "../types/Plan";
  import StepInspector from "./StepInspector.svelte";
  import ExecutionTimeline from "./ExecutionTimeline.svelte";

  export let plan: Plan;
  export let dependencies: Plan[] = [];
  export let dependents: Plan[] = [];
  export let canExecute: { canExecute: boolean; blockedBy?: Plan[]; reason?: string } = { canExecute: true };

  const dispatch = createEventDispatcher();

  let expandedStepIds = new Set<string>();
  let showWarnings = false;
  let showHistory = false;
  let showDependencies = false;
  let notesText = plan.notes || "";

  // Priority options
  const priorities = [1, 2, 3, 4, 5];

  function toggleStep(stepId: string) {
    if (expandedStepIds.has(stepId)) {
      expandedStepIds.delete(stepId);
    } else {
      expandedStepIds.add(stepId);
    }
    expandedStepIds = expandedStepIds; // Trigger reactivity
  }

  function handleBack() {
    dispatch("action", { action: "back" });
  }

  function handlePriorityChange(event: Event) {
    const newPriority = parseInt((event.target as HTMLSelectElement).value);
    dispatch("action", { action: "updatePriority", priority: newPriority });
  }

  function handleNotesBlur() {
    if (notesText !== plan.notes) {
      dispatch("action", { action: "updateNotes", notes: notesText });
    }
  }

  function handleAction(action: string) {
    dispatch("action", { action });
  }

  function handleRemoveDependency(dependencyId: string) {
    dispatch("action", { action: "removeDependency", dependencyId });
  }

  function handleViewPlan(planId: string) {
    dispatch("action", { action: "viewPlan", planId });
  }

  // Get action buttons based on status
  function getActionButtons(status: PlanStatus): Array<{ label: string; action: string; primary?: boolean; disabled?: boolean }> {
    switch (status) {
      case "draft":
        return [
          { label: "Validate", action: "validate", primary: true },
          { label: "Delete", action: "delete" },
        ];
      case "pending":
        return [
          { label: "Approve", action: "approve", primary: true },
          { label: "Edit", action: "edit" },
          { label: "Cancel", action: "cancel" },
        ];
      case "approved":
        return [
          { label: "Execute", action: "execute", primary: true },
          { label: "Edit", action: "edit" },
          { label: "Cancel", action: "cancel" },
        ];
      case "executing":
        return [
          { label: "Pause", action: "pause", primary: true },
          { label: "Cancel", action: "cancel" },
        ];
      case "paused":
        return [
          { label: "Resume", action: "resume", primary: true },
          { label: "Cancel", action: "cancel" },
        ];
      case "completed":
        return [
          { label: "Retry", action: "retry" },
          { label: "Save as Template", action: "saveTemplate" },
          { label: "Delete", action: "delete" },
        ];
      case "failed":
        return [
          { label: "Retry", action: "retry", primary: true },
          { label: "Edit", action: "edit" },
          { label: "Delete", action: "delete" },
        ];
      case "cancelled":
        return [
          { label: "Retry", action: "retry", primary: true },
          { label: "Delete", action: "delete" },
        ];
      default:
        return [];
    }
  }

  // Get status badge color
  function getStatusColor(status: PlanStatus): string {
    switch (status) {
      case "draft": return "gray";
      case "pending": return "orange";
      case "approved": return "blue";
      case "executing": return "blue";
      case "paused": return "yellow";
      case "completed": return "green";
      case "failed": return "red";
      case "cancelled": return "gray";
      default: return "gray";
    }
  }

  // Get status icon
  function getStatusIcon(status: PlanStatus): string {
    switch (status) {
      case "draft": return "○";
      case "pending": return "●";
      case "approved": return "◉";
      case "executing": return "◐";
      case "paused": return "⏸";
      case "completed": return "✓";
      case "failed": return "✗";
      case "cancelled": return "⊗";
      default: return "○";
    }
  }

  // Get execution result for a step
  function getStepResult(stepId: string) {
    if (!plan.executionState) return undefined;
    return plan.executionState.stepResults.find(r => r.stepId === stepId);
  }

  $: actionButtons = getActionButtons(plan.status);
  $: statusColor = getStatusColor(plan.status);
  $: warningsCount = plan.warnings.length;
  $: historyCount = plan.executionHistory.length;
  $: stepCount = plan.actionPlan.steps.length;
  $: dependenciesCount = dependencies.length;
  $: dependentsCount = dependents.length;
  $: isBlocked = !canExecute.canExecute && (canExecute.blockedBy?.length ?? 0) > 0;
</script>

<div class="plan-detail">
  <!-- Header Bar -->
  <div class="header-bar">
    <button class="back-btn" on:click={handleBack} title="Back to list">
      ← Back
    </button>
    <button class="menu-btn" title="More options">⋮</button>
  </div>

  <!-- Title and Status -->
  <div class="title-section">
    <div class="title-row">
      <input
        type="text"
        class="title-input"
        value={plan.title}
        on:blur={(e) => dispatch("action", { action: "updateTitle", title: e.currentTarget.value })}
      />
      <select class="priority-selector" value={plan.priority} on:change={handlePriorityChange}>
        {#each priorities as p}
          <option value={p}>P{p}</option>
        {/each}
      </select>
    </div>
    <div class="status-row">
      <span class="status-badge" class:gray={statusColor === 'gray'} class:orange={statusColor === 'orange'} class:blue={statusColor === 'blue'} class:yellow={statusColor === 'yellow'} class:green={statusColor === 'green'} class:red={statusColor === 'red'}>
        <span class="status-icon">{getStatusIcon(plan.status)}</span>
        {plan.status}
      </span>
      <span class="risk-badge" class:writes={plan.actionPlan.riskLevel === 'writes'} class:commands={plan.actionPlan.riskLevel === 'commands'}>
        {plan.actionPlan.riskLevel}
      </span>
    </div>
  </div>

  <!-- Scrollable Content -->
  <div class="content-area">
    <!-- Goal Section -->
    <div class="section">
      <div class="section-header">Goal</div>
      <div class="goal-text">{plan.goal}</div>
    </div>

    <!-- Blocked Status Banner -->
    {#if isBlocked}
      <div class="section">
        <div class="blocked-banner">
          <span class="blocked-icon">🔒</span>
          <div class="blocked-content">
            <div class="blocked-title">Blocked by Dependencies</div>
            <div class="blocked-description">
              This plan cannot execute until {canExecute.blockedBy?.length} dependent plan(s) are completed
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Warnings Panel -->
    {#if warningsCount > 0}
      <div class="section">
        <button class="section-header collapsible" on:click={() => showWarnings = !showWarnings}>
          <span class="warning-icon">⚠</span> Warnings ({warningsCount})
          <span class="chevron">{showWarnings ? '▼' : '▶'}</span>
        </button>
        {#if showWarnings}
          <div class="warnings-content">
            {#each plan.warnings as warning}
              <div class="warning-item">{warning}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Steps List -->
    <div class="section">
      <div class="section-header">Steps ({stepCount})</div>
      <div class="steps-list">
        {#each plan.actionPlan.steps as step, index (step.id)}
          <StepInspector
            {step}
            {index}
            expanded={expandedStepIds.has(step.id)}
            executionResult={getStepResult(step.id)}
            on:toggle={() => toggleStep(step.id)}
          />
        {/each}
      </div>
    </div>

    <!-- Dependencies Section -->
    {#if dependenciesCount > 0 || dependentsCount > 0}
      <div class="section">
        <button class="section-header collapsible" on:click={() => showDependencies = !showDependencies}>
          <span class="dependency-icon">🔗</span> Dependencies ({dependenciesCount + dependentsCount})
          <span class="chevron">{showDependencies ? '▼' : '▶'}</span>
        </button>
        {#if showDependencies}
          <div class="dependencies-content">
            {#if dependenciesCount > 0}
              <div class="dependency-section">
                <div class="dependency-label">This plan depends on:</div>
                {#each dependencies as dep (dep.id)}
                  <div class="dependency-item">
                    <button class="dependency-link" on:click={() => handleViewPlan(dep.id)}>
                      <span class="dep-icon">{getStatusIcon(dep.status)}</span>
                      <span class="dep-title">{dep.title}</span>
                      <span class="dep-status">{dep.status}</span>
                    </button>
                    <button
                      class="remove-dep-btn"
                      on:click={() => handleRemoveDependency(dep.id)}
                      title="Remove dependency"
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
            {#if dependentsCount > 0}
              <div class="dependency-section">
                <div class="dependency-label">Plans that depend on this:</div>
                {#each dependents as dep (dep.id)}
                  <div class="dependency-item">
                    <button class="dependency-link" on:click={() => handleViewPlan(dep.id)}>
                      <span class="dep-icon">{getStatusIcon(dep.status)}</span>
                      <span class="dep-title">{dep.title}</span>
                      <span class="dep-status">{dep.status}</span>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
            <div class="dependency-actions">
              <button class="add-dependency-btn" on:click={() => handleAction("addDependency")}>
                + Add Dependency
              </button>
              <button class="view-graph-btn" on:click={() => handleAction("viewDependencyGraph")}>
                View Graph
              </button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="section">
        <div class="section-header">Dependencies</div>
        <div class="no-dependencies">
          <p>No dependencies</p>
          <button class="add-dependency-btn" on:click={() => handleAction("addDependency")}>
            + Add Dependency
          </button>
        </div>
      </div>
    {/if}

    <!-- Execution History -->
    {#if historyCount > 0}
      <div class="section">
        <button class="section-header collapsible" on:click={() => showHistory = !showHistory}>
          Execution History ({historyCount})
          <span class="chevron">{showHistory ? '▼' : '▶'}</span>
        </button>
        {#if showHistory}
          <div class="history-content">
            <ExecutionTimeline
              attempts={plan.executionHistory}
              on:select={(e) => dispatch("action", { action: "viewAttempt", attempt: e.detail.attempt })}
            />
          </div>
        {/if}
      </div>
    {/if}

    <!-- Notes Section -->
    <div class="section">
      <div class="section-header">Notes</div>
      <textarea
        class="notes-textarea"
        bind:value={notesText}
        on:blur={handleNotesBlur}
        placeholder="Add notes about this plan..."
      ></textarea>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="actions-bar">
    {#each actionButtons as button}
      <button
        class="action-btn"
        class:primary={button.primary}
        class:secondary={!button.primary}
        disabled={button.disabled}
        on:click={() => handleAction(button.action)}
      >
        {button.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .plan-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-primary);
  }

  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .back-btn {
    font-size: 12px;
    padding: 4px 10px;
    background: transparent;
    border: none;
    color: var(--interactive-accent);
    cursor: pointer;
    font-weight: 500;
  }

  .back-btn:hover {
    text-decoration: underline;
  }

  .menu-btn {
    font-size: 18px;
    padding: 4px 8px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .menu-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    border-radius: 4px;
  }

  .title-section {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .title-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .title-input {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 4px 0;
    outline: none;
  }

  .title-input:focus {
    border-bottom-color: var(--interactive-accent);
  }

  .priority-selector {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    background: var(--background-modifier-border);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .priority-selector:hover {
    background: var(--background-modifier-hover);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .status-badge.gray {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .status-badge.orange {
    background: rgba(255, 165, 0, 0.15);
    color: var(--color-orange);
  }

  .status-badge.blue {
    background: rgba(0, 100, 255, 0.15);
    color: var(--interactive-accent);
  }

  .status-badge.yellow {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
  }

  .status-badge.green {
    background: rgba(0, 200, 0, 0.15);
    color: var(--color-green);
  }

  .status-badge.red {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .status-icon {
    font-size: 12px;
  }

  .risk-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  .risk-badge.writes {
    background: rgba(255, 165, 0, 0.2);
    color: var(--color-orange);
  }

  .risk-badge.commands {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .section {
    margin-bottom: 20px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-header {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-header.collapsible {
    width: 100%;
    padding: 6px 8px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
  }

  .section-header.collapsible:hover {
    background: var(--background-modifier-hover);
  }

  .warning-icon,
  .dependency-icon {
    font-size: 14px;
  }

  .warning-icon {
    color: var(--color-orange);
  }

  .chevron {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-faint);
  }

  .goal-text {
    font-size: 13px;
    color: var(--text-normal);
    line-height: 1.5;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .blocked-banner {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid var(--color-orange);
    border-radius: 6px;
    align-items: start;
  }

  .blocked-icon {
    font-size: 24px;
  }

  .blocked-content {
    flex: 1;
  }

  .blocked-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-orange);
    margin-bottom: 4px;
  }

  .blocked-description {
    font-size: 12px;
    color: var(--text-normal);
    line-height: 1.4;
  }

  .warnings-content {
    margin-top: 8px;
    padding: 10px 12px;
    background: rgba(255, 165, 0, 0.1);
    border-radius: 6px;
  }

  .warning-item {
    font-size: 12px;
    color: var(--color-orange);
    margin-bottom: 6px;
    display: flex;
    align-items: start;
  }

  .warning-item:last-child {
    margin-bottom: 0;
  }

  .warning-item::before {
    content: "⚠";
    margin-right: 6px;
    flex-shrink: 0;
  }

  .steps-list {
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
  }

  .dependencies-content {
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .dependency-section {
    margin-bottom: 16px;
  }

  .dependency-section:last-of-type {
    margin-bottom: 12px;
  }

  .dependency-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .dependency-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .dependency-item:last-child {
    margin-bottom: 0;
  }

  .dependency-link {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .dependency-link:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .dep-icon {
    font-size: 12px;
    color: var(--text-muted);
  }

  .dep-title {
    flex: 1;
    font-size: 12px;
    color: var(--text-normal);
  }

  .dep-status {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .remove-dep-btn {
    padding: 2px 8px;
    font-size: 18px;
    line-height: 1;
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .remove-dep-btn:hover {
    background: var(--background-modifier-error);
    border-color: var(--color-red);
    color: var(--color-red);
  }

  .dependency-actions {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .add-dependency-btn,
  .view-graph-btn {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-dependency-btn {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .add-dependency-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .view-graph-btn {
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .view-graph-btn:hover {
    background: var(--background-modifier-hover);
  }

  .no-dependencies {
    padding: 20px;
    text-align: center;
    background: var(--background-secondary);
    border-radius: 6px;
  }

  .no-dependencies p {
    margin: 0 0 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .history-content {
    margin-top: 8px;
  }

  .notes-textarea {
    width: 100%;
    min-height: 100px;
    padding: 10px 12px;
    font-size: 12px;
    font-family: var(--font-text);
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    resize: vertical;
    outline: none;
  }

  .notes-textarea:focus {
    border-color: var(--interactive-accent);
  }

  .notes-textarea::placeholder {
    color: var(--text-faint);
  }

  .actions-bar {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .action-btn {
    font-size: 12px;
    padding: 6px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .action-btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .action-btn.secondary {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .action-btn.secondary:hover:not(:disabled) {
    background: var(--background-modifier-active-hover);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
