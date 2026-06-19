---
name: nebari-debug
description: Debug data and workflow issues in remote environments. Database queries and Temporal workflow inspection. Use when user says "check the database", "query DB", "workflow failed", "workflow status", or is investigating production/staging data issues.
allowed-tools: Bash, Read
metadata:
  version: 1.1.0
  category: ops
---

## Prerequisites

**Database access uses `ndb psql` directly — no setup or `ndb up` needed.**

Source the repo shellrc first so `ndb` and its helpers resolve in a fresh Bash shell, then run the query:

```bash
source .shellrc && ndb psql <env> --query "..."
```

Without `source .shellrc`, `ndb psql` errors with `command not found: _ndb_getenv` and an empty-`NDB_DOMAIN` DNS failure.

If it fails, **pause and ask the human** rather than running setup commands. Only the human's terminal can complete `ndb setup` (requires sudo).

**Temporal and kubectl** use session credentials from `.claude/session/`. If missing:
```bash
bash .claude/scripts/session-env-setup.sh
```

**NEVER use single `op read` or `op` commands to fetch individual secrets.** Always run the session setup script once — all secrets for all environments will be available in `.claude/session/.env.<environment>`. The wrapper scripts (`nenv-temporal`, etc.) read from these files automatically.

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

## 1. Kubernetes / kubectl Access

**Switch kubectl context to an environment:**
```bash
aws eks update-kubeconfig --region us-east-1 --name eks-cluster --alias <environment> --profile "nebari-environment-profile--<environment>"
```

All environments are in `us-east-1`. After switching, all `kubectl` commands target that environment's cluster.

**Common kubectl commands after switching:**
```bash
# List worker pods
kubectl get pods -n temporal

# Exec into RW worker to inspect FSx
kubectl exec -n temporal deployment/temporal-workers-rw -c temporal-worker -- bash -c '<command>'

# Check FSx filesystem
kubectl exec -n temporal deployment/temporal-workers-rw -c temporal-worker -- ls /mnt/codebases/
```

---

## 2. Database Queries

**Run queries directly — no `ndb up` needed.** Source `.shellrc` once per Bash invocation so the `ndb` helpers resolve:
```bash
source .shellrc && ndb psql <environment> --query "SELECT * FROM finding WHERE id = '<uuid>'"
source .shellrc && ndb psql <environment> --query "SELECT id, title, status FROM finding ORDER BY created_at DESC LIMIT 10"
source .shellrc && ndb psql <environment> --query "\dt"  # list tables
```

If a query fails (e.g., `ndb is not set up`, missing setup), **stop and ask the human to run `ndb setup` in their terminal**. Do not attempt setup yourself — it requires sudo.

**Tips:**
- **Table names have no underscores:** SQLModel maps `CodebaseAnalysis` → `codebaseanalysis`, not `codebase_analysis`. When in doubt, query `information_schema.tables` or use `\dt` to list tables.
- **Quote reserved words:** `"user"` not `user`
- **Read-only queries only** (SELECT) unless explicitly told otherwise
- **Avoid dumping PII** - use LIMIT, select specific columns

---

## 2b. Running Python Scripts Against an Env DB

Use the `nenv` shell function — it execs with session-cached env vars for the target env:

```bash
ENV=<env> nenv python <path/to/script.py> [--dry-run]
```

Example:
```bash
ENV=curious-cedar nenv python nebari/python/scripts/backfill_finding_code_owners.py --dry-run
```

Notes:
- DB name is usually `nebari_eval_stg` for remote environments.
- `DATABASE_URL` contains `?iam_hostname_override=...` — the real RDS endpoint used for IAM auth signing (the old `DATABASE_IAM_HOSTNAME` env var is gone).
- **Always prefer `--dry-run` first** for any script that writes.

---

## 3. Temporal Workflows

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
1. DB: `ndb psql <env> --query "SELECT status, temporal_workflow_id FROM finding WHERE id = '<id>'"`
2. Temporal: `workflow describe -w <workflow-id>`

### Workflow failed
1. `workflow describe -w <id>` → failure reason
2. `workflow show -w <id> --detailed` → failed activity
