---
name: capture-nebari-todo
description: >
  Capture a new Nebari-related TODO in /Users/maxime/dev/nebari-docs/todo/TODO/,
  then enrich it into a self-contained implementation ticket using the enrich-todo workflow.
  Use when the user says "create a todo", "capture this nebari task", "write this into TODO",
  "turn this into a Nebari todo", or dictates Nebari work they want tracked.
metadata:
  version: 1.0.0
  category: dev
---

# Capture Nebari TODO

You take a Nebari-related request, create a new markdown TODO card in the shared Nebari TODO directory, and then enrich that card so it becomes a concise, pickupable task brief.

**TODO directory:** `/Users/maxime/dev/nebari-docs/todo/TODO/`
**Codebase:** `/Users/maxime/dev/nebari-mvp/`
**Enrichment skill:** `/Users/maxime/.pi/agent/skills/enrich-todo/SKILL.md`

## Goal

Create a new TODO file from the user's request, then run the full `enrich-todo` process on that file so it gains the right context, entrypoints, references, and open questions.

## Step 1: Validate scope

Make sure the request is Nebari-related.

If it is clearly about Nebari engineering work, proceed.
If it is ambiguous, ask a clarifying question before creating the file.

## Step 2: Clarify only when necessary

Prefer capturing rough work over blocking on perfection, but ask follow-up questions if any of these are missing and truly needed:
- what should be changed
- why it matters
- any reference PR / Jira / Slack / docs / files
- whether the work is bug fix, feature, refactor, migration, or investigation

Use `draft_questions` if user input is needed.

## Step 3: Create the TODO filename

Create a clear, human-readable `.md` filename under `/Users/maxime/dev/nebari-docs/todo/TODO/`.

Guidelines:
- Base it on the task title or main request
- Keep it descriptive, not overly short
- Preserve useful wording from the user
- Avoid special characters that make shell usage annoying
- If a file with that name already exists, append a numeric suffix or timestamp

Examples:
- `rca-add-attention-needed-status.md`
- `knowledge-catch-non-onboarded-codebases.md`
- `remediation-mark-stale-prs-attention-needed.md`

## Step 4: Write the initial TODO draft

Write the user's request into the new file in a lightweight draft form.

Use this structure:

```markdown
# <Title>

## Request
<Cleaned-up version of what the user asked for>

## Context
- Type: <bug fix | feature | refactor | investigation | migration>
- Why: <why this should be done>
- References: <PRs / Jira / Slack / docs / files, if any>
- Constraints: <anything the user specified>

---

## Original request
> <user text, blockquoted>
```

Notes:
- Light cleanup is good; do not over-rewrite at this stage
- Preserve all links, file paths, issue IDs, and concrete details
- Do **not** add `#GO` unless the user explicitly asks for it

## Step 5: Enrich the TODO

After creating the file, read `/Users/maxime/.pi/agent/skills/enrich-todo/SKILL.md` and follow that skill on the new TODO file.

The file you just created is now the input to `enrich-todo`.

This means you should:
- research the Nebari codebase
- identify the relevant entrypoints, files, docs, and patterns
- rewrite the TODO into a concise, source-backed task brief
- preserve the original request at the bottom
- surface open questions instead of guessing
- ask the user clarifying questions if the request is too vague to enrich responsibly

## Step 6: Report back

After enrichment, reply with:
- the path to the created TODO file
- the final title
- a short summary of what was added during enrichment
- any open questions or decisions surfaced
- whether the file was left as draft or marked with `#GO`

If the user did not explicitly request `#GO`, leave it as a draft and say so.

## Rules

- Do not create pi-loop task directories here; this skill is for TODO capture + enrichment only
- Do not move the file to `TODO/archive/`
- Do not update `INPROGRESS.md`
- Do not add `#GO` by default
- Reuse `enrich-todo` for the deep research/rewrite step instead of duplicating that logic
- Keep the TODO in `/Users/maxime/dev/nebari-docs/todo/TODO/`
