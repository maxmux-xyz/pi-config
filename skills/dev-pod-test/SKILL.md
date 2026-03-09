---
name: dev-pod-test
description: Test code on a remote dev pod with production filesystem and secrets. Spin up a K8s pod, SSH in, checkout a branch, install deps, run scripts/agents, monitor output, collect results. Use for "test on dev pod", "run this in a pod", "test on <environment>", or when you need to validate code against real data.
metadata:
  version: 1.1.0
  category: ops
---

# Dev Pod Testing

Test code on a remote Kubernetes dev pod that has production filesystem access (FSx), secrets, and the full nebari-mvp repo.

## Security Rules — READ THESE FIRST

1. **NEVER print, log, or display secrets/credentials.** The pod has `temporal-worker-credentials` injected — never `cat ~/.env`, `env | grep KEY`, or echo any secret values.
2. **NEVER copy secrets off the pod.** Only copy output files (YAML, PNG, JSON, logs). Never `scp ~/.env` or similar.
3. **SSH uses agent forwarding (`-A`).** Your local SSH keys are forwarded to the pod for git — they are never written to disk on the pod. Do NOT create or copy SSH private keys onto the pod.
4. **NEVER expose ports beyond localhost.** Port-forwards bind to `localhost` only — never use `--address 0.0.0.0`.
5. **Always clean up.** Stop the pod when done. Pods auto-terminate after 24h but don't rely on that.

## Prerequisites

Before starting, you need:
- `kubectl` configured (the agent running locally with access to the nebari-mvp-1 repo)
- **SSH keys loaded** — run `ssh-add -L` to check, `ssh-add ~/.ssh/id_ed25519` if empty
- The repo at the working directory must be `nebari-mvp` (or a checkout of it)

## Step 1: Pick an Environment

Read the environments file to choose a target:

```bash
cat documentation/knowledge/PRODENVS.md
```

This lists all environments with their SCM, org, and codebase count. Pick one based on what you're testing.

**Environment types:**
| Environment | Type |
|-------------|------|
| `stumpy-tangerine` | staging |
| `dancing-elm` | demo |
| All others | customer (production) |

## Step 2: Switch kubectl Context

```bash
# Source the shell environment to get kprofile
source .shellrc

# Switch to the target environment
kprofile -e <environment>

# Verify
kubectl config current-context
# Should show: <environment>
```

If `kprofile` isn't available (non-interactive shell), use kubectl directly:

```bash
kubectl config use-context <environment>
# If the context doesn't exist yet:
aws eks update-kubeconfig --region us-east-1 --name eks-cluster --alias <environment> --profile "nebari-environment-profile--<environment>"
```

## Step 3: Create the Dev Pod

```bash
./nebari/python/scripts/dev-pod.sh create
```

This:
- Creates an SSH key secret from your local keys (never writes private keys to the cluster)
- Deploys a pod with Ubuntu, mise, node, git, tmux, and production mounts
- Injects the `temporal-worker-credentials` k8s secret as env vars
- Waits for the pod to be ready (~2-3 minutes)

Check status if needed:
```bash
./nebari/python/scripts/dev-pod.sh status
```

## Step 4: SSH into the Pod

```bash
# Set up port-forward and SSH in (interactive)
./nebari/python/scripts/dev-pod.sh ssh
```

For **non-interactive / agent use**, set up port-forward separately:

```bash
# Kill any stale port-forward, start fresh
pkill -f "kubectl.*port-forward.*dev-worker.*2222" 2>/dev/null || true
sleep 1
kubectl --context <environment> -n temporal port-forward pod/dev-worker 2222:22 &>/dev/null &
sleep 3

# Verify connectivity (must use -A for SSH agent forwarding)
ssh -A -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 app@localhost 'echo ok'
```

All subsequent commands run via:
```bash
ssh -A -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 app@localhost '<command>'
```

**Shorthand** — define a function for convenience:
```bash
pod() { ssh -A -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 app@localhost "$@"; }
```

**IMPORTANT**: Always use `-A` flag for SSH agent forwarding (needed for git clone).

## Step 5: Set Up the Codebase

The pod's `.profile` auto-clones `nebari-mvp` to `/app` on first **login** shell. For non-interactive SSH commands, the clone may not have happened yet. Check and clone manually if needed:

