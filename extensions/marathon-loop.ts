/**
 * Marathon Loop Extension - Auto-run marathon skill until completion
 *
 * Automatically restarts the marathon skill after each chunk completes,
 * continuing until the task is done (result.md no longer contains "not yet complete").
 *
 * This extension works with an external wrapper script (marathon-runner.sh) that:
 * 1. Starts pi
 * 2. When pi exits, checks if marathon state file exists
 * 3. If yes, restarts pi with the continuation prompt
 *
 * Usage:
 *   ./marathon-runner.sh                        - Start the runner
 *   /marathon-loop docs/tasks/my-investigation  - Start auto-running
 *   /marathon-stop                              - Stop the loop
 *   /marathon-status                            - Show current status
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// State file location - persists across pi restarts
const STATE_FILE = join(homedir(), ".pi", "marathon-state.json");

interface MarathonState {
	taskDir: string;
	cwd: string;
	iteration: number;
}

function loadState(): MarathonState | null {
	if (!existsSync(STATE_FILE)) return null;
	try {
		return JSON.parse(readFileSync(STATE_FILE, "utf8"));
	} catch {
		return null;
	}
}

function saveState(state: MarathonState): void {
	writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
	if (existsSync(STATE_FILE)) {
		unlinkSync(STATE_FILE);
	}
}

export default function (pi: ExtensionAPI) {
	const MAX_ITERATIONS = 100; // Safety limit

	function isComplete(taskDir: string, cwd: string): boolean {
		const resultFile = join(cwd, taskDir, "result.md");
		if (!existsSync(resultFile)) return false;
		const content = readFileSync(resultFile, "utf8");
		return !content.toLowerCase().includes("not yet complete");
	}

	// On session start, check if we're resuming a marathon
	pi.on("session_start", async (_event, ctx) => {
		const state = loadState();
		if (!state) return;

		// Validate we're in the right directory
		if (state.cwd !== ctx.cwd) {
			ctx.ui.notify(`Marathon state found but cwd mismatch. Expected: ${state.cwd}`, "warning");
			clearState();
			return;
		}

		// Check if already complete
		if (isComplete(state.taskDir, ctx.cwd)) {
			ctx.ui.notify(`🎉 Marathon complete! See ${state.taskDir}/result.md`, "success");
			clearState();
			return;
		}

		// Check iteration limit
		if (state.iteration >= MAX_ITERATIONS) {
			ctx.ui.notify(`⚠️ Marathon stopped: reached ${MAX_ITERATIONS} iterations`, "warning");
			clearState();
			return;
		}

		// Continue the marathon
		ctx.ui.notify(`🏃 Resuming marathon (iteration ${state.iteration + 1}) on ${state.taskDir}`, "info");
		ctx.ui.setStatus("marathon", `🏃 Marathon: iteration ${state.iteration + 1}...`);

		// Small delay then trigger
		setTimeout(() => {
			pi.sendUserMessage(`marathon skill on ${state.taskDir}`);
		}, 1000);
	});

	pi.registerCommand("marathon-loop", {
		description: "Run marathon skill in a loop until complete",
		handler: async (args, ctx) => {
			const taskDir = args.trim();
			if (!taskDir) {
				ctx.ui.notify("Usage: /marathon-loop <task-dir>", "error");
				return;
			}

			// Validate task directory exists
			const fullPath = join(ctx.cwd, taskDir);
			if (!existsSync(fullPath)) {
				ctx.ui.notify(`Task directory not found: ${fullPath}`, "error");
				return;
			}

			// Check if instructions.md exists
			const instructionsPath = join(fullPath, "instructions.md");
			if (!existsSync(instructionsPath)) {
				ctx.ui.notify(`Missing instructions.md in ${taskDir}`, "error");
				return;
			}

			// Check if already complete
			if (isComplete(taskDir, ctx.cwd)) {
				ctx.ui.notify(`Task already complete! See ${taskDir}/result.md`, "info");
				return;
			}

			// Save state for the loop
			saveState({ taskDir, cwd: ctx.cwd, iteration: 0 });

			ctx.ui.notify(`🏃 Starting marathon loop on ${taskDir}`, "info");
			ctx.ui.setStatus("marathon", "🏃 Marathon running...");

			// Trigger first prompt
			pi.sendUserMessage(`marathon skill on ${taskDir}`);
		},
	});

	pi.registerCommand("marathon-stop", {
		description: "Stop the marathon loop",
		handler: async (_args, ctx) => {
			const state = loadState();
			if (state) {
				clearState();
				ctx.ui.setStatus("marathon", undefined);
				ctx.ui.notify(`Marathon loop stopped (was on ${state.taskDir})`, "info");
			} else {
				ctx.ui.notify("No marathon loop running", "warning");
			}
		},
	});

	pi.registerCommand("marathon-status", {
		description: "Show marathon loop status",
		handler: async (_args, ctx) => {
			const state = loadState();
			if (!state) {
				ctx.ui.notify("No marathon loop running", "info");
				return;
			}
			ctx.ui.notify(`Marathon: RUNNING | Task: ${state.taskDir} | Iteration: ${state.iteration}`, "info");
		},
	});

	// After each agent turn, check if we should continue
	pi.on("agent_end", async (_event, ctx) => {
		const state = loadState();
		if (!state) return;

		// Check completion
		if (isComplete(state.taskDir, ctx.cwd)) {
			ctx.ui.notify(`🎉 Marathon complete! See ${state.taskDir}/result.md`, "success");
			ctx.ui.setStatus("marathon", undefined);
			clearState();
			return;
		}

		// Safety limit
		if (state.iteration >= MAX_ITERATIONS) {
			ctx.ui.notify(`⚠️ Marathon stopped: reached ${MAX_ITERATIONS} iterations`, "warning");
			ctx.ui.setStatus("marathon", undefined);
			clearState();
			return;
		}

		// Update state for next iteration
		saveState({ ...state, iteration: state.iteration + 1 });

		ctx.ui.setStatus("marathon", `🏃 Marathon: restarting for iteration ${state.iteration + 2}...`);
		ctx.ui.notify(`Restarting pi for fresh session (iteration ${state.iteration + 2})...`, "info");

		// Small delay then shutdown - wrapper script will restart
		await new Promise((r) => setTimeout(r, 2000));

		// Shutdown triggers the wrapper to restart pi
		ctx.shutdown();
	});
}
