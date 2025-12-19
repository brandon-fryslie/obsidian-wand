# Project Specification: Obsidian Tool-Calling Agent

**Generated**: 2025-12-16
**Last Updated**: 2025-12-16
**Scenario**: New Project (Brand New)
**Status**: Active

---

## 1. Project Overview

This document consolidates all project specifications from PROJECT_SPEC/ into a single authoritative source for the development team and planning agents.

### Purpose

The Obsidian Tool-Calling Agent is an embedded AI-powered automation plugin that transforms natural language instructions into safe, executable plans within Obsidian. Users express intent in plain English, the plugin uses an LLM to generate a structured plan of tool calls, shows the plan for confirmation, then executes it step-by-step with progress tracking and undo capability.

This plugin bridges the gap between what users want to do and the technical knowledge required to accomplish it, making Obsidian automation accessible while maintaining safety through transparency and user control.

### Target Users

**Primary Users**:
- Obsidian power users managing large vaults (100s-1000s of notes)
- Users performing repetitive note-taking and organization tasks
- Users wanting automation without learning scripting
- Users valuing safety and transparency in automation

**Secondary Users**:
- Knowledge workers building personal knowledge management systems
- Teams using Obsidian for collaborative documentation
- Researchers organizing literature and notes

**User Constraints**:
- Desktop Obsidian only (uses internal APIs not available on mobile)
- Must provide own LLM API key (OpenAI, Anthropic, or OpenAI-compatible)
- Basic understanding of LLM capabilities and limitations helpful

### Core Goals

1. **Natural Language to Action**: 95% success rate for common vault operations from natural language
2. **Safe by Default**: All writes require explicit confirmation; no action without approval
3. **Transparent Execution**: Users see exactly what will happen before it happens
4. **Offline Reusability**: Save successful plans as macros, replay without LLM
5. **Comprehensive Coverage**: Support 80% of common Obsidian operations

### Success Criteria

**User Metrics**:
- Users save 3+ macros within first week (value indicator)
- 90% plan approval rate (quality indicator)
- <10% plan cancellation mid-execution (accuracy indicator)

**Technical Metrics**:
- 95% schema validation success for LLM plans
- Zero unintended file modifications (100% sandbox compliance)
- <2s latency for plan generation (excluding LLM API time)
- 90% test coverage for executor and tool layer

**Business Metrics**:
- Plugin adoption by power users
- Positive feedback on safety/transparency
- Low support burden (clear errors, good docs)

---

## 2. Architecture

### System Overview

Three-phase workflow separates planning from execution:

1. **Plan Phase**: LLM receives user request, context (selection, active file, available tools), generates structured JSON plan conforming to ActionPlan schema. LLM never executes directly.

2. **Confirm Phase**: Plugin renders human-readable summary showing files to be created/modified, commands to execute, risk level. User must explicitly approve.

3. **Execute Phase**: Deterministic executor runs each step in order, handling dependencies, loops (foreach), retries, errors per plan. Real-time progress with cancellation support.

