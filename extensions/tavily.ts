/**
 * Tavily Search Tool - Search the web using Tavily's Search API
 *
 * Provides real-time web search capabilities optimized for AI agents.
 * Requires TAVILY_API_KEY environment variable.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateHead, formatSize, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";

const TAVILY_API_ENDPOINT = "https://api.tavily.com/search";
const TIMEOUT_MS = 30000;

interface TavilySearchParams {
	query: string;
	searchDepth?: "basic" | "advanced";
	maxResults?: number;
	includeAnswer?: boolean;
	includeRawContent?: boolean;
	includeDomains?: string[];
	excludeDomains?: string[];
}

interface TavilyResult {
	title: string;
	url: string;
	content: string;
	raw_content?: string;
	score: number;
}

interface TavilyResponse {
	query: string;
	answer?: string;
	results: TavilyResult[];
	images?: string[];
}

interface TavilySearchDetails {
	query: string;
	searchDepth: string;
	maxResults: number;
	includeAnswer: boolean;
	resultCount?: number;
	truncated?: boolean;
	originalBytes?: number;
	originalLines?: number;
}

function getApiKey(): string | undefined {
	return process.env.TAVILY_API_KEY;
}

async function performSearch(params: TavilySearchParams, signal?: AbortSignal): Promise<string> {
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new Error("TAVILY_API_KEY environment variable not set. Get your API key at https://tavily.com");
	}

	const requestBody = {
		api_key: apiKey,
		query: params.query,
		search_depth: params.searchDepth ?? "basic",
		max_results: params.maxResults ?? 5,
		include_answer: params.includeAnswer ?? true,
		include_raw_content: params.includeRawContent ?? false,
		include_domains: params.includeDomains,
		exclude_domains: params.excludeDomains,
	};

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

	// Link external signal to our controller
	const abortHandler = () => controller.abort();
	signal?.addEventListener("abort", abortHandler);

	try {
		const response = await fetch(TAVILY_API_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Tavily API error (${response.status}): ${errorText}`);
		}

		const data: TavilyResponse = await response.json();

		// Format results
		let output = "";

		if (data.answer) {
			output += `## Answer\n${data.answer}\n\n`;
		}

		if (data.results && data.results.length > 0) {
			output += `## Search Results\n\n`;
			for (const result of data.results) {
				output += `### ${result.title}\n`;
				output += `URL: ${result.url}\n`;
				output += `Score: ${result.score.toFixed(2)}\n\n`;
				output += `${result.content}\n`;
				if (result.raw_content) {
					output += `\n**Raw Content:**\n${result.raw_content}\n`;
				}
				output += "\n---\n\n";
			}
		} else {
			output = "No search results found.";
		}

		return output.trim();
	} catch (error) {
		clearTimeout(timeoutId);
		signal?.removeEventListener("abort", abortHandler);

		if (error instanceof Error) {
			if (error.name === "AbortError") {
				if (signal?.aborted) {
					throw new Error("Search cancelled");
				}
				throw new Error(`Search request timed out after ${TIMEOUT_MS / 1000}s`);
			}
		}
		throw error;
	} finally {
		signal?.removeEventListener("abort", abortHandler);
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "tavily",
		label: "Tavily Search",
		description: `Search the web using Tavily's AI-optimized search API.

Use for:
- Real-time web search with AI-generated answers
- Current events and recent news
- Up-to-date documentation or API references
- Research requiring accurate, factual information

IMPORTANT: Never include private or sensitive information in search queries
(API keys, passwords, personal identifiable information, internal URLs, credentials, etc.)

Parameters:
- query: The search query (required)
- searchDepth: "basic" (faster) or "advanced" (more comprehensive) (default: basic)
- maxResults: Number of results to return, 1-10 (default: 5)
- includeAnswer: Whether to include AI-generated answer (default: true)
- includeRawContent: Include full page content when available (default: false)
- includeDomains: Array of domains to include (optional)
- excludeDomains: Array of domains to exclude (optional)`,

		parameters: Type.Object({
			query: Type.String({ description: "Web search query" }),
			searchDepth: Type.Optional(StringEnum(["basic", "advanced"] as const, { description: "Search depth (default: basic)" })),
			maxResults: Type.Optional(Type.Number({ description: "Number of results, 1-10 (default: 5)" })),
			includeAnswer: Type.Optional(Type.Boolean({ description: "Include AI answer (default: true)" })),
			includeRawContent: Type.Optional(Type.Boolean({ description: "Include raw page content (default: false)" })),
			includeDomains: Type.Optional(Type.Array(Type.String(), { description: "Domains to include" })),
			excludeDomains: Type.Optional(Type.Array(Type.String(), { description: "Domains to exclude" })),
		}),

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const {
				query,
				searchDepth = "basic",
				maxResults = 5,
				includeAnswer = true,
				includeRawContent = false,
				includeDomains,
				excludeDomains,
			} = params as TavilySearchParams;

			// Check for API key early
			if (!getApiKey()) {
				return {
					content: [{ type: "text", text: "Error: TAVILY_API_KEY environment variable not set. Get your API key at https://tavily.com" }],
					details: {
						query,
						searchDepth,
						maxResults,
						includeAnswer,
					} as TavilySearchDetails,
					isError: true,
				};
			}

			// Show searching state
			onUpdate?.({
				content: [{ type: "text", text: "Searching..." }],
				details: {
					query,
					searchDepth,
					maxResults,
					includeAnswer,
				} as TavilySearchDetails,
			});

			try {
				let result = await performSearch(
					{ query, searchDepth, maxResults, includeAnswer, includeRawContent, includeDomains, excludeDomains },
					signal
				);

				// Apply truncation if needed
				const truncation = truncateHead(result, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				const details: TavilySearchDetails = {
					query,
					searchDepth,
					maxResults,
					includeAnswer,
					truncated: truncation.truncated,
				};

				if (truncation.truncated) {
					details.originalBytes = truncation.totalBytes;
					details.originalLines = truncation.totalLines;

					result = truncation.content;
					result += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
					result += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
				}

				return {
					content: [{ type: "text", text: result }],
					details,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Tavily search error: ${message}` }],
					details: {
						query,
						searchDepth,
						maxResults,
						includeAnswer,
					} as TavilySearchDetails,
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			const { query, searchDepth = "basic", maxResults = 5 } = args as TavilySearchParams;

			let text = theme.fg("toolTitle", "🔎 tavily ");
			text += theme.fg("accent", `"${query}"`);
			text += "\n   " + theme.fg("muted", `${maxResults} results, ${searchDepth} depth`);

			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as TavilySearchDetails | undefined;

			// Streaming state
			if (isPartial) {
				const query = details?.query ?? "...";
				return new Text(theme.fg("warning", `🔎 Searching Tavily for "${query}"...`), 0, 0);
			}

			// Error state
			if (result.isError) {
				const errorText = result.content?.[0]?.type === "text" ? result.content[0].text : "Unknown error";
				return new Text(theme.fg("error", `✗ ${errorText}`), 0, 0);
			}

			// Success state
			const content = result.content?.[0]?.type === "text" ? result.content[0].text : "";

			// Build summary line
			let summary = theme.fg("success", "✓ ");
			summary += theme.fg("muted", `Tavily results for "${details?.query ?? ""}"`);

			if (details?.truncated) {
				summary += theme.fg("warning", " (truncated)");
			}

			if (!expanded) {
				// Collapsed view - show preview
				const lines = content.split("\n").filter((l) => l.trim());
				const preview = lines.slice(0, 5).join("\n");
				const moreCount = Math.max(0, lines.length - 5);

				let text = summary;
				if (preview) {
					text += "\n" + theme.fg("dim", preview);
				}
				if (moreCount > 0) {
					text += "\n" + theme.fg("muted", `... ${moreCount} more lines (Ctrl+O to expand)`);
				}

				return new Text(text, 0, 0);
			}

			// Expanded view - show full content
			return new Text(summary + "\n" + content, 0, 0);
		},
	});
}
