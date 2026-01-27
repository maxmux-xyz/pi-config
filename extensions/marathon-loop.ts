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
 *   /marathon-pause                             - Pause loop (edit md files)
 *   /marathon-continue                          - Resume paused loop
 *   /marathon-steer <message>                   - Inject guidance for next iteration
 *
 * Agent tool:
 *   marathon_wait(minutes, reason)              - Agent can request delay before next iteration
 *                                                 (for waiting on CI, deployments, etc.)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// State files are stored per-runner-instance to allow concurrent marathons
const STATES_DIR = join(homedir(), ".pi", "marathon-states");

interface MarathonState {
	taskDir: string;
	cwd: string;
	iteration: number;
	runnerId?: string;
	paused?: boolean;
	steerMessage?: string; // One-time message to inject into next iteration
	waitSeconds?: number; // Delay before next iteration (for waiting on external jobs)
}

// Get runner ID from environment (set by marathon-runner.sh)
function getRunnerId(): string | null {
	return process.env.MARATHON_RUNNER_ID || null;
}

// Get task dir from environment (set by marathon-runner.sh --task)
function getAutoStartTaskDir(): string | null {
	return process.env.MARATHON_TASK_DIR || null;
}

function stateFilePath(): string | null {
	const runnerId = getRunnerId();
	if (!runnerId) return null;
	return join(STATES_DIR, `${runnerId}.json`);
}

function loadState(): MarathonState | null {
	const stateFile = stateFilePath();
	if (!stateFile || !existsSync(stateFile)) return null;
	try {
		return JSON.parse(readFileSync(stateFile, "utf8"));
	} catch {
		return null;
	}
}

