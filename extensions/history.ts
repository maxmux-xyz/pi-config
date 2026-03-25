import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { Container, Text, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";

interface HistoryEntry {
  timestamp: string;
  text: string;
  project: string;
  sessionFile: string;
}

function decodeProjectDir(encoded: string): string {
  // "--Users-maxime-dev-nebari-mvp-3--" → "/Users/maxime/dev/nebari-mvp-3"
  // Remove leading/trailing "--", replace remaining "-" with "/"
  // But we need to be smarter: the encoding replaces "/" with "-"
  // and wraps with "--". Single hyphens in dir names are preserved.
  // Actually looking at the pattern, it's simpler: strip --, replace - with /
  let decoded = encoded;
  if (decoded.startsWith("--")) decoded = decoded.slice(2);
  if (decoded.endsWith("--")) decoded = decoded.slice(0, -2);
  decoded = "/" + decoded.replace(/-/g, "/");
  // Collapse multiple slashes from original hyphens in path
  // Actually the encoding is: each path separator "/" becomes "-"
  // So "/Users/maxime/dev/nebari-mvp-3" → "--Users-maxime-dev-nebari-mvp-3--"
  // This means we can't distinguish hyphens from path separators perfectly,
  // but for display purposes this is fine
  return decoded;
}

function getShortProject(project: string): string {
  // "/Users/maxime/dev/nebari-mvp-3" → "nebari-mvp-3"
  // "/Users/maxime/.pi/agent" → ".pi/agent"
  const home = process.env.HOME || "/Users/maxime";
  let short = project.startsWith(home) ? project.slice(home.length + 1) : project;
  // For paths under dev/, show just the project name
  if (short.startsWith("dev/")) short = short.slice(4);
  return short;
}

async function collectHistory(sessionsDir: string): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(sessionsDir);
  } catch {
    return entries;
  }

  for (const projDir of projectDirs) {
    const projPath = join(sessionsDir, projDir);
    const project = decodeProjectDir(projDir);

    let sessionFiles: string[];
    try {
      sessionFiles = await readdir(projPath);
    } catch {
      continue;
    }

    for (const sessionFile of sessionFiles) {
      if (!sessionFile.endsWith(".jsonl")) continue;

      try {
        const content = await readFile(join(projPath, sessionFile), "utf-8");
        const lines = content.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (
              entry.type === "message" &&
              entry.message?.role === "user" &&
              Array.isArray(entry.message.content)
            ) {
              const textParts = entry.message.content
                .filter((c: any) => c.type === "text" && c.text)
                .map((c: any) => c.text)
                .join(" ");

              if (textParts.trim()) {
                entries.push({
                  timestamp: entry.timestamp || entry.message.timestamp
                    ? new Date(entry.timestamp || entry.message.timestamp).toISOString()
                    : "unknown",
                  text: textParts.trim(),
                  project: project,
                  sessionFile: sessionFile,
                });
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  // Sort chronologically (newest first)
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `today ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    } else if (diffDays === 1) {
      return `yesterday ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  } catch {
    return iso;
  }
}

function truncateText(text: string, maxLen: number): string {
  // Replace newlines with spaces for single-line display
  const oneLine = text.replace(/\n/g, " ").replace(/\s+/g, " ");
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 1) + "…";
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("history", {
    description: "Browse prompt history across all sessions",
    handler: async (args, ctx) => {
      const sessionsDir = join(process.env.HOME || "", ".pi", "agent", "sessions");

      if (ctx.hasUI) {
        ctx.ui.notify("Loading prompt history...", "info");
      }

      let allEntries = await collectHistory(sessionsDir);

      // Filter by search term if provided
      const searchTerm = args?.trim().toLowerCase();
      if (searchTerm) {
        allEntries = allEntries.filter(
          (e) =>
            e.text.toLowerCase().includes(searchTerm) ||
            e.project.toLowerCase().includes(searchTerm)
        );
      }

      if (allEntries.length === 0) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            searchTerm ? `No prompts matching "${args?.trim()}"` : "No prompt history found",
            "warning"
          );
        }
        return;
      }

      // Show interactive scrollable UI
      if (ctx.hasUI) {
        const PAGE_SIZE = 200;
        const displayEntries = allEntries.slice(0, PAGE_SIZE);
        const totalCount = allEntries.length;

        await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
          const container = new Container();
          let scrollOffset = 0;
          let viewHeight = 20;
          let filterText = "";
          let filteredEntries = displayEntries;

          const filterEntries = () => {
            if (!filterText) {
              filteredEntries = displayEntries;
            } else {
              const ft = filterText.toLowerCase();
              filteredEntries = displayEntries.filter(
                (e) =>
                  e.text.toLowerCase().includes(ft) ||
                  e.project.toLowerCase().includes(ft)
              );
            }
            scrollOffset = 0;
          };

          return {
            render: (width: number) => {
              const lines: string[] = [];
              const border = "─".repeat(width - 2);

              // Header
              const title = searchTerm
                ? ` Prompt History — "${args?.trim()}" (${filteredEntries.length} results)`
                : ` Prompt History (${filteredEntries.length}${totalCount > PAGE_SIZE ? ` of ${totalCount}` : ""} prompts)`;
              lines.push(truncateToWidth(theme.fg("accent", theme.bold(title)), width - 1));

              if (filterText) {
                lines.push(truncateToWidth(theme.fg("warning", ` Filter: ${filterText}`) + theme.fg("dim", "█"), width - 1));
              }

              lines.push(truncateToWidth(theme.fg("dim", border), width - 1));

              // Calculate visible area
              viewHeight = Math.max(5, Math.min(40, filteredEntries.length));
              const maxScroll = Math.max(0, filteredEntries.length - viewHeight);
              scrollOffset = Math.min(scrollOffset, maxScroll);

              const visible = filteredEntries.slice(scrollOffset, scrollOffset + viewHeight);

              for (const entry of visible) {
                const ts = formatTimestamp(entry.timestamp);
                const proj = getShortProject(entry.project);
                const prefix = ` ${ts} [${proj}] `;
                const prefixLen = visibleWidth(prefix);
                const maxTextLen = Math.max(10, width - prefixLen - 2);
                const text = truncateText(entry.text, maxTextLen);

                const raw =
                  theme.fg("dim", ` ${ts} `) +
                  theme.fg("muted", `[${proj}] `) +
                  text;
                lines.push(truncateToWidth(raw, width - 1));
              }

              if (filteredEntries.length > viewHeight) {
                const scrollPct = Math.round(
                  ((scrollOffset + viewHeight) / filteredEntries.length) * 100
                );
                lines.push(truncateToWidth(
                  theme.fg("dim", border) +
                  theme.fg("dim", ` ${scrollOffset + 1}-${scrollOffset + visible.length}/${filteredEntries.length} (${scrollPct}%)`),
                  width - 1
                ));
              } else {
                lines.push(truncateToWidth(theme.fg("dim", border), width - 1));
              }

              lines.push(truncateToWidth(
                theme.fg("dim", " ↑↓ scroll  /  type to filter  Esc close"),
                width - 1
              ));

              return lines;
            },

            invalidate: () => container.invalidate(),

            handleInput: (data: string) => {
              if (matchesKey(data, "escape") || matchesKey(data, "q")) {
                done(undefined);
                return true;
              }

              // Scroll
              if (matchesKey(data, "up") || matchesKey(data, "k")) {
                scrollOffset = Math.max(0, scrollOffset - 1);
                container.invalidate();
                return true;
              }
              if (matchesKey(data, "down") || matchesKey(data, "j")) {
                scrollOffset = Math.min(
                  Math.max(0, filteredEntries.length - viewHeight),
                  scrollOffset + 1
                );
                container.invalidate();
                return true;
              }
              if (matchesKey(data, "pageup")) {
                scrollOffset = Math.max(0, scrollOffset - viewHeight);
                container.invalidate();
                return true;
              }
              if (matchesKey(data, "pagedown")) {
                scrollOffset = Math.min(
                  Math.max(0, filteredEntries.length - viewHeight),
                  scrollOffset + viewHeight
                );
                container.invalidate();
                return true;
              }
              if (matchesKey(data, "home")) {
                scrollOffset = 0;
                container.invalidate();
                return true;
              }
              if (matchesKey(data, "end")) {
                scrollOffset = Math.max(0, filteredEntries.length - viewHeight);
                container.invalidate();
                return true;
              }

              // Backspace for filter
              if (matchesKey(data, "backspace")) {
                if (filterText.length > 0) {
                  filterText = filterText.slice(0, -1);
                  filterEntries();
                  container.invalidate();
                }
                return true;
              }

              // Typing for filter (printable chars)
              if (data.length === 1 && data.charCodeAt(0) >= 32) {
                filterText += data;
                filterEntries();
                container.invalidate();
                return true;
              }

              return false;
            },
          };
        });
      }
    },
  });
}
