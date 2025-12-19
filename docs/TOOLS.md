# Tool Reference

Complete reference for all tools available in the Obsidian Tool-Calling Agent.

## Overview

Tools are the building blocks of action plans. Each tool:
- Has a specific purpose
- Accepts typed input arguments
- Returns typed output
- Has a risk level (`read-only`, `writes`, or `commands`)

---

## Vault Tools

File and folder operations using Obsidian's Vault API.

### vault.ensureFolder

Create a folder if it doesn't already exist.

**Risk Level:** `writes`

**Input:**
```typescript
{
  path: string  // Folder path (e.g., "Projects/Active")
}
```

**Output:**
```typescript
{
  path: string     // Normalized path
  created: boolean // True if folder was created, false if existed
}
```

**Example:**
```json
{
  "id": "createFolder",
  "tool": "vault.ensureFolder",
  "args": { "path": "Projects/2025" },
  "preview": "Create Projects/2025 folder"
}
```

---

### vault.createFile

Create a new file with content.

**Risk Level:** `writes`

**Input:**
```typescript
{
  path: string            // File path (e.g., "Notes/idea.md")
  content: string         // File content
  ifNotExists?: boolean   // Only create if doesn't exist (default: true)
  collisionStrategy?: "error" | "create-unique" | "overwrite"
  frontmatter?: object    // Optional YAML frontmatter
}
```

**Output:**
```typescript
{
  path: string      // Actual path (may differ if create-unique)
  created: boolean  // True if file was created
  etag?: string     // File identifier
  mtimeMs?: number  // Modification time
}
```

**Example:**
```json
{
  "id": "createNote",
  "tool": "vault.createFile",
  "args": {
    "path": "Daily/${date}.md",
    "content": "# Daily Note\n\nCreated automatically.",
    "frontmatter": { "tags": ["daily", "auto"] }
  },
  "preview": "Create daily note"
}
```

---

### vault.readFile

Read the contents of a file.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  path: string       // File path
  maxBytes?: number  // Limit content size (default: unlimited)
  as?: "text" | "base64"  // Output format (default: "text")
}
```

**Output:**
```typescript
{
  path: string
  content: string
  etag?: string
  mtimeMs?: number
  truncated?: boolean  // True if content was limited
}
```

**Example:**
```json
{
  "id": "readTemplate",
  "tool": "vault.readFile",
  "args": { "path": "Templates/meeting.md" },
  "preview": "Read meeting template"
}
```

---

### vault.writeFile

Write content to a file (create or overwrite).

**Risk Level:** `writes`

**Input:**
```typescript
{
  path: string
  content: string
  mode?: "overwrite" | "append"  // Default: "overwrite"
  expectedEtag?: string          // Optimistic concurrency check
}
```

**Output:**
```typescript
{
  path: string
  etag?: string
  mtimeMs?: number
  bytesWritten?: number
}
```

**Example:**
```json
{
  "id": "updateNote",
  "tool": "vault.writeFile",
  "args": {
    "path": "Notes/todo.md",
    "content": "# Updated Todo\n\n- [ ] Task 1",
    "mode": "overwrite"
  },
  "preview": "Update todo note"
}
```

---

### vault.rename

Rename or move a file or folder.

**Risk Level:** `writes`

**Input:**
```typescript
{
  fromPath: string
  toPath: string
  collisionStrategy?: "error" | "overwrite" | "create-unique"
}
```

**Output:**
```typescript
{
  fromPath: string
  toPath: string
}
```

**Example:**
```json
{
  "id": "archiveNote",
  "tool": "vault.rename",
  "args": {
    "fromPath": "Inbox/note.md",
    "toPath": "Archive/2025/note.md"
  },
  "preview": "Move note to archive"
}
```

---

### vault.delete

Delete a file or folder.

**Risk Level:** `writes`

**Input:**
```typescript
{
  path: string
  trash?: boolean        // Move to trash vs permanent delete (default: true)
  requireExists?: boolean // Error if doesn't exist (default: true)
}
```

**Output:**
```typescript
{
  path: string
  deleted: boolean
  trashed?: boolean
}
```

**Example:**
```json
{
  "id": "deleteTemp",
  "tool": "vault.delete",
  "args": { "path": "Temp/scratch.md", "trash": true },
  "preview": "Move scratch file to trash"
}
```

---

### vault.searchText

Search for text across files.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  query: string
  mode?: "plain" | "regex"   // Default: "plain"
  paths?: string[]           // Limit to specific folders
  caseSensitive?: boolean    // Default: false
  limit?: number             // Max results (default: 50)
  snippetLength?: number     // Context around match (default: 120)
}
```

