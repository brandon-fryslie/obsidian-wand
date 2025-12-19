# Architecture

This document describes the architecture of the Obsidian Tool-Calling Agent plugin.

## Overview

The plugin follows a **three-phase workflow** that separates AI planning from deterministic execution:

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
│                           │                                      │
│                    "Create notes from                            │
│                     these bullets..."                            │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    PHASE 1: PLAN                         │    │
│  │                                                          │    │
│  │  User message + context → LLM → ActionPlan JSON          │    │
│  │                                                          │    │
│  │  • Gather context (selection, active file)               │    │
│  │  • Send to LLM with tool schemas                         │    │
│  │  • Parse and validate JSON response                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   PHASE 2: CONFIRM                       │    │
│  │                                                          │    │
│  │  "This plan will create 10 files in Projects/"          │    │
│  │                                                          │    │
│  │  • Show human-readable summary                           │    │
│  │  • Display risk level                                    │    │
│  │  • User approves or cancels                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   PHASE 3: EXECUTE                       │    │
│  │                                                          │    │
│  │  Deterministic execution (no LLM involved)               │    │
│  │                                                          │    │
│  │  • Run each step in order                                │    │
│  │  • Handle dependencies and loops                         │    │
│  │  • Track progress, support cancellation                  │    │
│  │  • Record undo journal                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│                      RESULTS                                     │
│                  (files created, etc.)                           │
└─────────────────────────────────────────────────────────────────┘
```

**Why this design?**

1. **Safety**: The LLM never executes anything directly. All actions require user confirmation.
2. **Predictability**: Execution is deterministic - the same plan always produces the same results.
3. **Transparency**: Users see exactly what will happen before it happens.
4. **Offline replay**: Saved plans (macros) can be executed without the LLM.

---

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│                                                                  │
│   ChatPanel.svelte    PlanPreview.svelte    ExecutionProgress   │
│   MessageList.svelte  ExecutionResults.svelte                   │
│                                                                  │
│   • User interface (Svelte components)                          │
│   • Reactive to store changes                                   │
│   • Emits user events                                           │
├─────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                               │
│                                                                  │
│   ChatController    Planner    Executor    MacroStore           │
│   LLMProvider       PlanValidator          PluginIndex          │
│                                                                  │
│   • Business logic and orchestration                            │
│   • State management via Svelte stores                          │
│   • No direct DOM manipulation                                  │
├─────────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                           │
│                                                                  │
│   ToolRegistry    Tools (vault, editor, workspace, commands)    │
│                                                                  │
│   • Direct Obsidian API integration                             │
│   • Tool implementations with schemas                           │
│   • External API calls (LLM providers)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### Plugin Main (`src/main.ts`)

Entry point. Handles Obsidian plugin lifecycle:
- Load/save settings
- Register the chat view
- Register commands and ribbon icon
- Initialize all services

### Chat View (`src/views/ChatView.ts`)

Obsidian ItemView that hosts the Svelte UI. Bridges Obsidian's view system with our reactive components.

### Svelte Components (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `ChatPanel.svelte` | Root component - input, messages, controls |
| `MessageList.svelte` | Conversation transcript |
| `PlanPreview.svelte` | Plan confirmation UI with approve/cancel |
| `ExecutionProgress.svelte` | Real-time progress during execution |
| `ExecutionResults.svelte` | Final results with save macro option |

### Services (`src/services/`)

| Service | Purpose |
|---------|---------|
| `ChatController` | Orchestrates conversation flow, coordinates all services |
| `LLMProvider` | Abstracts LLM API calls (OpenAI, Anthropic, custom) |
| `Planner` | Assembles prompts, calls LLM, parses JSON plans |
| `PlanValidator` | Validates plans against schemas, generates summaries |
| `Executor` | Runs validated plans deterministically |
| `ToolRegistry` | Central registry of all tools with schemas |
| `MacroStore` | Saves and executes plans offline |
| `PluginIndex` | Fetches community plugin list for recommendations |

### Tools (`src/tools/`)

Organized by category:

```
src/tools/
├── vault/          # File operations (create, read, write, delete, search)
├── editor/         # Selection and cursor operations
├── workspace/      # Open files, get context
├── commands/       # List and execute Obsidian commands
└── util/           # Helpers (parse bullets, slugify titles)
```

Each tool has:
- Input schema (Zod)
- Output schema (Zod)
- Execute function
- Metadata (risk level, category)

---

## Data Flow Example

**Scenario**: User selects bullet points and says "Create a note for each bullet in Projects/"

```
1. USER INPUT
   ├── Message: "Create a note for each bullet in Projects/"
   └── Selection: "- Item A\n- Item B\n- Item C"

