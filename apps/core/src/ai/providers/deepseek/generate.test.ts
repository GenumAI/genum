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
		promptPrice: 1,
		completionPrice: 1,
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
