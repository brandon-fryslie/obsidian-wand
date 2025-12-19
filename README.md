# Wand

Natural language automation for Obsidian. Type what you want, and the AI creates a plan and executes it.

## Features

- 🪄 **Natural Language** - Type what you want in plain English
- 📋 **Plan Preview** - See exactly what will happen before execution
- ✅ **Safe Execution** - All operations require confirmation
- 🔄 **Saved Actions** - Save successful plans as reusable macros
- 📁 **Vault Operations** - Create, read, write, organize files and folders
- ⌨️ **Commands** - Execute any Obsidian command
- 🔍 **Selection Aware** - Operate on selected text or entire files

## Quick Start

1. Install the plugin
2. Add your LLM API key in settings
3. Click the wand icon or use command palette → "Open Wand"
4. Try: *"Create a note called 'Meeting Notes' with today's date"*

## Development

```bash
# Install dependencies
pnpm install

# Build and install to test vault
just setup

# Enable plugins and open Obsidian
just run

# Watch mode with hot reload
just dev
```

## Requirements

- Obsidian v0.15.0+
- LLM API key (OpenAI, Anthropic, or custom endpoint)
- Desktop only

## Usage Examples

- *"Create a folder called 'Projects' and add a note for each project"*
- *"Take these bullet points and create separate notes for each"*
- *"Create a daily note with today's date"*

## Safety

- **Confirmation Required** - All plans must be approved
- **Path Sandboxing** - Operations stay within your vault
- **Risk Levels** - Plans marked as read-only, writes, or commands
- **Progress Cancellation** - Stop execution at any time

## License

MIT
