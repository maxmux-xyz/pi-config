/**
 * Token Injection Extension
 *
 * Injects cumulative token usage into every LLM call via the `context` event.
 * The LLM sees a token summary appended to the last message before each call.
 *
 * Shows: input / output / cache_read / cache_write / total + context window %.
 *
 * Note: Anthropic includes thinking tokens in `output`. There's no separate
 * thinking token field in pi's Usage type.
 *
 * Usage: Auto-loaded from ~/.pi/agent/extensions/
 *        Or test with: pi -e ./token-inject.ts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const formatTokens = (n: number): string => {
		if (n < 1000) return `${n}`;
		if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
		if (n < 1000000) return `${Math.round(n / 1000)}k`;
		return `${(n / 1000000).toFixed(1)}M`;
	};

	pi.on("context", async (event, ctx) => {
		// Calculate cumulative usage from all assistant messages in the session
		let totalInput = 0;
		let totalOutput = 0;
		let totalCacheRead = 0;
		let totalCacheWrite = 0;
		let totalTokens = 0;
		let totalCost = 0;
		let turnCount = 0;

		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				totalInput += entry.message.usage.input;
				totalOutput += entry.message.usage.output;
				totalCacheRead += entry.message.usage.cacheRead;
				totalCacheWrite += entry.message.usage.cacheWrite;
				totalTokens += entry.message.usage.totalTokens;
				totalCost += entry.message.usage.cost.total;
				turnCount++;
			}
		}

		// Get context window usage
		const contextUsage = ctx.getContextUsage();
		const ctxPercent = contextUsage?.percent !== null && contextUsage?.percent !== undefined
			? `${contextUsage.percent.toFixed(1)}%`
			: "?";
		const ctxWindow = contextUsage?.contextWindow
			? formatTokens(contextUsage.contextWindow)
			: "?";

		// Build the token info string
		const parts: string[] = [];
		parts.push(`in:${formatTokens(totalInput)}`);
		parts.push(`out:${formatTokens(totalOutput)}`);
		if (totalCacheRead > 0) parts.push(`cache_r:${formatTokens(totalCacheRead)}`);
		if (totalCacheWrite > 0) parts.push(`cache_w:${formatTokens(totalCacheWrite)}`);
		parts.push(`total:${formatTokens(totalTokens)}`);
		parts.push(`$${totalCost.toFixed(3)}`);
		parts.push(`ctx:${ctxPercent}/${ctxWindow}`);

		const tokenInfo = `[tokens | ${parts.join(" | ")} | turns:${turnCount}]`;

		// Inject into the last message
		const messages = event.messages;
		if (messages.length === 0) return;

		const lastMsg = messages[messages.length - 1];

		if (lastMsg.role === "user") {
			// Append to user message content
			if (typeof lastMsg.content === "string") {
				lastMsg.content = `${lastMsg.content}\n\n${tokenInfo}`;
			} else if (Array.isArray(lastMsg.content)) {
				lastMsg.content = [
					...lastMsg.content,
					{ type: "text" as const, text: `\n\n${tokenInfo}` },
				];
			}
		} else if (lastMsg.role === "toolResult") {
			// Append to tool result content
			if (Array.isArray(lastMsg.content) && lastMsg.content.length > 0) {
				const lastContent = lastMsg.content[lastMsg.content.length - 1];
				if (lastContent && lastContent.type === "text") {
					lastContent.text = `${lastContent.text}\n\n${tokenInfo}`;
				} else {
					lastMsg.content = [
						...lastMsg.content,
						{ type: "text" as const, text: tokenInfo },
					];
				}
			} else {
				lastMsg.content = [{ type: "text" as const, text: tokenInfo }];
			}
		}
		// For assistant messages (rare to be last before LLM call), we skip injection
		// since the LLM shouldn't see its own previous message modified

		return { messages };
	});
}