**Output:**
```typescript
{
  matches: Array<{
    path: string
    line?: number
    snippet: string
  }>
  truncated: boolean
}
```

**Example:**
```json
{
  "id": "findTodos",
  "tool": "vault.searchText",
  "args": {
    "query": "- [ ]",
    "paths": ["Projects"],
    "limit": 100
  },
  "preview": "Find unchecked todos in Projects"
}
```

---

### vault.listFiles

List files in a folder.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  prefix?: string       // Folder path (default: root)
  recursive?: boolean   // Include subfolders (default: false)
  extensions?: string[] // Filter by extension (e.g., ["md"])
  limit?: number        // Max results
}
```

**Output:**
```typescript
{
  items: Array<{
    path: string
    kind: "file" | "folder"
    sizeBytes?: number
    mtimeMs?: number
  }>
  truncated: boolean
}
```

**Example:**
```json
{
  "id": "listInbox",
  "tool": "vault.listFiles",
  "args": {
    "prefix": "Inbox",
    "extensions": ["md"],
    "recursive": true
  },
  "preview": "List markdown files in Inbox"
}
```

---

## Editor Tools

Operations on the active editor and selection.

### editor.getSelection

Get the currently selected text.

**Risk Level:** `read-only`

**Input:** None

**Output:**
```typescript
{
  text: string
  isEmpty: boolean
  filePath?: string
  mode?: "source" | "preview" | "unknown"
  range?: {
    from: { line: number; ch: number }
    to: { line: number; ch: number }
  }
}
```

**Example:**
```json
{
  "id": "getSelected",
  "tool": "editor.getSelection",
  "args": {},
  "preview": "Get selected text"
}
```

---

### editor.replaceSelection

Replace the current selection with new text.

**Risk Level:** `writes`

**Input:**
```typescript
{
  text: string
  preserveIndent?: boolean  // Maintain indentation (default: false)
}
```

**Output:**
```typescript
{
  filePath: string
  range: { from: {...}; to: {...} }
  insertedChars: number
}
```

**Example:**
```json
{
  "id": "replaceWithLinks",
  "tool": "editor.replaceSelection",
  "args": {
    "text": "[[Note 1]]\n[[Note 2]]\n[[Note 3]]"
  },
  "preview": "Replace selection with links"
}
```

---

### editor.insertAtCursor

Insert text at the current cursor position.

**Risk Level:** `writes`

**Input:**
```typescript
{
  text: string
}
```

**Output:**
```typescript
{
  filePath: string
  cursorAfter: { line: number; ch: number }
  insertedChars: number
}
```

**Example:**
```json
{
  "id": "insertTimestamp",
  "tool": "editor.insertAtCursor",
  "args": { "text": "Updated: 2025-12-16" },
  "preview": "Insert timestamp"
}
```

---

### editor.getActiveFilePath

Get the path of the currently active file.

**Risk Level:** `read-only`

**Input:** None

**Output:**
```typescript
{
  path: string | null
  exists: boolean
}
```

**Example:**
```json
{
  "id": "getActive",
  "tool": "editor.getActiveFilePath",
  "args": {},
  "preview": "Get active file path"
}
```

---

## Workspace Tools

Operations on the Obsidian workspace.

### workspace.openFile

Open a file in the editor.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  path: string
  newLeaf?: boolean  // Open in new pane (default: false)
  focus?: boolean    // Focus the pane (default: true)
}
```

**Output:**
```typescript
{
  path: string
  opened: boolean
  leafId?: string
}
```

**Example:**
```json
{
  "id": "openNote",
  "tool": "workspace.openFile",
  "args": { "path": "Projects/roadmap.md", "focus": true },
  "preview": "Open roadmap"
}
```

---

### workspace.getContext

Get current workspace context.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  includeOpenLeaves?: boolean     // List all open panes
  includeActiveViewState?: boolean
}
```

**Output:**
```typescript
{
  activeFilePath?: string
  activeViewType?: string
  isMarkdown?: boolean
  openLeaves?: Array<{
    id: string
    viewType: string
    title?: string
  }>
  selectionSummary?: {
    isEmpty: boolean
    length: number
  }
}
```

**Example:**
```json
{
  "id": "getContext",
  "tool": "workspace.getContext",
  "args": { "includeOpenLeaves": true },
  "preview": "Get workspace context"
}
```

---

## Command Tools

Execute Obsidian commands.

### commands.list

List available commands.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  query?: string   // Filter by name
  prefix?: string  // Filter by ID prefix (e.g., "editor:")
  limit?: number   // Max results
}
```

