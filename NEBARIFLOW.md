# Nebari Flow

End-to-end workflow for getting work done with agents.

```
 Human                          Agent                           State
 ─────                          ─────                           ─────
 Write TODO item          ─→                                    TODO file
 Run nebari-todo          ─→    Research codebase, create task   TODO → INPROGRESS
 Run pi-loop <task>       ─→    Research → Plan → Implement →   task dir (iterations)
                                Git branch → PR → Self-review
                                Agent creates DONE when finished
 Human verifies work      ─→    touch DONE.md in task dir       (human approval)
 Run nebari-todo          ─→    Detect DONE.md, auto-archive    INPROGRESS → ARCHIVE
```

## Step by Step

### 1. Add work to the backlog

Create a `.md` file in `/Users/maxime/dev/nebari-docs/todo/TODO/`, or:

```bash
nebari-todo -m "Fix the auth timeout bug — users get logged out mid-workflow"
```

Each file is a standalone item. End the file with `#GO` when it's ready to triage. Files without `#GO` are drafts — the agent skips them.

### 2. Triage the backlog

```bash
nebari-todo
```

The agent reads TODO files ending with `#GO`, and for each item:
- Asks clarifying questions if the item is vague (never assumes)
- Researches the codebase to understand which files, patterns, and modules are involved
- Creates a task directory in `/Users/maxime/dev/nebari-docs/tasks/` with a detailed `instruction.md`
- Moves the TODO file to `TODO/archive/` and adds an entry to `INPROGRESS.md`
- Processes one item at a time, asks before continuing to the next

### 3. Run the task

```bash
# Run a specific task
pi-loop /Users/maxime/dev/nebari-docs/tasks/20260214-180000-fix-auth-timeout

# Or let pi-loop pick the next available task
pi-loop /Users/maxime/dev/nebari-docs/tasks/
```

The agent works in iterations (fresh context each run):

1. **Research** — Explore the codebase, gather facts. Write `research.md`.
2. **Plan** — Design the approach, break into steps. Write `plan.md`.
3. **Implement** — One chunk of code per iteration. Run tests/lint after each.
4. **Git/PR** — Create branch, commit, push, open PR. Write `pr.md`.
5. **Self-review** — Diff the PR, check for bugs/issues. Write `review.md`.
6. **Address** — Fix any issues found, push again. Re-review until clean.

Between iterations, you get a 10-second window to type guidance. You can also drop a `GUIDE.md` in the task directory anytime — the agent reads it next iteration, then deletes it.

The agent writes `DONE` when the PR is up and self-review is clean, or `EXIT` if it's stuck and needs help.

### 4. Verify and approve

When the agent finishes (creates `DONE`), check the work — look at the PR, read the summary.

To approve, create an empty `DONE.md` in the task directory:

```bash
touch /Users/maxime/dev/nebari-docs/tasks/20260214-180000-fix-auth-timeout/DONE.md
```

### 5. Auto-archive

```bash
nebari-todo
```

The agent checks `INPROGRESS.md` for tasks with `DONE.md` files and automatically:
- Moves the item to `ARCHIVE.md` with date, summary, and PR link
- Moves the task directory to `/Users/maxime/dev/nebari-docs/tasks/archive/`

No interactive approval needed — `DONE.md` is the approval signal.

### 6. Repeat

The cycle continues: add items to TODO, triage, run tasks, verify, archive. At any point:

```bash
nebari-todo -h          # Quick status across all states
pi-q <task-dir> -m ""   # Ask questions about a specific task
```

## Files

| File | Location | Purpose |
|---|---|---|
| `TODO/` | `todo/` | Backlog — `.md` files, one per item |
| `TODO/archive/` | `todo/` | Triaged TODO files moved here |
| `INPROGRESS.md` | `todo/` | Active — has a task directory, agent working on it |
| `ARCHIVE.md` | `todo/` | Completed and verified — final state |
| `tasks/` | `nebari-docs/` | Active task directories |
| `tasks/archive/` | `nebari-docs/` | Archived task directories (after DONE.md) |

## Task Directory Markers

| File | Created by | Meaning |
|---|---|---|
| `DONE` | Agent (pi-loop) | Agent finished work |
| `DONE.md` | Human | Human verified — ready to auto-archive |
| `EXIT` | Agent (pi-loop) | Agent is stuck, needs help |
| `LOCK` | Agent (pi-loop) | Agent is currently running |
| `GUIDE.md` | Human | Feedback for the agent (read and deleted next iteration) |

## Commands

| Command | What it does |
|---|---|
| `nebari-todo` | Full todolist management (auto-archive → triage → report) |
| `nebari-todo -m "text"` | Add item to TODO and triage |
| `nebari-todo -h` | Status at a glance |
| `nebari-todo-watch` | Continuous polling — runs nebari-todo when work detected |
| `nebari-todo-watch 30` | Same, with custom interval (default 60s) |
| `pi-loop <task-dir>` | Run agent on a task |
| `pi-loop <tasks-dir>` | Run next available task |
| `pi-q <task-dir> -m "question"` | Query a task |
