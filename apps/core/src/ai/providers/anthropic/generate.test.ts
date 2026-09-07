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
		promptPrice: 1,
		completionPrice: 1,
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