**Output:**
```typescript
{
  commands: Array<{
    id: string
    name: string
    ownerHint?: string    // Plugin/core identifier
    ownerType?: "core" | "community" | "unknown"
  }>
  truncated: boolean
}
```

**Example:**
```json
{
  "id": "findCommands",
  "tool": "commands.list",
  "args": { "query": "toggle", "limit": 10 },
  "preview": "Find toggle commands"
}
```

---

### commands.run

Execute a command by ID.

**Risk Level:** `commands`

**Input:**
```typescript
{
  id: string  // Command ID (e.g., "editor:toggle-bold")
}
```

**Output:**
```typescript
{
  id: string
  executed: boolean
  errorMessage?: string
}
```

**Example:**
```json
{
  "id": "toggleBold",
  "tool": "commands.run",
  "args": { "id": "editor:toggle-bold" },
  "preview": "Toggle bold formatting"
}
```

**Common Command IDs:**
- `editor:toggle-bold` - Bold text
- `editor:toggle-italics` - Italic text
- `editor:toggle-highlight` - Highlight text
- `editor:toggle-checklist-status` - Toggle checkbox
- `app:open-settings` - Open settings
- `file-explorer:reveal-active-file` - Show in file explorer

---

## Utility Tools

Helper functions for data processing.

### util.parseMarkdownBullets

Parse a markdown bullet list into items.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  text: string
  allowNested?: boolean  // Parse nested bullets (default: false)
}
```

**Output:**
```typescript
{
  items: Array<{
    text: string    // Clean text (no bullet marker)
    raw: string     // Original line
    depth: number   // Nesting level (0 = top level)
  }>
  count: number
}
```

**Example:**
```json
{
  "id": "parseBullets",
  "tool": "util.parseMarkdownBullets",
  "args": { "text": "${selection}" },
  "preview": "Parse bullets from selection"
}
```

**Input text:**
```markdown
- First item
- Second item
  - Nested item
- Third item
```

**Output:**
```json
{
  "items": [
    { "text": "First item", "raw": "- First item", "depth": 0 },
    { "text": "Second item", "raw": "- Second item", "depth": 0 },
    { "text": "Nested item", "raw": "  - Nested item", "depth": 1 },
    { "text": "Third item", "raw": "- Third item", "depth": 0 }
  ],
  "count": 4
}
```

---

### util.slugifyTitle

Convert a title to a filename-safe slug.

**Risk Level:** `read-only`

**Input:**
```typescript
{
  title: string
  maxLength?: number  // Truncate result (default: 100)
}
```

**Output:**
```typescript
{
  slug: string
}
```

**Example:**
```json
{
  "id": "makeSlug",
  "tool": "util.slugifyTitle",
  "args": { "title": "My Amazing Note Title!" },
  "preview": "Create filename slug"
}
```

**Result:** `"my-amazing-note-title"`

---

## Common Patterns

### Create notes from bullet list

```json
{
  "version": "1.0",
  "goal": "Create notes from bullets",
  "riskLevel": "writes",
  "steps": [
    {
      "id": "getSelection",
      "tool": "editor.getSelection",
      "args": {}
    },
    {
      "id": "parseBullets",
      "tool": "util.parseMarkdownBullets",
      "args": { "text": "$steps.getSelection.text" }
    },
    {
      "id": "ensureFolder",
      "tool": "vault.ensureFolder",
      "args": { "path": "Notes" }
    },
    {
      "id": "createNotes",
      "tool": "vault.createFile",
      "foreach": { "from": "$steps.parseBullets.items", "itemName": "item" },
      "args": {
        "path": "Notes/${item.text}.md",
        "content": "# ${item.text}\n"
      }
    }
  ]
}
```

### Search and collect results

```json
{
  "version": "1.0",
  "goal": "Find all TODOs",
  "riskLevel": "read-only",
  "steps": [
    {
      "id": "search",
      "tool": "vault.searchText",
      "args": { "query": "TODO:", "limit": 50 }
    }
  ]
}
```

### Batch rename files

```json
{
  "version": "1.0",
  "goal": "Move files to archive",
  "riskLevel": "writes",
  "steps": [
    {
      "id": "listFiles",
      "tool": "vault.listFiles",
      "args": { "prefix": "Inbox", "extensions": ["md"] }
    },
    {
      "id": "moveFiles",
      "tool": "vault.rename",
      "foreach": { "from": "$steps.listFiles.items", "itemName": "file" },
      "args": {
        "fromPath": "${file.path}",
        "toPath": "Archive/${file.path}"
      }
    }
  ]
}
```
