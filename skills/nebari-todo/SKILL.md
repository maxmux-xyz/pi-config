---
name: nebari-todo
description: Manage the Nebari work todolist. Triages TODO items into tasks, tracks in-progress work, reviews completed work, archives validated tasks. Use when managing the Nebari work queue.
---

# Nebari Todo Manager

You manage the Nebari work todolist at `/Users/maxime/dev/nebari-mvp/docs/todo/`.

## Files

| File | Purpose |
|---|---|
| `TODO.md` | Work items not yet started. Each item is an `# ` heading with a description. |
| `INPROGRESS.md` | Items turned into pi-loop tasks. Each has a link to the task dir. |
| `REVIEW.md` | Agent-completed items awaiting human validation. |
| `ARCHIVE.md` | Human-validated items. The final state. |
| `INSTRUCTION.md` | Reference doc explaining how this system works. |

**Task directory:** `/Users/maxime/dev/nebari-docs/tasks/`
**Codebase:** `/Users/maxime/dev/nebari-mvp/`

## Workflow

Run these steps in order, every time:

### Step 1: Review completed work

Read `REVIEW.md`. For each item, present it to the human for validation:

1. **Gather context** from the task directory:
   - Read `pr.md` for the PR link
   - Read `DONE` file for completion summary
   - Read `progress.md` for what was done
   - Skim the PR diff if available: `gh pr diff <number>` (keep it brief — highlight key changes)

2. **Present to human:**
   ```
   🔍 Review: "<item title>"
      PR: <url>
      Summary: <one-line from DONE/progress.md>
      Key changes: <brief list of what changed>

      [a]pprove → ARCHIVE    [r]eject → back to INPROGRESS    [s]kip
   ```

3. **Handle response:**
   - **Approve** → Move item from `REVIEW.md` to `ARCHIVE.md` with the date and summary.
   - **Reject** → Ask human for rejection reason. Then:
     - Move item back to `INPROGRESS.md`
     - Write the rejection reason to `GUIDE.md` in the task directory
     - Remove the `DONE` file from the task directory (so pi-loop can re-run it)
     - Report: "Sent back with feedback. Run `pi-loop <task-dir>` to address."
   - **Skip** → Leave in REVIEW.md, move on.

### Step 2: Check In-Progress → Review

Read `INPROGRESS.md`. For each item, check its task directory:

- If task dir has a `DONE` file → **move item to REVIEW.md**. Keep the task dir link. Add: `Completed: <date>` and a one-line summary from the `DONE` file or `progress.md`. Also check for `pr.md` in the task dir — if it exists, read the PR number/URL and add `PR: <url>` to the REVIEW entry.
- If task dir has an `EXIT` file → **report to human**: "⏸️ [item name] is stuck: [reason from EXIT]". Leave in INPROGRESS.
- If task dir has a `LOCK` file → it's running. Leave in INPROGRESS.
- Otherwise → it's queued but not started. Leave in INPROGRESS.

### Step 3: Triage TODO → In-Progress

Read `TODO.md`. For each item (top to bottom, priority order):

1. **Read the item carefully.** Is it clear enough to create a task?
   - **If unclear** → use `draft_questions` to ask the human for more details. **Never assume.** Stop processing further items until you get answers.
   - **If clear** → proceed to step 2.

2. **Research the codebase.** Before creating the task, explore `/Users/maxime/dev/nebari-mvp/` to understand:
   - Which files/modules are involved
   - Existing patterns and approaches
   - Dependencies and potential impacts
   - This context goes into the task's instruction.md

3. **Create the task** using the scribe pattern:
   ```bash
   TIMESTAMP=$(date +%Y%m%d-%H%M%S)
   mkdir -p /Users/maxime/dev/nebari-docs/tasks/${TIMESTAMP}-<short-description>
   ```
   Write `instruction.md` with:
   ```markdown
   # <Task Title>

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

4. **Move the item** from `TODO.md` to `INPROGRESS.md`. The entry in INPROGRESS must include:
   ```markdown
   # <Item Title>
   Task: `/Users/maxime/dev/nebari-docs/tasks/<task-dir-name>`
   <original description, can be trimmed>
   ```

5. **Process ONE item at a time.** After creating a task and moving it to INPROGRESS, report what you did and ask: "Continue with the next item, or stop here?"

### Step 4: Report

After processing, print a summary:

```
📋 Nebari Todo Status
─────────────────────
Review:        <N items awaiting validation>
Archived:      <N items archived this run>
In Progress:   <N items> (<M running, K queued, J stuck>)
TODO:          <N items remaining>

Changes this run:
  ✅ → ARCHIVE: <item name>
  🔍 → REVIEW: <item name>
  ↩️  → REJECTED: <item name> (reason)
  🆕 → INPROGRESS: <item name> → <task-dir>
  ❓ → Need clarification: <item name>
```

## Approve/Reject Mode

When invoked with `--approve "<item>"` or `--reject "<item>"`:

- **Approve:** Find the item in `REVIEW.md` by title (partial match OK). Move to `ARCHIVE.md` with date and summary. Skip all other steps.
- **Reject:** Find the item in `REVIEW.md` by title. Ask for rejection reason (provided via `--reason` or ask interactively). Move back to `INPROGRESS.md`, write `GUIDE.md` in task dir, remove `DONE` file. Skip all other steps.

If the item isn't found in `REVIEW.md`, say so and list what's there.

## Rules

- **Never assume** what a TODO item means. If the description is vague, ask.
- **Always research the codebase** before creating a task. The instruction.md should have real file paths and context.
- **One item at a time** for triage. Let the human decide priority.
- **Don't modify tasks** that are in progress — only move them to review when DONE.
- **Preserve order** in TODO.md — items at the top are higher priority.
- **Review items need human approval.** Never auto-archive.