**Architecture Benefits**:
- Predictability: Plans are deterministic and repeatable
- Safety: No LLM hallucination causes unintended actions
- Transparency: Users see exactly what will happen
- Debuggability: Each phase testable independently
- Offline Replay: Macros execute without LLM

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Obsidian App                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Plugin Main (lifecycle, settings, view registration)   │ │
│ └────────────┬────────────────────────────────────────────┘ │
│              │                                               │
│ ┌────────────▼────────────────────────────────────────────┐ │
│ │          Chat View (Svelte Components)                  │ │
│ │  - ChatPanel (user input)                               │ │
│ │  - MessageList (conversation history)                   │ │
│ │  - PlanPreview (approval UI)                            │ │
│ │  - ExecutionProgress (live updates)                     │ │
│ └────────────┬────────────────────────────────────────────┘ │
│              │                                               │
│ ┌────────────▼────────────────────────────────────────────┐ │
│ │         Chat Controller (Service Layer)                 │ │
│ │  - Conversation state (Svelte stores)                   │ │
│ │  - Context gathering                                    │ │
│ │  - Planner → Validator → Executor orchestration         │ │
│ └──┬─────────────────────────────────────┬────────────────┘ │
│    │                                     │                   │
│ ┌──▼──────────────┐           ┌──────────▼────────────────┐ │
│ │  LLM Provider   │◄──────────┤  Planner Service          │ │
│ │  - OpenAI       │           │  - Prompt assembly        │ │
│ │  - Anthropic    │           │  - Schema validation      │ │
│ │  - Custom       │           │  - Plan sanitization      │ │
│ └─────────────────┘           └──────────┬────────────────┘ │
│                                          │                   │
│                                ┌─────────▼──────────────┐    │
│                                │  Plan Validator        │    │
│                                │  - JSON Schema (Zod)   │    │
│                                │  - Tool allowlist      │    │
│                                │  - Path sandboxing     │    │
│                                └─────────┬──────────────┘    │
│                                          │                   │
│ ┌────────────────────────────────────────▼────────────────┐ │
│ │               Executor Service                          │ │
│ │  - Dependency resolution  - Progress tracking           │ │
│ │  - Foreach expansion      - Cancellation                │ │
│ │  - Retry logic            - Undo journal                │ │
│ └────────────┬──────────────────────────────────────────│ │
│              │                                             │ │
│ ┌────────────▼──────────────────────────────────────────┐ │ │
│ │                  Tools Layer                          │ │ │
│ │  ┌───────┐  ┌────────┐  ┌─────────┐  ┌────────────┐  │ │ │
│ │  │ Vault │  │ Editor │  │Workspace│  │  Commands  │  │ │ │
│ │  └───┬───┘  └───┬────┘  └────┬────┘  └─────┬──────┘  │ │ │
│ │      └──────────┴─────────────┴──────────────┘         │ │ │
│ │           Tool Registry & Dispatcher                   │ │ │
│ │           - Schema validation per tool                 │ │ │
│ │           - Result normalization                       │ │ │
│ └───────────────────────────────────────────────────────┘ │ │
│                                                             │ │
│ ┌───────────────────────────────────────────────────────┐ │ │
│ │  Macro Store - Save/replay plans offline             │ │ │
│ └───────────────────────────────────────────────────────┘ │ │
│                                                             │ │
│ ┌───────────────────────────────────────────────────────┐ │ │
│ │  Community Plugin Index - Recommendations only        │ │ │
│ └───────────────────────────────────────────────────────┘ │ │
└─────────────────────────────────────────────────────────────┘

External:
  - LLM Provider APIs (OpenAI, Anthropic, custom)
  - Obsidian community-plugins.json (read-only)
