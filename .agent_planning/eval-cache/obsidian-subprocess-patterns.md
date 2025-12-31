# Obsidian Plugin Subprocess Patterns - Reusable Knowledge

**Last Updated**: 2025-12-31 01:45:00
**Source**: project-evaluator STATUS-20251231-014500.md (sidecar evaluation)
**Confidence**: HIGH (verified via production plugin analysis)

---

## Subprocess Viability in Obsidian

### Core Facts

**Desktop**: ✅ Subprocess spawning is FULLY SUPPORTED
- Obsidian runs in Electron renderer process
- Node.js APIs available via `require()` or `import`
- `child_process` module works normally
- Multiple production plugins prove this works

**Mobile**: ❌ Subprocess spawning NOT SUPPORTED
- iOS/Android do not support Node.js subprocess APIs
- Plugins must gracefully degrade or disable on mobile

**Sandboxed Installs** (Linux Flatpak/Snap): ⚠️ REQUIRES PERMISSIONS
- Sandbox blocks access to system binaries by default
- Workaround: Grant filesystem permissions
- Alternative: Use .deb/.rpm/.AppImage installation

---

## Production Plugin Examples

### 1. obsidian-git
**Purpose**: Git version control integration
**Subprocess Pattern**: Uses `simple-git` library wrapping `child_process.spawn()`
**Key Features**:
- Spawns git binary on desktop
- Validates executable: `spawnAsync(gitPath, ['--version'])`
- Cross-platform path detection (Windows default paths)
- Desktop-only (uses isomorphic-git on mobile)

**Code Pattern**:
```typescript
import simpleGit from 'simple-git';

const git = simpleGit(vaultPath);
const status = await git.status();
```

**Lessons**:
- ✅ User installs git separately
- ✅ Plugin detects in PATH or uses custom path
- ✅ Graceful degradation on mobile

**Source**: https://github.com/Vinzent03/obsidian-git

### 2. obsidian-shellcommands
**Purpose**: Execute arbitrary shell commands
**Subprocess Pattern**: Explicit NodeJS `child_process` usage
**Key Features**:
- Delegates to `shell.spawnChildProcess()`
- Handles stdin/stdout/stderr streams
- Cross-platform shell detection (cmd.exe, bash, zsh, fish)
- Variable substitution and escaping

**Code Pattern**:
```typescript
const { spawn } = require('child_process');

const child = shell.spawnChildProcess(command, cwd, options);
child.stdout.setEncoding('utf8');
child.stdout.on('data', (data) => { /* handle */ });
child.on('exit', (code) => { /* cleanup */ });
```

**Cross-Platform Shell Detection**:
- Windows: `process.env.COMSPEC` → `cmd.exe`
- Mac/Linux: `process.env.SHELL` → bash/zsh/fish
- PATH parsing: Windows uses `;`, Unix uses `:`

**Lessons**:
- ✅ Desktop-only feature (documented clearly)
- ✅ Rich subprocess lifecycle management
- ✅ Proper stream encoding (UTF-8)
- ✅ Exit code handling

**Source**: https://github.com/Taitava/obsidian-shellcommands

### 3. obsidian-terminal
**Purpose**: Integrated terminal emulator
**Subprocess Pattern**: xterm.js with shell subprocess
**Key Features**:
- Spawns shell processes for integrated terminals
- Long-running subprocess management
- Optional Python integration (Windows)

**Lessons**:
- ✅ Advanced subprocess usage (PTY)
- ✅ Manages multiple concurrent processes
- ✅ Platform-specific requirements documented

**Source**: https://github.com/polyipseity/obsidian-terminal

### 4. obsidian-syncthing-launcher
**Purpose**: Run Syncthing as child process
**Subprocess Pattern**: Direct subprocess spawning
**Key Features**:
- Explicitly designed to run long-running subprocess
- Lifecycle tied to Obsidian (starts/stops with app)

**Lessons**:
- ✅ Subprocess spawning as core feature (not edge case)
- ✅ Proves Electron allows long-running children

**Source**: https://github.com/MattSzymonski/Obsidian-Syncthing-Launcher

---

## Claude Code Integration Patterns

### Multiple Plugins Spawn Claude Code Externally

**Plugins**:
- obsidian-claude-code-plugin (deivid11)
- obsidian-ai-agent (m-rgba)
- obsidian-claude-assistant (kazuph)
- obsidian-claude-code-mcp (iansinnott)

