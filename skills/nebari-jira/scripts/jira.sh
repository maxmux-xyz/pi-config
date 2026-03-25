#!/usr/bin/env bash
# Jira Cloud API helper — thin curl wrapper
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

  # ── Write: Create Issue ──────────────────────────────────────────────
  create-issue)
    # Usage: jira.sh create-issue <project> <issuetype> <summary> [description]
    # issuetype: Bug | Task | Story | Infra | Epic
    # Returns JSON with key, id, self
    project="${1:?project key required (e.g. EN)}"
    issuetype="${2:?issue type required (Bug|Task|Story|Infra|Epic)}"
    summary="${3:?summary required}"
    description="${4:-}"

    payload=$(jq -n \
      --arg proj "$project" \
      --arg type "$issuetype" \
      --arg sum "$summary" \
      --arg desc "$description" \
      '{
        fields: {
          project: { key: $proj },
          issuetype: { name: $type },
          summary: $sum,
          description: (if $desc != "" then {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: $desc }] }]
          } else null end)
        }
      }')

    curl -sS $auth -X POST "https://${API}/issue" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  # ── Write: Update Issue Fields ─────────────────────────────────────
  update-issue)
    # Usage: jira.sh update-issue <issue-key> <json-payload>
    # json-payload is a JSON object with fields to update
    # Example: jira.sh update-issue EN-100 '{"fields":{"labels":["auto-created"]}}'
    key="${1:?issue key required}"
    payload="${2:?JSON payload required}"

    curl -sS $auth -X PUT "https://${API}/issue/${key}" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -w "\n{\"status\": %{http_code}}"
    ;;

  # ── Write: Transition Issue ────────────────────────────────────────
  transition)
    # Usage: jira.sh transition <issue-key> <transition-id>
    # Transition IDs (get from 'transitions' command):
    #   11 = To Do, 21 = In Progress, 31 = Done
    #   2 = BLOCKED, 3 = ON-HOLD, 5 = NOT RELEVANT, 6 = WAITING-PR-REVIEW
    key="${1:?issue key required}"
    tid="${2:?transition id required}"

    curl -sS $auth -X POST "https://${API}/issue/${key}/transitions" \
      -H "Content-Type: application/json" \
      -d "{\"transition\":{\"id\":\"${tid}\"}}" \
      -w "\n{\"status\": %{http_code}}"
    ;;

  # ── Write: Assign Issue ────────────────────────────────────────────
  assign)
    # Usage: jira.sh assign <issue-key> <account-id>
    # Use 'myself' command to get your account ID
    # Use '-1' or 'unassigned' to unassign
    key="${1:?issue key required}"
    account="${2:?account-id required}"

    if [[ "$account" == "-1" ]] || [[ "$account" == "unassigned" ]]; then
      account="null"
      curl -sS $auth -X PUT "https://${API}/issue/${key}/assignee" \
        -H "Content-Type: application/json" \
        -d "{\"accountId\": null}" \
        -w "\n{\"status\": %{http_code}}"
    else
      curl -sS $auth -X PUT "https://${API}/issue/${key}/assignee" \
        -H "Content-Type: application/json" \
        -d "{\"accountId\": \"${account}\"}" \
        -w "\n{\"status\": %{http_code}}"
    fi
    ;;

  # ── Write: Add Remote Link (PR URL) ───────────────────────────────
  add-remote-link)
    # Usage: jira.sh add-remote-link <issue-key> <url> <title>
    # Adds a clickable link to the issue (e.g., GitHub PR)
    key="${1:?issue key required}"
    url="${2:?URL required}"
    title="${3:?title required}"

    payload=$(jq -n \
      --arg url "$url" \
      --arg title "$title" \
      '{
        object: {
          url: $url,
          title: $title,
          icon: {
            url16x16: "https://github.com/favicon.ico",
            title: "GitHub"
          }
        }
      }')

    curl -sS $auth -X POST "https://${API}/issue/${key}/remotelink" \
      -H "Content-Type: application/json" \
      -d "$payload"
    ;;

  # ── Write: Link Two Issues ────────────────────────────────────────
  link-issues)
    # Usage: jira.sh link-issues <inward-key> <outward-key> [link-type]
    # link-type: Relates (default), Blocks, Duplicate
    # Example: jira.sh link-issues EN-100 EN-101 Relates
    inward="${1:?inward issue key required}"
    outward="${2:?outward issue key required}"
    linktype="${3:-Relates}"

    payload=$(jq -n \
      --arg type "$linktype" \
      --arg inkey "$inward" \
      --arg outkey "$outward" \
      '{
        type: { name: $type },
        inwardIssue: { key: $inkey },
        outwardIssue: { key: $outkey }
      }')

    curl -sS $auth -X POST "https://${API}/issueLink" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -w "\n{\"status\": %{http_code}}"
    ;;

  # ── Write: Add Label ──────────────────────────────────────────────
  add-label)
    # Usage: jira.sh add-label <issue-key> <label>
    key="${1:?issue key required}"
    label="${2:?label required}"

    payload=$(jq -n --arg lbl "$label" \
      '{ update: { labels: [{ add: $lbl }] } }')

    curl -sS $auth -X PUT "https://${API}/issue/${key}" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -w "\n{\"status\": %{http_code}}"
    ;;

  # ── Help ────────────────────────────────────────────────────────────
  help|*)
    cat <<'EOF'
Jira CLI — Commands:

  Identity:
    myself                                          Your account info

  Projects:
    projects                                        List all projects
    project <key>                                   Project details

  Search:
    search "JQL" [max] [fields]                     Search issues with JQL

  Issues (read):
    issue <key> [fields]                            Full issue details
    comments <key> [max]                            Issue comments
    transitions <key>                               Available transitions
    changelog <key> [max]                           Issue change history

  Issues (write):
    create-issue <project> <type> <summary> [desc]  Create issue (Bug|Task|Story|Infra|Epic)
    update-issue <key> <json-payload>               Update issue fields
    transition <key> <transition-id>                Change issue status
    assign <key> <account-id>                       Assign issue (or 'unassigned')
    add-label <key> <label>                         Add label to issue
    add-remote-link <key> <url> <title>             Add external link (e.g. GitHub PR)
    link-issues <inward> <outward> [type]           Link two issues (Relates|Blocks|Duplicate)

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

  Transition IDs:
    11 = To Do, 21 = In Progress, 31 = Done
    2 = BLOCKED, 3 = ON-HOLD, 5 = NOT RELEVANT, 6 = WAITING-PR-REVIEW

  All output is JSON. Pipe through jq for readability.
  JQL reference: https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jql/
EOF
    ;;
esac