```

For detailed component responsibilities, see ARCHITECTURE.md.

---

## 3. Technology Stack

### Core Technologies

| Technology | Version | Rationale |
|------------|---------|-----------|
| TypeScript | 5.2+ | Obsidian API is TypeScript-first, type safety critical for schema validation |
| Svelte | 4.2+ | Lightweight bundle, simple reactivity, built-in stores |
| Zod | 3.22+ | Runtime validation + TypeScript inference for ActionPlan schema |
| esbuild | 0.19+ | Fast builds, standard for Obsidian plugins |
| Jest | 29.7+ | Unit/integration testing with good mocking |
| Playwright | 1.40+ | E2E testing in actual Obsidian window |
| pnpm | latest | Fast, disk-efficient package management (user preference) |

### State Management

Svelte stores for all reactive state:
- `conversationStore: writable<Message[]>` - chat history
- `executionStateStore: writable<ExecutionState>` - current execution status
- `settingsStore: writable<PluginSettings>` - plugin settings
- `planStore: writable<ActionPlan | null>` - current plan awaiting approval
- `macrosStore: writable<SavedMacro[]>` - saved macros

**Rationale**: Built into Svelte, no additional dependency, TypeScript-friendly, simple subscription model.

### Key Libraries

- **obsidian** (^1.4.11): Official plugin API
- **nanoid** (^5.0.4): Unique ID generation for calls/runs/steps
- **fuse.js** (^7.0.0): Fuzzy search for plugin recommendations

### Build & Development

- **Build**: esbuild with watch mode (dev) and minification (production)
- **Linting**: ESLint + TypeScript plugin + Prettier
- **Type Checking**: TypeScript strict mode (noImplicitAny: false for Obsidian API gaps)
- **Task Running**: just (user preference over npm scripts)

---

## 4. Development Workflow

### Version Control

- **Git workflow**: Feature branches → main
- **Commit messages**: Conventional commits (feat:, fix:, docs:, test:, refactor:, chore:)
- **Branch protection**: Require passing tests, no force push to main

### Package Management

- **Tool**: pnpm (user preference)
- **Lock file**: pnpm-lock.yaml committed
- **Node version**: 20.x (.nvmrc)

### Code Quality

- **Linting**: ESLint with TypeScript, Prettier integration
- **Formatting**: Prettier (2 space, single quotes, trailing commas, 100 char width)
- **Type Checking**: TypeScript strict mode
- **Pre-commit**: Lint, format, type check, fast tests (to be added)

### Testing Strategy

**Unit Tests** (90% coverage goal):
- All services, tools, utilities
- Mock Obsidian APIs
- Test each tool in isolation
- Test schema validation

**Integration Tests** (80% coverage goal):
- Executor + Tools (multi-step execution)
- Foreach expansion
- Error handling and retries
- Undo functionality

**E2E Tests** (5-10 key scenarios):
- Create notes from selection
- Run saved macro
- Cancel mid-execution
- Handle LLM errors gracefully

**Philosophy**: Test behavior not implementation. TDD for new tools. Add tests for bugs before fixing.

### Task Running (justfile)

See `justfile` for all tasks. Common:
- `just dev` - Development mode (esbuild watch)
- `just build` - Production build
- `just test` - Run all tests
- `just lint` - Run ESLint
- `just format` - Run Prettier
- `just typecheck` - TypeScript check
- `just validate` - Lint + typecheck + test (CI)

---

## 5. Core Specifications

This section references the detailed specifications in PROJECT_SPEC/.

### 5.1 ActionPlan Schema

The LLM outputs a structured JSON object conforming to ActionPlan schema. See full schema in `PROJECT_SPEC/ActionPlan_JSON_Schema.md`.

**Key elements**:
- `version`: Schema version (semver)
- `goal`: Human-readable statement of intent
- `assumptions`: Planner assumptions about context
- `riskLevel`: "read-only" | "writes" | "commands"
- `steps`: Array of Step objects
- `defaults`: Default onError/retry for steps
- `outputs`: UI hints for what to show user

**Step structure**:
- `id`: Unique identifier
- `tool`: Tool name (must exist in registry)
- `args`: Tool-specific arguments (object)
- `preview`: Human description for UI
- `dependsOn`: Step IDs that must complete first
- `foreach`: Loop over array `{from, itemName, indexName?, concurrency?}`
- `captureAs`: Alias for step output in runtime context
- `onError`: "stop" | "skip" | "retry"
- `retry`: `{maxAttempts, backoffMs}`
- `timeoutMs`: Per-step timeout
- `tags`: Labels for UI grouping

### 5.2 Agent System Prompt

See `PROJECT_SPEC/agent_prompt.md` for complete LLM instruction set.

**Key principles**:
- Output only JSON (no markdown, no explanations)
- Use direct Obsidian APIs (vault/editor/workspace) when possible
- Use commands for functionality without direct API
- Keep plans minimal but complete
- Set riskLevel accurately
- Respect path sandboxing (no .., no absolute paths)
- Prefer non-destructive edits when ambiguous

### 5.3 Tool Call Envelope

See `PROJECT_SPEC/tool-call-envelope-spec.md` for internal wire format between executor and tools.

**ToolCall envelope** (executor → tool):
- Identity: callId, runId, stepId, tool
- Arguments: fully resolved args after templating
- Execution control: attempt, timeoutMs, cancellable
- Foreach context: iteration index, item value
- Provenance: timestamps, versions
- Policy snapshot: confirmation, sandbox, limits

**ToolResult envelope** (tool → executor):
- Identity: callId, runId, stepId, tool, attempt
- Outcome: status (ok/error/timeout/cancelled/skipped), ok boolean
- Data: tool output (when ok, validated against output schema)
- Error: code, message, details, retryable flag
- Timing: startedAt, endedAt, durationMs
- Effects: sideEffects observed, created/modified/deleted/renamed files
- User messaging: userMessage, debugMessage

### 5.4 Tool Schema Conventions

See `PROJECT_SPEC/tool-input-output-schema-conventions.md` for detailed conventions.

**Universal conventions**:
- Input/output: strict object schemas (additionalProperties: false)
- Paths: vault-relative with forward slashes (never absolute OS paths)
- Field names: Consistent across tools (path/paths, items/matches, content)
- Idempotency: Support expectedEtag or ifNotExists where applicable
- Error codes: Standard set (VALIDATION_ERROR, POLICY_DENIED, NOT_FOUND, CONFLICT, PRECONDITION_FAILED, TIMEOUT, CANCELLED, INTERNAL_ERROR)

**Tool categories**:
1. **Vault**: ensureFolder, createFile, readFile, writeFile, rename, delete, searchText, listFiles
2. **Editor**: getSelection, replaceSelection, insertAtCursor, getActiveFilePath
3. **Workspace**: openFile, getContext
4. **Commands**: list, run
5. **Utilities**: parseMarkdownBullets, slugifyTitle

---

## 6. Architecture Decisions

### ADR-001: TypeScript for Type Safety

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Use TypeScript strict mode + Zod for runtime validation.

**Rationale**: Obsidian API is TypeScript-native, compile-time + runtime checking ensures safe tool dispatch, excellent IDE support.

**Consequences**:
- (+) Catch schema mismatches at compile time, excellent autocomplete
- (-) Build step required, some Obsidian APIs need type assertions
- Risk: Type definitions could drift from runtime (mitigated by Zod)

---

### ADR-002: Svelte for UI Framework

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Use Svelte 4 with built-in stores.

**Rationale**: Smallest bundle size, simple syntax, built-in reactivity eliminates need for Redux/Zustand, great TypeScript support.

**Consequences**:
- (+) Fast builds, small bundle, clean components, simple state
- (-) Smaller ecosystem than React
- Risk: Svelte 5 migration needed eventually

---

### ADR-003: Plan-Then-Execute (No LLM in Execution)

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: LLM generates ActionPlan JSON, executor runs it deterministically. No LLM in loop during execution.

**Rationale**: Deterministic execution, transparency (preview full plan), repeatability (macros), testability, user trust.

**Alternatives**:
- ReAct loop: Can adapt but non-deterministic, slower, no preview, no macros
- Direct tool use: No preview, no confirmation, LLM errors cause changes

**Consequences**:
- (+) Deterministic, transparent, macros work offline, easy testing
- (-) Can't adapt mid-execution to errors (must regenerate plan)
- Risk: Plans stale if vault changes (mitigated by conflict detection)

---

### ADR-004: Zod for Schema Validation

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Use Zod for ActionPlan schema and all tool schemas.

**Rationale**: TypeScript type inference from schemas (DRY), excellent error messages for debugging LLM output, tree-shakeable.

**Consequences**:
- (+) DRY (schemas = types), great errors, easy to extend
- (-) ~40KB bundle, runtime validation cost
- Risk: Breaking changes in Zod (mitigated by semver pinning)

---

### ADR-005: Vault API as Primary File Interface

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Use `app.vault` for all file operations.

**Rationale**: Official API, maintains Obsidian cache, triggers metadata updates, cross-platform (desktop), respects settings.

**Alternatives**:
- Node.js fs: Bypasses cache, breaks metadata, desktop-only (unofficial)
- Adapter API: Lower level, still bypasses cache

**Consequences**:
- (+) Safe, supported, consistent, respects file watchers
- (-) All async (must await), slightly more verbose
- Risk: Vault API bugs (but safer than bypassing)

---

### ADR-006: Commands as Compatibility Layer

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Expose `commands.list` and `commands.run` using `app.commands.executeCommandById()` as best-effort internal API.

**Rationale**: Access to core + plugin functionality, widely used in ecosystem, enables powerful automation. Risk of breaking changes low (Obsidian maintains backward compatibility).

**Alternatives**:
- API-only: Typed and stable but missing huge functionality
- Plugin-specific integrations: Maintenance burden, can't cover all

**Consequences**:
- (+) Users can automate nearly anything
- (-) Command IDs may change, preconditions hard to validate
- Risk: Obsidian could lock down (low likelihood)

---

### ADR-007: Foreach Loops in Schema

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Use `foreach` in ActionPlan with executor-side loop expansion.

**Rationale**: Compact plans, clear intent, handles dynamic sizes, executor can optimize (parallel execution). Standard construct, LLMs trained on it.

**Alternatives**:
- LLM repeats steps: Large plans, prone to errors, hard to preview
- ReAct loop: Dynamic but non-deterministic, slow, no preview

**Consequences**:
- (+) Compact plans, clear intent, parallel execution possible
- (-) Executor complexity, LLM must learn syntax
- Risk: LLM misuse (mitigated by examples in prompt)

---

### ADR-008: Confirmation Required for Writes

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Plans with `riskLevel: "writes"` or `"commands"` require explicit confirmation. `"read-only"` can optionally auto-execute (user setting).

**Rationale**: Vaults contain irreplaceable knowledge work. User confirmation small price for peace of mind. Power users can save macros to skip confirmation on repeated tasks.

**Alternatives**:
- Auto-approve low-risk: Faster but risky mistakes
- Post-execution undo: Fast but users may not notice errors

**Consequences**:
- (+) User trust, transparency, no surprises
- (-) Extra step, may feel slow initially
- Risk: Confirmation fatigue (mitigated by clear summaries)

**Note**: User preference mentions "auto-approve low risk plans". Implemented as optional setting for `riskLevel: "read-only"` only, never writes.

---

### ADR-009: Offline Macro Execution

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Save validated ActionPlan as macro with parameter templates. Execute offline without LLM.

**Rationale**: Huge value for repetitive tasks. Fast, free, works offline, reliable. Once plan confirmed works, should rerun instantly.

**Alternatives**:
- Always use LLM: Slow, expensive, requires internet, non-deterministic
- Prompt templates: Still requires LLM, API costs

**Consequences**:
- (+) Fast repeated execution, no API costs, works offline, deterministic
- (-) Macros stale if vault structure changes, need management UI
- Risk: Parameter binding bugs (mitigated by testing + dry-run)

---

### ADR-010: No Automatic Plugin Install

**Status**: Accepted | **Date**: 2025-12-16

**Decision**: Never auto-install plugins. Recommend only with manual install instructions.

**Rationale**: Security risk (plugins could be malicious), violates user trust. Help users discover but don't install automatically.

**Alternatives**:
- Auto-install with confirmation: Convenient but security risk, trust burden
- No awareness: Simplest but missed opportunity

**Consequences**:
- (+) Safe, respects autonomy, no security liability
- (-) Recommendations require manual follow-up
- Risk: None - conservative choice

---

## 7. Implementation Roadmap

### Milestone Structure

See `PROJECT_SPEC/milestones.md` for detailed milestone plan (Milestone 0-9).

**Phase 1: Foundation** (Milestones 0-2)
- Conceptual foundations (schemas, contracts)
- Core capability layer (tools without AI)
- Execution engine (plan runner)
- **Complexity**: Medium

**Phase 2: Intelligence** (Milestones 3-4)
- Human-readable preview & confirmation
- LLM integration (planner)
- **Complexity**: Medium-Large

**Phase 3: User Experience** (Milestones 5-6)
- Conversational chat interface
- Saved actions (macros)
- **Complexity**: Medium

**Phase 4: Ecosystem** (Milestone 7)
- Community plugin awareness
- **Complexity**: Small-Medium

**Phase 5: Production Readiness** (Milestones 8-9)
- UX polish & refinement
- Testing, hardening, security review
- **Complexity**: Large

---

## 8. Future Considerations

### Deferred Decision: Plan Editing

**Current**: Approve or reject as-is
**Trigger**: Users frequently want to tweak one parameter
**Upgrade**: Add "Edit Plan" button, allow editing args with validation
**Effort**: Medium (3-5 days)

### Deferred Decision: Streaming Execution

**Current**: Execute all, then show results
**Trigger**: Long-running plans (>30s), foreach 50+ iterations
**Upgrade**: Emit events as steps complete, update UI in real-time
**Effort**: Small (1-2 days)

### Deferred Decision: Custom Tool Definitions

**Current**: Tools hardcoded in plugin
**Trigger**: Advanced users want custom tools, 50+ tools
**Upgrade**: Tool interface (schema + impl), load from settings, tool SDK
**Effort**: Large (1-2 weeks)

### Deferred Decision: Performance Optimization (Parallel Execution)

**Current**: Sequential step execution
**Trigger**: Foreach 100+ iterations, slow execution complaints
**Upgrade**: Analyze dependencies, parallel independent steps, Promise.all
**Effort**: Medium (3-4 days)

### Deferred Decision: Advanced LLM Features (Function Calling, Agents)

**Current**: One-shot plan generation
**Trigger**: Plans too complex for one shot, need adaptive execution
**Upgrade**: ReAct loop, OpenAI function calling, safety limits
**Effort**: Large (2 weeks)

---

## 9. Open Questions & Risks

### Open Questions

1. **LLM Reliability**: Acceptable failure rate for plan generation?
   - Impact: High → user frustration
   - Who: User testing
   - Deadline: Before public release
   - Thinking: 90% success acceptable if errors clear

2. **Macro Parameter Syntax**: `${param}` vs `{{param}}`?
   - Impact: User-facing syntax
   - Who: Developer (conventions)
   - Deadline: Before Phase 4
   - Thinking: `${param}` familiar from JS/shell

3. **Confirmation UI**: Modal dialog vs inline preview?
   - Impact: UX and flow
   - Who: UX testing
   - Deadline: Before Phase 2 (can iterate)
   - Thinking: Inline feels more natural

### Risks

1. **LLM JSON Reliability**: LLMs may fail to generate valid JSON
   - Likelihood: Medium | Impact: High
   - Mitigation: Clear schema + examples, retry logic, JSON mode APIs
   - Owner: Developer

2. **Obsidian API Changes**: Internal APIs (commands) could break
   - Likelihood: Low-Medium | Impact: Medium
   - Mitigation: Document best-effort, graceful degradation, monitor releases
   - Owner: Developer

3. **Path Traversal**: LLM might craft malicious paths
   - Likelihood: Low | Impact: Critical
   - Mitigation: Strict validation (no .., no absolute), normalize, whitelist, security review
   - Owner: Developer

4. **Performance**: Large plans (1000+ steps) could freeze UI
   - Likelihood: Low | Impact: Medium
   - Mitigation: Limit max steps (100-200), Web Workers (deferred), progress updates, warnings
   - Owner: Developer

5. **API Costs**: Users may incur high LLM costs
   - Likelihood: Medium | Impact: Medium
   - Mitigation: Token estimates, recommend macros, support cheaper models, document costs
   - Owner: User (controls key), Developer (warnings)

6. **Macro Staleness**: Saved macros may fail if vault changes
   - Likelihood: Medium | Impact: Low
   - Mitigation: Validate before execution, dry-run mode, clear errors, allow editing
   - Owner: Developer

7. **Undo Limitations**: Some operations can't be undone
   - Likelihood: High | Impact: Medium
   - Mitigation: Document best-effort, trash vs delete, warn destructive ops, recommend backups
   - Owner: Developer (docs), User (backups)

---

## 10. References

### Project Documents
- ActionPlan Schema: `PROJECT_SPEC/ActionPlan_JSON_Schema.md`
- Agent Prompt: `PROJECT_SPEC/agent_prompt.md`
- Tool Envelope: `PROJECT_SPEC/tool-call-envelope-spec.md`
- Tool Conventions: `PROJECT_SPEC/tool-input-output-schema-conventions.md`
- Milestones: `PROJECT_SPEC/milestones.md`
- Architecture Details: `.agent_planning/ARCHITECTURE.md`

### Technology
- Obsidian API: https://github.com/obsidianmd/obsidian-api
- Svelte 4: https://svelte.dev/docs/svelte/overview
- TypeScript: https://www.typescriptlang.org/docs/
- Zod: https://zod.dev/
- esbuild: https://esbuild.github.io/

### LLM Providers
- OpenAI: https://platform.openai.com/docs/api-reference
- Anthropic: https://docs.anthropic.com/claude/reference

---

## Generation History

**Generated**: 2025-12-16
**Agent**: project-architect
**Scenario**: New Project (Brand New)
**Technology Decisions**:
- Language: TypeScript (strict mode)
- UI Framework: Svelte 4
- State: Svelte stores
- Validation: Zod
- Build: esbuild
- Testing: Jest + Playwright
- Package Manager: pnpm (user preference)
- Task Runner: just (user preference)

**Notes**:
- Existing scaffolding treated as draft
- Some implementation files exist but may need refactoring
- User preferences: pnpm, just, complexity estimates (not time)
- Auto-approve setting for read-only plans only
