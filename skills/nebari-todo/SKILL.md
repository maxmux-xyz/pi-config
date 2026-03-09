---
name: nebari-todo
description: Manage the Nebari work todolist. Triages TODO items into tasks, auto-archives completed work, tracks in-progress items. Use when managing the Nebari work queue.
---

# Nebari Todo Manager

You manage the Nebari work todolist at `/Users/maxime/dev/nebari-docs/todo/`.

## Structure

| Path | Purpose |
|---|---|
| `TODO/` | Directory of `.md` files — one file per work item. |
| `TODO/archive/` | Triaged TODO files are moved here after task creation. |
| `INPROGRESS.md` | Items turned into pi-loop tasks. Each has a link to the task dir. |
| `ARCHIVE.md` | Completed items. The final state. |

**Task directory:** `/Users/maxime/dev/nebari-docs/tasks/`
**Task archive:** `/Users/maxime/dev/nebari-docs/tasks/archive/`
**Codebase:** `/Users/maxime/dev/nebari-mvp/`

## TODO File Format

Each file in `TODO/` is a standalone markdown file describing one work item. A file is **only ready to triage** if its content ends with `#GO` (on its own line, at the very end of the file). Files without `#GO` are still being drafted — skip them.

Example `TODO/fix-sbom-pagination.md`:
```markdown
# Fix SBOM pagination performance

The SBOM list endpoint is doing O(n²) sorting. Need materialized sort columns.
See the keyset pagination pattern in other endpoints.

#GO
```

## Completion Markers

Task directories use two different markers:
- **`DONE`** (no extension) — created by pi-loop when the agent finishes work. Means "agent says it's done."
- **`DONE.md`** — created by the human after verifying the work. Means "human approved, ready to archive."

Only `DONE.md` triggers auto-archiving.

## Workflow

Run these steps in order, every time:

### Step 1: Auto-archive completed tasks

Read `INPROGRESS.md`. For each item, check its task directory:

- If task dir has a **`DONE.md`** file → **auto-archive**:
  1. Gather context: read `DONE` file for agent summary, `pr.md` for PR link, `progress.md` for details.
  2. Move the item from `INPROGRESS.md` to `ARCHIVE.md` with:
     ```markdown
     # <Item Title>
     Archived: <YYYY-MM-DD>
     PR: <url if pr.md exists>
     Summary: <one-line from DONE/progress.md>
     Task: `<original-task-dir-path>`
     ```
  3. Move the task directory to the archive:
     ```bash
     mkdir -p /Users/maxime/dev/nebari-docs/tasks/archive
     mv /Users/maxime/dev/nebari-docs/tasks/<task-dir-name> /Users/maxime/dev/nebari-docs/tasks/archive/
     ```
  4. Report: `✅ Archived: "<item title>"`

- If task dir has `DONE` but **no `DONE.md`** → agent finished, awaiting human verification. Report: `👀 Done (awaiting verification): "<item title>"`. Leave in INPROGRESS.
- If task dir has an `EXIT` file → report: `⏸️ "<item name>" is stuck: <reason from EXIT>`. Leave in INPROGRESS.
- If task dir has a `LOCK` file → it's running. Leave in INPROGRESS.
- Otherwise → queued but not started. Leave in INPROGRESS.

### Step 2: Triage TODO → In-Progress

List files in `TODO/` (not `TODO/archive/`). For each `.md` file:

1. **Check for `#GO` marker.** Read the file and check if the content ends with `#GO` (possibly followed by a trailing newline). If not → skip, it's still being drafted.

2. **Read the item carefully.** Is it clear enough to create a task?
   - **If unclear** → use `draft_questions` to ask the human for more details. **Never assume.** Stop processing further items until you get answers.
   - **If clear** → proceed.

3. **Research the codebase.** Before creating the task, explore `/Users/maxime/dev/nebari-mvp/` to understand:
   - Which files/modules are involved
   - Existing patterns and approaches
   - Dependencies and potential impacts
   - This context goes into the task's instruction.md

4. **Create the task** using the scribe pattern:
   ```bash
   TIMESTAMP=$(date +%Y%m%d-%H%M%S)
   mkdir -p /Users/maxime/dev/nebari-docs/tasks/${TIMESTAMP}-<short-description>
   ```
   Write `instruction.md` with:
   ```markdown
   # <Task Title>

   Original todo draft: `/Users/maxime/dev/nebari-docs/todo/TODO/archive/<filename>.md`

   ## Goal
   <What needs to be done>

   ## Context
   <Background from your codebase research — files involved, patterns found, relevant code>

   ## Requirements
   - <Requirement 1>
   - <Requirement 2>

   ## Done When
   <Concrete completion criteria>

   ## Notes
   <Constraints, hints from research>
   ```

5. **Move the TODO file** to `TODO/archive/`:
   ```bash
   mv TODO/<filename>.md TODO/archive/<filename>.md
   ```

6. **Add an entry to `INPROGRESS.md`:**
   ```markdown
   # <Item Title>
   Task: `/Users/maxime/dev/nebari-docs/tasks/<task-dir-name>`
   <original description, can be trimmed>
   ```

7. **One at a time (interactive mode).** After creating a task and moving it, report what you did and ask: "Continue with the next item, or stop here?" **In BATCH MODE**, skip this — process all ready items without stopping.

### Step 3: Report

After processing, print a summary:

```
📋 Nebari Todo Status
─────────────────────
TODO:          <N ready, M drafting>
In Progress:   <N items> (<M running, K queued, J done-awaiting-verification, L stuck>)
Archive:       <N items>

Changes this run:
  ✅ → ARCHIVE: <item name>
  🆕 → INPROGRESS: <item name> → <task-dir>
  ❓ → Need clarification: <item name>
```

## Rules

- **Never assume** what a TODO item means. If the description is vague, ask.
- **Always research the codebase** before creating a task. The instruction.md should have real file paths and context.
- **One item at a time** for triage (interactive mode). In **BATCH MODE**, process all items without asking.
- **Don't modify tasks** that are in progress — only archive them when `DONE.md` exists.
- **Only triage files with `#GO`** — files without it are still being drafted, leave them alone.
- **Auto-archive is automatic** — no human interaction needed. If `DONE.md` exists, archive it.
