---
name: search-vault
description: Search Maxime's Obsidian vault with QMD. Use when answering questions that may depend on Maxime's notes, Nebari context, research bundles, tasks, investing notes, personal memory, or prior captured sources.
---

# search-vault

Use QMD to search `/Users/maxime/dev/obsidianvault`.

QMD collection:

```text
obsidianvault
```

Index location:

```text
/Users/maxime/.cache/qmd/index.sqlite
```

## When to use

Use this skill before answering when the user asks about:

- Maxime's notes, memory, interests, projects, tasks, or preferences
- Nebari context, architecture, product, research applicability
- prior research captures in `RESEARCH/`
- Obsidian vault content
- saved YouTube/article/paper summaries
- investing/strategy notes
- “what did I write about X?”
- “find notes on X”
- “summarize my notes about X”

If the answer could be in the vault, search first.

## Commands

### Check index health

```bash
qmd status
```

### Fast keyword search

Use for exact terms, filenames, names, systems, paths.

```bash
qmd search "query terms" -c obsidianvault -n 10 --files
```

### Semantic search

Use for concepts where exact terms may differ.

```bash
qmd vsearch "natural language concept" -c obsidianvault -n 10 --files
```

### Best search

Use for broad questions. Hybrid BM25 + vector + query expansion/reranking.

```bash
qmd query "natural language question" -c obsidianvault -n 10 --files
```

### Read a result

```bash
qmd get qmd://obsidianvault/path/to/file.md
```

Limit output when needed:

```bash
qmd get qmd://obsidianvault/path/to/file.md -l 120
```

### Read multiple files

```bash
qmd multi-get "RESEARCH/*/summary.md" -c obsidianvault --md
```

## Search workflow

1. Start with `qmd query` for broad recall.
2. Use `qmd search` for exact names/paths if hybrid misses.
3. Use `qmd get` on the top relevant results.
4. Cross-check at least 2 sources for synthesis questions.
5. Cite vault paths in the answer.

## Output style

When using vault results, include:

```text
Sources:
- path/to/file.md
- path/to/other.md
```

Keep summaries grounded in retrieved notes. Do not invent vault content.

## Maintenance

Refresh index after major vault edits:

```bash
qmd update
qmd embed
```
