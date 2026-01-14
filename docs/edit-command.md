# `/edit` Command Extension

Opens neovim to edit prompt files stored in an Obsidian vault, then executes the written prompt.

## Overview

**Location:** `~/.pi/agent/extensions/edit-prompt.ts`  
**Storage:** `~/obsidian/delvaze/prompts/` (hardcoded, not configurable)

## Behavior

### Session Flow

1. **First `/edit` in session:** Prompts for filename → creates/opens file → opens neovim → executes prompt
2. **Subsequent `/edit` in session:** Reuses same file → prepends new section → opens neovim → executes prompt

The filename persists across session restarts via `pi.appendEntry()`.

### Session Persistence

The active prompt filename is stored in the session file as a custom entry (`edit-prompt-state`). This enables:

- **Continue session (`pi -c`):** Filename restored automatically
- **Resume session (`/resume`):** Filename restored from target session
- **Fork (`/fork`):** Filename carries forward to new branch
- **Tree navigation (`/tree`):** Filename remains unchanged (session-wide)

The filename is **session-wide**, not branch-specific. All branches in a session share the same active prompt file.

### Prompt Execution

After saving and quitting neovim, the content between the **paired delimiters** (matching timestamps) is extracted and sent to the agent via `pi.sendUserMessage()`.

## File Format

### Structure

```markdown
---
id: <filename-without-extension>
aliases: []
tags: []
---

<!-- prompt: 2026-01-13T15:49:28 -->
<newest prompt here>
<!-- prompt-end: 2026-01-13T15:49:28 -->

<!-- prompt: 2026-01-13T14:30:00 -->
<older prompt here>
<!-- prompt-end: 2026-01-13T14:30:00 -->
```

### Key Details

| Element | Format |
|---------|--------|
| Frontmatter `id` | Filename without `.md` extension |
| Timestamp | `YYYY-MM-DDTHH:MM:SS` (ISO 8601, no ms/timezone) |
| Order | Descending chronological (newest first) |
| Start delimiter | `<!-- prompt: <timestamp> -->` |
| End delimiter | `<!-- prompt-end: <timestamp> -->` |

New sections are **prepended** after frontmatter, pushing older content down. Each section is "boxed" between matching start and end delimiters with the same timestamp.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Hardcoded directory | Single-user extension, simplicity over configurability |
| Newest-first ordering | Most relevant prompt is always at top when editing |
| Session-scoped filename | Natural workflow—related prompts stay in one file |
| Session-wide (not branch-specific) | Simpler mental model; prompt file is a session-level setting |
| Persisted via `appendEntry()` | Survives restarts; follows pi extension patterns |
| HTML comment delimiters | Obsidian-friendly, doesn't render visually |
| Auto-append `.md` | Convenience; entering `foo` creates `foo.md` |
| Paired delimiters with timestamp | Prevents accidental execution of old content when user deletes/abandons new section |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Directory doesn't exist | Error notification, exits |
| Empty/cancel filename input | Exits silently |
| File already exists | Confirmation dialog; "no" re-prompts |
| Empty prompt saved | "No prompt entered" notification, no execution |
| User deletes new section markers | "No prompt entered" (won't fall back to old content) |
| User deletes only start or end marker | "No prompt entered" (both markers required) |
| File missing frontmatter | Section prepended at start |
| Neovim exits abnormally | Warning notification |
| Session restored, file deleted | Uses restored path; creates new file |
| New session (no state) | Prompts for filename as normal |
| Old file without end markers | "No prompt entered" until user fills new boxed section |

## Neovim Integration

- Uses `ctx.ui.custom()` to suspend TUI
- Spawns `nvim +<line> <filepath>` synchronously
- Cursor positioned on blank line between start and end markers
- TUI restored after neovim exits

## Section Extraction Logic

1. Track the timestamp used when creating the new section
2. Look for exact start marker: `<!-- prompt: TIMESTAMP -->`
3. Look for exact end marker: `<!-- prompt-end: TIMESTAMP -->`
4. Validate both markers exist and end comes after start
5. Extract and trim content between them
6. Return empty string if markers missing, out of order, or content empty

This ensures only the specific section created by the current `/edit` invocation is extracted—never old content from previous sections.
