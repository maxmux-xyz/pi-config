/**
 * Extension that logs entire sessions to Obsidian vault.
 * Each session (pi start or /new) creates one markdown file with all turns.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
  const OUTPUT_DIR = "/Users/maxime/dev/obsidianvault/prompts";

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let currentFilePath: string | undefined;
  let sessionStartTime: number | undefined;
  let turnCount = 0;
  let currentPrompt: string | undefined;
  let promptTimestamp: number | undefined;

  function extractTextContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((c): c is { type: "text"; text: string } => c && c.type === "text")
        .map((c) => c.text)
        .join("\n");
    }
    return "";
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function formatDateFolder(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function projectName(cwd: string | undefined): string {
    if (!cwd) return "unknown";
    const parts = cwd.split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || "unknown";
  }

  function startNewSession() {
    sessionStartTime = Date.now();
    turnCount = 0;
    const project = projectName(process.cwd());
    const dateStr = formatDate(sessionStartTime);
    const dateFolder = formatDateFolder(sessionStartTime);
    const dayDir = path.join(OUTPUT_DIR, dateFolder);
    
    // Ensure day directory exists
    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
    }
    
    const filename = `${dateStr}-${project}.md`;
    currentFilePath = path.join(dayDir, filename);

    // Write initial frontmatter
    const date = new Date(sessionStartTime);
    const header = `---
date: ${date.toISOString()}
project: ${project}
path: ${process.cwd()}
---

### Session - ${date.toLocaleString()}

`;
    fs.writeFileSync(currentFilePath, header, "utf-8");
  }

  // New session on pi start
  pi.on("session_start", async (_event, ctx) => {
    startNewSession();
    if (ctx.hasUI) {
      ctx.ui.notify("📝 Obsidian logger active", "info");
    }
  });

  // New session on /new command
  pi.on("session_switch", async (event) => {
    if (event.reason === "new") {
      startNewSession();
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    currentPrompt = event.prompt;
    promptTimestamp = Date.now();
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!currentPrompt || !promptTimestamp || !currentFilePath) return;

    // Extract assistant text responses (skip tool calls)
    const assistantText = event.messages
      .filter((m) => m.role === "assistant")
      .map((m) => extractTextContent(m.content))
      .filter((text) => text.trim())
      .join("\n\n");

    if (!assistantText.trim()) {
      currentPrompt = undefined;
      promptTimestamp = undefined;
      return;
    }

    turnCount++;
    const turnTime = new Date(promptTimestamp).toLocaleTimeString();

    // Append turn to current session file
    const turnContent = `---

# Turn ${turnCount} (${turnTime})

## Prompt

${currentPrompt}

## Response

${assistantText}

`;
    fs.appendFileSync(currentFilePath, turnContent, "utf-8");

    // Reset for next turn
    currentPrompt = undefined;
    promptTimestamp = undefined;
  });
}
