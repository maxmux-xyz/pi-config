---
name: slack-read
description: Read-only access to Slack workspaces via the Web API. List channels, read messages, search, browse threads, read DMs, and look up users. Use when the user asks to check Slack, read a channel, search Slack messages, or anything involving reading Slack content.
---

# Slack Read

Read-only Slack access using a User OAuth Token (`xoxp-...`). No bot required — reads as your user account.

## Prerequisites

Add your **User OAuth Token** to `~/.zshrc`:

```bash
export SLACK_USER_TOKEN="xoxp-..."
```

### Required User Token Scopes

- `channels:read`, `channels:history`
- `groups:read`, `groups:history` (private channels)
- `users:read`
- `search:read`
- `im:history` (for DMs)
- `bookmarks:read` (optional)

## Usage

All commands go through the helper script:

```bash
bash <skill_dir>/scripts/slack-read.sh <command> [args...]
```

All output is JSON. Pipe through `jq` for readability.

## Commands Reference

### Channels

```bash
# List channels you're a member of
bash <skill_dir>/scripts/slack-read.sh list-channels

# Get channel details
bash <skill_dir>/scripts/slack-read.sh channel-info <channel-id>

# Read recent messages (default 20)
bash <skill_dir>/scripts/slack-read.sh channel-history <channel-id>
bash <skill_dir>/scripts/slack-read.sh channel-history <channel-id> 50

# Read messages in a time range (Unix timestamps)
bash <skill_dir>/scripts/slack-read.sh channel-history <channel-id> 50 <oldest-ts> <latest-ts>

# Read thread replies
bash <skill_dir>/scripts/slack-read.sh thread <channel-id> <thread-ts>
```

### Search

```bash
bash <skill_dir>/scripts/slack-read.sh search "query" 10
```

### Users

```bash
bash <skill_dir>/scripts/slack-read.sh list-users
bash <skill_dir>/scripts/slack-read.sh user-info <user-id>
bash <skill_dir>/scripts/slack-read.sh lookup-email alice@company.com
```

### DMs

```bash
# List open DM conversations
bash <skill_dir>/scripts/slack-read.sh list-dms

# Read DM messages
bash <skill_dir>/scripts/slack-read.sh dm-history <dm-channel-id> 20
```

### Bookmarks

```bash
bash <skill_dir>/scripts/slack-read.sh list-bookmarks <channel-id>
```

### Auth

```bash
bash <skill_dir>/scripts/slack-read.sh auth-test
```

## IDs and Timestamps

- **Channel IDs**: Start with `C` (public) or `G` (private). Find via `list-channels`.
- **User IDs**: Start with `U`. Find via `list-users` or `lookup-email`.
- **Message timestamps**: Epoch with microseconds (e.g., `1708300000.123456`).
- **Thread timestamps**: Same as the parent message's timestamp.

## Common Workflows

### Find a channel and read recent messages

```bash
# 1. Find the channel
bash <skill_dir>/scripts/slack-read.sh list-channels | jq '.channels[] | select(.name | contains("eng")) | {id, name}'

# 2. Read messages
bash <skill_dir>/scripts/slack-read.sh channel-history C0123ABCD 10 | jq '.messages[] | {ts, user, text}'
```

### Search for a topic

```bash
bash <skill_dir>/scripts/slack-read.sh search "deployment failed" 10 | jq '.messages.matches[] | {channel: .channel.name, text, ts}'
```

### Read recent DMs

```bash
# 1. List DM conversations
bash <skill_dir>/scripts/slack-read.sh list-dms | jq '.channels[] | {id, user}'

# 2. Read messages from a DM
bash <skill_dir>/scripts/slack-read.sh dm-history D0123ABCD 10 | jq '.messages[] | {ts, user, text}'
```
