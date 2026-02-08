---
name: scribe
description: Create a task directory for pi-loop. Asks clarifying questions, then creates instruction.md.
---

# Scribe Skill

Create task directories for `pi-loop` execution.

## Step 1: Understand the Request

Read the user's request. If anything is unclear or ambiguous, use `draft_questions` to clarify before proceeding. Only ask if truly needed - if the request is clear, skip to Step 2.

## Step 2: Create Task Directory

Default location: `~/dev/nebari-docs/tasks/` (or as specified by user)

Directory name format: `YYYYMMDD-HHMMSS-short-description`

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p <tasks-dir>/${TIMESTAMP}-<short-description>
```

Example: `20260207-203000-backfill-buzzing-birch`

## Step 3: Write instruction.md

```markdown
# <Task Title>

## Goal
<What needs to be done - 1-2 sentences>

## Context
<Background info the agent needs>

## Requirements
- <Requirement 1>
- <Requirement 2>

## Done When
<How to know task is complete>

## Notes
<Constraints, resources, hints>
```

Keep it concise. The loop agent will figure out the rest.

## Step 4: Confirm

> Task created: `<path>`
> 
> Run with: `pi-loop <path>`
