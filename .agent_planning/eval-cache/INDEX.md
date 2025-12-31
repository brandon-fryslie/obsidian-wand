# Eval Cache Index

Last Updated: 2025-12-31 01:45:00

| Topic | File | Cached | Source | Confidence |
|-------|------|--------|--------|------------|
| Claude SDK Integration | claude-sdk-integration.md | 2025-12-31 00:59 | project-evaluator | HIGH |
| Obsidian Subprocess Patterns | obsidian-subprocess-patterns.md | 2025-12-31 01:45 | project-evaluator | HIGH |

## Recent Invalidations

- 2025-12-31-014500: Added Obsidian subprocess patterns knowledge cache
  - Analyzed 9+ production Obsidian plugins using child_process
  - Documented three integration patterns (external spawn, bundle, MCP server)
  - Confirmed subprocess spawning is VIABLE on desktop (desktop-only)
  - Identified best practices from obsidian-git, shell-commands, terminal plugins
  - SDK size: 69MB on disk (bundle impact UNKNOWN, needs testing)
  - All Claude Code plugins use Pattern A (user installs externally)
  - MCP server pattern (Pattern C) is emerging best practice
  - No invalidation of SDK integration knowledge

- 2025-12-31-005911: Added Claude SDK integration knowledge cache
  - Examined SDK package structure and TypeScript definitions
  - Documented in-process MCP server pattern
  - Identified critical ambiguities around subprocess requirements
  - No invalidation of existing knowledge needed

- 2025-12-19-000000: No invalidation needed for Templater integration bugfix
  - Modified src/schemas/ActionPlanSchema.ts (added Dataview and Templater tools to ToolNameSchema)
  - Fixed critical schema validation bug that would have prevented Dataview/Templater tools from being used in plans
  - No cache entries currently exist

- 2025-12-17-050500: No invalidation needed for Phase 9 implementation
  - Modified src/types/Plan.ts (added DependencyType, PlanDependency, CanExecuteResult, PlanConflict interfaces)
  - Modified src/services/PlanStore.ts (added dependency management methods)
  - Modified src/components/PlanDetail.svelte (added dependencies section)
  - Modified src/components/PlanList.svelte (added parent-child hierarchical display)
  - Added new component files: src/components/DependencyGraph.svelte, DependencySelector.svelte
  - No cache entries currently exist

- 2025-12-17-044500: No invalidation needed for Phase 7 implementation
  - Added new component files: src/components/ProgressDashboard.svelte, ActivityLog.svelte, PlanStatistics.svelte
  - Added new utility file: src/utils/timeFormatting.ts
  - Modified src/components/PlanPanel.svelte (integrated dashboard/activity tabs)
  - Modified src/views/PlanView.ts (added notification system)
  - No cache entries currently exist

## Notes
- Claude Agent SDK v0.1.76 installed (package.json version mismatch: claims 0.1.14)
- `createSdkMcpServer()` exists and appears to support in-process MCP servers
- Critical ambiguity: unclear if SDK requires Claude Code subprocess even with SDK servers
- ObsidianMCPServer.ts already implements full MCP server with 40+ tools
- WandWithThinkingAgent is working "knockoff" using direct Anthropic API
- E2E testing infrastructure complete (CDP-based Playwright tests)
- Two passing smoke tests verify Obsidian launches and plugin loads
- All tests pass consistently (3/3 runs)
- Tool-centric plan management interface: Phases 1-7, 9 complete
- UI/UX Polish complete: All DoD acceptance criteria met
- Templater integration complete: All 4 tools (status, run, insert, create) fully integrated
