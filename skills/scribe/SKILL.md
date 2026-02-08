---
name: scribe
description: Create a task directory for pi-loop. Asks clarifying questions, then creates instruction.md.
---

# Scribe Skill

Create task directories for `pi-loop` execution.

## Step 1: Understand & Ask Questions

Read the user's request. Use `draft_questions` to clarify:
- What's the specific goal? How will we know it's done?
- What context/environment? (repo, staging, etc.)
- Any constraints or approaches to avoid?
- What does success look like?

**Draft 3-5 focused questions. Wait for `/answer` before proceeding.**

## Step 2: Create Task Directory

Default location: `~/dev/nebari-docs/tasks/` (or as specified by user)

```bash
mkdir -p <tasks-dir>/<short-description>
```

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
