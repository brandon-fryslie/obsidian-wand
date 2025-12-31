# Obsidian Tool Agent - Claude Code Instructions

## Debugging Obsidian with Chrome DevTools Protocol

This project uses the Chrome DevTools MCP server to connect to Obsidian for debugging. Obsidian is built on Electron, which supports Chrome's remote debugging protocol.

### Quick Start

1. Launch Obsidian with debugging enabled:
   ```bash
   just obsidian
   ```

2. The MCP server (configured in `.mcp.json`) will automatically connect to `http://127.0.0.1:9222`

3. Use the chrome-devtools MCP tools to interact with Obsidian:
   - `list_pages` - List open pages/windows
   - `select_page` - Select a page to work with
   - `take_snapshot` - Get a text snapshot of the UI (a11y tree)
   - `take_screenshot` - Capture the current view
   - `click`, `fill`, `hover` - Interact with UI elements
   - `evaluate_script` - Run JavaScript in Obsidian's context
   - `list_console_messages` - View console output
   - `list_network_requests` - Monitor network activity

### Manual Launch

If you need to launch Obsidian manually with debugging:
```bash
/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222
```

Verify the connection:
```bash
curl http://localhost:9222/json/version
```

### MCP Server Configuration

The chrome-devtools MCP is configured in `.mcp.json`:
```json
{
  "mcpServers": {
    "chromedevtools/chrome-devtools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl", "http://127.0.0.1:9222"]
    }
  }
}
```

### Typical Workflow

1. Run `just obsidian-debug` to start Obsidian
2. Use `list_pages` to see available pages (usually `app://obsidian.md/index.html`)
3. Use `take_snapshot` to get a text representation of the current UI
4. Interact with elements using their `uid` from the snapshot
5. Use `evaluate_script` to run JavaScript for complex operations

### Notes

- The debug port (9222) must be free before launching
- Only one Obsidian instance with debugging can run at a time
- The `just obsidian` command will kill any existing debug session before starting

---

## Agent Architecture

**Wand** uses a clean Agent API that separates agent-specific logic from plugin infrastructure.

### Agent Interface

All agents implement the `Agent` interface (`src/agents/Agent.ts`):

```typescript
interface Agent {
  // Lifecycle
  initialize(): Promise<void>;
  cleanup(): void;

  // Core functionality
  handleUserMessage(message: string, context: AgentContext): Promise<AgentResponse>;
  abort(): void;

  // Metadata
  getName(): string;
  getDescription(): string;

  // State
  getState(): AgentState;
  onStateChange(callback: (state: AgentState) => void): void;
}
```

### Responsibilities

**Agent responsibilities:**
- Plan generation and prompt building
- LLM interaction and retry logic
- Placeholder resolution
- Error formatting
- State management (idle/thinking/executing/error)

**ChatController responsibilities:**
- Message history management
- Approval flow coordination
- Execution orchestration
- UI state synchronization

### Adding a New Agent

To add a new agent type:

1. **Create the Agent implementation** (`src/agents/YourAgent.ts`):
   ```typescript
   export class YourAgent implements Agent {
     constructor(private deps: AgentDependencies) {}

     async handleUserMessage(message: string, context: AgentContext): Promise<AgentResponse> {
       // Your agent logic here
       return { type: "plan", plan: yourPlan };
     }

     // Implement other Agent interface methods...
   }
   ```

2. **Create a Factory** (`src/agents/YourAgentFactory.ts`):
   ```typescript
   export class YourAgentFactory implements AgentFactory {
     create(deps: AgentDependencies): Agent {
       return new YourAgent(deps);
     }

     getInfo(): AgentInfo {
       return {
         type: "your-agent",
         name: "Your Agent",
         description: "What your agent does",
       };
     }
   }
   ```

3. **Register in PluginServices** (`src/services/PluginServices.ts`):
   ```typescript
   this.agentRegistry.register("your-agent", new YourAgentFactory());
   ```

4. **Add to settings** (`src/types/settings.ts`):
   ```typescript
   export type AgentType = "wand" | "your-agent";
   ```

