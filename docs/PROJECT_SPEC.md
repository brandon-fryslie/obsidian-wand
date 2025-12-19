# Project Specification

Comprehensive specification for the Obsidian Tool-Calling Agent plugin.

## Overview

The Obsidian Tool-Calling Agent transforms natural language instructions into safe, executable automation plans. Users describe what they want in plain English, the plugin generates a structured plan, shows it for confirmation, then executes it step-by-step.

**Example workflow:**
1. User selects bullet points in a note
2. Types: "Create a note for each bullet in the Projects folder"
3. Plugin shows plan: "Will create 3 files in Projects/"
4. User approves
5. Plugin creates the files and replaces selection with links

---

## Goals

### What this plugin does

- **Natural language automation**: Turn "create notes from these bullets" into actual file operations
- **Safe execution**: All changes require explicit confirmation
- **Transparent plans**: Users see exactly what will happen before it happens
- **Offline macros**: Save successful plans for reuse without the LLM
- **Broad coverage**: Support common vault, editor, and workspace operations

### What this plugin does NOT do

- **No automatic plugin installation**: Only recommends plugins, never installs
- **No arbitrary code execution**: Only predefined tools, no eval/DOM manipulation
- **No mobile support**: Desktop Obsidian only (uses internal APIs)
- **No web scraping**: Only fetches from LLM provider and official plugin list

---

## User Experience

### Interface

**Side panel chat view:**
- Message input with "Use selection" indicator
- Conversation transcript
- Plan preview with approve/cancel buttons
- Execution progress with step-by-step logs
- Results with "Save as Macro" option

**Command palette:**
- "Open Tool-Calling Agent"
- "Run Saved Action: [macro name]" for each saved macro

**Ribbon icon:**
- Quick access to chat panel

### Typical Flow

```
1. Select text (optional)
2. Open chat panel
3. Type instruction: "Read the selection and create notes..."
4. Review plan preview
5. Click "Approve"
6. Watch execution progress
7. Optionally save as macro for reuse
```

---

## ActionPlan Schema

The LLM generates plans in this JSON format:

```json
{
  "version": "1.0",
  "goal": "Create notes from bullet points",
  "assumptions": ["Selection contains markdown bullets"],
  "riskLevel": "writes",
  "steps": [
    {
      "id": "ensureFolder",
      "tool": "vault.ensureFolder",
      "args": { "path": "Projects" },
      "preview": "Create folder Projects if needed"
    },
    {
      "id": "parseBullets",
      "tool": "util.parseMarkdownBullets",
      "args": { "text": "${selection}" },
      "preview": "Parse bullet points from selection"
    },
    {
      "id": "createNotes",
      "tool": "vault.createFile",
      "foreach": {
        "from": "$steps.parseBullets.items",
        "itemName": "item"
      },
      "args": {
        "path": "Projects/${item.text}.md",
        "content": "# ${item.text}\n\nCreated from bullet point."
      },
      "preview": "Create note for each bullet"
    }
  ]
}
```

### Schema Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version (e.g., "1.0") |
| `goal` | string | Human-readable goal description |
| `assumptions` | string[] | What the plan assumes about context |
| `riskLevel` | enum | `"read-only"`, `"writes"`, or `"commands"` |
| `steps` | Step[] | Ordered list of tool calls |

### Step Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for this step |
| `tool` | string | Tool name (e.g., `vault.createFile`) |
| `args` | object | Tool-specific arguments |
| `preview` | string | Human-readable description |
| `foreach` | object | Optional loop over array |
| `dependsOn` | string[] | Step IDs that must complete first |
| `onError` | enum | `"stop"`, `"skip"`, or `"retry"` |
| `retry` | object | Retry policy (`maxAttempts`, `backoffMs`) |

### Foreach Loops

```json
{
  "foreach": {
    "from": "$steps.parseBullets.items",
    "itemName": "item",
    "indexName": "i"
  }
}
```

- `from`: Reference to array (from previous step output)
- `itemName`: Variable name for current item
- `indexName`: Optional variable for index

### References

Use `$steps.<stepId>` to reference previous step outputs:

```json
{
  "args": {
    "content": "Items: ${$steps.parseBullets.count}"
  }
}
```

---

## Tools

### Vault Tools

| Tool | Description | Risk |
|------|-------------|------|
| `vault.ensureFolder` | Create folder if it doesn't exist | writes |
| `vault.createFile` | Create new file | writes |
| `vault.readFile` | Read file contents | read-only |
| `vault.writeFile` | Write/overwrite file | writes |
| `vault.rename` | Rename file or folder | writes |
| `vault.delete` | Delete file or folder | writes |
| `vault.searchText` | Search text across files | read-only |
| `vault.listFiles` | List files in folder | read-only |

### Editor Tools

| Tool | Description | Risk |
|------|-------------|------|
| `editor.getSelection` | Get selected text | read-only |
| `editor.replaceSelection` | Replace selected text | writes |
| `editor.insertAtCursor` | Insert text at cursor | writes |
| `editor.getActiveFilePath` | Get active file path | read-only |

### Workspace Tools

| Tool | Description | Risk |
|------|-------------|------|
| `workspace.openFile` | Open file in editor | read-only |
| `workspace.getContext` | Get workspace context | read-only |

### Command Tools

