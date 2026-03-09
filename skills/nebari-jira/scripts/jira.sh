#!/usr/bin/env bash
# Jira Cloud API helper — read-only, thin curl wrapper
# Reuses Confluence credentials (same Atlassian API token)
# Requires: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN env vars

set -euo pipefail

EMAIL="${CONFLUENCE_EMAIL:-}"
TOKEN="${CONFLUENCE_API_TOKEN:-}"

if [[ -z "$EMAIL" ]] || [[ -z "$TOKEN" ]]; then
  echo "ERROR: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN must be set. Add to ~/.zshrc:" >&2
  echo '  export CONFLUENCE_EMAIL="you@company.com"' >&2
  echo '  export CONFLUENCE_API_TOKEN="ATATT3x..."' >&2
  exit 1
fi

INSTANCE="${JIRA_INSTANCE:-nebari-ai.atlassian.net}"
API="${INSTANCE}/rest/api/3"
AGILE="${INSTANCE}/rest/agile/1.0"

auth="-u ${EMAIL}:${TOKEN}"

cmd="${1:-help}"
shift || true

case "$cmd" in

  # ── Identity ────────────────────────────────────────────────────────
  myself)
    # Usage: jira.sh myself
    curl -sS $auth "https://${API}/myself"
    ;;

  # ── Projects ────────────────────────────────────────────────────────
  projects)
    # Usage: jira.sh projects
    curl -sS $auth "https://${API}/project?expand=lead"
    ;;

  project)
    # Usage: jira.sh project <project-key>
    key="${1:?project key required (e.g. EN)}"
    curl -sS $auth "https://${API}/project/${key}"
    ;;

  # ── Search (JQL) ───────────────────────────────────────────────────
  search)
    # Usage: jira.sh search "JQL query" [maxResults] [fields]
    jql="${1:?JQL query required}"
    max="${2:-20}"
    fields="${3:-summary,status,assignee,priority,issuetype,created,updated,labels,reporter}"
    curl -sS $auth --get "https://${API}/search/jql" \
      --data-urlencode "jql=${jql}" \
      --data-urlencode "maxResults=${max}" \
      --data-urlencode "fields=${fields}"
    ;;

  # ── Issues ──────────────────────────────────────────────────────────
  issue)
    # Usage: jira.sh issue <issue-key> [fields]
    key="${1:?issue key required (e.g. EN-84)}"
    fields="${2:-summary,status,assignee,priority,issuetype,description,created,updated,labels,reporter,comment,subtasks,parent,fixVersions,components}"
    curl -sS $auth --get "https://${API}/issue/${key}" \
      --data-urlencode "fields=${fields}"
    ;;

  comments)
    # Usage: jira.sh comments <issue-key> [maxResults]
    key="${1:?issue key required}"
    max="${2:-25}"
    curl -sS $auth "https://${API}/issue/${key}/comment?maxResults=${max}&orderBy=-created"
    ;;

  transitions)
    # Usage: jira.sh transitions <issue-key>
    # Shows available status transitions (read-only, doesn't change anything)
    key="${1:?issue key required}"
    curl -sS $auth "https://${API}/issue/${key}/transitions"
    ;;

  changelog)
    # Usage: jira.sh changelog <issue-key> [maxResults]
    key="${1:?issue key required}"
    max="${2:-20}"
    curl -sS $auth "https://${API}/issue/${key}/changelog?maxResults=${max}"
    ;;

  # ── Boards ──────────────────────────────────────────────────────────
  boards)
    # Usage: jira.sh boards [project-key]
    project="${1:-}"
    url="https://${AGILE}/board?maxResults=50"
    [[ -n "$project" ]] && url+="&projectKeyOrId=${project}"
    curl -sS $auth "$url"
    ;;

  board-config)
    # Usage: jira.sh board-config <board-id>
    board="${1:?board-id required}"
    curl -sS $auth "https://${AGILE}/board/${board}/configuration"
    ;;

  # ── Sprints ─────────────────────────────────────────────────────────
  sprints)
    # Usage: jira.sh sprints <board-id> [state]
    # state: active, closed, future (default: active)
    board="${1:?board-id required}"
    state="${2:-active}"
    curl -sS $auth "https://${AGILE}/board/${board}/sprint?state=${state}&maxResults=20"
    ;;

  sprint-issues)
    # Usage: jira.sh sprint-issues <sprint-id> [maxResults] [fields]
    sprint="${1:?sprint-id required}"
    max="${2:-50}"
    fields="${3:-summary,status,assignee,priority,issuetype,story_points,labels}"
    curl -sS $auth --get "https://${AGILE}/sprint/${sprint}/issue" \
      --data-urlencode "maxResults=${max}" \
      --data-urlencode "fields=${fields}"
    ;;

  # ── Backlog ─────────────────────────────────────────────────────────
  backlog)
    # Usage: jira.sh backlog <board-id> [maxResults]
    board="${1:?board-id required}"
    max="${2:-50}"
    curl -sS $auth "https://${AGILE}/board/${board}/backlog?maxResults=${max}&fields=summary,status,assignee,priority,issuetype,labels"
    ;;

  # ── Users ───────────────────────────────────────────────────────────
  user)
    # Usage: jira.sh user <account-id>
    id="${1:?account-id required}"
    curl -sS $auth --get "https://${API}/user" \
      --data-urlencode "accountId=${id}"
    ;;

  find-users)
    # Usage: jira.sh find-users "display name or email"
    query="${1:?query required}"
    curl -sS $auth --get "https://${API}/user/search" \
      --data-urlencode "query=${query}" \
      --data-urlencode "maxResults=10"
    ;;

  assignable)
    # Usage: jira.sh assignable <project-key>
    # List users assignable to issues in a project
    project="${1:?project key required}"
    curl -sS $auth --get "https://${API}/user/assignable/search" \
      --data-urlencode "project=${project}" \
      --data-urlencode "maxResults=50"
    ;;

  # ── Statuses & Types ───────────────────────────────────────────────
  statuses)
    # Usage: jira.sh statuses <project-key>
    project="${1:?project key required}"
    curl -sS $auth "https://${API}/project/${project}/statuses"
    ;;

  issue-types)
    # Usage: jira.sh issue-types <project-key>
    project="${1:?project key required}"
    curl -sS $auth "https://${API}/issue/createmeta/${project}/issuetypes"
    ;;

  # ── Priorities & Labels ────────────────────────────────────────────
  priorities)
    # Usage: jira.sh priorities
    curl -sS $auth "https://${API}/priority"
    ;;

  labels)
    # Usage: jira.sh labels [prefix]
    prefix="${1:-}"
    url="https://${API}/label?maxResults=100"
    [[ -n "$prefix" ]] && url+="&startAt=0" # labels endpoint doesn't filter, just list
    curl -sS $auth "$url"
    ;;

  # ── Help ────────────────────────────────────────────────────────────
  help|*)
    cat <<'EOF'
Jira Read-Only CLI — Commands:

  Identity:
    myself                                          Your account info

  Projects:
    projects                                        List all projects
    project <key>                                   Project details

  Search:
    search "JQL" [max] [fields]                     Search issues with JQL

  Issues:
    issue <key> [fields]                            Full issue details
    comments <key> [max]                            Issue comments
    transitions <key>                               Available transitions
    changelog <key> [max]                           Issue change history

  Boards:
    boards [project-key]                            List boards
    board-config <board-id>                         Board configuration

  Sprints:
    sprints <board-id> [state]                      List sprints (active|closed|future)
    sprint-issues <sprint-id> [max] [fields]        Issues in a sprint

  Backlog:
    backlog <board-id> [max]                        Backlog issues

  Users:
    user <account-id>                               User details
    find-users "name or email"                      Search users
    assignable <project-key>                        Assignable users

  Statuses & Types:
    statuses <project-key>                          Issue statuses
    issue-types <project-key>                       Issue types
    priorities                                      Priority levels
    labels [prefix]                                 All labels

  All output is JSON. Pipe through jq for readability.
  JQL reference: https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jql/
EOF
    ;;
esac
