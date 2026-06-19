import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type RunResult = {
	code: number | null;
	signal: NodeJS.Signals | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
	killed?: string;
};

const TIMEOUT_MS = 10 * 60 * 1000;

let activeRun:
	| {
			child: ChildProcess;
			cwd: string;
			logPath: string;
			startedAt: number;
			killReason?: string;
	  }
	| undefined;

function formatDuration(ms: number): string {
	const seconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

function activeRunSummary(run = activeRun): string {
	if (!run) return "No issue-pr subagent is running.";
	const pid = run.child.pid ? `pid=${run.child.pid}` : "pid=unknown";
	return `issue-pr subagent running (${pid}, ${formatDuration(Date.now() - run.startedAt)}). LOG: ${run.logPath}`;
}

function signalChildTree(child: ChildProcess, signal: NodeJS.Signals): boolean {
	if (!child.pid) return false;
	try {
		if (process.platform === "win32") return child.kill(signal);
		process.kill(-child.pid, signal);
		return true;
	} catch {
		try {
			return child.kill(signal);
		} catch {
			return false;
		}
	}
}

function killActiveRun(reason: string): string | undefined {
	const run = activeRun;
	if (!run) return undefined;

	run.killReason = reason;
	const sent = signalChildTree(run.child, "SIGTERM");
	setTimeout(() => {
		if (activeRun?.child === run.child) signalChildTree(run.child, "SIGKILL");
	}, 5_000).unref();

	return `${sent ? "Sent SIGTERM" : "Tried to send SIGTERM"} to ${activeRunSummary(run)}`;
}

const ISSUE_PR_PROMPT = `Commit the current work if needed, push it, then create or find the GitHub PR.

The user explicitly requested this isolated subagent to perform the git operations required for issuing a PR.

Rules:
- Use bash/read only, plus available PR-related skills if useful.
- Do not edit files.
- Disable interactive prompts: use GH_PROMPT_DISABLED=1 where relevant.
- First inspect branch/status/diff and any PR-related skill instructions.
- If a merge/rebase/cherry-pick is in progress, stop and report blocked.
- If currently on main/master with uncommitted changes, create a new branch before staging/committing. Use a concise branch name derived from the changes.
- If on a feature branch with an existing PR and there are new uncommitted changes, commit and push those changes to update the existing PR.
- If on a feature branch with uncommitted changes and no PR yet, commit on the current branch.
- Stage existing working tree changes with git add -A and create a concise commit message from the diff. Do not add AI attribution.
- If the branch has local commits not on the remote, push them before creating/finding the PR.
- Push the PR branch with upstream if needed.
- Build a factual PR title and non-empty PR body from the diff and commits.
- New PRs must use explicit title/body, not bare --fill. Use gh pr create --title "..." --body "$(cat <<'EOF' ... EOF)" or --body-file.
- PR body must include:
  ## Summary
  - 2-5 bullets describing what changed and why

  ## Test plan
  - Commands run, or "Not run" with reason
- Do not include AI attribution or generated-by text in commits or PR bodies.
- If a PR already exists for the branch, return it after pushing any new local changes; do not create a duplicate. If its body is empty, update it with gh pr edit --body using the same template.
- Prefer gh CLI: gh pr view, gh pr create, gh pr edit.
- Do not reset, rebase, force-push, stash, delete branches, or discard changes.
- Keep output terse.

Final response format only:
STATUS: created|existing|blocked|failed
PR_URL: <url or none>
TITLE: <title or none>
NOTE: <one sentence>`;

function stripAnsi(text: string): string {
	return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function timestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

function extractExtraFromNaturalInput(text: string): string | undefined {
	const trimmed = text.trim();
	const match = trimmed.match(/(?:^|[\s:;,\-—])(?:please\s+)?(?:issue|create|open)\s+(?:a\s+)?(?:pr|pull\s+request)\b\s*[:\-—]?\s*(.*)$/i);
	if (!match) return undefined;
	return match[1]?.trim() || "";
}

function isNaturalIssuePrInput(text: string): boolean {
	return extractExtraFromNaturalInput(text) !== undefined;
}

function buildPrompt(extra: string): string {
	const trimmed = extra.trim();
	if (!trimmed) return ISSUE_PR_PROMPT;
	return `${ISSUE_PR_PROMPT}\n\nExtra user instructions:\n${trimmed}`;
}

function runPiSubagent(cwd: string, prompt: string, logPath: string): Promise<RunResult> {
	return new Promise((resolve) => {
		const args = [
			"--name",
			"issue-pr-subagent",
			"--no-extensions",
			"--no-prompt-templates",
			"--tools",
			"bash,read",
			"-p",
			prompt,
		];

		const child = spawn("pi", args, {
			cwd,
			detached: process.platform !== "win32",
			env: {
				...process.env,
				GH_PROMPT_DISABLED: "1",
				PI_ISSUE_PR_SUBAGENT: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		activeRun = { child, cwd, logPath, startedAt: Date.now() };

		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		let timeout: NodeJS.Timeout;

		const finish = async (code: number | null, signal: NodeJS.Signals | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			const killReason = activeRun?.child === child ? activeRun.killReason : undefined;
			if (activeRun?.child === child) activeRun = undefined;
			const log = [
				`cwd: ${cwd}`,
				`command: pi ${args.map((arg) => JSON.stringify(arg)).join(" ")}`,
				`exit: ${code ?? "null"}${signal ? ` signal=${signal}` : ""}${timedOut ? " timed_out=true" : ""}${killReason ? ` killed=${killReason}` : ""}`,
				"",
				"--- stdout ---",
				stdout,
				"",
				"--- stderr ---",
				stderr,
			].join("\n");
			await writeFile(logPath, log, "utf8").catch(() => undefined);
			resolve({ code, signal, stdout, stderr, timedOut, killed: killReason });
		};

		timeout = setTimeout(() => {
			timedOut = true;
			if (activeRun?.child === child) activeRun.killReason = "timeout";
			signalChildTree(child, "SIGTERM");
			setTimeout(() => {
				if (!settled) signalChildTree(child, "SIGKILL");
			}, 5_000).unref();
		}, TIMEOUT_MS);

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => {
			stderr += `\n${error.stack ?? error.message}\n`;
			void finish(1, null);
		});
		child.on("close", (code, signal) => {
			void finish(code, signal);
		});
	});
}

function summarizeResult(result: RunResult, logPath: string): string {
	const cleanStdout = stripAnsi(result.stdout).trim();
	const cleanStderr = stripAnsi(result.stderr).trim();
	const combined = `${cleanStdout}\n${cleanStderr}`;
	const url = combined.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/)?.[0];
	const status = cleanStdout.match(/^STATUS:\s*(.+)$/im)?.[1]?.trim();
	const effectiveStatus = status ?? (result.killed ? "killed" : undefined);
	const title = cleanStdout.match(/^TITLE:\s*(.+)$/im)?.[1]?.trim();
	const note = cleanStdout.match(/^NOTE:\s*(.+)$/im)?.[1]?.trim();

	const lines = ["issue-pr subagent done"];
	if (effectiveStatus) lines.push(`STATUS: ${effectiveStatus}`);
	if (url) lines.push(`PR_URL: ${url}`);
	if (title && title.toLowerCase() !== "none") lines.push(`TITLE: ${title}`);
	if (note && note.toLowerCase() !== "none") lines.push(`NOTE: ${note}`);
	if (result.killed) lines.push(`NOTE: killed by ${result.killed}`);
	if (result.timedOut) lines.push("ERROR: timed out");
	else if (result.code !== 0 && !effectiveStatus) lines.push(`ERROR: subagent exited ${result.code ?? "unknown"}`);
	if (!url && !effectiveStatus) {
		const tail = cleanStdout.split("\n").filter(Boolean).slice(-6).join("\n");
		if (tail) lines.push(`OUTPUT:\n${tail}`);
	}
	lines.push(`LOG: ${logPath}`);
	return lines.join("\n");
}

async function issuePr(extra: string, ctx: ExtensionContext): Promise<string> {
	if (activeRun) {
		const message = `${activeRunSummary()} Use /issue-pr-kill to stop it.`;
		ctx.ui.notify(message, "warning");
		return message;
	}

	const logDir = join(tmpdir(), "pi-issue-pr");
	await mkdir(logDir, { recursive: true });
	const logPath = join(logDir, `issue-pr-${timestamp()}.log`);
	const prompt = buildPrompt(extra);

	ctx.ui.setStatus("issue-pr", "issuing PR...");
	ctx.ui.notify("Spawning isolated issue-pr subagent. Use /issue-pr-kill to stop it.", "info");

	void runPiSubagent(ctx.cwd, prompt, logPath)
		.then((result) => {
			const level = result.code === 0 && !result.timedOut && !result.killed ? "info" : result.killed ? "warning" : "error";
			ctx.ui.notify(summarizeResult(result, logPath), level);
		})
		.catch((error: unknown) => {
			ctx.ui.notify(`issue-pr subagent failed: ${error instanceof Error ? error.message : String(error)}\nLOG: ${logPath}`, "error");
		})
		.finally(() => {
			ctx.ui.setStatus("issue-pr", undefined);
		});

	return activeRunSummary();
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		if (!pi.getActiveTools().includes("issue_pr")) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\nIssue PR subagent tools:\n- Use issue_pr when the user asks to create, open, issue, or update a pull request after implementation work is complete.\n- issue_pr starts an isolated background subagent that commits current work if needed, pushes it, then creates or finds the GitHub PR.\n- Use issue_pr_status to monitor it. Use issue_pr_kill if it is stuck or running too long.\n- Do not use issue_pr for normal code changes; use it only when PR publication is the next requested step.`,
		};
	});

	pi.registerTool({
		name: "issue_pr",
		label: "Issue PR",
		description: "Start an isolated subagent that commits current work if needed, pushes it, then creates or finds the GitHub PR. Returns immediately; use issue_pr_status or /issue-pr-status to monitor and issue_pr_kill or /issue-pr-kill to stop it.",
		parameters: Type.Object({
			extra: Type.Optional(Type.String({ description: "Optional extra instructions from the user for PR creation." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const message = await issuePr(params.extra ?? "", ctx);
			return {
				content: [{ type: "text", text: message }],
				details: { active: Boolean(activeRun), logPath: activeRun?.logPath },
			};
		},
	});

	pi.registerTool({
		name: "issue_pr_status",
		label: "Issue PR Status",
		description: "Show the running issue-pr subagent, if any.",
		parameters: Type.Object({}),
		async execute() {
			let message: string;
			const details: { active: boolean; logPath?: string; external?: string } = { active: false };

			if (activeRun) {
				message = activeRunSummary();
				details.active = true;
				details.logPath = activeRun.logPath;
				return { content: [{ type: "text" as const, text: message }], details };
			}

			const result = await pi.exec("bash", ["-lc", "pgrep -af 'pi .*issue-pr-subagen[t]' || true"], { timeout: 5_000 });
			const output = result.stdout.trim();
			message = output ? `External issue-pr subagent process(es):\n${output}` : "No issue-pr subagent is running.";
			details.active = Boolean(output);
			details.external = output;
			return { content: [{ type: "text" as const, text: message }], details };
		},
	});

	pi.registerTool({
		name: "issue_pr_kill",
		label: "Kill Issue PR",
		description: "Kill the running issue-pr subagent with SIGTERM, escalating to SIGKILL after 5 seconds.",
		parameters: Type.Object({
			reason: Type.Optional(Type.String({ description: "Reason for killing the subagent." })),
		}),
		async execute(_toolCallId, params) {
			const activeMessage = killActiveRun(params.reason ?? "tool");
			const details: { killed: boolean; error?: boolean; pids?: string } = { killed: false };
			if (activeMessage) {
				details.killed = true;
				return { content: [{ type: "text" as const, text: activeMessage }], details };
			}

			const result = await pi.exec(
				"bash",
				[
					"-lc",
					"pids=$(pgrep -f 'pi .*issue-pr-subagen[t]' | tr '\\n' ' '); if [ -z \"$pids\" ]; then exit 2; fi; pkill -TERM -f 'pi .*issue-pr-subagen[t]'; echo \"$pids\"",
				],
				{ timeout: 5_000 },
			);

			if (result.code === 2) return { content: [{ type: "text" as const, text: "No issue-pr subagent is running." }], details };
			if (result.code !== 0) {
				details.error = true;
				return { content: [{ type: "text" as const, text: `Failed to kill issue-pr subagent:\n${result.stderr || result.stdout}` }], details };
			}

			setTimeout(() => {
				void pi.exec("bash", ["-lc", "pkill -KILL -f 'pi .*issue-pr-subagen[t]' || true"], { timeout: 5_000 });
			}, 5_000).unref();
			details.killed = true;
			details.pids = result.stdout.trim();
			return { content: [{ type: "text" as const, text: `Sent SIGTERM to external issue-pr subagent pid(s): ${result.stdout.trim()}` }], details };
		},
	});

	pi.registerCommand("issue-pr", {
		description: "Create/find a GitHub PR in an isolated pi subagent",
		handler: async (args, ctx) => {
			await issuePr(args, ctx);
		},
	});

	pi.registerCommand("issue-pr-status", {
		description: "Show the running issue-pr subagent, if any",
		handler: async (_args, ctx) => {
			if (activeRun) {
				ctx.ui.notify(activeRunSummary(), "info");
				return;
			}

			const result = await pi.exec("bash", ["-lc", "pgrep -af 'pi .*issue-pr-subagen[t]' || true"], { timeout: 5_000 });
			const output = result.stdout.trim();
			ctx.ui.notify(output ? `External issue-pr subagent process(es):\n${output}` : "No issue-pr subagent is running.", "info");
		},
	});

	pi.on("session_shutdown", () => {
		killActiveRun("session_shutdown");
	});

	pi.registerCommand("issue-pr-kill", {
		description: "Kill the running issue-pr subagent",
		handler: async (args, ctx) => {
			const reason = args.trim() || "manual";
			const activeMessage = killActiveRun(reason);
			if (activeMessage) {
				ctx.ui.notify(activeMessage, "warning");
				return;
			}

			const result = await pi.exec(
				"bash",
				[
					"-lc",
					"pids=$(pgrep -f 'pi .*issue-pr-subagen[t]' | tr '\\n' ' '); if [ -z \"$pids\" ]; then exit 2; fi; pkill -TERM -f 'pi .*issue-pr-subagen[t]'; echo \"$pids\"",
				],
				{ timeout: 5_000 },
			);

			if (result.code === 2) {
				ctx.ui.notify("No issue-pr subagent is running.", "info");
				return;
			}
			if (result.code !== 0) {
				ctx.ui.notify(`Failed to kill issue-pr subagent:\n${result.stderr || result.stdout}`, "error");
				return;
			}

			setTimeout(() => {
				void pi.exec("bash", ["-lc", "pkill -KILL -f 'pi .*issue-pr-subagen[t]' || true"], { timeout: 5_000 });
			}, 5_000).unref();
			ctx.ui.notify(`Sent SIGTERM to external issue-pr subagent pid(s): ${result.stdout.trim()}`, "warning");
		},
	});

}
