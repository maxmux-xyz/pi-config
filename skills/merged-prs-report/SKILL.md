---
name: merged-prs-report
description: Generate markdown report of PRs merged in last 24h
allowed-tools: Bash(gh:*)
---

Generate a markdown report of all PRs merged in the past 24 hours for the current repository.

## Steps

1. Get the repository name:
   !`gh repo view --json nameWithOwner -q .nameWithOwner`

2. Fetch merged PRs from the last 24 hours using:
   ```bash
   gh pr list --state merged --limit 50 --json number,title,mergedAt,author,url
   ```

3. Filter to only include PRs where `mergedAt` is within the last 24 hours

4. Sort results by `mergedAt` in reverse chronological order (most recent first)

5. If no output path was provided, ask the user where to save the markdown file before proceeding

6. Create the markdown file at the specified location with:
   - Title: "# Merged PRs Report"
   - Repository name and date range
   - A table with columns: Merged At | PR | Author
   - PR column should have clickable links: `[#123 Title](url)`
   - Format timestamps as `YYYY-MM-DD HH:MM UTC`

## Example Output

```markdown
# Merged PRs Report

**Repository:** owner/repo
**Period:** Last 24 hours (from 2024-01-14 14:00 to 2024-01-15 14:00 UTC)

| Merged At | PR | Author |
|-----------|-----|--------|
| 2024-01-15 14:30 UTC | [#123 Fix login bug](https://github.com/owner/repo/pull/123) | @username |
| 2024-01-15 12:15 UTC | [#122 Add new feature](https://github.com/owner/repo/pull/122) | @another |
```

If no PRs were merged in the last 24 hours, state that in the report.
