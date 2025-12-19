<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { PlanTemplate, TemplateParameter } from "../types/PlanTemplate";

  export let template: PlanTemplate;
  export let contextInfo: {
    activeFile?: string;
    selection?: string;
  } = {};

  const dispatch = createEventDispatcher();

  // Parameter values
  let parameterValues: Record<string, string> = {};

  // Initialize parameter values with defaults and context
  function initializeValues() {
    parameterValues = {};

    for (const param of template.parameters) {
      // Use context values if available
      if (param.type === "selection" && contextInfo.selection) {
        parameterValues[param.name] = contextInfo.selection;
      } else if (param.type === "file" && contextInfo.activeFile) {
        parameterValues[param.name] = contextInfo.activeFile;
      } else if (param.defaultValue !== undefined) {
        parameterValues[param.name] = param.defaultValue;
      } else {
        parameterValues[param.name] = "";
      }
    }
  }

  // Initialize on mount and when template changes
  $: if (template) {
    initializeValues();
  }

  // Validation
  $: isValid = template.parameters.every(
    (param) => !param.required || parameterValues[param.name]?.trim()
  );

  // Preview of resulting plan
  $: preview = generatePreview();

  function generatePreview(): string {
    try {
      let goalPreview = template.actionPlan.goal;

      // Replace placeholders with actual values
      for (const [key, value] of Object.entries(parameterValues)) {
        const placeholder = new RegExp(`\\$\\{${key}\\}`, "g");
        goalPreview = goalPreview.replace(
          placeholder,
          value || `[${key}]`
        );
      }

      return goalPreview;
    } catch (error) {
      return template.actionPlan.goal;
    }
  }

  function handleSubmit() {
    if (!isValid) {
      return;
    }

    dispatch("submit", { parameters: parameterValues });
  }

  function handleCancel() {
    dispatch("cancel");
  }
</script>

<div class="parameter-form">
  <!-- Header -->
  <div class="form-header">
    <div class="template-title">
      {#if template.icon}
        <span class="template-icon">{template.icon}</span>
      {/if}
      <span>{template.name}</span>
    </div>
    <div class="template-description">{template.description}</div>
  </div>

  <!-- Parameter Fields -->
  <div class="form-content">
    {#if template.parameters.length === 0}
      <div class="no-params-message">
        This template has no parameters. Click "Create Plan" to use it.
      </div>
    {:else}
      {#each template.parameters as param (param.name)}
        <div class="form-field">
          <label class="field-label" for={param.name}>
            {param.label}
            {#if param.required}
              <span class="required-mark">*</span>
            {/if}
          </label>

          {#if param.description}
            <div class="field-description">{param.description}</div>
          {/if}

          {#if param.type === "selection"}
            <!-- Selection (read-only textarea) -->
            <textarea
              id={param.name}
              class="field-input selection-input"
              bind:value={parameterValues[param.name]}
              placeholder={param.placeholder || "No selection available"}
              rows="3"
              readonly
            ></textarea>
          {:else if param.type === "folder" || param.type === "file"}
            <!-- Path input with browse button -->
            <div class="path-input-group">
              <input
                id={param.name}
                type="text"
                class="field-input"
                bind:value={parameterValues[param.name]}
                placeholder={param.placeholder || `Enter ${param.type} path`}
                required={param.required}
              />
              <button
                class="browse-btn"
                on:click={() => dispatch("browse", { param })}
                title="Browse"
              >
                📁
              </button>
            </div>
          {:else if param.type === "number"}
            <!-- Number input -->
            <input
              id={param.name}
              type="number"
              class="field-input"
              bind:value={parameterValues[param.name]}
              placeholder={param.placeholder || `Enter ${param.label.toLowerCase()}`}
              required={param.required}
            />
          {:else if param.type === "date"}
            <!-- Date input -->
            <input
              id={param.name}
              type="date"
              class="field-input"
              bind:value={parameterValues[param.name]}
              placeholder={param.placeholder || `Enter ${param.label.toLowerCase()}`}
              required={param.required}
            />
          {:else}
            <!-- String input (default) -->
            <input
              id={param.name}
              type="text"
              class="field-input"
              bind:value={parameterValues[param.name]}
              placeholder={param.placeholder || `Enter ${param.label.toLowerCase()}`}
              required={param.required}
            />
          {/if}
        </div>
      {/each}
    {/if}

    <!-- Preview Section -->
    <div class="preview-section">
      <div class="preview-label">Preview</div>
      <div class="preview-content">{preview}</div>
      <div class="preview-details">
        <span class="detail-item">
          {template.actionPlan.steps.length} steps
        </span>
        <span class="detail-item risk-{template.actionPlan.riskLevel}">
          {template.actionPlan.riskLevel}
        </span>
      </div>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="form-actions">
    <button class="cancel-btn" on:click={handleCancel}> Cancel </button>
    <button class="submit-btn" on:click={handleSubmit} disabled={!isValid}>
      Create Plan
    </button>
  </div>
</div>

<style>
  .parameter-form {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-primary);
  }

  .form-header {
    padding: 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .template-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .template-icon {
    font-size: 20px;
  }

  .template-description {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .form-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .no-params-message {
    padding: 40px 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }

  .form-field {
    margin-bottom: 16px;
  }

  .field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 4px;
  }

  .required-mark {
    color: var(--text-error);
  }

  .field-description {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .field-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-family: var(--font-text);
  }

  .field-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .field-input::placeholder {
    color: var(--text-faint);
  }

  .field-input:invalid {
    border-color: var(--text-error);
  }

  .selection-input {
    resize: vertical;
    font-family: var(--font-monospace);
    font-size: 11px;
  }

  .path-input-group {
    display: flex;
    gap: 6px;
  }

  .path-input-group .field-input {
    flex: 1;
  }

  .browse-btn {
    width: 36px;
    padding: 0;
    font-size: 16px;
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .browse-btn:hover {
    background: var(--background-modifier-active-hover);
  }

  .preview-section {
    margin-top: 24px;
    padding: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .preview-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .preview-content {
    font-size: 13px;
    color: var(--text-normal);
    line-height: 1.5;
    margin-bottom: 10px;
  }

  .preview-details {
    display: flex;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .detail-item {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    border-radius: 3px;
  }

  .detail-item.risk-writes {
    background: rgba(255, 165, 0, 0.2);
    color: var(--color-orange);
  }

  .detail-item.risk-commands {
    background: rgba(255, 0, 0, 0.15);
    color: var(--color-red);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .cancel-btn,
  .submit-btn {
    padding: 6px 16px;
    font-size: 12px;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .cancel-btn:hover {
    background: var(--background-modifier-active-hover);
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
</style>
