---
name: enrich-todo
description: >
  Enrich a TODO card with source-backed implementation context from the Nebari codebase.
  Reads a rough TODO, finds the relevant entrypoints, docs, patterns, and references,
  and rewrites it into a concise task brief someone else can pick up without starting from zero.
  Use when user says "enrich this todo", "flesh out this ticket", "add context to this task",
  "make this pickupable", or points you at a TODO file and asks you to research and enrich it.
metadata:
  version: 1.1.0
  category: dev
---

# Enrich TODO

You take a rough TODO card and turn it into a concise, source-backed task brief by researching the Nebari codebase.

**Codebase:** `/Users/maxime/dev/nebari-mvp/`
**TODO directory:** `/Users/maxime/dev/nebari-docs/todo/TODO/`

## Goal

The goal is **not** to write a full implementation plan.

The goal is to make the task pickupable by answering:
- what area of the codebase this touches
- where the likely entrypoints are
- which source docs / PRs / files matter
- what existing patterns the implementer should follow
- what is still unclear and needs human input

Favor **relevant context and starting points** over exhaustive design.

## Input

A path to a TODO `.md` file — or the user points you at one. The file may contain a rough idea, a PR link, notes, or a vague request.

## Process

### Step 1: Read and assess clarity

Read the file and identify:
- what is being asked
- why it matters
- whether the type of work is clear enough (feature, bug fix, refactor, migration, investigation)
- whether there are concrete references (PRs, files, docs, Slack threads, Jira issues)

If the request is too vague to enrich responsibly, **ask the user clarifying questions** with `draft_questions` before rewriting the file.

Ask when key parts are missing or ambiguous, especially:
- what should change
- why it matters
- what success looks like
- which codepath/system this is about
- whether any linked reference is the source of truth

Do **not** guess when the ambiguity would change the shape of the task.

### Step 2: Research the most relevant context

Research enough that the next person knows where to start.

**Follow references:**
- If the TODO links a PR, fetch it with `gh pr view <number> --json title,body,files` and `gh pr diff <number>`
- If the TODO names files, workflows, agents, or docs, read them fully

**Find the entrypoints and nearby patterns:**
- identify the main files/modules involved
- identify the primary workflow, activity, handler, API, model, or agent entrypoint
- find sibling implementations or existing patterns to copy
- note important callers / consumers if they materially affect the change

**Gather source-backed context:**
- current behavior in the relevant area
- likely files to modify
- source docs or archived tasks worth reading first
- open questions or constraints surfaced by the code

Keep the research **proportional**:
- enough to orient implementation
- not so much that the TODO becomes a full design doc or near-code plan

### Step 3: Rewrite the TODO as a concise task brief

Overwrite the file with a lean, structured brief. Keep the original request at the bottom.

**Use this structure:**

```markdown
# <Clear title>

## Summary

<2-4 sentences on what needs to happen, why, and the main implementation area.>

## Relevant context

### Current entrypoints
- `path/to/file.py` → `function_or_class`: why it matters
- ...

### Source docs / references
- `path/or/link`: why to read it
- ...

### Existing patterns to follow
- `path/to/reference.py`: what pattern it provides
- ...

## Likely files involved

| File | Why it matters |
|------|----------------|
| `path/to/file.py` | Entry point, caller, schema, test, doc, etc. |
| ... | ... |

## Open questions

- <question or decision that still needs human input>
- <question or decision that could change implementation scope>

---

## Original request

> <paste the original TODO content here, blockquoted>
```

Notes:
- Keep it concise.
- Prefer bullets and tables over long prose.
- Include specific file paths and symbol names when you have them.
- Only mention likely changes when they are obvious from the code/reference.
- Do **not** include a `## How to test` section unless the user explicitly asked for test planning.
- Do **not** turn the TODO into a full implementation spec unless the user asked for that level of detail.

### Step 4: Discuss with the user

After writing, give a concise summary of:
- the relevant entrypoints you found
- the most important references / source docs
- any open questions or ambiguous areas that need a decision

If the user answers questions or wants the TODO reshaped, incorporate that feedback.

## Rules

- **Be precise.** Use concrete file paths, function names, workflow names, and docs.
- **Stay source-backed.** Prefer references and entrypoints over invented solutions.
- **Keep it lean.** This is a task brief, not a full implementation plan.
- **Ask when vague.** If ambiguity changes the scope or implementation area, use `draft_questions`.
- **Surface uncertainty.** Open questions are good; guessing is not.
- **Keep the original text.** Always preserve the user's original request at the bottom under `## Original request`, blockquoted.
- **No fluff.** No long narrative or generic advice.
