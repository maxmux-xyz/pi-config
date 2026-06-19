---
name: new-nebari-task
description: Create and scaffold a new Nebari task folder under /Users/maxime/dev/nebari-docs/tasks, using the shared task-scaffolding instructions plus the user's prompt. Use when the user wants to create, set up, capture, or start a new Nebari task.
---

# New Nebari Task

Create self-contained task directories for Nebari work.

## Step 1: Understand the request

The goal of this skill is to create and set up a new task directory.

Use the human's prompt as the source of truth for the new task. Extract:
- the task goal
- expected outcome or deliverable
- constraints or requirements
- relevant context
- any source materials to include

If anything important is unclear, use `draft_questions` to ask. Only ask when needed.

Key things to pin down:
- What is the task trying to accomplish?
- What does done look like?
- Are there files, links, screenshots, or notes that should be included?
- Are there deadlines, owners, or constraints that matter?

Read `/Users/maxime/dev/nebari-docs/tasks/instruction.md` to accurately follow the shared task scaffolding conventions for naming, minimum files, optional files, and layout.

Use that file as the scaffolding guide for the task directory, while still writing the new task's `instruction.md` from the user's request.

## Step 2: Read the shared task instructions

Before creating the task, read:

- `/Users/maxime/dev/nebari-docs/tasks/instruction.md`

Use it as the canonical reference for how Nebari task folders should be structured.

## Step 3: Create the task directory

Always create the task under:

- `/Users/maxime/dev/nebari-docs/tasks`

Directory name format:

- `YYYYMMDD-HHMMSS-short-kebab-name`

Example:

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /Users/maxime/dev/nebari-docs/tasks/${TIMESTAMP}-<short-kebab-name>
```

Keep the slug short, specific, and easy to recognize later.

## Step 4: Create the minimum scaffold

Create at minimum:

- `instruction.md`
- `progress.md`

### instruction.md

Keep it concise but pickupable. It should usually include:

```markdown
# <Task Title>

## Goal
<What needs to be done>

## Context
<Background, relevant history, links, dependencies>

## Requirements / Constraints
- <Requirement or constraint>
- <Requirement or constraint>

## Done When
- <Concrete completion criterion>

## Notes / References
- <Helpful links, files, hints, owners>
```

### progress.md

Seed it with a minimal starting log so the loop agent can resume cleanly later.

```markdown
# Progress

## Date
<today's date>

## What was done
- Task created.
- Initial instruction scaffold written.

## Current status
- Not started.

## Next step
- <First concrete next action>
```

## Step 5: Add supporting materials when useful

If the user mentioned files or assets, include them in the task directory.

Preferred pattern:
- create `artifacts/` for attachments, exports, screenshots, drafts, or copied reference material

If a file should stay in place, you may symlink it instead of copying it.

## Step 6: Confirm

Print:

> ✅ Task created: `<path>`
>
> Files:
> - instruction.md
> - progress.md
> - <any copied or linked supporting files>

If helpful, also mention the first next step captured in `progress.md`.
