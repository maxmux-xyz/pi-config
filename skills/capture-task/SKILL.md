---
name: capture-task
description: >
  Capture a personal task into the Obsidian vault at /Users/maxime/Documents/Obsidian Vault/tasks/.
  Creates a timestamped task directory with instruction.md and progress.md.
  Use when the user says "create a task", "capture this task", "add a task",
  "write this down as a task", "track this", or dictates personal work they want tracked.
  Do NOT use for Nebari-specific tasks (use capture-nebari-todo for those).
metadata:
  version: 1.0.0
  category: personal
---

# Capture Task

You take a request from the user and create a self-contained task directory in the Obsidian vault.

**Tasks directory:** `/Users/maxime/Documents/Obsidian Vault/tasks/`
**Convention:** see `/Users/maxime/Documents/Obsidian Vault/tasks/instruction.md`
**Obsidian formatting:** follow `/Users/maxime/.pi/agent/skills/obsidian-markdown/SKILL.md`

## Goal

Create a new task directory with a clear `instruction.md` and an initial `progress.md`, so the task can be picked up and worked later — by the user or by a pi-loop agent.

## Step 1: Clarify only when necessary

Prefer capturing rough work over blocking on perfection, but ask follow-up questions if the request is too vague to write a useful instruction file.

Ask when:
- it's unclear what the task actually is
- there are multiple possible interpretations that would lead to very different work
- key constraints or scope are missing and would change the approach

Use `draft_questions` if user input is needed. Keep it to 1–3 focused questions.

## Step 2: Create the task directory

Create a timestamped directory under the tasks root:

```
/Users/maxime/Documents/Obsidian Vault/tasks/YYYYMMDD-HHMMSS-short-kebab-name/
```

Guidelines for the name:
- Use current date/time for the timestamp
- Pick a short, descriptive kebab-case suffix based on the task
- Keep it human-scannable

Examples:
- `20260404-143000-plan-summer-trip`
- `20260404-143000-research-llm-hosting-options`
- `20260404-143000-fix-home-network-dns`

## Step 3: Write instruction.md

Write a clear instruction file using Obsidian-compatible markdown.

**Structure:**

```markdown
---
tags:
  - task
  - <type: personal | work | research | admin | project>
status: todo
created: YYYY-MM-DD
---

# <Clear title>

## Goal

<What needs to happen, in 2-4 sentences.>

## Context

<Why this matters, background, any relevant links or references.>

## Requirements

- <Concrete requirement or constraint>
- <...>

## Done when

- <Clear, checkable completion criteria>
- <...>

## Notes

- <Any additional info, links, files, references>
- <...>

---

## Original request

> <User's original text, blockquoted>
```

Notes:
- Use Obsidian frontmatter with `tags`, `status`, and `created`
- Keep it concise — this is a task brief, not a design doc
- Preserve all links, file paths, and concrete details from the user
- Use `[[wikilinks]]` for references to other Obsidian notes when relevant
- Use callouts (`> [!note]`, `> [!warning]`) when helpful

## Step 4: Write progress.md

Create an initial progress file:

```markdown
---
tags:
  - progress
parent: "[[instruction]]"
---

# Progress

## YYYY-MM-DD

- **Status:** Not started
- **Next step:** <First concrete action to take>
```

## Step 5: Add optional files if warranted

If the user's request includes substantial research, links, or reference material, create additional files:
- `research.md` — gathered context, links, notes
- `artifacts/` — any files, screenshots, drafts

Only create these if there's actual content to put in them. Don't create empty scaffolds.

## Step 6: Report back

Reply with:
- the path to the created task directory
- the title
- a short summary of what was captured
- the suggested next step
- any open questions

## Rules

- Always create in `/Users/maxime/Documents/Obsidian Vault/tasks/`
- Always use Obsidian-compatible markdown (frontmatter, wikilinks, callouts)
- Always preserve the user's original request in a blockquote
- Keep it lean — capture enough to be useful, don't over-engineer
- Do NOT use this for Nebari engineering tasks (use `capture-nebari-todo` for those)
- Do NOT create `DONE` marker files — the task hasn't started yet
- Do NOT move tasks to `archive/` — that's for completed work
