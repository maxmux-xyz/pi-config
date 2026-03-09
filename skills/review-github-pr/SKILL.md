---
name: review-github-pr
description: Review a GitHub PR and issue inline comments. Checks out the PR branch locally, analyzes code on the filesystem against codestyle/architecture guidelines, presents findings to user, and posts comments only when approved.
---

# Review GitHub PR

A structured workflow for reviewing PRs and issuing precise inline comments.

---

## Step 1: Checkout the PR branch locally

```bash
# Get PR metadata (title, description, base branch, changed files)
gh pr view <PR_NUMBER> --repo <OWNER>/<REPO> --json title,body,headRefName,baseRefName,files

# Checkout the PR branch and pull latest
gh pr checkout <PR_NUMBER>
git pull

# Fetch the base branch so we can diff against it
git fetch origin <base_branch>

# See all changes against the base branch
git diff origin/<base_branch>...HEAD --stat   # overview of what files changed
git diff origin/<base_branch>...HEAD           # full diff
```

**Important:** Always diff against `origin/<base_branch>`, not the local ref — the local base branch may be stale or missing. `git status` won't show anything useful here since all changes are committed; you need `git diff origin/<base_branch>...HEAD` to see what the PR actually changes.

Use `git diff origin/<base_branch>...HEAD -- <path>` to drill into specific files as you review.

## Step 2: Understand the goal

Read the PR title, description, and linked issues. Summarize in one sentence what this PR is trying to do before reading any code.

## Step 2b: Save initial notes

Immediately after understanding the PR goal and doing a first scan of the diff, write notes to `/Users/maxime/dev/nebari-docs/prs/PR-<NUMBER>-notes.md`. Do this **before** loading standards or doing deep analysis — capture your raw first impressions while they're fresh.

```markdown
# PR #<NUMBER>: <title>

## Intent
<Why is this engineer making this change? What problem are they solving? What's the motivation?>

## First Impressions
<What jumps out on first read? Anything surprising, confusing, or notably clean?>

## Initial Comments
<Early concerns or suggestions — rough is fine, these get refined later>
- <file>:<area> — <concern>
- ...
```

This file persists even if the review session is interrupted. It also gives the human a quick "what did the agent think on first look" artifact separate from the polished review.

## Step 2c: Research the surrounding codebase

**DO NOT skip this step. DO NOT jump straight to reviewing the diff for bugs.**

The diff alone is not enough to review a PR. You need to understand the system the PR is changing. This is a dedicated research phase — read code, gather facts, build understanding. Make no judgments yet.

**What to research:**

1. **Data models** — Read the DB schema/types for every table or model the PR touches. Understand columns, relationships, constraints, indexes. Check the ORM schema file, not just the PR's usage.
2. **Existing patterns** — How do similar routers/endpoints/functions in the codebase work? Read 2-3 neighboring files that solve the same class of problem. Note the patterns: how do they handle auth, pagination, tenant scoping, error handling, etc.
3. **Callers and consumers** — Who calls the code being changed? What depends on it? Grep for imports and usages.
4. **Related middleware/utilities** — If the PR uses middleware (auth, audit logging, etc.), read the middleware source. Understand what it provides to context.
5. **Test patterns** — How are similar features tested in the codebase? What test utilities exist?

**How to research:**
- Read the actual files on disk (the PR branch is checked out locally)
- `grep`/`rg` for function names, table names, type names across the codebase
- Read schema files, migration files, model definitions
- Read 2-3 sibling routers/queries/tests for pattern comparison
- Check AGENTS.md, CODESTYLE.md, and howto docs for the affected modules

**Rules:**
- DO NOT start looking for bugs yet — you're gathering context
- DO NOT make assumptions — find the actual code
- DO search broadly — you don't know what you don't know
- DO note specific file paths so you can reference them later

This research directly feeds the next step (Business Context) and makes the technical review accurate. Without it, you'll flag false positives (like "missing tenant scoping" when the deployment is single-tenant) or miss real issues hidden in the interaction between the PR and existing code.

## Step 2d: Business Context Walkthrough

Before any technical review, present a plain-language business context summary to the user. This is the first thing the user sees — it grounds the review in "what does this PR actually do" before getting into code quality.

Using what you learned in the Research step, explain:

- **What data is being loaded / transformed?** Which tables, models, or external sources are involved? What shape does the data have? What are the key fields?
- **What are the relevant data models?** Walk through the schema/types that this PR reads from, writes to, or introduces. Explain relationships between them.
- **What does the code do with the data?** Describe the flow: input → processing → output. What queries run? What transformations happen? What gets returned to the caller?
- **What feature does this deliver?** What will the end user be able to do that they couldn't before? What page/flow/workflow does this power?
- **Why does this matter?** One sentence on the business value (compliance, performance, UX, etc.)