```bash
# Check if repo exists
pod 'test -d ~/app/.git && echo "CLONED" || echo "NEEDS_CLONE"'

# If NEEDS_CLONE — clone with SSH agent forwarding
pod 'GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no" git clone git@github.com:nebariai/nebari-mvp.git ~/app'
```

Checkout your branch:
```bash
pod 'cd ~/app && GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no" git fetch origin <branch> && git checkout <branch>'
```

Trust mise and install tools (required on first use):
```bash
pod 'mise trust ~/app/mise.toml && cd ~/app && eval "$(mise activate bash)" && mise install 2>&1 | tail -5'
```

Install Python dependencies:
```bash
pod 'cd ~/app && eval "$(mise activate bash)" && cd nebari/python && uv sync 2>&1 | tail -5'
```

Install extra tools if needed (e.g., Mermaid renderer for architecture graph):
```bash
pod 'cd ~/app && eval "$(mise activate bash)" && npm i -g @mermaid-js/mermaid-cli'
```

## Understanding Secrets on the Dev Pod

**This is critical — read carefully.**

The pod gets `temporal-worker-credentials` k8s secret injected as env vars. These are written to `~/.env` at pod startup and auto-sourced by `.profile` on login.

**However, most secrets are AWS Secrets Manager ARN references, not actual values:**
```
ANTHROPIC_API_KEY_SECRET_ARN=arn:aws:secretsmanager:us-east-1:...
LANGFUSE_SECRET_KEY_SECRET_ARN=arn:aws:secretsmanager:us-east-1:...
```

The actual worker pods resolve these ARNs at startup. On the dev pod, you must resolve them yourself.

### Resolution: `setup_environment_secrets()`

Call this Python function before running any script that needs API keys:

```python
from server.utils.secrets import setup_environment_secrets
setup_environment_secrets()
```

This reads all `*_SECRET_ARN` env vars, fetches the actual values from AWS Secrets Manager, and sets them as plain env vars (e.g., `ANTHROPIC_API_KEY`, `LANGFUSE_SECRET_KEY`).

### Patterns for Running Scripts

**Pattern A: Wrapper one-liner** (recommended for agent use)
```bash
pod 'cd ~/app && eval "$(mise activate bash)" && set -a && source ~/.env && set +a && cd nebari/python && ENV=<environment> uv run python -c "
from server.utils.secrets import setup_environment_secrets; setup_environment_secrets()
import subprocess, sys
sys.exit(subprocess.call([sys.executable, \"scripts/your_script.py\", \"--arg1\", \"value1\"]))
" > ~/test.log 2>&1'
```

**Pattern B: Inline import** (for scripts you control)
Add this at the top of your script (before other imports that need secrets):
```python
from server.utils.secrets import setup_environment_secrets
setup_environment_secrets()
```

**Pattern C: Tmux with secret resolution** (recommended for long-running tasks)
```bash
pod 'tmux new-session -d -s test-run "set -a && source ~/.env && eval \"\$(mise activate bash)\" && cd ~/app/nebari/python && ENV=<environment> uv run python -c \"
from server.utils.secrets import setup_environment_secrets; setup_environment_secrets()
import asyncio
from scripts.your_module import main
asyncio.run(main())
\" --arg1 value1 > ~/test.log 2>&1"'
```

**Pattern D: `nenv` wrapper** (if pod was created with updated dev-pod.yaml)
The updated dev-pod.yaml includes a `/usr/local/bin/nenv` wrapper that resolves secrets automatically:
```bash
pod 'cd ~/app/nebari/python && eval "$(mise activate bash)" && nenv uv run python scripts/your_script.py --arg1 value1'
```
This sources `.env`, resolves `*_SECRET_ARN` vars, then execs the command.

**What does NOT work:**
- The original `nenv` from `.shellrc` — requires `op` (1Password CLI) which isn't on the pod
- Running scripts directly without secret resolution — they'll get `*_SECRET_ARN` strings instead of actual API keys

## Step 6: Run Your Test

### Option A: Run a short script (with secrets)

