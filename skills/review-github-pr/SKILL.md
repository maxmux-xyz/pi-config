---
name: review-github-pr
description: Review a GitHub PR and issue inline comments. Fetches diff, analyzes against codestyle/architecture guidelines, presents findings to user, and posts comments only when approved.
---

# Review GitHub PR

A structured workflow for reviewing PRs and issuing precise inline comments.

---

## Step 1: Fetch PR metadata and diff

```bash
# Get PR metadata
gh pr view <PR_NUMBER> --repo <OWNER>/<REPO> --json title,body,headRefName,baseRefName,files

# Save the full diff to a temp file — you'll need exact line numbers later when posting comments
gh pr diff <PR_NUMBER> --repo <OWNER>/<REPO> > /tmp/pr-<PR_NUMBER>.diff
```

Read the diff from `/tmp/pr-<PR_NUMBER>.diff`. When posting comments later, re-read the relevant hunks from this file to count exact line numbers.

## Step 2: Understand the goal

Read the PR title, description, and linked issues. Summarize in one sentence what this PR is trying to do before reading any code.

## Step 3: Load project standards

Read the relevant guidelines for the files changed:

- `AGENTS.md` (root and module-level)
- `CODESTYLE.md` for affected modules
- Any relevant files in `.claude/knowledge/`
- `BEST_PRACTICES.md` if it exists

Cross-reference the diff against these standards.

## Step 4: Analyze the diff

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

**Style / Nits**
- Dead imports, dead code
- Ambiguous return types (tuples where a model would be clearer)
- Missing type annotations
- Naming inconsistencies

## Step 5: Present findings to the user

Format your review as:

```
## PR Summary
<one paragraph on what this PR does>

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

## Step 6: Post approved comments

### ⚠️ Getting line numbers right

This is the tricky part. The GitHub API `line` parameter is the **line number in the new version of the file** (right side of the diff), NOT a position within the diff hunk.

**Procedure to get correct line numbers:**

1. Look at the diff output from `gh pr diff`
2. Find the hunk header: `@@ -old_start,old_count +new_start,new_count @@`
3. Count lines from `new_start` downward, counting lines that start with ` ` (context) or `+` (added), skipping lines that start with `-` (removed)
4. The number you land on is the `line` value to use

**Example:**
```
@@ -111,8 +115,31 @@ async def _orchestrate...
         fix_validation_handles = await ...    # line 116 (115+1)
                                               # line 117
-    # Step 6: Run extraction...               # SKIP (removed)
+    # Step 6: Start extraction only...        # line 118
+    extractable_ids = summary.new_report_ids  # line 119
+    if summary.new_report_ids and user_id:    # line 120  <-- this is the line number to use
```

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

For each comment, verify the line number by searching the diff output for the exact code you want to comment on and counting from the hunk header. If you're unsure, show the user the line numbers you plan to use and let them confirm.
