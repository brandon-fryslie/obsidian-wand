# Claude Agent SDK Integration - Reusable Knowledge

**Last Updated**: 2025-12-31 00:59:11
**Source**: project-evaluator STATUS-2025-12-31-005911.md
**Confidence**: HIGH (direct SDK examination)

---

## SDK Capabilities

### Package Information
- **Package**: `@anthropic-ai/claude-agent-sdk`
- **Installed Version**: 0.1.76 (package.json claims 0.1.14 - mismatch)
- **Module Type**: ESM (type: "module")
- **Node.js Requirement**: >=18.0.0

### Core Exports
```typescript
import {
  query,                    // Main agent query function
  createSdkMcpServer,      // In-process MCP server creator
  tool,                    // Tool definition helper
  unstable_v2_createSession, // Multi-turn session API
  unstable_v2_prompt,      // One-shot prompt API
} from '@anthropic-ai/claude-agent-sdk';
```

---

## In-Process MCP Server Pattern

### Function Signature
```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: ZodRawShape;
    handler: (args, extra) => Promise<CallToolResult>;
  }>;
}): McpSdkServerConfigWithInstance;

// Returns:
{
  type: 'sdk';
  name: string;
  instance: McpServer; // Actual MCP server instance
}
```

### Tool Definition Helper
```typescript
const toolDef = tool(
  "tool_name",           // Name
  "Description",         // Description
  { arg: z.string() },   // Zod schema
  async (args, extra) => {
    // Handler implementation
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);
```

### Tool Handler Return Format
```typescript
type CallToolResult = {
  content: Array<{ type: "text", text: string }>;
  isError?: boolean;
};
```

---

## SDK Query API

### Basic Usage
```typescript
const result = await query({
  prompt: string | AsyncIterable<SDKUserMessage>,
  options?: {
    model?: string;                    // 'claude-sonnet-4-5-20250929'
    maxTurns?: number;                 // Default: no limit
    maxBudgetUsd?: number;            // Stop if exceeded
    mcpServers?: Record<string, McpServerConfig>;
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
    canUseTool?: (toolName, input, options) => Promise<PermissionResult>;
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    abortController?: AbortController;
    systemPrompt?: string | { custom: string } | { append: string };
    // ... many more options
  }
});

// result is AsyncGenerator<SDKMessage, void>
for await (const message of result) {
  // Handle streaming messages
}
```

### Permission Callback
```typescript
type PermissionResult = {
  behavior: 'allow';
  updatedInput?: Record<string, unknown>;
  updatedPermissions?: PermissionUpdate[];
  toolUseID?: string;
} | {
  behavior: 'deny';
  message: string;
  interrupt?: boolean;
  toolUseID?: string;
};
```

---

## MCP Server Types

The SDK supports multiple MCP server types:

1. **SDK (In-Process)** - What we want
   ```typescript
   type: 'sdk'
   instance: McpServer
   ```

2. **STDIO (Subprocess)**
   ```typescript
   type: 'stdio'
   command: string
   args?: string[]
   ```

3. **SSE (Server-Sent Events)**
   ```typescript
   type: 'sse'
   url: string
   ```

4. **HTTP**
   ```typescript
   type: 'http'
   url: string
   ```

**Documentation Quote** (agentSdkTypes.d.ts:599-601):
> "Supports both process-based servers (stdio, sse, http) and SDK servers (in-process).
> SDK servers are handled locally in the SDK process, while process-based servers
> are managed by the CLI subprocess."

**CRITICAL AMBIGUITY**: Does "in the SDK process" mean no Claude Code subprocess at all, or just that the MCP server runs in-process while SDK still spawns Claude Code for orchestration?

---

## Subprocess Spawning

### Default Behavior
The SDK has options for spawning Claude Code:
- `pathToClaudeCodeExecutable?: string` - Path to Claude Code binary
- `spawnClaudeCodeProcess?: (options) => SpawnedProcess` - Custom spawn function

### Key Question
**Does `query()` require Claude Code subprocess even with SDK MCP servers?**

**Evidence FOR no-subprocess**:
- SDK servers documented as "in-process"
- `createSdkMcpServer()` returns actual server instance, not config for external spawn

**Evidence AGAINST no-subprocess**:
- SDK has extensive subprocess infrastructure
- Default behavior "checks if executable exists before spawning"
- Unclear if orchestration happens in-process or via Claude Code subprocess