5. **Update settings UI** (`src/main.ts`):
   ```typescript
   dropdown
     .addOption("wand", "Wand Agent - Plan-based automation")
     .addOption("your-agent", "Your Agent - Custom behavior")
   ```

### Current Agents

#### WandAgent

The original plan-based automation agent.

**Philosophy:**
- Understand before acting (gather context first)
- Be proactively helpful (suggest improvements)
- Think step by step (break complex tasks into phases)
- Make intelligent suggestions (learn from vault patterns)

**Features:**
- Multi-step plan generation with retry logic
- Automatic placeholder resolution via read-only step execution
- Thoughtful prompt engineering for knowledge management tasks
- Risk-aware approval flow

#### MiniAgent

A direct, action-oriented agent inspired by mini-swe-agent.

**Philosophy:**
- Act quickly, iterate often
- Single responsibility per request
- Clear, direct tool execution
- Conversational workflow

**Features:**
- Single-step execution with minimal planning overhead
- Parses tool calls from markdown code blocks (JSON or function-style)
- Returns single-step plans for quick execution
- Best for simple, direct tasks and exploration

**Action Format:**
```markdown
Let me list the files.

\`\`\`tool
{ "tool": "vault.listFiles", "args": { "folder": "/" } }
\`\`\`
```

Or function syntax:
```markdown
\`\`\`tool
vault.readFile({ "path": "notes/daily.md" })
\`\`\`
```

#### ClaudeCodeAgent

Full Claude Code agent powered by the Claude Agent SDK, operating on Obsidian vaults.

**Philosophy:**
- Same autonomous agent loop as Claude Code CLI
- All file operations routed through Obsidian's vault API
- Supports multi-step autonomous execution
- Full access to Obsidian plugin integrations

**Features:**
- Uses `@anthropic-ai/claude-agent-sdk` for the agent loop
- Exposes Obsidian tools via MCP server (`ObsidianMCPServer.ts`)
- Disables filesystem tools (Read, Write, Edit, Glob, Grep, Bash)
- Enables vault-specific tools (vault_readFile, vault_writeFile, etc.)
- Supports Dataview, Templater, Tasks, Excalidraw integrations
- Streaming responses with real-time tool execution visibility

**Obsidian MCP Tools:**
```
vault_*        - File operations (readFile, writeFile, createFile, delete, etc.)
editor_*       - Selection and cursor operations
workspace_*    - Open files, get context
commands_*     - List and run Obsidian commands
dataview_*     - DQL queries, pages, tasks
templater_*    - Template processing
tasks_*        - Task creation and toggling
advancedtables_* - Table formatting
excalidraw_*   - Drawing creation and export
util_*         - Parsing and slugifying utilities
```

**Requirements:**
- Anthropic API key (set in plugin settings)
- `@anthropic-ai/claude-agent-sdk` package

