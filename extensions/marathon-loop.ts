/**
 * Marathon Loop Extension - Auto-run marathon skill until completion
 *
 * Automatically restarts the marathon skill after each chunk completes,
 * continuing until the task is done (result.md no longer contains "not yet complete").
 *
 * Usage:
 *   /marathon-loop docs/tasks/my-investigation  - Start auto-running
 *   /marathon-stop                              - Stop the loop
 *   /marathon-pause                             - Pause/resume the loop
 *   /marathon-status                            - Show current status
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
	let marathonTaskDir: string | null = null;
	let isPaused = false;
	let iterationCount = 0;
	const MAX_ITERATIONS = 100; // Safety limit

	function isComplete(taskDir: string, cwd: string): boolean {
		const resultFile = join(cwd, taskDir, "result.md");
		if (!existsSync(resultFile)) return false;
		const content = readFileSync(resultFile, "utf8");
		return !content.toLowerCase().includes("not yet complete");
	}

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

			marathonTaskDir = taskDir;
			isPaused = false;
			iterationCount = 0;

			ctx.ui.notify(`🏃 Starting marathon loop on ${taskDir}`, "info");
			ctx.ui.setStatus("marathon", "🏃 Marathon running...");

			// Trigger first prompt - marathon skill uses "marathon skill on <path>" format
			pi.sendUserMessage(`marathon skill on ${taskDir}`);
		},
	});

	pi.registerCommand("marathon-stop", {
		description: "Stop the marathon loop",
		handler: async (_args, ctx) => {
			if (marathonTaskDir) {
				const taskDir = marathonTaskDir;
				marathonTaskDir = null;
				isPaused = false;
				ctx.ui.setStatus("marathon", undefined);
				ctx.ui.notify(`Marathon loop stopped (was on ${taskDir})`, "info");
			} else {
				ctx.ui.notify("No marathon loop running", "warning");
			}
		},
	});

	pi.registerCommand("marathon-pause", {
		description: "Pause/resume the marathon loop",
		handler: async (_args, ctx) => {
			if (!marathonTaskDir) {
				ctx.ui.notify("No marathon loop running", "warning");
				return;
			}

			isPaused = !isPaused;
			if (isPaused) {
				ctx.ui.setStatus("marathon", "⏸️ Marathon paused");
				ctx.ui.notify("Marathon paused. Use /marathon-pause to resume.", "info");
			} else {
				ctx.ui.setStatus("marathon", "🏃 Marathon running...");
				ctx.ui.notify("Marathon resumed. Continuing on next agent end.", "info");
			}
		},
	});

	pi.registerCommand("marathon-status", {
		description: "Show marathon loop status",
		handler: async (_args, ctx) => {
			if (!marathonTaskDir) {
				ctx.ui.notify("No marathon loop running", "info");
				return;
			}

			const status = isPaused ? "PAUSED" : "RUNNING";
			ctx.ui.notify(`Marathon: ${status} | Task: ${marathonTaskDir} | Iterations: ${iterationCount}`, "info");
		},
	});

	// After each agent turn, check if we should continue
	pi.on("agent_end", async (_event, ctx) => {
		if (!marathonTaskDir || isPaused) return;

		// Check completion
		if (isComplete(marathonTaskDir, ctx.cwd)) {
			ctx.ui.notify(`🎉 Marathon complete! See ${marathonTaskDir}/result.md`, "success");
			ctx.ui.setStatus("marathon", undefined);
			marathonTaskDir = null;
			return;
		}

		// Safety limit
		iterationCount++;
		if (iterationCount >= MAX_ITERATIONS) {
			ctx.ui.notify(`⚠️ Marathon stopped: reached ${MAX_ITERATIONS} iterations`, "warning");
			ctx.ui.setStatus("marathon", undefined);
			marathonTaskDir = null;
			return;
		}

		// Continue after a short delay
		ctx.ui.setStatus("marathon", `🏃 Marathon: iteration ${iterationCount + 1}...`);
		ctx.ui.notify(`Continuing marathon (iteration ${iterationCount + 1})...`, "info");

		// Small delay to let things settle
		await new Promise((r) => setTimeout(r, 2000));

		// Check again in case user stopped during delay
		if (!marathonTaskDir || isPaused) return;

		// Capture taskDir before async operations (it could be cleared)
		const taskDir = marathonTaskDir;

		// Create a fresh session to reset token count
		// The marathon skill reads all state from files, so we don't need history
		const result = await ctx.newSession();

		if (result.cancelled) {
			ctx.ui.notify("Marathon: session creation cancelled", "warning");
			return;
		}

		// Check again after session switch
		if (!marathonTaskDir || isPaused) return;

		// Send next iteration - marathon skill uses "marathon skill on <path>" format
		pi.sendUserMessage(`marathon skill on ${taskDir}`);
	});
}
