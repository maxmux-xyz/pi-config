# Critical Rules

## Working Directory - ALWAYS USE `pwd`

- **NEVER** make changes in directories outside the current working directory (`pwd`)
- If the user launched the session in `/Users/maxime/dev/nebari-mvp-1`, ALL file edits, git operations, and commands must happen there
- Do NOT `cd` into sibling repos or other checkouts of the same repo (e.g., `/Users/maxime/dev/nebari-mvp` vs `/Users/maxime/dev/nebari-mvp-1`)
- If a PR URL references a different repo/org, still make changes in `pwd` — that's where the user's working branch is

## Parallel Tasks - VERIFY FIRST

Before running parallel tasks (using `task` tool with multiple tasks, or tmux):

1. **Run ONE task first** as a test
2. **Verify the output** is complete, not truncated, and actually useful
3. **Adjust approach if needed** (e.g., write to files instead of returning large output)
4. **Only then parallelize** the remaining tasks

This prevents wasting time on parallel work that produces unusable/truncated results.

```
❌ Bad:  Immediately spawn 5 parallel tasks → wait 10 min → truncated output
✅ Good: Run 1 task → verify output → then run remaining 4 in parallel
```

## Task Tool vs Tmux - When to Use Which

| | `task` tool | `tmux` + `pi -p` |
|---|-------------|------------------|
| **Best for** | Quick, light tasks | Heavy, long-running tasks |
| **Output** | Returned directly (can truncate!) | Write to files (guaranteed full capture) |
| **Concurrency** | Max 4 concurrent | Unlimited |
| **Setup** | Simple - just call tool | More complex - bash commands |
| **Overhead** | Higher (managed subagents) | Lower (direct processes) |

**Use `task` tool when:**
- Tasks are quick (< 1 min)
- Output is small/bounded
- Convenience matters more than control

**Use `tmux` when:** (load `/tmux` skill)
- Tasks are heavy/long-running (db queries, kubectl, API calls)
- Output might be large - write to `/tmp/` files
- Need guaranteed full output capture
- Running more than 4 parallel tasks
- Want to monitor progress live (`tmux attach`)

```bash
# tmux pattern for heavy tasks - ALWAYS write to files
tmux new-session -d -s task1 "pi -p 'Do X and write full results to /tmp/task1.md'"
tmux new-session -d -s task2 "pi -p 'Do Y and write full results to /tmp/task2.md'"

# Wait then read
while tmux has-session -t task1 2>/dev/null; do sleep 5; done
cat /tmp/task1.md
```

## Git Operations - NEVER DO THESE UNLESS EXPLICITLY ASKED

- **NEVER** run `git add`, `git commit`, `git push`
- **NEVER** create branches
- **NEVER** perform any git operations on behalf of the user

Only perform git operations when the user EXPLICITLY requests them.

## Asking Clarifying Questions

Use the `draft_questions` tool when you need clarifying information from the user before proceeding:

- **When to use**: If you need user input to complete a task correctly (e.g., ambiguous requirements, missing details, or choices that require user preference)
- **Single call only**: Include ALL your questions in a single `draft_questions` call — calling it again will overwrite any previously drafted questions
- **User response**: The user will review your questions and respond via the `/answer` command
