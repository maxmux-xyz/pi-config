---
name: compress-progress
description: Compress a verbose progress.md file while preserving critical state. Use when progress.md gets too large for efficient context loading.
---

# Compress Progress

You are compressing a `progress.md` file for a pi-loop task. The agent that reads this next has ZERO prior context — this file is their entire memory.

## Read First
1. `progress.md` - The file to compress
2. `instruction.md` - The task (so you know what matters)

## Compression Rules

**KEEP (critical — losing these causes rework):**
- Current status and which step we're on
- Key values: IDs, paths, names, URLs, config values
- Decisions made and WHY (reasoning prevents flip-flopping)
- What's been completed (with proof/evidence, not just "done")
- Known errors and their solutions (prevents re-hitting them)
- Blockers and workarounds found
- What's next — the immediate next action

**COMPRESS (summarize, don't drop):**
- Command outputs → keep the conclusion, drop raw output
- Exploration/investigation steps → summarize findings only
- Repeated attempts → "Tried X, Y, Z — Z worked because..."

**DROP (safe to remove):**
- Verbose logs/output that's already been interpreted
- Redundant entries (same info recorded multiple times)
- Abandoned approaches with no useful learnings
- Timestamps on individual entries (keep only milestone times)

## Output

Overwrite `progress.md` with the compressed version. Use this structure:

```markdown
# <Task Name> — Progress

## Status: <IN PROGRESS | BLOCKED | ...>
Current step: <what we're doing now>

## Completed
- <step>: <result> (<key evidence>)

## Key State
<IDs, paths, values, anything the next agent needs to reference>

## Decisions
- <decision>: <why>

## Known Issues
- <issue>: <workaround>

## Next
<Exactly what to do next>
```

Keep it dense. Target: under 200 lines.
