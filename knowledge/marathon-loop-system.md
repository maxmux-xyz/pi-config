# Marathon Loop System

Iterative task execution using strict Research→Plan→Implement phases.

## Quick Start

```bash
# 1. Setup task
pi
/scribe                                    # Creates task directory

# 2. Run marathon
pi-marathon --task docs/tasks/my-task      # Auto-start

# 3. Human reviews after each phase
#    - Check research.md, write human.md if feedback needed
#    - Check plan.md, approve or request changes
#    - Monitor implement progress in work.md

# 4. Restart completed task with feedback
pi-marathon --task docs/tasks/my-task -h "also add X and Y"
```

## Phase Flow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🔍 research ──pause──► human reviews ──► 📝 plan          │
│                              │                 │            │
│                         (human.md:           pause          │
│                       "redo research")         │            │
│                              │                 ▼            │
│                              └──────── human reviews        │
│                                              │              │
│                                         (human.md:          │
│                                        "revise plan")       │
│                                              │              │
│                                              ▼              │
│                                        ⚡ implement         │
│                                           │    │            │
│                                           │    └──► (loop)  │
│                                           ▼                 │
│                                       ✅ completed          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Phases

| Phase | What Agent Does | Output | Pauses When |
|-------|-----------------|--------|-------------|
| `research` | Explores codebase, finds patterns | `research.md` | Research complete |
| `plan` | Creates implementation steps | `plan.md` | Plan ready for approval |
| `implement` | Executes plan, one chunk at a time | Code + `work.md` | Plan complete |

### Research Phase
- Search and read relevant code
- Find similar patterns in codebase
- Identify dependencies and risks
- Use `websearch`/`tavily` for external docs
- **Output**: `research.md` with findings

### Plan Phase  
- Read `research.md` first
- Create concrete, ordered steps
- Reference specific files and patterns
- Call out edge cases
- **Output**: `plan.md` with implementation steps

### Implement Phase
- Read `research.md` AND `plan.md` first
- Follow plan exactly—no improvisation
- One chunk per session
- Run linters/tests, commit often
- **Output**: Code changes + `work.md` progress

## Task Directory Structure

```
docs/tasks/20260202-143000-my-task/
├── instructions.md   # Task requirements (created by /scribe)
├── STATE.json        # Phase and state tracking
├── research.md       # Codebase findings (research phase)
├── plan.md           # Implementation steps (plan phase)
├── human.md          # Human feedback/redirects (human-written)
├── work.md           # Implementation progress (implement phase)
└── result.md         # Final outcome (on completion)
```

## STATE.json

```json
{
  "state": "running",
  "phase": "research",
  "iteration": 1,
  "updatedAt": "2026-02-02T14:30:00Z",
  "note": null
}
```

| Field | Values |
|-------|--------|
| `state` | `running`, `paused`, `completed` |
| `phase` | `research`, `plan`, `implement`, `done` |

## Human Feedback via `human.md`

Write `human.md` at any pause to redirect the agent:

```markdown
# Human Feedback

## Research Phase
Good findings, but also check the auth module for rate limiting patterns.

## Plan Phase
Step 3 is wrong—use existing UserService instead of creating new one.
Please revise the plan.
```

Agent reads `human.md` at start of each session and incorporates feedback.

## CLI Options

```bash
pi-marathon --task <path>                  # Auto-start marathon
pi-marathon --task <path> -h "feedback"    # Restart with human feedback
```

### Restart with Feedback (`-h`)

Restart a completed/paused task:

```bash
pi-marathon --task docs/tasks/my-task -h "also handle the edge case where user is null"
```

**What happens:**
1. Archives `result.md`, `research.md`, `plan.md` → `*.YYYYMMDD-HHMMSS.md`
2. Writes feedback to `human.md`
3. Resets STATE.json to `phase: "research"`, `state: "running"`
4. Starts fresh marathon

## Commands

| Command | Description |
|---------|-------------|
| `/marathon-loop <path>` | Start marathon on task directory |
| `/marathon-status` | Show current state and phase |
| `/marathon-steer <msg>` | Inject guidance for next iteration |
| `Ctrl+C` twice | Force exit |

## Agent Tools

### marathon_wait(minutes, reason)
Request delay before next iteration (e.g., waiting for CI).

### human_feedback(question)
Request clarification from human. Pauses marathon, prompts in terminal.

## Rules

1. **One phase per session** — Never skip ahead
2. **Pause after research and plan** — Human must review
3. **Read artifacts** — research.md before plan, both before implement
4. **Check human.md** — Human may redirect you
5. **Follow the plan** — In implement phase, no improvisation
6. **Commit often** — Preserve progress
