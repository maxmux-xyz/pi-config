---
name: slack
description: Send messages, read channels, search, and interact with Slack workspaces via the Slack Web API. Use when the user asks to check Slack, send a message, read a channel, search Slack, post an update, or anything involving Slack.
---

# Slack

Interact with a Slack workspace via the Web API using a zero-dependency bash script.

## Prerequisites

**Always use the user token — never the bot token.**

Add your **User OAuth Token** to `~/.zshrc`:

```bash
export SLACK_USER_TOKEN="xoxp-..."
```

The user token has full access to private channels, search, DMs, etc. without needing bot invitations.

### Creating a Slack App

1. Go to <https://api.slack.com/apps> → Create New App → From Scratch
2. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `channels:read`, `channels:history`, `channels:join`
   - `groups:read`, `groups:history` (private channels)
   - `chat:write`
   - `reactions:write`
   - `users:read`, `users:read.email`
   - `files:write` (for uploads)
   - `bookmarks:read`
   - `im:write`, `im:history` (for DMs)
3. For search, add **User Token Scopes**: `search:messages`
4. Install to workspace → copy the **Bot User OAuth Token** (`xoxb-...`)
5. Invite the bot to channels: `/invite @YourBotName`

## Usage

All commands go through the helper script:

```bash
bash <skill_dir>/scripts/slack.sh <command> [args...]
```

All output is JSON. Pipe through `jq` for readability:

```bash
bash <skill_dir>/scripts/slack.sh list-channels | jq '.channels[] | {id, name}'
```

## Commands Reference

### Channels

```bash
# List channels (bot must be a member or channel must be public)
bash <skill_dir>/scripts/slack.sh list-channels

# Get channel details
bash <skill_dir>/scripts/slack.sh channel-info <channel-id>

# Read recent messages (default 20)
bash <skill_dir>/scripts/slack.sh channel-history <channel-id>
bash <skill_dir>/scripts/slack.sh channel-history <channel-id> 50

# Read messages in a time range (Unix timestamps)
bash <skill_dir>/scripts/slack.sh channel-history <channel-id> 50 1708300000 1708400000

# Join a public channel
bash <skill_dir>/scripts/slack.sh join-channel <channel-id>
```

### Send Messages

```bash
# Simple text message
bash <skill_dir>/scripts/slack.sh send <channel-id> "Hello from the agent :robot_face:"

# Rich message with Block Kit
bash <skill_dir>/scripts/slack.sh send-blocks <channel-id> '[
  {"type":"header","text":{"type":"plain_text","text":"Deploy Complete"}},
  {"type":"section","text":{"type":"mrkdwn","text":"*Status:* :white_check_mark: Success\n*Branch:* main"}}
]' "Deploy Complete"

# Reply in a thread
bash <skill_dir>/scripts/slack.sh reply <channel-id> <thread-ts> "Thread reply here"

# Read thread replies
bash <skill_dir>/scripts/slack.sh thread <channel-id> <thread-ts>
```

### Edit / Delete / React

```bash
# Edit a message (need the message timestamp)
bash <skill_dir>/scripts/slack.sh update <channel-id> <message-ts> "Updated text"

# Delete a message
bash <skill_dir>/scripts/slack.sh delete <channel-id> <message-ts>

# Add a reaction (emoji name without colons)
bash <skill_dir>/scripts/slack.sh react <channel-id> <message-ts> thumbsup
```

### Search

**Requires `SLACK_USER_TOKEN`** (search is not available with bot tokens):

```bash
bash <skill_dir>/scripts/slack.sh search "deployment failed" 10
```

### Users

```bash
# List all workspace users
bash <skill_dir>/scripts/slack.sh list-users

# Get user profile
bash <skill_dir>/scripts/slack.sh user-info <user-id>

# Find user by email
bash <skill_dir>/scripts/slack.sh lookup-email alice@company.com
```

### Direct Messages

```bash
# Open a DM channel (returns channel ID)
bash <skill_dir>/scripts/slack.sh open-dm <user-id>

# Send a DM (opens channel automatically)
bash <skill_dir>/scripts/slack.sh dm <user-id> "Hey, the deploy finished!"
```

### Files

```bash
# Upload a file to a channel
bash <skill_dir>/scripts/slack.sh upload <channel-id> /tmp/report.csv "Weekly Report"
```

### Auth / Identity

```bash
# Verify token and see bot identity
bash <skill_dir>/scripts/slack.sh auth-test
```

## IDs and Timestamps

- **Channel IDs**: Start with `C` (public) or `G` (private). Find them in channel URLs or via `list-channels`.
- **User IDs**: Start with `U`. Find via `list-users` or `lookup-email`.
- **Message timestamps**: Epoch with microseconds (e.g., `1708300000.123456`). Uniquely identifies a message in a channel.
- **Thread timestamps**: Same as the parent message's timestamp.

## Common Workflows

### Find a channel and read recent messages

```bash
# 1. Find the channel
bash <skill_dir>/scripts/slack.sh list-channels | jq '.channels[] | select(.name | contains("deploy")) | {id, name}'

# 2. Read messages
bash <skill_dir>/scripts/slack.sh channel-history C0123ABCD 10 | jq '.messages[] | {ts, user, text}'
```

### Post a status update

```bash
bash <skill_dir>/scripts/slack.sh send C0123ABCD ":rocket: Deploy v2.3.1 complete — all checks passed"
```

### Monitor a channel for recent activity

```bash
# Messages from the last hour
OLDEST=$(python3 -c "import time; print(time.time() - 3600)")
bash <skill_dir>/scripts/slack.sh channel-history C0123ABCD 100 "$OLDEST" | jq '.messages | length'
```

### DM someone a quick update

```bash
# Find the user
bash <skill_dir>/scripts/slack.sh lookup-email alice@company.com | jq '.user.id'

# Send them a DM
bash <skill_dir>/scripts/slack.sh dm U0123ABCD "Hey — the PR is ready for review"
```

## Slack Message Formatting (mrkdwn)

Slack uses its own markdown variant:

| Format | Syntax |
|--------|--------|
| Bold | `*bold*` |
| Italic | `_italic_` |
| Strike | `~strike~` |
| Code | `` `code` `` |
| Code block | ` ```code``` ` |
| Link | `<https://url\|display text>` |
| User mention | `<@U0123ABCD>` |
| Channel mention | `<#C0123ABCD>` |
| Emoji | `:emoji_name:` |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `invalid_auth` | Check `SLACK_BOT_TOKEN` env var |
| `channel_not_found` | Bot not in the channel — invite it or use `join-channel` |
| `not_in_channel` | Bot needs to join first: `join-channel` or `/invite @bot` |
| `missing_scope` | App needs additional OAuth scopes — update in Slack app settings |
| `cant_delete_message` | Can only delete bot's own messages (unless admin) |
| `search` returns errors | Search requires `SLACK_USER_TOKEN` (xoxp-), not a bot token |
