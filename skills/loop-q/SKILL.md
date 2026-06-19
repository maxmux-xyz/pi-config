---
name: loop-q
description: Interactive query session for a task directory. Load full task context, discuss the task, take notes. Use when the user wants to interactively work on or explore a long-running task without entering the automated loop.
---

# Task Query Session

You are entering an interactive session for a task directory. The user wants to discuss, debug, plan, or collaborate on this task — **not** run an automated loop.

## 1. Load Context

Read all files from the task directory to build full understanding:

1. `instruction.md` — The task definition (always exists)
2. `progress.md` — Running log of what's been done (if exists)
3. `research.md` — Gathered context and findings (if exists)
4. `plan.md` — Implementation or execution plan (if exists)
5. `pr.md` — PR details if one was created (if exists)
6. `review.md` — Self-review findings (if exists)
7. `GUIDE.md` — Human guidance (if exists)

Also list the task directory — there may be additional context files, artifacts, or data. Read anything relevant.

## 2. Orient, Don't Execute

After loading context, **summarize the current state** to the user:
- What the task is
- Where it stands (which phase, what's done, what's next)
- Any blockers or open questions

Then **wait for the user's direction**. Do not start implementation work unprompted. This is a conversation, not a loop iteration.

## 3. Progress Hygiene

**Every meaningful interaction must be recorded in `progress.md`.** This is critical — tasks can stay alive for weeks or months, and progress.md is the only persistent memory.

Rules:
- **Always append** — never overwrite existing entries
- **Timestamp every entry** — use `## YYYY-MM-DD HH:MM` headers
- **Be specific** — record decisions, findings, commands, key values, URLs, reasoning
- **Record the user's input** — if they make a decision or give direction, capture it
- **Note what changed** — if you modified files, say which ones and why

Bad: `"Discussed the task with user"`
Good: `"User wants to change approach: skip backfill for inactive users (< 30 days). Reason: reduces scope from ~50k rows to ~12k. Updated plan.md section 3 accordingly."`

### Archiving Large Progress Files

When `progress.md` exceeds ~300 lines, archive it:

1. Create `progress-archive/` in the task dir if it doesn't exist
2. Move current `progress.md` to `progress-archive/progress-YYYY-MM-DD-HHMM.md`
3. Add a timestamped title inside the archived file: `# Progress Archive — YYYY-MM-DD HH:MM`
4. Create a fresh `progress.md` with:
   - `## Prior work summary` at the top — concise summary of key state
   - Reference to the archived file: `Full earlier log: progress-archive/progress-YYYY-MM-DD-HHMM.md`
   - Current status and next steps carried forward

## 4. What You Can Do

The user may ask you to:
- **Explain** — walk through the task, a specific decision, or a piece of code
- **Debug** — investigate why something isn't working, read logs, trace issues
- **Plan** — help refine the approach, update plan.md
- **Research** — look into something related to the task
- **Edit** — make targeted changes to task files or code
- **Review** — look at what's been done and assess quality

Whatever you do, **log it in progress.md before the session ends**.

## Background: Task Directories

Task directories are timestamped folders (e.g., `20260325-101500-backfill-job`) containing self-contained task state. They're created by the `/scribe` skill and executed by `/loop`. Structure reference: `/Users/maxime/dev/nebari-docs/tasks/instruction.md`.

Core files:
- `instruction.md` — what to do, scope, done criteria (the "ticket")
- `progress.md` — running lab notebook, the task's persistent memory

Tasks can live for days, weeks, or months. Correct file hygiene is what keeps them useful over time. Treat `progress.md` like a shared lab notebook — your future self (or a loop agent) will read it with zero prior context.
