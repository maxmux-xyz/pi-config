#!/bin/bash
#
# Marathon Runner - Wrapper script for marathon-loop extension
#
# This script runs pi in a loop, restarting it when it exits if there's
# an active marathon state file. This allows the marathon-loop extension
# to create fresh sessions with reset token counts.
#
# Usage:
#   ./marathon-runner.sh [pi args...]
#
# Example:
#   ./marathon-runner.sh              # Start in current directory
#   ./marathon-runner.sh -m sonnet    # Start with specific model
#
# Once running, use /marathon-loop <task-dir> to start a marathon.
# The script will keep restarting pi until the marathon completes or is stopped.

STATE_FILE="$HOME/.pi/marathon-state.json"

echo "🏃 Marathon Runner started"
echo "   Use /marathon-loop <task-dir> to start a marathon"
echo "   Use /marathon-stop to stop"
echo "   Press Ctrl+C twice quickly to force exit"
echo ""

# Track rapid Ctrl+C for force exit
last_interrupt=0

trap 'handle_interrupt' INT

handle_interrupt() {
    current_time=$(date +%s)
    if [ $((current_time - last_interrupt)) -lt 2 ]; then
        echo ""
        echo "🛑 Force exit - cleaning up marathon state"
        rm -f "$STATE_FILE"
        exit 1
    fi
    last_interrupt=$current_time
    echo ""
    echo "⚠️  Press Ctrl+C again within 2 seconds to force exit"
}

while true; do
    # Run pi with any passed arguments
    pi "$@"
    exit_code=$?
    
    # Check if marathon state exists
    if [ -f "$STATE_FILE" ]; then
        # Read iteration from state file (with fallback if jq not available)
        if command -v jq &> /dev/null; then
            iteration=$(jq -r '.iteration // 0' "$STATE_FILE" 2>/dev/null || echo "?")
            task_dir=$(jq -r '.taskDir // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")
        else
            iteration=$(grep -o '"iteration":[0-9]*' "$STATE_FILE" | cut -d: -f2 || echo "?")
            task_dir=$(grep -o '"taskDir":"[^"]*"' "$STATE_FILE" | cut -d'"' -f4 || echo "unknown")
        fi
        
        echo ""
        echo "🔄 Marathon continuing: $task_dir (iteration $((iteration + 1)))"
        echo "   Starting fresh pi session..."
        echo ""
        
        # Small delay before restart
        sleep 1
    else
        # No marathon state - normal exit
        echo ""
        echo "👋 Marathon runner exiting (no active marathon)"
        exit $exit_code
    fi
done
