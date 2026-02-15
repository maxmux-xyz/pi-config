---
name: general-loop
description: Execute a task iteration in loop. For any kind of task — research, personal, admin, analysis. Read task files, work in small chunks, write progress.
---

# General Loop Iteration

You are running in `loop` — an iterative system with fresh context each run. You lose all memory between iterations.

## Critical Rule: Small Chunks

Each iteration does ONE meaningful chunk of work, then exits via `loop_next`, `loop_done`, or `loop_terminate`. Don't try to do everything at once. The loop harness will restart you with fresh context.

## 1. Read State

Always start by reading these files from the task directory:

1. `instruction.md` — The task (always exists)
2. `progress.md` — What's been done (if exists)
3. `GUIDE.md` — Human guidance (if exists). **High priority** — follow it, then delete the file.
4. **Any other files** — The task directory may contain additional context (PDFs, notes, data files). **Be curious** — list the task directory and read anything relevant.

## 2. Assess and Act

There are no rigid phases. Each iteration:

1. **Assess** — Read progress.md. Where are we? What's the most useful next step toward the goal?
2. **Act** — Do ONE chunk of work. Examples:
   - Research: search the web, read documents, gather information
   - Analyze: crunch numbers, compare options, extract data from files
   - Produce: write a summary, draft a document, fill out a template, create a spreadsheet
   - Organize: sort through information, categorize findings, build a reference
   - Wait: if something is in-flight, sleep and poll — don't exit just to check later
3. **Record** — Update progress.md with what you did, what you found, and what's next.

### Use all available tools

Don't hesitate to:
- **Search the web** for current information, prices, regulations, deadlines
- **Read files** — PDFs, images, spreadsheets, emails, whatever's in the task directory or referenced
- **Write files** — save intermediate results, drafts, summaries to the task directory
- **Run commands** — calculations, data processing, file conversions
- **Ask for help** — if you need human input (a password, a login, a decision), call `loop_terminate` with a clear ask

### Deliverables

Check `instruction.md` for a "Done When" or "Deliverables" section. Work toward producing those concrete outputs. Save deliverables to the task directory.

## 3. Update progress.md (Your Memory)

**Update progress.md every iteration, right before exiting.** This is your ONLY memory between iterations.

Write liberally — it gets auto-compressed when too large. Write like a lab notebook:

- What you did and what you found
- Key facts, numbers, URLs, dates, names — anything you'll need again
- Decisions and reasoning
- Dead ends so your next self doesn't repeat them
- Open questions
- Current status and what to do next

Bad: `"Looked at tax forms"`
Good: `"Read 2025 W-2 from task dir: gross income $185,432, federal withholding $38,291. Also found 1099-INT with $1,847 interest from Chase savings. Still missing: 1099-B for stock sales — need to ask user for this."`

## 4. Save Work Products

As you produce outputs, save them to the task directory:
- `summary.md`, `analysis.md`, `options.md` — whatever fits the task
- Name files descriptively
- Reference them in progress.md so your next self knows they exist

## 5. End Iteration

Every iteration MUST end with exactly one of:

- **`loop_next`** — Did a chunk of work, more to do. **Most common ending.**
- **`loop_done`** — Task complete. All deliverables produced and saved. Write a final summary in progress.md.
- **`loop_terminate`** — Blocked, need human help. Be specific about what you need: "Need login credentials for X", "Need user to decide between option A and B", "Can't access Y — permission denied".
