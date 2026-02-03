---
name: ralph
description: "[REFERENCE DOC] Detailed background on the Ralph Wiggum loop pattern. For execution, use the compact /loop skill instead. Read this for deep understanding of the methodology."
---

# Ralph Wiggum Pattern (Reference Documentation)

> **For loop execution, use `/loop` instead.** This document provides detailed background on the Ralph Wiggum pattern for those wanting to understand the methodology deeply.

---

# The Ralph Wiggum Loop

You are running as part of a **Ralph Wiggum loop**—an iterative pattern where an AI agent runs repeatedly until a task is complete. You are NOT expected to finish everything in this session.

> "Ralph is a bash loop." — Geoffrey Huntley

Named after Ralph Wiggum from The Simpsons, who persistently tries things despite setbacks. The philosophy: **iteration beats perfection**.

---

## 🧠 Core Mindset

### You Are One of Many

- This is iteration N of potentially many iterations
- Previous sessions may have made progress
- Future sessions will continue after you
- Your job: **make meaningful incremental progress, then hand off cleanly**

### Don't Be a Hero

- Do NOT try to complete everything in one session
- Do NOT rush to implement without understanding the current state
- Do NOT assume you know what's been done—**verify it**
- Do NOT let context bloat cause you to forget the goal

### Persistence Over Perfection

- Each iteration starts with fresh context (avoiding the "dumb zone")
- Progress accumulates through git commits and progress files
- Failed attempts are learning—document them for the next iteration
- Small, verified progress beats ambitious failures

---

## 📋 The Ralph Loop Protocol

### Step 1: Orient — What Has Been Done?

Before doing ANY work, research what previous iterations accomplished:

```bash
# Check recent git history
git log --oneline -20

# Look for progress tracking files
ls -la progress.txt progress.md PROGRESS.md work.md 2>/dev/null

# Check for task definitions
ls -la tasks.md prd.json stories.md TODO.md 2>/dev/null

# See what files were recently modified
git diff --stat HEAD~5 2>/dev/null || git log --stat -3
```

**Read any progress files thoroughly.** They contain:
- What was attempted
- What succeeded or failed
- What the next iteration should focus on

### Step 2: Assess — What Remains?

Compare the task definition against completed work:

- What items are marked complete?
- What items are in progress?
- What hasn't been started?
- Are there any blockers noted?

### Step 3: Plan — Pick ONE Thing

Choose the **single most productive next step**. Consider:

- What's the highest priority uncompleted item?
- What's the smallest verifiable unit of progress?
- What will unblock the most work for future iterations?

**Scope ruthlessly.** Better to complete one thing well than half-complete three things.

### Step 4: Execute — Do the Work

Work on your chosen task:

- Follow the RPI pattern (Research → Plan → Implement) if the task is complex
- Run tests/linters to verify your changes work
- Commit your changes with clear commit messages

### Step 5: Document — Enable the Next Iteration

**This is critical.** Update the progress file with:

```markdown
## Iteration: <timestamp>

### Completed
- <What you accomplished, with specifics>
- <Files changed, commands run>

### Status
- <Current state of the overall task>
- <What percentage complete, if applicable>

### Next Steps
- <The next thing to work on>
- <Any context the next iteration needs>

### Notes
- <Problems encountered>
- <Decisions made and why>
- <Anything that didn't work>
```

**Commit the progress file** so it persists:

```bash
git add progress.md
git commit -m "update progress: <brief summary>"
```

### Step 6: Exit Cleanly

If the task is complete:
1. Create/update any completion signal files (e.g., `DONE.txt`)
2. Document final results
3. Exit with a clear completion message

If more work remains:
1. Ensure progress is documented
2. Ensure changes are committed
3. Exit gracefully—the next iteration will continue

---

## 📁 Progress File Conventions

### Recommended: `progress.md`

A markdown file at the repo root or task directory:

```markdown
# Progress

## Task
<One-line description of the overall goal>

## Completion Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [x] Criterion 3 (completed)

## Iterations

### Iteration 3: 2026-01-30T14:30:00Z
...

### Iteration 2: 2026-01-30T12:15:00Z
...

### Iteration 1: 2026-01-30T10:00:00Z
...
```

### Alternative: Git-Based Progress

If no progress file exists, use git history:

```bash
# Find commits from this task
git log --oneline --grep="<task keyword>"

# See what changed
git show --stat <commit-hash>
```

---

## ⚠️ Anti-Patterns to Avoid

❌ **Starting work without checking previous progress**
> "Let me just start implementing..." — Leads to duplicate work

❌ **Trying to do everything**
> "I'll just finish the whole thing..." — Leads to context bloat and poor results

❌ **Not documenting progress**
> "The code speaks for itself..." — Next iteration has no context

❌ **Large uncommitted changes**
> "I'll commit when I'm done..." — Progress is lost if session crashes

❌ **Vague progress notes**
> "Made some progress on the feature..." — Useless for the next iteration

❌ **Ignoring previous failures**
> "I'll try the same approach..." — Repeats mistakes

---

## 🔄 Loop Integration Patterns

### With Task Files

If `tasks.md` or `prd.json` exists:
- Parse the task list
- Find the next incomplete item
- Work on it
- Mark it complete when done

### With GitHub Issues

```bash
# Check linked issues
gh issue list --state open --label "ralph"

# Work on the top priority issue
# Close when done
gh issue close <number> --comment "Completed in iteration N"
```

### With Test-Driven Completion

```bash
# Run tests to find what's failing
npm test 2>&1 | head -50

# Fix one failing test
# Verify it passes
# Document and exit
```

---

## 🎯 Completion Signals

A loop ends when completion criteria are met. Common patterns:

| Signal | How to Check |
|--------|--------------|
| All tests pass | `npm test` exits 0 |
| File exists | `[ -f DONE.txt ]` |
| PRD complete | All items in `prd.json` have `"passes": true` |
| No more tasks | `tasks.md` has no unchecked items |
| Manual review | Human marks task complete |

---

## 💡 Tips for Success

1. **Read before writing** — Always check progress first
2. **Commit often** — Small commits preserve progress
3. **Be specific** — "Fixed auth bug in login.ts:45" > "Fixed bugs"
4. **Note failures** — "Tried X, didn't work because Y" saves future iterations
5. **Think handoff** — Write docs as if explaining to a colleague
6. **Verify completion** — Run tests before claiming something works
7. **Stay focused** — One task per iteration, resist scope creep

---

## 🔗 Related Patterns

- **RPI Skill** (`/rpi`) — Use for complex tasks within an iteration
- **Marathon Skill** (`/marathon`) — Structured task directories with STATE.json
- **Scribe Skill** (`/scribe`) — Create well-defined task definitions

---

## Remember

> "The technique is deterministically bad in an undeterministic world. It's better to fail predictably than succeed unpredictably." — Geoffrey Huntley

You are one iteration in a chain. Your job is to:
1. **Understand** what's been done
2. **Progress** one meaningful step
3. **Document** for the next iteration

**Don't try to be a hero. Be a reliable link in the chain.**