2. CONTEXT GATHERING (ChatController)
   ├── Active file: "Daily/2025-12-16.md"
   ├── Selection text: "- Item A\n- Item B\n- Item C"
   └── Available tools: [vault.*, editor.*, ...]

3. PLANNING (Planner → LLMProvider)
   ├── System prompt with tool schemas
   ├── User message + context
   └── LLM returns ActionPlan JSON

4. VALIDATION (PlanValidator)
   ├── Schema validation ✓
   ├── Tool existence check ✓
   ├── Path sandboxing check ✓
   └── Generate summary: "Will create 3 files"

5. CONFIRMATION (UI)
   └── User clicks "Approve"

6. EXECUTION (Executor → ToolRegistry → Tools)
   ├── Step 1: vault.ensureFolder({path: "Projects"})
   ├── Step 2: util.parseMarkdownBullets({text: selection})
   ├── Step 3-5: vault.createFile (foreach item)
   └── Step 6: editor.replaceSelection({text: links})

7. RESULTS
   ├── 3 files created
   ├── Selection replaced with links
   └── Undo journal recorded
```

---

## State Management

State is managed with Svelte stores:

| Store | Contents |
|-------|----------|
| `conversationStore` | Message history (user, assistant, system) |
| `planStore` | Current plan awaiting approval |
| `executionStateStore` | Execution status, progress, results |
| `settingsStore` | Plugin configuration |
| `macrosStore` | Saved macros |

Components subscribe to stores and update reactively.

---

## Security Model

### Path Sandboxing

All file paths are validated:
- Must be relative (no leading `/`)
- No path traversal (`..` blocked)
- No URL schemes (`://` blocked)
- Must resolve within vault root

### Confirmation Required

- All write operations require explicit user approval
- Risk levels displayed: `read-only`, `writes`, `commands`
- Deletes disabled by default (opt-in)

### API Key Security

- Stored in Obsidian's plugin data (encrypted)
- Never logged or included in error messages
- Only sent to configured LLM provider over HTTPS

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| User errors | Show in UI with recovery suggestions |
| LLM errors | Retry up to 2 times, then fail gracefully |
| Tool errors | Per-step handling (stop/skip/retry) |
| System errors | Log for debugging, show user-friendly message |

---

## Testing Strategy

- **Unit tests** (Jest): Services, tools, schemas
- **Integration tests** (Jest): Multi-component flows
- **E2E tests** (Playwright): Full user scenarios in Obsidian

---

## File Structure

```
src/
├── main.ts                 # Plugin entry point
├── types/
│   ├── settings.ts         # Plugin settings interface
│   └── ActionPlan.ts       # ActionPlan schema (Zod)
├── views/
│   └── ChatView.ts         # Obsidian ItemView
├── components/
│   ├── ChatPanel.svelte
│   ├── MessageList.svelte
│   ├── PlanPreview.svelte
│   ├── ExecutionProgress.svelte
│   └── ExecutionResults.svelte
├── services/
│   ├── ChatController.ts
│   ├── LLMProvider.ts
│   ├── Planner.ts
│   ├── PlanValidator.ts
│   ├── Executor.ts
│   ├── ToolRegistry.ts
│   ├── MacroStore.ts
│   └── PluginIndex.ts
└── tools/
    ├── vault/
    ├── editor/
    ├── workspace/
    ├── commands/
    └── util/
```
