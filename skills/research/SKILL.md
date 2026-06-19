---
name: research
description: Capture an article, paper, PDF, YouTube video, or other source into the Obsidian vault as a structured research bundle (summary + highlights + citations, optionally Nebari applicability). Use when the user shares a URL/PDF/video and asks to "summarize", "research", "capture this", "make notes", "save this article", "what do you think of this", "anything I can use from this", or drops a link with intent to study it.
---

# research

Turn an external source into a structured research folder under `<vault>/RESEARCH/<timestamp>-<slug>/`.

## Output

```
RESEARCH/<timestamp>-<slug>/
├── source.md       — metadata + index (always)
├── summary.md      — structured summary (always)
├── highlights.md   — punchy one-liners (always)
├── citations.md    — longer excerpts for citing (always)
└── recs.md         — applicability to Maxime's work (conditional — see below)
```

Default vault: `/Users/maxime/dev/obsidianvault`.

## Inputs accepted

- **Article / blog URL** → `WebFetch`
- **arXiv / paper URL or PDF** → `WebFetch` for HTML pages, `Read` for local PDFs (use the `pdf` skill if extraction is non-trivial)
- **YouTube URL** → first run `yt-transcript` to land the transcript at `YT/<title-slug>/transcript.md`, then process *that* transcript here. The research bundle still goes under `RESEARCH/<YYYY-MM-DD-HHMM>-<slug>/` and links to the transcript.
- **Public GitHub repo** → `WebFetch` the README (and any obvious deep-dive docs: `ARCHITECTURE.md`, `docs/`, design notes). Goal: understand what it does, then in `recs.md` evaluate (a) usable in a personal project, (b) usable in/for Nebari, (c) parts worth lifting/porting even if the whole repo isn't a fit. Note language, license, activity (last commit, stars-as-signal not gospel), and any standout components (e.g. a clever prompt, a CLI pattern, a schema).
- **Raw text / pasted content** → use directly
- **Local file** (`.md`, `.txt`, `.pdf`) → `Read`

If the input type is ambiguous, ask once.

## When to write `recs.md`

Conditional on topic relevance. Maxime's interests (see `/Users/maxime/dev/obsidianvault/MAXIME.md`):
- **AI** — agent engineering, models, training, harnessing
- **AI infrastructure** — chips, data centers, memory
- **Energy** — solar, turbines, grid, AI×energy intersection
- **Cybersecurity** — vuln research, bug bounty, AI in offense/defense
- **Markets / investing** — stock market, public equities, macro, sector theses, portfolio strategy, AI-infra/power/memory/hyperscaler tickers. See `/Users/maxime/dev/obsidianvault/STONKS/instruction.md` and `/Users/maxime/dev/obsidianvault/STONKS/STRATEGY/STRATEGY.md`.

**Write `recs.md` when** the source touches any of those — frame applicability through Nebari (`/Users/maxime/dev/obsidianvault/NEBARI.md`) when the topic is AI/agents/cyber, or through the STONKS investing lens when it's chips/energy/markets/public equities.

**Skip `recs.md` when** the source is pure news, geopolitics, personal admin, history, etc. with no hook into the above. In that case, drop the file entirely — don't write a stub.

If unsure, lean toward writing it — Maxime can always delete.

## Steps

### 1. Fetch the source

Pick the right tool for the input type. For web articles, use `WebFetch` and ask for the *full* content in your prompt — you'll need the actual text to extract real citations, not a meta-summary.

For long sources (papers, transcripts), do a structured first pass: ask the fetch tool for sections/headings, then a second pass for verbatim passages tied to those headings.

### 2. Search existing vault context

Before writing, use the `search-vault` skill / QMD to find related prior notes in `/Users/maxime/dev/obsidianvault`.

Search by title, author, topic, company/ticker, sector, and thesis keywords. Prefer:
- `RESEARCH/` prior research bundles
- `STONKS/research/` and `STONKS/daily/` for markets/investing topics
- `NEBARI.md`, `MAXIME.md`, and Nebari notes for AI/agents/cyber topics

Read the top relevant results, at least 2 when available. Decide whether the new source is:
- **In line** — reinforces existing notes/thesis
- **New angle** — adds a materially new frame, mechanism, datapoint, or ticker idea
- **Contradiction / revision** — conflicts with prior notes or suggests Maxime should update confidence
- **No prior match** — no meaningful related note found

Use vault paths in the writeup. This is how research stays connected and allows thesis changes when an industry moves.

### 3. Pick the folder name

Prefix the slug with the capture timestamp so research folders sort chronologically:

```
<YYYY-MM-DD-HHMM>-<slug>
```

Use local time. Kebab-case the slug from the title, ≤50 chars before the timestamp prefix. Examples:
- "Long-running Agents" captured 2026-06-18 09:30 → `2026-06-18-0930-long-running-agents`
- "Attention Is All You Need" captured 2026-06-18 09:30 → `2026-06-18-0930-attention-is-all-you-need`
- "How we built an AI agent security swarm" captured 2026-06-18 09:30 → `2026-06-18-0930-ai-agent-security-swarm`

