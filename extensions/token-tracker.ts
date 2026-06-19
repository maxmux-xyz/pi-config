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
const HARD_LIMIT = 110_000; // Strongly encourage wrapping up

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


export default function (pi: ExtensionAPI) {
	// Update status on session start
	pi.on("session_start", async (_event, ctx) => {
		updateStatus(ctx);
	});

	// Update status after session switch
	pi.on("session_switch", async (_event, ctx) => {
		updateStatus(ctx);
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
