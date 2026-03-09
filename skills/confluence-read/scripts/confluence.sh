#!/usr/bin/env bash
# Confluence API helper — thin curl wrapper for reading/searching
# Requires: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN env vars
# Instance is passed as first arg or defaults to CONFLUENCE_INSTANCE env var

set -euo pipefail

if [[ -z "${CONFLUENCE_EMAIL:-}" ]] || [[ -z "${CONFLUENCE_API_TOKEN:-}" ]]; then
  echo "ERROR: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN must be set. Add to ~/.zshrc:" >&2
  echo '  export CONFLUENCE_EMAIL="you@company.com"' >&2
  echo '  export CONFLUENCE_API_TOKEN="ATATT3x..."' >&2
  exit 1
fi

INSTANCE="${CONFLUENCE_INSTANCE:-nebari-ai.atlassian.net}"
BASE="https://${INSTANCE}/wiki/rest/api"
V2_BASE="https://${INSTANCE}/wiki/api/v2"

auth="-u ${CONFLUENCE_EMAIL}:${CONFLUENCE_API_TOKEN}"

cmd="${1:-help}"
shift || true

case "$cmd" in

  # ── Search ──────────────────────────────────────────────────────────
  search)
    # Usage: confluence.sh search "query text" [limit]
    # Searches page content and titles using CQL text~ operator
    query="${1:?search query required}"
    limit="${2:-20}"
    cql="type=page AND text~\"${query}\""
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,ancestors,version"
    ;;

  search-title)
    # Usage: confluence.sh search-title "title text" [limit]
    # Searches only page titles
    query="${1:?search query required}"
    limit="${2:-20}"
    cql="type=page AND title~\"${query}\""
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,ancestors,version"
    ;;

  search-cql)
    # Usage: confluence.sh search-cql "type=page AND space=ENG AND ..." [limit]
    # Raw CQL query for advanced searches
    cql="${1:?CQL query required}"
    limit="${2:-20}"
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,ancestors,version"
    ;;

  # ── Recent / Modified ──────────────────────────────────────────────
  recent)
    # Usage: confluence.sh recent [limit] [space-key]
    # Lists recently updated pages across all spaces (or one space)
    limit="${1:-25}"
    space="${2:-}"
    cql="type=page"
    if [[ -n "$space" ]]; then
      cql+=" AND space=\"${space}\""
    fi
    cql+=" ORDER BY lastModified DESC"
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,version,ancestors"
    ;;

  created-after)
    # Usage: confluence.sh created-after "2025-02-01" [limit] [space-key]
    # Pages created after a given date
    date="${1:?date required (YYYY-MM-DD)}"
    limit="${2:-25}"
    space="${3:-}"
    cql="type=page AND created>=\"${date}\""
    if [[ -n "$space" ]]; then
      cql+=" AND space=\"${space}\""
    fi
    cql+=" ORDER BY created DESC"
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,version,ancestors"
    ;;

  modified-after)
    # Usage: confluence.sh modified-after "2025-02-01" [limit] [space-key]
    # Pages modified after a given date
    date="${1:?date required (YYYY-MM-DD)}"
    limit="${2:-25}"
    space="${3:-}"
    cql="type=page AND lastModified>=\"${date}\""
    if [[ -n "$space" ]]; then
      cql+=" AND space=\"${space}\""
    fi
    cql+=" ORDER BY lastModified DESC"
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,version,ancestors"
    ;;

  # ── Pages ───────────────────────────────────────────────────────────
  get-page)
    # Usage: confluence.sh get-page <page-id>
    # Returns page metadata, version, space, ancestors
    page_id="${1:?page-id required}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}?expand=space,version,ancestors,history.lastUpdated,metadata.labels"
    ;;

  get-page-body)
    # Usage: confluence.sh get-page-body <page-id> [format]
    # Returns page body. Format: storage (default), view, export_view, atlas_doc_format
    page_id="${1:?page-id required}"
    format="${2:-storage}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}?expand=body.${format},version,space"
    ;;

  # ── Children / Tree ─────────────────────────────────────────────────
  children)
    # Usage: confluence.sh children <page-id> [limit]
    # Get child pages of a parent
    page_id="${1:?page-id required}"
    limit="${2:-50}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}/child/page?limit=${limit}&expand=version,history.lastUpdated"
    ;;

  descendants)
    # Usage: confluence.sh descendants <page-id> [limit]
    # Get all descendant pages (full subtree)
    page_id="${1:?page-id required}"
    limit="${2:-50}"
    cql="type=page AND ancestor=${page_id} ORDER BY lastModified DESC"
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,version,ancestors"
    ;;

  # ── Spaces ──────────────────────────────────────────────────────────
  spaces)
    # Usage: confluence.sh spaces [limit]
    # List all spaces
    limit="${1:-50}"
    curl -sS ${auth} \
      "${BASE}/space?limit=${limit}&expand=description.plain"
    ;;

  space-pages)
    # Usage: confluence.sh space-pages <space-key> [limit]
    # List top-level pages in a space
    space="${1:?space-key required}"
    limit="${2:-50}"
    curl -sS ${auth} \
      "${BASE}/space/${space}/content/page?limit=${limit}&expand=version,history.lastUpdated,ancestors"
    ;;

  # ── Labels ──────────────────────────────────────────────────────────
  labels)
    # Usage: confluence.sh labels <page-id>
    # Get labels on a page
    page_id="${1:?page-id required}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}/label"
    ;;

  search-label)
    # Usage: confluence.sh search-label "label-name" [limit]
    # Find pages with a specific label
    label="${1:?label name required}"
    limit="${2:-20}"
    cql="type=page AND label=\"${label}\""
    curl -sS ${auth} \
      --get "${BASE}/content/search" \
      --data-urlencode "cql=${cql}" \
      --data-urlencode "limit=${limit}" \
      --data-urlencode "expand=space,history.lastUpdated,version"
    ;;

  # ── Comments ────────────────────────────────────────────────────────
  comments)
    # Usage: confluence.sh comments <page-id> [limit]
    # Get comments on a page
    page_id="${1:?page-id required}"
    limit="${2:-25}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}/child/comment?limit=${limit}&expand=body.storage,version"
    ;;

  # ── Attachments ─────────────────────────────────────────────────────
  attachments)
    # Usage: confluence.sh attachments <page-id> [limit]
    page_id="${1:?page-id required}"
    limit="${2:-25}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}/child/attachment?limit=${limit}"
    ;;

  # ── User / Who edited ──────────────────────────────────────────────
  history)
    # Usage: confluence.sh history <page-id>
    # Get version history for a page
    page_id="${1:?page-id required}"
    curl -sS ${auth} \
      "${BASE}/content/${page_id}/version"
    ;;

  # ── Help ────────────────────────────────────────────────────────────
  help|*)
    cat <<'EOF'
