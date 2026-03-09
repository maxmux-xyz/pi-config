#!/usr/bin/env bash
# Slack Web API helper — thin curl wrapper
# Always uses SLACK_USER_TOKEN (xoxp-...) — never use bot token.
# The user token has full access to private channels, search, DMs, etc.

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
    # Usage: slack.sh list-channels [cursor]
    # Lists public channels the bot is in
    cursor="${1:-}"
    url="${BASE}/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true"
    [[ -n "$cursor" ]] && url+="&cursor=${cursor}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  channel-info)
    # Usage: slack.sh channel-info <channel-id>
    channel="${1:?channel-id required}"
    curl -sS "${BASE}/conversations.info?channel=${channel}" "${auth_header[@]}"
    ;;

  channel-history)
    # Usage: slack.sh channel-history <channel-id> [limit] [oldest-ts] [latest-ts]
    channel="${1:?channel-id required}"
    limit="${2:-20}"
    oldest="${3:-}"
    latest="${4:-}"
    url="${BASE}/conversations.history?channel=${channel}&limit=${limit}"
    [[ -n "$oldest" ]] && url+="&oldest=${oldest}"
    [[ -n "$latest" ]] && url+="&latest=${latest}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  join-channel)
    # Usage: slack.sh join-channel <channel-id>
    channel="${1:?channel-id required}"
    curl -sS -X POST "${BASE}/conversations.join" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\"}"
    ;;

  # ── Messages ────────────────────────────────────────────────────────
  send)
    # Usage: slack.sh send <channel-id> "message text"
    channel="${1:?channel-id required}"
    text="${2:?message text required}"
    curl -sS -X POST "${BASE}/chat.postMessage" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"text\":\"${text}\"}"
    ;;

  send-blocks)
    # Usage: slack.sh send-blocks <channel-id> <blocks-json> [text-fallback]
    channel="${1:?channel-id required}"
    blocks="${2:?blocks json required}"
    text="${3:-}"
    curl -sS -X POST "${BASE}/chat.postMessage" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"blocks\":${blocks},\"text\":\"${text}\"}"
    ;;

  reply)
    # Usage: slack.sh reply <channel-id> <thread-ts> "message text"
    channel="${1:?channel-id required}"
    thread_ts="${2:?thread-ts required}"
    text="${3:?message text required}"
    curl -sS -X POST "${BASE}/chat.postMessage" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"thread_ts\":\"${thread_ts}\",\"text\":\"${text}\"}"
    ;;

  thread)
    # Usage: slack.sh thread <channel-id> <thread-ts> [limit]
    channel="${1:?channel-id required}"
    thread_ts="${2:?thread-ts required}"
    limit="${3:-50}"
    curl -sS "${BASE}/conversations.replies?channel=${channel}&ts=${thread_ts}&limit=${limit}" \
      "${auth_header[@]}"
    ;;

  update)
    # Usage: slack.sh update <channel-id> <message-ts> "new text"
    channel="${1:?channel-id required}"
    ts="${2:?message-ts required}"
    text="${3:?new text required}"
    curl -sS -X POST "${BASE}/chat.update" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"ts\":\"${ts}\",\"text\":\"${text}\"}"
    ;;

  delete)
    # Usage: slack.sh delete <channel-id> <message-ts>
    channel="${1:?channel-id required}"
    ts="${2:?message-ts required}"
    curl -sS -X POST "${BASE}/chat.delete" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"ts\":\"${ts}\"}"
    ;;

  react)
    # Usage: slack.sh react <channel-id> <message-ts> <emoji-name>
    channel="${1:?channel-id required}"
    ts="${2:?message-ts required}"
    emoji="${3:?emoji name required (without colons)}"
    curl -sS -X POST "${BASE}/reactions.add" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"timestamp\":\"${ts}\",\"name\":\"${emoji}\"}"
    ;;

  # ── Search ──────────────────────────────────────────────────────────
  search)
    # Usage: slack.sh search "query" [count]
    query="${1:?query required}"
    count="${2:-20}"
    curl -sS "${BASE}/search.messages?query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${query}'))")&count=${count}" \
      "${auth_header[@]}"
    ;;

  # ── Users ───────────────────────────────────────────────────────────
  list-users)
    # Usage: slack.sh list-users [cursor]
    cursor="${1:-}"
    url="${BASE}/users.list?limit=200"
    [[ -n "$cursor" ]] && url+="&cursor=${cursor}"
    curl -sS "$url" "${auth_header[@]}"
    ;;

  user-info)
    # Usage: slack.sh user-info <user-id>
    user="${1:?user-id required}"
    curl -sS "${BASE}/users.info?user=${user}" "${auth_header[@]}"
    ;;

  lookup-email)
    # Usage: slack.sh lookup-email <email>
    email="${1:?email required}"
    curl -sS "${BASE}/users.lookupByEmail?email=${email}" "${auth_header[@]}"
    ;;

  # ── DMs ─────────────────────────────────────────────────────────────
  open-dm)
    # Usage: slack.sh open-dm <user-id>
    user="${1:?user-id required}"
    curl -sS -X POST "${BASE}/conversations.open" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"users\":\"${user}\"}"
    ;;

  dm)
    # Usage: slack.sh dm <user-id> "message text"
    # Opens a DM and sends message in one shot
    user="${1:?user-id required}"
    text="${2:?message text required}"
    # Open DM channel
    dm_response=$(curl -sS -X POST "${BASE}/conversations.open" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"users\":\"${user}\"}")
    channel=$(echo "$dm_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['channel']['id'])" 2>/dev/null)
    if [[ -z "$channel" ]]; then
      echo "$dm_response"
      exit 1
    fi
    curl -sS -X POST "${BASE}/chat.postMessage" \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"${channel}\",\"text\":\"${text}\"}"
    ;;

  # ── Files ───────────────────────────────────────────────────────────
  upload)
    # Usage: slack.sh upload <channel-id> <file-path> [title]
    channel="${1:?channel-id required}"
    filepath="${2:?file path required}"
    title="${3:-$(basename "$filepath")}"
    curl -sS -X POST "${BASE}/files.upload" \
      "${auth_header[@]}" \
      -F "channels=${channel}" \
      -F "file=@${filepath}" \
      -F "title=${title}"
    ;;

  # ── Bookmarks ───────────────────────────────────────────────────────
  list-bookmarks)
    # Usage: slack.sh list-bookmarks <channel-id>
    channel="${1:?channel-id required}"
    curl -sS "${BASE}/bookmarks.list?channel_id=${channel}" "${auth_header[@]}"
    ;;

  # ── Bot Info ────────────────────────────────────────────────────────
  auth-test)
    # Usage: slack.sh auth-test — verify token and show identity
    curl -sS "${BASE}/auth.test" "${auth_header[@]}"
    ;;

  # ── Help ────────────────────────────────────────────────────────────
  help|*)
    cat <<'EOF'
