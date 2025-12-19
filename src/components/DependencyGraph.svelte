<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Plan, PlanDependency } from "../types/Plan";

  export let plans: Plan[];
  export let selectedPlanId: string | null = null;

  const dispatch = createEventDispatcher();

  interface GraphNode {
    id: string;
    plan: Plan;
    x: number;
    y: number;
    level: number;
  }

  interface GraphEdge {
    from: string;
    to: string;
    type: "blocks" | "related" | "parent-child";
  }

  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  let svgWidth = 600;
  let svgHeight = 400;

  // Build graph layout
  $: {
    const graph = buildGraph(plans, selectedPlanId);
    nodes = graph.nodes;
    edges = graph.edges;
  }

  function buildGraph(
    allPlans: Plan[],
    focusPlanId: string | null
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    if (allPlans.length === 0) {
      return { nodes: [], edges: [] };
    }

    // If there's a focus plan, show only its dependency tree
    const relevantPlans = focusPlanId
      ? getRelevantPlans(allPlans, focusPlanId)
      : allPlans.slice(0, 10); // Limit to 10 plans if no focus

    // Calculate levels (topological sort)
    const levels = calculateLevels(relevantPlans);

    // Position nodes
    const levelGroups: { [level: number]: Plan[] } = {};
    relevantPlans.forEach((plan) => {
      const level = levels.get(plan.id) || 0;
      if (!levelGroups[level]) {
        levelGroups[level] = [];
      }
      levelGroups[level].push(plan);
    });

    const maxLevel = Math.max(...Object.keys(levelGroups).map(Number));
    const levelWidth = svgWidth / (maxLevel + 2);

    const graphNodes: GraphNode[] = [];
    Object.entries(levelGroups).forEach(([levelStr, plansInLevel]) => {
      const level = parseInt(levelStr);
      const levelHeight = svgHeight / (plansInLevel.length + 1);

      plansInLevel.forEach((plan, index) => {
        graphNodes.push({
          id: plan.id,
          plan,
          x: levelWidth * (level + 1),
          y: levelHeight * (index + 1),
          level,
        });
      });
    });

    // Create edges
    const graphEdges: GraphEdge[] = [];
    relevantPlans.forEach((plan) => {
      if (plan.dependencies) {
        plan.dependencies.forEach((dep) => {
          if (
            relevantPlans.find((p) => p.id === dep.toPlanId) &&
            dep.fromPlanId === plan.id
          ) {
            graphEdges.push({
              from: dep.fromPlanId,
              to: dep.toPlanId,
              type: dep.type,
            });
          }
        });
      }
      // Also handle simple dependsOn
      plan.dependsOn.forEach((depId) => {
        if (
          relevantPlans.find((p) => p.id === depId) &&
          !graphEdges.find((e) => e.from === plan.id && e.to === depId)
        ) {
          graphEdges.push({
            from: plan.id,
            to: depId,
            type: "blocks",
          });
        }
      });
    });

    return { nodes: graphNodes, edges: graphEdges };
  }

  function getRelevantPlans(allPlans: Plan[], focusId: string): Plan[] {
    const relevant = new Set<string>();
    const queue = [focusId];

    // Add focus plan
    relevant.add(focusId);

    // Add dependencies (plans this one depends on)
    const focusPlan = allPlans.find((p) => p.id === focusId);
    if (focusPlan) {
      focusPlan.dependsOn.forEach((id) => relevant.add(id));
    }

    // Add dependents (plans that depend on this one)
    allPlans.forEach((plan) => {
      if (plan.dependsOn.includes(focusId)) {
        relevant.add(plan.id);
      }
    });

    return allPlans.filter((p) => relevant.has(p.id));
  }

  function calculateLevels(plans: Plan[]): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    function dfs(planId: string): number {
      if (visited.has(planId)) {
        return levels.get(planId) || 0;
      }
      visited.add(planId);

      const plan = plans.find((p) => p.id === planId);
      if (!plan || plan.dependsOn.length === 0) {
        levels.set(planId, 0);
        return 0;
      }

      const maxDepLevel = Math.max(
        ...plan.dependsOn.map((depId) => dfs(depId))
      );
      const level = maxDepLevel + 1;
      levels.set(planId, level);
      return level;
    }

    plans.forEach((plan) => dfs(plan.id));
    return levels;
  }

  function getNodeColor(plan: Plan): string {
    switch (plan.status) {
      case "completed":
        return "var(--color-green)";
      case "executing":
        return "var(--interactive-accent)";
      case "failed":
        return "var(--color-red)";
      case "pending":
        return "var(--color-orange)";
      default:
        return "var(--text-muted)";
    }
  }

  function getStatusSymbol(status: string): string {
    switch (status) {
      case "completed":
        return "✓";
      case "executing":
        return "◐";
      case "failed":
        return "✗";
      case "pending":
        return "●";
      case "paused":
        return "⏸";
      default:
        return "○";
    }
  }

  function getEdgeStyle(type: string): string {
    switch (type) {
      case "blocks":
        return "stroke: var(--text-normal); stroke-width: 2; marker-end: url(#arrowhead)";
      case "related":
        return "stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 5,5; marker-end: url(#arrowhead-light)";
      case "parent-child":
        return "stroke: var(--interactive-accent); stroke-width: 1.5; marker-end: url(#arrowhead-accent)";
      default:
        return "stroke: var(--text-muted); stroke-width: 1; marker-end: url(#arrowhead)";
    }
  }

  function handleNodeClick(node: GraphNode) {
    dispatch("selectPlan", { plan: node.plan });
  }

  function truncateText(text: string, maxLength: number): string {
    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + "..."
      : text;
  }
