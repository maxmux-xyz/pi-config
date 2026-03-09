---
name: confluence-read
description: Search, browse, and read Confluence pages and spaces via the REST API. Use when the user asks to check Confluence, find docs, read a page, explore spaces, look for recent changes, or anything involving reading Confluence content.
---

# Confluence Read

Search, browse, and read Confluence pages via a zero-dependency bash script.

## Prerequisites

Add credentials to `~/.zshrc`:

```bash
export CONFLUENCE_EMAIL="you@company.com"
export CONFLUENCE_API_TOKEN="ATATT3x..."   # https://id.atlassian.com/manage-profile/security/api-tokens
export CONFLUENCE_INSTANCE="nebari-ai.atlassian.net"  # optional, this is the default
```

## Usage

All commands go through the helper script:

```bash
bash <skill_dir>/scripts/confluence.sh <command> [args...]
```

All output is JSON. Pipe through `jq` for readability:

```bash
bash <skill_dir>/scripts/confluence.sh search "architecture" | jq .
```

## Commands Reference

### Search

```bash
# Full-text search (searches page content and titles)
bash <skill_dir>/scripts/confluence.sh search "deployment pipeline" 20

# Search titles only
bash <skill_dir>/scripts/confluence.sh search-title "runbook" 10

# Raw CQL query (for complex searches)
bash <skill_dir>/scripts/confluence.sh search-cql 'type=page AND space=ENG AND text~"kubernetes"' 20
```

CQL reference: https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/

### Recent & Modified Pages

```bash
# Recently updated pages (all spaces)
bash <skill_dir>/scripts/confluence.sh recent 25

# Recently updated in a specific space
bash <skill_dir>/scripts/confluence.sh recent 25 ENG

# Pages created after a date
bash <skill_dir>/scripts/confluence.sh created-after "2025-02-01" 25

# Pages created after a date in a specific space
bash <skill_dir>/scripts/confluence.sh created-after "2025-02-01" 25 PM

# Pages modified after a date
bash <skill_dir>/scripts/confluence.sh modified-after "2025-02-01" 25
```

### Read Pages

```bash
# Get page metadata (title, space, version, ancestors, labels)
bash <skill_dir>/scripts/confluence.sh get-page <page-id>

# Get page body (the actual content)
# Formats: storage (default, XHTML), view (rendered HTML), export_view
bash <skill_dir>/scripts/confluence.sh get-page-body <page-id>
bash <skill_dir>/scripts/confluence.sh get-page-body <page-id> view
```

**Tip:** The `storage` format returns raw XHTML. For easier reading, extract text:

```bash
bash <skill_dir>/scripts/confluence.sh get-page-body <page-id> | \
  jq -r '.body.storage.value' | \
  python3 -c "import sys,html,re; t=sys.stdin.read(); print(re.sub('<[^>]+>', '', html.unescape(t)))"
```

### Browse Page Trees

```bash
# Get direct child pages of a parent
bash <skill_dir>/scripts/confluence.sh children <page-id> 50

# Get all descendants (full subtree)
bash <skill_dir>/scripts/confluence.sh descendants <page-id> 50
```

### Spaces

```bash
# List all spaces
bash <skill_dir>/scripts/confluence.sh spaces

# List top-level pages in a space
bash <skill_dir>/scripts/confluence.sh space-pages ENG 50
```

### Labels

```bash
# Get labels on a page
bash <skill_dir>/scripts/confluence.sh labels <page-id>

# Find all pages with a label
bash <skill_dir>/scripts/confluence.sh search-label "architecture" 20
```

### Other

```bash
# Page comments
bash <skill_dir>/scripts/confluence.sh comments <page-id>

# Page attachments
bash <skill_dir>/scripts/confluence.sh attachments <page-id>

# Version history (who edited, when)
bash <skill_dir>/scripts/confluence.sh history <page-id>
```

## Common Workflows

### Discover what's new

```bash
# 1. See what's been updated recently
bash <skill_dir>/scripts/confluence.sh recent 30 | jq '.results[] | {id: .id, title: .title, space: .space.key, updated: .history.lastUpdated.when, by: .version.by.displayName}'

# 2. Find pages created in the last week
bash <skill_dir>/scripts/confluence.sh created-after "2025-02-17" | jq '.results[] | {id: .id, title: .title, space: .space.key}'

# 3. Read an interesting one
bash <skill_dir>/scripts/confluence.sh get-page-body <page-id> | jq -r '.body.storage.value'
```

### Explore a space

```bash
# 1. List all spaces to find the right one
bash <skill_dir>/scripts/confluence.sh spaces | jq '.results[] | {key: .key, name: .name}'

# 2. Get top-level pages
bash <skill_dir>/scripts/confluence.sh space-pages ENG | jq '.results[] | {id: .id, title: .title}'

# 3. Drill into a page tree
bash <skill_dir>/scripts/confluence.sh children <parent-id> | jq '.results[] | {id: .id, title: .title}'
```

### Search for specific topics

```bash
# Full-text search
bash <skill_dir>/scripts/confluence.sh search "incident response" | jq '.results[] | {id: .id, title: .title, space: .space.key}'

# By label
bash <skill_dir>/scripts/confluence.sh search-label "postmortem" | jq '.results[] | {id: .id, title: .title}'
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | Check `CONFLUENCE_EMAIL` and `CONFLUENCE_API_TOKEN` env vars |
| `404 Not Found` | Wrong page ID or you don't have access |
| Empty results | Try broader search terms; check space key is correct |
| HTML in output | Use the text extraction tip above, or use `view` format |