```bash
pod 'set -a && source ~/.env && eval "$(mise activate bash)" && cd ~/app/nebari/python && ENV=<environment> uv run python -c "
from server.utils.secrets import setup_environment_secrets; setup_environment_secrets()
import subprocess, sys
sys.exit(subprocess.call([sys.executable, \"scripts/your_script.py\", \"--arg1\", \"value1\"]))
" 2>&1' | tee /tmp/test-output.log
```

### Option B: Run a long process in tmux (recommended for agents)

```bash
pod 'tmux new-session -d -s test-run "set -a && source ~/.env && eval \"\$(mise activate bash)\" && cd ~/app/nebari/python && ENV=<environment> uv run python -c \"
from server.utils.secrets import setup_environment_secrets; setup_environment_secrets()
import subprocess, sys
sys.exit(subprocess.call([sys.executable, \\\"scripts/your_script.py\\\", \\\"--arg1\\\", \\\"value1\\\"]))
\" > ~/test.log 2>&1"'
```

Check if still running:
```bash
pod 'tmux has-session -t test-run 2>/dev/null && echo "RUNNING" || echo "DONE"'
```

Tail the log:
```bash
pod 'tail -30 ~/test.log'
```

### Option C: Run interactively inside tmux (for debugging)

```bash
# SSH in interactively (login shell — .profile sources .env automatically)
./nebari/python/scripts/dev-pod.sh ssh
# Then inside the pod:
tmux new-session -s work
cd ~/app/nebari/python
# Resolve secrets first
uv run python -c "from server.utils.secrets import setup_environment_secrets; setup_environment_secrets()"
# Now run your script
uv run python scripts/your_script.py --help
```

## Step 7: Monitor Progress

```bash
# Check if tmux session is still running
pod 'tmux has-session -t test-run 2>/dev/null && echo "RUNNING" || echo "DONE"'

# Tail logs
pod 'tail -50 ~/test.log'

# Check output files
pod 'ls -lh /path/to/expected/output/'

# Check state files (for agents)
pod 'cat /path/to/STATE.json'
```

### Filesystem Paths on Pod

| Path | Content |
|------|---------|
| `~/app/` | nebari-mvp repo clone |
| `~/app/nebari/python/` | Python workspace |
| `/mnt/codebases/<scm>/<org>/` | Client codebases (read-only FSx) |
| `/mnt/codebases/knowledge/<scm>/<org>/` | Knowledge output directory |
| `/mnt/codebases/tmp/` | Temp / agent state directories |

## Step 8: Collect Results

Copy output files back to your local machine:

```bash
# Single file
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 2222 \
  app@localhost:/path/to/output/file.yaml /tmp/file.yaml

# Multiple files
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 2222 \
  app@localhost:/path/to/output/ARCHITECTURE.yaml \
  app@localhost:/path/to/output/ARCHITECTURE.png \
  /tmp/results/

# Whole directory
scp -r -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 2222 \
  app@localhost:/path/to/output/ /tmp/results/
```

**NEVER copy `.env`, secrets, credentials, or key files off the pod.**

## Step 9: Clean Up

```bash
# Stop the dev pod
./nebari/python/scripts/dev-pod.sh stop

# Or with explicit context
kubectl --context <environment> -n temporal delete pod dev-worker

# Kill local port-forward
pkill -f "kubectl.*port-forward.*dev-worker.*2222"
```

**Always clean up when done.** Pods have an 8-CPU, 16 GB memory limit and cost money.

## Known Gotchas (Read Before Starting)

These are real problems hit during dev pod testing sessions. Read them now to avoid wasting time.

### 1. Secrets are ARN references, not actual values
The pod gets `ANTHROPIC_API_KEY_SECRET_ARN` (an AWS Secrets Manager ARN), **not** `ANTHROPIC_API_KEY`. Every Python script that calls the Anthropic API will fail with "ANTHROPIC_API_KEY not set" unless you resolve secrets first. See "Understanding Secrets on the Dev Pod" above.

### 2. SSH keys must be loaded locally BEFORE anything
If `ssh-add -L` returns "no identities", agent forwarding passes nothing to the pod. Git clone will fail with "Permission denied". Always run `ssh-add ~/.ssh/id_ed25519` first.

### 3. Repo may not be cloned yet
The auto-clone is in `.profile` which runs on **login shells** only. `ssh app@localhost 'command'` is a non-login shell — the clone won't have happened. Check `test -d ~/app/.git` first.

