#!/usr/bin/env python3
"""Fetch a YouTube transcript and save it to the Obsidian vault.

Writes to: <vault>/YT/<title-slug>/transcript.md

Usage:
    fetch.py <url-or-video-id> [--vault PATH] [--lang en,fr]

Requirements:
    - youtube-transcript-api  (pip install --user youtube-transcript-api)
    - yt-dlp                  (brew install yt-dlp)
"""
import argparse
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

VAULT_DEFAULT = Path("/Users/maxime/dev/obsidianvault")


def extract_video_id(s: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
        return s
    m = re.search(r"(?:v=|youtu\.be/|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})", s)
    if not m:
        sys.exit(f"Could not extract video ID from: {s}")
    return m.group(1)


def slugify(s: str, maxlen: int = 80) -> str:
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"-+", "-", s)
    return s[:maxlen].strip("-") or "untitled"


def fmt_ts(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def get_metadata(url_or_id: str) -> dict:
    url = url_or_id
    if not url.startswith("http"):
        url = f"https://www.youtube.com/watch?v={extract_video_id(url_or_id)}"
    fmt = "%(title)s\t%(uploader)s\t%(duration)s\t%(upload_date)s\t%(id)s\t%(webpage_url)s"
    r = subprocess.run(
        ["yt-dlp", "--skip-download", "--print", fmt, url],
        capture_output=True, text=True, check=True,
    )
    title, uploader, duration, upload_date, vid, webpage_url = r.stdout.strip().split("\t")
    return {
        "title": title,
        "uploader": uploader,
        "duration": int(duration) if duration.isdigit() else 0,
        "upload_date": upload_date if upload_date and upload_date != "NA" else "",
        "video_id": vid,
        "url": webpage_url,
    }


def fetch_transcript(video_id: str, languages):
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()
    return api.fetch(video_id, languages=list(languages))


def group_paragraphs(snippets, gap_threshold: float = 4.0, max_chars: int = 600):
    paragraphs, cur, cur_chars, last_end = [], [], 0, None
    for s in snippets:
        gap = (s.start - last_end) if last_end is not None else 0
        if cur and (gap > gap_threshold or cur_chars > max_chars):
            paragraphs.append(cur)
            cur, cur_chars = [], 0
        cur.append(s)
        cur_chars += len(s.text) + 1
        last_end = s.start + s.duration
    if cur:
        paragraphs.append(cur)
    return paragraphs


def yaml_quote(s: str) -> str:
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def render_markdown(meta: dict, paragraphs) -> str:
    lines = ["---"]
    lines.append(f"title: {yaml_quote(meta['title'])}")
    lines.append(f"url: {meta['url']}")
    lines.append(f"video_id: {meta['video_id']}")
    lines.append(f"channel: {yaml_quote(meta['uploader'])}")
    lines.append(f"duration_seconds: {meta['duration']}")
    if meta["upload_date"]:
        d = meta["upload_date"]
        lines.append(f"upload_date: {d[:4]}-{d[4:6]}-{d[6:8]}")
    lines.append(f"fetched: {datetime.now().strftime('%Y-%m-%d')}")
    lines.append("tags: [youtube, transcript]")
    lines.append("---")
    lines.append("")
    lines.append(f"# {meta['title']}")
    lines.append("")
    lines.append(f"Source: <{meta['url']}>  ")
    lines.append(f"Channel: {meta['uploader']}  ")
    lines.append(f"Duration: {fmt_ts(meta['duration'])}")
    lines.append("")
    lines.append("## Transcript")
    lines.append("")
    for para in paragraphs:
        ts = fmt_ts(para[0].start)
        body = " ".join(s.text.strip() for s in para)
        body = re.sub(r"\s+", " ", body).strip()
        lines.append(f"**[{ts}]** {body}")
        lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", help="YouTube URL or 11-char video ID")
    ap.add_argument("--vault", default=str(VAULT_DEFAULT))
    ap.add_argument("--lang", default="en", help="Preferred subtitle language(s), comma-separated")
    ap.add_argument("--force", action="store_true", help="Overwrite if transcript.md already exists")
    args = ap.parse_args()

    vid = extract_video_id(args.video)
    meta = get_metadata(args.video)
    languages = [l.strip() for l in args.lang.split(",") if l.strip()]
    transcript = fetch_transcript(vid, languages)
    paragraphs = group_paragraphs(transcript.snippets)
    md = render_markdown(meta, paragraphs)

    slug = slugify(meta["title"])
    target_dir = Path(args.vault) / "YT" / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    out = target_dir / "transcript.md"
    if out.exists() and not args.force:
        sys.exit(f"Already exists (use --force to overwrite): {out}")
    out.write_text(md, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
