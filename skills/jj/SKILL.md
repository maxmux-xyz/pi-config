---
name: jj
description: Use Jujutsu (jj) instead of git for VCS operations. Use when the user asks to commit, branch, rebase, push, check status, undo, amend, fixup, or anything resembling a git verb — AND the current repo is jj-colocated. Also use when the user mentions "jj", "jujutsu", "bookmark", "revset", or pastes jj output. Detect colocation with `test -d .jj`. If not colocated, fall back to plain git.
metadata:
  version: 1.0.0
  category: vcs
---

## When to activate

Run `test -d .jj && echo jj || echo git` in the repo root. Only use this skill when `.jj` exists. Otherwise use plain git.

## Project-specific rules still apply

Always defer to the repo's own `AGENTS.md` for branch naming, PR conventions, and never-push targets (e.g. `stg`/`main`). This skill only covers the *mechanics* of how to do those operations in jj instead of git.

**Never** commit, push, or create bookmarks unless the user explicitly asks.

## Core mental model

- The **working copy is a commit** (`@`). Every `jj` command auto-snapshots it. There is no staging area.
- Edit files → working-copy commit auto-amends. No `add` step.
- `@-` = parent of working copy. `@--` = grandparent.
- **Bookmarks** = git branches, but decoupled from `HEAD`. You work first, name a bookmark when ready to push.
- **Conflicts are stored in commits**; commands never stop mid-rebase. You resolve later.
- Descendants of an edited commit are **auto-rebased**.
- Every operation is recorded in `jj op log`. `jj undo` reverses the last operation.

## Cheat sheet — git → jj

| Intent | git | jj |
|---|---|---|
| Status | `git status` | `jj st` |
| Log | `git log --oneline --graph` | `jj log` |
| Show working-copy diff | `git diff` | `jj diff` |
| Show diff of any commit | `git show <sha>` | `jj show <id>` or `jj diff -r <id>` |
| Start a new change | `git checkout -b foo` | `jj new -m "msg"` |
| Set/edit commit message | `git commit --amend -m` | `jj describe -m "msg"` |
| Amend working copy | `git commit --amend` | (automatic — just edit files) |
| Move hunks into parent | `git add -p; git commit --amend` | `jj squash -i` |
| Split a commit into two | `git reset -p` dance | `jj split` |
| Edit an older commit | `git rebase -i` | `jj edit <id>` (or `jj diffedit <id>`) |
| Rebase stack onto trunk | `git rebase main` | `jj rebase -d main` |
| Rebase a subtree | `git rebase --onto` | `jj rebase -s <src> -d <dest>` |
| Create branch | `git branch foo` | `jj bookmark create foo -r @-` |
| Move branch | `git branch -f foo HEAD` | `jj bookmark move foo --to @-` |
| Push | `git push -u origin foo` | `jj git push --bookmark foo` |
| Force push | `git push -f` | `jj git push` (jj handles divergence) |
| Fetch | `git fetch` | `jj git fetch` |
| Stash | `git stash` | `jj new` (just start a new change) |
| Undo last op | `git reset --hard ORIG_HEAD` | `jj undo` |
| Reflog | `git reflog` | `jj op log` |
| Abandon a commit | `git rebase -i` drop | `jj abandon <id>` |
| Cherry-pick | `git cherry-pick` | `jj duplicate -d <dest> <ids>` or `jj rebase -r` |

## Standard PR workflow

```bash
# Start fresh from trunk (substitute correct trunk: stg, main, etc.)
jj new <trunk> -m "type/short-desc: working description"
# ... edit files (auto-snapshotted) ...

# Set the real commit message
jj describe -m "ENG-123: real message"

# Create bookmark on the commit you want to push (NOT @, which is the working copy)
jj bookmark create type/short-desc -r @-

# Push
jj git push --bookmark type/short-desc

# Open PR
gh pr create --base <trunk> --title "ENG-123: real message"
```

**Footgun:** Bookmarks should point to `@-` (parent), not `@` (working copy). The working copy is meant to be an empty in-progress commit on top of your "real" work.

## Responding to review feedback

```bash
# Jump to the commit that needs changes
jj edit <commit-id>     # or jj edit <bookmark-name> if bookmark points there

# Edit files — they auto-amend the commit
# ... edit ...

# Move bookmark to the new commit hash
jj bookmark move <bookmark> --to @

# Push (jj handles force-push semantics automatically)
jj git push --bookmark <bookmark>
```

For fixups buried in a stack:
```bash
# Make changes in working copy, then move them into the right commit:
jj squash --into <commit-id>      # whole working copy
jj squash -i --into <commit-id>   # interactive hunk selection
```

## Stacked PRs

```bash
jj new <trunk> -m "ENG-100: part 1"
# work
jj new -m "ENG-100: part 2"
# work
jj new -m "ENG-100: part 3"
# work

jj bookmark create eng-100/part-1 -r <part1-id>
jj bookmark create eng-100/part-2 -r <part2-id>
jj bookmark create eng-100/part-3 -r <part3-id>

jj git push --bookmark eng-100/part-1 --bookmark eng-100/part-2 --bookmark eng-100/part-3
```

If part 1 needs changes: `jj edit <part1-id>`, fix, parts 2 & 3 auto-rebase. Then `jj bookmark move eng-100/part-2 --to <new-part2-id>` (etc.) and re-push.

## Useful revsets

- `@` — working copy
- `@-` — parent
- `trunk()` — configured trunk (set by `jj git init`/`clone`; check with `jj config get revset-aliases.'trunk()'`)
- `mine()` — your commits
- `heads(::@)` — all heads ancestor to working copy
- `mine() & ~::trunk()` — your unpushed in-flight work

```bash
jj log -r 'mine() & ~::trunk()'   # show my unpushed work
```

## Safety / bailout

- `jj undo` reverses the last operation (rebase, squash, abandon — all of it).
- `jj op log` shows every operation; `jj op restore <op-id>` returns to that state.
- `jj abandon` hides commits but they're recoverable via op log.
- When in doubt: **do not push**. Local jj operations are always reversible.

## Mixing with git

Safe with **read-only** git commands (`git log`, `git diff`, `git status`, `gh pr ...`) — jj exports state on every command. Avoid mutating git commands (`git commit`, `git rebase`, `git checkout -b`) unless there's a specific reason; use jj equivalents.

`gh` CLI works fine in colocated repos.

## When NOT to use jj

- **Git LFS repos** — jj does not support LFS. Check: `grep -r filter=lfs .gitattributes 2>/dev/null`.
- **Submodule operations** — jj ignores submodules. Use raw `git submodule` commands for those.

## First-time setup on a new repo (reference)

```bash
# In an existing git repo
jj git init --colocate
jj bookmark track <trunk>@origin
jj config set --user user.name "<name>"
jj config set --user user.email "<email>"
jj metaedit --update-author   # rewrites the empty working-copy commit to use new identity
```
