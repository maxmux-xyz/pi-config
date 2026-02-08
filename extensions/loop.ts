/**
 * Loop Extension - Tools and hooks for pi-loop
 * 
 * - `exit` tool: Agent signals loop termination
 * - Token tracking: Injects warning at threshold
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const TOKEN_THRESHOLD = 90_000;

export default function (pi: ExtensionAPI) {
	let totalTokens = 0;
	let warningInjected = false;

	// Track token usage
	pi.on("agent_response", async (event) => {
		if (event.usage) {
			totalTokens = event.usage.input + event.usage.output + 
			              (event.usage.cacheRead || 0) + (event.usage.cacheWrite || 0);
		}
	});

	// Inject warning when approaching threshold
	pi.on("agent_end", async (_event, ctx) => {
		if (!process.env.PI_LOOP_DIR) return;
		if (warningInjected) return;
		
		if (totalTokens >= TOKEN_THRESHOLD) {
			warningInjected = true;
			pi.sendUserMessage(
				"⚠️ TOKEN THRESHOLD REACHED (~90k). " +
				"Wrap up your current work, write progress.md, and call `exit()` to end this iteration cleanly. " +
				"You'll continue in the next iteration with fresh context."
			);
		}
	});

	pi.registerTool({
		name: "exit",
		description: `Exit the pi-loop and STOP it. Only call when:
- Task is COMPLETE (done=true) - loop stops successfully
- STUCK and need human help (done=false) - loop stops for intervention

Do NOT call exit if you just want to continue in the next iteration.
To continue: just finish your response - pi will exit and loop will restart you with fresh context.`,
		parameters: Type.Object({
			reason: Type.String({ description: "Why exiting" }),
			done: Type.Boolean({ description: "true=task complete, false=need help or continuing" }),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const taskDir = process.env.PI_LOOP_DIR;
			if (!taskDir) {
				return {
					content: [{ type: "text" as const, text: "Not in pi-loop (PI_LOOP_DIR not set)" }],
				};
			}

			const file = params.done ? "DONE" : "EXIT";
			writeFileSync(join(taskDir, file), params.reason);
			
			ctx.shutdown();

			return {
				content: [{ type: "text" as const, text: `Loop exiting: ${params.reason}` }],
			};
		},
	});
}