**Common Pattern**: NONE bundle Claude Code - all require user installation

**Setup Requirements** (typical):
1. User installs Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
2. User configures API key in plugin settings
3. Plugin settings have "executable path" field (default: 'claude')
4. Plugin spawns CLI with appropriate arguments

**obsidian-claude-code-plugin Requirements**:
```
- Install via npm: npm install -g @anthropic-ai/claude-code
- Configure Anthropic API key
- Set executable path in plugin settings (defaults to 'claude')
```

**obsidian-ai-agent Notes**:
- Uses `--permission-mode bypassPermissions` for full functionality
- Windows: Claude must be installed in WSL
- Requires Node.js for plugin execution

**Lessons**:
- ❌ ZERO plugins bundle Claude Code
- ✅ User installation is standard pattern
- ✅ PATH-based discovery with custom path fallback
- ⚠️ Windows-specific issues (WSL requirement in some cases)

**Sources**:
- https://github.com/deivid11/obsidian-claude-code-plugin
- https://github.com/m-rgba/obsidian-ai-agent
- https://forum.obsidian.md/t/new-plugin-agent-client-bring-claude-code-codex-gemini-cli-inside-obsidian/108448

---

## Distribution Patterns

### Pattern A: User Installs External Tool ✅ (PROVEN)

**Examples**: ALL subprocess-based plugins (git, pandoc, Claude Code, shell)

**Approach**:
- Plugin has "executable path" setting
- User installs tool via package manager (npm, apt, homebrew, etc.)
- Plugin detects in PATH or uses custom path
- Validates with version check before use

