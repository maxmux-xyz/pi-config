---
name: yt-transcript
description: Fetch a YouTube video transcript and save it to the Obsidian vault as YT/<title-slug>/transcript.md, ready for downstream agents (summarize, highlight, etc.). Use when the user asks to grab/save/transcribe a YouTube video, dumps a youtube.com or youtu.be URL with intent to summarize, or says things like "transcribe this YT video", "pull the transcript", "save this talk to my vault".
---

# yt-transcript

Pull a YouTube transcript and write it to the Obsidian vault in a structured, agent-friendly format.

## Output

Writes to `<vault>/YT/<title-slug>/transcript.md` with:

- Frontmatter: `title`, `url`, `video_id`, `channel`, `duration_seconds`, `upload_date`, `fetched`, `tags: [youtube, transcript]`
- Heading + source line + duration
- Transcript broken into timestamped paragraphs (`**[mm:ss]** ...`), grouped by natural pauses (~4s gap) and capped at ~600 chars

The directory `YT/<title-slug>/` is intentional — downstream agents drop summaries, highlights, etc. as siblings (`summary.md`, `highlights.md`) so all per-video artifacts live together.

## Usage

Default vault is `/Users/maxime/dev/obsidianvault`.

```bash
python3 ~/.pi/agent/skills/yt-transcript/scripts/fetch.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

Accepts plain URLs, `youtu.be/...` short links, `/shorts/...`, `/live/...`, or a bare 11-char video ID.

Flags:

- `--vault PATH` — override vault root
- `--lang en,fr` — preferred subtitle languages, in order
- `--force` — overwrite existing `transcript.md`

The script prints the path of the file it wrote on success.

## How it works

1. `yt-dlp --skip-download --print` for metadata (title, channel, duration, upload date)
2. `youtube-transcript-api` for structured snippets (text + start + duration)
3. Group snippets into paragraphs, render markdown with frontmatter

`youtube-transcript-api` is preferred over yt-dlp's VTT subtitles because it returns clean structured data — no word-level timing tags or duplicated rolling-caption lines to strip.

## Dependencies

- `yt-dlp` (`brew install yt-dlp`)
- `youtube-transcript-api` (`pip3 install --user youtube-transcript-api`)

## Post-fetch review pass (important)

YouTube auto-captions are unreliable for **proper nouns, technical jargon, and homophones**. Before producing summary/highlights or letting downstream agents act on the transcript, **scan it for likely mistranscriptions** and ask the human to confirm. Do not silently "fix" — the human is the only one who knows what was actually said.

**Common mistranscription classes to look for:**

- **Brand/product names that sound like English words.** Examples observed in real talks:
  - `cloud code` / `cloud` → **Claude Code** / **Claude**
  - `entropic` → **Anthropic**
  - `Ghosty` → **Ghostty**
  - `tal draw` → **tldraw**
  - `open code` → **opencode** (opencode.ai)
  - `open claw` / `openclaw` / `open clause` → **OpenClaw** (openclaw.ai, by Peter Steinberger)
  - `Persso` → **Perplexity** (or similar)
- **Compound technical terms split or mangled:** `aentic` → `agentic`, `combounding` → `compounding`, `lobomizes` → `lobotomizes`, `MPM` → `npm`.
- **Person handles / Twitter names** rendered as common words: `tar`, `theo`, `nat`, etc. — flag, don't guess.
- **Coined words and intentional misspellings:** the speaker may *mean* the weird spelling (e.g. `boooos` as a deliberate term-of-art). Do not "fix" these.
- **Filler/disfluencies** (`uh`, `um`, repeated words from rolling-caption overlap) — leave in the transcript; the summary/highlights can clean them.

**Workflow:**

1. After the script writes `transcript.md`, read it.
2. Build a candidate list of mistranscriptions: word + timestamp + your best guess + a one-line reason ("phonetic match for known product", "doesn't parse as English", "looks like a person's handle").
3. **For unfamiliar candidates, search the web before asking.** Auto-captions garble names of newer tools, products, and people that the model may not know about. If a flagged term has no obvious match (or your guess is uncertain), run a `WebSearch` with the surrounding context — e.g. `"Yagi Yaggi" agent parallel computing harness coding` or `"gas town" agentic coding tool`. Search in parallel for multiple unknowns. The web result usually disambiguates immediately (e.g. "Yagi Yaggi" → Steve **Yegge**, "Ralph Wim" → **Ralph Wiggum** loop, "pi" → **Pi** by Mario Zechner at pi.dev). Only present terms to the human after the web has been consulted.
4. Present the list to the human in a compact table. Split into **high confidence** (apply on confirm) vs. **ambiguous** (need their call). Cite the web source briefly for non-obvious matches so the human can verify.
5. After confirmation, propagate fixes to **all artifacts** (`transcript.md`, plus `summary.md` / `highlights.md` if they exist) using exact-string `Edit`. Use `replace_all` for terms that recur.
6. If the human cannot disambiguate and the web didn't surface anything (e.g. a first name with no surrounding context), leave the original and add a `[?]` marker after it in the transcript so future reviewers see the uncertainty was acknowledged.

**Do not run a second review pass after fixes are applied** — diminishing returns and risk of fabrication. One pass, then move on.

## Failure modes

- **No captions available:** `youtube-transcript-api` raises `TranscriptsDisabled` / `NoTranscriptFound`. Tell the user the video has no captions; do not try to transcribe audio.
- **Language not available:** pass `--lang` with a fallback list, e.g. `--lang en,en-US,en-GB`.
- **YouTube internal change breaks the lib:** rare but happens. Fall back to `yt-dlp --write-auto-subs --sub-format vtt` and clean the VTT (strip `WEBVTT`/`Kind:`/`Language:` headers, lines containing `-->`, `<\d{2}:\d{2}:\d{2}\.\d{3}>` word timing tags, `</?c[^>]*>` color tags, then dedupe consecutive lines).

## Follow-ups (suggest, don't auto-run)

After fetching, the natural next step is summarize/highlight. Offer it but don't do it unprompted:

> Want me to read the transcript and write `summary.md` + `highlights.md` next to it?
