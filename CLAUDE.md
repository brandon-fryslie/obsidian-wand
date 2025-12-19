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
