---
name: loop
description: Execute a task iteration in pi-loop. Read task files, work in small chunks, write progress.
---

# Loop Iteration

You are running in `pi-loop` — an iterative system with fresh context each run. You lose all memory between iterations.

## Critical Rule: ONE Phase Per Iteration

**Each iteration does exactly ONE phase of work, then exits via `loop_next` or `loop_done`.**

You MUST NOT combine phases. After writing `research.md` → stop. After writing `plan.md` → stop. After one implementation chunk → stop. The loop harness will restart you with fresh context for the next phase.

### Two workflows

Determine which workflow applies based on `instruction.md` and `plan.md`. If the task involves code changes → **Code workflow**. If the task is operational (trigger jobs, run backfills, execute commands, wait for results) → **Ops workflow**.

**Code workflow** (produces a PR):
```
Iteration 1: Research       → write research.md           → loop_next
Iteration 2: Plan           → write plan.md               → loop_next
Iteration 3: Implement      → one chunk of work            → loop_next
Iteration 4: Implement      → next chunk                   → loop_next
...
Iteration N: Git/PR         → branch, commit, push, PR     → loop_next
Iteration N+1: Review       → self-review, write review.md → loop_next
Iteration N+2: Address      → fix critical issues, push    → loop_next
Iteration N+3: Review       → re-review, clean             → loop_done
```

**Ops workflow** (no code changes, no PR):
```
Iteration 1: Research       → write research.md           → loop_next
Iteration 2: Plan           → write plan.md               → loop_next
Iteration 3: Execute        → run commands / trigger jobs   → loop_next
Iteration 4: Execute        → wait / poll / verify          → loop_next
...
Iteration N: Execute        → confirm done, write results   → loop_done
```

## 1. Read State

Always start by reading these files from the task directory:

1. `instruction.md` — The task (always exists)
2. `progress.md` — What's been done (if exists)
3. `GUIDE.md` — Human guidance (if exists). **High priority** — follow it, then delete the file.
4. **Any other `.md` files** — The task directory may contain additional context files (e.g., `RISK.md`, `NOTE.md`, `CONTEXT.md`). **Be curious** — list the task directory and read any `.md` files you don't recognize. They were placed there for a reason.

## 2. Determine Phase and Execute It

Check which files exist to decide your ONE phase for this iteration:

### Research (no `research.md` exists)
Investigate the problem space. Read files, run commands, gather facts. **Make no code changes.** Write `research.md` with findings. Then update `progress.md` and call **`loop_next`**.

### Plan (`research.md` exists, no `plan.md`)
Read research + instruction. Follow the plan skill (`/Users/maxime/dev/nebari-mvp/agents/skills/task-planner/SKILL.md`) to write `plan.md`. Then update `progress.md` and call **`loop_next`**.

### Implement / Execute (`research.md` and `plan.md` both exist, work remains)

**Code workflow →** Follow the implement skill (`/Users/maxime/dev/nebari-mvp/agents/skills/implement-plan/SKILL.md`). Do **ONE chunk** of work — a single logical step from the plan. Update `plan.md` if needed (note what changed and why). Then update `progress.md` and call **`loop_next`**. When all implementation chunks are done and verified (tests pass, lint passes), the **next iteration** is the Git/PR phase.

**Ops workflow →** Execute the next step from the plan: trigger jobs, run commands, call APIs, poll for completion, verify results. Do **ONE logical step** per iteration. If something is long-running, wait inline — don't exit just to poll. Don't hesitate to sleep long (`bash("sleep 300")`, `bash("sleep 600")`) — some jobs take a while and that's fine. Update `progress.md` with commands run, outputs, and status. Call **`loop_next`**. When all steps are done and verified, call **`loop_done`** directly — no Git/PR or Review phases.

### Git/PR (Code workflow only: implementation complete per progress.md, no `pr.md`)
Create branch, commit, push, create PR. See section 5 for details. Write **`pr.md`** in the task directory with:
```markdown
# PR
- number: <PR_NUMBER>
- url: <PR_URL>
- branch: <BRANCH_NAME>
- base: <BASE_BRANCH>
- repo: <OWNER/REPO>
```
Then update `progress.md` and call **`loop_next`**. Do NOT call `loop_done` — the review cycle comes next.

