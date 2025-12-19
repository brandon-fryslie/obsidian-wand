#!/usr/bin/env bash
set -euo pipefail

DEBUG_PORT="${1:-9222}"

# Kill any existing Obsidian with debug port
pkill -f "Obsidian.*--remote-debugging-port" 2>/dev/null || true
sleep 1

# Launch with remote debugging
/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port="$DEBUG_PORT" > /dev/null 2>&1 &

echo "Launching Obsidian with CDP on port $DEBUG_PORT..."

# Wait for debug port to become available
for i in {1..10}; do
    if curl -s "http://localhost:$DEBUG_PORT/json/version" > /dev/null 2>&1; then
        echo "✓ Obsidian ready for debugging at http://localhost:$DEBUG_PORT"
        exit 0
    fi
    sleep 1
done

echo "⚠ Warning: Debug port not responding after 10s"
exit 1
