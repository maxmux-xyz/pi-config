/**
 * Token Tracker Extension
 *
 * Tracks token consumption per session and gently nudges the agent
 * to wrap up when approaching the 70k token threshold.
 *
 * Features:
 * - Shows token usage in the footer
 * - Injects context message when approaching limit
 * - Suggests handoff/summarization when nearing 70k tokens
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// Thresholds
const SOFT_LIMIT = 80_000; // Start warning
const HARD_LIMIT = 100_000; // Strongly encourage wrapping up

function formatTokens(tokens: number): string {
	if (tokens >= 1000) {
		return `${(tokens / 1000).toFixed(1)}k`;
	}
	return `${tokens}`;
}

function getUsageLevel(tokens: number): "normal" | "warning" | "critical" {
	if (tokens >= HARD_LIMIT) return "critical";
	if (tokens >= SOFT_LIMIT) return "warning";
	return "normal";
}

function getStatusColor(level: "normal" | "warning" | "critical"): string {
	switch (level) {
		case "critical":
			return "error";
		case "warning":
			return "warning";
		default:
			return "dim";
	}
}

function updateStatus(ctx: ExtensionContext): void {
	const usage = ctx.getContextUsage();
	if (!usage || !ctx.hasUI) return;

	const level = getUsageLevel(usage.tokens);
	const theme = ctx.ui.theme;
	const colorName = getStatusColor(level);

	let icon = "●";
	if (level === "critical") icon = "⚠";
	else if (level === "warning") icon = "◐";

	const text = `${icon} ${formatTokens(usage.tokens)} tokens`;
	ctx.ui.setStatus("token-tracker", theme.fg(colorName, text));
}

function getContextMessage(tokens: number): string | null {
	const level = getUsageLevel(tokens);

	if (level === "critical") {
		return `[TOKEN BUDGET: ${formatTokens(tokens)}/${formatTokens(HARD_LIMIT)} - CRITICAL]
You are approaching the context limit. Please:
1. Wrap up your current analysis/work
2. Provide a clear summary of what you've found or accomplished
3. Suggest the user run /handoff or start a fresh session for continued work

Consider creating a handoff summary with key findings, file paths, and next steps.`;
	}

	if (level === "warning") {
		return `[TOKEN BUDGET: ${formatTokens(tokens)}/${formatTokens(HARD_LIMIT)} - ${Math.round((tokens / HARD_LIMIT) * 100)}% used]
Context usage is elevated. Consider being concise and focused. If the task is complex, you may want to suggest breaking it into smaller sessions.`;
	}

	return null;
}

export default function (pi: ExtensionAPI) {
	// Update status on session start
	pi.on("session_start", async (_event, ctx) => {
		updateStatus(ctx);
	});

	// Update status after session switch
	pi.on("session_switch", async (_event, ctx) => {
		updateStatus(ctx);
	});

	// Inject context message and system prompt reminder when approaching limit
	pi.on("before_agent_start", async (event, ctx) => {
		const usage = ctx.getContextUsage();
		if (!usage) return;

		const level = getUsageLevel(usage.tokens);
		const message = getContextMessage(usage.tokens);

		// Build result object
		const result: {
			message?: {
				customType: string;
				content: string;
				display: boolean;
			};
			systemPrompt?: string;
		} = {};

		// Inject message for the LLM
		if (message) {
			result.message = {
				customType: "token-tracker-context",
				content: message,
				display: false, // Don't show to user, just inject for LLM
			};
		}

		// Add system prompt reminder for critical level (applies to all turns)
		if (level === "critical") {
			const reminder = `\n\n[TOKEN BUDGET CRITICAL: ${formatTokens(usage.tokens)}/${formatTokens(HARD_LIMIT)} tokens used. Wrap up work and suggest /handoff.]`;
			result.systemPrompt = event.systemPrompt + reminder;
		}

		if (result.message || result.systemPrompt) {
			return result;
		}
	});

	// Update status at start of each turn
	pi.on("turn_start", async (_event, ctx) => {
		updateStatus(ctx);
	});

	// Update status at the end of each turn with latest counts
	pi.on("turn_end", async (_event, ctx) => {
		updateStatus(ctx);
	});

	// Also update after tool results (for more real-time feedback)
	pi.on("tool_result", async (_event, ctx) => {
		updateStatus(ctx);
	});

	// Command to check current usage
	pi.registerCommand("tokens", {
		description: "Show current token usage for the session",
		handler: async (_args, ctx) => {
			const usage = ctx.getContextUsage();
			if (!usage) {
				ctx.ui.notify("Token usage not available", "info");
				return;
			}

			const level = getUsageLevel(usage.tokens);
			const percentage = Math.round((usage.tokens / HARD_LIMIT) * 100);
			const remaining = Math.max(0, HARD_LIMIT - usage.tokens);

			let statusEmoji = "✓";
			let statusType: "info" | "warning" | "error" = "info";
			if (level === "critical") {
				statusEmoji = "⚠";
				statusType = "error";
			} else if (level === "warning") {
				statusEmoji = "◐";
				statusType = "warning";
			}

			const message = `${statusEmoji} Token Usage: ${formatTokens(usage.tokens)} / ${formatTokens(HARD_LIMIT)} (${percentage}%)
Remaining: ~${formatTokens(remaining)} tokens
Status: ${level.toUpperCase()}`;

			ctx.ui.notify(message, statusType);
		},
	});
}
