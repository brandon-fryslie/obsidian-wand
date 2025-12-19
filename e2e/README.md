# E2E Testing Guide

End-to-end testing for the Obsidian Tool-Calling Agent plugin using Playwright and Chrome DevTools Protocol (CDP).

## Overview

This E2E testing infrastructure launches a real instance of Obsidian, connects to it via CDP, and verifies the plugin behaves correctly in the actual application environment.

### Why CDP Instead of Traditional Browser Launch?

Obsidian is a packaged Electron app, not a web page. We use CDP (Chrome DevTools Protocol) to automate it:

1. **Launch Obsidian** with `--remote-debugging-port=9222` flag
2. **Connect Playwright** to the CDP endpoint at `http://localhost:9222`
3. **Interact with UI** using standard Playwright APIs (selectors, keyboard, etc.)
4. **Clean up** by closing browser connection and terminating process

This approach is more reliable than Playwright's experimental Electron mode and gives us full control over the app lifecycle.

## Prerequisites

Before running E2E tests, ensure you have:

1. **Obsidian installed** at `/Applications/Obsidian.app` (macOS)
2. **Test vault created** at `~/obsidian-test-vault` (or custom path via `OBSIDIAN_TEST_VAULT` env var)
3. **Plugin built and installed** in the test vault
4. **Playwright browsers installed**: `pnpm playwright install`

## Quick Start

### First-Time Setup

```bash
# Install dependencies
pnpm install

# Build plugin and setup test vault
just setup-e2e

# Run E2E tests
just test-e2e
```

### Run Tests

```bash
# Headless mode (default)
just test-e2e

# With visible browser (see Obsidian window)
just test-e2e-headed

# With Playwright inspector for debugging
just test-e2e-debug

# Or use pnpm directly
pnpm playwright test
```

## Architecture

### File Structure

```
e2e/
├── README.md                    # This file
├── helpers/
│   └── obsidian-launcher.ts     # CDP launch/close utilities
├── smoke.spec.ts                # Basic plugin loading tests
└── test-results/                # Test artifacts (screenshots, traces)
```

### Key Components

#### `obsidian-launcher.ts`

Reusable helper for launching/closing Obsidian:

```typescript
import { launchObsidian, closeObsidian, getObsidianPage } from './helpers/obsidian-launcher';

// Launch Obsidian with CDP
const { browser, process } = await launchObsidian('~/obsidian-test-vault');

// Get the main page
const page = getObsidianPage(browser);

// Interact with Obsidian
await page.click('.some-selector');

// Clean up
await closeObsidian(browser, process);
```

**Features:**
- Spawns Obsidian process with remote debugging
- Waits for CDP endpoint to be ready (max 15 seconds)
- Connects Playwright browser
- Handles errors and cleanup gracefully
- Logs output for debugging

#### `playwright.config.ts`

Playwright configuration optimized for Electron testing:

- **Serial execution** (`workers: 1`) - Obsidian is single-instance
- **60-second timeout** - App launch can be slow
- **Artifact capture** - Screenshots on failure, traces on retry
- **Test directory** - `./e2e` for all E2E specs

## Known Issues

### "Trust this plugin?" Prompt on First Run

When Obsidian first loads a community plugin, it shows a trust confirmation dialog. This can block E2E tests.

**Workaround:**

Pre-configure the test vault to trust the plugin:

```bash
# Edit community-plugins.json
cat > ~/obsidian-test-vault/.obsidian/community-plugins.json <<EOF
["obsidian-toolagent"]
EOF
```

Or manually open Obsidian once and click "Trust" before running E2E tests.

### CDP Connection Timeout

If you see "CDP endpoint not available after 15000ms":

1. **Check Obsidian is installed** at `/Applications/Obsidian.app`
2. **Kill any running Obsidian instances**: `pkill -9 Obsidian`
3. **Check port 9222 is free**: `lsof -i :9222` (kill if in use)
4. **Try launching manually**:
   ```bash
   /Applications/Obsidian.app/Contents/MacOS/Obsidian \
     --remote-debugging-port=9222 \
     ~/obsidian-test-vault
   ```
5. **Verify CDP works**: `curl http://localhost:9222/json/version`

### Plugin Not Loaded

If tests pass but plugin functionality doesn't work:

1. **Verify plugin is installed**: Check `~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent/`
2. **Check main.js exists**: `ls -l ~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent/main.js`
3. **Rebuild and reinstall**: `just setup-e2e`
4. **Check Obsidian logs**: Look for errors in Obsidian Developer Tools (Cmd+Opt+I)

## Writing Tests

### Test Template

