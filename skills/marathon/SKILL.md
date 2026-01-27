---
name: marathon
description: Execute long-running tasks defined in a task directory. Reads instructions.md, tracks progress in work.md (append-only), writes final results to result.md, and manages state via STATE.json. Works in small, manageable chunks and ends the session after each chunk to allow handoff to the next agent. Use when you have a task directory with an instructions.md file.
---

# Marathon Skill

Execute long-running tasks from a task directory, working in small chunks with session handoffs.

## Invocation

User will invoke with a path to a task directory:
```
marathon skill on ./docs/tasks/<task-dir>
```

Extract the path from the user's prompt. The path should contain an `instructions.md` file and a `STATE.json` file.

---

## Step 1: Validate Task Directory

Check that the task directory, `instructions.md`, and `STATE.json` exist:

```bash
ls -la <path>/instructions.md <path>/STATE.json
```

**If `instructions.md` does not exist**: STOP. Tell the user:
> "No instructions.md found at `<path>/instructions.md`. Please create the instructions file first."

**If `STATE.json` does not exist**: STOP. Tell the user:
> "No STATE.json found at `<path>/STATE.json`. Start the marathon with `/marathon-loop <path>` to initialize."

---

## Step 2: Read STATE.json

Read and parse the state file:

```bash
cat <path>/STATE.json
```

The file has this structure:
```json
{
  "state": "running",
  "iteration": 1,
  "updatedAt": "2026-01-26T16:30:00Z",
  "note": null
}
```

**If `state` is not `"running"`**: STOP. Tell the user the current state and note (if any).

---

## Step 3: Initialize Work Files

Create `work.md` and `result.md` if they don't exist:

```bash
# Check if work.md exists
ls -la <path>/work.md 2>/dev/null

# Check if result.md exists  
ls -la <path>/result.md 2>/dev/null
```

**If `work.md` does not exist**, create it with a header:

```markdown
# Work Log

This file tracks progress across sessions. Each session appends its work below.

---

```

**If `result.md` does not exist**, create it with a placeholder:

```markdown
# Result

_Task in progress. This file will be updated when the task is finished._
```

---

## Step 4: Read Current State

Read files to understand the current state:

1. **Read `instructions.md`** - Understand the full task requirements
2. **Read `work.md`** - Understand what has been done by previous sessions

**Critical**: If `work.md` has prior entries, carefully review them to:
- Understand what's already complete
- Identify any blockers or issues encountered
- Avoid duplicating work
- Pick up exactly where the last session left off

---

## Step 5: Plan Your Chunk

Based on the instructions and prior work, decide on a **small, manageable goal** for this session.

**Guidelines for chunk sizing:**
- Pick ONE clear, achievable objective
- Should be completable in 10-20 minutes of work
- Better to under-commit than over-commit
- If unsure about scope, err on the smaller side

**Before starting work, mentally note:**
- What specific outcome will you achieve?
- How will you know when you're done with this chunk?
- What information does the next agent need to continue?

---

## Step 6: Do the Work

Execute your planned chunk. Follow the instructions in `instructions.md`.

**Important rules while working:**
- **NEVER make assumptions** - If anything is unclear, STOP and ask the user for clarification
- **Stay focused** - Don't expand scope beyond your planned chunk
- **Track what you do** - Note commands run, decisions made, issues encountered

---

## Step 7: Update work.md (APPEND ONLY)

After completing your chunk, **append** a new session entry to `work.md`.

**Format for session entries:**

```markdown
## Session: <timestamp> (Iteration <N from STATE.json>)

### Goal
<What you set out to accomplish>

### Completed
- <Specific thing done>
- <Another thing done>
- <Commands run, files modified, etc.>

### Status
<Current state - what's done, what remains>

### Next Steps
<Clear instructions for the next session>

### Notes
<Any issues encountered, decisions made, context needed>

---

```

**CRITICAL**: 
- Use `edit` tool to APPEND to the file - never overwrite existing content
- Include enough detail that a fresh agent can pick up without context
- Be explicit about what was tried, what worked, what didn't

---

## Step 8: Check if Task is Complete

Review the instructions and your work log. Is the entire task complete?

**If YES - Task Complete:**
1. Update `result.md` with the final outcome:
   - Summary of what was accomplished
   - Any relevant outputs, links, or artifacts
   - Final state of the system
2. Add a final entry to `work.md` marking completion
3. **Update STATE.json** to mark completion:
   ```json
   {
     "state": "completed",
     "iteration": <current>,
     "updatedAt": "<now>",
     "note": "Task completed successfully"
   }
   ```
4. Inform the user: "Task complete! See `<path>/result.md` for results."

**If BLOCKED or need human input:**
1. **Update STATE.json** to pause:
   ```json
   {
     "state": "paused",
     "iteration": <current>,
     "updatedAt": "<now>",
     "note": "Reason for pause - what input/action is needed"
   }
   ```
2. Inform the user what's blocking and what they need to do.

**If NO - More Work Remains:**
1. Ensure `work.md` has clear next steps
2. Inform the user what was accomplished and what remains
3. **END THE SESSION** - Do not continue to the next chunk

---

## Step 9: End Session

**STOP HERE.** Do not continue with more work.

Tell the user:
> "Session complete (iteration N). I accomplished: [brief summary]
> 
> Next steps are documented in `<path>/work.md`."

The next agent (or next session) will pick up from the work log.

---

## Key Rules

1. **Check STATE.json FIRST** - Validate state is "running" before doing anything
2. **Read work.md** - Always understand prior progress before starting work
3. **Small chunks only** - One manageable goal per session, then stop
4. **Append-only work.md** - Never delete or overwrite previous session entries
5. **Ask, don't assume** - If unclear on anything, ask the user
6. **End after each chunk** - Don't chain multiple chunks in one session
7. **Update STATE.json on completion/pause** - Set state to "completed" or "paused" with note
8. **Clear handoffs** - Write enough context that any agent can continue

---

## STATE.json Reference

| State | Meaning | Action |
|-------|---------|--------|
| `running` | Task is active | Continue working |
| `paused` | Task needs human input | Stop and explain in note |
| `completed` | Task is done | Stop, update result.md |

---

## Example work.md Evolution

After first session:
```markdown
# Work Log

This file tracks progress across sessions. Each session appends its work below.

---

## Session: 2025-01-17T15:30:00 (Iteration 1)

### Goal
Trigger ExtractionBetaWorkflow for first 2 findings

### Completed
- Triggered workflow for finding 75b420eb-6306-406a-ba37-3833dd1b83d9
  - Workflow ID: extraction-75b420eb-1705512600
- Triggered workflow for finding 069539b9-bfba-7bb1-8000-cf3c24a2b160
  - Workflow ID: extraction-069539b9-1705512601

### Status
2/6 findings processed

### Next Steps
- Trigger workflows for remaining 4 findings
- Monitor workflow completion before investigation phase

### Notes
- Using liquid-lime environment
- Workflows typically take 5-10 minutes to complete

---

```
