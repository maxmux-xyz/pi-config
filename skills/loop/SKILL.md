---
name: loop
description: Execute a task iteration in pi-loop. Read task files, work in small chunks, write progress.
---

# Loop Iteration

You are running in `pi-loop` - an iterative system with fresh context each run.

## Your Workspace
The task directory is your scratchpad. Read and write files freely.

## First: Read State
1. `instruction.md` - The task
2. `progress.md` - What's been done (if exists)
3. `GUIDE.md` - Human guidance (if exists). **This is high priority** — read it, follow the guidance, then delete the file so you don't re-read it next iteration.

## Then: Work
- Do ONE chunk of meaningful work
- **Do NOT ask for confirmation** - just do the work

## Waiting for Long-Running Tasks

If you triggered something and need to wait (workflow, deploy, build, etc.):
- Use `bash("sleep 60")` (or whatever duration makes sense) to wait inline
- **Before sleeping**, update progress.md with what you're waiting for
- **After sleeping**, check the result and update progress.md
- Don't exit and re-enter just to poll — sleep in the same iteration

## progress.md is Your Brain

You lose all context between iterations. `progress.md` is the ONLY way to pass knowledge to your next self. Write it like detailed notes to a colleague taking over.

**Update progress.md after every meaningful action.** Include:

- **Status** — current step, what's done, what's next
- **Commands run** — exact commands and their output (summarized if long)
- **Results** — what you found, data points, measurements
- **Decisions** — what you chose and WHY (your next self won't remember the reasoning)
- **Errors** — what failed, what you tried, what worked
- **Blockers** — what's preventing progress
- **Key values** — IDs, paths, names, URLs you'll need again

Bad: `"Checked the database"` — useless, says nothing
Good: `"Ran SELECT count(*) FROM users WHERE active=true → 4,523. Expected ~5k, looks right."`

## Ending Your Iteration

Always end your iteration by calling one of these tools:

- **`loop_next`** — Done with this chunk, more work remains. Loop restarts you with fresh context.
- **`loop_done`** — Task is complete, all requirements met. Stops the loop.
- **`loop_terminate`** — You're blocked and need human help. Stops the loop and releases the lock.
