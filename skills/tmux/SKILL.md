---
name: tmux
description: Use tmux to run parallel pi agents for independent tasks. Spawn detached sessions, monitor progress, and collect results. Use when you need to do multiple things concurrently or run background tasks.
---

# Tmux Parallel Agents

Run multiple pi instances in parallel using tmux sessions for independent, concurrent work.

## When to Use

- Multiple independent tasks that don't depend on each other
- Long-running operations you want to run in background
- Research or exploration that can be parallelized
- Any time you'd benefit from concurrent execution

## Core Commands

### Create a Detached Pi Session

```bash
# Create session running pi with a task
tmux new-session -d -s <session-name> "pi -p '<prompt>'"

# Example: spawn 3 parallel research tasks
tmux new-session -d -s research-auth "pi -p 'Find all authentication patterns in src/'"
tmux new-session -d -s research-db "pi -p 'Find all database query patterns in src/'"
tmux new-session -d -s research-api "pi -p 'List all API endpoints in src/'"
```

### Check Running Sessions

```bash
# List all sessions
tmux list-sessions

# Check if specific session exists (returns 0 if exists)
tmux has-session -t <session-name> 2>/dev/null && echo "running" || echo "done"
```

### Capture Output from Session

```bash
# Capture visible pane content (last ~2000 lines)
tmux capture-pane -t <session-name> -p

# Capture with extended history
tmux capture-pane -t <session-name> -p -S -1000

# Save to file
tmux capture-pane -t <session-name> -p > /tmp/<session-name>-output.txt
```

### Wait for Session to Complete

```bash
# Poll until session ends (pi -p exits when done)
while tmux has-session -t <session-name> 2>/dev/null; do
  sleep 5
done
echo "Session <session-name> completed"
```

### Kill a Session

```bash
tmux kill-session -t <session-name>
```

## Workflow Pattern

### 1. Plan Your Parallel Tasks

Identify independent tasks that can run concurrently:

```bash
# Good: Independent research/analysis
tmux new-session -d -s task1 "pi -p 'Analyze error handling in src/auth/'"
tmux new-session -d -s task2 "pi -p 'Analyze error handling in src/api/'"

# Bad: Dependent tasks (task2 needs task1's output)
# Don't parallelize these - run sequentially instead
```

### 2. Spawn Sessions

```bash
# Use descriptive session names
tmux new-session -d -s auth-research "pi -p 'Research authentication flow in this codebase'"
tmux new-session -d -s db-research "pi -p 'Research database access patterns'"
```

### 3. Monitor Progress

```bash
# Quick status check
tmux list-sessions

# Check specific session output
tmux capture-pane -t auth-research -p | tail -20
```

### 4. Collect Results

```bash
# When session completes, capture final output
tmux capture-pane -t auth-research -p -S -5000 > /tmp/auth-research.txt

# Or read directly
tmux capture-pane -t auth-research -p
```

### 5. Clean Up

```bash
# Sessions auto-terminate when pi -p completes
# Manual cleanup if needed:
tmux kill-session -t auth-research
```

## Recommended: Output to Files

**Important**: Tmux sessions terminate when `pi -p` completes, and output is lost. Always have pi write results to files:

```bash
# Task writes results to file (RECOMMENDED)
tmux new-session -d -s task1 "pi -p 'Analyze auth and write results to /tmp/auth-analysis.txt'"
tmux new-session -d -s task2 "pi -p 'Analyze api and write results to /tmp/api-analysis.txt'"

# Wait for completion
while tmux has-session -t task1 2>/dev/null || tmux has-session -t task2 2>/dev/null; do
  sleep 2
done

# Read results
cat /tmp/auth-analysis.txt
cat /tmp/api-analysis.txt
```

## Advanced: Working Directory

Run pi in a specific directory:

```bash
tmux new-session -d -s project-task -c /path/to/project "pi -p 'Run tests and report'"
```

## Example: Parallel Codebase Research

```bash
# Spawn parallel research agents
tmux new-session -d -s research-models "pi -p 'List all data models/types in src/ with their fields'"
tmux new-session -d -s research-routes "pi -p 'List all API routes with their handlers'"
tmux new-session -d -s research-deps "pi -p 'Analyze package.json dependencies and their purposes'"

# Wait for all to complete
for session in research-models research-routes research-deps; do
  while tmux has-session -t $session 2>/dev/null; do sleep 2; done
done

# Collect results
echo "=== Models ===" > /tmp/research-summary.txt
tmux capture-pane -t research-models -p >> /tmp/research-summary.txt 2>/dev/null || echo "(completed)"
echo -e "\n=== Routes ===" >> /tmp/research-summary.txt  
tmux capture-pane -t research-routes -p >> /tmp/research-summary.txt 2>/dev/null || echo "(completed)"
echo -e "\n=== Dependencies ===" >> /tmp/research-summary.txt
tmux capture-pane -t research-deps -p >> /tmp/research-summary.txt 2>/dev/null || echo "(completed)"

cat /tmp/research-summary.txt
```

## Tips

1. **Always use file output**: Sessions terminate when done - have pi write results to `/tmp/` files
2. **Session names**: Use descriptive, unique names (kebab-case)
3. **Use `pi -p`**: Non-interactive mode - processes prompt and exits
4. **Check completion**: `tmux has-session` returns non-zero when session ends
5. **Don't over-parallelize**: 3-5 concurrent sessions is usually optimal
6. **Clean prompts**: Be explicit about what to write and where

## Limitations

- Captured output is limited (~2000 lines visible, more with `-S` flag)
- Sessions terminate when the command exits - capture output first if needed
- No direct communication between parallel agents (use files for coordination)

## Quick Reference

| Action | Command |
|--------|---------|
| Start detached | `tmux new-session -d -s NAME "pi -p 'PROMPT'"` |
| List sessions | `tmux list-sessions` |
| Check if running | `tmux has-session -t NAME 2>/dev/null` |
| Get output | `tmux capture-pane -t NAME -p` |
| Kill session | `tmux kill-session -t NAME` |