| Tool | Description | Risk |
|------|-------------|------|
| `commands.list` | List available commands | read-only |
| `commands.run` | Execute command by ID | commands |

### Utility Tools

| Tool | Description | Risk |
|------|-------------|------|
| `util.parseMarkdownBullets` | Parse bullet list | read-only |
| `util.slugifyTitle` | Convert to filename-safe slug | read-only |

---

## Tool Schemas

### vault.createFile

**Input:**
```typescript
{
  path: string;           // Relative path (e.g., "Folder/Note.md")
  content: string;        // File content
  ifNotExists?: boolean;  // Only create if doesn't exist (default: true)
  frontmatter?: object;   // Optional YAML frontmatter
}
```

**Output:**
```typescript
{
  path: string;      // Actual path created
  created: boolean;  // True if file was created
  mtimeMs?: number;  // Modification time
}
```

### vault.readFile

**Input:**
```typescript
{
  path: string;        // File path
  maxBytes?: number;   // Limit content size
}
```

**Output:**
```typescript
{
  path: string;
  content: string;
  mtimeMs?: number;
  truncated?: boolean;
}
```

### editor.getSelection

**Input:** None

**Output:**
```typescript
{
  text: string;       // Selected text
  isEmpty: boolean;   // True if no selection
  filePath?: string;  // Active file path
  range?: {
    from: { line: number; ch: number };
    to: { line: number; ch: number };
  };
}
```

### commands.run

**Input:**
```typescript
{
  id: string;  // Command ID (e.g., "editor:toggle-bold")
}
```

**Output:**
```typescript
{
  id: string;
  executed: boolean;
  errorMessage?: string;
}
```

---

## Safety Model

### Confirmation

All plans require user approval before execution. The confirmation UI shows:

- Files to be created/modified/deleted
- Commands to be executed
- Risk level badge
- Approve/Cancel buttons

**Risk levels:**
- `read-only`: Only reads data, no modifications
- `writes`: Creates or modifies files
- `commands`: Executes Obsidian commands

### Path Sandboxing

All file paths are validated:

```
✓ "Notes/Daily/today.md"     (relative, within vault)
✗ "/etc/passwd"              (absolute path blocked)
✗ "../../../outside.md"      (path traversal blocked)
✗ "file://malicious.md"      (URL schemes blocked)
```

### Safety Settings

Users can configure:
- Require confirmation for writes (default: on)
- Allow command execution (default: on)
- Allow delete operations (default: off)
- Auto-approve read-only plans (default: off)

### Undo Journal

The executor records all write operations:
- File creations (can be deleted)
- File modifications (previous content stored)
- File deletions (moved to trash)
- Selection replacements (previous text stored)

"Undo Last Run" reverts the most recent execution.

---

## LLM Integration

### Supported Providers

| Provider | Models |
|----------|--------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-3.5 Turbo |
| Anthropic | Claude 3 Opus, Sonnet, Haiku |
| Custom | Any OpenAI-compatible endpoint |

### Settings

- **Provider**: OpenAI / Anthropic / Custom
- **API Key**: User-provided, stored encrypted
- **Model**: Model name/ID
- **Temperature**: 0.0-1.0 (default: 0.2 for determinism)
- **Max Tokens**: Response limit
- **Streaming**: On/off

### Prompt Strategy

The LLM receives:

1. **System prompt**: Role, JSON output format, tool schemas
2. **Context**: Active file, selection, vault constraints
3. **Available tools**: Complete tool registry with schemas
4. **User message**: The natural language instruction

The LLM must output **only** valid JSON matching the ActionPlan schema.

### Error Handling

- Invalid JSON: Retry up to 2 times with clearer instructions
- Schema validation failure: Show error, ask user to rephrase
- API errors: Show error message with retry option

---

## Saved Macros

### Saving

After successful execution, users can save the plan as a macro:
- Give it a name
- Optionally add description
- Parameters extracted automatically (e.g., `${selection}`)

### Execution

Macros execute **without the LLM**:
1. Load saved plan
2. Bind runtime context (selection, active file)
3. Show confirmation
4. Execute via same Executor

### Parameters

Plans can include parameters:
- `${selection}` - Current selection text
- `${activeFile}` - Active file path
- `${folderName}` - User-specified folder

Missing parameters prompt user for input.

### Management

- View all macros in palette
- Run from command palette
- Rename/delete
- Export/import as JSON

---

## External Connections

The plugin makes external network requests to:

1. **LLM Provider** (OpenAI, Anthropic, or custom)
   - Sends: System prompt, user message, context
   - Receives: ActionPlan JSON

2. **Obsidian Community Plugins** (optional)
   - URL: `https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json`
   - Purpose: Plugin recommendations only
   - Never installs plugins

All requests use Obsidian's `requestUrl` helper (handles CORS, works cross-platform).

---

## Constraints

### Technical

- Desktop Obsidian only (v0.15.0+)
- TypeScript/Svelte codebase
- Official Obsidian APIs for file operations
- Commands API is internal but widely used

### Security

- API keys stored encrypted in plugin data
- No arbitrary code execution
- Path sandboxing enforced
- User confirmation required

### Scope

- Common vault operations covered
- No plugin installation/management
- No mobile support
- No web scraping or external data fetching (beyond LLM)