function saveState(state: MarathonState): void {
	const stateFile = stateFilePath();
	if (!stateFile) return;
	mkdirSync(STATES_DIR, { recursive: true });
	writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function clearState(): void {
	const stateFile = stateFilePath();
	if (stateFile && existsSync(stateFile)) {
		unlinkSync(stateFile);
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

	// Helper to start a marathon (shared by auto-start and /marathon-loop command)
	function startMarathon(taskDir: string, ctx: Parameters<Parameters<typeof pi.on>[1]>[1]) {
		const runnerId = getRunnerId();
		if (!runnerId) {
			ctx.ui.notify("Must be running under marathon-runner.sh", "error");
			return false;
		}

		const fullPath = join(ctx.cwd, taskDir);
		if (!existsSync(fullPath)) {
			ctx.ui.notify(`Task directory not found: ${fullPath}`, "error");
			return false;
		}

		const instructionsPath = join(fullPath, "instructions.md");
		if (!existsSync(instructionsPath)) {
			ctx.ui.notify(`Missing instructions.md in ${taskDir}`, "error");
			return false;
		}

		if (isComplete(taskDir, ctx.cwd)) {
			ctx.ui.notify(`Task already complete! See ${taskDir}/result.md`, "info");
			return false;
		}

		// Save state for the loop
		saveState({ taskDir, cwd: ctx.cwd, iteration: 0, runnerId });

		ctx.ui.notify(`🏃 Starting marathon loop on ${taskDir}`, "info");
		ctx.ui.setStatus("marathon", "🏃 Marathon running...");

		// Trigger first prompt
		pi.sendUserMessage(`marathon skill on ${taskDir}`);
		return true;
	}

	// On session start, check if we're resuming a marathon or auto-starting one
	pi.on("session_start", async (_event, ctx) => {
		const runnerId = getRunnerId();
		if (!runnerId) return; // Not running under marathon-runner.sh

		const state = loadState();
		
		// If no existing state, check for auto-start task dir
		if (!state) {
			const autoStartTaskDir = getAutoStartTaskDir();
			if (autoStartTaskDir) {
				// Auto-start the marathon (small delay to let UI settle)
				setTimeout(() => {
					startMarathon(autoStartTaskDir, ctx);
				}, 500);
			}
			return;
		}

		// Validate cwd matches (in case runner was restarted in wrong dir)
		if (state.cwd !== ctx.cwd) {
			ctx.ui.notify(`Marathon state cwd mismatch. Expected: ${state.cwd}`, "warning");
			clearState();
			return;
		}

		// Check if paused - just show status and wait for /marathon-continue
		if (state.paused) {
			ctx.ui.setStatus("marathon", "⏸️ Marathon paused");
			ctx.ui.notify(`⏸️ Marathon paused on ${state.taskDir} (iteration ${state.iteration}). Use /marathon-continue when ready.`, "info");
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

		// Build prompt with optional steer message
		let prompt = `marathon skill on ${state.taskDir}`;
		if (state.steerMessage) {
			prompt += `\n\nIMPORTANT GUIDANCE FROM HUMAN: ${state.steerMessage}`;
			ctx.ui.notify(`📣 Including steer message: "${state.steerMessage}"`, "info");
			// Clear the steer message after use
			saveState({ ...state, steerMessage: undefined });
		}

		// Small delay then trigger
		setTimeout(() => {
			pi.sendUserMessage(prompt);
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

			if (!getRunnerId()) {
				ctx.ui.notify("Must be running under marathon-runner.sh to use /marathon-loop", "error");
				ctx.ui.notify("Start with: ~/.pi/agent/scripts/marathon-runner.sh", "info");
				return;
			}

			startMarathon(taskDir, ctx);
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
				ctx.ui.notify("No marathon loop running (or not in marathon-runner.sh)", "warning");
			}
		},
	});

	pi.registerCommand("marathon-status", {
		description: "Show marathon loop status",
		handler: async (_args, ctx) => {
			const runnerId = getRunnerId();
			if (!runnerId) {
				ctx.ui.notify("Not running under marathon-runner.sh", "info");
				return;
			}
			const state = loadState();
			if (!state) {
				ctx.ui.notify(`Runner ID: ${runnerId} | No active marathon`, "info");
				return;
			}
			const pauseStatus = state.paused ? " | ⏸️ PAUSED" : "";
			ctx.ui.notify(`Runner: ${runnerId} | Task: ${state.taskDir} | Iteration: ${state.iteration}${pauseStatus}`, "info");
			if (state.steerMessage) {
				ctx.ui.notify(`📣 Pending steer: "${state.steerMessage}"`, "info");
			}
			if (state.waitSeconds) {
				ctx.ui.notify(`⏳ Pending wait: ${Math.round(state.waitSeconds / 60)}m before next iteration`, "info");
			}
		},
	});

	pi.registerCommand("marathon-pause", {
		description: "Pause the marathon loop (human can edit md files)",
		handler: async (_args, ctx) => {
			const state = loadState();
			if (!state) {
				ctx.ui.notify("No marathon loop running", "warning");
				return;
			}
			if (state.paused) {
				ctx.ui.notify("Marathon is already paused", "info");
				return;
			}
			saveState({ ...state, paused: true });
			ctx.ui.setStatus("marathon", "⏸️ Marathon pausing...");
			ctx.ui.notify(`⏸️ Marathon will pause after current iteration completes`, "info");
			ctx.ui.notify(`Then edit your md files and /marathon-continue`, "info");
		},
	});

	pi.registerCommand("marathon-continue", {
		description: "Continue a paused marathon loop",
		handler: async (_args, ctx) => {
			const runnerId = getRunnerId();
			if (!runnerId) {
				ctx.ui.notify("Must be running under marathon-runner.sh", "error");
				return;
			}
			const state = loadState();
			if (!state) {
				ctx.ui.notify("No marathon loop to continue", "warning");
				return;
			}
			if (!state.paused) {
				ctx.ui.notify("Marathon is not paused", "info");
				return;
			}
			// Check completion before resuming
			if (isComplete(state.taskDir, ctx.cwd)) {
				ctx.ui.notify(`🎉 Marathon already complete! See ${state.taskDir}/result.md`, "success");
				clearState();
				return;
			}
			// Build prompt with optional steer message
			let prompt = `marathon skill on ${state.taskDir}`;
			if (state.steerMessage) {
				prompt += `\n\nIMPORTANT GUIDANCE FROM HUMAN: ${state.steerMessage}`;
				ctx.ui.notify(`📣 Including steer message: "${state.steerMessage}"`, "info");
			}
			// Clear paused and steerMessage
			saveState({ ...state, paused: false, steerMessage: undefined });
			ctx.ui.setStatus("marathon", `🏃 Marathon: iteration ${state.iteration + 1}...`);
			ctx.ui.notify(`▶️ Marathon continuing (iteration ${state.iteration + 1})`, "info");
			// Trigger next run
			pi.sendUserMessage(prompt);
		},
	});

	pi.registerCommand("marathon-steer", {
		description: "Inject guidance message for next marathon iteration",
		handler: async (args, ctx) => {
			const message = args.trim();
			if (!message) {
				ctx.ui.notify("Usage: /marathon-steer <guidance message>", "error");
				return;
			}
			const state = loadState();
			if (!state) {
				ctx.ui.notify("No marathon loop running", "warning");
				return;
			}
			saveState({ ...state, steerMessage: message });
			ctx.ui.notify(`📣 Steer message set: "${message}"`, "info");
			if (!state.paused) {
				ctx.ui.notify("Note: Message will be included in next iteration after current one completes", "info");
			} else {
				ctx.ui.notify("Message will be included when you /marathon-continue", "info");
			}
		},
	});

	// Tool for the agent to request a wait before next iteration
	pi.registerTool({
		name: "marathon_wait",
		label: "Marathon Wait",
		description:
			"Request a delay before the next marathon iteration. Use this when you've triggered an external job (CI, deployment, etc.) and need to wait for it to complete before continuing. IMPORTANT: After calling this tool, you MUST immediately end your turn - do not continue with more work. The session will end and the runner will wait before restarting.",
		parameters: Type.Object({
			minutes: Type.Number({ description: "Number of minutes to wait before next iteration (1-60)" }),
			reason: Type.String({ description: "Why the wait is needed (e.g., 'waiting for CI pipeline to complete')" }),
		}),
		async execute(_toolCallId, params, _onUpdate, ctx) {
			const runnerId = getRunnerId();
			if (!runnerId) {
				return {
					content: [{ type: "text" as const, text: "Not running under marathon-runner.sh - wait request ignored" }],
				};
			}

			const state = loadState();
			if (!state) {
				return {
					content: [{ type: "text" as const, text: "No active marathon - wait request ignored" }],
				};
			}

			const minutes = Math.max(1, Math.min(60, params.minutes)); // Clamp 1-60
			const waitSeconds = minutes * 60;

			saveState({ ...state, waitSeconds });

			// Debug: confirm what was saved
			const stateFile = stateFilePath();
			ctx.ui.notify(`⏳ Marathon will wait ${minutes}m before next iteration: ${params.reason}`, "info");
			ctx.ui.notify(`[debug] Saved waitSeconds=${waitSeconds} to ${stateFile}`, "info");
			ctx.ui.setStatus("marathon", `⏳ Will wait ${minutes}m after this iteration`);

			return {
				content: [
					{
						type: "text" as const,
						text: `⏳ WAIT SCHEDULED: ${minutes} minute(s) before next marathon iteration.
Reason: ${params.reason}

**CRITICAL: You must STOP NOW.** Do not continue with any more work. End your response immediately so the session can terminate and the wait can begin.

Say: "Wait scheduled for ${minutes} minutes. Session ending now." and STOP.`,
					},
				],
			};
		},
	});

	// After each agent turn, check if we should continue
	pi.on("agent_end", async (_event, ctx) => {
		const runnerId = getRunnerId();
		if (!runnerId) return; // Not running under marathon-runner.sh

		const state = loadState();
		if (!state) return;

		// Debug: show what we loaded
		ctx.ui.notify(`[debug] agent_end: loaded state iteration=${state.iteration} waitSeconds=${state.waitSeconds} paused=${state.paused}`, "info");

		// Check if paused
		if (state.paused) {
			ctx.ui.setStatus("marathon", "⏸️ Marathon paused");
			ctx.ui.notify(`⏸️ Marathon paused. Use /marathon-continue when ready.`, "info");
			return;
		}

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

		// Update state for next iteration, preserving waitSeconds if set
		const newState = { ...state, iteration: state.iteration + 1 };
		saveState(newState);
		ctx.ui.notify(`[debug] agent_end: saved state iteration=${newState.iteration} waitSeconds=${newState.waitSeconds}`, "info");

		ctx.ui.setStatus("marathon", `🏃 Marathon: restarting for iteration ${state.iteration + 2}...`);
		ctx.ui.notify(`Restarting pi for fresh session (iteration ${state.iteration + 2})...`, "info");

		// Small delay then shutdown - wrapper script will restart
		await new Promise((r) => setTimeout(r, 2000));

		// Shutdown triggers the wrapper to restart pi
		ctx.shutdown();
	});
}