**Resolution**: MUST TEST - this determines if approach is viable.

---

## Integration with Obsidian Plugin

### Existing Assets
- `ObsidianMCPServer.ts` - Already implements `createSdkMcpServer()` with 40+ tools
- Tool handlers call `toolsLayer.executeTool()` which works in-process
- Tool schemas use Zod, match SDK requirements

### Minimal Integration Approach
1. Import SDK in agent class
2. Pass existing MCP server to `query()` options
3. Stream results to UI
4. Map permission requests to Obsidian approval flow

### Potential Issues
1. **Bundle Size**: SDK includes full CLI, WebAssembly modules
2. **Electron Compatibility**: May use Node.js APIs unavailable in Electron renderer
3. **ESM vs CommonJS**: SDK is ESM, Obsidian plugin build needs handling
4. **API Key**: SDK expects env vars or settings files, need to pass via options

---

## Electron Considerations

### Known SDK Assets
- WebAssembly: `tree-sitter.wasm`, `tree-sitter-bash.wasm`, `resvg.wasm`
- CLI bundle: `cli.js`
- Transport layer: stdio/sse/http process management

### Electron Renderer Restrictions
- Limited Node.js API access (depends on Obsidian's nodeIntegration setting)
- May need to externalize SDK to avoid bundling issues
- WebAssembly should work but needs testing

### Bundle Strategy Options
1. **Bundle SDK**: Include in plugin (may bloat size)
2. **Externalize SDK**: Require users to install separately (poor UX)
3. **Lazy Load**: Dynamic import when needed (best if size is issue)

---

## Comparison: SDK vs Direct API (WandWithThinkingAgent)

### SDK Advantages (if it works)
- ✅ Real Claude Code capabilities (better prompts, workflows)
- ✅ Built-in agent loop orchestration
- ✅ Permission system
- ✅ File checkpointing
- ✅ Session management
- ✅ Hook system for extensibility

### Direct API Advantages (current approach)
- ✅ Works NOW (proven)
- ✅ Smaller bundle size
- ✅ No subprocess concerns
- ✅ Full control over prompts and flow
- ✅ No hidden dependencies

### Decision Criteria
Use SDK ONLY if:
1. Works without subprocess spawning
2. Bundle size acceptable (<2MB increase)
3. Materially better UX/capabilities than direct API
4. Maintenance burden acceptable (SDK version updates, breaking changes)

---

## Testing Strategy

### Phase 1: Smoke Test (30 min)
```typescript
// Minimal test
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const server = createSdkMcpServer({
  name: 'test',
  tools: [
    tool('test_tool', 'Test', { msg: z.string() }, async (args) => ({
      content: [{ type: 'text', text: `Echo: ${args.msg}` }]
    }))
  ]
});

const result = await query({
  prompt: 'Use test_tool with msg "hello"',
  options: {
    model: 'claude-sonnet-4-5-20250929',
    mcpServers: { test: server },
    maxTurns: 1,
  }
});

for await (const msg of result) {
  console.log(msg);
}
```

**Expected Outcomes**:
- ✅ Works → Proves no-subprocess viability
- ❌ Fails with "executable not found" → Kills approach
- ❌ Fails with import error → Electron incompatibility

### Phase 2: Integration Test (2 hours)
- Wire 3-5 real Obsidian tools
- Test in actual Obsidian plugin context
- Verify tool execution
- Check bundle size impact

### Phase 3: Full Test (if Phase 2 succeeds)
- All 40+ tools
- Permission callback integration
- UI state management
- Error handling

---

## Open Questions

1. **Subprocess Requirement**: Can SDK run without Claude Code process?
2. **API Key Passing**: Can we pass API key purely via Options?
3. **Electron Compatibility**: Does SDK work in Electron renderer?
4. **Bundle Size**: What's the actual size impact?
5. **Permission Integration**: How to map SDK permissions to Obsidian approval UI?
6. **System Prompt**: Default vs custom for Obsidian context?

---

## References

- SDK TypeScript definitions: `node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts`
- SDK implementation: `node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`
- Official docs: https://platform.claude.com/docs/en/agent-sdk/overview
- Existing MCP server: `src/agents/ObsidianMCPServer.ts`
- Current agent: `src/agents/WandWithThinkingAgent.ts`
