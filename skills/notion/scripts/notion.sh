#!/usr/bin/env bash
# Notion API helper — thin curl wrapper
# Requires: NOTION_API_KEY env var (integration token starting with ntn_ or secret_)
# Notion API version: 2022-06-28

set -euo pipefail

NOTION_VERSION="2022-06-28"
BASE="https://api.notion.com/v1"

if [[ -z "${NOTION_API_KEY:-}" ]]; then
  echo "ERROR: NOTION_API_KEY not set. Add to ~/.zshrc:" >&2
  echo '  export NOTION_API_KEY="ntn_..."' >&2
  exit 1
fi

auth_headers=(
  -H "Authorization: Bearer ${NOTION_API_KEY}"
  -H "Notion-Version: ${NOTION_VERSION}"
  -H "Content-Type: application/json"
)

cmd="${1:-help}"
shift || true

case "$cmd" in

  # ── Search ──────────────────────────────────────────────────────────
  search)
    # Usage: notion.sh search "query" [page|database]
    query="${1:-}"
    filter_type="${2:-}"
    body="{\"query\":\"${query}\""
    if [[ -n "$filter_type" ]]; then
      body+=",\"filter\":{\"property\":\"object\",\"value\":\"${filter_type}\"}"
    fi
    body+="}"
    curl -sS -X POST "${BASE}/search" "${auth_headers[@]}" -d "$body"
    ;;

  # ── Pages ───────────────────────────────────────────────────────────
  get-page)
    # Usage: notion.sh get-page <page-id>
    page_id="${1:?page-id required}"
    curl -sS "${BASE}/pages/${page_id}" "${auth_headers[@]}"
    ;;

  get-page-content)
    # Usage: notion.sh get-page-content <page-id> [start-cursor]
    # Returns block children (the actual content)
    page_id="${1:?page-id required}"
    cursor="${2:-}"
    url="${BASE}/blocks/${page_id}/children?page_size=100"
    [[ -n "$cursor" ]] && url+="&start_cursor=${cursor}"
    curl -sS "$url" "${auth_headers[@]}"
    ;;

  create-page)
    # Usage: notion.sh create-page <json-body>
    # JSON must include parent, properties, and optionally children
    body="${1:?json body required}"
    curl -sS -X POST "${BASE}/pages" "${auth_headers[@]}" -d "$body"
    ;;

  update-page)
    # Usage: notion.sh update-page <page-id> <json-body>
    page_id="${1:?page-id required}"
    body="${2:?json body required}"
    curl -sS -X PATCH "${BASE}/pages/${page_id}" "${auth_headers[@]}" -d "$body"
    ;;

  # ── Blocks ──────────────────────────────────────────────────────────
  get-block)
    # Usage: notion.sh get-block <block-id>
    block_id="${1:?block-id required}"
    curl -sS "${BASE}/blocks/${block_id}" "${auth_headers[@]}"
    ;;

  get-block-children)
    # Usage: notion.sh get-block-children <block-id> [start-cursor]
    block_id="${1:?block-id required}"
    cursor="${2:-}"
    url="${BASE}/blocks/${block_id}/children?page_size=100"
    [[ -n "$cursor" ]] && url+="&start_cursor=${cursor}"
    curl -sS "$url" "${auth_headers[@]}"
    ;;

  append-blocks)
    # Usage: notion.sh append-blocks <block-id> <json-children-array>
    block_id="${1:?block-id required}"
    children="${2:?children json array required}"
    curl -sS -X PATCH "${BASE}/blocks/${block_id}/children" "${auth_headers[@]}" \
      -d "{\"children\":${children}}"
    ;;

  delete-block)
    # Usage: notion.sh delete-block <block-id>
    block_id="${1:?block-id required}"
    curl -sS -X DELETE "${BASE}/blocks/${block_id}" "${auth_headers[@]}"
    ;;

  # ── Databases ───────────────────────────────────────────────────────
  get-database)
    # Usage: notion.sh get-database <database-id>
    db_id="${1:?database-id required}"
    curl -sS "${BASE}/databases/${db_id}" "${auth_headers[@]}"
    ;;

  query-database)
    # Usage: notion.sh query-database <database-id> [json-filter-body]
    # filter-body can include filter, sorts, start_cursor, page_size
    db_id="${1:?database-id required}"
    body="${2:-{\}}"
    curl -sS -X POST "${BASE}/databases/${db_id}/query" "${auth_headers[@]}" -d "$body"
    ;;

  list-databases)
    # Usage: notion.sh list-databases
    # Searches for all databases the integration can see
    curl -sS -X POST "${BASE}/search" "${auth_headers[@]}" \
      -d '{"filter":{"property":"object","value":"database"}}'
    ;;

  # ── Users ───────────────────────────────────────────────────────────
  list-users)
    curl -sS "${BASE}/users" "${auth_headers[@]}"
    ;;

  get-user)
    user_id="${1:?user-id required}"
    curl -sS "${BASE}/users/${user_id}" "${auth_headers[@]}"
    ;;

  me)
    curl -sS "${BASE}/users/me" "${auth_headers[@]}"
    ;;

  # ── Comments ────────────────────────────────────────────────────────
  get-comments)
    # Usage: notion.sh get-comments <page-or-block-id>
    id="${1:?page-or-block-id required}"
    curl -sS "${BASE}/comments?block_id=${id}&page_size=100" "${auth_headers[@]}"
    ;;

  add-comment)
    # Usage: notion.sh add-comment <page-id> "comment text"
    page_id="${1:?page-id required}"
    text="${2:?comment text required}"
    curl -sS -X POST "${BASE}/comments" "${auth_headers[@]}" \
      -d "{\"parent\":{\"page_id\":\"${page_id}\"},\"rich_text\":[{\"text\":{\"content\":\"${text}\"}}]}"
    ;;

  # ── Help ────────────────────────────────────────────────────────────
  help|*)
    cat <<'EOF'
Notion API CLI — Commands:

  search "query" [page|database]     Search pages/databases
  get-page <id>                      Get page properties
  get-page-content <id> [cursor]     Get page block content
  create-page <json>                 Create a page
  update-page <id> <json>            Update page properties
  get-block <id>                     Get a single block
  get-block-children <id> [cursor]   Get children of a block
  append-blocks <id> <json-array>    Append children blocks
  delete-block <id>                  Delete (archive) a block
  get-database <id>                  Get database schema
  query-database <id> [json-filter]  Query database rows
  list-databases                     List all visible databases
  list-users                         List workspace users
  get-user <id>                      Get user details
  me                                 Get bot user info
  get-comments <id>                  Get comments on page/block
  add-comment <page-id> "text"       Add comment to page

IDs: Use 32-char hex (with or without dashes).
All output is JSON. Pipe through jq for readability.
EOF
    ;;
esac
