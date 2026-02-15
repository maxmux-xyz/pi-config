---
name: loop-task
description: Create a task directory for loop. Asks clarifying questions, then creates instruction.md. Use when user wants to set up a new general-purpose loop task.
---

# Loop Task Creator

Create task directories for `loop` execution.

## Step 1: Understand the Request

Read the user's request. If anything is unclear, use `draft_questions` to ask — but only if truly needed. If it's clear, skip to Step 2.

Key things to pin down:
- What is the goal?
- What does "done" look like? (a document? a decision? a filled form?)
- Are there files to include? (PDFs, screenshots, data)
- Any deadlines or time constraints?

## Step 2: Determine Location

The user should specify where to save the task. If they don't, ask.

Common locations:
- `~/tasks/` — personal tasks
- A project-specific tasks directory

Directory name format: `YYYYMMDD-HHMMSS-short-description`

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p <tasks-dir>/${TIMESTAMP}-<short-description>
```

## Step 3: Write instruction.md

```markdown
# <Task Title>

## Goal
<What needs to be done — clear and specific>

## Context
<Background info, relevant details, constraints>

## Resources
<Files in this directory, URLs, accounts needed>

## Deliverables
- <What to produce — be specific: "a summary document", "a filled-out Form 8949", "a comparison spreadsheet">

## Done When
<How to know the task is complete>

## Notes
<Hints, preferences, things to watch out for>
```

## Step 4: Copy Resources

If the user mentions files (PDFs, documents, data), copy or symlink them into the task directory so the loop agent can access them.

## Step 5: Confirm

Print:

> ✅ Task created: `<path>`
>
> Run with: `loop <path>`
>
> Files:
> - instruction.md
> - <any other files copied in>