</script>

<div class="dependency-graph">
  {#if nodes.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔗</div>
      <div class="empty-text">
        No dependencies to display
        {#if selectedPlanId}
          <br />for this plan
        {/if}
      </div>
    </div>
  {:else}
    <svg width={svgWidth} height={svgHeight} class="graph-svg">
      <!-- Define arrowhead markers -->
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="var(--text-normal)" />
        </marker>
        <marker
          id="arrowhead-light"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="var(--text-muted)" />
        </marker>
        <marker
          id="arrowhead-accent"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="var(--interactive-accent)" />
        </marker>
      </defs>

      <!-- Draw edges first (below nodes) -->
      {#each edges as edge (edge.from + "-" + edge.to)}
        {#if nodes.find((n) => n.id === edge.from) && nodes.find((n) => n.id === edge.to)}
          {@const fromNode = nodes.find((n) => n.id === edge.from)}
          {@const toNode = nodes.find((n) => n.id === edge.to)}
          {#if fromNode && toNode}
            <line
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              style={getEdgeStyle(edge.type)}
            />
          {/if}
        {/if}
      {/each}

      <!-- Draw nodes -->
      {#each nodes as node (node.id)}
        <g
          class="node"
          class:selected={node.id === selectedPlanId}
          transform="translate({node.x}, {node.y})"
          on:click={() => handleNodeClick(node)}
        >
          <circle
            r="30"
            fill={getNodeColor(node.plan)}
            fill-opacity="0.2"
            stroke={getNodeColor(node.plan)}
            stroke-width="2"
          />
          <text
            class="node-symbol"
            text-anchor="middle"
            dominant-baseline="middle"
            fill={getNodeColor(node.plan)}
          >
            {getStatusSymbol(node.plan.status)}
          </text>
          <text
            class="node-label"
            text-anchor="middle"
            y="45"
            fill="var(--text-normal)"
          >
            {truncateText(node.plan.title, 15)}
          </text>
        </g>
      {/each}
    </svg>

    <div class="legend">
      <div class="legend-item">
        <div class="legend-line blocks"></div>
        <span>Blocks</span>
      </div>
      <div class="legend-item">
        <div class="legend-line related"></div>
        <span>Related</span>
      </div>
      <div class="legend-item">
        <div class="legend-line parent-child"></div>
        <span>Parent-Child</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .dependency-graph {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
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

  .empty-text {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .graph-svg {
    flex: 1;
    overflow: visible;
  }

  .node {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .node:hover circle {
    fill-opacity: 0.4;
    stroke-width: 3;
  }

  .node.selected circle {
    fill-opacity: 0.5;
    stroke-width: 4;
  }

  .node-symbol {
    font-size: 16px;
    font-weight: bold;
    pointer-events: none;
  }

  .node-label {
    font-size: 11px;
    font-weight: 500;
    pointer-events: none;
  }

  .legend {
    display: flex;
    gap: 16px;
    margin-top: 16px;
    padding: 8px 12px;
    background: var(--background-primary);
    border-radius: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .legend-line {
    width: 20px;
    height: 2px;
  }

  .legend-line.blocks {
    background: var(--text-normal);
  }

  .legend-line.related {
    background: var(--text-muted);
    background-image: repeating-linear-gradient(
      90deg,
      var(--text-muted),
      var(--text-muted) 5px,
      transparent 5px,
      transparent 10px
    );
  }

  .legend-line.parent-child {
    background: var(--interactive-accent);
  }
</style>
