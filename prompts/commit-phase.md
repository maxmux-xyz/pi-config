---
description: Commit staged files with a concise phase description
---
First, check if there are any staged files:
```bash
git diff --cached --name-only
```

If there are NO staged files, STOP immediately and tell me:
"No staged files. Run `git add <files>` to stage your changes first."

If there ARE staged files:
1. Review the staged diff to understand what changed:
   ```bash
   git diff --cached
   ```
2. Create a commit with a SIMPLE, 1-line message that:
   - Is a short phrase or sentence fragment (forgo grammar)
   - Pointedly and explicitly describes the changes
   - Examples: "validation agent prompts", "refactor auth middleware", "fix token expiry edge case"
   - NO conventional commit prefixes (feat:, fix:, etc.)
   - NO verbose descriptions

3. Run the commit:
   ```bash
   git commit -m "<your concise message>"
   ```

4. DO NOT push. Just confirm the commit was created.
