---
name: notion
description: Read, search, create, and update Notion pages and databases via the Notion API. Use when the user asks to check Notion, look something up in Notion, create a Notion page, query a Notion database, or anything involving Notion content.
---

# Notion

Interact with a Notion workspace via the API using a zero-dependency bash script.

## Prerequisites

Add your **Notion internal integration token** to `~/.zshrc`:

```bash
export NOTION_API_KEY="ntn_..."
```

To create one: <https://www.notion.so/my-integrations> → New integration → copy the token.

**Important:** The integration must be **connected to each page/database** you want to access. In Notion, open the page → `···` menu → Connections → add your integration.

## Usage

All commands go through the helper script:

```bash
bash <skill_dir>/scripts/notion.sh <command> [args...]
```

All output is JSON. Pipe through `jq` for readability:

```bash
bash <skill_dir>/scripts/notion.sh search "meeting notes" | jq .
```

## Commands Reference

### Search

```bash
# Search everything
bash <skill_dir>/scripts/notion.sh search "quarterly goals"

# Search only pages
bash <skill_dir>/scripts/notion.sh search "quarterly goals" page

# Search only databases
bash <skill_dir>/scripts/notion.sh search "tasks" database
```

### Pages

```bash
# Get page properties (title, status, etc.)
bash <skill_dir>/scripts/notion.sh get-page <page-id>

# Get page content (the actual blocks/text)
bash <skill_dir>/scripts/notion.sh get-page-content <page-id>

# Paginate content (use next_cursor from previous response)
bash <skill_dir>/scripts/notion.sh get-page-content <page-id> <cursor>

# Create a page in a database
bash <skill_dir>/scripts/notion.sh create-page '{
  "parent": {"database_id": "abc123"},
  "properties": {
    "Name": {"title": [{"text": {"content": "New page title"}}]},
    "Status": {"select": {"name": "In Progress"}}
  }
}'

# Create a page under another page
bash <skill_dir>/scripts/notion.sh create-page '{
  "parent": {"page_id": "abc123"},
  "properties": {
    "title": [{"text": {"content": "Child page"}}]
  },
  "children": [
    {"paragraph": {"rich_text": [{"text": {"content": "Hello world"}}]}}
  ]
}'

# Update page properties
bash <skill_dir>/scripts/notion.sh update-page <page-id> '{
  "properties": {
    "Status": {"select": {"name": "Done"}}
  }
}'
```

### Databases

```bash
# Get database schema (see all properties/columns)
bash <skill_dir>/scripts/notion.sh get-database <database-id>

# List all databases the integration can see
bash <skill_dir>/scripts/notion.sh list-databases

# Query with no filter (get all rows)
bash <skill_dir>/scripts/notion.sh query-database <database-id>

# Query with filter
bash <skill_dir>/scripts/notion.sh query-database <database-id> '{
  "filter": {
    "property": "Status",
    "select": {"equals": "In Progress"}
  },
  "sorts": [{"property": "Created", "direction": "descending"}],
  "page_size": 10
}'

# Multi-condition filter
bash <skill_dir>/scripts/notion.sh query-database <database-id> '{
  "filter": {
    "and": [
      {"property": "Status", "select": {"does_not_equal": "Done"}},
      {"property": "Assignee", "people": {"contains": "<user-id>"}}
    ]
  }
}'
```

### Blocks (Content)

```bash
# Get a specific block
bash <skill_dir>/scripts/notion.sh get-block <block-id>

# Get children of a block (nested content)
bash <skill_dir>/scripts/notion.sh get-block-children <block-id>

# Append content to a page or block
bash <skill_dir>/scripts/notion.sh append-blocks <page-id> '[
  {"paragraph": {"rich_text": [{"text": {"content": "New paragraph"}}]}},
  {"heading_2": {"rich_text": [{"text": {"content": "New heading"}}]}},
  {"bulleted_list_item": {"rich_text": [{"text": {"content": "Bullet point"}}]}}
]'

# Delete (archive) a block
bash <skill_dir>/scripts/notion.sh delete-block <block-id>
```

### Comments

```bash
# Get comments on a page
bash <skill_dir>/scripts/notion.sh get-comments <page-id>

# Add a comment
bash <skill_dir>/scripts/notion.sh add-comment <page-id> "This looks good!"
```

### Users

```bash
bash <skill_dir>/scripts/notion.sh list-users
bash <skill_dir>/scripts/notion.sh get-user <user-id>
bash <skill_dir>/scripts/notion.sh me   # bot identity
```

## IDs

Notion IDs are 32-character hex strings. They appear in URLs:

```
https://www.notion.so/workspace/Page-Title-abc123def456...
                                              ^^^^^^^^^^^^^^^^ this part
```

The script accepts IDs with or without dashes.

## Common Workflows

### Read a page's full content

```bash
# 1. Find the page
bash <skill_dir>/scripts/notion.sh search "meeting notes" page | jq '.results[] | {id, title: .properties.title.title[0].plain_text}'

# 2. Get its content
bash <skill_dir>/scripts/notion.sh get-page-content <page-id> | jq '.results[] | {type, text: .paragraph?.rich_text?[0]?.plain_text}'
```

### Scan a database

```bash
# 1. Get schema to see available properties
bash <skill_dir>/scripts/notion.sh get-database <db-id> | jq '.properties | keys'

# 2. Query rows
bash <skill_dir>/scripts/notion.sh query-database <db-id> | jq '.results[] | {id, props: .properties | map_values(.select?.name // .title?[0]?.plain_text // .rich_text?[0]?.plain_text // null)}'
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | Check `NOTION_API_KEY` env var |
| `403 Restricted resource` | Integration not connected to that page — add it via page menu → Connections |
| `404 Not found` | Wrong ID, or integration doesn't have access |
| `validation_error` | Malformed JSON body — check property types match the database schema |
