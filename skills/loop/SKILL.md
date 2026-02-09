---
name: loop
description: Execute a task iteration in pi-loop. Read task files, work in small chunks, write progress.
---

# Loop Iteration

You are running in `pi-loop` — an iterative system with fresh context each run. You lose all memory between iterations.

## 1. Read State

Always start by reading these files from the task directory:

1. `instruction.md` — The task (always exists)
2. `progress.md` — What's been done (if exists)
3. `GUIDE.md` — Human guidance (if exists). **High priority** — follow it, then delete the file.

## 2. Determine Phase

Check which files exist to know where you are:

| Phase | Condition | Goal |
|---|---|---|
| **Research** | No `research.md` | Investigate the problem space. Read files, run commands, gather facts. **Make no changes.** Write `research.md` with findings. |
| **Plan** | `research.md` exists, no `plan.md` | Read research + instruction. Follow the plan skill (`/Users/maxime/dev/nebari-mvp-2/.claude/skills/task-planner/SKILL.md`) to write `plan.md`. |
| **Implement** | Both exist | Follow the implement skill (`/Users/maxime/dev/nebari-mvp-2/.claude/skills/implement-plan/SKILL.md`). Do ONE chunk of work per iteration. Update `plan.md` if it needs adjustment (note what changed and why). |

## 3. Update progress.md (Your Brain)

`progress.md` is your ONLY memory between iterations. **Write liberally** — don't be shy. An automated process compresses it when it gets too large, so there's no penalty for being thorough.

Write it like a lab notebook. Record everything:
- What you tried, the exact commands, and their output
- What worked and what didn't (and why you think it failed)
- Decisions and the reasoning behind them
- Dead ends — so your next self doesn't repeat them
- Key values: IDs, paths, URLs, config, anything you'll need again
- Current status and what to do next

Bad: `"Checked the database"`
Good: `"Ran SELECT count(*) FROM users WHERE active=true → 4,523. Expected ~5k, looks right. Tried joining with orders table but got timeout after 30s — need to add index or filter by date."`

## 4. Waiting

If you triggered something long-running (workflow, deploy, build):
- `bash("sleep 60")` to wait inline — don't exit just to poll
- Update progress.md before and after sleeping

## 5. Git — On Task Completion

When the task is done and code was changed:

1. Create a new branch from current: `git checkout -b <descriptive-branch-name>`
2. **NEVER push to `stg` or `main`** — always a feature branch
3. Commit all changes with a clear message
4. Push to origin: `git push -u origin <branch-name>`
5. Create a PR (use `gh pr create`) — title and body from instruction.md + progress.md
6. **Wait for CI to pass** before calling `loop_done`:
   - Check status: `gh pr checks <pr-number> --watch` or poll with `gh run list --branch <branch>`
   - If CI fails, read the logs (`gh run view <run-id> --log-failed`), fix the issues, push again, and re-check
   - Only proceed once all checks pass
7. Then call `loop_done`

If no code was changed, skip git and just call `loop_done`.

## 6. End Iteration

Always call one of these tools when done:

- **`loop_next`** — More work remains. Loop restarts with fresh context.
- **`loop_done`** — Task complete, all requirements met. Stops the loop.
- **`loop_terminate`** — Blocked, need human help. Stops the loop.
