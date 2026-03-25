# Nebari Flow

End-to-end workflow for getting work done with agents.

```
 Human                          Agent                           State
 ─────                          ─────                           ─────
 Write TODO item          ─→                                    TODO file
 nebari-todo-watch        ─→    Research codebase, create task   TODO → INPROGRESS
 Human reviews instruction ─→   Appends #GO to instruction.md   (human gate)
 pi-loop-watch            ─→    Detects #GO, launches in tmux   task running
                                Research → Plan → Implement →
                                Git branch → PR → Self-review
                                Agent creates DONE when finished
 Human verifies work      ─→    touch DONE.md in task dir       (human approval)
 nebari-todo-watch        ─→    Detect DONE.md, auto-archive    INPROGRESS → ARCHIVE
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

Tasks created by `nebari-todo` need a human review. Once you're happy with `instruction.md`, append `#GO` on its own line to mark it ready.

```bash
# Mark a task as ready to run
echo '#GO' >> /Users/maxime/dev/nebari-docs/tasks/20260214-180000-fix-auth-timeout/instruction.md

# Automatic: watcher picks up #GO tasks and runs them in tmux
pi-loop-watch             # polls every 60s, max 3 concurrent
pi-loop-watch 30 2        # poll every 30s, max 2 concurrent

# Manual: run a specific task
pi-loop /Users/maxime/dev/nebari-docs/tasks/20260214-180000-fix-auth-timeout

# Watch a running task
tmux attach -t pi-loop-20260214-180000-fix-auth-timeout
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
| `instruction.md` ending `#GO` | Human | Task is reviewed and ready to run — pi-loop-watch picks it up |
| `LOCK` | Agent (pi-loop) | Agent is currently running |
| `DONE` | Agent (pi-loop) | Agent finished work |
| `DONE.md` | Human | Human verified — ready to auto-archive |
| `EXIT` | Agent (pi-loop) | Agent is stuck, needs help |
| `GUIDE.md` | Human | Feedback for the agent (read and deleted next iteration) |

## Background Watchers

These bash scripts run concurrently in separate terminal tabs. Together they form the always-on agent backbone:

```bash
# Terminal 1 — Task launcher: picks up #GO tasks, runs them in tmux
pi-loop-watch

# Terminal 2 — Todo triage: detects ready TODOs and DONE.md, runs nebari-todo
nebari-todo-watch

# Terminal 3 — Nebari reporting: runs the nebari-docs agent every hour
loop-watch ~/dev/nebari-docs/reporting

# Terminal 4 — Obsidian vault: runs the vault agent every hour
loop-watch ~/dev/obsidianvault/
```

All watcher scripts live in **`/Users/maxime/bin/`** and are on PATH. They're simple bash loops — no daemons, no systemd. Kill with Ctrl+C, restart anytime.

| Watcher | What it does | Interval |
|---|---|---|
| `pi-loop-watch` | Scans `tasks/` for `#GO` in instruction.md, launches pi-loop in tmux. Manages repo pool (nebari-mvp-{1,2,3,4}). | 60s |
| `nebari-todo-watch` | Scans `TODO/` for `#GO` files and `tasks/` for `DONE.md`. Runs `nebari-todo --batch` when work is detected. | 60s |
| `loop-watch <dir>` | Runs `pi-loop --batch <dir>` once per hour, forever. Used for recurring agent tasks (reporting, vault maintenance). | 1 hour |
| `vault-loop` | Like loop-watch but vault-specific. Runs `loop` on the obsidian vault with cooldown tracking via `.last_run`. | 1 hour |
| `nebari-report-watch` | Like loop-watch but for nebari-docs. Runs `loop --batch` with cooldown tracking. | 1 hour |

## Obsidian Vault Integration

Two Obsidian vaults are tightly integrated with the agent system. Each vault is also a pi-loop task directory (has `instruction.md` + `progress.md`), so agents can read and write to them on a schedule.

### `/Users/maxime/dev/nebari-docs`

The **Nebari work vault** — task management, reporting, and documentation.

- `todo/TODO/` — backlog items (`.md` files with `#GO` marker)
- `todo/INPROGRESS.md` — active work tracker
- `todo/ARCHIVE.md` — completed work log
- `tasks/` — agent task directories (created by `nebari-todo`)
- `reporting/` — recurring reports generated by `loop-watch`
- `instruction.md` — vault-level agent instructions (what the agent does each run)

Agents read from and write to this vault. `nebari-todo-watch` and `pi-loop-watch` both operate on files here.

### `/Users/maxime/dev/obsidianvault/`

The **personal vault** — notes, knowledge base, and personal agent tasks.

- `instruction.md` — what the vault agent does each hourly run
- `MAXIME.md` — personal context / reference
- `progress.md` — agent's running log

`vault-loop` (or `loop-watch ~/dev/obsidianvault/`) runs the agent hourly to maintain and process vault content.

### How it works

Both vaults are standard Obsidian vaults synced via git. The agent treats them as task directories — `instruction.md` tells it what to do, `progress.md` is its memory. You edit in Obsidian (or any editor), the agent picks up changes on its next run. The agent writes back (reports, processed notes, etc.), and those show up in Obsidian automatically.

## Scripts (`/Users/maxime/bin/`)

All CLI tools and watchers live here:

| Command | What it does |
|---|---|
| `nebari-todo` | Full todolist management (auto-archive → triage → report) |
| `nebari-todo -m "text"` | Add item to TODO and triage |
| `nebari-todo -h` | Status at a glance |
| `nebari-todo-watch` | Continuous polling — runs nebari-todo when work detected |
| `nebari-todo-watch 30` | Same, with custom interval (default 60s) |
| `pi-loop-watch` | Auto-launch #GO tasks in tmux (polls every 60s, max 3) |
| `pi-loop-watch 30 2` | Custom interval and concurrency |
| `pi-loop <task-dir>` | Run agent on a task (manual) |
| `pi-loop <tasks-dir>` | Run next available task (manual) |
| `loop-watch <dir>` | Run pi-loop on a directory every hour, forever |
| `vault-loop` | Run vault agent with cooldown tracking (default 1hr) |
| `nebari-report-watch` | Run nebari-docs agent with cooldown tracking (default 1hr) |
| `pi-q <task-dir> -m "question"` | Query a task |
| `loop-q <task-dir> -m "question"` | Query a loop task |
| `tasks` | List/manage task directories |
