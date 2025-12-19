<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { PlanTemplate, TemplateCategory } from "../types/PlanTemplate";

  export let templates: PlanTemplate[];
  export let searchQuery: string = "";
  export let selectedCategory: TemplateCategory | "all" = "all";

  const dispatch = createEventDispatcher();

  // Category options
  const categories: Array<{ value: TemplateCategory | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "daily-notes", label: "Daily Notes" },
    { value: "organization", label: "Organization" },
    { value: "creation", label: "Creation" },
    { value: "search", label: "Search" },
    { value: "custom", label: "Custom" },
  ];

  // Filter templates based on search and category
  $: filteredTemplates = templates.filter((template) => {
    // Category filter
    if (selectedCategory !== "all" && template.category !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Group by built-in vs custom
  $: builtInTemplates = filteredTemplates.filter((t) => t.isBuiltIn);
  $: customTemplates = filteredTemplates.filter((t) => !t.isBuiltIn);

  function handleUseTemplate(template: PlanTemplate) {
    dispatch("use", { template });
  }

  function handleDeleteTemplate(template: PlanTemplate) {
    dispatch("delete", { template });
  }

  function handleNewTemplate() {
    dispatch("new");
  }
</script>

<div class="template-gallery">
  <!-- Header with Search and Actions -->
  <div class="gallery-header">
    <div class="search-section">
      <input
        type="text"
        class="search-input"
        placeholder="Search templates..."
        bind:value={searchQuery}
      />
      <button class="new-template-btn" on:click={handleNewTemplate}>
        + New Template
      </button>
    </div>

    <!-- Category Filter Tabs -->
    <div class="category-tabs">
      {#each categories as category}
        <button
          class="category-tab"
          class:active={selectedCategory === category.value}
          on:click={() => (selectedCategory = category.value)}
        >
          {category.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Templates Grid -->
  <div class="templates-container">
    {#if filteredTemplates.length === 0}
      <!-- Empty State -->
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-message">
          {#if searchQuery}
            No templates match your search
          {:else}
            No templates in this category
          {/if}
        </div>
        {#if selectedCategory === "custom" && !searchQuery}
          <button class="empty-action-btn" on:click={handleNewTemplate}>
            Create Your First Template
          </button>
        {/if}
      </div>
    {:else}
      <!-- Built-in Templates Section -->
      {#if builtInTemplates.length > 0}
        <div class="section">
          <div class="section-title">Built-in Templates</div>
          <div class="templates-grid">
            {#each builtInTemplates as template (template.id)}
              <div class="template-card">
                <div class="card-header">
                  {#if template.icon}
                    <span class="template-icon">{template.icon}</span>
                  {/if}
                  <div class="template-name">{template.name}</div>
                  <span class="builtin-badge">Built-in</span>
                </div>
                <div class="template-description">{template.description}</div>
                <div class="card-footer">
                  <div class="usage-count">Used {template.usageCount}x</div>
                  <button
                    class="use-btn"
                    on:click={() => handleUseTemplate(template)}
                  >
                    Use →
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Custom Templates Section -->
      {#if customTemplates.length > 0}
        <div class="section">
          <div class="section-title">Custom Templates</div>
          <div class="templates-grid">
            {#each customTemplates as template (template.id)}
              <div class="template-card">
                <div class="card-header">
                  {#if template.icon}
                    <span class="template-icon">{template.icon}</span>
                  {/if}
                  <div class="template-name">{template.name}</div>
                  <button
                    class="delete-btn"
                    on:click={() => handleDeleteTemplate(template)}
                    title="Delete template"
                  >
                    ×
                  </button>
                </div>
                <div class="template-description">{template.description}</div>
                <div class="card-footer">
                  <div class="usage-count">Used {template.usageCount}x</div>
                  <button
                    class="use-btn"
                    on:click={() => handleUseTemplate(template)}
                  >
                    Use →
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .template-gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .gallery-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .search-section {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .search-input {
    flex: 1;
    padding: 6px 12px;
    font-size: 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .search-input::placeholder {
    color: var(--text-faint);
  }

  .new-template-btn {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 500;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }

  .new-template-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .category-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }

  .category-tab {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .category-tab:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .category-tab.active {
    background: var(--background-primary);
    color: var(--text-normal);
    font-weight: 600;
  }

  .templates-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .section {
    margin-bottom: 24px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    padding: 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .template-card:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .template-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .template-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .builtin-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    border-radius: 3px;
  }

  .delete-btn {
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 3px;
  }

  .delete-btn:hover {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  .template-description {
    flex: 1;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
    margin-bottom: 10px;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .usage-count {
    font-size: 11px;
    color: var(--text-faint);
  }

  .use-btn {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .use-btn:hover {
    background: var(--interactive-accent-hover);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
  }

  .empty-message {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .empty-action-btn {
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .empty-action-btn:hover {
    background: var(--interactive-accent-hover);
  }
</style>
