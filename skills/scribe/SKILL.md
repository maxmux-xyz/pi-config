---
name: scribe
description: Create a task directory for loop execution. Asks clarifying questions to produce high-quality task definitions. Use when setting up a new long-running task.
---

# Scribe Skill

Create task directories for the `/loop` skill to execute.

**This skill sets up the environment.** The actual execution happens via `/loop` in repeated iterations (Ralph Wiggum pattern).

## How It Fits Together

| Skill | Role |
|-------|------|
| **scribe** | Setup — create task directory with instructions |
| **loop** | Execution — strict Research→Plan→Implement phases |

## Phase Flow

The loop enforces three phases with human review between each:

```
🔍 research → pause → 📝 plan → pause → ⚡ implement → ✅ done
```

Human can redirect at any pause via `human.md`.

---

## Step 1: Understand the Request

Read the user's task description. Identify:
- What is the core objective?
- What context is missing?
- What could be ambiguous to a fresh agent?

---

## Step 2: Ask Clarifying Questions (MANDATORY)

**Use `draft_questions` tool** before creating the task.

Think about what a loop agent would need to know:
- What's the specific goal? How will we know it's done?
- What environment/context? (staging, production, specific repo)
- Any constraints? (files to avoid, approaches to skip)
- Examples or references to follow?
- Priority order if multiple parts?
- What does success look like?

**Draft 3-6 focused questions.** Don't ask obvious things already provided.

**STOP and wait for `/answer` before proceeding.**

---

## Step 3: Create Task Directory

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p docs/tasks/${TIMESTAMP}-<short-kebab-description>
```

### Create STATE.json

```json
{
  "state": "running",
  "phase": "research",
  "iteration": 0,
  "updatedAt": "<current-iso-timestamp>",
  "note": null
}
```

### Create work.md

```markdown
# Work Log

Progress across iterations. Each session appends below.

---
```

### Create result.md

```markdown
# Result

_Task in progress. Updated on completion._
```

---

## Step 4: Write instructions.md

```markdown
# <Clear Task Title>

## Objective
<1-2 sentences: what needs to be accomplished>

## Context
<Background the agent needs>

## Requirements
- <Specific requirement 1>
- <Specific requirement 2>

## Approach
<Suggested steps or strategy>

## Success Criteria
<How to know when complete>

## Resources
- <Files to reference>
- <Related docs or links>

## Notes
<Constraints, warnings, additional context>
```

**Keep it concise but complete.** The loop agent should execute without asking questions.

---

## Step 5: Confirm Creation

Tell the user:

> Task created at `docs/tasks/<task-dir>/`
>
> To execute: `pi-marathon --task docs/tasks/<task-dir>`
> Or interactively: `pi-marathon` then `/marathon-loop docs/tasks/<task-dir>`

---

## Rules

1. **Always ask questions first** — Don't skip Step 2
2. **Be thorough but concise** — Include what's needed, nothing more
3. **Think like the executor** — What would a fresh agent need?
4. **Use kebab-case** for directory names
