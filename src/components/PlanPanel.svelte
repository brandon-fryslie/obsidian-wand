<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    filteredPlans,
    activePlanId,
    filters,
    activePlan,
    executingPlan,
    plans,
    recentEvents,
  } from "../stores/planStore";
  import PlanFiltersBar from "./PlanFiltersBar.svelte";
  import PlanList from "./PlanList.svelte";
  import PlanDetail from "./PlanDetail.svelte";
  import PromptInput from "./PromptInput.svelte";
  import ExecutionOverlay from "./ExecutionOverlay.svelte";
  import ProgressDashboard from "./ProgressDashboard.svelte";
  import ActivityLog from "./ActivityLog.svelte";
  import PlanStatistics from "./PlanStatistics.svelte";
  import TemplateGallery from "./TemplateGallery.svelte";
  import ParameterForm from "./ParameterForm.svelte";
  import type { PlanFilters } from "../types/PlanFilters";
  import type { Plan } from "../types/Plan";
  import type { ExecutionProgress } from "../services/ExecutionManager";
  import type { PlanTemplate } from "../types/PlanTemplate";

  const dispatch = createEventDispatcher();

  export let contextInfo: {
    activeFile?: string;
    selection?: string;
  } = {};

  export let executionProgress: ExecutionProgress | null = null;

  // Templates (will be provided by parent)
  export let templates: PlanTemplate[] = [];

  let showDetail = false;
  let showPromptInput = false;
  let isGenerating = false;
  let generationError: string | null = null;

  // Template state
  let showTemplateForm = false;
  let selectedTemplate: PlanTemplate | null = null;

  // View mode: "plans" | "dashboard" | "activity" | "templates"
  let viewMode: "plans" | "dashboard" | "activity" | "templates" = "plans";

  // Subscribe to active plan to show detail when selected
  $: if ($activePlanId && $activePlan) {
    showDetail = true;
    viewMode = "plans"; // Switch back to plans view when selecting a plan
  }

  // Show overlay when execution is in progress
  $: showExecutionOverlay = executionProgress !== null;

  function handleFilterChange(event: CustomEvent<PlanFilters>) {
    filters.set(event.detail);
  }

  function handleSelectPlan(event: CustomEvent<{ plan: Plan }>) {
    activePlanId.set(event.detail.plan.id);
    showDetail = true;
    dispatch("selectPlan", event.detail);
  }

  function handlePlanAction(event: CustomEvent<{ action: string; plan: Plan }>) {
    if (event.detail.action === "open") {
      // Double-click opens detail view
      activePlanId.set(event.detail.plan.id);
      showDetail = true;
    }
    dispatch("planAction", event.detail);
  }

  function handleDetailAction(event: CustomEvent) {
    const { action, ...params } = event.detail;

    if (action === "back") {
      showDetail = false;
      // Don't clear active plan, just hide detail
    } else if (action === "saveTemplate") {
      // Handle save as template action
      dispatch("saveAsTemplate", {
        plan: $activePlan,
      });
    } else {
      // Forward other actions with the active plan
      dispatch("planAction", {
        action,
        plan: $activePlan,
        ...params,
      });
    }
  }

  function handleNewPlan() {
    showPromptInput = true;
    showDetail = false;
    generationError = null;
  }

  async function handlePromptSubmit(event: CustomEvent<{ prompt: string }>) {
    const { prompt } = event.detail;
    isGenerating = true;
    generationError = null;

    try {
      // Dispatch to parent to generate plan
      dispatch("generatePlan", { prompt, context: contextInfo });
    } catch (error) {
      console.error("Error generating plan:", error);
      generationError = error instanceof Error ? error.message : String(error);
      isGenerating = false;
    }
  }

  function handlePromptCancel() {
    dispatch("cancelGeneration");
    isGenerating = false;
    showPromptInput = false;
  }

  function handleRetry() {
    generationError = null;
  }

  function handleCancelPrompt() {
    showPromptInput = false;
    generationError = null;
  }

  function handleExecutionPause() {
    dispatch("planAction", { action: "pause" });
  }

  function handleExecutionCancel() {
    dispatch("planAction", { action: "cancel" });
  }

  function handleDashboardStatusFilter(
    event: CustomEvent<{ status: string }>
  ) {
    // Switch to plans view and filter by status
    viewMode = "plans";
    filters.update((f) => ({
      ...f,
      status: [event.detail.status as any],
    }));
  }

  function handleActivitySelect(event: CustomEvent<{ planId: string }>) {
    // Switch to plans view and select the plan
    viewMode = "plans";
    activePlanId.set(event.detail.planId);
    showDetail = true;
  }

  function switchView(mode: "plans" | "dashboard" | "activity" | "templates") {
    viewMode = mode;
    showDetail = false;
    showPromptInput = false;
    showTemplateForm = false;
    selectedTemplate = null;
  }

  // Template handlers
  function handleUseTemplate(event: CustomEvent<{ template: PlanTemplate }>) {
    selectedTemplate = event.detail.template;
    showTemplateForm = true;
  }

  function handleDeleteTemplate(event: CustomEvent<{ template: PlanTemplate }>) {
    dispatch("deleteTemplate", { template: event.detail.template });
  }

  function handleNewTemplate() {
    dispatch("newTemplate");
  }

  function handleTemplateFormSubmit(
    event: CustomEvent<{ parameters: Record<string, any> }>
  ) {
    if (!selectedTemplate) return;

    dispatch("createFromTemplate", {
      template: selectedTemplate,
      parameters: event.detail.parameters,
    });

    // Reset template form
    showTemplateForm = false;
    selectedTemplate = null;

    // Switch back to plans view
    viewMode = "plans";
  }

  function handleTemplateFormCancel() {
    showTemplateForm = false;
    selectedTemplate = null;
  }

  // Export method to indicate generation complete
  export function onGenerationComplete(success: boolean, error?: string) {
    isGenerating = false;
    if (success) {
      showPromptInput = false;
      generationError = null;
    } else {
      generationError = error || "Failed to generate plan";
    }
  }