Write this in plain language — like explaining it to a teammate who hasn't seen the code. No jargon, no implementation details. The goal is: after reading this section, the user understands the PR without reading any code.

**Present this to the user first, before the technical review.** Then proceed to analysis and comments.

## Step 3: Load project standards

Read the relevant guidelines for the files changed:

- `AGENTS.md` (root and module-level)
- `CODESTYLE.md` for affected modules
- Any relevant files in `.claude/knowledge/`
- `BEST_PRACTICES.md` if it exists

Cross-reference the diff against these standards.

## Codestyle Standards

These apply to **every** review regardless of language.

### Function Signatures

Function signatures are a critical review target — they are the contract other code depends on.

- **Names must match logic**: If a function is called `get_user` it must get a user, not create one. Flag any mismatch between name and behavior.
- **Arguments and return types must be typed**: Untyped signatures are a `SUGGESTION` at minimum. If the function is non-trivial or part of a public/shared interface, escalate to `BUG`.
- **Avoid `None`/`null` returns**: Functions should not return `None`/`null` unless the caller explicitly handles it. Silent `None` returns that propagate and blow up downstream are a `BUG`. Acceptable only when the caller has an explicit `if result is None` / null-check path.

### Endpoints / APIs

- **Pagination**: Any endpoint returning a list must be paginated. Unbounded list returns are a `BUG` — they will blow up in production.
- **Big-O awareness**: Look at loops, DB queries, and data transformations inside request handlers. Nested loops over unbounded collections, N+1 queries, or full-table scans are a `BUG`. Endpoints must be fast.
- **No external API calls inside endpoints**: Endpoints should not call other endpoints (internal or external) synchronously in the request path. This creates cascading latency, tight coupling, and retry hell. Flag as `BUG`. Push to background jobs, events, or service-layer abstractions instead.

### Python-Specific

Typing discipline is non-negotiable — untyped Python codebases degrade fast.

- **No `Any`**: Usage of `Any` is a red flag. Flag as `SUGGESTION` and ask what the actual type is. There is almost always a concrete type or a protocol/generic that fits.
- **No `dict[str, str]` as a data shape**: If a dict is carrying structured data with known keys, it should be a Pydantic model, TypedDict, or dataclass. `dict[str, str]` as a poor-man's struct is a `SUGGESTION`. Ask: "Why not a model?"
- **No `dict[str, Any]` / `dict[str, object]`**: Same as above — structured data deserves a type. The exception is when interfacing with an external library that returns untyped dicts and you have no control over the signature. In that case, add a comment noting the exception is intentional.

## Step 4: Analyze the changes

Browse the changed files directly on the filesystem. Read surrounding code for context — not just the changed lines. Use `git diff origin/<base_branch>...HEAD` or `git diff origin/<base_branch>...HEAD -- <path>` to focus on specific files.

Look for:

**Bugs / Correctness**
- Logic errors, off-by-one, race conditions
- Missing error handling, silent fallbacks that hide broken state
- Incorrect types, null safety issues
- Breaking changes to shared interfaces