### Review (Code workflow only: `pr.md` exists, no `review.md`)
Self-review your own PR. This catches bugs, style issues, and logic errors before a human sees it.

1. **Fetch the diff:**
   ```bash
   gh pr diff <PR_NUMBER> > /tmp/pr-<PR_NUMBER>.diff
   ```

2. **Load project standards** — read any of these that exist in the working repo:
   - `AGENTS.md`, `CODESTYLE.md`, `BEST_PRACTICES.md`
   - `.claude/knowledge/` directory

3. **Analyze the diff** looking for:
   - **BUG** — correctness issues: logic errors, missing error handling, race conditions, type errors
   - **SUGGESTION** — meaningful improvements: wrong abstraction, duplication, missing edge cases
   - **nit** — minor style: naming, dead code, formatting

4. **Write `review.md`** in the task directory:
   ```markdown
   # Review

   ## Summary
   <one paragraph assessment — is this solid? what's the risk level?>

   ## Findings

   ### 1. [BUG] path/to/file.py:42
   > <the code line>
   <explanation of the issue and suggested fix>

   ### 2. [SUGGESTION] path/to/file.py:87
   > <the code line>
   <explanation>

   ### 3. [nit] path/to/file.py:15
   > <the code line>
   <explanation>

   ## Verdict: NEEDS_CHANGES | CLEAN
   ```

5. **If verdict is CLEAN** (no BUGs, no SUGGESTIONs — nits alone don't count): skip writing `review.md`, update `progress.md`, and call **`loop_done`**.

6. **If verdict is NEEDS_CHANGES**: write `review.md`, update `progress.md`, and call **`loop_next`**.

### Address Review (Code workflow only: `review.md` exists)
Fix the issues found in the review.

1. Read `review.md` — focus on **BUG** and **SUGGESTION** items. Nits are optional.
2. Fix the issues in the code.
3. Run tests and lint to verify nothing broke.
4. Commit and push to the existing PR branch.
5. **Delete `review.md`** from the task directory.
6. Update `progress.md` with what you fixed and why.
7. Call **`loop_next`** — this sends you back to the Review phase for re-review.

## 3. Update progress.md (Your Brain)

**Update `progress.md` every iteration, right before calling `loop_next`/`loop_done`.** This is your ONLY memory between iterations.

Write liberally — an automated process compresses it when it gets too large, so there's no penalty for being thorough. Write it like a lab notebook:

- What you tried, the exact commands, and their output
- What worked and what didn't (and why you think it failed)
- Decisions and the reasoning behind them
- Dead ends — so your next self doesn't repeat them
- Key values: IDs, paths, URLs, config, anything you'll need again
- Current status and what to do next

Bad: `"Checked the database"`
Good: `"Ran SELECT count(*) FROM users WHERE active=true → 4,523. Expected ~5k, looks right. Tried joining with orders table but got timeout after 30s — need to add index or filter by date."`

## 4. Waiting

If you triggered something long-running (workflow, deploy, build, backfill):
- Wait inline — don't exit just to poll. Don't hesitate to sleep long: `bash("sleep 300")`, `bash("sleep 600")`. Some jobs take minutes or hours and that's fine.
- Update progress.md before and after sleeping

## 5. Git/PR Details

When creating the branch and PR:

1. Create a new branch from current: `git checkout -b <descriptive-branch-name>`
2. **NEVER push to `stg` or `main`** — always a feature branch
3. Commit all changes with a clear message
4. Push to origin: `git push -u origin <branch-name>`
5. Create a PR: `gh pr create` — title and body from instruction.md + progress.md
6. Write `pr.md` in the task directory (see Git/PR phase above)

Do NOT wait for CI here — the review phase will catch issues. If CI fails, you'll see it during review.

## 6. End Iteration

Every iteration MUST end with exactly one of these calls:

- **`loop_next`** — This phase is done but the task isn't finished. **This is the most common ending.** Use it after Research, Plan, each Implement chunk, Git/PR, Review (with findings), and Address Review.
- **`loop_done`** — Task fully complete. **Code workflow:** PR is up and review is clean. **Ops workflow:** all steps executed and verified.
- **`loop_terminate`** — Blocked, need human help. Stops the loop.
