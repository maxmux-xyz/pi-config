---
name: graphite-pr
description: Create and submit PRs using the Graphite CLI (gt). Covers single PRs and stacked PRs. Use when the user asks to submit a PR, create a PR, stack PRs, or push changes for review.
---

# Graphite PR Workflow

Graphite (`gt`) wraps GitHub to enable stacked PRs — small, focused, reviewable changes.

## Single PR

```bash
git add .
gt create -m "feat: description of change"
gt submit
```

## Stacking PRs

Each `gt create` stacks a new branch on top of the current one:

```bash
# First PR
git add .
gt create -m "feat: add user API"
gt submit

# Keep working — second PR stacks on top
git add .
gt create -m "feat: add user frontend"
gt submit --stack   # submits all unsubmitted PRs in the stack
```

## Updating a PR after review feedback

```bash
# If mid-stack, checkout the branch first
gt checkout           # interactive picker, or: gt down / gt up

# Make fixes, then amend
git add .
gt modify             # amends current branch commit + restacks above
gt submit
```

## Syncing with remote

```bash
gt sync               # pulls main, cleans merged branches, restacks
```

## Visualizing the stack

```bash
gt log short          # compact view (alias: gt ls)
gt log                # full view
```

## Quick reference

| Action | Command |
|--------|---------|
| Create branch + commit | `gt create -m "msg"` |
| Amend current branch | `gt modify` (after `git add`) |
| Submit current + downstack | `gt submit` |
| Submit full stack | `gt submit --stack` |
| Navigate stack | `gt up` / `gt down` / `gt checkout` |
| Sync with remote | `gt sync` |
| View stack | `gt log short` |
| Restack after conflicts | `gt restack` |

## Squashing a stack into one PR

To fold all stacked branches into a single branch (bottom-up):

```bash
gt top                # go to top of stack
gt fold               # folds current branch into the one below, repeat until one branch remains
gt fold               # keep folding...
gt submit
```

`gt fold` merges the current branch into its parent. Repeat from the top until only one branch remains.

To squash multiple commits within a single branch: `gt squash`.

## Rules

- Always use `git add .` before `gt create` or `gt modify` — Graphite does not auto-stage
- Use `gt submit`, never `git push`
- Use `gt sync`, never `git pull` or `git merge`
- Avoid `git rebase` on Graphite stacks — use `gt restack`
- Keep each PR small and focused — that's the whole point of stacking
- Full docs: https://graphite.com/docs/command-reference
