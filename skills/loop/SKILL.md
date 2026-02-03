---
name: loop
description: Compact skill for agents running in iterative loops. Enforces strict Research→Plan→Implement phases with human checkpoints between each phase.
---

# Loop Execution

**Invocation**: `/loop on <task-dir>` — extract the path from the user's message.

You are **one iteration** in a repeating loop. Each iteration works on exactly ONE phase.

## Protocol

### 1. Read State

```bash
cat <path>/STATE.json
```

```json
{
  "state": "running",
  "phase": "research",
  "iteration": 1
}
```

| State | Action |
|-------|--------|
| `running` | Continue to step 2 |
| `paused` | STOP — check `note` for why |
| `completed` | STOP — task is done |

### 2. Check for Human Feedback

```bash
cat <path>/human.md 2>/dev/null
```

If `human.md` exists and has new content since last session:
- Read it carefully
- It may ask you to redo research, revise plan, or change approach
- Follow human's instructions before proceeding with current phase

### 3. Read Context

Always read:
1. `instructions.md` — The goal and requirements
2. `work.md` — What previous iterations accomplished

Then based on phase, also read:
- **plan phase**: Read `research.md` first
- **implement phase**: Read `research.md` AND `plan.md` first

### 4. Execute Current Phase

**You MUST stay in your current phase. Do not skip ahead.**

---

#### Phase: `research`

**Goal**: Understand the system before changing it.

**Do**:
- Search and read existing code in relevant areas
- Find similar patterns already in the codebase
- Understand data flow and dependencies
- Identify reusable utilities and conventions
- Use `websearch`/`tavily` if external docs needed

**Don't**:
- Write any implementation code
- Make assumptions — find the actual code
- Skip areas because they "probably" work a certain way

**Output**: Write `research.md` with findings:

```markdown
# Research: <task summary>

## Relevant Files
- `path/to/file.py` — Description of what it does
- `path/to/other.py:45-80` — Specific relevant section

## Existing Patterns
- How similar problems are solved in this codebase
- Conventions to follow

## Dependencies
- What systems are affected
- What could break

## Key Insights
- Important discoveries
- Gotchas or edge cases found

## Open Questions
- Anything still unclear (human can answer in human.md)
```

**When done**: 
1. Update STATE.json: `phase` → `"plan"`, `state` → `"paused"`, `note` → `"Research complete - awaiting human review"`
2. **EXIT IMMEDIATELY** — Do not continue to planning. End your turn now.

---

#### Phase: `plan`

**Goal**: Create a concrete implementation plan from research.

**Input**: Must read `research.md` before planning.

**Do**:
- Reference specific files/patterns found in research
- Break work into atomic, ordered steps
- Specify exactly which files to modify/create
- Call out edge cases and how to handle them

**Don't**:
- Plan things not supported by research
- Leave technical decisions vague
- Include "nice-to-haves" — essential steps only

**Output**: Write `plan.md`:

```markdown
# Plan: <task summary>

## Approach
One paragraph explaining the strategy, referencing patterns from research.

## Steps

### 1. <First change>
- File: `path/to/file.py`
- Change: Description of modification
- Why: Reference to research finding

### 2. <Second change>
...

## Edge Cases
- Case X: Handle by doing Y
- Case Z: Out of scope because...

## Verification
- How to test this works
```

**When done**: 
1. Update STATE.json: `phase` → `"implement"`, `state` → `"paused"`, `note` → `"Plan complete - awaiting human approval"`
2. **EXIT IMMEDIATELY** — Do not continue to implementation. End your turn now.

---

#### Phase: `implement`

**Goal**: Execute the plan. One chunk per session.

**Input**: Must read `research.md` AND `plan.md` before implementing.

**Do**:
- Follow plan steps exactly — no improvisation
- Pick ONE step (or small group) per session
- Match patterns identified in research
- Run linters/tests after changes
- Commit with clear messages

**Don't**:
- Deviate from the plan (if plan is wrong, pause and note why)
- Do "while I'm here" scope creep
- Skip verification steps

**Update `work.md`** (append only):

```markdown
## Session: <timestamp> (Iteration N, phase: implement)

### Plan Step
Which step(s) from plan.md worked on

### Completed
- Specific changes made
- Files modified

### Verification
- Tests run, linter results

### Next
- What remains from plan

---
```

**When plan complete**: 
1. Write `result.md` with final outcome
2. Set STATE.json: `state` → `"completed"`, `phase` → `"done"`
3. **EXIT IMMEDIATELY**

**When more plan steps remain**:
1. Keep `state: "running"`, `phase: "implement"`
2. **EXIT IMMEDIATELY** — Next iteration continues

---

## Phase Flow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   research ──pause──► human reviews ──►  plan               │
│                           │                 │               │
│                      (human.md:            pause            │
│                    "redo research")          │              │
│                           │                  ▼              │
│                           └────────── human reviews         │
│                                             │               │
│                                        (human.md:           │
│                                       "revise plan")        │
│                                             │               │
│                                             ▼               │
│                                        implement            │
│                                          │    │             │
│                                          │    └──► (loop until plan done)
│                                          ▼                  │
│                                      completed              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Human Feedback via `human.md`

Human can write `human.md` at any pause to redirect:

```markdown
# Human Feedback

## Phase: research
Looks good, but also check the auth module — I think there's rate limiting there.

## Phase: plan  
Step 3 is wrong — we should use the existing UserService, not create a new one.
Revise and re-submit plan.
```

When resuming, agent reads `human.md` and incorporates feedback before continuing.

## Rules

1. **One phase per session** — Never skip ahead
2. **Exit after phase change** — Update STATE.json then STOP immediately
3. **Read artifacts** — research.md before plan, both before implement
4. **Check human.md** — Human may redirect you
5. **Append-only work.md** — Never delete previous entries
6. **Follow the plan** — In implement phase, no improvisation
7. **Commit often** — Preserve progress

## Files Reference

| File | Purpose | Created by |
|------|---------|------------|
| `instructions.md` | Task requirements | Human (via /scribe) |
| `STATE.json` | Phase and state tracking | Extension + Agent |
| `research.md` | Codebase findings | Agent (research phase) |
| `plan.md` | Implementation steps | Agent (plan phase) |
| `human.md` | Human feedback/redirects | Human |
| `work.md` | Implementation progress | Agent (implement phase) |
| `result.md` | Final outcome | Agent (on completion) |

## STATE.json Schema

```json
{
  "state": "running | paused | completed",
  "phase": "research | plan | implement | done",
  "iteration": 1,
  "updatedAt": "2026-02-02T14:30:00Z",
  "note": "Optional status message"
}
```