**Pros**:
- Small plugin bundle size
- User controls tool version
- Cross-platform (user's responsibility)
- No distribution/licensing issues
- Tool updates independent of plugin

**Cons**:
- Setup friction (users must install separately)
- Support burden (PATH issues, version compatibility)
- Must fail gracefully if tool not found

**Real-World UX**:
```
Settings:
  Executable Path: [claude                ] (Browse...)
  [ ] Auto-detect in PATH

Status: ✅ Found at /usr/local/bin/claude (v1.0.0)
```

### Pattern B: Bundle Executable ❌ (NOT FOUND)

**Why This Pattern Doesn't Exist**:
- Massive bundle size (must include Win/Mac/Linux binaries)
- Obsidian plugin size limits (~5MB recommended)
- Platform detection complexity
- Security/permission issues (extracting executables)
- Licensing/distribution constraints
- Update burden (plugin must update for every CLI release)

**Verdict**: Impractical for Obsidian plugins

### Pattern C: MCP Server (Plugin Exposes Tools) ✅ (EMERGING)

**Example**: obsidian-claude-code-mcp

**Approach**:
- Plugin runs WebSocket MCP server (port 22360)
- User runs Claude Code externally
- Claude Code auto-discovers Obsidian MCP server
- Communication via localhost WebSocket

**Pros**:
- Zero bundle size impact
- User controls Claude Code version
- Clean separation of concerns
- Standard MCP protocol
- Works with ANY MCP client (not just Claude Code)
- Excellent debugging (MCP Inspector)

**Cons**:
- User must run Claude Code separately
- Two-app workflow (normal for dev tools)
- Port management

**Real-World Implementation**:
> "Claude Code automatically discovers and connects to Obsidian vaults through WebSocket. The plugin uses port 22360 by default to avoid conflicts with common development services."

**Verdict**: Best pattern for AI agent integration

**Source**: https://github.com/iansinnott/obsidian-claude-code-mcp

---

## Cross-Platform Subprocess Handling

### Windows

**Shell Detection**:
```typescript
const shell = process.env.COMSPEC || 'cmd.exe';
```

**PATH Parsing**:
```typescript
const paths = process.env.PATH.split(';');
```

**Executable Extension**:
```typescript
const executable = Platform.isWin ? `${name}.exe` : name;
```

**Default Installation Paths** (example from obsidian-git):
```typescript
const DEFAULT_WIN_GIT_PATH = 'C:\\Program Files\\Git\\cmd\\git.exe';
```

**Path Normalization**:
```typescript
const normalized = path.replace(/\\/g, '/');  // Windows → Unix separators
```

### macOS/Linux

**Shell Detection**:
```typescript
const shell = process.env.SHELL || '/bin/bash';
```

**Profile Loading**:
```typescript
// Shell commands plugin loads:
// - .zshenv, .bashrc, .bash_profile, .profile
// - Supports bash, zsh, fish shells
```

**PATH Parsing**:
```typescript
const paths = process.env.PATH.split(':');
```

**Executable Discovery**:
```typescript
const { stdout } = await exec(`which ${executable}`);
return stdout.trim();
```

### Universal Pattern

```typescript
async function findExecutable(name: string, defaultPaths?: string[]): Promise<string> {
  // 1. Try custom setting
  if (settings.customPath) {
    if (await exists(settings.customPath)) return settings.customPath;
  }

  // 2. Try PATH
  const inPath = await checkInPath(name);
  if (inPath) return name;

  // 3. Try platform-specific defaults
  const platformDefaults = Platform.isWin ? windowsDefaults : unixDefaults;
  for (const path of platformDefaults) {
    if (await exists(path)) return path;
  }

  throw new Error(`${name} not found. Please install or configure path in settings.`);
}

async function validateExecutable(path: string, expectedVersion?: string): Promise<void> {
  const { stdout } = await exec(`${path} --version`);
  if (expectedVersion && !stdout.includes(expectedVersion)) {
    throw new Error(`Version mismatch: expected ${expectedVersion}, got ${stdout}`);
  }
}
```

---

## Subprocess Lifecycle Management

### Basic Spawn Pattern

```typescript
import { spawn } from 'child_process';

const child = spawn(executable, args, {
  cwd: workingDirectory,
  env: { ...process.env, CUSTOM_VAR: 'value' },
  shell: Platform.isWin,  // Use shell on Windows for .bat/.cmd
});

// Encoding
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');

// Output handling
child.stdout.on('data', (data: string) => {
  console.log(data);
});

child.stderr.on('data', (data: string) => {
  console.error(data);
});

// Exit handling
child.on('exit', (code: number) => {
  console.log(`Process exited with code ${code}`);
});

// Error handling (spawn failures)
child.on('error', (err: Error) => {
  console.error('Failed to spawn process:', err);
});
```

### Input Handling

```typescript
if (stdinContent) {
  child.stdin.write(stdinContent);
  child.stdin.end();
}
```

### Termination

```typescript
// Graceful termination
child.kill('SIGTERM');

// Force kill after timeout
setTimeout(() => {
  if (!child.killed) {
    child.kill('SIGKILL');
  }
}, 5000);
```

### Realtime Output (from shell-commands)

```typescript
// Pause/resume to prevent race conditions
child.stdout.pause();
child.stderr.pause();

// Process output
processOutputChunk(data);

// Resume
child.stdout.resume();
child.stderr.resume();

// Clean up on exit
child.on('exit', () => {
  endRealtimeOutput();
});
```

---

## Error Handling Patterns

### Spawn Failures

```typescript
child.on('error', (err: Error) => {
  if (err.message.includes('ENOENT')) {
    // Executable not found
    new Notice('Executable not found. Please check path in settings.');
  } else if (err.message.includes('ENAMETOOLONG')) {
    // Command too long (Windows)
    new Notice(`Command exceeds system limit (${command.length} chars)`);
  } else {
    // Other errors
    new Notice(`Failed to spawn process: ${err.message}`);
  }
});
```

### Exit Codes

```typescript
child.on('exit', (code: number) => {
  if (code === 0) {
    // Success
  } else if (ignoredErrorCodes.includes(code)) {
    // Known non-critical errors (configurable)
  } else {
    // Actual errors
    throw new Error(`Command failed with exit code ${code}`);
  }
});
```

### Validation Before Spawn

```typescript
async function executeWithValidation(executable: string, args: string[]): Promise<void> {
  // 1. Check executable exists
  const exists = await validateExecutable(executable);
  if (!exists) {
    throw new Error('Executable not found');
  }

  // 2. Check permissions (Unix)
  if (!Platform.isWin) {
    const { stdout } = await exec(`test -x ${executable} && echo "ok"`);
    if (!stdout.includes('ok')) {
      throw new Error('Executable not executable');
    }
  }

  // 3. Spawn
  const child = spawn(executable, args);
  // ...
}
```

---

## Electron Renderer Considerations

### What Works

- ✅ `child_process` module (spawn, exec, fork)
- ✅ `fs` module (file system access)
- ✅ `path` module (path manipulation)
- ✅ `process.env` (environment variables)
- ✅ Platform detection (`Platform.isWin`, `Platform.isMacOS`)

### Import Method

```typescript
// Modern import (works with esbuild)
import { spawn, exec } from 'child_process';

// Or via require (more compatible)
const { spawn } = require('child_process');
```

### Node API Access

From Obsidian Forum:
> "The desktop has a limited emulation of node APIs, but browser APIs are what should actually be used."

- Node APIs loaded via `require()`, not `import` (though build tools convert)
- Most Node.js APIs available, but some restrictions may exist
- Mobile has NO Node.js APIs

### Build Configuration

Typical esbuild config for Obsidian plugins:
```javascript
external: [
  'obsidian',
  'electron',
  '@codemirror/*',
  // Don't externalize node built-ins - bundle them
],
platform: 'node',  // Access to Node.js APIs
```

---

## When to Use Subprocess Spawning

### ✅ Good Use Cases

1. **Calling External CLI Tools**
   - Git, pandoc, ffmpeg, etc.
   - User installs tool separately
   - Simple command execution

2. **AI Agent Integration**
   - Claude Code, Codex, Gemini CLI
   - Pattern: User installs, plugin spawns
   - Alternative: MCP server (better)

3. **Long-Running Services**
   - Syncthing, local servers
   - Process lifecycle tied to Obsidian

4. **Shell Script Execution**
   - User-defined automation
   - Vault-specific commands

### ❌ Bad Use Cases

1. **Anything That Could Be JS**
   - Don't spawn Node.js for simple tasks
   - Use direct function calls instead

2. **Mobile-Compatible Features**
   - No subprocess support on mobile
   - Find alternative implementation

3. **Embedded Complexity**
   - Don't bundle complex executables
   - User installation pattern better

---

## Best Practices Summary

### Do ✅

- ✅ Use Pattern A (user installs tool) for executables
- ✅ Validate executable before spawning (`--version` check)
- ✅ Provide clear error messages for missing executables
- ✅ Support custom executable paths in settings
- ✅ Auto-detect in PATH as default
- ✅ Set proper encoding (UTF-8) for stdout/stderr
- ✅ Handle all events (data, exit, error)
- ✅ Clean up processes on plugin unload
- ✅ Document desktop-only limitations
- ✅ Graceful degradation on unsupported platforms

### Don't ❌

- ❌ Bundle executables in plugin
- ❌ Assume executable is in PATH
- ❌ Ignore exit codes
- ❌ Forget to handle spawn errors
- ❌ Leave zombie processes
- ❌ Use subprocess for simple JS tasks
- ❌ Expect mobile compatibility
- ❌ Hardcode platform-specific paths

---

## References

### Official Documentation
- Obsidian Forum: [Execute external commands](https://forum.obsidian.md/t/how-can-i-execute-an-external-command-and-return-results-to-obsidian/48249)
- Obsidian Forum: [child_process in Node.js](https://forum.obsidian.md/t/when-i-use-child-process-in-nodejs-i-get-the-following-error-and-i-dont-know-why/56211)
- Node.js Docs: [child_process](https://nodejs.org/api/child_process.html)

### Production Plugin Examples
- [obsidian-git](https://github.com/Vinzent03/obsidian-git) - Git subprocess management
- [obsidian-shellcommands](https://github.com/Taitava/obsidian-shellcommands) - Shell execution
- [obsidian-terminal](https://github.com/polyipseity/obsidian-terminal) - Terminal integration
- [obsidian-syncthing-launcher](https://github.com/MattSzymonski/Obsidian-Syncthing-Launcher) - Long-running subprocess
- [obsidian-claude-code-plugin](https://github.com/deivid11/obsidian-claude-code-plugin) - Claude Code integration
- [obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp) - MCP server pattern

### Related Knowledge
- `.agent_planning/eval-cache/claude-sdk-integration.md` - SDK subprocess behavior
- `.agent_planning/claude-sdk-inprocess/STATUS-2025-12-31-005911.md` - In-process integration
- `.agent_planning/claude-sdk-sidecar/STATUS-20251231-014500.md` - Sidecar evaluation

---

**Last Updated**: 2025-12-31 01:45:00
**Confidence**: HIGH (verified via multiple production plugin analysis)
**Next Review**: When new subprocess patterns emerge or Obsidian API changes
