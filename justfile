# Obsidian Tool-Calling Agent - Task Runner
# Use `just <task>` to run tasks

# Configuration - override with: just --set test_vault "/path/to/vault"
test_vault := env_var_or_default("OBSIDIAN_TEST_VAULT", "~/obsidian-test-vault")
plugin_name := "wand"
debug_port := "9222"

# List all available tasks
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Development mode with hot reload
dev:
    pnpm run dev

# Production build
build:
    pnpm run build

# Run unit tests
test:
    pnpm run test

# Run all validation (lint + typecheck + test)
validate:
    @echo "Running validation suite..."
    pnpm run lint
    pnpm run typecheck
    pnpm run test
    @echo "✓ All validation passed!"

# Build, install plugin to test vault, and seed with sample notes
setup: build
    #!/usr/bin/env bash
    set -euo pipefail
    VAULT_ARG="{{test_vault}}"
    VAULT="${VAULT_ARG/#\~/$HOME}"
    echo "Setting up plugin in $VAULT..."

    # Install our plugin (symlinked for hot reload)
    mkdir -p "$VAULT/.obsidian/plugins/{{plugin_name}}"
    ln -sf "$(pwd)/main.js" "$VAULT/.obsidian/plugins/{{plugin_name}}/main.js"
    ln -sf "$(pwd)/manifest.json" "$VAULT/.obsidian/plugins/{{plugin_name}}/manifest.json"
    ln -sf "$(pwd)/styles.css" "$VAULT/.obsidian/plugins/{{plugin_name}}/styles.css" 2>/dev/null || true
    touch "$VAULT/.obsidian/plugins/{{plugin_name}}/.hotreload"
    echo "✓ Plugin installed"

    # Install hot-reload plugin for development
    mkdir -p "$VAULT/.obsidian/plugins/hot-reload"
    curl -sL https://github.com/pjeby/hot-reload/releases/download/0.1.13/main.js -o "$VAULT/.obsidian/plugins/hot-reload/main.js"
    curl -sL https://github.com/pjeby/hot-reload/releases/download/0.1.13/manifest.json -o "$VAULT/.obsidian/plugins/hot-reload/manifest.json"
    echo "✓ Hot Reload plugin installed"

    ./bin/seed-vault.sh "$VAULT"
    echo ""
    echo "Next: run 'just run' to open Obsidian with plugins enabled"

# Quick rebuild and copy main.js (for rapid iteration)
reinstall: build
    #!/usr/bin/env bash
    VAULT_ARG="{{test_vault}}"
    VAULT="${VAULT_ARG/#\~/$HOME}"
    mkdir -p "$VAULT/.obsidian/plugins/{{plugin_name}}"
    cp main.js "$VAULT/.obsidian/plugins/{{plugin_name}}/"
    echo "✓ Plugin updated - reload Obsidian (Cmd+R) to see changes"

# Clean build artifacts and optionally test vault
clean:
    rm -rf main.js main.js.map lib/ node_modules/.cache/
    @echo "✓ Build artifacts cleaned"
    @echo "To also remove test vault: rm -rf {{test_vault}}"

# Launch Obsidian with Chrome DevTools Protocol debugging enabled
obsidian:
    ./bin/launch-obsidian.sh {{debug_port}}

# Enable plugin in Obsidian via CDP automation
enable-plugin:
    #!/usr/bin/env bash
    VAULT_ARG="{{test_vault}}"
    VAULT="${VAULT_ARG/#\~/$HOME}"
    npx tsx bin/enable-plugin.ts "$VAULT"

# Build, install plugin, enable it in Obsidian, then open Obsidian
run: setup enable-plugin
    #!/usr/bin/env bash
    VAULT_ARG="{{test_vault}}"
    VAULT="${VAULT_ARG/#\~/$HOME}"
    open -a Obsidian
    sleep 1
    open "obsidian://open?path=$VAULT"

# --- E2E Testing ---

# Run E2E tests (headless mode)
test-e2e:
    pnpm playwright test

# Run E2E tests with visible browser
test-e2e-headed:
    pnpm playwright test --headed

# Run E2E tests with Playwright inspector for debugging
test-e2e-debug:
    PWDEBUG=1 pnpm playwright test

# Setup plugin and prepare for E2E testing
setup-e2e: build setup
    @echo "✓ E2E environment ready"
    @echo "Run tests with: just test-e2e"

# --- Plugin Scaffold Generator ---

# Create a new Obsidian plugin scaffold (interactive wizard)
create-plugin:
    npx tsx bin/create-obsidian-plugin.ts --wizard

# Create a new plugin with quick args: just create-plugin-quick "my-plugin" "Description here"
create-plugin-quick id description:
    npx tsx bin/create-obsidian-plugin.ts "{{id}}" "{{description}}"
