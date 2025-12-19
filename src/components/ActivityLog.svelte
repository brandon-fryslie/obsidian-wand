<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { PlanEvent } from "../types/PlanEvents";
  import { formatTime, formatRelativeTime } from "../utils/timeFormatting";

  export let events: PlanEvent[] = [];
  export let maxEvents: number = 50;

  const dispatch = createEventDispatcher();

  // Filter state
  let selectedFilter: string = "all";
  let expandedEvents: Set<string> = new Set();

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Events" },
    { value: "created", label: "Created" },
    { value: "status-changed", label: "Status Changed" },
    { value: "execution-started", label: "Execution Started" },
    { value: "execution-completed", label: "Execution Completed" },
    { value: "deleted", label: "Deleted" },
  ];

  // Apply filter
  $: filteredEvents =
    selectedFilter === "all"
      ? events
      : events.filter((e) => e.type === selectedFilter);

  // Limit number of events displayed
  $: displayedEvents = filteredEvents.slice(0, maxEvents);

  function handleEventClick(event: PlanEvent) {
    if (event.type === "created" || event.type === "status-changed") {
      const planId =
        event.type === "created" ? event.plan.id : event.planId;
      dispatch("select", { planId });
    }
  }

  function toggleExpanded(eventId: string) {
    if (expandedEvents.has(eventId)) {
      expandedEvents.delete(eventId);
    } else {
      expandedEvents.add(eventId);
    }
    expandedEvents = expandedEvents; // Trigger reactivity
  }

  function getEventIcon(event: PlanEvent): string {
    switch (event.type) {
      case "created":
        return "+";
      case "status-changed":
        if (event.to === "completed") return "✓";
        if (event.to === "failed") return "✗";
        if (event.to === "executing") return "◐";
        return "●";
      case "execution-started":
        return "▶";
      case "execution-completed":
        return event.result.success ? "✓" : "✗";
      case "deleted":
        return "🗑";
      default:
        return "•";
    }
  }

  function getEventDescription(event: PlanEvent): string {
    switch (event.type) {
      case "created":
        return `"${event.plan.title}" created`;
      case "status-changed":
        return `Plan status changed: ${event.from} → ${event.to}`;
      case "execution-started":
        return "Execution started";
      case "execution-progress":
        return `Step ${event.step}/${event.total} completed`;
      case "execution-completed":
        return event.result.success
          ? "Execution completed successfully"
          : `Execution failed: ${event.result.error || "Unknown error"}`;
      case "updated":
        return "Plan updated";
      case "deleted":
        return "Plan deleted";
      default:
        return "Unknown event";
    }
  }

  function getEventClass(event: PlanEvent): string {
    switch (event.type) {
      case "created":
        return "event-created";
      case "execution-completed":
        return event.result.success ? "event-success" : "event-error";
      case "status-changed":
        if (event.to === "completed") return "event-success";
        if (event.to === "failed") return "event-error";
        return "event-info";
      case "deleted":
        return "event-deleted";
      default:
        return "event-info";
    }
  }

  function getEventId(event: PlanEvent, index: number): string {
    return `${event.timestamp.getTime()}-${index}`;
  }
</script>

<div class="activity-log">
  <!-- Header -->
  <div class="log-header">
    <h3 class="log-title">Activity Log</h3>

    <select
      class="filter-select"
      bind:value={selectedFilter}
      title="Filter events"
    >
      {#each filterOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <!-- Event List -->
  <div class="event-list">
    {#if displayedEvents.length === 0}
      <div class="empty-state">
        {selectedFilter === "all"
          ? "No activity yet"
          : "No events match this filter"}
      </div>
    {:else}
      {#each displayedEvents as event, index (getEventId(event, index))}
        {@const eventId = getEventId(event, index)}
        {@const isExpanded = expandedEvents.has(eventId)}
        {@const hasDetails =
          event.type === "execution-completed" && event.result.error}

        <div class="event-item {getEventClass(event)}">
          <button
            class="event-content"
            on:click={() => handleEventClick(event)}
            title="View plan"
          >
            <span class="event-time">
              {formatTime(event.timestamp)}
            </span>

            <span class="event-icon">{getEventIcon(event)}</span>

            <span class="event-description">
              {getEventDescription(event)}
            </span>

            <span class="event-relative">
              {formatRelativeTime(event.timestamp)}
            </span>
          </button>

          {#if hasDetails}
            <button
              class="event-toggle"
              on:click={() => toggleExpanded(eventId)}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "▼" : "▶"}
            </button>

            {#if isExpanded}
              <div class="event-details">
                <div class="error-details">
                  {event.result.error}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/each}

      {#if filteredEvents.length > maxEvents}
        <div class="load-more">
          Showing {maxEvents} of {filteredEvents.length} events
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .activity-log {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .log-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  .filter-select {
    font-size: 11px;
    padding: 4px 8px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    cursor: pointer;
  }

  .filter-select:hover {
    background: var(--background-modifier-hover);
  }

  /* Event List */
  .event-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  .event-item {
    margin-bottom: 4px;
    border-radius: 4px;
    overflow: hidden;
    border-left: 3px solid var(--background-modifier-border);
  }

  .event-item.event-created {
    border-left-color: var(--text-accent);
  }

  .event-item.event-success {
    border-left-color: var(--text-success);
  }

  .event-item.event-error {
    border-left-color: var(--text-error);
  }

  .event-item.event-deleted {
    border-left-color: var(--text-muted);
  }

  .event-content {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    width: 100%;
    background: var(--background-primary);
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .event-content:hover {
    background: var(--background-modifier-hover);
  }

  .event-time {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .event-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
  }

  .event-description {
    font-size: 12px;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-relative {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .event-toggle {
    padding: 4px 12px;
    background: var(--background-primary);
    border: none;
    border-top: 1px solid var(--background-modifier-border);
    cursor: pointer;
    font-size: 10px;
    color: var(--text-muted);
    width: 100%;
    text-align: left;
  }

  .event-toggle:hover {
    background: var(--background-modifier-hover);
  }

  .event-details {
    padding: 8px 12px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
  }

  .error-details {
    font-size: 11px;
    color: var(--text-error);
    font-family: var(--font-monospace);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .load-more {
    padding: 12px;
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
