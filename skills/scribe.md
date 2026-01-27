---
name: scribe
description: Create a task directory with instructions.md for marathon execution. Asks clarifying questions to produce high-quality task briefs. Use when setting up a new long-running task.
---

# Scribe Skill

Create well-defined task directories in `docs/tasks/` for the `marathon` skill to execute.

**Key principle**: Great instructions lead to great execution. ALWAYS ask clarifying questions before writing.

---

## Step 1: Understand the Request

Read the user's initial task description carefully. Identify:
- What is the core objective?
- What context is missing?
- What could be ambiguous to a fresh agent?

---

## Step 2: Ask Clarifying Questions (MANDATORY)

**You MUST use the `draft_questions` tool** to ask follow-up questions before creating the task.

Think about what a fresh agent running `marathon` would need to know:

**Questions to consider asking:**
- What's the specific goal/outcome? How will we know it's done?
- What environment/context? (e.g., staging, production, specific repo)
- Any constraints or boundaries? (files to avoid, approaches to skip)
- Are there examples or references to follow?
- What's the priority order if there are multiple parts?
- Any blockers or dependencies to be aware of?
- What does success look like?

**Don't ask about skills/knowledge** - you'll determine those yourself in Step 4 based on the task requirements.

**Draft 3-6 focused questions** based on gaps in the user's description. Don't ask obvious things already provided.

```
Use draft_questions tool with your questions
```

**STOP and wait for user answers via `/answer` before proceeding.**

---

## Step 3: Create Task Directory

After receiving answers, create the task directory:

```bash
# Generate timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create directory with descriptive name
mkdir -p docs/tasks/${TIMESTAMP}-<short-kebab-description>
```

Example: `docs/tasks/20260117-205500-backfill-extraction-workflows`

### Create STATE.json

Initialize the state file for marathon execution:

```bash
cat > docs/tasks/${TIMESTAMP}-<short-kebab-description>/STATE.json << 'EOF'
{
  "state": "running",
  "iteration": 1,
  "updatedAt": "<current-iso-timestamp>",
  "note": null
}
EOF
```

Use the current ISO timestamp (e.g., `2026-01-17T20:55:00Z`).

---

## Step 4: Gather Skills and Knowledge

Before writing instructions, scan for relevant resources:

### Scan Available Skills

Check the skills listed in `AGENTS.md` (under `<available_skills>`) and identify which ones would help the marathon agent complete the task.

**Common skill pairings:**
- Database work → `remote-db`, `investigator`
- Backend features → `implement-plan`, `backend-lint-fixer`, `code-committer`
- Debugging production → `remote-logs`, `remote-sentry`, `temporal-workflows`, `k8s-debug`
- Finding investigation → `investigate-finding`, `remote-db`, `k8s-debug`
- Frontend work → `frontend-lint-fixer`, `code-committer`
- Code exploration → `research`, `document`

### Scan Knowledge Directory

Check `.claude/knowledge/` for relevant domain knowledge files:

```bash
ls .claude/knowledge/
```

Read any files that seem relevant to the task. Include key concepts the agent will need.

**Current knowledge files:**
- `FINDING.md` - Finding lifecycle, database tables, state files (use for any finding-related tasks)

---

## Step 5: Write instructions.md

Create `docs/tasks/<task-dir>/instructions.md` with:

```markdown
# <Clear Task Title>

## Objective
<1-2 sentences: What needs to be accomplished>

## Context
<Background info the agent needs to understand the task>

## Requirements
- <Specific requirement 1>
- <Specific requirement 2>
- <etc.>

## Approach
<Suggested approach or steps, if relevant>

## Skills
<List each relevant skill with a one-line description of when to use it>

Example:
- `/investigate-finding` - Use to trace a finding through the processing pipeline
- `/remote-db` - Use to query staging/production databases
- `/backend-lint-fixer` - Run after making code changes

## Knowledge
<Summarize or quote relevant sections from .claude/knowledge/ files>

Example:
- **Finding lifecycle**: INGESTION → EXTRACTION → RCA → OWNERSHIP → REMEDIATION
- **State files location**: `/mnt/codebases/tmp/<prefix>_<uuid>/`
- **Key tables**: `finding`, `findingextraction`, `rootcauseanalysis`, `remediationrecord`

## Resources
- <Files/docs to reference>
- <External links if any>

## Success Criteria
<How to know when the task is complete>

## Notes
<Any constraints, warnings, or additional context>
```

**Keep it concise but complete.** The marathon agent should be able to execute without asking questions.

---

## Step 6: Confirm Creation

Tell the user:

> Task created at `docs/tasks/<task-dir>/`
> 
> Run `marathon skill on docs/tasks/<task-dir>` to execute.

Optionally show a brief summary of what was captured.

---

## Rules

1. **ALWAYS ask questions first** - Don't skip Step 2
2. **Be thorough but concise** - Include what's needed, nothing more
3. **Think like the executor** - What would a fresh agent need?
4. **Use kebab-case** for directory names
5. **Timestamp prefix** ensures uniqueness and chronological sorting