Slack API CLI — Commands:

  Channels:
    list-channels [cursor]                    List channels
    channel-info <channel-id>                 Channel details
    channel-history <ch> [limit] [oldest] [latest]  Read messages
    join-channel <channel-id>                 Join a channel

  Messages:
    send <channel-id> "text"                  Send message
    send-blocks <channel-id> <blocks-json>    Send rich message
    reply <channel-id> <thread-ts> "text"     Reply in thread
    thread <channel-id> <thread-ts> [limit]   Read thread replies
    update <channel-id> <msg-ts> "new text"   Edit message
    delete <channel-id> <msg-ts>              Delete message
    react <channel-id> <msg-ts> <emoji>       Add reaction

  Search:
    search "query" [count]                    Search messages (needs user token)

  Users:
    list-users [cursor]                       List workspace users
    user-info <user-id>                       User profile
    lookup-email <email>                      Find user by email

  DMs:
    open-dm <user-id>                         Open DM channel
    dm <user-id> "text"                       Send a DM

  Files:
    upload <channel-id> <file-path> [title]   Upload file

  Bookmarks:
    list-bookmarks <channel-id>               List channel bookmarks

  Auth:
    auth-test                                 Verify token / whoami

All output is JSON. Pipe through jq for readability.
Timestamps: Slack uses epoch.microsecond format (e.g., 1234567890.123456).
EOF
    ;;
esac
