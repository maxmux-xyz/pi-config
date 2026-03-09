---
name: nebari-jira
description: Read-only access to Jira issues, sprints, boards, and users for the Nebari Engineering project. Use when the user asks to check Jira, look at tickets, see sprint status, find someone's issues, or anything involving Jira content.
---

# Nebari Jira

Read-only Jira access via the REST API. Uses the same Atlassian credentials as Confluence.

## Prerequisites

These should already be in `~/.zshrc` (shared with Confluence):

```bash
export CONFLUENCE_EMAIL="you@company.com"
export CONFLUENCE_API_TOKEN="ATATT3x..."
```

## Key References

- **Project**: EN (Engineering)
- **Board**: 67
- **Instance**: nebari-ai.atlassian.net

## Usage

All commands go through the helper script:

```bash
bash <skill_dir>/scripts/jira.sh <command> [args...]
```

All output is JSON. Pipe through `jq` for readability.

## Commands Reference

### Search Issues (JQL)

```bash
# All open issues in Engineering
bash <skill_dir>/scripts/jira.sh search "project=EN AND status!=Done ORDER BY updated DESC"

# My open issues
bash <skill_dir>/scripts/jira.sh search "project=EN AND assignee=currentUser() AND status!=Done ORDER BY updated DESC"

# Issues assigned to someone
bash <skill_dir>/scripts/jira.sh search "project=EN AND assignee='Display Name' ORDER BY updated DESC"

# By status
bash <skill_dir>/scripts/jira.sh search "project=EN AND status='In Progress' ORDER BY priority DESC"

# By label
bash <skill_dir>/scripts/jira.sh search "project=EN AND labels=security ORDER BY updated DESC"

# With custom max results and fields
bash <skill_dir>/scripts/jira.sh search "project=EN ORDER BY created DESC" 50 "summary,status,assignee,priority"
```

### Issue Details

```bash
# Full issue details (description, comments, subtasks, etc.)
bash <skill_dir>/scripts/jira.sh issue EN-84

# Issue comments
bash <skill_dir>/scripts/jira.sh comments EN-84

# Change history (who changed what, when)
bash <skill_dir>/scripts/jira.sh changelog EN-84

# Available transitions
bash <skill_dir>/scripts/jira.sh transitions EN-84
```

### Sprints

```bash
# Active sprints on board 67
bash <skill_dir>/scripts/jira.sh sprints 67

# Closed sprints
bash <skill_dir>/scripts/jira.sh sprints 67 closed

# Future sprints
bash <skill_dir>/scripts/jira.sh sprints 67 future

# Issues in a sprint
bash <skill_dir>/scripts/jira.sh sprint-issues <sprint-id>
```

### Boards & Backlog

```bash
# List boards
bash <skill_dir>/scripts/jira.sh boards EN

# Board configuration
bash <skill_dir>/scripts/jira.sh board-config 67

# Backlog items
bash <skill_dir>/scripts/jira.sh backlog 67
```

### Users

```bash
# Your own account
bash <skill_dir>/scripts/jira.sh myself

# Find a user by name or email
bash <skill_dir>/scripts/jira.sh find-users "maxime"

# Users assignable in EN project
bash <skill_dir>/scripts/jira.sh assignable EN
```

### Project Metadata

```bash
# List all projects
bash <skill_dir>/scripts/jira.sh projects

# Project details
bash <skill_dir>/scripts/jira.sh project EN

# Issue statuses for a project
bash <skill_dir>/scripts/jira.sh statuses EN

# Issue types
bash <skill_dir>/scripts/jira.sh issue-types EN

# Priority levels
bash <skill_dir>/scripts/jira.sh priorities

# Labels
bash <skill_dir>/scripts/jira.sh labels
```

## Common Workflows

### See what's happening in the current sprint

```bash
# 1. Get active sprint
bash <skill_dir>/scripts/jira.sh sprints 67 | jq '.values[] | {id, name, state, startDate, endDate}'

# 2. List sprint issues
bash <skill_dir>/scripts/jira.sh sprint-issues 1 | jq '.issues[] | {key, summary: .fields.summary, status: .fields.status.name, assignee: .fields.assignee.displayName}'
```

### Check a colleague's workload

```bash
# Find their account
bash <skill_dir>/scripts/jira.sh find-users "sasha" | jq '.[] | {accountId, displayName}'

# Search their open issues
bash <skill_dir>/scripts/jira.sh search "project=EN AND assignee='Sasha Lopashev' AND status!=Done ORDER BY priority DESC" | jq '.issues[] | {key, summary: .fields.summary, status: .fields.status.name}'
```

### Review a specific ticket

```bash
# Get full details
bash <skill_dir>/scripts/jira.sh issue EN-84 | jq '{key, summary: .fields.summary, status: .fields.status.name, assignee: .fields.assignee.displayName, description: .fields.description}'

# Check comments
bash <skill_dir>/scripts/jira.sh comments EN-84 | jq '.comments[] | {author: .author.displayName, created, body}'
```

### Find recently updated issues

```bash
bash <skill_dir>/scripts/jira.sh search "project=EN AND updated>='-7d' ORDER BY updated DESC" | jq '.issues[] | {key, summary: .fields.summary, status: .fields.status.name, updated: .fields.updated}'
```

## JQL Quick Reference

| Filter | JQL |
|--------|-----|
| My issues | `assignee=currentUser()` |
| Unassigned | `assignee is EMPTY` |
| By status | `status='In Progress'` |
| Not done | `status!=Done` |
| By priority | `priority=High` |
| By label | `labels=security` |
| Created this week | `created>=startOfWeek()` |
| Updated last 7 days | `updated>='-7d'` |
| Has comments | `comment is not EMPTY` |
| Text search | `text~"deployment"` |

Combine with `AND`/`OR`, sort with `ORDER BY updated DESC`.

Full reference: https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jql/

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | Check `CONFLUENCE_EMAIL` and `CONFLUENCE_API_TOKEN` env vars |
| `404 Not Found` | Wrong issue key or project key |
| Empty search results | Broaden JQL query, check project key |
| `Field 'xxx' does not exist` | Remove that field from the fields parameter |
