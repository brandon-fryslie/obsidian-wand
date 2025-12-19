<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { PlanFilters, PlanSortField, SortOrder } from "../types/PlanFilters";
  import { PlanStatus } from "../types/Plan";

  export let filters: PlanFilters;

  const dispatch = createEventDispatcher();

  let searchInput = filters.search || "";
  let searchDebounce: NodeJS.Timeout;

  // Status options
  const statusOptions: { value: PlanStatus; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "executing", label: "Executing" },
    { value: "paused", label: "Paused" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  // Sort options
  const sortOptions: { value: PlanSortField; label: string }[] = [
    { value: "updatedAt", label: "Recently Updated" },
    { value: "createdAt", label: "Recently Created" },
    { value: "priority", label: "Priority" },
    { value: "title", label: "Title" },
    { value: "status", label: "Status" },
  ];

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchInput = target.value;

    // Debounce search
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const newFilters = { ...filters, search: searchInput || undefined };
      dispatch("change", newFilters);
    }, 300);
  }

  function toggleStatus(status: PlanStatus) {
    const currentStatuses = filters.status || [];
    let newStatuses: PlanStatus[];

    if (currentStatuses.includes(status)) {
      newStatuses = currentStatuses.filter((s) => s !== status);
    } else {
      newStatuses = [...currentStatuses, status];
    }

    const newFilters = {
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    };
    dispatch("change", newFilters);
  }

  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newFilters = {
      ...filters,
      sortBy: target.value as PlanSortField,
    };
    dispatch("change", newFilters);
  }

  function toggleSortOrder() {
    const newFilters = {
      ...filters,
      sortOrder: filters.sortOrder === "asc" ? ("desc" as SortOrder) : ("asc" as SortOrder),
    };
    dispatch("change", newFilters);
  }

  function clearFilters() {
    searchInput = "";
    const newFilters: PlanFilters = {
      sortBy: "updatedAt",
      sortOrder: "desc",
    };
    dispatch("change", newFilters);
  }

  // Check if any filters are active
  $: hasActiveFilters =
    (filters.status && filters.status.length > 0) ||
    (filters.search && filters.search.length > 0) ||
    (filters.tags && filters.tags.length > 0) ||
    filters.pinnedOnly;

  // Status dropdown open state
  let statusDropdownOpen = false;

  function toggleStatusDropdown() {
    statusDropdownOpen = !statusDropdownOpen;
  }

  function closeStatusDropdown() {
    statusDropdownOpen = false;
  }
</script>

<svelte:window on:click={closeStatusDropdown} />

<div class="filters-bar">
  <!-- Search -->
  <div class="search-box">
    <input
      type="text"
      placeholder="Search plans..."
      value={searchInput}
      on:input={handleSearchInput}
    />
  </div>

  <!-- Status filter -->
  <div class="filter-group">
    <button
      class="filter-dropdown-btn"
      class:active={filters.status && filters.status.length > 0}
      on:click|stopPropagation={toggleStatusDropdown}
    >
      Status
      {#if filters.status && filters.status.length > 0}
        <span class="badge">{filters.status.length}</span>
      {/if}
      <span class="chevron">{statusDropdownOpen ? "▼" : "▶"}</span>
    </button>

    {#if statusDropdownOpen}
      <div class="dropdown-menu" on:click|stopPropagation>
        {#each statusOptions as option}
          {@const isSelected = filters.status?.includes(option.value)}
          <label class="dropdown-item">
            <input
              type="checkbox"
              checked={isSelected}
              on:change={() => toggleStatus(option.value)}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Sort -->
  <div class="filter-group">
    <select class="sort-select" on:change={handleSortChange} value={filters.sortBy}>
      {#each sortOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    <button
      class="sort-order-btn"
      on:click={toggleSortOrder}
      title="Toggle sort order"
    >
      {filters.sortOrder === "asc" ? "↑" : "↓"}
    </button>
  </div>

  <!-- Clear filters -->
  {#if hasActiveFilters}
    <button class="clear-btn" on:click={clearFilters} title="Clear all filters">
      Clear
    </button>
  {/if}
</div>

<style>
  .filters-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 120px;
  }

  .search-box input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 12px;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .search-box input::placeholder {
    color: var(--text-faint);
  }

  .filter-group {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .filter-dropdown-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }

  .filter-dropdown-btn:hover {
    background: var(--background-modifier-hover);
  }

  .filter-dropdown-btn.active {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 10px;
    font-weight: 600;
  }

  .chevron {
    font-size: 9px;
    color: var(--text-faint);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    padding: 4px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    min-width: 150px;
    max-height: 300px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-normal);
  }

  .dropdown-item:hover {
    background: var(--background-modifier-hover);
  }

  .dropdown-item input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
  }

  .sort-select {
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 11px;
    cursor: pointer;
  }

  .sort-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .sort-order-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 14px;
    cursor: pointer;
  }

  .sort-order-btn:hover {
    background: var(--background-modifier-hover);
  }

  .clear-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }
</style>
