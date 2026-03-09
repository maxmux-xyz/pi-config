---
name: nebari-debug
description: Debug data and workflow issues in remote environments. Database queries and Temporal workflow inspection. Use when user says "check the database", "query DB", "workflow failed", "workflow status", or is investigating production/staging data issues.
allowed-tools: Bash, Read
metadata:
  version: 1.0.0
  category: ops
---

## Prerequisites - Session Setup

**Before any debugging, ensure session credentials exist:**

```bash
ls -la .claude/session 2>/dev/null || echo "NO SESSION"
```

**If no session, run:**
```bash
bash .claude/scripts/session-env-setup.sh
```

Extracts credentials from 1Password for all environments (cached 8 hours).

**NEVER use single `op read` or `op` commands to fetch individual secrets.** Always run the session setup script once — all secrets for all environments will be available in `.claude/session/.env.<environment>`. The wrapper scripts (`nenv-db`, `nenv-temporal`, etc.) read from these files automatically.

## Environments - CRITICAL

**Every command requires knowing which environment you're targeting.**

Each environment is completely separate: AWS account, K8s cluster, Temporal namespace, PostgreSQL database, FSx Lustre filesystem.

| Environment | Type |
|-------------|------|
| `stumpy-tangerine` | **staging** |
| `dancing-elm` | **demo** |
| *all others* | **customer** |

**ALWAYS confirm which environment before running commands.**

If unspecified: ask the user, or look for clues in URLs (e.g., `nomadic-nutmeg.uk8cr` in Temporal URLs).

---

## 1. Database Queries

```bash
./nebari/python/scripts/nenv-db <environment> "<query>"
```

**Examples:**
```bash
./nebari/python/scripts/nenv-db stumpy-tangerine "SELECT * FROM finding WHERE id = '<uuid>'"
./nebari/python/scripts/nenv-db stumpy-tangerine "SELECT id, title, status FROM finding ORDER BY created_at DESC LIMIT 10"
./nebari/python/scripts/nenv-db stumpy-tangerine "\\dt"  # list tables
```

**Tips:**
- **Table names have no underscores:** SQLModel maps `CodebaseAnalysis` → `codebaseanalysis`, not `codebase_analysis`. When in doubt, query `information_schema.tables` or use `\dt` to list tables.
- **Quote reserved words:** `"user"` not `user`
- **Read-only queries only** (SELECT) unless explicitly told otherwise
- **Avoid dumping PII** - use LIMIT, select specific columns
- Interactive session: `./nebari/python/scripts/nenv-db stumpy-tangerine` (no query)

---

## 2. Temporal Workflows

```bash
.claude/scripts/nenv-temporal <environment> <subcommand> [args...]
```

**Common commands:**
```bash
# List failed workflows
.claude/scripts/nenv-temporal stumpy-tangerine workflow list --query "ExecutionStatus = 'Failed'"

# Describe workflow
.claude/scripts/nenv-temporal stumpy-tangerine workflow describe -w <workflow-id>

# Full event history
.claude/scripts/nenv-temporal stumpy-tangerine workflow show -w <workflow-id> --detailed
```

**Parse Temporal URLs:**
`https://cloud.temporal.io/namespaces/<env>.uk8cr/workflows/<workflow-id>/<run-id>/history`

### Query Syntax

| Attribute | Values |
|-----------|--------|
| `ExecutionStatus` | `'Running'`, `'Completed'`, `'Failed'`, `'TimedOut'` |
| `WorkflowType` | `'ExtractionBetaWorkflow'`, `'RCABetaWorkflow'`, `'RemediationWorkflow'` |
| `StartTime`, `CloseTime` | ISO 8601 timestamps |

```bash
--query "ExecutionStatus = 'Failed' AND CloseTime > '2026-01-14T16:00:00Z'"
--query "WorkflowType = 'RemediationWorkflow' AND ExecutionStatus = 'Failed'"
```

### Key Event Types
- `ActivityTaskFailed` - Activity failed (includes error)
- `ActivityTaskTimedOut` - Activity exceeded timeout
- `WorkflowTaskFailed` - Workflow logic issue

### Task Queues
- `nebari-task-queue` - Read-only (analysis, DB/S3 writes, LLM)
- `nebari-task-queue-rw` - Read-write (FSx Lustre writes: repo downloads, PR merges)
- `nebari-task-queue-chat` - Chat (low-latency interactive)

### Starting Workflows

**Check which queue first:**
```bash
grep -n "YourWorkflowName" nebari/python/worker/run_worker.py
```

```bash
.claude/scripts/nenv-temporal <env> workflow start \
  --type WorkflowName \
  --task-queue <correct-queue> \
  --input '{"field": "value"}'
```

---

## Debugging Workflow

1. **Identify environment** - ask if not specified
2. **Identify issue type:**
   - Data problem? → Database queries (this skill)
   - Workflow failure? → Temporal inspection (this skill)
   - Agent behavior? → Use `/debug-agents` for K8s state files, Langfuse traces, agent sessions
3. **Correlate across systems:**
   - Finding ID → DB record → Temporal workflow
4. **Report:** environment, commands run, findings, root cause, next steps

## Common Patterns

### Finding not processed
1. DB: `SELECT status, temporal_workflow_id FROM finding WHERE id = '<id>'`
2. Temporal: `workflow describe -w <workflow-id>`

### Workflow failed
1. `workflow describe -w <id>` → failure reason
2. `workflow show -w <id> --detailed` → failed activity
