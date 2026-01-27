#!/bin/bash
#
# Marathon Runner - Wrapper script for marathon-loop extension
#
# This script runs pi in a loop, restarting it when it exits if there's
# an active marathon state file for this runner instance.
#
# Supports running multiple concurrent marathons:
# - Different directories (each has its own state)
# - Same directory with different tasks (each runner has unique ID)
#
# Usage:
#   ./marathon-runner.sh [--task <task-dir>] [pi args...]
#
# Example:
#   ./marathon-runner.sh                              # Start, then use /marathon-loop
#   ./marathon-runner.sh --task docs/tasks/my-task    # Auto-start marathon
#   ./marathon-runner.sh --task docs/tasks/foo -m sonnet  # With model
#
# The script will keep restarting pi until the marathon completes or is stopped.

STATES_DIR="$HOME/.pi/marathon-states"

# Parse --task argument
MARATHON_TASK_DIR=""
PI_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --task)
            MARATHON_TASK_DIR="$2"
            shift 2
            ;;
        *)
            PI_ARGS+=("$1")
            shift
            ;;
    esac
done

# Export task dir for the extension to auto-start
export MARATHON_TASK_DIR

# Generate unique runner ID for this instance (allows concurrent runners in same dir)
export MARATHON_RUNNER_ID="${MARATHON_RUNNER_ID:-$(date +%s)-$$-$RANDOM}"

# State file is based on runner ID
STATE_FILE="$STATES_DIR/$MARATHON_RUNNER_ID.json"

echo "🏃 Marathon Runner started"
echo "   Working directory: $PWD"
echo "   Runner ID: $MARATHON_RUNNER_ID"
if [ -n "$MARATHON_TASK_DIR" ]; then
    echo "   Task: $MARATHON_TASK_DIR (auto-starting)"
else
    echo "   Use /marathon-loop <task-dir> to start a marathon"
fi
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
    pi "${PI_ARGS[@]}"
    exit_code=$?
    
    # Debug: show state file status
    echo "   [debug] Checking state file: $STATE_FILE"
    
    # Check if marathon state exists for this runner
    if [ -f "$STATE_FILE" ]; then
        # Read state from file (with fallback if jq not available)
        if command -v jq &> /dev/null; then
            iteration=$(jq -r '.iteration // 0' "$STATE_FILE" 2>/dev/null || echo "?")
            task_dir=$(jq -r '.taskDir // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")
            wait_seconds=$(jq -r '.waitSeconds // 0' "$STATE_FILE" 2>/dev/null || echo "0")
            is_paused=$(jq -r '.paused // false' "$STATE_FILE" 2>/dev/null || echo "false")
        else
            iteration=$(grep -o '"iteration":[0-9]*' "$STATE_FILE" | cut -d: -f2 || echo "?")
            task_dir=$(grep -o '"taskDir":"[^"]*"' "$STATE_FILE" | cut -d'"' -f4 || echo "unknown")
            wait_seconds=$(grep -o '"waitSeconds":[0-9]*' "$STATE_FILE" | cut -d: -f2 || echo "0")
            is_paused=$(grep -o '"paused":true' "$STATE_FILE" && echo "true" || echo "false")
        fi
        
        # Handle paused state - don't restart, just exit runner
        if [ "$is_paused" = "true" ]; then
            echo ""
            echo "⏸️  Marathon paused: $task_dir"
            echo "   Use /marathon-continue in pi to resume"
            echo "   Runner exiting (state preserved)"
            exit 0
        fi
        
        # Debug: show parsed values
        echo "   [debug] iteration=$iteration task_dir=$task_dir wait_seconds=$wait_seconds is_paused=$is_paused"
        
        # Handle wait request from agent
        if [ "$wait_seconds" != "0" ] && [ "$wait_seconds" != "null" ] && [ -n "$wait_seconds" ]; then
            wait_minutes=$((wait_seconds / 60))
            echo ""
            echo "⏳ Marathon waiting ${wait_minutes}m before next iteration..."
            echo "   (Agent requested wait for external job)"
            echo "   Press Ctrl+C twice quickly to abort"
            
            # Clear waitSeconds from state file before sleeping
            if command -v jq &> /dev/null; then
                jq 'del(.waitSeconds)' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
            else
                # Fallback: use sed to remove waitSeconds
                sed -i.bak 's/"waitSeconds":[0-9]*,\?//g' "$STATE_FILE" && rm -f "$STATE_FILE.bak"
            fi
            
            # Countdown display
            remaining=$wait_seconds
            while [ $remaining -gt 0 ]; do
                mins=$((remaining / 60))
                secs=$((remaining % 60))
                printf "\r   ⏳ Waiting: %02d:%02d remaining...  " $mins $secs
                sleep 1
                remaining=$((remaining - 1))
            done
            echo ""
            echo "   ⏳ Wait complete!"
        fi
        
        echo ""
        echo "🔄 Marathon continuing: $task_dir (iteration $((iteration + 1)))"
        echo "   Starting fresh pi session..."
        echo ""
        
        # Small delay before restart
        sleep 1
    else
        # No marathon state - normal exit
        echo "   [debug] State file not found"
        echo ""
        echo "👋 Marathon runner exiting (no active marathon)"
        exit $exit_code
    fi
done