**Architecture**
- Code in the wrong module (cross-module imports that shouldn't exist)
- Copy-paste duplication that should be shared
- Unnecessary abstractions or over-engineering
- Inconsistency with existing patterns in the codebase

**Over-engineering / Unnecessary Abstractions** — flag aggressively as `SUGGESTION`:
- Generic helper functions that exist to DRY up 3-5 lines of straightforward code. If the "abstraction" requires TypeVars/generics, wrapper closures, and single-purpose callback functions just to conform to its signature — it's not helping. The original inline code was easier to read.
- Rule of thumb: if understanding the abstraction requires jumping between 3+ definitions, and inlining it at each call site would be roughly the same amount of code, it's over-engineered. Say "just inline this".

**Style / Nits**
- Dead imports, dead code
- Ambiguous return types (tuples where a model would be clearer)
- Missing type annotations
- Naming inconsistencies

## Comment Style

- **Terse over thorough.** Say "pagination" not "this query returns all rows without a LIMIT clause which could be a large payload for codebases with thousands of dependencies." Trust the author to understand why.
- **Sound like a teammate, not a review tool.** Lowercase, informal, contractions. No bullet lists or markdown formatting in comments.
- **One concern per comment.** Don't group. If 5 functions are missing logging, leave 5 separate "logging" comments — it's faster to address and harder to miss.
- **Suggest the fix as a question when obvious.** "why not create_or_update instead?" beats explaining the upsert pattern.
- **Don't over-justify.** "i worry about rate limiting" is enough. The author can ask if they don't understand.

## Step 5: Present findings to the user

Format your review as:

```
## Business Context

### The Data
<What tables/models are involved? What's in them? What are the key fields and relationships? Plain language.>

### What This PR Does
<Walk through the data flow: what gets loaded, how it's transformed, what gets returned. Describe the endpoints/functions and what they do. No code — just the logic.>

### What Feature This Delivers
<What can the user do now that they couldn't before? What page/flow does this power? Why does it matter?>

## Files Changed
- `path/to/file.py` — <what changed, one line>
- `path/to/other.py` — <what changed, one line>

## Assessment
<what you think — is it solid? lean? overengineered? risky?>

## Proposed Comments

### 1. [BUG/NIT/SUGGESTION] <file>:<line>
> <the code line in question>

<your comment text>

### 2. ...
```

Prefix each comment with:
- **BUG** — correctness issue, should block merge
- **SUGGESTION** — meaningful improvement, worth discussing
- **nit:** — minor style/preference, take it or leave it

**Do NOT post comments until the user explicitly approves.**

## Step 6: Save review summary

Write a concise review file to `/Users/maxime/dev/nebari-docs/prs/PR-<NUMBER>.md` so the human can quickly scan it and decide what to do.

Format:

```markdown
# PR #<NUMBER>: <title>

**Branch:** `<head>` → `<base>`
**Author:** <author>
**Date reviewed:** <YYYY-MM-DD>

## Business Context

### The Data
<What tables/models are involved? What's in them? What are the key fields and relationships? Plain language.>

### What This PR Does
<Walk through the data flow: what gets loaded, how it's transformed, what gets returned. Describe the endpoints/functions and what they do. No code — just the logic.>

### What Feature This Delivers
<What can the user do now that they couldn't before? What page/flow does this power? Why does it matter?>

## Files Changed
- `path/to/file.py` — <what changed, one line>
- `path/to/other.py` — <what changed, one line>

## Risk Assessment
<High/Medium/Low> — <one sentence why. e.g. "touches auth middleware used by every endpoint">

## Comments

### 1. [BUG/SUGGESTION/nit] `<file>`:<line>
> <code snippet>
<your comment>

### 2. ...

## Verdict
<LGTM / LGTM with nits / Needs changes — one sentence summary>
```

Keep it scannable — the human should understand intent, risk, and your proposed comments in under 60 seconds.

## Step 7: Post approved comments

### ⚠️ Getting line numbers right

The GitHub API `line` parameter is the **line number in the new version of the file** (right side of the diff), NOT a position within the diff hunk.

Since the PR branch is checked out locally, the simplest way to get the correct line number is to open the file and find the line you want to comment on — that line number in the file on disk IS the `line` value to use.

For extra confidence, cross-check with `git diff origin/<base_branch>...HEAD -- <file>` and verify the hunk header math:

1. Find the hunk header: `@@ -old_start,old_count +new_start,new_count @@`
2. Count lines from `new_start` downward, counting ` ` (context) and `+` (added) lines, skipping `-` (removed) lines
3. The number you land on should match what you see in the file on disk

### Posting via API

Get the head commit SHA first:
```bash
COMMIT=$(gh api repos/OWNER/REPO/pulls/PR_NUMBER --jq '.head.sha')
```

Post a single review with all comments at once (preferred — creates one notification, not N):
```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
  --method POST \
  -f commit_id="$COMMIT" \
  -f event="COMMENT" \
  -f body="Thanks for the PR! A few comments." \
  --jq '.id' \
  -f 'comments[][path]=backend/worker/workflows/file.py' \
  -f 'comments[][body]=nit: this could be cleaner' \
  -F 'comments[][line]=120' \
  -f 'comments[][side]=RIGHT' \
  -f 'comments[][path]=backend/worker/activities/other.py' \
  -f 'comments[][body]=Bug: this will NPE when x is None' \
  -F 'comments[][line]=45' \
  -f 'comments[][side]=RIGHT'
```

**Always use `side=RIGHT`** (the new version of the file).

### Double-check before posting

For each comment, open the file on disk and confirm the line number matches the code you want to comment on. If you're unsure, show the user the line numbers you plan to use and let them confirm.

### Cleanup

After the review is done, switch back to the original branch:

```bash
git checkout <original_branch>
```