### 4. mise needs trust + install on first use
`uv`, `node`, etc. won't be available until you run `mise trust ~/app/mise.toml && mise install`. Without this, you get `bash: command not found: uv`.

### 5. nenv doesn't work on the pod
`nenv` is defined in `.shellrc` and uses `op` (1Password CLI) which isn't on the pod. Use `setup_environment_secrets()` or the `nenv` wrapper (if the pod was created with the updated dev-pod.yaml that includes it).

### 6. Python output is buffered in tmux redirects
If you run `python script.py > ~/log.txt 2>&1` in tmux, the log file will appear stale because Python buffers stdout. Fix: set `PYTHONUNBUFFERED=1` in the environment, or use `python -u`.

### 7. mmdc needs Chromium shared libraries
`@mermaid-js/mermaid-cli` (mmdc) renders via Puppeteer/headless Chrome. The worker Dockerfile's base image has the necessary shared libs. The dev pod's `ubuntu:22.04` may not. Updated dev-pod.yaml installs Chromium deps (`libnss3`, `libgbm1`, etc.) and mmdc during setup.

## Troubleshooting

### "ANTHROPIC_API_KEY not set" or similar secret errors
Secrets aren't resolved. The pod has `*_SECRET_ARN` env vars, not actual keys. See "Understanding Secrets on the Dev Pod" above — you must call `setup_environment_secrets()` before running scripts.

### SSH connection refused
```bash
# Re-establish port-forward
pkill -f "kubectl.*port-forward.*dev-worker"
kubectl --context <environment> -n temporal port-forward pod/dev-worker 2222:22 &>/dev/null &
sleep 3
```

### Pod not found / not running
```bash
./nebari/python/scripts/dev-pod.sh status
# If gone, recreate:
./nebari/python/scripts/dev-pod.sh create
```

### Git clone fails with "Permission denied"
SSH agent forwarding isn't working. Check:
```bash
# Locally — keys must be loaded
ssh-add -L
# If empty, add your key:
ssh-add ~/.ssh/id_ed25519

# On pod — verify forwarding works
pod 'ssh-add -L'
# Should show your key. If "no identities", the -A flag is missing from your ssh command.
```

### `bash: command not found: uv` (or `mise`, `node`, etc.)
Mise tools aren't activated. Prefix your command with:
```bash
eval "$(mise activate bash)" &&
```
Or run `mise trust ~/app/mise.toml && mise install` first.

### `bash: command not found: nenv`
`nenv` uses 1Password CLI (`op`) which isn't on the pod. Use `setup_environment_secrets()` instead. See "Understanding Secrets" above.

### Port 2222 already in use
```bash
pkill -f "kubectl.*port-forward.*2222"
# Or use a different port:
kubectl --context <environment> -n temporal port-forward pod/dev-worker 2223:22 &>/dev/null &
# Then SSH with -p 2223
```

### Wrong branch on pod
```bash
pod 'cd ~/app && GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no" git fetch origin && git checkout <branch> && git pull'
pod 'cd ~/app && eval "$(mise activate bash)" && cd nebari/python && uv sync 2>&1 | tail -3'
```

## Quick Reference

| Action | Command |
|--------|---------|
| Switch context | `source .shellrc && kprofile -e <env>` |
| Create pod | `./nebari/python/scripts/dev-pod.sh create` |
| SSH (interactive) | `./nebari/python/scripts/dev-pod.sh ssh` |
| Port-forward (agent) | `kubectl --context <env> -n temporal port-forward pod/dev-worker 2222:22 &>/dev/null &` |
| Run command on pod | `ssh -A -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 app@localhost '<cmd>'` |
| Resolve secrets | `uv run python -c "from server.utils.secrets import setup_environment_secrets; setup_environment_secrets()"` |
| Check pod status | `./nebari/python/scripts/dev-pod.sh status` |
| Tail remote log | `pod 'tail -50 ~/test.log'` |
| Copy file back | `scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P 2222 app@localhost:/path /local/path` |
| Stop pod | `./nebari/python/scripts/dev-pod.sh stop` |
| Kill port-forward | `pkill -f "kubectl.*port-forward.*dev-worker.*2222"` |
