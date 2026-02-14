---
name: confluence-upload
description: Upload a local directory of markdown files to Confluence as a nested page tree. Converts markdown to Confluence storage format, mirrors directory structure, and handles title uniqueness. Requires CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN env vars.
---

# Confluence Upload Skill

Upload a directory of `.md` files to a Confluence space as a nested page hierarchy.

---

## Prerequisites

Environment variables in `~/.zshrc` (or equivalent):

```bash
export CONFLUENCE_API_TOKEN="ATATT3x..."   # https://id.atlassian.com/manage-profile/security/api-tokens
export CONFLUENCE_EMAIL="you@company.com"
```

Python dependencies (installed automatically by the script if missing): `markdown`, `requests`.

---

## How It Works

1. **Directory structure → Page tree**: Each subdirectory becomes a parent page; each `.md` file becomes a child page.
2. **Title uniqueness**: Confluence requires unique titles per space. Titles are prefixed with their parent path (e.g., `buzzing-birch / BigID - Architecture`).
3. **Markdown → Confluence storage format**: Markdown is converted to XHTML via the `markdown` library (supports tables, fenced code, TOC).
4. **Idempotent**: Re-running skips pages that already exist (matched by title).

---

## Usage

### Step 1: Identify the target

Get the **parent page/folder ID** and **space key** from the Confluence URL:

```
https://<instance>.atlassian.net/wiki/spaces/<SPACE_KEY>/folder/<PARENT_ID>
https://<instance>.atlassian.net/wiki/spaces/<SPACE_KEY>/pages/<PARENT_ID>
```

### Step 2: Run the upload script

```bash
python3 <skill_dir>/confluence_upload.py \
  --instance <instance>.atlassian.net \
  --space <SPACE_KEY> \
  --parent-id <PARENT_ID> \
  --dir <path/to/directory> \
  [--root-title "My Root Page"] \
  [--dry-run]
```

**Arguments:**

| Arg | Required | Description |
|-----|----------|-------------|
| `--instance` | Yes | Atlassian instance (e.g. `nebari-ai.atlassian.net`) |
| `--space` | Yes | Confluence space key (e.g. `PM`) |
| `--parent-id` | Yes | ID of the parent page or folder |
| `--dir` | Yes | Local directory to upload |
| `--root-title` | No | Title for the root page (defaults to directory name) |
| `--dry-run` | No | Preview what would be created without making API calls |

### Step 3: Verify

Check the Confluence page tree in the browser to confirm structure and content.

---

## Cleanup

To delete an uploaded tree, delete the root page in Confluence — child pages are deleted recursively.

Or use the script's `--delete` flag:

```bash
python3 <skill_dir>/confluence_upload.py \
  --instance <instance>.atlassian.net \
  --space <SPACE_KEY> \
  --parent-id <PARENT_ID> \
  --delete "Root Page Title"
```

---

## Example

```bash
# Upload artefacts/ to the KNOWLEDGE folder in Product Management space
python3 ~/.pi/agent/skills/confluence-upload/confluence_upload.py \
  --instance nebari-ai.atlassian.net \
  --space PM \
  --parent-id 71499794 \
  --dir ./artefacts \
  --root-title "Artefacts"
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | Check `CONFLUENCE_EMAIL` and `CONFLUENCE_API_TOKEN` env vars |
| `404 Not Found` | Verify the `--parent-id` exists and you have access |
| `Title already exists` | Page is skipped (idempotent). Delete from Confluence if you want to recreate |
| Markdown rendering issues | The conversion is best-effort; complex Markdown (e.g. nested tables, HTML) may need manual cleanup |
