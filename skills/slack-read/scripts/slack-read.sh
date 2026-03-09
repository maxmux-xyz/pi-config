#!/usr/bin/env bash
# Slack Web API — read-only commands using a User OAuth Token (xoxp-...)
# Requires: SLACK_USER_TOKEN env var

set -euo pipefail

BASE="https://slack.com/api"

TOKEN="${SLACK_USER_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: SLACK_USER_TOKEN not set. Add to ~/.zshrc:" >&2
  echo '  export SLACK_USER_TOKEN="xoxp-..."' >&2
  exit 1
fi

auth_header=(-H "Authorization: Bearer ${TOKEN}")

cmd="${1:-help}"
shift || true

case "$cmd" in

  # ── Channels ────────────────────────────────────────────────────────
  list-channels)
    # Usage: slack-read.sh list-channels [cursor]
    cursor="${1:-}"
    url="${BASE}/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true"
    [[ -n "$cursor" ]] && url+="&cursor=${cursor}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  channel-info)
    # Usage: slack-read.sh channel-info <channel-id>
    channel="${1:?channel-id required}"
    curl -sS "${BASE}/conversations.info?channel=${channel}" "${auth_header[@]}"
    ;;

  channel-history)
    # Usage: slack-read.sh channel-history <channel-id> [limit] [oldest-ts] [latest-ts]
    channel="${1:?channel-id required}"
    limit="${2:-20}"
    oldest="${3:-}"
    latest="${4:-}"
    url="${BASE}/conversations.history?channel=${channel}&limit=${limit}"
    [[ -n "$oldest" ]] && url+="&oldest=${oldest}"
    [[ -n "$latest" ]] && url+="&latest=${latest}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  thread)
    # Usage: slack-read.sh thread <channel-id> <thread-ts> [limit]
    channel="${1:?channel-id required}"
    thread_ts="${2:?thread-ts required}"
    limit="${3:-50}"
    curl -sS "${BASE}/conversations.replies?channel=${channel}&ts=${thread_ts}&limit=${limit}" \
      "${auth_header[@]}"
    ;;

  # ── Search ──────────────────────────────────────────────────────────
  search)
    # Usage: slack-read.sh search "query" [count]
    query="${1:?query required}"
    count="${2:-20}"
    encoded_query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${query}'))")
    curl -sS "${BASE}/search.messages?query=${encoded_query}&count=${count}" \
      "${auth_header[@]}"
    ;;

  # ── Users ───────────────────────────────────────────────────────────
  list-users)
    # Usage: slack-read.sh list-users [cursor]
    cursor="${1:-}"
    url="${BASE}/users.list?limit=200"
    [[ -n "$cursor" ]] && url+="&cursor=${cursor}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  user-info)
    # Usage: slack-read.sh user-info <user-id>
    user="${1:?user-id required}"
    curl -sS "${BASE}/users.info?user=${user}" "${auth_header[@]}"
    ;;

  lookup-email)
    # Usage: slack-read.sh lookup-email <email>
    email="${1:?email required}"
    curl -sS "${BASE}/users.lookupByEmail?email=${email}" "${auth_header[@]}"
    ;;

  # ── DMs (read only) ────────────────────────────────────────────────
  list-dms)
    # Usage: slack-read.sh list-dms [cursor]
    # Lists open DM conversations
    cursor="${1:-}"
    url="${BASE}/conversations.list?types=im&limit=200"
    [[ -n "$cursor" ]] && url+="&cursor=${cursor}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  dm-history)
    # Usage: slack-read.sh dm-history <dm-channel-id> [limit] [oldest-ts] [latest-ts]
    # Read messages from a DM. Get dm-channel-id from list-dms.
    channel="${1:?dm-channel-id required}"
    limit="${2:-20}"
    oldest="${3:-}"
    latest="${4:-}"
    url="${BASE}/conversations.history?channel=${channel}&limit=${limit}"
    [[ -n "$oldest" ]] && url+="&oldest=${oldest}"
    [[ -n "$latest" ]] && url+="&latest=${latest}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  # ── Bookmarks ───────────────────────────────────────────────────────
  list-bookmarks)
    # Usage: slack-read.sh list-bookmarks <channel-id>
    channel="${1:?channel-id required}"
    curl -sS "${BASE}/bookmarks.list?channel_id=${channel}" "${auth_header[@]}"
    ;;

  # ── Auth ────────────────────────────────────────────────────────────
  auth-test)
    # Usage: slack-read.sh auth-test — verify token and show identity
    curl -sS "${BASE}/auth.test" "${auth_header[@]}"
    ;;

  # ── Help ────────────────────────────────────────────────────────────
  help|*)
    cat <<'EOF'
Slack Read-Only CLI — Commands:

  Channels:
    list-channels [cursor]                          List channels
    channel-info <channel-id>                       Channel details
    channel-history <ch> [limit] [oldest] [latest]  Read messages
    thread <channel-id> <thread-ts> [limit]         Read thread replies

  Search:
    search "query" [count]                          Search messages

  Users:
    list-users [cursor]                             List workspace users
    user-info <user-id>                             User profile
    lookup-email <email>                            Find user by email

  DMs:
    list-dms [cursor]                               List DM conversations
    dm-history <dm-channel-id> [limit] [oldest] [latest]  Read DM messages

  Bookmarks:
    list-bookmarks <channel-id>                     List channel bookmarks

  Auth:
    auth-test                                       Verify token / whoami

All output is JSON. Pipe through jq for readability.
EOF
    ;;
esac
