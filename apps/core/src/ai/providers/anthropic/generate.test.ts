import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create };
	},
}));

import { generateAnthropic } from "./generate";
import type { ProviderRequest } from "..";

function request(): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "weather in Berlin?",
		model: "claude-sonnet-5",
		parameters: { max_tokens: 100 },
	};
}

describe("generateAnthropic tool call normalization", () => {
	beforeEach(() => create.mockReset());

	it("normalizes every tool_use block", async () => {
		create.mockResolvedValue({
			content: [
				{ type: "tool_use", id: "tu_1", name: "get_weather", input: { city: "Berlin" } },
				{ type: "tool_use", id: "tu_2", name: "get_time", input: { tz: "CET" } },
			],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.toolCalls).toEqual([
			{ id: "tu_1", name: "get_weather", args: { city: "Berlin" } },
			{ id: "tu_2", name: "get_time", args: { tz: "CET" } },
		]);
	});

	it("leaves toolCalls undefined for a text answer", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.toolCalls).toBeUndefined();
		expect(result.answer).toBe("It is 12°");
	});
});

describe("generateAnthropic usage normalization", () => {
	beforeEach(() => create.mockReset());

	it("adds the cache tokens Anthropic reports beside input_tokens into prompt", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: {
				input_tokens: 100,
				cache_read_input_tokens: 800,
				cache_creation_input_tokens: 50,
				output_tokens: 300,
			},
		});

		const result = await generateAnthropic(request());

		expect(result.tokens).toEqual({
			prompt: 950,
			completion: 300,
			total: 1250,
			cacheRead: 800,
			cacheWrite: 50,
			reasoning: 0,
		});
	});

	it("treats absent cache counts as zero", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: "It is 12°" }],
			usage: { input_tokens: 1, output_tokens: 2 },
		});

		const result = await generateAnthropic(request());

		expect(result.tokens).toEqual({
			prompt: 1,
			completion: 2,
			total: 3,
			cacheRead: 0,
			cacheWrite: 0,
			reasoning: 0,
		});
	});
});
