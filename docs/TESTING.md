# Testing the Plugin in Obsidian

This guide explains how to test the Obsidian Tool-Calling Agent plugin in a development environment.

## Prerequisites

- Node.js 20.x (check with `node --version`)
- pnpm installed (`npm install -g pnpm`)
- Obsidian desktop app installed

## Quick Start

### 1. Build the Plugin

```bash
# Install dependencies
pnpm install

# Build for development (with source maps)
pnpm run dev

# Or build for production
pnpm run build
```

This creates `main.js` in the project root.

### 2. Set Up a Test Vault

Create a dedicated test vault to avoid affecting your real notes:

```bash
# Create a test vault directory
mkdir -p ~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent
```

### 3. Link the Plugin

Copy or symlink the built files to your test vault:

```bash
# Option A: Symlink (recommended for development)
ln -sf "$(pwd)/main.js" ~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent/
ln -sf "$(pwd)/manifest.json" ~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent/

# Option B: Copy files
cp main.js manifest.json ~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent/
```

### 4. Enable the Plugin

1. Open Obsidian
2. Open the test vault (File → Open Vault → select `obsidian-test-vault`)
3. Go to Settings → Community Plugins
4. Turn off "Restricted Mode" if prompted
5. Click "Installed plugins" → find "Tool-Calling Agent"
6. Enable the plugin

### 5. Configure LLM Provider

1. Go to Settings → Tool-Calling Agent
2. Select your LLM provider (OpenAI, Anthropic, or Custom)
3. Enter your API key
4. Choose a model (e.g., `gpt-4` for OpenAI, `claude-3-sonnet-20241022` for Anthropic)

## Using the Plugin

### Open the Chat Panel

- Click the robot icon in the left ribbon, OR
- Use Command Palette (Cmd/Ctrl+P) → "Open Tool-Calling Agent"

### Test Prompts to Try

**Read-only operations:**
```
List all markdown files in the vault
```

```
Get the current selection
```

**File creation:**
```
Create a note called "Test Note" with the content "Hello World"
```

```
Create a folder called "Projects" and add a note called "Project Ideas"
```

**Working with selections:**
1. Select some bullet points in a note
2. Open the chat panel
3. Try: "Parse the selected bullets and create a separate note for each one in a folder called 'Items'"

**Using commands:**
```
List all available commands that contain "toggle"
```

## Development Workflow

### Hot Reload

For faster development, run the dev server:

```bash
pnpm run dev
```

This watches for changes and rebuilds automatically. After each rebuild:
1. In Obsidian, open Command Palette
2. Run "Reload app without saving" (or Cmd/Ctrl+R)

### View Console Logs

1. In Obsidian, open Command Palette
2. Run "Toggle Developer Tools"
3. Go to the Console tab
4. Look for logs starting with `Executing tool:` or errors

### Debug the Plan Flow

The plugin logs useful information:
- `Executing tool: <name> with args: {...}` - Shows each tool call
- Plan validation errors appear in the chat
- Network errors show user-friendly messages

## Testing Checklist

### Basic Functionality

- [ ] Plugin loads without errors
- [ ] Settings page displays correctly
- [ ] Chat panel opens via ribbon icon
- [ ] Chat panel opens via command palette

### LLM Integration

- [ ] Sending a message shows "generating" state
- [ ] Valid plan is generated and displayed
- [ ] Plan preview shows risk level and file operations
- [ ] Approve button triggers execution
- [ ] Cancel button clears the plan

### Tool Operations

- [ ] `vault.createFile` - Creates a new note
- [ ] `vault.readFile` - Reads note content
- [ ] `vault.ensureFolder` - Creates folders
- [ ] `editor.getSelection` - Gets selected text
- [ ] `util.parseMarkdownBullets` - Parses bullet lists

### Error Handling

- [ ] Invalid API key shows helpful error
- [ ] Network errors show retry option
- [ ] Invalid plan triggers retry with feedback

## Troubleshooting

### Plugin doesn't appear in settings

- Ensure `manifest.json` is in the plugin folder
- Check that `main.js` exists and is not empty
- Try restarting Obsidian

### "API key invalid" error

- Verify the API key in settings
- Check you selected the correct provider
- Ensure the key has the right permissions

### Plan generation fails

- Check the developer console for errors
- Verify internet connection
- Try a simpler prompt first

### Tools don't execute

- Check console for error messages
- Verify the plan preview shows correct operations
- Ensure safety settings allow the operation (e.g., deletes require opt-in)

## Running Automated Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test -- tests/services/PlanValidator.test.ts
```

## Project Structure

```
src/
├── main.ts              # Plugin entry point
├── views/
│   └── ChatView.ts      # Obsidian view wrapper
├── components/
│   ├── ChatPanel.svelte # Main chat UI
│   ├── PlanPreview.svelte
│   └── ...
├── services/
│   ├── ChatController.ts # Orchestration
│   ├── LLMProvider.ts    # API calls
│   ├── Executor.ts       # Plan execution
│   ├── PlanValidator.ts  # Plan validation
│   └── ToolsLayer.ts     # Tool implementations
├── schemas/
│   ├── ActionPlanSchema.ts
│   └── toolSchemas.ts
└── types/
    ├── ActionPlan.ts
    └── settings.ts
```
