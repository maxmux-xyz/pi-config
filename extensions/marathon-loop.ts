/**
 * Marathon Loop Extension - Auto-run /loop skill until completion
 *
 * Automatically restarts the /loop skill after each iteration completes,
 * continuing until STATE.json indicates paused or completed.
 *
 * This extension works with an external wrapper script (pi-marathon) that:
 * 1. Starts pi
 * 2. When pi exits, checks if marathon state file exists
 * 3. If yes, restarts pi with the continuation prompt
 *
 * Skills:
 *   /scribe  - Create task directories (setup)
 *   /loop    - Execute iterations (compact: mindset + state + RPI)
 *   /rpi     - Full Research-Plan-Implement details (reference)
 *   /ralph   - Ralph Wiggum pattern background (reference)
 *   /marathon - State file mechanics (reference)
 *
 * Task directory files:
 *   STATE.json      - Task state (running/paused/completed), managed by extension
 *   instructions.md - Task instructions (user-created via /scribe)
 *   work.md         - Work log (agent-managed, append-only)
 *   result.md       - Final results (agent-managed)
 *
 * Usage:
 *   pi-marathon --task docs/tasks/my-task       - Start marathon on task
 *   pi-marathon --task <path> -h "feedback"     - Restart completed task with feedback
 *   pi-marathon                                 - Start runner, then /marathon-loop
 *   /marathon-loop docs/tasks/my-investigation  - Start loop manually
 *   /marathon-status                            - Show current status
 *   /marathon-steer <message>                   - Inject guidance for next iteration
 *
 * Agent tools:
 *   wait(minutes, reason)                       - Agent requests delay for external process
 *                                                 (for waiting on CI, deployments, etc.)
 *
 * To stop/pause: Edit STATE.json in task dir or have agent set state to "paused"
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Runner state files are stored per-runner-instance to allow concurrent marathons
const STATES_DIR = join(homedir(), ".pi", "marathon-states");

// Runner state (internal, in ~/.pi/marathon-states/)
interface RunnerState {
	taskDir: string;
	cwd: string;
	runnerId?: string;
	steerMessage?: string; // One-time message to inject into next iteration
	waitSeconds?: number; // Delay before next iteration (for waiting on external jobs)
	feedbackQuestion?: string; // Question agent wants to ask human
	feedbackAnswer?: string; // Human's answer to the question
}

// Task state (in task directory as STATE.json)
interface TaskState {
	state: "running" | "paused" | "completed";
	phase: "research" | "plan" | "implement" | "done";
	iteration: number;
	updatedAt: string;
	note: string | null;
}

// Get runner ID from environment (set by pi-marathon)
function getRunnerId(): string | null {
	return process.env.MARATHON_RUNNER_ID || null;
}

// Get task dir from environment (set by pi-marathon --task)
function getAutoStartTaskDir(): string | null {
	return process.env.MARATHON_TASK_DIR || null;
}

// Get human feedback from environment (set by pi-marathon -h)
function getStartupHumanFeedback(): string | null {
	return process.env.MARATHON_HUMAN_FEEDBACK || null;
}

function runnerStateFilePath(): string | null {
	const runnerId = getRunnerId();
	if (!runnerId) return null;
	return join(STATES_DIR, `${runnerId}.json`);
}

function loadRunnerState(): RunnerState | null {
	const stateFile = runnerStateFilePath();
	if (!stateFile || !existsSync(stateFile)) return null;
	try {
		return JSON.parse(readFileSync(stateFile, "utf8"));
	} catch {
		return null;
	}
}

function saveRunnerState(state: RunnerState): void {
	const stateFile = runnerStateFilePath();
	if (!stateFile) return;
	mkdirSync(STATES_DIR, { recursive: true });
	writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function clearRunnerState(): void {
	const stateFile = runnerStateFilePath();
	if (stateFile && existsSync(stateFile)) {
		unlinkSync(stateFile);
	}
}

// Task STATE.json helpers
function taskStateFilePath(taskDir: string, cwd: string): string {
	return join(cwd, taskDir, "STATE.json");
}

function loadTaskState(taskDir: string, cwd: string): TaskState | null {
	const stateFile = taskStateFilePath(taskDir, cwd);
	if (!existsSync(stateFile)) return null;
	try {
		return JSON.parse(readFileSync(stateFile, "utf8"));
	} catch {
		return null;
	}
}

function saveTaskState(taskDir: string, cwd: string, state: TaskState): void {
	const stateFile = taskStateFilePath(taskDir, cwd);
	writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function createInitialTaskState(): TaskState {
	return {
		state: "running",
		phase: "research",
		iteration: 1,
		updatedAt: new Date().toISOString(),
		note: null,
	};
}

export default function (pi: ExtensionAPI) {
	const MAX_ITERATIONS = 100; // Safety limit

	// Check if task should continue running
	function shouldContinue(taskDir: string, cwd: string): { continue: boolean; reason: string; taskState: TaskState | null } {
		const taskState = loadTaskState(taskDir, cwd);
		
		if (!taskState) {
			return { continue: false, reason: "STATE.json not found", taskState: null };
		}
		
		if (taskState.state === "completed") {
			return { continue: false, reason: "Task completed", taskState };
		}
		
		if (taskState.state === "paused") {
			const note = taskState.note ? `: ${taskState.note}` : "";
			return { continue: false, reason: `Task paused${note}`, taskState };
		}
		
		if (taskState.state !== "running") {
			return { continue: false, reason: `Invalid state: "${taskState.state}" (must be running/paused/completed)`, taskState };
		}
		
		if (taskState.iteration >= MAX_ITERATIONS) {
			return { continue: false, reason: `Reached max iterations (${MAX_ITERATIONS})`, taskState };
		}
		
		return { continue: true, reason: "running", taskState };
	}

	// Helper to start a marathon (shared by auto-start and /marathon-loop command)
	function startMarathon(taskDir: string, ctx: Parameters<Parameters<typeof pi.on>[1]>[1], humanFeedback?: string) {
		const runnerId = getRunnerId();
		if (!runnerId) {
			ctx.ui.notify("Must be running under pi-marathon", "error");
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

		// Check if STATE.json already exists
		const existingTaskState = loadTaskState(taskDir, ctx.cwd);
		if (existingTaskState) {
			if (existingTaskState.state === "completed") {
				ctx.ui.notify(`Task already completed! See ${taskDir}/result.md`, "info");
				return false;
			}
			if (existingTaskState.state === "paused") {
				// Resume from paused state
				ctx.ui.notify(`Resuming paused task (iteration ${existingTaskState.iteration})`, "info");
				saveTaskState(taskDir, ctx.cwd, {
					...existingTaskState,
					state: "running",
					updatedAt: new Date().toISOString(),
					note: null,
				});
			}
			// If already running, just continue
		} else {
			// Create initial STATE.json
			saveTaskState(taskDir, ctx.cwd, createInitialTaskState());
		}

		// Save runner state for the loop
		saveRunnerState({ taskDir, cwd: ctx.cwd, runnerId });

		ctx.ui.notify(`🏃 Starting marathon loop on ${taskDir}`, "info");
		ctx.ui.setStatus("marathon", "🏃 Marathon running...");

		// Trigger first prompt - use compact /loop skill
		let prompt = `/loop on ${taskDir}`;
		if (humanFeedback) {
			prompt += `\n\nHUMAN FEEDBACK (task restart): ${humanFeedback}`;
			ctx.ui.notify(`💬 Including startup feedback: "${humanFeedback.substring(0, 50)}${humanFeedback.length > 50 ? '...' : ''}"`, "info");
		}
		pi.sendUserMessage(prompt);
		return true;
	}

	// On session start, check if we're resuming a marathon or auto-starting one
	pi.on("session_start", async (_event, ctx) => {
		const runnerId = getRunnerId();
		if (!runnerId) return; // Not running under pi-marathon

		const runnerState = loadRunnerState();
		
		// If no existing runner state, check for auto-start task dir
		if (!runnerState) {
			const autoStartTaskDir = getAutoStartTaskDir();
			if (autoStartTaskDir) {
				const humanFeedback = getStartupHumanFeedback();
				// Auto-start the marathon (small delay to let UI settle)
				setTimeout(() => {
					startMarathon(autoStartTaskDir, ctx, humanFeedback || undefined);
				}, 500);
			}
			return;
		}

		// Validate cwd matches (in case runner was restarted in wrong dir)
		if (runnerState.cwd !== ctx.cwd) {
			ctx.ui.notify(`Marathon state cwd mismatch. Expected: ${runnerState.cwd}`, "warning");
			clearRunnerState();
			return;
		}

		// Check task state
		const { continue: shouldRun, reason, taskState } = shouldContinue(runnerState.taskDir, ctx.cwd);
		
		if (!taskState) {
			ctx.ui.notify(`❌ ${reason} in ${runnerState.taskDir}`, "error");
			clearRunnerState();
			return;
		}

		if (!shouldRun) {
			if (taskState.state === "completed") {
				ctx.ui.notify(`🎉 Marathon complete! See ${runnerState.taskDir}/result.md`, "success");
			} else if (taskState.state === "paused") {
				ctx.ui.setStatus("marathon", "⏸️ Marathon paused");
				ctx.ui.notify(`⏸️ ${reason}`, "info");
				ctx.ui.notify(`Edit STATE.json and run /marathon-loop ${runnerState.taskDir} to resume`, "info");
			} else {
				ctx.ui.notify(`⚠️ Marathon stopped: ${reason}`, "warning");
			}
			ctx.ui.setStatus("marathon", undefined);
			clearRunnerState();
			return;
		}

		// Continue the marathon
		ctx.ui.notify(`🏃 Resuming marathon (iteration ${taskState.iteration}) on ${runnerState.taskDir}`, "info");
		ctx.ui.setStatus("marathon", `🏃 Marathon: iteration ${taskState.iteration}...`);

		// Build prompt with optional steer message or feedback answer - use compact /loop skill
		let prompt = `/loop on ${runnerState.taskDir}`;
		if (runnerState.feedbackAnswer) {
			prompt += `\n\nHUMAN FEEDBACK RESPONSE: ${runnerState.feedbackAnswer}`;
			ctx.ui.notify(`💬 Including human feedback answer`, "info");
			// Clear the feedback answer after use
			saveRunnerState({ ...runnerState, feedbackAnswer: undefined, feedbackQuestion: undefined });
		} else if (runnerState.steerMessage) {
			prompt += `\n\nIMPORTANT GUIDANCE FROM HUMAN: ${runnerState.steerMessage}`;
			ctx.ui.notify(`📣 Including steer message: "${runnerState.steerMessage}"`, "info");
			// Clear the steer message after use
			saveRunnerState({ ...runnerState, steerMessage: undefined });
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
				ctx.ui.notify("Must be running under pi-marathon to use /marathon-loop", "error");
				ctx.ui.notify("Start with: pi-marathon", "info");
				return;
			}

			startMarathon(taskDir, ctx);
		},
	});

	pi.registerCommand("marathon-status", {
		description: "Show marathon loop status",
		handler: async (_args, ctx) => {
			const runnerId = getRunnerId();
			if (!runnerId) {
				ctx.ui.notify("Not running under pi-marathon", "info");
				return;
			}
			const runnerState = loadRunnerState();
			if (!runnerState) {
				ctx.ui.notify(`Runner ID: ${runnerId} | No active marathon`, "info");
				return;
			}
			
			const taskState = loadTaskState(runnerState.taskDir, ctx.cwd);
			if (!taskState) {
				ctx.ui.notify(`Runner: ${runnerId} | Task: ${runnerState.taskDir} | STATE.json missing!`, "warning");
				return;
			}
			
			const stateEmoji = taskState.state === "running" ? "🏃" : taskState.state === "paused" ? "⏸️" : "✅";
			const phaseEmoji = taskState.phase === "research" ? "🔍" : taskState.phase === "plan" ? "📝" : taskState.phase === "implement" ? "⚡" : "✅";
			ctx.ui.notify(`Runner: ${runnerId} | Task: ${runnerState.taskDir}`, "info");
			ctx.ui.notify(`${stateEmoji} State: ${taskState.state} | ${phaseEmoji} Phase: ${taskState.phase} | Iteration: ${taskState.iteration}`, "info");
			
			if (taskState.note) {
				ctx.ui.notify(`📝 Note: ${taskState.note}`, "info");
			}
			if (runnerState.steerMessage) {
				ctx.ui.notify(`📣 Pending steer: "${runnerState.steerMessage}"`, "info");
			}
			if (runnerState.waitSeconds) {
				ctx.ui.notify(`⏳ Pending wait: ${Math.round(runnerState.waitSeconds / 60)}m before next iteration`, "info");
			}
		},
	});

	pi.registerCommand("marathon-continue", {
		description: "Resume paused marathon (approve current phase)",
		handler: async (_args, ctx) => {
			const runnerState = loadRunnerState();
			if (!runnerState) {
				ctx.ui.notify("No marathon to continue", "warning");
				return;
			}
			const taskState = loadTaskState(runnerState.taskDir, ctx.cwd);
			if (!taskState || taskState.state !== "paused") {
				ctx.ui.notify("Marathon not paused", "warning");
				return;
			}
			// Set to running and trigger next iteration
			saveTaskState(runnerState.taskDir, ctx.cwd, {
				...taskState,
				state: "running",
				updatedAt: new Date().toISOString(),
				note: null,
			});
			ctx.ui.notify(`▶️ Continuing marathon (phase: ${taskState.phase})`, "info");
			pi.sendUserMessage(`/loop on ${runnerState.taskDir}`);
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
			const runnerState = loadRunnerState();
			if (!runnerState) {
				ctx.ui.notify("No marathon loop running", "warning");
				return;
			}
			saveRunnerState({ ...runnerState, steerMessage: message });
			ctx.ui.notify(`📣 Steer message set: "${message}"`, "info");
			ctx.ui.notify("Message will be included in next iteration", "info");
		},
	});

	// Only register marathon tools when actually running under pi-marathon
	// This prevents agents from trying to use them outside of marathon context
	if (getRunnerId()) {
		// Tool for the agent to request a wait before next iteration
		pi.registerTool({
			name: "wait",
			label: "Wait",
			description:
				"Request a delay when waiting for an external process (CI, deployment, build, etc.). After calling, end your turn immediately.",
			parameters: Type.Object({
				minutes: Type.Number({ description: "Minutes to wait (1-60)" }),
				reason: Type.String({ description: "What you're waiting for" }),
			}),
			async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
				const minutes = Math.max(1, Math.min(60, params.minutes)); // Clamp 1-60
				const waitSeconds = minutes * 60;

				// If marathon is active, register the wait with the runner
				const runnerState = loadRunnerState();
				if (runnerState) {
					saveRunnerState({ ...runnerState, waitSeconds });
				}

				ctx.ui?.notify?.(`⏳ Wait requested: ${minutes}m - ${params.reason}`, "info");

				return {
					content: [
						{
							type: "text" as const,
							text: `⏳ Wait scheduled: ${minutes} minute(s). Reason: ${params.reason}`,
						},
					],
				};
			},
		});

	}

	// After each agent turn, check if we should continue
	pi.on("agent_end", async (_event, ctx) => {
		const runnerId = getRunnerId();
		if (!runnerId) return; // Not running under pi-marathon

		const runnerState = loadRunnerState();
		if (!runnerState) return;

		// Check task state
		const { continue: shouldRun, reason, taskState } = shouldContinue(runnerState.taskDir, ctx.cwd);

		if (!taskState) {
			ctx.ui.notify(`❌ STATE.json not found - stopping marathon`, "error");
			ctx.ui.setStatus("marathon", undefined);
			clearRunnerState();
			return;
		}

		if (!shouldRun) {
			if (taskState.state === "completed") {
				ctx.ui.notify(`🎉 Marathon complete! See ${runnerState.taskDir}/result.md`, "success");
				ctx.ui.setStatus("marathon", undefined);
				clearRunnerState();
				return;
			} else if (taskState.state === "paused") {
				ctx.ui.notify(`⏸️ Marathon paused: ${reason}`, "info");
				ctx.ui.setStatus("marathon", "⏸️ Marathon paused");
				// Don't clear runner state - bash script will prompt to continue
				// Shutdown so bash script can handle the pause prompt
				await new Promise((r) => setTimeout(r, 2000));
				ctx.shutdown();
				return;
			} else {
				ctx.ui.notify(`⚠️ Marathon stopped: ${reason}`, "warning");
				ctx.ui.setStatus("marathon", undefined);
				clearRunnerState();
				return;
			}
		}

		// Increment iteration in STATE.json
		const newTaskState: TaskState = {
			...taskState,
			iteration: taskState.iteration + 1,
			updatedAt: new Date().toISOString(),
		};
		saveTaskState(runnerState.taskDir, ctx.cwd, newTaskState);

		ctx.ui.setStatus("marathon", `🏃 Marathon: restarting for iteration ${newTaskState.iteration}...`);
		ctx.ui.notify(`Restarting pi for fresh session (iteration ${newTaskState.iteration})...`, "info");

		// Small delay then shutdown - wrapper script will restart
		await new Promise((r) => setTimeout(r, 2000));

		// Shutdown triggers the wrapper to restart pi
		ctx.shutdown();
	});
}
