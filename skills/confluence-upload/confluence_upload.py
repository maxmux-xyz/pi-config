#!/usr/bin/env python3
"""
Upload a local directory of markdown files to Confluence as a nested page tree.

Requires env vars:
  CONFLUENCE_EMAIL       - Atlassian account email
  CONFLUENCE_API_TOKEN   - API token from https://id.atlassian.com/manage-profile/security/api-tokens

Usage:
  python3 confluence_upload.py --instance nebari-ai.atlassian.net --space PM --parent-id 71499794 --dir ./artefacts
  python3 confluence_upload.py --instance nebari-ai.atlassian.net --space PM --parent-id 71499794 --delete "Artefacts"
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests

try:
    import markdown
except ImportError:
    print("Installing markdown...")
    os.system(f"{sys.executable} -m pip install markdown -q")
    import markdown


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def get_auth():
    email = os.environ.get("CONFLUENCE_EMAIL")
    token = os.environ.get("CONFLUENCE_API_TOKEN")
    if not email or not token:
        print("ERROR: Set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN environment variables.")
        print("  export CONFLUENCE_EMAIL='you@company.com'")
        print("  export CONFLUENCE_API_TOKEN='ATATT3x...'")
        print("  Generate token: https://id.atlassian.com/manage-profile/security/api-tokens")
        sys.exit(1)
    return (email, token)


# ---------------------------------------------------------------------------
# Confluence API helpers
# ---------------------------------------------------------------------------

class ConfluenceClient:
    def __init__(self, instance, space_key, auth, dry_run=False):
        self.base_url = f"https://{instance}/wiki/rest/api"
        self.space_key = space_key
        self.auth = auth
        self.dry_run = dry_run
        self.stats = {"created": 0, "skipped": 0, "failed": 0, "deleted": 0}

    def find_page(self, title):
        """Find a page by exact title in the space. Returns page ID or None."""
        params = {"title": title, "spaceKey": self.space_key, "type": "page"}
        resp = requests.get(f"{self.base_url}/content", params=params, auth=self.auth)
        if resp.status_code == 200:
            for r in resp.json().get("results", []):
                if r["title"] == title:
                    return r["id"]
        return None

    def create_page(self, title, body_html, parent_id):
        """Create a page under parent_id. Skips if title already exists."""
        existing = self.find_page(title)
        if existing:
            print(f"  ⏭  Exists: '{title}' (id={existing})")
            self.stats["skipped"] += 1
            return existing

        if self.dry_run:
            print(f"  🔍 [dry-run] Would create: '{title}' under {parent_id}")
            self.stats["created"] += 1
            return "dry-run-id"

        payload = {
            "type": "page",
            "title": title,
            "space": {"key": self.space_key},
            "ancestors": [{"id": str(parent_id)}],
            "body": {
                "storage": {
                    "value": body_html,
                    "representation": "storage",
                }
            },
        }
        resp = requests.post(
            f"{self.base_url}/content",
            json=payload,
            auth=self.auth,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code in (200, 201):
            page = resp.json()
            print(f"  ✅ Created: '{page['title']}' (id={page['id']})")
            self.stats["created"] += 1
            return page["id"]
        else:
            print(f"  ❌ Failed: '{title}' — HTTP {resp.status_code}")
            try:
                print(f"     {resp.json().get('message', resp.text[:200])}")
            except Exception:
                print(f"     {resp.text[:200]}")
            self.stats["failed"] += 1
            return None

    def delete_page(self, title):
        """Delete a page by title (cascades to children)."""
        page_id = self.find_page(title)
        if not page_id:
            print(f"  ⚠️  Page not found: '{title}'")
            return False

        if self.dry_run:
            print(f"  🔍 [dry-run] Would delete: '{title}' (id={page_id})")
            return True

        resp = requests.delete(f"{self.base_url}/content/{page_id}", auth=self.auth)
        if resp.status_code in (200, 204):
            print(f"  🗑  Deleted: '{title}' (id={page_id}) and all children")
            self.stats["deleted"] += 1
            return True
        else:
            print(f"  ❌ Failed to delete '{title}': HTTP {resp.status_code}")
            return False

    def print_stats(self):
        print(f"\n{'='*60}")
        print("RESULTS")
        print(f"  ✅ Created:  {self.stats['created']}")
        print(f"  ⏭  Skipped:  {self.stats['skipped']}")
        print(f"  ❌ Failed:   {self.stats['failed']}")
        if self.stats["deleted"]:
            print(f"  🗑  Deleted:  {self.stats['deleted']}")
        print(f"{'='*60}")


# ---------------------------------------------------------------------------
# Markdown conversion
# ---------------------------------------------------------------------------

def md_to_storage(md_content):
    """Convert markdown text to Confluence storage format (XHTML)."""
    html = markdown.markdown(
        md_content,
        extensions=["tables", "fenced_code", "codehilite", "toc", "nl2br"],
    )
    return html if html.strip() else "<p><em>Empty document</em></p>"


# ---------------------------------------------------------------------------
# Directory walker
# ---------------------------------------------------------------------------

RATE_LIMIT_DELAY = 0.3  # seconds between API calls


def pretty_title(filename_stem):
    """Convert a filename stem to a readable title."""
    return filename_stem.replace("_", " ").replace("-", " ").title()


def upload_directory(client, dir_path, parent_id, title_prefix, depth=0):
    """Recursively upload a directory as nested Confluence pages."""
    indent = "  " * depth
    dir_name = Path(dir_path).name
    print(f"\n{indent}📁 {dir_name}/")

    entries = sorted(os.listdir(dir_path))
    dirs = [e for e in entries if (Path(dir_path) / e).is_dir() and not e.startswith(".")]
    files = [e for e in entries if e.endswith(".md") and (Path(dir_path) / e).is_file()]

    # Upload markdown files as child pages
    for f in files:
        filepath = Path(dir_path) / f
        readable = pretty_title(filepath.stem)
        title = f"{title_prefix} - {readable}"

        print(f"{indent}  📄 {f}")
        with open(filepath, "r", encoding="utf-8") as fh:
            body = md_to_storage(fh.read())
        client.create_page(title, body, parent_id)
        time.sleep(RATE_LIMIT_DELAY)

    # Recurse into subdirectories
    for d in dirs:
        subdir = Path(dir_path) / d
        sub_prefix = f"{title_prefix} / {d}"
        body = f"<p>Index page for <strong>{d}</strong>.</p>"
        folder_id = client.create_page(sub_prefix, body, parent_id)
        if folder_id:
            upload_directory(client, str(subdir), folder_id, sub_prefix, depth + 1)
        time.sleep(RATE_LIMIT_DELAY)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Upload a directory of markdown files to Confluence."
    )
    parser.add_argument("--instance", required=True, help="Atlassian instance (e.g. nebari-ai.atlassian.net)")
    parser.add_argument("--space", required=True, help="Confluence space key (e.g. PM)")
    parser.add_argument("--parent-id", required=True, help="Parent page/folder ID")
    parser.add_argument("--dir", help="Local directory to upload")
    parser.add_argument("--root-title", help="Title for the root page (default: directory name)")
    parser.add_argument("--delete", metavar="TITLE", help="Delete a page tree by title instead of uploading")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")

    args = parser.parse_args()
    auth = get_auth()
    client = ConfluenceClient(args.instance, args.space, auth, dry_run=args.dry_run)

    print("=" * 60)
    if args.dry_run:
        print("🔍 DRY RUN MODE — no changes will be made")

    # --- Delete mode ---
    if args.delete:
        print(f"Deleting page tree: '{args.delete}'")
        print("=" * 60)
        client.delete_page(args.delete)
        client.print_stats()
        return

    # --- Upload mode ---
    if not args.dir:
        parser.error("--dir is required for upload mode")

    dir_path = os.path.abspath(args.dir)
    if not os.path.isdir(dir_path):
        print(f"ERROR: Not a directory: {dir_path}")
        sys.exit(1)

    root_title = args.root_title or Path(dir_path).name.title()

    print(f"Uploading: {dir_path}")
    print(f"Target:    {args.instance} → space={args.space} → parent={args.parent_id}")
    print(f"Root page: {root_title}")
    print("=" * 60)

    # Create root page
    root_body = f"<p>Root page for <strong>{root_title}</strong>.</p>"
    root_id = client.create_page(root_title, root_body, args.parent_id)
    if not root_id:
        print("ERROR: Could not create root page. Aborting.")
        sys.exit(1)

    # Process top-level subdirectories
    top_dirs = sorted([
        d for d in os.listdir(dir_path)
        if os.path.isdir(os.path.join(dir_path, d)) and not d.startswith(".")
    ])
    top_files = sorted([
        f for f in os.listdir(dir_path)
        if f.endswith(".md") and os.path.isfile(os.path.join(dir_path, f))
    ])

    # Upload any top-level .md files
    for f in top_files:
        filepath = os.path.join(dir_path, f)
        readable = pretty_title(Path(f).stem)
        title = f"{root_title} - {readable}"
        print(f"📄 {f}")
        with open(filepath, "r", encoding="utf-8") as fh:
            body = md_to_storage(fh.read())
        client.create_page(title, body, root_id)
        time.sleep(RATE_LIMIT_DELAY)

    # Process subdirectories
    for d in top_dirs:
        sub_path = os.path.join(dir_path, d)
        folder_title = d
        folder_body = f"<p>Artefacts for <strong>{d}</strong>.</p>"
        folder_id = client.create_page(folder_title, folder_body, root_id)
        if folder_id:
            upload_directory(client, sub_path, folder_id, d, depth=1)

    client.print_stats()


if __name__ == "__main__":
    main()