**Custom Endpoints (MiniMax, etc.):**
The agent supports Anthropic-compatible providers. For MiniMax:
- API URL: `https://api.minimax.io/anthropic`
- Model: Auto-configured to `MiniMax-M2.1` when MiniMax endpoint detected
- Get API key from [MiniMax Platform](https://platform.minimax.io/user-center/basic-information/interface-key)

---

## Request Flow

```
User Input → ChatController.sendMessage()
           → Agent.handleUserMessage()    # Agent-specific logic
           → AgentResponse (plan/message/error)
           → PlanValidator.validate()      # Validates structure
           → ApprovalService.checkApproval() # Per-step approval
           → Executor.execute()            # Runs approved steps
```

### Core Services (`src/services/`)

| Service | Responsibility |
|---------|----------------|
| `ChatController` | Message history, approval flow, execution orchestration |
| `Agent` | Plan generation, prompt building, error formatting (via interface) |
| `AgentRegistry` | Agent type registration and factory pattern |
| `LLMProvider` | API abstraction for OpenAI, Anthropic, custom endpoints |
| `PlanValidator` | Validates ActionPlan schema, detects placeholders |
| `Executor` | Runs steps in dependency order, supports foreach/retry/skip |
| `ToolsLayer` | Maps tool names to Obsidian API calls |
| `ApprovalService` | Determines if steps need user approval |
| `PluginServices` | DI container that wires all services together |

### Data Types (`src/types/`)

- **ActionPlan** (`ActionPlan.ts`): The LLM's output - `{ goal, assumptions, riskLevel, steps[] }`
- **Step**: Tool call with `{ id, tool, args, foreach?, dependsOn?, onError?, preview }`
- **ToolName**: Union type of ~40 available tools (vault.*, editor.*, workspace.*, etc.)
- **ExecutionContext**: Runtime state passed to each step (activeFile, selection, stepResults)
- **AgentContext**: Lightweight context for agent (activeFile, selection, vaultPath)
- **AgentResponse**: Agent's response (plan/message/error)

### Tool Categories

| Category | Examples | Risk Level |
|----------|----------|------------|
| Read-only | `vault.readFile`, `vault.listFiles`, `vault.searchText` | Safe |
| Safe writes | `vault.createFile`, `vault.ensureFolder`, `editor.insertAtCursor` | Low |
| Dangerous | `vault.writeFile`, `vault.delete`, `vault.rename`, `commands.run` | High |
| Plugin integrations | `dataview.*`, `templater.*`, `tasks.*`, `excalidraw.*` | Varies |

### Placeholder Resolution (WandAgent)

When the LLM generates a plan with placeholder values (e.g., "path_to_file"), WandAgent:
1. Executes read-only steps to gather actual data
2. Calls the LLM again with gathered data via `buildResolutionPrompt()`
3. Repeats up to 2 times until placeholders are resolved

---

## Project Structure

```
src/
├── main.ts              # Plugin entry point, settings UI
├── agents/              # Agent implementations
│   ├── Agent.ts         # Agent interface and types
│   ├── WandAgent.ts     # Plan-based automation agent
│   ├── MiniAgent.ts     # Direct action agent
│   ├── ClaudeCodeAgent.ts    # Claude Agent SDK integration
│   ├── ObsidianMCPServer.ts  # MCP tools for Claude Agent SDK
│   ├── AgentRegistry.ts # Factory pattern for agent creation
│   ├── *AgentFactory.ts # Factory implementations
├── views/               # Svelte-based UI components
│   └── ChatView.ts      # Main chat interface
├── services/            # Core business logic
│   ├── ChatController.ts    # Orchestrates message flow
│   ├── LLMProvider.ts       # API abstraction
│   ├── Executor.ts          # Step execution engine
│   ├── ToolsLayer.ts        # Tool implementations
│   ├── ApprovalService.ts   # Permission checking
│   └── PluginServices.ts    # DI container
├── types/               # TypeScript interfaces
│   ├── ActionPlan.ts    # Plan schema, ToolName union
│   ├── settings.ts      # Plugin settings, tool permissions
│   └── Plan.ts          # Plan wrapper with metadata
├── schemas/             # Zod schemas for validation
└── stores/              # Svelte stores for reactive state
```

## Key Patterns

- **Agent API**: Clean separation between agent logic and plugin infrastructure
- **Factory pattern**: AgentRegistry creates agents via factory functions
- **Dependency injection**: AgentDependencies provides all required services
- **State management**: ChatController uses callback-based state updates, UI subscribes via `onStateChange()`
- **Error handling**: Agents format errors into user-friendly messages
- **Retry logic**: Both agent plan generation and Executor support configurable retries
- **Path safety**: `ToolsLayer.resolvePath()` prevents directory traversal, auto-appends `.md`

## Testing

```bash
pnpm run test              # Run all tests
pnpm run test -- tests/agents  # Run agent tests only
pnpm run test:watch        # Watch mode
```

Key test files:
- `tests/agents/WandAgent.test.ts` - WandAgent implementation tests
- `tests/agents/MiniAgent.test.ts` - MiniAgent implementation tests
- `tests/agents/ClaudeCodeAgent.test.ts` - ClaudeCodeAgent implementation tests
- `tests/agents/AgentRegistry.test.ts` - Registry and factory tests
- `tests/services/Executor.test.ts` - Execution engine tests
- `tests/services/PlanValidator.test.ts` - Plan validation tests