```typescript
import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, getObsidianPage } from './helpers/obsidian-launcher';

test.describe('My Feature', () => {
  test('does something', async () => {
    const vaultPath = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';
    const { browser, process: obsidianProcess } = await launchObsidian(vaultPath);

    try {
      const page = getObsidianPage(browser);

      // Wait for Obsidian UI to be ready
      await page.waitForSelector('.workspace', { timeout: 10000 });

      // Your test logic here
      await page.click('.my-plugin-button');
      expect(await page.textContent('.result')).toBe('expected value');

    } finally {
      // Always clean up, even if test fails
      await closeObsidian(browser, obsidianProcess);
    }
  });
});
```

### Selector Strategy

Obsidian's UI doesn't have stable test IDs, so use:

1. **CSS classes** - `.workspace`, `.side-dock-ribbon`, `.modal.mod-settings`
2. **ARIA labels** - `[aria-label="Settings"]`
3. **Text content** - `.setting-item-heading:has-text("Installed plugins")`

**Avoid:**
- Positional selectors (`:nth-child`, `:first-of-type`)
- XPath (harder to maintain)
- Inline styles (change frequently)

### Best Practices

1. **Always use try/finally** - Ensure `closeObsidian()` runs even if test fails
2. **Wait for workspace** - `await page.waitForSelector('.workspace')` before interacting
3. **Use reasonable timeouts** - Obsidian launch is slow, but selectors should be fast
4. **Take screenshots on key steps** - `await page.screenshot({ path: 'debug.png' })`
5. **Test one thing per test** - Keep tests focused and fast

## Debugging Tests

### View Obsidian UI During Test

```bash
just test-e2e-headed
```

This opens Obsidian visibly so you can see what the test is doing.

### Use Playwright Inspector

```bash
just test-e2e-debug
```

Features:
- Step through test line by line
- Inspect elements in real-time
- View console logs
- Modify selectors interactively

### Check Test Artifacts

After a test fails:

1. **Screenshots**: `e2e/test-results/smoke-test.png`
2. **Traces**: `e2e/test-results/artifacts/<test-name>/trace.zip`
3. **HTML report**: `pnpm playwright show-report e2e/test-results/html`

### Enable Verbose Logging

```bash
DEBUG=pw:api pnpm playwright test
```

Shows all Playwright API calls and responses.

## Platform Support

### macOS (Primary)

Fully supported. Obsidian path: `/Applications/Obsidian.app/Contents/MacOS/Obsidian`

### Linux (Future)

Needs implementation:
- Find Obsidian install path (likely `/usr/bin/obsidian` or AppImage)
- Update `obsidian-launcher.ts` to detect platform
- Test CDP launch with Linux Electron

### Windows (Future)

Needs implementation:
- Find Obsidian install path (likely `C:\Program Files\Obsidian\Obsidian.exe`)
- Update `obsidian-launcher.ts` to detect platform
- Handle Windows process spawning differences

## CI/CD Integration

### GitHub Actions (Future)

E2E tests can run in CI with a macOS runner:

```yaml
- name: Setup Obsidian
  run: |
    brew install --cask obsidian
    just setup-e2e

- name: Run E2E Tests
  run: just test-e2e
```

**Considerations:**
- macOS runners are expensive (10x Linux cost)
- Consider running E2E only on `main` or release branches
- Upload test artifacts on failure

## Performance

### Test Speed

- **Smoke test**: ~4 seconds per test
- **Obsidian launch**: ~2-3 seconds
- **CDP connection**: ~500ms
- **UI interaction**: <100ms per action

### Optimization Ideas (Future)

1. **Keep Obsidian alive** between tests (reuse single instance)
2. **Parallel execution** with multiple test vaults
3. **Selective test runs** (only affected tests in CI)
4. **Snapshot testing** for UI state

## Contributing

When adding new E2E tests:

1. **Follow existing patterns** in `smoke.spec.ts`
2. **Use descriptive test names** - `test('user can create a new note', ...)`
3. **Add comments** for complex selectors or interactions
4. **Test locally 3+ times** before committing (no flakes!)
5. **Update this README** if you add new helpers or patterns

## Troubleshooting Checklist

If tests are failing:

- [ ] Plugin built: `just build`
- [ ] Test vault exists: `ls ~/obsidian-test-vault`
- [ ] Plugin installed: `ls ~/obsidian-test-vault/.obsidian/plugins/obsidian-toolagent/main.js`
- [ ] Obsidian not running: `pkill -9 Obsidian`
- [ ] Port 9222 free: `lsof -i :9222` (should be empty)
- [ ] Playwright installed: `pnpm playwright install`
- [ ] Test runs 3 times: `just test-e2e && just test-e2e && just test-e2e`

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Obsidian Plugin Development](https://docs.obsidian.md/Plugins)
- [Electron Testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing)

## Questions?

If you encounter issues not covered here:

1. Check [existing GitHub issues](https://github.com/your-repo/issues)
2. Add debug logging to `obsidian-launcher.ts`
3. Manually test Obsidian launch: `/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 ~/obsidian-test-vault`
4. File a new issue with logs and steps to reproduce