Drop articles (a/an/the), drop trailing punctuation, lowercase.

### 4. Create the folder

```bash
mkdir -p /Users/maxime/dev/obsidianvault/RESEARCH/<YYYY-MM-DD-HHMM>-<slug>
```

### 5. Write the files

Use Obsidian-flavored markdown: frontmatter, wikilinks between siblings, callouts where useful. Each file gets frontmatter with `title`, `source: "[[source]]"`, `url`, `author`, `tags`.

#### `source.md` — metadata + index

```markdown
---
title: <Article Title>
author: <Author>
url: <URL>
captured: <YYYY-MM-DD>
tags: [<topic-tags>]
---

# Source

**Title:** <Article Title>
**Author:** <Author>
**URL:** <URL>
<!-- For YouTube: also link to transcript -->
**Transcript:** [[../../YT/<slug>/transcript|transcript]]

Companion files:
- [[summary]]
- [[highlights]]
- [[citations]]
- [[recs]]   <!-- only if recs.md was written -->

Related vault notes:
- [[../../RESEARCH/<prior-folder>/summary|<prior title>]] — in line / new angle / contradicts: <1-line reason>
- [[../../STONKS/research/<file>|<prior title>]] — in line / new angle / contradicts: <1-line reason>
<!-- If no meaningful prior notes were found, write: No directly relevant prior notes found. -->
```

#### `summary.md` — structured summary

Lead with the source callout, then organize by the source's actual structure (don't force a generic template). Aim for scannable: headings, bullets, tables where they fit. Length: proportional to source — a 2k-word blog gets ~300 words of summary; a 30-page paper gets more.

Capture:
- The **core thesis / claim**
- Key **concepts, frameworks, or numbers** introduced
- **Conclusions / recommendations** the author makes

Don't editorialize here. Save opinions for `recs.md`.

#### `highlights.md` — punchy one-liners

8–12 short, memorable verbatim quotes (1–2 sentences each). The kind a reader would underline. Group by theme with `##` headings. Each quote in a `>` blockquote.

#### `citations.md` — longer excerpts

8–12 longer verbatim passages (2–5 sentences each), organized by theme. These are for citing in technical docs — substantive, not punchy. Include enough context that the quote stands on its own.

#### `recs.md` — applicability (conditional)

Only if topic touches AI/AI-infra/energy/cyber/markets (see above). Structure:

```markdown
## Prior-note fit
<in line / new angle / contradiction / no prior match; cite the vault paths and say whether this should change confidence>

## Already nailed
<what Maxime's existing work already does that the source validates>

## Gaps worth poking
<concrete actions / things to investigate, with file paths or system names from NEBARI.md when AI/cyber>

## Not applicable
<what to skip and why>

## Pick one
<if forced to do one thing, what>
```

For AI/cyber topics, anchor in `NEBARI.md` paths and components. For chips/energy/markets/public equities, anchor in `STONKS/instruction.md` + `STONKS/STRATEGY/STRATEGY.md`: picks-and-shovels, physical constraints, independent numbers first, strongest counterargument, confidence level, and what would change the view.

### 6. Cross-link

All four/five files link to each other via wikilinks in their source callout:

```markdown
> [!info] Source
> <Author> — [<Title>](<URL>)
> See [[source]] · [[summary]] · [[highlights]] · [[citations]] · [[recs]]
```

(Omit `[[recs]]` from the chain if not written.)

### 7. Re-index the vault

After writing new research, refresh QMD so future research can find it:

```bash
qmd update
qmd embed
```

### 8. Confirm

Print the folder path, files written, related prior notes found, and re-index status. Offer the natural next step (e.g. "Want me to write `recs.md` after all?" if you skipped it and the user might want it).

## Quality bar

- **Citations must be verbatim.** Don't paraphrase in `citations.md` or `highlights.md`. If `WebFetch` only gave you a paraphrase, fetch again asking explicitly for verbatim passages with surrounding context.
- **Summary must be the source's argument, not yours.** Reserve your take for `recs.md`.
- **Cross-references must cite vault paths.** Say whether the new source is in line, a new angle, or a contradiction/revision versus prior notes.
- **Folder-name stability matters.** Once written, downstream notes may link to it — don't rename casually.
- **No file stubs.** If you can't fill a file with real content (e.g. `recs.md` has nothing to say), don't create it.

## Follow-ups (offer, don't auto-run)

After writing, suggest natural next steps:
- "Want me to add this to a topic index (e.g. `RESEARCH/_index.md`)?"
- "Want me to cross-link from `NEBARI.md` / `MAXIME.md`?"
- "Want me to add a STONKS daily note for this?" If yes, create `STONKS/daily/<YYYY-MM-DD>.md` if missing and append a concise entry when the source validates/invalidates the thesis, suggests a ticker idea, affects a sector view, changes confidence, or creates a market follow-up.
- "Want me to schedule a re-read in 2 weeks?" (use `/schedule`)