</script>

<div class="plan-panel">
  {#if showDetail && $activePlan}
    <!-- Detail View -->
    <PlanDetail plan={$activePlan} on:action={handleDetailAction} />
  {:else if showPromptInput}
    <!-- Prompt Input View -->
    <div class="prompt-view">
      <!-- Header -->
      <div class="panel-header">
        <button
          class="back-btn"
          on:click={handleCancelPrompt}
          title="Back to list"
        >
          ← Back
        </button>
        <span class="title">Create New Plan</span>
      </div>

      <!-- Prompt Input -->
      <div class="prompt-container">
        <PromptInput
          {contextInfo}
          disabled={isGenerating}
          on:submit={handlePromptSubmit}
          on:cancel={handlePromptCancel}
        />

        <!-- Error Display -->
        {#if generationError}
          <div class="error-container">
            <div class="error-message">
              <div class="error-title">Generation Failed</div>
              <div class="error-details">{generationError}</div>
            </div>
            <div class="error-actions">
              <button class="retry-btn" on:click={handleRetry}>
                Try Again
              </button>
              <button class="dismiss-btn" on:click={handleCancelPrompt}>
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else if showTemplateForm && selectedTemplate}
    <!-- Template Parameter Form View -->
    <div class="template-form-view">
      <div class="panel-header">
        <button
          class="back-btn"
          on:click={handleTemplateFormCancel}
          title="Back to templates"
        >
          ← Back
        </button>
        <span class="title">Configure Template</span>
      </div>
      <ParameterForm
        template={selectedTemplate}
        {contextInfo}
        on:submit={handleTemplateFormSubmit}
        on:cancel={handleTemplateFormCancel}
      />
    </div>
  {:else}
    <!-- Main View with Tabs -->
    <div class="main-view">
      <!-- Header with Tabs -->
      <div class="panel-header">
        <div class="tabs">
          <button
            class="tab"
            class:active={viewMode === "plans"}
            on:click={() => switchView("plans")}
          >
            Plans
          </button>
          <button
            class="tab"
            class:active={viewMode === "dashboard"}
            on:click={() => switchView("dashboard")}
          >
            Dashboard
          </button>
          <button
            class="tab"
            class:active={viewMode === "activity"}
            on:click={() => switchView("activity")}
          >
            Activity
          </button>
          <button
            class="tab"
            class:active={viewMode === "templates"}
            on:click={() => switchView("templates")}
          >
            Templates
          </button>
        </div>

        {#if viewMode === "plans"}
          <button
            class="new-plan-btn"
            on:click={handleNewPlan}
            title="Create new plan"
          >
            + New Plan
          </button>
        {/if}
      </div>

      <!-- View Content -->
      {#if viewMode === "plans"}
        <!-- Plans List View -->
        <div class="list-view">
          <!-- Filters -->
          <PlanFiltersBar filters={$filters} on:change={handleFilterChange} />

          <!-- Plan List -->
          <PlanList
            plans={$filteredPlans}
            selectedId={$activePlanId}
            on:select={handleSelectPlan}
            on:action={handlePlanAction}
          />
        </div>
      {:else if viewMode === "dashboard"}
        <!-- Dashboard View -->
        <div class="dashboard-view">
          <ProgressDashboard
            plans={$plans}
            on:filterByStatus={handleDashboardStatusFilter}
          />
          <PlanStatistics plans={$plans} />
        </div>
      {:else if viewMode === "activity"}
        <!-- Activity View -->
        <div class="activity-view">
          <ActivityLog events={$recentEvents} on:select={handleActivitySelect} />
        </div>
      {:else if viewMode === "templates"}
        <!-- Templates View -->
        <div class="templates-view">
          <TemplateGallery
            {templates}
            on:use={handleUseTemplate}
            on:delete={handleDeleteTemplate}
            on:new={handleNewTemplate}
          />
        </div>
      {/if}
    </div>
  {/if}

  <!-- Execution Overlay (shown when executing) -->
  {#if showExecutionOverlay && executionProgress}
    <ExecutionOverlay
      progress={executionProgress}
      on:pause={handleExecutionPause}
      on:cancel={handleExecutionCancel}
    />
  {/if}
</div>

<style>
  .plan-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-secondary);
    font-size: 13px;
  }

  .main-view,
  .prompt-view,
  .template-form-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    gap: 12px;
  }

  .title {
    font-weight: 600;
    color: var(--text-normal);
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 4px;
  }

  .tab {
    font-size: 12px;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .tab:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .tab.active {
    background: var(--background-primary);
    color: var(--text-normal);
    font-weight: 600;
  }

  .new-plan-btn,
  .back-btn {
    font-size: 11px;
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    white-space: nowrap;
  }

  .new-plan-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .new-plan-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .back-btn {
    background: transparent;
    color: var(--text-muted);
  }

  .back-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* View Containers */
  .list-view,
  .dashboard-view,
  .activity-view,
  .templates-view {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .dashboard-view {
    overflow-y: auto;
  }

  .activity-view {
    overflow: hidden;
  }

  .templates-view {
    overflow: hidden;
  }

  .prompt-container {
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error-container {
    padding: 12px;
    border: 1px solid var(--background-modifier-error);
    border-radius: 6px;
    background: var(--background-primary);
  }

  .error-message {
    margin-bottom: 12px;
  }

  .error-title {
    font-weight: 600;
    color: var(--text-error);
    margin-bottom: 6px;
  }

  .error-details {
    font-size: 12px;
    color: var(--text-normal);
    white-space: pre-wrap;
  }

  .error-actions {
    display: flex;
    gap: 8px;
  }

  .retry-btn,
  .dismiss-btn {
    font-size: 12px;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }

  .retry-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .retry-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .dismiss-btn {
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
  }

  .dismiss-btn:hover {
    background: var(--background-modifier-hover);
  }
</style>
