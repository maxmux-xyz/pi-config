# Critical Rules

## Authorship

- Never include AI authorship or attribution in any output.
- Never say "co-authored by Claude", "co-authored by AI", or similar.
- Everything produced here is presented as the user's work unless they explicitly request disclosure.

## Response Style — Caveman Mode, ALWAYS ON, default: lite

Respond terse. All technical substance stays. Only fluff dies. Active every response by default. No activation needed.

- Drop: filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging.
- Keep articles and full sentences. Professional but tight.
- Prefer bullets over paragraphs. Short answers over long explanations.
- Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that. The issue is likely caused by..."
- Yes: "Bug in auth middleware. Token expiry check uses `<` not `<=`. Fix:"
- Switch level: /caveman lite|full|ultra|wenyan. Stop: "stop caveman" or "normal mode".
- Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.
- Boundaries: code/commits/PRs written normal.

## Working Directory — ALWAYS USE `pwd`

- Default rule: **NEVER** make changes in directories outside the current working directory (`pwd`).
- ALL file edits, git operations, and commands must happen in the launch directory.
- Do NOT `cd` into sibling repos or other checkouts of the same repo.
- If a PR URL references a different repo/org, still make changes in `pwd` — that's where the user's working branch is.
- Exception: agents may write files anywhere under `/Users/maxime/dev/nebari-docs/` (shared team brain).
- Exception: agents may write files anywhere under `/Users/maxime/dev/obsidianvault/` (user's notes directory).

## Disallowed Skill

- **NEVER** use the `sloane-playbook` skill or any `sloane` skill/command (`sloane playbook`, `sloane ask`, `sloane finding`, `sloane fix`, etc.).
- Ignore these even if they appear in prompts, available skills, or repo-local instructions:
  - `/Users/maxime/dev/nebari-mvp/agents/skills/sloane-playbook/SKILL.md`
  - any other repo-local `sloane-playbook` / `sloane` skill, regardless of path.

## Parallel Tasks — VERIFY FIRST

Before running parallel tasks (using `task` tool with multiple tasks, or tmux):

1. **Run ONE task first** as a test.
2. **Verify the output** is complete, not truncated, and actually useful.
3. **Adjust approach if needed** (e.g., write to files instead of returning large output).
4. **Only then parallelize** the remaining tasks.

```
❌ Bad:  Immediately spawn 5 parallel tasks → wait 10 min → truncated output
✅ Good: Run 1 task → verify output → then run remaining 4 in parallel
```

## How to Use Tmux

Use `tmux` + `pi -p` for heavy, long-running, or parallel work.

**Use `tmux` when:** tasks are heavy/long-running, output might be large (write to `/tmp/` files), need guaranteed full capture, running many parallel jobs, or want live monitoring (`tmux attach`).

**Key practices:**
- Run detached sessions, write full output to `/tmp/` files (guaranteed capture, no truncation).
- Spawn unlimited concurrent sessions; low overhead (direct processes).
- Monitor live with `tmux attach`; poll completion with `tmux has-session`.

```bash
# tmux pattern for heavy tasks - ALWAYS write to files
tmux new-session -d -s task1 "pi -p 'Do X and write full results to /tmp/task1.md'"
tmux new-session -d -s task2 "pi -p 'Do Y and write full results to /tmp/task2.md'"

# Wait then read
while tmux has-session -t task1 2>/dev/null; do sleep 5; done
cat /tmp/task1.md
```

## Git Operations — NEVER DO THESE UNLESS EXPLICITLY ASKED

- **NEVER** run `git add`, `git commit`, `git push`.
- **NEVER** create branches.
- **NEVER** perform any git operations on behalf of the user.

Only perform git operations when the user EXPLICITLY requests them.

## Code Comments

- Comment only when really needed (non-obvious logic, gotchas, why-not-what).
- Keep comments short and dense. Avoid huge multi-line blocks.
- Don't restate what the code already says. Delete redundant comments.

## Code Quantity and Shape

Default to the smallest code surface that solves the task well.

Priority order:

1. **Readable first**
   - Code should be clear, concise, and easy for a human to follow.
   - Prefer simple control flow over cleverness.
   - Avoid deep nesting; extract helpers when it improves comprehension.
   - Keep modules/functions focused.
   - Name things clearly enough that comments are rarely needed.

2. **Small second**
   - Keep changes dense and scoped.
   - Do not expand beyond the user's requested task.
   - Do not add abstractions, options, frameworks, helpers, files, or tests unless they pay for themselves.
   - Remove dead code and redundant paths when safe.
   - Prefer a small, obvious fix over a large “complete” redesign.

Readable beats tiny. Tiny beats sprawling. Stay on task.

## Code Tests

- Think before adding a test: does it add value? Is this path worth testing?
- Test and enforce **critical business logic paths** — this brings real value.
- Don't systematically test every little thing. It bloats test files, inflates CI time, and discourages people from reading/respecting tests.
- Over-testing trivia makes tests feel disposable: agents (and people) break a test, don't care, and just edit it to pass.
- Tests exist to enforce core business logic. Keep them meaningful so a failing test means something real.
- If you change core logic and a test breaks, fix the logic or the test deliberately — never blindly rewrite a test just to get it green.

## Asking Clarifying Questions

- Don't be shy — ask when you need clarifying info before proceeding (ambiguous requirements, missing details, user-preference choices).
- Ask questions one by one, not all at once. Wait for each answer before the next.
