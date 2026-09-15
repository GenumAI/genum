import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
	default: class {
		chat = { completions: { create } };
	},
}));

import { generateDeepSeek } from "./generate";
import type { ProviderRequest } from "..";

function request(): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "weather in Berlin?",
		model: "deepseek-v4-flash",
		parameters: {},
	};
}

function toolCall(id: string, name: string, args: string) {
	return { id, type: "function", function: { name, arguments: args } };
}

describe("generateDeepSeek tool call normalization", () => {
	beforeEach(() => create.mockReset());

	it("normalizes every tool call, not just the first", async () => {
		create.mockResolvedValue({
			choices: [
				{
					message: {
						content: null,
						tool_calls: [
							toolCall("c1", "get_weather", '{"city":"Berlin"}'),
							toolCall("c2", "get_time", '{"tz":"CET"}'),
						],
					},
				},
			],
			usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
		});

		const result = await generateDeepSeek(request());

		expect(result.toolCalls).toEqual([
			{ id: "c1", name: "get_weather", args: { city: "Berlin" } },
			{ id: "c2", name: "get_time", args: { tz: "CET" } },
		]);
	});
});

describe("generateDeepSeek usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("reads cache hits and reasoning out of their totals", async () => {
		create.mockResolvedValue({
			choices: [{ message: { content: "It is 12°" } }],
			usage: {
				prompt_tokens: 1000,
				prompt_cache_hit_tokens: 900,
				prompt_cache_miss_tokens: 100,
				completion_tokens: 400,
				completion_tokens_details: { reasoning_tokens: 350 },
				total_tokens: 1400,
			},
		});

		const result = await generateDeepSeek(request());

		expect(result.tokens).toEqual({
			prompt: 1000,
			completion: 400,
			total: 1400,
			cacheRead: 900,
			cacheWrite: 0,
			reasoning: 350,
		});
	});

	it("falls back to the OpenAI-shaped cached_tokens when hit tokens are absent", async () => {
		create.mockResolvedValue({
			choices: [{ message: { content: "It is 12°" } }],
			usage: {
				prompt_tokens: 1000,
				prompt_tokens_details: { cached_tokens: 700 },
				completion_tokens: 10,
				total_tokens: 1010,
			},
		});

		const result = await generateDeepSeek(request());

		expect(result.tokens.cacheRead).toBe(700);
		expect(result.tokens.reasoning).toBe(0);
	});
});