Confluence Read/Search CLI — Commands:

  SEARCH
    search "query" [limit]                  Full-text search across pages
    search-title "query" [limit]            Search page titles only
    search-cql "CQL query" [limit]          Raw CQL query

  RECENT / MODIFIED
    recent [limit] [space]                  Recently updated pages
    created-after "YYYY-MM-DD" [limit] [space]   Pages created after date
    modified-after "YYYY-MM-DD" [limit] [space]  Pages modified after date

  PAGES
    get-page <id>                           Page metadata + version + ancestors
    get-page-body <id> [format]             Page body (storage|view|export_view)

  TREE
    children <id> [limit]                   Direct child pages
    descendants <id> [limit]                All descendant pages (subtree)

  SPACES
    spaces [limit]                          List all spaces
    space-pages <space-key> [limit]         Top-level pages in a space

  LABELS
    labels <id>                             Labels on a page
    search-label "label" [limit]            Find pages by label

  OTHER
    comments <id> [limit]                   Page comments
    attachments <id> [limit]                Page attachments
    history <id>                            Version history

  Instance: Set CONFLUENCE_INSTANCE env var (default: nebari-ai.atlassian.net)
  Auth: CONFLUENCE_EMAIL + CONFLUENCE_API_TOKEN env vars
  All output is JSON. Pipe through jq for readability.

  CQL reference: https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/
EOF
    ;;
esac
